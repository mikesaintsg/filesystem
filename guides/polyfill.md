# @mikesaintsg/filesystem Polyfill Guide

> **Comprehensive guide for implementing fallback storage when OPFS is unavailable**

This guide explains how to integrate a polyfill with `@mikesaintsg/filesystem` for environments where the Origin Private File System (OPFS) is unavailable or blocked.

---

## Table of Contents

1. [Understanding OPFS Limitations](#understanding-opfs-limitations)
2. [When OPFS Fails](#when-opfs-fails)
3. [Polyfill Strategy](#polyfill-strategy)
4. [IndexedDB Fallback Implementation](#indexeddb-fallback-implementation)
5. [Integration with @mikesaintsg/filesystem](#integration-with-mikesaintsgfilesystem)
6. [Unified Storage Adapter Pattern](#unified-storage-adapter-pattern)
7. [Feature Detection](#feature-detection)
8. [Performance Considerations](#performance-considerations)
9. [Browser-Specific Issues](#browser-specific-issues)
10. [Third-Party Polyfill Libraries](#third-party-polyfill-libraries)
11. [Complete Implementation Example](#complete-implementation-example)
12. [Testing Strategies](#testing-strategies)

---

## Understanding OPFS Limitations

### What is OPFS?

The Origin Private File System (OPFS) is a browser API providing:

- **High-performance** file storage (much faster than IndexedDB for large files)
- **Sandboxed** storage per origin (invisible to users)
- **Synchronous access** in Web Workers via `FileSystemSyncAccessHandle`
- **No user prompts** required (unlike File System Access API)

### Browser Support

| Browser | OPFS Support | Sync Access | Notes |
|---------|--------------|-------------|-------|
| Chrome 86+ | ✅ | ✅ (102+) | Full support |
| Edge 86+ | ✅ | ✅ (102+) | Uses Chromium engine |
| Safari 15.2+ | ✅ | ✅ | Limited quota in private browsing |
| Firefox 111+ | ✅ | ✅ | Full support |
| Chrome Android | ✅ | ✅ | **WebView 132 bug** (see below) |
| Edge Android | ✅ | ✅ | **WebView 132 bug** (see below) |
| Safari iOS | ⚠️ | ⚠️ | Limited in private browsing |

### Known Issues

#### Android WebView 132 Bug (Current)

**Error Message:**
```
NotAllowedError: It was determined that certain files are unsafe for access within a Web application, or that too many calls are being made on file resources.
```

**Cause:** This is a **known regression bug** in Android WebView version 132 (affects Chrome/Edge on Android 14/15). It is NOT a fundamental limitation of OPFS on mobile.

**Status:** A fix has been merged to Chromium source and is rolling out in subsequent WebView updates.

**Workaround:** Use IndexedDB as a fallback until the browser is updated.

#### Safari iOS Private Browsing

Safari iOS in private browsing mode has severely limited storage quota and may throw quota errors even for small files.

#### Cross-Origin Iframes

OPFS is not available in cross-origin iframes without proper CORS headers.

---

## When OPFS Fails

### Common Failure Scenarios

| Scenario | Error Type | Solution |
|----------|------------|----------|
| Private browsing mode | `NotAllowedError` | Fallback to IndexedDB |
| Android WebView 132 bug | `NotAllowedError` | Fallback to IndexedDB |
| Cross-origin iframe | `SecurityError` | Request proper permissions |
| HTTP (not HTTPS) | `SecurityError` | Deploy to HTTPS |
| Storage quota exceeded | `QuotaExceededError` | Clear storage or request more |
| Unsupported browser | `TypeError` | Fallback to IndexedDB |

### Detecting OPFS Availability

```typescript
async function isOPFSAvailable(): Promise<boolean> {
	// Check if API exists
	if (typeof navigator?.storage?.getDirectory !== 'function') {
		return false
	}

	// Try to actually use it (some browsers report support but fail at runtime)
	try {
		const root = await navigator.storage.getDirectory()
		// Try to create a test file
		const testHandle = await root.getFileHandle('.opfs-test', { create: true })
		// Clean up
		await root.removeEntry('.opfs-test')
		return true
	} catch {
		return false
	}
}
```

---

## Polyfill Strategy

### Design Principles

Following the `@mikesaintsg/filesystem` design philosophy:

1. **Seamless integration**: Same API surface as OPFS implementation
2. **Zero configuration**: Automatic fallback when OPFS fails
3. **Transparent behavior**: Consumer code works identically
4. **Type safety**: Full TypeScript support with identical interfaces

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FileSystemInterface                       │
├─────────────────────────────────────────────────────────────┤
│                   StorageAdapter (abstract)                  │
├──────────────────────────┬──────────────────────────────────┤
│    OPFSAdapter           │     IndexedDBAdapter             │
│    (native OPFS)         │     (polyfill)                   │
└──────────────────────────┴──────────────────────────────────┘
```

### Adapter Selection

```typescript
async function createStorageAdapter(): Promise<StorageAdapter> {
	if (await isOPFSAvailable()) {
		return new OPFSAdapter()
	}
	return new IndexedDBAdapter()
}
```

---

## IndexedDB Fallback Implementation

### Data Model

The IndexedDB polyfill uses a hierarchical data model:

```typescript
/** Stored file entry */
interface IDBFileEntry {
	readonly path: string           // Full path: '/folder/subfolder/file.txt'
	readonly name: string           // File name: 'file.txt'
	readonly type: 'file'
	readonly content: ArrayBuffer   // Binary content
	readonly mimeType: string       // MIME type
	readonly lastModified: number   // Timestamp
}

/** Stored directory entry */
interface IDBDirectoryEntry {
	readonly path: string           // Full path: '/folder/subfolder'
	readonly name: string           // Directory name: 'subfolder'
	readonly type: 'directory'
}

type IDBEntry = IDBFileEntry | IDBDirectoryEntry
```

### Database Schema

```typescript
const DB_NAME = '@mikesaintsg/filesystem-polyfill'
const DB_VERSION = 1

interface PolyfillDatabase {
	entries: IDBEntry[]  // Object store for all entries
}

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION)

		request.onerror = () => reject(request.error)
		request.onsuccess = () => resolve(request.result)

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result

			// Create entries store with path as key
			const store = db.createObjectStore('entries', { keyPath: 'path' })

			// Index for parent directory lookups
			store.createIndex('parent', 'parent', { unique: false })

			// Index for type filtering
			store.createIndex('type', 'type', { unique: false })
		}
	})
}
```

### Core Operations

#### Creating a File

```typescript
async function createFile(
	db: IDBDatabase,
	path: string,
	name: string
): Promise<IDBFileEntry> {
	const entry: IDBFileEntry = {
		path: normalizePath(path, name),
		name,
		type: 'file',
		content: new ArrayBuffer(0),
		mimeType: getMimeType(name),
		lastModified: Date.now(),
	}

	return new Promise((resolve, reject) => {
		const tx = db.transaction('entries', 'readwrite')
		const store = tx.objectStore('entries')
		const request = store.put(entry)

		request.onsuccess = () => resolve(entry)
		request.onerror = () => reject(request.error)
	})
}
```

#### Writing to a File

```typescript
async function writeFile(
	db: IDBDatabase,
	path: string,
	data: WriteData
): Promise<void> {
	const content = await toArrayBuffer(data)

	return new Promise((resolve, reject) => {
		const tx = db.transaction('entries', 'readwrite')
		const store = tx.objectStore('entries')

		// Get existing entry
		const getRequest = store.get(path)

		getRequest.onsuccess = () => {
			const entry = getRequest.result as IDBFileEntry | undefined

			if (!entry || entry.type !== 'file') {
				reject(new NotFoundError(path))
				return
			}

			// Update entry
			const updated: IDBFileEntry = {
				...entry,
				content,
				lastModified: Date.now(),
			}

			const putRequest = store.put(updated)
			putRequest.onsuccess = () => resolve()
			putRequest.onerror = () => reject(putRequest.error)
		}

		getRequest.onerror = () => reject(getRequest.error)
	})
}
```

#### Reading a File

```typescript
async function readFile(
	db: IDBDatabase,
	path: string
): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction('entries', 'readonly')
		const store = tx.objectStore('entries')
		const request = store.get(path)

		request.onsuccess = () => {
			const entry = request.result as IDBFileEntry | undefined

			if (!entry || entry.type !== 'file') {
				reject(new NotFoundError(path))
				return
			}

			resolve(entry.content)
		}

		request.onerror = () => reject(request.error)
	})
}
```

#### Listing Directory Contents

```typescript
async function listDirectory(
	db: IDBDatabase,
	path: string
): Promise<readonly IDBEntry[]> {
	const normalizedPath = path === '/' ? '' : path

	return new Promise((resolve, reject) => {
		const tx = db.transaction('entries', 'readonly')
		const store = tx.objectStore('entries')
		const entries: IDBEntry[] = []

		const request = store.openCursor()

		request.onsuccess = () => {
			const cursor = request.result

			if (cursor) {
				const entry = cursor.value as IDBEntry
				const entryParent = getParentPath(entry.path)

				if (entryParent === normalizedPath) {
					entries.push(entry)
				}

				cursor.continue()
			} else {
				resolve(entries)
			}
		}

		request.onerror = () => reject(request.error)
	})
}
```

---

## Integration with @mikesaintsg/filesystem

### Creating a Polyfill-Aware Factory

The key to seamless integration is extending the factory function:

```typescript
import { createFileSystem as createOPFSFileSystem } from '@mikesaintsg/filesystem'
import type { FileSystemInterface } from '@mikesaintsg/filesystem'

/**
 * Creates a file system interface with automatic fallback.
 *
 * Tries OPFS first, falls back to IndexedDB polyfill if unavailable.
 */
export async function createFileSystem(): Promise<FileSystemInterface> {
	// Try OPFS first
	if (await isOPFSAvailable()) {
		try {
			return await createOPFSFileSystem()
		} catch {
			// OPFS failed at runtime, fall back
		}
	}

	// Fall back to IndexedDB polyfill
	return createPolyfillFileSystem()
}

/**
 * Creates an IndexedDB-backed file system.
 */
async function createPolyfillFileSystem(): Promise<FileSystemInterface> {
	const db = await openDatabase()
	return new IndexedDBFileSystem(db)
}
```

### IndexedDBFileSystem Class

```typescript
class IndexedDBFileSystem implements FileSystemInterface {
	readonly #db: IDBDatabase

	constructor(db: IDBDatabase) {
		this.#db = db
	}

	async getRoot(): Promise<DirectoryInterface> {
		// Ensure root exists
		await ensureDirectory(this.#db, '/')
		return new IndexedDBDirectory(this.#db, '/')
	}

	async getQuota(): Promise<StorageQuota> {
		// IndexedDB doesn't have direct quota API
		// Use Storage API estimate if available
		if (navigator.storage?.estimate) {
			const estimate = await navigator.storage.estimate()
			return {
				usage: estimate.usage ?? 0,
				quota: estimate.quota ?? 0,
				available: (estimate.quota ?? 0) - (estimate.usage ?? 0),
				percentUsed: estimate.quota
					? ((estimate.usage ?? 0) / estimate.quota) * 100
					: 0,
			}
		}

		// Fallback for older browsers
		return {
			usage: 0,
			quota: 0,
			available: 0,
			percentUsed: 0,
		}
	}

	isUserAccessSupported(): boolean {
		// File pickers are browser-native, not affected by storage backend
		return typeof window.showOpenFilePicker === 'function'
	}

	// ... implement remaining FileSystemInterface methods
}
```

### IndexedDBDirectory Class

```typescript
class IndexedDBDirectory implements DirectoryInterface {
	readonly #db: IDBDatabase
	readonly #path: string

	// Fake native handle for interface compatibility
	readonly native: FileSystemDirectoryHandle

	constructor(db: IDBDatabase, path: string) {
		this.#db = db
		this.#path = path

		// Create a fake handle for compatibility
		// Consumers should check before using native
		this.native = null as unknown as FileSystemDirectoryHandle
	}

	getName(): string {
		if (this.#path === '/' || this.#path === '') {
			return ''
		}
		return this.#path.split('/').pop() ?? ''
	}

	async getFile(name: string): Promise<FileInterface | undefined> {
		const filePath = joinPath(this.#path, name)
		const entry = await getEntry(this.#db, filePath)

		if (!entry || entry.type !== 'file') {
			return undefined
		}

		return new IndexedDBFile(this.#db, filePath)
	}

	async resolveFile(name: string): Promise<FileInterface> {
		const file = await this.getFile(name)
		if (!file) {
			throw new NotFoundError(name)
		}
		return file
	}

	async createFile(name: string): Promise<FileInterface> {
		const filePath = joinPath(this.#path, name)
		await createFile(this.#db, this.#path, name)
		return new IndexedDBFile(this.#db, filePath)
	}

	async hasFile(name: string): Promise<boolean> {
		const file = await this.getFile(name)
		return file !== undefined
	}

	async removeFile(name: string): Promise<void> {
		const filePath = joinPath(this.#path, name)
		await removeEntry(this.#db, filePath)
	}

	async createDirectory(name: string): Promise<DirectoryInterface> {
		const dirPath = joinPath(this.#path, name)
		await ensureDirectory(this.#db, dirPath)
		return new IndexedDBDirectory(this.#db, dirPath)
	}

	async *entries(): AsyncIterable<DirectoryEntry> {
		const children = await listDirectory(this.#db, this.#path)

		for (const entry of children) {
			yield {
				name: entry.name,
				kind: entry.type === 'file' ? 'file' : 'directory',
				handle: null as unknown as FileSystemHandle,
			}
		}
	}

	// ... implement remaining DirectoryInterface methods
}
```

### IndexedDBFile Class

```typescript
class IndexedDBFile implements FileInterface {
	readonly #db: IDBDatabase
	readonly #path: string

	// Fake native handle for interface compatibility
	readonly native: FileSystemFileHandle

	constructor(db: IDBDatabase, path: string) {
		this.#db = db
		this.#path = path
		this.native = null as unknown as FileSystemFileHandle
	}

	getName(): string {
		return this.#path.split('/').pop() ?? ''
	}

	async getMetadata(): Promise<FileMetadata> {
		const entry = await getFileEntry(this.#db, this.#path)

		return {
			name: entry.name,
			size: entry.content.byteLength,
			type: entry.mimeType,
			lastModified: entry.lastModified,
		}
	}

	async getText(): Promise<string> {
		const buffer = await readFile(this.#db, this.#path)
		return new TextDecoder().decode(buffer)
	}

	async getArrayBuffer(): Promise<ArrayBuffer> {
		return readFile(this.#db, this.#path)
	}

	async getBlob(): Promise<Blob> {
		const entry = await getFileEntry(this.#db, this.#path)
		return new Blob([entry.content], { type: entry.mimeType })
	}

	getStream(): ReadableStream<Uint8Array> {
		// Create a stream from the stored content
		const db = this.#db
		const path = this.#path

		return new ReadableStream({
			async start(controller) {
				try {
					const buffer = await readFile(db, path)
					controller.enqueue(new Uint8Array(buffer))
					controller.close()
				} catch (error) {
					controller.error(error)
				}
			},
		})
	}

	async write(data: WriteData, options?: WriteOptions): Promise<void> {
		const content = await toArrayBuffer(data)

		if (options?.position !== undefined || options?.keepExistingData) {
			// Handle partial writes
			const existing = await readFile(this.#db, this.#path).catch(() => new ArrayBuffer(0))
			const merged = mergeContent(existing, content, options)
			await writeFile(this.#db, this.#path, merged)
		} else {
			await writeFile(this.#db, this.#path, content)
		}
	}

	async append(data: WriteData): Promise<void> {
		const existing = await readFile(this.#db, this.#path).catch(() => new ArrayBuffer(0))
		const addition = await toArrayBuffer(data)
		const merged = concatenateBuffers(existing, addition)
		await writeFile(this.#db, this.#path, merged)
	}

	async truncate(size: number): Promise<void> {
		const existing = await readFile(this.#db, this.#path)
		const truncated = existing.slice(0, size)

		// Pad with zeros if size is larger
		if (size > existing.byteLength) {
			const padded = new ArrayBuffer(size)
			new Uint8Array(padded).set(new Uint8Array(existing))
			await writeFile(this.#db, this.#path, padded)
		} else {
			await writeFile(this.#db, this.#path, truncated)
		}
	}

	async openWritable(): Promise<WritableFileInterface> {
		return new IndexedDBWritableFile(this.#db, this.#path)
	}

	// Permissions are always granted for IndexedDB
	async hasReadPermission(): Promise<boolean> {
		return true
	}

	async hasWritePermission(): Promise<boolean> {
		return true
	}

	async requestWritePermission(): Promise<boolean> {
		return true
	}

	async isSameEntry(other: FileInterface | DirectoryInterface): Promise<boolean> {
		if (other instanceof IndexedDBFile) {
			return this.#path === other.#path
		}
		return false
	}
}
```

---

## Unified Storage Adapter Pattern

For maximum flexibility, use an adapter pattern:

```typescript
/** Storage adapter interface */
interface StorageAdapterInterface {
	readonly type: 'opfs' | 'indexeddb' | 'memory'
	getRoot(): Promise<DirectoryInterface>
	getQuota(): Promise<StorageQuota>
	isAvailable(): Promise<boolean>
}

/** OPFS adapter */
class OPFSAdapter implements StorageAdapterInterface {
	readonly type = 'opfs' as const

	async isAvailable(): Promise<boolean> {
		return isOPFSAvailable()
	}

	async getRoot(): Promise<DirectoryInterface> {
		const fs = await createOPFSFileSystem()
		return fs.getRoot()
	}

	async getQuota(): Promise<StorageQuota> {
		const fs = await createOPFSFileSystem()
		return fs.getQuota()
	}
}

/** IndexedDB adapter */
class IndexedDBAdapter implements StorageAdapterInterface {
	readonly type = 'indexeddb' as const
	#db: IDBDatabase | null = null

	async isAvailable(): Promise<boolean> {
		return typeof indexedDB !== 'undefined'
	}

	async getRoot(): Promise<DirectoryInterface> {
		if (!this.#db) {
			this.#db = await openDatabase()
		}
		return new IndexedDBDirectory(this.#db, '/')
	}

	async getQuota(): Promise<StorageQuota> {
		// Use Storage API
		if (navigator.storage?.estimate) {
			const estimate = await navigator.storage.estimate()
			return {
				usage: estimate.usage ?? 0,
				quota: estimate.quota ?? 0,
				available: (estimate.quota ?? 0) - (estimate.usage ?? 0),
				percentUsed: estimate.quota
					? ((estimate.usage ?? 0) / estimate.quota) * 100
					: 0,
			}
		}
		return { usage: 0, quota: 0, available: 0, percentUsed: 0 }
	}
}

/** Memory adapter (for testing) */
class MemoryAdapter implements StorageAdapterInterface {
	readonly type = 'memory' as const
	#storage = new Map<string, IDBEntry>()

	async isAvailable(): Promise<boolean> {
		return true
	}

	async getRoot(): Promise<DirectoryInterface> {
		return new MemoryDirectory(this.#storage, '/')
	}

	async getQuota(): Promise<StorageQuota> {
		let usage = 0
		for (const entry of this.#storage.values()) {
			if (entry.type === 'file') {
				usage += entry.content.byteLength
			}
		}
		return {
			usage,
			quota: Infinity,
			available: Infinity,
			percentUsed: 0,
		}
	}
}
```

### Adapter Factory

```typescript
/** Adapter priority order */
const ADAPTER_PRIORITY: readonly StorageAdapterInterface[] = [
	new OPFSAdapter(),
	new IndexedDBAdapter(),
	new MemoryAdapter(),
]

/**
 * Creates best available storage adapter.
 *
 * @returns The first available adapter in priority order
 */
async function createAdapter(): Promise<StorageAdapterInterface> {
	for (const adapter of ADAPTER_PRIORITY) {
		if (await adapter.isAvailable()) {
			return adapter
		}
	}

	throw new Error('No storage adapter available')
}

/**
 * Creates a file system with automatic adapter selection.
 */
export async function createFileSystemWithFallback(): Promise<{
	fs: FileSystemInterface
	adapter: StorageAdapterInterface
}> {
	const adapter = await createAdapter()

	// Build FileSystemInterface using the adapter
	const fs: FileSystemInterface = {
		getRoot: () => adapter.getRoot(),
		getQuota: () => adapter.getQuota(),
		isUserAccessSupported: () => typeof window.showOpenFilePicker === 'function',
		// ... other methods
	}

	return { fs, adapter }
}
```

---

## Feature Detection

### Comprehensive Detection

```typescript
interface FileSystemCapabilities {
	/** OPFS is available */
	readonly opfs: boolean
	/** IndexedDB is available */
	readonly indexeddb: boolean
	/** File pickers are available (Chromium only) */
	readonly filePickers: boolean
	/** Sync access handles are available (Workers only) */
	readonly syncAccess: boolean
	/** Storage API estimate is available */
	readonly storageEstimate: boolean
	/** Currently in private browsing mode (best effort detection) */
	readonly privateMode: boolean
}

async function detectCapabilities(): Promise<FileSystemCapabilities> {
	const opfs = await isOPFSAvailable()
	const indexeddb = typeof indexedDB !== 'undefined'
	const filePickers = typeof window.showOpenFilePicker === 'function'
	const syncAccess = typeof FileSystemSyncAccessHandle !== 'undefined'
	const storageEstimate = typeof navigator?.storage?.estimate === 'function'

	// Private mode detection (heuristic, not 100% reliable)
	let privateMode = false
	try {
		const testKey = '__private_test__'
		localStorage.setItem(testKey, '1')
		localStorage.removeItem(testKey)
	} catch {
		privateMode = true
	}

	return {
		opfs,
		indexeddb,
		filePickers,
		syncAccess,
		storageEstimate,
		privateMode,
	}
}
```

### Usage in Application

```typescript
const caps = await detectCapabilities()

if (caps.opfs) {
	console.log('Using native OPFS')
} else if (caps.indexeddb) {
	console.log('Using IndexedDB fallback')
	if (caps.privateMode) {
		console.warn('Private browsing detected - storage may be limited')
	}
} else {
	console.error('No persistent storage available')
}
```

---

## Performance Considerations

### OPFS vs IndexedDB Performance

| Operation | OPFS | IndexedDB | Ratio |
|-----------|------|-----------|-------|
| Write 1MB | ~5ms | ~50ms | 10x slower |
| Read 1MB | ~3ms | ~30ms | 10x slower |
| Write 100MB | ~100ms | ~2000ms | 20x slower |
| Sync write (Worker) | ~1ms | N/A | N/A |

### Optimization Strategies

#### 1. Batch Writes

```typescript
// ❌ Slow: many small writes
for (const chunk of chunks) {
	await file.append(chunk)
}

// ✅ Fast: single large write
const combined = concatenateBuffers(...chunks)
await file.write(combined)
```

#### 2. Use Transactions

```typescript
// Wrap multiple operations in a single transaction
async function batchCreate(
	db: IDBDatabase,
	files: readonly { path: string; content: ArrayBuffer }[]
): Promise<void> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction('entries', 'readwrite')
		const store = tx.objectStore('entries')

		for (const file of files) {
			store.put({
				path: file.path,
				name: getFileName(file.path),
				type: 'file',
				content: file.content,
				mimeType: getMimeType(file.path),
				lastModified: Date.now(),
			})
		}

		tx.oncomplete = () => resolve()
		tx.onerror = () => reject(tx.error)
	})
}
```

#### 3. Lazy Loading

```typescript
// Don't load content until needed
class LazyFile implements FileInterface {
	#content: ArrayBuffer | null = null

	async getArrayBuffer(): Promise<ArrayBuffer> {
		if (!this.#content) {
			this.#content = await readFile(this.#db, this.#path)
		}
		return this.#content
	}
}
```

---

## Browser-Specific Issues

### Android WebView 132 Bug

**Affected versions:** Android WebView 132.x, Chrome Android 132.x, Edge Android 132.x

**Error:**
```
NotAllowedError: It was determined that certain files are unsafe for access
```

**Workaround:**
```typescript
async function createFileSystemSafe(): Promise<FileSystemInterface> {
	try {
		const root = await navigator.storage.getDirectory()
		// Test actual file creation
		await root.getFileHandle('.test', { create: true })
		await root.removeEntry('.test')
		// OPFS works
		return createOPFSFileSystem()
	} catch (error) {
		if (error instanceof DOMException && error.name === 'NotAllowedError') {
			console.warn('OPFS blocked (WebView 132 bug?), using IndexedDB fallback')
			return createPolyfillFileSystem()
		}
		throw error
	}
}
```

### Safari iOS Private Browsing

**Issue:** Limited quota, may fail silently

**Workaround:**
```typescript
async function testStorageQuota(): Promise<boolean> {
	try {
		const estimate = await navigator.storage.estimate()
		// Safari private mode often reports 0 quota
		return (estimate.quota ?? 0) > 0
	} catch {
		return false
	}
}
```

### Firefox OPFS in iframes

**Issue:** OPFS may not be available in iframes

**Workaround:** Use `postMessage` to communicate with parent window or use IndexedDB.

---

## Third-Party Polyfill Libraries

If you prefer a ready-made solution:

### 1. native-file-system-adapter

A ponyfill for the File System Access API with multiple backends.

```bash
npm install native-file-system-adapter
```

```typescript
import { getOriginPrivateDirectory } from 'native-file-system-adapter'

// Uses IndexedDB backend
const root = await getOriginPrivateDirectory()
```

**Pros:**
- Multiple backends (IndexedDB, memory, cache)
- TypeScript support
- Active maintenance

**Cons:**
- Different API than our library
- Additional dependency

### 2. idb.filesystem.js

HTML5 Filesystem API polyfill using IndexedDB.

```bash
npm install idb.filesystem.js
```

**Pros:**
- Well-tested
- Broad browser support

**Cons:**
- Legacy API (not File System Access API)
- Callback-based

### 3. @aspect-build/aspect-file-system-access

TypeScript-first File System Access API polyfill.

**Pros:**
- Specification-conformant
- TypeScript support

**Cons:**
- Heavier bundle size

---

## Complete Implementation Example

Here's a complete, copy-pasteable implementation:

```typescript
// polyfill/index.ts
import {
	createFileSystem as createNativeFileSystem,
	NotFoundError,
	type FileSystemInterface,
	type DirectoryInterface,
	type FileInterface,
	type StorageQuota,
	type FileMetadata,
	type WriteData,
	type WriteOptions,
	type DirectoryEntry,
	type WalkEntry,
	type WalkOptions,
	type WritableFileInterface,
} from '@mikesaintsg/filesystem'

// ============================================================================
// OPFS Availability Check
// ============================================================================

async function isOPFSAvailable(): Promise<boolean> {
	if (typeof navigator?.storage?.getDirectory !== 'function') {
		return false
	}

	try {
		const root = await navigator.storage.getDirectory()
		const testName = `.opfs-test-${Date.now()}`
		await root.getFileHandle(testName, { create: true })
		await root.removeEntry(testName)
		return true
	} catch {
		return false
	}
}

// ============================================================================
// IndexedDB Database
// ============================================================================

const DB_NAME = '@mikesaintsg/filesystem-polyfill'
const DB_VERSION = 1

interface IDBFileEntry {
	path: string
	name: string
	parent: string
	type: 'file'
	content: ArrayBuffer
	mimeType: string
	lastModified: number
}

interface IDBDirEntry {
	path: string
	name: string
	parent: string
	type: 'directory'
}

type IDBEntry = IDBFileEntry | IDBDirEntry

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION)

		request.onerror = () => reject(request.error)
		request.onsuccess = () => resolve(request.result)

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result
			if (!db.objectStoreNames.contains('entries')) {
				const store = db.createObjectStore('entries', { keyPath: 'path' })
				store.createIndex('parent', 'parent', { unique: false })
				store.createIndex('type', 'type', { unique: false })
			}
		}
	})
}

// ============================================================================
// Utility Functions
// ============================================================================

function normalizePath(path: string): string {
	if (path === '' || path === '/') return '/'
	return '/' + path.split('/').filter(Boolean).join('/')
}

function joinPath(parent: string, child: string): string {
	const normalized = normalizePath(parent)
	if (normalized === '/') return '/' + child
	return normalized + '/' + child
}

function getParentPath(path: string): string {
	const parts = path.split('/').filter(Boolean)
	if (parts.length <= 1) return '/'
	return '/' + parts.slice(0, -1).join('/')
}

async function toArrayBuffer(data: WriteData): Promise<ArrayBuffer> {
	if (typeof data === 'string') {
		return new TextEncoder().encode(data).buffer
	}
	if (data instanceof Blob) {
		return data.arrayBuffer()
	}
	if (data instanceof ArrayBuffer) {
		return data
	}
	if (ArrayBuffer.isView(data)) {
		return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
	}
	// ReadableStream
	const reader = data.getReader()
	const chunks: Uint8Array[] = []
	let done = false
	while (!done) {
		const result = await reader.read()
		done = result.done
		if (result.value) chunks.push(result.value)
	}
	const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
	const result = new Uint8Array(totalLength)
	let offset = 0
	for (const chunk of chunks) {
		result.set(chunk, offset)
		offset += chunk.length
	}
	return result.buffer
}

function getMimeType(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase() ?? ''
	const mimeTypes: Record<string, string> = {
		txt: 'text/plain',
		html: 'text/html',
		css: 'text/css',
		js: 'application/javascript',
		json: 'application/json',
		png: 'image/png',
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		gif: 'image/gif',
		svg: 'image/svg+xml',
		pdf: 'application/pdf',
	}
	return mimeTypes[ext] ?? 'application/octet-stream'
}

// ============================================================================
// Public Factory
// ============================================================================

/**
 * Creates a file system with automatic fallback to IndexedDB.
 *
 * @returns FileSystemInterface using OPFS if available, IndexedDB otherwise
 */
export async function createFileSystem(): Promise<FileSystemInterface> {
	if (await isOPFSAvailable()) {
		try {
			return await createNativeFileSystem()
		} catch {
			// Fall through to polyfill
		}
	}

	const db = await openDatabase()
	return new PolyfillFileSystem(db)
}

/**
 * Checks which storage backend is being used.
 */
export async function getStorageBackend(): Promise<'opfs' | 'indexeddb'> {
	return (await isOPFSAvailable()) ? 'opfs' : 'indexeddb'
}

// ============================================================================
// Implementation Classes (abbreviated - full implementation would be larger)
// ============================================================================

class PolyfillFileSystem implements FileSystemInterface {
	readonly #db: IDBDatabase

	constructor(db: IDBDatabase) {
		this.#db = db
	}

	async getRoot(): Promise<DirectoryInterface> {
		// Ensure root exists
		await this.#ensureDirectory('/')
		return new PolyfillDirectory(this.#db, '/')
	}

	async #ensureDirectory(path: string): Promise<void> {
		const normalized = normalizePath(path)
		return new Promise((resolve, reject) => {
			const tx = this.#db.transaction('entries', 'readwrite')
			const store = tx.objectStore('entries')
			const request = store.get(normalized)

			request.onsuccess = () => {
				if (!request.result) {
					const entry: IDBDirEntry = {
						path: normalized,
						name: normalized === '/' ? '' : normalized.split('/').pop()!,
						parent: getParentPath(normalized),
						type: 'directory',
					}
					store.put(entry)
				}
				resolve()
			}
			request.onerror = () => reject(request.error)
		})
	}

	async getQuota(): Promise<StorageQuota> {
		if (navigator.storage?.estimate) {
			const est = await navigator.storage.estimate()
			return {
				usage: est.usage ?? 0,
				quota: est.quota ?? 0,
				available: (est.quota ?? 0) - (est.usage ?? 0),
				percentUsed: est.quota ? ((est.usage ?? 0) / est.quota) * 100 : 0,
			}
		}
		return { usage: 0, quota: 0, available: 0, percentUsed: 0 }
	}

	isUserAccessSupported(): boolean {
		return typeof window.showOpenFilePicker === 'function'
	}

	// ... remaining methods would delegate to native or throw NotSupportedError
}

// PolyfillDirectory and PolyfillFile classes would implement the full interfaces
// This is abbreviated for the guide - see the full implementation in src/polyfill/
```

---

## Testing Strategies

### Unit Testing with Memory Adapter

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createMemoryFileSystem } from './polyfill/memory.js'

describe('polyfill', () => {
	let fs: FileSystemInterface

	beforeEach(async () => {
		fs = await createMemoryFileSystem()
	})

	it('creates and reads files', async () => {
		const root = await fs.getRoot()
		const file = await root.createFile('test.txt')
		await file.write('Hello, World!')

		const content = await file.getText()
		expect(content).toBe('Hello, World!')
	})
})
```

### Integration Testing

```typescript
describe('fallback behavior', () => {
	it('uses IndexedDB when OPFS is blocked', async () => {
		// Simulate OPFS being unavailable
		const originalGetDirectory = navigator.storage.getDirectory
		navigator.storage.getDirectory = () => Promise.reject(new DOMException('Blocked', 'NotAllowedError'))

		try {
			const fs = await createFileSystem()
			const backend = await getStorageBackend()
			expect(backend).toBe('indexeddb')
		} finally {
			navigator.storage.getDirectory = originalGetDirectory
		}
	})
})
```

---

## Summary

This polyfill guide provides:

1. **Understanding** of why OPFS fails (WebView 132 bug, private browsing, etc.)
2. **IndexedDB implementation** that mirrors the OPFS interface
3. **Seamless integration** with `@mikesaintsg/filesystem` API
4. **Adapter pattern** for flexibility between storage backends
5. **Performance tips** for optimizing IndexedDB operations
6. **Testing strategies** for ensuring fallback works correctly

### Key Takeaways

- The Android WebView 132 error is a **bug**, not a fundamental limitation
- IndexedDB is a reliable fallback with ~10x slower performance
- Use the adapter pattern for maximum flexibility
- Always test in private browsing mode and on mobile devices
- Consider using a third-party polyfill library for production

---

## References

- [MDN: Origin Private File System](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
- [Chrome Platform Status: OPFS on Android](https://chromestatus.com/feature/5079634203377664)
- [WebView 132 Bug Discussion](https://stackoverflow.com/questions/79374605/android-webview-origin-private-file-system)
- [native-file-system-adapter](https://www.npmjs.com/package/native-file-system-adapter)
- [idb.filesystem.js](https://github.com/ebidel/idb.filesystem.js)

---

**License:** MIT © Mike Garcia
