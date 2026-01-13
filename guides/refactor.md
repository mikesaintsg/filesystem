# Adapter-Based Filesystem Refactoring Guide

> **A comprehensive guide to making `@mikesaintsg/filesystem` adapter-based while keeping the exact same API**

This guide provides a complete implementation plan for refactoring the filesystem library to support pluggable storage adapters. The public API remains **exactly the same** — developers only provide an adapter in the options and everything works seamlessly.

---

## Table of Contents

1. [Overview](#overview)
2. [Design Goals](#design-goals)
3. [Architecture](#architecture)
4. [The Adapter Contract](#the-adapter-contract)
5. [Type Definitions](#type-definitions)
6. [Adapter Implementations](#adapter-implementations)
7. [FileSystem Integration](#filesystem-integration)
8. [Usage Examples](#usage-examples)
9. [Implementation Phases](#implementation-phases)
10. [File Structure](#file-structure)

---

## Overview

### The Problem

The current implementation is tightly coupled to OPFS. When OPFS is unavailable (Android WebView 132 bug, private browsing, etc.), the library fails without a fallback.

### The Solution

Refactor to an **adapter pattern** where:

1. The **entire public API stays exactly the same** (`FileSystemInterface`, `FileInterface`, `DirectoryInterface`, `WritableFileInterface`)
2. All storage operations are delegated to internal adapters
3. Developers only need to provide an adapter in the options
4. All adapters (OPFS, IndexedDB, Memory) support **all the same methods** with **identical parameters and return types**
5. `export()` and `import()` methods are added to the `FileSystemInterface` for migration

### Key Principle

**Zero API changes.** The filesystem API remains identical. Adapters are internal implementation details — developers just pick one via options and everything works.

```typescript
// BEFORE (current implementation) - works exactly the same
const fs = await createFileSystem()

// AFTER (with adapter support) - same API, just provide adapter in options
const fs = await createFileSystem()  // OPFS (default)
const fs = await createFileSystem({ adapter: 'indexeddb' })
const fs = await createFileSystem({ adapter: 'memory' })
```

---

## Design Goals

| Goal | Description |
|------|-------------|
| **Identical API** | Zero changes to `FileInterface`, `DirectoryInterface`, `WritableFileInterface` |
| **Seamless Swap** | Change one option to switch storage backends |
| **Uniform Adapters** | All adapters implement the exact same internal contract |
| **Type Safety** | All adapters take the same parameters and return the same types |
| **Migration Support** | `export()` and `import()` methods on `FileSystemInterface` for data portability |

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                       Public API                            │
│  FileSystemInterface, FileInterface, DirectoryInterface     │
│  WritableFileInterface, SyncAccessHandleInterface           │
│  (UNCHANGED - exact same methods, parameters, return types) │
├─────────────────────────────────────────────────────────────┤
│                 Internal Adapter Layer                      │
│         (Hidden from developers - just an option)           │
├──────────────────┬──────────────────┬───────────────────────┤
│   OPFSAdapter    │  IndexedDBAdapter │   MemoryAdapter      │
│   (default)      │  (fallback)       │   (testing/temp)     │
└──────────────────┴──────────────────┴───────────────────────┘
```

### How It Works

1. Developer calls `createFileSystem(options?)`
2. If `options.adapter` is provided, use that adapter
3. If not, default to OPFS adapter
4. The returned `FileSystemInterface` works **exactly the same** regardless of adapter
5. All `FileInterface`, `DirectoryInterface`, etc. work identically

```typescript
// All of these produce the EXACT SAME API
const fs1 = await createFileSystem()                          // OPFS (default)
const fs2 = await createFileSystem({ adapter: 'indexeddb' })  // IndexedDB
const fs3 = await createFileSystem({ adapter: 'memory' })     // In-memory

// Same operations work on all:
const root = await fs1.getRoot()
const file = await root.createFile('test.txt')
await file.write('Hello, World!')
console.log(await file.getText())  // "Hello, World!"
```


---

## The Adapter Contract

All adapters implement the **exact same internal interface**. They are interchangeable — the public API doesn't know or care which adapter is being used.

### StorageAdapterInterface

Every adapter implements this interface with **identical method signatures**:

```typescript
/**
 * Internal storage adapter interface.
 * All adapters implement this exact contract.
 * All methods take the same parameters and return the same types.
 */
export interface StorageAdapterInterface {
/** Storage backend type identifier */
readonly type: StorageBackend

/**
 * Checks if this adapter is available in the current environment.
 */
isAvailable(): Promise<boolean>

/**
 * Initializes the adapter (called once at startup).
 */
init(): Promise<void>

/**
 * Closes the adapter and releases resources.
 */
close(): void

// ============================================================
// FILE OPERATIONS - Same parameters and return types for ALL adapters
// ============================================================

/**
 * Gets file content as text.
 * @param path - Full path to file
 */
getFileText(path: string): Promise<string>

/**
 * Gets file content as ArrayBuffer.
 * @param path - Full path to file
 */
getFileArrayBuffer(path: string): Promise<ArrayBuffer>

/**
 * Gets file content as Blob.
 * @param path - Full path to file
 */
getFileBlob(path: string): Promise<Blob>

/**
 * Gets file metadata.
 * @param path - Full path to file
 */
getFileMetadata(path: string): Promise<FileMetadata>

/**
 * Writes data to a file.
 * @param path - Full path to file
 * @param data - Data to write
 * @param options - Write options
 */
writeFile(path: string, data: WriteData, options?: WriteOptions): Promise<void>

/**
 * Appends data to a file.
 * @param path - Full path to file
 * @param data - Data to append
 */
appendFile(path: string, data: WriteData): Promise<void>

/**
 * Truncates a file to specified size.
 * @param path - Full path to file
 * @param size - New size in bytes
 */
truncateFile(path: string, size: number): Promise<void>

/**
 * Checks if a file exists.
 * @param path - Full path to file
 */
hasFile(path: string): Promise<boolean>

/**
 * Removes a file.
 * @param path - Full path to file
 */
removeFile(path: string): Promise<void>

// ============================================================
// DIRECTORY OPERATIONS - Same parameters and return types for ALL adapters
// ============================================================

/**
 * Creates a directory.
 * @param path - Full path to directory
 */
createDirectory(path: string): Promise<void>

/**
 * Checks if a directory exists.
 * @param path - Full path to directory
 */
hasDirectory(path: string): Promise<boolean>

/**
 * Removes a directory.
 * @param path - Full path to directory
 * @param options - Removal options
 */
removeDirectory(path: string, options?: RemoveDirectoryOptions): Promise<void>

/**
 * Lists entries in a directory.
 * @param path - Full path to directory
 */
listEntries(path: string): Promise<readonly DirectoryEntry[]>

// ============================================================
// QUOTA & MIGRATION - Same parameters and return types for ALL adapters
// ============================================================

/**
 * Gets storage quota information.
 */
getQuota(): Promise<StorageQuota>

/**
 * Exports all filesystem data.
 * @param options - Export options
 */
exportData(options?: ExportOptions): Promise<ExportedFileSystem>

/**
 * Imports filesystem data.
 * @param data - Exported filesystem data
 * @param options - Import options
 */
importData(data: ExportedFileSystem, options?: ImportOptions): Promise<void>
}
```

### Uniform Contract

The key insight is that **every adapter method has identical signatures**:

| Method | Parameters | Return Type |
|--------|------------|-------------|
| `getFileText` | `(path: string)` | `Promise<string>` |
| `getFileArrayBuffer` | `(path: string)` | `Promise<ArrayBuffer>` |
| `writeFile` | `(path: string, data: WriteData, options?: WriteOptions)` | `Promise<void>` |
| `createDirectory` | `(path: string)` | `Promise<void>` |
| `listEntries` | `(path: string)` | `Promise<readonly DirectoryEntry[]>` |
| `exportData` | `(options?: ExportOptions)` | `Promise<ExportedFileSystem>` |
| `importData` | `(data: ExportedFileSystem, options?: ImportOptions)` | `Promise<void>` |

This means:
- ✅ Swap adapters without changing any code
- ✅ All adapters work identically
- ✅ Type safety guaranteed
- ✅ No adapter-specific classes or methods exposed


---

## Type Definitions

All types go in `src/types.ts` following the types-first development flow.

### Storage Backend Type

```typescript
/** Storage backend type identifier */
export type StorageBackend = 'opfs' | 'indexeddb' | 'memory'
```

### FileSystem Options (Updated)

```typescript
/** Options for creating a file system instance */
export interface FileSystemOptions {
/**
 * Storage adapter to use.
 * @default 'opfs'
 */
readonly adapter?: StorageBackend | StorageAdapterInterface
}
```

### Export/Import Types

```typescript
/** Exported file data for migration */
export interface ExportedFile {
readonly path: string
readonly name: string
readonly type: string
readonly lastModified: number
readonly content: string  // base64-encoded
}

/** Exported directory data for migration */
export interface ExportedDirectory {
readonly path: string
readonly name: string
}

/** Complete filesystem export for migration */
export interface ExportedFileSystem {
readonly version: 1
readonly exportedAt: string
readonly source: StorageBackend
readonly directories: readonly ExportedDirectory[]
readonly files: readonly ExportedFile[]
}

/** Import mode for handling existing entries */
export type ImportMode = 'merge' | 'replace'

/** Options for exporting filesystem data */
export interface ExportOptions {
readonly onProgress?: (progress: ExportProgress) => void
readonly filter?: (path: string, kind: EntryKind) => boolean
}

/** Options for importing filesystem data */
export interface ImportOptions {
readonly mode?: ImportMode
readonly onProgress?: (progress: ImportProgress) => void
}

/** Export progress information */
export interface ExportProgress {
readonly phase: 'scanning' | 'exporting'
readonly current: number
readonly total: number
readonly currentPath?: string
}

/** Import progress information */
export interface ImportProgress {
readonly phase: 'directories' | 'files'
readonly current: number
readonly total: number
readonly currentPath?: string
}
```

### Updated FileSystemInterface

Add export/import methods to the existing interface (only additions, no changes):

```typescript
export interface FileSystemInterface {
// ============ EXISTING METHODS (UNCHANGED) ============

getRoot(): Promise<DirectoryInterface>
getQuota(): Promise<StorageQuota>
isUserAccessSupported(): boolean
showOpenFilePicker(options?: OpenFilePickerOptions): Promise<readonly FileInterface[]>
showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileInterface>
showDirectoryPicker(options?: DirectoryPickerOptions): Promise<DirectoryInterface>
fromDataTransferItem(item: DataTransferItem): Promise<FileInterface | DirectoryInterface | null>
fromDataTransferItems(items: DataTransferItemList): Promise<readonly (FileInterface | DirectoryInterface)[]>
fromFile(file: File): Promise<FileInterface>
fromFiles(files: FileList): Promise<readonly FileInterface[]>

// ============ NEW METHODS (ADDITIONS ONLY) ============

/** Gets the active storage backend type */
getBackendType(): StorageBackend

/**
 * Exports all filesystem data for migration.
 * @param options - Export options
 * @returns Complete filesystem snapshot
 */
export(options?: ExportOptions): Promise<ExportedFileSystem>

/**
 * Imports filesystem data from an export.
 * @param data - Exported filesystem data
 * @param options - Import options
 */
import(data: ExportedFileSystem, options?: ImportOptions): Promise<void>

/**
 * Closes the filesystem and releases resources.
 */
close(): void
}
```

**Note:** `FileInterface`, `DirectoryInterface`, and `WritableFileInterface` remain **completely unchanged**.


---

## Adapter Implementations

All three adapters implement the **exact same `StorageAdapterInterface`** with identical method signatures.

### OPFS Adapter (Default)

```typescript
// src/adapters/OPFSAdapter.ts

export class OPFSAdapter implements StorageAdapterInterface {
readonly type: StorageBackend = 'opfs'
#root: FileSystemDirectoryHandle | null = null

async isAvailable(): Promise<boolean> {
if (typeof navigator?.storage?.getDirectory !== 'function') return false
try {
await navigator.storage.getDirectory()
return true
} catch {
return false
}
}

async init(): Promise<void> {
this.#root = await navigator.storage.getDirectory()
}

close(): void {
this.#root = null
}

// All file operations use native OPFS APIs
async getFileText(path: string): Promise<string> {
const handle = await this.#resolveFileHandle(path)
const file = await handle.getFile()
return file.text()
}

async getFileArrayBuffer(path: string): Promise<ArrayBuffer> {
const handle = await this.#resolveFileHandle(path)
const file = await handle.getFile()
return file.arrayBuffer()
}

async writeFile(path: string, data: WriteData, options?: WriteOptions): Promise<void> {
const handle = await this.#resolveFileHandle(path, { create: true })
const writable = await handle.createWritable({ keepExistingData: options?.keepExistingData })
if (options?.position !== undefined) {
await writable.seek(options.position)
}
await writable.write(data)
await writable.close()
}

async createDirectory(path: string): Promise<void> {
await this.#resolveDirectoryHandle(path, { create: true })
}

async listEntries(path: string): Promise<readonly DirectoryEntry[]> {
const handle = await this.#resolveDirectoryHandle(path)
const entries: DirectoryEntry[] = []
for await (const [name, entryHandle] of handle.entries()) {
entries.push({ name, kind: entryHandle.kind, handle: entryHandle })
}
return entries
}

async getQuota(): Promise<StorageQuota> {
const estimate = await navigator.storage.estimate()
return {
usage: estimate.usage ?? 0,
quota: estimate.quota ?? 0,
available: (estimate.quota ?? 0) - (estimate.usage ?? 0),
percentUsed: estimate.quota ? ((estimate.usage ?? 0) / estimate.quota) * 100 : 0,
}
}

async exportData(options?: ExportOptions): Promise<ExportedFileSystem> {
// Walk all files/directories and serialize
// ... implementation
}

async importData(data: ExportedFileSystem, options?: ImportOptions): Promise<void> {
// Recreate directory structure and files
// ... implementation
}

// Private helper methods
#resolveFileHandle(path: string, options?: { create?: boolean }): Promise<FileSystemFileHandle> { /* ... */ }
#resolveDirectoryHandle(path: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle> { /* ... */ }
}
```

### IndexedDB Adapter

```typescript
// src/adapters/IndexedDBAdapter.ts

import { createDatabase } from '@mikesaintsg/indexeddb'

export class IndexedDBAdapter implements StorageAdapterInterface {
readonly type: StorageBackend = 'indexeddb'
#db: DatabaseInterface | null = null

async isAvailable(): Promise<boolean> {
return typeof indexedDB !== 'undefined'
}

async init(): Promise<void> {
this.#db = await createDatabase({
name: '@mikesaintsg/filesystem',
version: 1,
stores: {
entries: { keyPath: 'path', indexes: [{ name: 'parent', keyPath: 'parent' }] }
}
})
}

close(): void {
this.#db?.close()
this.#db = null
}

// SAME METHOD SIGNATURES as OPFSAdapter
async getFileText(path: string): Promise<string> {
const entry = await this.#db.store('entries').get(path)
if (!entry || entry.kind !== 'file') throw new NotFoundError(path)
return new TextDecoder().decode(entry.content)
}

async getFileArrayBuffer(path: string): Promise<ArrayBuffer> {
const entry = await this.#db.store('entries').get(path)
if (!entry || entry.kind !== 'file') throw new NotFoundError(path)
return entry.content
}

async writeFile(path: string, data: WriteData, options?: WriteOptions): Promise<void> {
const content = await this.#toArrayBuffer(data)
await this.#db.store('entries').set({
path,
name: path.split('/').pop(),
parent: path.substring(0, path.lastIndexOf('/')) || '/',
kind: 'file',
content,
mimeType: 'application/octet-stream',
lastModified: Date.now(),
})
}

async createDirectory(path: string): Promise<void> {
await this.#db.store('entries').set({
path,
name: path.split('/').pop(),
parent: path.substring(0, path.lastIndexOf('/')) || '/',
kind: 'directory',
})
}

async listEntries(path: string): Promise<readonly DirectoryEntry[]> {
const entries = await this.#db.store('entries').query()
.where('parent').equals(path)
.toArray()
return entries.map(e => ({ name: e.name, kind: e.kind, handle: null }))
}

async getQuota(): Promise<StorageQuota> {
// IndexedDB quota estimation
if (navigator.storage?.estimate) {
const estimate = await navigator.storage.estimate()
return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, available: (estimate.quota ?? 0) - (estimate.usage ?? 0), percentUsed: 0 }
}
return { usage: 0, quota: 0, available: 0, percentUsed: 0 }
}

async exportData(options?: ExportOptions): Promise<ExportedFileSystem> {
// Read all entries and serialize
// ... implementation
}

async importData(data: ExportedFileSystem, options?: ImportOptions): Promise<void> {
// Write entries to IndexedDB
// ... implementation
}
}
```

### Memory Adapter

```typescript
// src/adapters/MemoryAdapter.ts

export class MemoryAdapter implements StorageAdapterInterface {
readonly type: StorageBackend = 'memory'
#entries = new Map<string, MemoryEntry>()

async isAvailable(): Promise<boolean> {
return true  // Always available
}

async init(): Promise<void> {
this.#entries.clear()
this.#entries.set('/', { path: '/', name: '', parent: '', kind: 'directory' })
}

close(): void {
this.#entries.clear()
}

// SAME METHOD SIGNATURES as OPFSAdapter and IndexedDBAdapter
async getFileText(path: string): Promise<string> {
const entry = this.#entries.get(path)
if (!entry || entry.kind !== 'file') throw new NotFoundError(path)
return new TextDecoder().decode(entry.content)
}

async getFileArrayBuffer(path: string): Promise<ArrayBuffer> {
const entry = this.#entries.get(path)
if (!entry || entry.kind !== 'file') throw new NotFoundError(path)
return entry.content
}

async writeFile(path: string, data: WriteData, options?: WriteOptions): Promise<void> {
const content = await this.#toArrayBuffer(data)
this.#entries.set(path, {
path,
name: path.split('/').pop() ?? '',
parent: path.substring(0, path.lastIndexOf('/')) || '/',
kind: 'file',
content,
mimeType: 'application/octet-stream',
lastModified: Date.now(),
})
}

async createDirectory(path: string): Promise<void> {
this.#entries.set(path, {
path,
name: path.split('/').pop() ?? '',
parent: path.substring(0, path.lastIndexOf('/')) || '/',
kind: 'directory',
})
}

async listEntries(path: string): Promise<readonly DirectoryEntry[]> {
const entries: DirectoryEntry[] = []
for (const entry of this.#entries.values()) {
if (entry.parent === path && entry.path !== '/') {
entries.push({ name: entry.name, kind: entry.kind, handle: null })
}
}
return entries
}

async getQuota(): Promise<StorageQuota> {
// Estimate memory usage
let size = 0
for (const entry of this.#entries.values()) {
if (entry.kind === 'file') size += entry.content.byteLength
}
return { usage: size, quota: Infinity, available: Infinity, percentUsed: 0 }
}

async exportData(options?: ExportOptions): Promise<ExportedFileSystem> {
// Serialize Map entries
// ... implementation
}

async importData(data: ExportedFileSystem, options?: ImportOptions): Promise<void> {
// Populate Map from export
// ... implementation
}
}
```

### Adapter Uniformity Summary

All three adapters:
- ✅ Implement **identical** `StorageAdapterInterface`
- ✅ Have **same method names**
- ✅ Take **same parameters**
- ✅ Return **same types**
- ✅ Can be swapped without any code changes


---

## FileSystem Integration

The `FileSystem` class uses the adapter internally. The public API stays **exactly the same**.

### Updated FileSystem Class

```typescript
// src/core/filesystem/FileSystem.ts

export class FileSystem implements FileSystemInterface {
#adapter: StorageAdapterInterface

constructor(adapter: StorageAdapterInterface) {
this.#adapter = adapter
}

// ============ NEW METHODS ============

getBackendType(): StorageBackend {
return this.#adapter.type
}

async export(options?: ExportOptions): Promise<ExportedFileSystem> {
return this.#adapter.exportData(options)
}

async import(data: ExportedFileSystem, options?: ImportOptions): Promise<void> {
return this.#adapter.importData(data, options)
}

close(): void {
this.#adapter.close()
}

// ============ EXISTING METHODS (delegate to adapter) ============

async getRoot(): Promise<DirectoryInterface> {
// Return a Directory that uses the adapter
return new Directory(this.#adapter, '/')
}

async getQuota(): Promise<StorageQuota> {
return this.#adapter.getQuota()
}

// ... other existing methods unchanged
}
```

### Updated Directory Class

The `Directory` class now delegates to the adapter:

```typescript
// src/core/directory/Directory.ts

export class Directory implements DirectoryInterface {
#adapter: StorageAdapterInterface
#path: string

constructor(adapter: StorageAdapterInterface, path: string) {
this.#adapter = adapter
this.#path = path
}

getName(): string {
return this.#path.split('/').pop() ?? ''
}

async createFile(name: string): Promise<FileInterface> {
const filePath = this.#joinPath(name)
await this.#adapter.writeFile(filePath, '')  // Create empty file
return new File(this.#adapter, filePath)
}

async getFile(name: string): Promise<FileInterface | undefined> {
const filePath = this.#joinPath(name)
if (await this.#adapter.hasFile(filePath)) {
return new File(this.#adapter, filePath)
}
return undefined
}

async createDirectory(name: string): Promise<DirectoryInterface> {
const dirPath = this.#joinPath(name)
await this.#adapter.createDirectory(dirPath)
return new Directory(this.#adapter, dirPath)
}

async *entries(): AsyncIterable<DirectoryEntry> {
const entries = await this.#adapter.listEntries(this.#path)
for (const entry of entries) {
yield entry
}
}

// ... all other methods delegate to this.#adapter
}
```

### Updated File Class

The `File` class now delegates to the adapter:

```typescript
// src/core/file/File.ts

export class File implements FileInterface {
#adapter: StorageAdapterInterface
#path: string

constructor(adapter: StorageAdapterInterface, path: string) {
this.#adapter = adapter
this.#path = path
}

getName(): string {
return this.#path.split('/').pop() ?? ''
}

async getText(): Promise<string> {
return this.#adapter.getFileText(this.#path)
}

async getArrayBuffer(): Promise<ArrayBuffer> {
return this.#adapter.getFileArrayBuffer(this.#path)
}

async getBlob(): Promise<Blob> {
return this.#adapter.getFileBlob(this.#path)
}

async write(data: WriteData, options?: WriteOptions): Promise<void> {
return this.#adapter.writeFile(this.#path, data, options)
}

async append(data: WriteData): Promise<void> {
return this.#adapter.appendFile(this.#path, data)
}

async truncate(size: number): Promise<void> {
return this.#adapter.truncateFile(this.#path, size)
}

// ... all other methods delegate to this.#adapter
}
```

### Updated Factory Function

```typescript
// src/factories.ts

import { OPFSAdapter } from './adapters/OPFSAdapter.js'
import { IndexedDBAdapter } from './adapters/IndexedDBAdapter.js'
import { MemoryAdapter } from './adapters/MemoryAdapter.js'

/**
 * Creates a file system interface.
 * 
 * @param options - Options including adapter selection
 * @returns Promise resolving to FileSystemInterface
 *
 * @example
 * ```ts
 * // Default (OPFS)
 * const fs = await createFileSystem()
 *
 * // IndexedDB fallback
 * const fs = await createFileSystem({ adapter: 'indexeddb' })
 *
 * // In-memory (testing)
 * const fs = await createFileSystem({ adapter: 'memory' })
 * ```
 */
export async function createFileSystem(options?: FileSystemOptions): Promise<FileSystemInterface> {
// Resolve adapter
let adapter: StorageAdapterInterface

if (!options?.adapter || options.adapter === 'opfs') {
adapter = new OPFSAdapter()
} else if (options.adapter === 'indexeddb') {
adapter = new IndexedDBAdapter()
} else if (options.adapter === 'memory') {
adapter = new MemoryAdapter()
} else {
// Custom adapter instance provided
adapter = options.adapter
}

// Verify availability
const available = await adapter.isAvailable()
if (!available) {
throw new NotSupportedError(`Storage adapter '${adapter.type}' is not available`)
}

// Initialize adapter
await adapter.init()

return new FileSystem(adapter)
}
```


---

## Usage Examples

### Basic Usage (Unchanged)

```typescript
// Default OPFS - works exactly like before
const fs = await createFileSystem()
const root = await fs.getRoot()
const file = await root.createFile('hello.txt')
await file.write('Hello, World!')
console.log(await file.getText())  // "Hello, World!"
```

### Switching Adapters

```typescript
// IndexedDB fallback
const fs = await createFileSystem({ adapter: 'indexeddb' })

// In-memory (useful for testing)
const fs = await createFileSystem({ adapter: 'memory' })

// All operations work EXACTLY the same:
const root = await fs.getRoot()
const dir = await root.createDirectory('documents')
const file = await dir.createFile('notes.md')
await file.write('# My Notes')
```

### Migration Between Adapters

```typescript
// Export from one adapter
const oldFS = await createFileSystem({ adapter: 'indexeddb' })
const exported = await oldFS.export()
oldFS.close()

// Import to another adapter
const newFS = await createFileSystem({ adapter: 'opfs' })
await newFS.import(exported, { mode: 'replace' })

// All data is now in OPFS!
```

### Automatic Fallback Pattern

```typescript
async function initFileSystem(): Promise<FileSystemInterface> {
// Try OPFS first
try {
const fs = await createFileSystem({ adapter: 'opfs' })
console.log('Using OPFS')
return fs
} catch {
// Fall back to IndexedDB
console.log('OPFS unavailable, using IndexedDB')
return createFileSystem({ adapter: 'indexeddb' })
}
}

// Usage - same API regardless of backend!
const fs = await initFileSystem()
const root = await fs.getRoot()
```

### Migration on Startup

```typescript
async function initWithMigration(): Promise<FileSystemInterface> {
const opfsAvailable = await new OPFSAdapter().isAvailable()

if (opfsAvailable) {
// Check if we have old IndexedDB data
const idbFS = await createFileSystem({ adapter: 'indexeddb' })
const idbRoot = await idbFS.getRoot()
const entries = await idbRoot.list()

if (entries.length > 0) {
// Migrate to OPFS
console.log('Migrating data to OPFS...')
const exported = await idbFS.export({
onProgress: (p) => console.log(`Exporting: ${p.current}/${p.total}`)
})
idbFS.close()

const opfsFS = await createFileSystem({ adapter: 'opfs' })
await opfsFS.import(exported, {
mode: 'replace',
onProgress: (p) => console.log(`Importing: ${p.phase} ${p.current}/${p.total}`)
})

// Clean up old data
indexedDB.deleteDatabase('@mikesaintsg/filesystem')
return opfsFS
}

idbFS.close()
return createFileSystem({ adapter: 'opfs' })
}

return createFileSystem({ adapter: 'indexeddb' })
}
```

### Check Backend Type

```typescript
const fs = await createFileSystem({ adapter: 'indexeddb' })
console.log(fs.getBackendType())  // 'indexeddb'
```


---

## Implementation Phases

### Phase 1: Type Definitions

**Deliverables:**
- [ ] Add `StorageBackend` type
- [ ] Add `StorageAdapterInterface` with all methods
- [ ] Add export/import types
- [ ] Update `FileSystemOptions` to accept adapter
- [ ] Add new methods to `FileSystemInterface` (`export`, `import`, `getBackendType`, `close`)

**Files:**
- `src/types.ts`

### Phase 2: OPFS Adapter

**Deliverables:**
- [ ] Create `OPFSAdapter` implementing `StorageAdapterInterface`
- [ ] Implement all file operations
- [ ] Implement all directory operations
- [ ] Implement `exportData()` and `importData()`

**Files:**
- `src/adapters/OPFSAdapter.ts`

### Phase 3: IndexedDB Adapter

**Deliverables:**
- [ ] Create `IndexedDBAdapter` implementing `StorageAdapterInterface`
- [ ] Implement all file operations (same signatures as OPFS)
- [ ] Implement all directory operations (same signatures as OPFS)
- [ ] Implement `exportData()` and `importData()`

**Files:**
- `src/adapters/IndexedDBAdapter.ts`

### Phase 4: Memory Adapter

**Deliverables:**
- [ ] Create `MemoryAdapter` implementing `StorageAdapterInterface`
- [ ] Implement all file operations (same signatures as OPFS)
- [ ] Implement all directory operations (same signatures as OPFS)
- [ ] Implement `exportData()` and `importData()`

**Files:**
- `src/adapters/MemoryAdapter.ts`

### Phase 5: Core Class Refactoring

**Deliverables:**
- [ ] Update `FileSystem` to accept and use adapter
- [ ] Update `Directory` to delegate to adapter
- [ ] Update `File` to delegate to adapter
- [ ] Update `WritableFile` to delegate to adapter
- [ ] Update `createFileSystem()` factory function

**Files:**
- `src/core/filesystem/FileSystem.ts`
- `src/core/directory/Directory.ts`
- `src/core/file/File.ts`
- `src/core/file/WritableFile.ts`
- `src/factories.ts`

### Phase 6: Testing

**Deliverables:**
- [ ] Unit tests for each adapter
- [ ] Integration tests for adapter switching
- [ ] Migration tests (export/import between adapters)
- [ ] Ensure all existing tests pass with all adapters

**Files:**
- `tests/adapters/OPFSAdapter.test.ts`
- `tests/adapters/IndexedDBAdapter.test.ts`
- `tests/adapters/MemoryAdapter.test.ts`
- `tests/integration/migration.test.ts`

### Phase 7: Documentation

**Deliverables:**
- [ ] Update README with adapter usage
- [ ] Update guides/filesystem.md with adapter documentation
- [ ] Add migration examples

**Files:**
- `README.md`
- `guides/filesystem.md`

---

## File Structure

After refactoring:

```
src/
├── adapters/
│   ├── OPFSAdapter.ts        # OPFS implementation
│   ├── IndexedDBAdapter.ts   # IndexedDB implementation
│   ├── MemoryAdapter.ts      # In-memory implementation
│   └── index.ts              # Barrel exports
├── core/
│   ├── directory/
│   │   └── Directory.ts      # Uses adapter internally
│   ├── file/
│   │   ├── File.ts           # Uses adapter internally
│   │   ├── WritableFile.ts   # Uses adapter internally
│   │   └── SyncAccessHandle.ts
│   └── filesystem/
│       └── FileSystem.ts     # Uses adapter internally
├── constants.ts
├── errors.ts
├── factories.ts              # createFileSystem() with adapter option
├── globals.d.ts
├── helpers.ts
├── index.ts
└── types.ts                  # StorageAdapterInterface, new types
```

---

## Summary

This refactoring keeps the **exact same public API** while adding pluggable storage adapters:

| Aspect | Before | After |
|--------|--------|-------|
| API | `FileSystemInterface`, `FileInterface`, etc. | **Unchanged** |
| Factory | `createFileSystem()` | `createFileSystem(options?)` with optional `adapter` |
| Backends | OPFS only | OPFS (default), IndexedDB, Memory |
| Migration | N/A | `export()` and `import()` methods |

### Key Points

1. **Identical API** — All existing code works unchanged
2. **Simple Option** — Just provide `{ adapter: 'indexeddb' }` to switch backends
3. **Uniform Adapters** — All adapters have identical method signatures
4. **Type Safe** — Same parameters, same return types across all adapters
5. **Migration Built-in** — `export()` and `import()` for data portability

---

**License:** MIT © Mike Garcia
