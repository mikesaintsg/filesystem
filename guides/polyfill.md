# @mikesaintsg/filesystem Polyfill Guide

> **Seamless IndexedDB fallback using `@mikesaintsg/indexeddb` with automatic migration to OPFS**

This guide explains how to integrate an IndexedDB fallback with `@mikesaintsg/filesystem` for environments where the Origin Private File System (OPFS) is unavailable or blocked.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Understanding OPFS Limitations](#understanding-opfs-limitations)
4. [The Adapter Pattern](#the-adapter-pattern)
5. [Creating an IndexedDB Adapter](#creating-an-indexeddb-adapter)
6. [Automatic Migration](#automatic-migration)
7. [Integration with createFileSystem](#integration-with-createfilesystem)
8. [Feature Detection](#feature-detection)
9. [Performance Considerations](#performance-considerations)
10. [Browser-Specific Issues](#browser-specific-issues)
11. [Complete Implementation](#complete-implementation)
12. [Testing Strategies](#testing-strategies)

---

## Overview

When OPFS is unavailable (Android WebView 132 bug, private browsing, etc.), you can use `@mikesaintsg/indexeddb` to provide a seamless fallback storage layer. The key features are:

- **Same API** — Your code works identically regardless of backend
- **Automatic migration** — When OPFS becomes available, data is migrated automatically
- **Zero configuration** — Just inject an adapter and everything works
- **Type-safe** — Full TypeScript support throughout

### Installation

```bash
npm install @mikesaintsg/filesystem @mikesaintsg/indexeddb
```

---

## Quick Start

```typescript
import { createFileSystem, isOPFSAvailable, getAvailableBackend } from '@mikesaintsg/filesystem'
import { createIndexedDBAdapter } from './polyfill/adapter.js'

// Check which backend is available
const backend = await getAvailableBackend()
console.log(`Using ${backend} storage`)

// Create file system with automatic fallback
let fs
if (await isOPFSAvailable()) {
	fs = await createFileSystem()
} else {
	const adapter = await createIndexedDBAdapter()
	fs = await createFileSystem({
		adapter,
		enableMigration: true,
		onMigrationComplete: () => console.log('Migration complete!'),
	})
}

// Use the file system — same API regardless of backend
const root = await fs.getRoot()
const file = await root.createFile('hello.txt')
await file.write('Hello, World!')
console.log(await file.getText()) // 'Hello, World!'
```

---

## Understanding OPFS Limitations

### When OPFS Fails

| Scenario | Error Type | Solution |
|----------|------------|----------|
| Private browsing mode | `NotAllowedError` | Use IndexedDB adapter |
| Android WebView 132 bug | `NotAllowedError` | Use IndexedDB adapter |
| `file://` protocol | `SecurityError` | Use web server or IndexedDB |
| HTTP (not HTTPS) | `SecurityError` | Deploy to HTTPS |
| Cross-origin iframe | `SecurityError` | Configure CORS |
| Unsupported browser | `TypeError` | Use IndexedDB adapter |

### Android WebView 132 Bug

**Error Message:**
```
NotAllowedError: It was determined that certain files are unsafe for access within a Web application, or that too many calls are being made on file resources.
```

**Cause:** A known regression bug in Android WebView version 132 (affects Chrome/Edge on Android 14/15).

**Status:** A fix is rolling out in subsequent WebView updates. Use IndexedDB fallback until users update their browsers.

### Browser Support

| Browser | OPFS Support | Notes |
|---------|--------------|-------|
| Chrome 86+ | ✅ | Full support |
| Edge 86+ | ✅ | Uses Chromium engine |
| Safari 15.2+ | ✅ | Limited in private browsing |
| Firefox 111+ | ✅ | Full support |
| Chrome Android | ⚠️ | WebView 132 bug |
| Edge Android | ⚠️ | WebView 132 bug |
| Safari iOS | ⚠️ | Limited in private browsing |

---

## The Adapter Pattern

The `@mikesaintsg/filesystem` library uses an adapter pattern for pluggable storage backends:

```
┌─────────────────────────────────────────────────────────────┐
│                    FileSystemInterface                       │
├─────────────────────────────────────────────────────────────┤
│               StorageAdapterInterface                        │
├──────────────────────────┬──────────────────────────────────┤
│    OPFSAdapter           │     IndexedDBAdapter             │
│    (native, default)     │     (polyfill)                   │
└──────────────────────────┴──────────────────────────────────┘
```

### StorageAdapterInterface

```typescript
import type { DirectoryInterface, StorageQuota, StorageBackend } from '@mikesaintsg/filesystem'

interface StorageAdapterInterface {
	/** Storage backend type identifier */
	readonly type: StorageBackend

	/** Checks if this adapter is available */
	isAvailable(): Promise<boolean>

	/** Gets the root directory */
	getRoot(): Promise<DirectoryInterface>

	/** Gets storage quota information */
	getQuota(): Promise<StorageQuota>

	/** Closes the adapter and releases resources */
	close(): void
}
```

---

## Creating an IndexedDB Adapter

Using `@mikesaintsg/indexeddb`, creating a fallback adapter is straightforward:

### Schema Definition

```typescript
// polyfill/schema.ts
import type { createDatabase } from '@mikesaintsg/indexeddb'

/** File entry stored in IndexedDB */
export interface FileEntry {
	readonly id: string              // Full path: '/folder/file.txt'
	readonly name: string            // File name: 'file.txt'
	readonly parent: string          // Parent path: '/folder'
	readonly kind: 'file'
	readonly content: ArrayBuffer
	readonly mimeType: string
	readonly lastModified: number
}

/** Directory entry stored in IndexedDB */
export interface DirectoryEntry {
	readonly id: string              // Full path: '/folder'
	readonly name: string            // Directory name: 'folder'
	readonly parent: string          // Parent path: '/'
	readonly kind: 'directory'
}

/** Union type for all entries */
export type Entry = FileEntry | DirectoryEntry

/** Database schema */
export interface PolyfillSchema {
	readonly entries: Entry
}

/** Database name and version */
export const DB_NAME = '@mikesaintsg/filesystem-polyfill'
export const DB_VERSION = 1
```

### Adapter Implementation

```typescript
// polyfill/adapter.ts
import { createDatabase } from '@mikesaintsg/indexeddb'
import type { DatabaseInterface } from '@mikesaintsg/indexeddb'
import type {
	StorageAdapterInterface,
	DirectoryInterface,
	StorageQuota,
	StorageBackend,
} from '@mikesaintsg/filesystem'
import { DB_NAME, DB_VERSION, type PolyfillSchema, type Entry } from './schema.js'
import { IndexedDBDirectory } from './directory.js'

/**
 * Creates an IndexedDB adapter for filesystem fallback.
 */
export async function createIndexedDBAdapter(): Promise<StorageAdapterInterface> {
	const db = await createDatabase<PolyfillSchema>({
		name: DB_NAME,
		version: DB_VERSION,
		stores: {
			entries: {
				keyPath: 'id',
				indexes: [
					{ name: 'byParent', keyPath: 'parent' },
					{ name: 'byKind', keyPath: 'kind' },
				],
			},
		},
	})

	// Ensure root directory exists
	const rootExists = await db.store('entries').has('/')
	if (!rootExists) {
		await db.store('entries').set({
			id: '/',
			name: '',
			parent: '',
			kind: 'directory',
		})
	}

	return new IndexedDBAdapter(db)
}

class IndexedDBAdapter implements StorageAdapterInterface {
	readonly type: StorageBackend = 'indexeddb'
	readonly #db: DatabaseInterface<PolyfillSchema>

	constructor(db: DatabaseInterface<PolyfillSchema>) {
		this.#db = db
	}

	async isAvailable(): Promise<boolean> {
		return typeof indexedDB !== 'undefined'
	}

	async getRoot(): Promise<DirectoryInterface> {
		return new IndexedDBDirectory(this.#db, '/')
	}

	async getQuota(): Promise<StorageQuota> {
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

	close(): void {
		this.#db.close()
	}
}
```

### Directory Implementation

```typescript
// polyfill/directory.ts
import type { DatabaseInterface } from '@mikesaintsg/indexeddb'
import type {
	DirectoryInterface,
	FileInterface,
	DirectoryEntry,
	WalkEntry,
	WalkOptions,
	RemoveDirectoryOptions,
} from '@mikesaintsg/filesystem'
import { NotFoundError } from '@mikesaintsg/filesystem'
import type { PolyfillSchema, Entry, FileEntry, DirectoryEntry as IDBDirectoryEntry } from './schema.js'
import { IndexedDBFile } from './file.js'

export class IndexedDBDirectory implements DirectoryInterface {
	readonly #db: DatabaseInterface<PolyfillSchema>
	readonly #path: string

	// Fake native handle for interface compatibility
	readonly native: FileSystemDirectoryHandle

	constructor(db: DatabaseInterface<PolyfillSchema>, path: string) {
		this.#db = db
		this.#path = path
		// Set to null - consumers should check before using native
		this.native = null as unknown as FileSystemDirectoryHandle
	}

	getName(): string {
		if (this.#path === '/') return ''
		return this.#path.split('/').pop() ?? ''
	}

	async getFile(name: string): Promise<FileInterface | undefined> {
		const filePath = this.#joinPath(name)
		const entry = await this.#db.store('entries').get(filePath)
		if (!entry || entry.kind !== 'file') return undefined
		return new IndexedDBFile(this.#db, filePath)
	}

	async resolveFile(name: string): Promise<FileInterface> {
		const file = await this.getFile(name)
		if (!file) throw new NotFoundError(name)
		return file
	}

	async createFile(name: string): Promise<FileInterface> {
		const filePath = this.#joinPath(name)
		const entry: FileEntry = {
			id: filePath,
			name,
			parent: this.#path,
			kind: 'file',
			content: new ArrayBuffer(0),
			mimeType: this.#getMimeType(name),
			lastModified: Date.now(),
		}
		await this.#db.store('entries').set(entry)
		return new IndexedDBFile(this.#db, filePath)
	}

	async hasFile(name: string): Promise<boolean> {
		const file = await this.getFile(name)
		return file !== undefined
	}

	async removeFile(name: string): Promise<void> {
		const filePath = this.#joinPath(name)
		await this.#db.store('entries').remove(filePath)
	}

	async getDirectory(name: string): Promise<DirectoryInterface | undefined> {
		const dirPath = this.#joinPath(name)
		const entry = await this.#db.store('entries').get(dirPath)
		if (!entry || entry.kind !== 'directory') return undefined
		return new IndexedDBDirectory(this.#db, dirPath)
	}

	async resolveDirectory(name: string): Promise<DirectoryInterface> {
		const dir = await this.getDirectory(name)
		if (!dir) throw new NotFoundError(name)
		return dir
	}

	async createDirectory(name: string): Promise<DirectoryInterface> {
		const dirPath = this.#joinPath(name)
		const existing = await this.#db.store('entries').get(dirPath)
		if (!existing) {
			const entry: IDBDirectoryEntry = {
				id: dirPath,
				name,
				parent: this.#path,
				kind: 'directory',
			}
			await this.#db.store('entries').set(entry)
		}
		return new IndexedDBDirectory(this.#db, dirPath)
	}

	async hasDirectory(name: string): Promise<boolean> {
		const dir = await this.getDirectory(name)
		return dir !== undefined
	}

	async removeDirectory(name: string, options?: RemoveDirectoryOptions): Promise<void> {
		const dirPath = this.#joinPath(name)

		if (options?.recursive) {
			// Remove all descendants
			const allEntries = await this.#db.store('entries').all()
			const toRemove = allEntries.filter(e =>
				e.id === dirPath || e.id.startsWith(dirPath + '/'),
			)
			await this.#db.store('entries').remove(toRemove.map(e => e.id))
		} else {
			await this.#db.store('entries').remove(dirPath)
		}
	}

	async resolvePath(...segments: readonly string[]): Promise<FileInterface | DirectoryInterface | undefined> {
		const fullPath = this.#joinPath(...segments)
		const entry = await this.#db.store('entries').get(fullPath)
		if (!entry) return undefined
		if (entry.kind === 'file') return new IndexedDBFile(this.#db, fullPath)
		return new IndexedDBDirectory(this.#db, fullPath)
	}

	async createPath(...segments: readonly string[]): Promise<DirectoryInterface> {
		let currentPath = this.#path
		for (const segment of segments) {
			currentPath = currentPath === '/' ? `/${segment}` : `${currentPath}/${segment}`
			const existing = await this.#db.store('entries').get(currentPath)
			if (!existing) {
				await this.#db.store('entries').set({
					id: currentPath,
					name: segment,
					parent: currentPath.substring(0, currentPath.lastIndexOf('/')) || '/',
					kind: 'directory',
				})
			}
		}
		return new IndexedDBDirectory(this.#db, currentPath)
	}

	async *entries(): AsyncIterable<DirectoryEntry> {
		const children = await this.#db.store('entries').query()
			.where('parent').equals(this.#path)
			.toArray()

		for (const entry of children) {
			yield {
				name: entry.name,
				kind: entry.kind,
				handle: null as unknown as FileSystemHandle,
			}
		}
	}

	async *files(): AsyncIterable<FileInterface> {
		const children = await this.#db.store('entries').query()
			.where('parent').equals(this.#path)
			.filter(e => e.kind === 'file')
			.toArray()

		for (const entry of children) {
			yield new IndexedDBFile(this.#db, entry.id)
		}
	}

	async *directories(): AsyncIterable<DirectoryInterface> {
		const children = await this.#db.store('entries').query()
			.where('parent').equals(this.#path)
			.filter(e => e.kind === 'directory')
			.toArray()

		for (const entry of children) {
			yield new IndexedDBDirectory(this.#db, entry.id)
		}
	}

	async list(): Promise<readonly DirectoryEntry[]> {
		const result: DirectoryEntry[] = []
		for await (const entry of this.entries()) {
			result.push(entry)
		}
		return result
	}

	async listFiles(): Promise<readonly FileInterface[]> {
		const result: FileInterface[] = []
		for await (const file of this.files()) {
			result.push(file)
		}
		return result
	}

	async listDirectories(): Promise<readonly DirectoryInterface[]> {
		const result: DirectoryInterface[] = []
		for await (const dir of this.directories()) {
			result.push(dir)
		}
		return result
	}

	async *walk(options?: WalkOptions): AsyncIterable<WalkEntry> {
		const maxDepth = options?.maxDepth ?? Infinity
		const includeFiles = options?.includeFiles !== false
		const includeDirectories = options?.includeDirectories !== false
		const filter = options?.filter

		async function* walkRecursive(
			db: DatabaseInterface<PolyfillSchema>,
			path: string,
			pathSegments: string[],
			depth: number,
		): AsyncIterable<WalkEntry> {
			if (depth > maxDepth) return

			const children = await db.store('entries').query()
				.where('parent').equals(path)
				.toArray()

			for (const entry of children) {
				const directoryEntry: DirectoryEntry = {
					name: entry.name,
					kind: entry.kind,
					handle: null as unknown as FileSystemHandle,
				}

				if (filter && !filter(directoryEntry, depth)) continue

				if (entry.kind === 'file' && includeFiles) {
					yield {
						path: pathSegments,
						entry: directoryEntry,
						depth,
					}
				} else if (entry.kind === 'directory' && includeDirectories) {
					yield {
						path: pathSegments,
						entry: directoryEntry,
						depth,
					}
				}

				// Recurse into directories
				if (entry.kind === 'directory') {
					yield* walkRecursive(db, entry.id, [...pathSegments, entry.name], depth + 1)
				}
			}
		}

		yield* walkRecursive(this.#db, this.#path, [], 0)
	}

	// Permissions are always granted for IndexedDB
	async hasReadPermission(): Promise<boolean> { return true }
	async hasWritePermission(): Promise<boolean> { return true }
	async requestWritePermission(): Promise<boolean> { return true }

	async isSameEntry(other: FileInterface | DirectoryInterface): Promise<boolean> {
		if (other instanceof IndexedDBDirectory) {
			return this.#path === other.#path
		}
		return false
	}

	async resolve(descendant: FileInterface | DirectoryInterface): Promise<readonly string[] | null> {
		if (descendant instanceof IndexedDBFile || descendant instanceof IndexedDBDirectory) {
			const descendantPath = (descendant as { _getPath(): string })._getPath?.() ?? ''
			if (descendantPath.startsWith(this.#path)) {
				const relative = descendantPath.substring(this.#path.length)
				return relative.split('/').filter(Boolean)
			}
		}
		return null
	}

	// Private helpers
	#joinPath(...segments: readonly string[]): string {
		const base = this.#path === '/' ? '' : this.#path
		return base + '/' + segments.join('/')
	}

	#getMimeType(name: string): string {
		const ext = name.split('.').pop()?.toLowerCase() ?? ''
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

	// Internal method for path access
	_getPath(): string {
		return this.#path
	}
}
```

### File Implementation

```typescript
// polyfill/file.ts
import type { DatabaseInterface } from '@mikesaintsg/indexeddb'
import type {
	FileInterface,
	DirectoryInterface,
	FileMetadata,
	WriteData,
	WriteOptions,
	WritableFileInterface,
} from '@mikesaintsg/filesystem'
import { NotFoundError } from '@mikesaintsg/filesystem'
import type { PolyfillSchema, FileEntry } from './schema.js'
import { IndexedDBWritableFile } from './writable.js'

export class IndexedDBFile implements FileInterface {
	readonly #db: DatabaseInterface<PolyfillSchema>
	readonly #path: string

	// Fake native handle
	readonly native: FileSystemFileHandle

	constructor(db: DatabaseInterface<PolyfillSchema>, path: string) {
		this.#db = db
		this.#path = path
		this.native = null as unknown as FileSystemFileHandle
	}

	getName(): string {
		return this.#path.split('/').pop() ?? ''
	}

	async getMetadata(): Promise<FileMetadata> {
		const entry = await this.#getEntry()
		return {
			name: entry.name,
			size: entry.content.byteLength,
			type: entry.mimeType,
			lastModified: entry.lastModified,
		}
	}

	async getText(): Promise<string> {
		const entry = await this.#getEntry()
		return new TextDecoder().decode(entry.content)
	}

	async getArrayBuffer(): Promise<ArrayBuffer> {
		const entry = await this.#getEntry()
		return entry.content
	}

	async getBlob(): Promise<Blob> {
		const entry = await this.#getEntry()
		return new Blob([entry.content], { type: entry.mimeType })
	}

	getStream(): ReadableStream<Uint8Array> {
		const db = this.#db
		const path = this.#path

		return new ReadableStream({
			async start(controller) {
				try {
					const entry = await db.store('entries').get(path) as FileEntry | undefined
					if (!entry || entry.kind !== 'file') {
						controller.error(new NotFoundError(path))
						return
					}
					controller.enqueue(new Uint8Array(entry.content))
					controller.close()
				} catch (error) {
					controller.error(error)
				}
			},
		})
	}

	async write(data: WriteData, options?: WriteOptions): Promise<void> {
		const content = await this.#toArrayBuffer(data)
		const entry = await this.#getEntry()

		let finalContent: ArrayBuffer
		if (options?.position !== undefined || options?.keepExistingData) {
			finalContent = this.#mergeContent(entry.content, content, options)
		} else {
			finalContent = content
		}

		await this.#db.store('entries').set({
			...entry,
			content: finalContent,
			lastModified: Date.now(),
		})
	}

	async append(data: WriteData): Promise<void> {
		const addition = await this.#toArrayBuffer(data)
		const entry = await this.#getEntry()
		const merged = this.#concatenateBuffers(entry.content, addition)

		await this.#db.store('entries').set({
			...entry,
			content: merged,
			lastModified: Date.now(),
		})
	}

	async truncate(size: number): Promise<void> {
		const entry = await this.#getEntry()
		let newContent: ArrayBuffer

		if (size >= entry.content.byteLength) {
			// Pad with zeros
			newContent = new ArrayBuffer(size)
			new Uint8Array(newContent).set(new Uint8Array(entry.content))
		} else {
			newContent = entry.content.slice(0, size)
		}

		await this.#db.store('entries').set({
			...entry,
			content: newContent,
			lastModified: Date.now(),
		})
	}

	async openWritable(): Promise<WritableFileInterface> {
		return new IndexedDBWritableFile(this.#db, this.#path)
	}

	// Permissions always granted for IndexedDB
	async hasReadPermission(): Promise<boolean> { return true }
	async hasWritePermission(): Promise<boolean> { return true }
	async requestWritePermission(): Promise<boolean> { return true }

	async isSameEntry(other: FileInterface | DirectoryInterface): Promise<boolean> {
		if (other instanceof IndexedDBFile) {
			return this.#path === other.#path
		}
		return false
	}

	// Private helpers
	async #getEntry(): Promise<FileEntry> {
		const entry = await this.#db.store('entries').get(this.#path) as FileEntry | undefined
		if (!entry || entry.kind !== 'file') {
			throw new NotFoundError(this.#path)
		}
		return entry
	}

	async #toArrayBuffer(data: WriteData): Promise<ArrayBuffer> {
		if (typeof data === 'string') {
			return new TextEncoder().encode(data).buffer as ArrayBuffer
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
		return result.buffer as ArrayBuffer
	}

	#mergeContent(existing: ArrayBuffer, addition: ArrayBuffer, options?: WriteOptions): ArrayBuffer {
		const position = options?.position ?? 0
		const newSize = Math.max(existing.byteLength, position + addition.byteLength)
		const result = new Uint8Array(newSize)

		if (options?.keepExistingData) {
			result.set(new Uint8Array(existing))
		}
		result.set(new Uint8Array(addition), position)

		return result.buffer as ArrayBuffer
	}

	#concatenateBuffers(a: ArrayBuffer, b: ArrayBuffer): ArrayBuffer {
		const result = new Uint8Array(a.byteLength + b.byteLength)
		result.set(new Uint8Array(a))
		result.set(new Uint8Array(b), a.byteLength)
		return result.buffer as ArrayBuffer
	}

	// Internal method for path access
	_getPath(): string {
		return this.#path
	}
}
```

---

## Automatic Migration

The `createFileSystem` function supports automatic migration from IndexedDB to OPFS when OPFS becomes available (e.g., after a browser update fixes the WebView 132 bug).

### How Migration Works

1. **Detection**: When `createFileSystem` is called with an adapter and `enableMigration: true`, it checks if OPFS is now available
2. **Scanning**: Walks the adapter's file tree to count files and calculate total size
3. **Copying**: Creates matching directory structure in OPFS and copies all file content
4. **Verification**: Confirms files were copied successfully
5. **Cleanup**: Closes the adapter (optionally clear IndexedDB data)

### Migration Configuration

```typescript
const fs = await createFileSystem({
	adapter: await createIndexedDBAdapter(),

	// Enable automatic migration (default: true)
	enableMigration: true,

	// Track migration progress
	onMigrationProgress: (progress) => {
		console.log(`Phase: ${progress.phase}`)
		console.log(`Files: ${progress.filesProcessed}/${progress.totalFiles}`)
		console.log(`Bytes: ${progress.bytesProcessed}/${progress.totalBytes}`)
		if (progress.currentFile) {
			console.log(`Current: ${progress.currentFile}`)
		}
	},

	// Handle migration completion
	onMigrationComplete: () => {
		console.log('Successfully migrated to OPFS!')
		// Optionally clear IndexedDB data
		indexedDB.deleteDatabase('@mikesaintsg/filesystem-polyfill')
	},
})
```

### MigrationProgress Interface

```typescript
interface MigrationProgress {
	readonly phase: 'scanning' | 'copying' | 'verifying' | 'cleanup'
	readonly currentFile?: string
	readonly filesProcessed: number
	readonly totalFiles: number
	readonly bytesProcessed: number
	readonly totalBytes: number
}
```

---

## Integration with createFileSystem

### Basic Integration

```typescript
import { createFileSystem, isOPFSAvailable } from '@mikesaintsg/filesystem'
import { createIndexedDBAdapter } from './polyfill/adapter.js'

export async function initFileSystem() {
	// Try OPFS first
	if (await isOPFSAvailable()) {
		return createFileSystem()
	}

	// Fall back to IndexedDB
	const adapter = await createIndexedDBAdapter()
	return createFileSystem({ adapter })
}
```

### With Migration UI

```typescript
import { createFileSystem, isOPFSAvailable } from '@mikesaintsg/filesystem'
import { createIndexedDBAdapter } from './polyfill/adapter.js'

export async function initFileSystemWithUI() {
	const adapter = await createIndexedDBAdapter()

	return createFileSystem({
		adapter,
		enableMigration: true,
		onMigrationProgress: (progress) => {
			// Update UI with migration progress
			updateProgressBar(progress.filesProcessed / progress.totalFiles)
			updateStatusText(`Migrating: ${progress.currentFile ?? 'Scanning...'}`)
		},
		onMigrationComplete: () => {
			showNotification('Storage upgraded to native OPFS!')
		},
	})
}
```

---

## Feature Detection

### Using Built-in Helpers

```typescript
import {
	isOPFSSupported,
	isOPFSAvailable,
	getAvailableBackend,
} from '@mikesaintsg/filesystem'

// Check if OPFS API exists (may still fail at runtime)
if (isOPFSSupported()) {
	console.log('OPFS API is available')
}

// Check if OPFS actually works (tests file creation)
if (await isOPFSAvailable()) {
	console.log('OPFS is fully functional')
}

// Get the best available backend
const backend = await getAvailableBackend()
// Returns: 'opfs' | 'indexeddb' | 'memory'
```

---

## Performance Considerations

### OPFS vs IndexedDB Performance

| Operation | OPFS | IndexedDB | Notes |
|-----------|------|-----------|-------|
| Write 1MB | ~5ms | ~50ms | 10x slower |
| Read 1MB | ~3ms | ~30ms | 10x slower |
| Write 100MB | ~100ms | ~2000ms | 20x slower |
| Many small files | Fast | Slower | IndexedDB has per-operation overhead |

### Optimization Tips

1. **Batch operations**: Use transactions to batch multiple writes
2. **Lazy loading**: Don't load file content until needed
3. **Stream large files**: Use `getStream()` for large files
4. **Migrate when possible**: Enable migration to switch to OPFS

---

## Browser-Specific Issues

### Android WebView 132 Bug

A regression in Android WebView 132 causes OPFS to fail with:
```
NotAllowedError: It was determined that certain files are unsafe for access...
```

**Solution**: Use IndexedDB adapter with migration enabled. When users update their browser, data will automatically migrate to OPFS.

### Safari iOS Private Browsing

Safari iOS in private mode has very limited storage. Consider showing a warning to users.

### file:// Protocol

OPFS requires a secure context. Opening HTML files directly (`file://`) won't work.

**Solution**: Use a web server (`npm run dev`, `npx serve .`, etc.)

---

## Complete Implementation

For a complete, copy-pasteable implementation, create these files in a `polyfill/` directory:

1. `polyfill/schema.ts` — Database schema types
2. `polyfill/adapter.ts` — IndexedDB adapter factory
3. `polyfill/directory.ts` — Directory implementation
4. `polyfill/file.ts` — File implementation
5. `polyfill/writable.ts` — Writable file stream implementation
6. `polyfill/index.ts` — Barrel exports

### Usage Example

```typescript
// app.ts
import { createFileSystem, isOPFSAvailable } from '@mikesaintsg/filesystem'
import { createIndexedDBAdapter } from './polyfill/index.js'

async function main() {
	// Create file system with automatic fallback
	let fs
	if (await isOPFSAvailable()) {
		fs = await createFileSystem()
	} else {
		fs = await createFileSystem({
			adapter: await createIndexedDBAdapter(),
			enableMigration: true,
		})
	}

	// Use the same API regardless of backend
	const root = await fs.getRoot()
	const file = await root.createFile('hello.txt')
	await file.write('Hello from any storage backend!')
	console.log(await file.getText())
}

main()
```

---

## Testing Strategies

### Testing with Memory Adapter

For unit tests, use a memory-based adapter:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createFileSystem } from '@mikesaintsg/filesystem'
import { createMemoryAdapter } from './polyfill/memory.js'

describe('filesystem with adapter', () => {
	let fs: FileSystemInterface

	beforeEach(async () => {
		fs = await createFileSystem({
			adapter: createMemoryAdapter(),
		})
	})

	it('creates and reads files', async () => {
		const root = await fs.getRoot()
		const file = await root.createFile('test.txt')
		await file.write('Hello!')
		expect(await file.getText()).toBe('Hello!')
	})
})
```

### Testing Migration

```typescript
describe('migration', () => {
	it('migrates from IndexedDB to OPFS', async () => {
		// Create file in IndexedDB
		const adapter = await createIndexedDBAdapter()
		const root = await adapter.getRoot()
		const file = await root.createFile('migrate-me.txt')
		await file.write('Important data')

		// Create file system with migration
		let migrationComplete = false
		const fs = await createFileSystem({
			adapter,
			enableMigration: true,
			onMigrationComplete: () => { migrationComplete = true },
		})

		// Verify migration happened (if OPFS is available)
		if (await isOPFSAvailable()) {
			expect(migrationComplete).toBe(true)
		}
	})
})
```

---

## Summary

The `@mikesaintsg/filesystem` polyfill with `@mikesaintsg/indexeddb` provides:

- **Seamless fallback** when OPFS is unavailable
- **Same API** regardless of storage backend
- **Automatic migration** to OPFS when it becomes available
- **Type-safe** with full TypeScript support
- **Optimized** using `@mikesaintsg/indexeddb` for efficient IndexedDB operations

This ensures your application works everywhere while automatically upgrading to native OPFS performance when possible.

---

**License:** MIT © Mike Garcia
