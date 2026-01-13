# Adapter-Based Filesystem Refactoring Guide

> **Refactoring the filesystem library to support pluggable storage adapters while keeping the exact same public API**

---

## Table of Contents

1. [Overview](#overview)
2. [StorageAdapterInterface](#storageadapterinterface)
3. [Built-in Adapters](#built-in-adapters)
4. [Core Class Refactoring](#core-class-refactoring)
5. [Usage](#usage)
6. [Implementation Phases](#implementation-phases)

---

## Overview

### The Problem

The current implementation is hardcoded to OPFS. When OPFS is unavailable, the library fails.

### The Solution

Replace the hardcoded OPFS implementation with a pluggable adapter system:

1. **Public API stays exactly the same** — `FileSystemInterface`, `FileInterface`, `DirectoryInterface`, `WritableFileInterface` unchanged
2. **One new option** — `{ adapter: new IndexedDBAdapter() }`
3. **OPFSAdapter is the default** — When no adapter is provided, uses OPFS
4. **Three built-in adapters** — OPFSAdapter, IndexedDBAdapter, InMemoryAdapter
5. **Custom adapters** — Developers can implement `StorageAdapterInterface`

```typescript
// Current usage - unchanged
const fs = await createFileSystem()

// With adapter support
const fs = await createFileSystem()                                     // OPFS (default)
const fs = await createFileSystem({ adapter: new IndexedDBAdapter() })  // IndexedDB
const fs = await createFileSystem({ adapter: new InMemoryAdapter() })   // In-memory
```

---

## StorageAdapterInterface

The single interface that all adapters must implement. This is the contract that enables pluggable storage backends.

```typescript
// src/types.ts

/**
 * Storage adapter interface for pluggable backends.
 * All adapters implement this exact contract with identical method signatures.
 */
export interface StorageAdapterInterface {
/**
 * Checks if this adapter is available in the current environment.
 */
isAvailable(): Promise<boolean>

/**
 * Initializes the adapter.
 */
init(): Promise<void>

/**
 * Closes the adapter and releases resources.
 */
close(): void

// ─────────────────────────────────────────────────────────────
// FILE OPERATIONS
// ─────────────────────────────────────────────────────────────

getFileText(path: string): Promise<string>
getFileArrayBuffer(path: string): Promise<ArrayBuffer>
getFileBlob(path: string): Promise<Blob>
getFileMetadata(path: string): Promise<FileMetadata>
writeFile(path: string, data: WriteData, options?: WriteOptions): Promise<void>
appendFile(path: string, data: WriteData): Promise<void>
truncateFile(path: string, size: number): Promise<void>
hasFile(path: string): Promise<boolean>
removeFile(path: string): Promise<void>

// ─────────────────────────────────────────────────────────────
// DIRECTORY OPERATIONS
// ─────────────────────────────────────────────────────────────

createDirectory(path: string): Promise<void>
hasDirectory(path: string): Promise<boolean>
removeDirectory(path: string, options?: RemoveDirectoryOptions): Promise<void>
listEntries(path: string): Promise<readonly DirectoryEntry[]>

// ─────────────────────────────────────────────────────────────
// QUOTA & MIGRATION
// ─────────────────────────────────────────────────────────────

getQuota(): Promise<StorageQuota>
export(options?: ExportOptions): Promise<ExportedFileSystem>
import(data: ExportedFileSystem, options?: ImportOptions): Promise<void>
}
```

All adapters implement this interface with **identical method signatures** — same parameters, same return types. This means any adapter can be swapped for another without changing any code.

---

## Built-in Adapters

Three adapters are provided out of the box.

### OPFSAdapter (Default)

Uses the Origin Private File System. This is the default when no adapter is provided.

```typescript
// src/adapters/OPFSAdapter.ts

export class OPFSAdapter implements StorageAdapterInterface {
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

async getFileBlob(path: string): Promise<Blob> {
const handle = await this.#resolveFileHandle(path)
return handle.getFile()
}

async writeFile(path: string, data: WriteData, options?: WriteOptions): Promise<void> {
const handle = await this.#resolveFileHandle(path, { create: true })
const writable = await handle.createWritable({ keepExistingData: options?.keepExistingData })
if (options?.position !== undefined) await writable.seek(options.position)
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
entries.push({ name, kind: entryHandle.kind })
}
return entries
}

async getQuota(): Promise<StorageQuota> {
const estimate = await navigator.storage.estimate()
return {
usage: estimate.usage ?? 0,
quota: estimate.quota ?? 0,
}
}

async exportData(options?: ExportOptions): Promise<ExportedFileSystem> {
// Walk filesystem and serialize all entries
}

async importData(data: ExportedFileSystem, options?: ImportOptions): Promise<void> {
// Recreate directory structure and files
}

// Private helpers
#resolveFileHandle(path: string, options?: { create?: boolean }): Promise<FileSystemFileHandle> { /* ... */ }
#resolveDirectoryHandle(path: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle> { /* ... */ }
}
```

### IndexedDBAdapter

Uses IndexedDB via `@mikesaintsg/indexeddb`. Useful as a fallback when OPFS is unavailable.

```typescript
// src/adapters/IndexedDBAdapter.ts

import { createDatabase } from '@mikesaintsg/indexeddb'

export class IndexedDBAdapter implements StorageAdapterInterface {
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
name: this.#getName(path),
parent: this.#getParent(path),
kind: 'file',
content,
lastModified: Date.now(),
})
}

async createDirectory(path: string): Promise<void> {
await this.#db.store('entries').set({
path,
name: this.#getName(path),
parent: this.#getParent(path),
kind: 'directory',
})
}

async listEntries(path: string): Promise<readonly DirectoryEntry[]> {
const entries = await this.#db.store('entries').query()
.where('parent').equals(path)
.toArray()
return entries.map(e => ({ name: e.name, kind: e.kind }))
}

async exportData(options?: ExportOptions): Promise<ExportedFileSystem> {
// Read all entries and serialize
}

async importData(data: ExportedFileSystem, options?: ImportOptions): Promise<void> {
// Write entries to IndexedDB
}

// Private helpers
#getName(path: string): string { return path.split('/').pop() ?? '' }
#getParent(path: string): string { return path.substring(0, path.lastIndexOf('/')) || '/' }
#toArrayBuffer(data: WriteData): Promise<ArrayBuffer> { /* ... */ }
}
```

### InMemoryAdapter

Stores everything in memory. Useful for testing and temporary storage.

```typescript
// src/adapters/InMemoryAdapter.ts

interface MemoryEntry {
path: string
name: string
parent: string
kind: 'file' | 'directory'
content?: ArrayBuffer
lastModified?: number
}

export class InMemoryAdapter implements StorageAdapterInterface {
#entries = new Map<string, MemoryEntry>()

async isAvailable(): Promise<boolean> {
return true
}

async init(): Promise<void> {
this.#entries.clear()
this.#entries.set('/', { path: '/', name: '', parent: '', kind: 'directory' })
}

close(): void {
this.#entries.clear()
}

async getFileText(path: string): Promise<string> {
const entry = this.#entries.get(path)
if (!entry || entry.kind !== 'file') throw new NotFoundError(path)
return new TextDecoder().decode(entry.content)
}

async getFileArrayBuffer(path: string): Promise<ArrayBuffer> {
const entry = this.#entries.get(path)
if (!entry || entry.kind !== 'file') throw new NotFoundError(path)
return entry.content!
}

async writeFile(path: string, data: WriteData, options?: WriteOptions): Promise<void> {
const content = await this.#toArrayBuffer(data)
this.#entries.set(path, {
path,
name: this.#getName(path),
parent: this.#getParent(path),
kind: 'file',
content,
lastModified: Date.now(),
})
}

async createDirectory(path: string): Promise<void> {
this.#entries.set(path, {
path,
name: this.#getName(path),
parent: this.#getParent(path),
kind: 'directory',
})
}

async listEntries(path: string): Promise<readonly DirectoryEntry[]> {
const entries: DirectoryEntry[] = []
for (const entry of this.#entries.values()) {
if (entry.parent === path && entry.path !== '/') {
entries.push({ name: entry.name, kind: entry.kind })
}
}
return entries
}

async exportData(options?: ExportOptions): Promise<ExportedFileSystem> {
// Serialize Map entries
}

async importData(data: ExportedFileSystem, options?: ImportOptions): Promise<void> {
// Populate Map from export
}

// Private helpers
#getName(path: string): string { return path.split('/').pop() ?? '' }
#getParent(path: string): string { return path.substring(0, path.lastIndexOf('/')) || '/' }
#toArrayBuffer(data: WriteData): Promise<ArrayBuffer> { /* ... */ }
}
```

---

## Core Class Refactoring

Replace the hardcoded OPFS implementation with adapter delegation. The public API remains unchanged.

### FileSystem Class

```typescript
// src/core/filesystem/FileSystem.ts

export class FileSystem implements FileSystemInterface {
#adapter: StorageAdapterInterface

constructor(adapter: StorageAdapterInterface) {
this.#adapter = adapter
}

async getRoot(): Promise<DirectoryInterface> {
return new Directory(this.#adapter, '/')
}

async getQuota(): Promise<StorageQuota> {
return this.#adapter.getQuota()
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

// Other existing methods unchanged...
}
```

### Directory Class

```typescript
// src/core/directory/Directory.ts

export class Directory implements DirectoryInterface {
#adapter: StorageAdapterInterface
#path: string

constructor(adapter: StorageAdapterInterface, path: string) {
this.#adapter = adapter
this.#path = path
}

async createFile(name: string): Promise<FileInterface> {
const filePath = this.#joinPath(name)
await this.#adapter.writeFile(filePath, '')
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

// Other methods delegate to this.#adapter...
}
```

### File Class

```typescript
// src/core/file/File.ts

export class File implements FileInterface {
#adapter: StorageAdapterInterface
#path: string

constructor(adapter: StorageAdapterInterface, path: string) {
this.#adapter = adapter
this.#path = path
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

// Other methods delegate to this.#adapter...
}
```

### Factory Function

```typescript
// src/factories.ts

import { OPFSAdapter } from './adapters/OPFSAdapter.js'

export async function createFileSystem(options?: FileSystemOptions): Promise<FileSystemInterface> {
// Use provided adapter or default to OPFS
const adapter = options?.adapter ?? new OPFSAdapter()

// Verify availability
if (!await adapter.isAvailable()) {
throw new NotSupportedError('Storage adapter is not available')
}

// Initialize
await adapter.init()

return new FileSystem(adapter)
}
```

### FileSystemOptions

```typescript
// src/types.ts

export interface FileSystemOptions {
readonly adapter?: StorageAdapterInterface
}
```

---

## Usage

### Default (OPFS)

```typescript
const fs = await createFileSystem()
const root = await fs.getRoot()
const file = await root.createFile('hello.txt')
await file.write('Hello!')
```

### IndexedDB Fallback

```typescript
import { createFileSystem, IndexedDBAdapter } from '@mikesaintsg/filesystem'

const fs = await createFileSystem({ adapter: new IndexedDBAdapter() })
```

### In-Memory (Testing)

```typescript
import { createFileSystem, InMemoryAdapter } from '@mikesaintsg/filesystem'

const fs = await createFileSystem({ adapter: new InMemoryAdapter() })
```

### Automatic Fallback

```typescript
import { createFileSystem, OPFSAdapter, IndexedDBAdapter } from '@mikesaintsg/filesystem'

async function initFileSystem() {
const opfs = new OPFSAdapter()
if (await opfs.isAvailable()) {
return createFileSystem({ adapter: opfs })
}
return createFileSystem({ adapter: new IndexedDBAdapter() })
}
```

### Migration

```typescript
// Export from old adapter
const oldFS = await createFileSystem({ adapter: new IndexedDBAdapter() })
const exported = await oldFS.export()
oldFS.close()

// Import to new adapter
const newFS = await createFileSystem({ adapter: new OPFSAdapter() })
await newFS.import(exported)
```

### Custom Adapter

```typescript
import type { StorageAdapterInterface } from '@mikesaintsg/filesystem'

class MyCloudAdapter implements StorageAdapterInterface {
// Implement all methods...
}

const fs = await createFileSystem({ adapter: new MyCloudAdapter() })
```

---

## Implementation Phases

### Phase 1: Types

- Add `StorageAdapterInterface` to `src/types.ts`
- Add `adapter` option to `FileSystemOptions`
- Add `export()` and `import()` to `FileSystemInterface`

### Phase 2: OPFSAdapter

- Extract current OPFS logic into `src/adapters/OPFSAdapter.ts`
- Implement `StorageAdapterInterface`

### Phase 3: IndexedDBAdapter

- Create `src/adapters/IndexedDBAdapter.ts`
- Implement `StorageAdapterInterface` using `@mikesaintsg/indexeddb`

### Phase 4: InMemoryAdapter

- Create `src/adapters/InMemoryAdapter.ts`
- Implement `StorageAdapterInterface` using Map

### Phase 5: Core Refactoring

- Update `FileSystem`, `Directory`, `File` to use adapter
- Update `createFileSystem()` to accept adapter option
- Default to `new OPFSAdapter()` when no adapter provided

### Phase 6: Testing

- Test each adapter
- Test adapter switching
- Test export/import

---

## Summary

| Before | After |
|--------|-------|
| Hardcoded OPFS | Pluggable adapters |
| No fallback | IndexedDB, InMemory options |
| N/A | `export()` / `import()` for migration |

**Public API unchanged.** Just add `{ adapter: new XAdapter() }` to switch backends.

---

**License:** MIT © Mike Garcia
