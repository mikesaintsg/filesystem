# Adapter-Based Filesystem Refactoring Guide

> **A comprehensive guide to making `@mikesaintsg/filesystem` adapter-based while maintaining the same API**

This guide provides a complete implementation plan for refactoring the filesystem library to support pluggable storage adapters. The default adapter is OPFS (Origin Private File System), with IndexedDB as an alternative for environments where OPFS is unavailable or blocked.

---

## Table of Contents

1. [Overview](#overview)
2. [Design Goals](#design-goals)
3. [Architecture](#architecture)
4. [Type Definitions](#type-definitions)
5. [Adapter Interface](#adapter-interface)
6. [OPFS Adapter Implementation](#opfs-adapter-implementation)
7. [IndexedDB Adapter Implementation](#indexeddb-adapter-implementation)
8. [Export/Import for Migration](#exportimport-for-migration)
9. [Factory Function Updates](#factory-function-updates)
10. [Testing Strategy](#testing-strategy)
11. [Implementation Phases](#implementation-phases)
12. [Migration Workflow](#migration-workflow)
13. [File Structure](#file-structure)

---

## Overview

### The Problem

The current implementation is tightly coupled to OPFS. When OPFS is unavailable (Android WebView 132 bug, private browsing, etc.), the library fails without a fallback.

### The Solution

Refactor to an **adapter pattern** where:

1. The public API (`FileSystemInterface`, `FileInterface`, `DirectoryInterface`) remains unchanged
2. Storage operations are delegated to pluggable adapters
3. OPFS adapter is the default (converted from current implementation)
4. IndexedDB adapter provides a fallback using `@mikesaintsg/indexeddb`
5. Migration between adapters is handled via `export()` and `import()` methods

### Key Principle

**Same API, different backends.** Developers use the same code regardless of which adapter is active.

---

## Design Goals

| Goal | Description |
|------|-------------|
| **API Stability** | Zero breaking changes to existing API |
| **Zero Runtime Dependencies** | Only `@mikesaintsg/indexeddb` for IndexedDB adapter |
| **Type Safety** | Full TypeScript strict mode support |
| **Developer Control** | Migration logic is developer-provided |
| **Clean Separation** | Adapters are self-contained modules |

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    FileSystemInterface                       │
│  (Public API - unchanged)                                    │
├─────────────────────────────────────────────────────────────┤
│                  StorageAdapterInterface                     │
│  (Abstract storage operations)                               │
├──────────────────────────┬──────────────────────────────────┤
│    OPFSAdapter           │     IndexedDBAdapter             │
│    (default)             │     (fallback)                   │
│                          │     uses @mikesaintsg/indexeddb  │
└──────────────────────────┴──────────────────────────────────┘
```

### Component Relationships

```
createFileSystem(options?)
       │
       ├─ options.adapter provided?
       │     ├─ YES → Use provided adapter
       │     └─ NO  → Create default OPFSAdapter
       │
       ▼
FileSystem(adapter)
       │
       ├─ getRoot() → adapter.getRoot()
       ├─ getQuota() → adapter.getQuota()
       ├─ export() → adapter.export()
       └─ import() → adapter.import()
```


---

## Type Definitions

All new types go in `src/types.ts` following the types-first development flow.

### Storage Backend Type

```typescript
/** Storage backend type identifier */
export type StorageBackend = 'opfs' | 'indexeddb' | 'memory'
```

### Export Data Types

```typescript
/** Exported file data for migration */
export interface ExportedFile {
/** Relative path from root (e.g., '/folder/file.txt') */
readonly path: string
/** File name */
readonly name: string
/** MIME type */
readonly type: string
/** Last modified timestamp */
readonly lastModified: number
/** File content as base64-encoded string */
readonly content: string
}

/** Exported directory data for migration */
export interface ExportedDirectory {
/** Relative path from root (e.g., '/folder') */
readonly path: string
/** Directory name */
readonly name: string
}

/** Complete filesystem export for migration */
export interface ExportedFileSystem {
/** Export format version */
readonly version: 1
/** Export timestamp (ISO 8601) */
readonly exportedAt: string
/** Source adapter type */
readonly source: StorageBackend
/** All directories (sorted by path for deterministic ordering) */
readonly directories: readonly ExportedDirectory[]
/** All files (sorted by path for deterministic ordering) */
readonly files: readonly ExportedFile[]
}
```

### Import Options

```typescript
/** Import mode for handling existing entries */
export type ImportMode = 'merge' | 'replace'

/** Options for importing filesystem data */
export interface ImportOptions {
/** How to handle existing entries (default: 'merge') */
readonly mode?: ImportMode
/** Progress callback for large imports */
readonly onProgress?: (progress: ImportProgress) => void
}

/** Import progress information */
export interface ImportProgress {
readonly phase: 'directories' | 'files'
readonly current: number
readonly total: number
readonly currentPath?: string
}
```

### Export Options

```typescript
/** Options for exporting filesystem data */
export interface ExportOptions {
/** Progress callback for large exports */
readonly onProgress?: (progress: ExportProgress) => void
/** Filter function to selectively export entries */
readonly filter?: (path: string, kind: EntryKind) => boolean
}

/** Export progress information */
export interface ExportProgress {
readonly phase: 'scanning' | 'exporting'
readonly current: number
readonly total: number
readonly currentPath?: string
}
```

### Adapter Interface

```typescript
/**
 * Storage adapter interface for pluggable backends.
 *
 * Adapters implement storage operations delegated by FileSystemInterface.
 * Each adapter manages its own connection lifecycle and resources.
 */
export interface StorageAdapterInterface {
/** Storage backend type identifier */
readonly type: StorageBackend

/**
 * Checks if this adapter is available in the current environment.
 * @returns true if the adapter can be used
 */
isAvailable(): Promise<boolean>

/**
 * Gets the root directory.
 * @returns Root DirectoryInterface
 */
getRoot(): Promise<DirectoryInterface>

/**
 * Gets storage quota information.
 * @returns Storage quota details
 */
getQuota(): Promise<StorageQuota>

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
 * Closes the adapter and releases resources.
 */
close(): void
}
```

### Updated FileSystemInterface

Add export/import methods to the existing interface:

```typescript
export interface FileSystemInterface {
// ... existing methods unchanged ...

// ---- Adapter Information ----

/** Gets the active storage backend type */
getBackendType(): StorageBackend

// ---- Export/Import for Migration ----

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

// ---- Lifecycle ----

/**
 * Closes the filesystem and releases adapter resources.
 */
close(): void
}
```

### FileSystem Options

```typescript
/** Options for creating a file system instance */
export interface FileSystemOptions {
/** Custom storage adapter (default: OPFSAdapter) */
readonly adapter?: StorageAdapterInterface
}
```

---

## Adapter Interface

The `StorageAdapterInterface` is the core abstraction that enables pluggable backends.

### Design Principles

1. **Minimal Surface Area** — Only methods needed for core operations
2. **Promise-Based** — All async operations return Promises
3. **Resource Management** — `close()` for cleanup
4. **Export/Import** — Built-in migration support

### Method Semantics

| Method | Purpose | Notes |
|--------|---------|-------|
| `type` | Backend identifier | Used for logging, debugging |
| `isAvailable()` | Feature detection | Returns `false` if backend is blocked |
| `getRoot()` | Root directory access | Returns DirectoryInterface |
| `getQuota()` | Storage information | May return zeros if unavailable |
| `export()` | Data extraction | For migration to another adapter |
| `import()` | Data ingestion | For migration from another adapter |
| `close()` | Resource cleanup | Closes connections, releases locks |


---

## OPFS Adapter Implementation

Convert the current `FileSystem` implementation to an OPFS adapter.

### File: `src/adapters/opfs/OPFSAdapter.ts`

```typescript
/**
 * @mikesaintsg/filesystem
 *
 * OPFS adapter implementing StorageAdapterInterface.
 * Default adapter using Origin Private File System.
 */

import type {
StorageAdapterInterface,
StorageBackend,
DirectoryInterface,
StorageQuota,
ExportedFileSystem,
ExportedFile,
ExportedDirectory,
ExportOptions,
ImportOptions,
} from '../../types.js'
import { wrapDOMException } from '../../errors.js'
import { Directory } from '../../core/directory/Directory.js'

/**
 * OPFS adapter for Origin Private File System.
 *
 * This is the default adapter and provides full read/write access
 * to the browser's origin-private storage.
 */
export class OPFSAdapter implements StorageAdapterInterface {
readonly type: StorageBackend = 'opfs'

async isAvailable(): Promise<boolean> {
if (typeof navigator === 'undefined' ||
typeof navigator.storage === 'undefined' ||
typeof navigator.storage.getDirectory !== 'function') {
return false
}

// Test actual access (catches Android WebView 132 bug)
try {
await navigator.storage.getDirectory()
return true
} catch {
return false
}
}

async getRoot(): Promise<DirectoryInterface> {
try {
const root = await navigator.storage.getDirectory()
return new Directory(root)
} catch (error) {
throw wrapDOMException(error)
}
}

async getQuota(): Promise<StorageQuota> {
try {
const estimate = await navigator.storage.estimate()
const usage = estimate.usage ?? 0
const quota = estimate.quota ?? 0
const available = quota - usage
const percentUsed = quota > 0 ? (usage / quota) * 100 : 0

return { usage, quota, available, percentUsed }
} catch (error) {
throw wrapDOMException(error)
}
}

async export(options?: ExportOptions): Promise<ExportedFileSystem> {
const root = await this.getRoot()
const directories: ExportedDirectory[] = []
const files: ExportedFile[] = []
let scannedCount = 0
let totalCount = 0

// Phase 1: Scan to count entries
if (options?.onProgress) {
for await (const { entry } of root.walk()) {
totalCount++
}
}
}

// Phase 2: Export entries
for await (const { path, entry } of root.walk()) {
const fullPath = path.length > 0 ? '/' + [...path, entry.name].join('/') : '/' + entry.name

// Apply filter if provided
continue
}

scannedCount++
options?.onProgress?.({
phase: 'exporting',
current: scannedCount,
total: totalCount || scannedCount,
currentPath: fullPath,
})

if (entry.kind === 'directory') {
directories.push({ path: fullPath, name: entry.name })
} else {
const file = await root.resolvePath(...path, entry.name)
if (file && 'getText' in file) {
const metadata = await file.getMetadata()
const buffer = await file.getArrayBuffer()
const content = this.#arrayBufferToBase64(buffer)

files.push({
path: fullPath,
name: entry.name,
type: metadata.type,
lastModified: metadata.lastModified,
content,
})
}
}
}

// Sort for deterministic output
directories.sort((a, b) => a.path.localeCompare(b.path))
files.sort((a, b) => a.path.localeCompare(b.path))

return {
version: 1,
exportedAt: new Date().toISOString(),
source: this.type,
directories,
files,
}
}

async import(data: ExportedFileSystem, options?: ImportOptions): Promise<void> {
const root = await this.getRoot()
const mode = options?.mode ?? 'merge'

// Clear existing data in replace mode
if (mode === 'replace') {
for await (const entry of root.entries()) {
if (entry.kind === 'directory') {
await root.removeDirectory(entry.name, { recursive: true })
} else {
await root.removeFile(entry.name)
}
}
}

// Phase 1: Create directories
const totalDirs = data.directories.length
for (let i = 0; i < data.directories.length; i++) {
const dir = data.directories[i]

options?.onProgress?.({
phase: 'directories',
current: i + 1,
total: totalDirs,
currentPath: dir.path,
})

// Remove leading slash and split into segments
const segments = dir.path.slice(1).split('/')
await root.createPath(...segments)
}

// Phase 2: Create files
const totalFiles = data.files.length
for (let i = 0; i < data.files.length; i++) {
const fileData = data.files[i]

options?.onProgress?.({
phase: 'files',
current: i + 1,
total: totalFiles,
currentPath: fileData.path,
})

// Get parent directory path
const segments = fileData.path.slice(1).split('/')
const fileName = segments.pop()

let parent: DirectoryInterface = root
if (segments.length > 0) {
parent = await root.createPath(...segments)
}

// Create file and write content
const file = await parent.createFile(fileName)
const content = this.#base64ToArrayBuffer(fileData.content)
await file.write(content)
}
}

close(): void {
// OPFS doesn't require explicit cleanup
}

// ---- Private Helpers ----

#arrayBufferToBase64(buffer: ArrayBuffer): string {
const bytes = new Uint8Array(buffer)
let binary = ''
for (let i = 0; i < bytes.byteLength; i++) {
}
return btoa(binary)
}

#base64ToArrayBuffer(base64: string): ArrayBuffer {
const binary = atob(base64)
const bytes = new Uint8Array(binary.length)
for (let i = 0; i < binary.length; i++) {
bytes[i] = binary.charCodeAt(i)
}
return bytes.buffer as ArrayBuffer
}
}
```

### Factory Function

```typescript
// src/adapters/opfs/index.ts
export { OPFSAdapter } from './OPFSAdapter.js'

/**
 * Creates an OPFS adapter.
 */
export function createOPFSAdapter(): StorageAdapterInterface {
return new OPFSAdapter()
}
```


---

## IndexedDB Adapter Implementation

Uses `@mikesaintsg/indexeddb` to provide a fallback storage backend.

### Schema Definition

```typescript
// src/adapters/indexeddb/schema.ts

/** File entry stored in IndexedDB */
export interface IDBFileEntry {
readonly id: string              // Full path: '/folder/file.txt'
readonly name: string            // File name: 'file.txt'
readonly parent: string          // Parent path: '/folder'
readonly kind: 'file'
readonly content: ArrayBuffer
readonly mimeType: string
readonly lastModified: number
}

/** Directory entry stored in IndexedDB */
export interface IDBDirectoryEntry {
readonly id: string              // Full path: '/folder'
readonly name: string            // Directory name: 'folder'
readonly parent: string          // Parent path: '/'
readonly kind: 'directory'
}

/** Union type for all entries */
export type IDBEntry = IDBFileEntry | IDBDirectoryEntry

/** Database schema */
export interface IndexedDBSchema {
readonly entries: IDBEntry
}

/** Database name */
export const DB_NAME = '@mikesaintsg/filesystem'
export const DB_VERSION = 1
```

### IndexedDB Adapter Class

```typescript
// src/adapters/indexeddb/IndexedDBAdapter.ts

import { createDatabase } from '@mikesaintsg/indexeddb'
import type { DatabaseInterface } from '@mikesaintsg/indexeddb'
import type {
StorageAdapterInterface,
StorageBackend,
DirectoryInterface,
StorageQuota,
ExportedFileSystem,
ExportOptions,
ImportOptions,
} from '../../types.js'
import { DB_NAME, DB_VERSION, type IndexedDBSchema } from './schema.js'
import { IndexedDBDirectory } from './IndexedDBDirectory.js'

/**
 * IndexedDB adapter for filesystem fallback.
 *
 * Uses @mikesaintsg/indexeddb to provide a fallback storage
 * when OPFS is unavailable.
 */
export class IndexedDBAdapter implements StorageAdapterInterface {
readonly type: StorageBackend = 'indexeddb'
#db: DatabaseInterface<IndexedDBSchema> | null = null

async isAvailable(): Promise<boolean> {
return typeof indexedDB !== 'undefined'
}

async #ensureDatabase(): Promise<DatabaseInterface<IndexedDBSchema>> {
if (this.#db) return this.#db

this.#db = await createDatabase<IndexedDBSchema>({
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
const rootExists = await this.#db.store('entries').has('/')
await this.#db.store('entries').set({
id: '/',
name: '',
parent: '',
kind: 'directory',
})
}

return this.#db
}

async getRoot(): Promise<DirectoryInterface> {
const db = await this.#ensureDatabase()
return new IndexedDBDirectory(db, '/')
}

async getQuota(): Promise<StorageQuota> {
if (navigator.storage?.estimate) {
const estimate = await navigator.storage.estimate()
const usage = estimate.usage ?? 0
const quota = estimate.quota ?? 0
return {
usage,
quota,
available: quota - usage,
percentUsed: quota > 0 ? (usage / quota) * 100 : 0,
}
}
return { usage: 0, quota: 0, available: 0, percentUsed: 0 }
}

// export() and import() methods similar to OPFSAdapter
// See full implementation in the guide

close(): void {
this.#db?.close()
this.#db = null
}
}
```

### Factory Function

```typescript
// src/adapters/indexeddb/index.ts
export { IndexedDBAdapter } from './IndexedDBAdapter.js'
export { IndexedDBFile } from './IndexedDBFile.js'
export { IndexedDBDirectory } from './IndexedDBDirectory.js'
export type { IndexedDBSchema, IDBEntry, IDBFileEntry, IDBDirectoryEntry } from './schema.js'

import type { StorageAdapterInterface } from '../../types.js'
import { IndexedDBAdapter } from './IndexedDBAdapter.js'

/**
 * Creates an IndexedDB adapter.
 */
export function createIndexedDBAdapter(): StorageAdapterInterface {
return new IndexedDBAdapter()
}
```

### IndexedDB File and Directory

The `IndexedDBFile` and `IndexedDBDirectory` classes implement `FileInterface` and `DirectoryInterface` respectively, storing all data in IndexedDB using `@mikesaintsg/indexeddb`.

Key implementation notes:

1. **Path-based keys**: Each entry uses its full path as the primary key (e.g., `/folder/file.txt`)
2. **Parent index**: The `byParent` index enables efficient directory listing
3. **Content storage**: File content is stored as `ArrayBuffer` directly in IndexedDB
4. **No native handles**: The `native` property throws `NotSupportedError` since IndexedDB doesn't have handles



---

## Export/Import for Migration

### Developer-Controlled Migration

The migration workflow is **developer-controlled**. The library provides `export()` and `import()` methods, but the developer decides when and how to use them.

### Migration Example

```typescript
import {
createFileSystem,
createOPFSAdapter,
createIndexedDBAdapter,
} from '@mikesaintsg/filesystem'

async function migrateToOPFS() {
// 1. Create adapters
const oldAdapter = createIndexedDBAdapter()
const newAdapter = createOPFSAdapter()

// 2. Check if OPFS is now available
console.log('OPFS not available, skipping migration')
return createFileSystem({ adapter: oldAdapter })
}

// 3. Create file systems
const oldFS = await createFileSystem({ adapter: oldAdapter })
const newFS = await createFileSystem({ adapter: newAdapter })

// 4. Export from old adapter
console.log('Exporting data from IndexedDB...')
const exportedData = await oldFS.export({
onProgress: (p) => console.log(`Export: ${p.current}/${p.total}`),
})

// 5. Import to new adapter
console.log('Importing data to OPFS...')
await newFS.import(exportedData, {
mode: 'replace',
onProgress: (p) => console.log(`Import ${p.phase}: ${p.current}/${p.total}`),
})

// 6. Clean up old adapter
oldFS.close()

// 7. Optionally delete old IndexedDB database
indexedDB.deleteDatabase('@mikesaintsg/filesystem')

console.log('Migration complete!')
return newFS
}
```

### Selective Export

```typescript
// Export only text files
const exportedData = await fs.export({
filter: (path, kind) => {
if (kind === 'directory') return true // Include all directories
return path.endsWith('.txt') || path.endsWith('.json')
},
})
```

### Progress Tracking

```typescript
const exportedData = await fs.export({
onProgress: (progress) => {
const percent = Math.round((progress.current / progress.total) * 100)
updateProgressBar(percent)
updateStatusText(`${progress.phase}: ${progress.currentPath}`)
},
})
```

---

## Factory Function Updates

Update `src/factories.ts` to accept adapter options:

```typescript
/**
 * Creates a file system interface.
 *
 * @param options - FileSystem options including adapter
 * @returns Promise resolving to FileSystemInterface
 *
 * @example
 * ```ts
 * // Default OPFS adapter
 * const fs = await createFileSystem()
 *
 * // With custom adapter
 * const fs = await createFileSystem({
 *   adapter: createIndexedDBAdapter(),
 * })
 * ```
 */
export async function createFileSystem(options?: FileSystemOptions): Promise<FileSystemInterface> {
const adapter = options?.adapter ?? new OPFSAdapter()

// Verify adapter is available
const available = await adapter.isAvailable()
throw new Error(`Storage adapter '${adapter.type}' is not available in this environment`)
}

return new FileSystem(adapter)
}
```



---

## Testing Strategy

### Unit Tests for Adapters

```typescript
// tests/adapters/opfs/OPFSAdapter.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { OPFSAdapter } from '~/src/adapters/opfs/OPFSAdapter.js'

describe('OPFSAdapter', () => {
let adapter: OPFSAdapter

beforeEach(() => {
adapter = new OPFSAdapter()
})

afterEach(() => {
adapter.close()
})

describe('type', () => {
it('returns opfs', () => {
expect(adapter.type).toBe('opfs')
})
})

describe('isAvailable', () => {
it('returns true in supported browsers', async () => {
const available = await adapter.isAvailable()
expect(available).toBe(true)
})
})

describe('getRoot', () => {
it('returns a DirectoryInterface', async () => {
const root = await adapter.getRoot()
expect(root.getName()).toBe('')
})
})

describe('export/import', () => {
it('round-trips data correctly', async () => {
const root = await adapter.getRoot()

// Create test data
await root.createDirectory('test-dir')
const file = await root.createFile('test-file.txt')
await file.write('Hello, World!')

// Export
const exported = await adapter.export()
expect(exported.version).toBe(1)
expect(exported.source).toBe('opfs')

// Clear and re-import
await root.removeDirectory('test-dir', { recursive: true })
await root.removeFile('test-file.txt')

await adapter.import(exported, { mode: 'merge' })

// Verify
const restoredFile = await root.getFile('test-file.txt')
expect(await restoredFile?.getText()).toBe('Hello, World!')

// Cleanup
await root.removeDirectory('test-dir', { recursive: true })
await root.removeFile('test-file.txt')
})
})
})
```

### Integration Tests

```typescript
// tests/integration/adapter-migration.test.ts

import { describe, it, expect } from 'vitest'
import { createFileSystem, createOPFSAdapter, createIndexedDBAdapter } from '~/src/index.js'

describe('adapter migration', () => {
it('migrates data between adapters', async () => {
// Create source filesystem with IndexedDB
const sourceAdapter = createIndexedDBAdapter()
const sourceFS = await createFileSystem({ adapter: sourceAdapter })

// Add test data
const root = await sourceFS.getRoot()
await root.createPath('documents', 'work')
const dir = await root.createPath('documents')
const file = await dir.createFile('note.txt')
await file.write('Important note')

// Export data
const exported = await sourceFS.export()
expect(exported.source).toBe('indexeddb')

// Create target filesystem with OPFS
const targetAdapter = createOPFSAdapter()
sourceFS.close()
return // Skip if OPFS not available
}

const targetFS = await createFileSystem({ adapter: targetAdapter })

// Import data
await targetFS.import(exported, { mode: 'replace' })

// Verify migration
const targetRoot = await targetFS.getRoot()
const migratedFile = await targetRoot.resolvePath('documents', 'note.txt')
if (migratedFile && 'getText' in migratedFile) {
expect(await migratedFile.getText()).toBe('Important note')
}

// Cleanup
sourceFS.close()
targetFS.close()
})
})
```



---

## Implementation Phases

### Phase 1: Type Definitions

**Deliverables:**
- [ ] Add `StorageBackend` type
- [ ] Add `StorageAdapterInterface`
- [ ] Add export/import types (`ExportedFile`, `ExportedDirectory`, `ExportedFileSystem`)
- [ ] Add option types (`ExportOptions`, `ImportOptions`, `FileSystemOptions`)
- [ ] Add progress types (`ExportProgress`, `ImportProgress`)
- [ ] Update `FileSystemInterface` with new methods

**Files affected:**
- `src/types.ts`

### Phase 2: OPFS Adapter

**Deliverables:**
- [ ] Create `src/adapters/opfs/` directory
- [ ] Implement `OPFSAdapter` class
- [ ] Implement `export()` method
- [ ] Implement `import()` method
- [ ] Add barrel export `src/adapters/opfs/index.ts`
- [ ] Add `createOPFSAdapter()` factory function

**Files affected:**
- `src/adapters/opfs/OPFSAdapter.ts`
- `src/adapters/opfs/index.ts`

### Phase 3: IndexedDB Adapter

**Deliverables:**
- [ ] Create `src/adapters/indexeddb/` directory
- [ ] Define schema types
- [ ] Implement `IndexedDBFile` class
- [ ] Implement `IndexedDBDirectory` class
- [ ] Implement `IndexedDBWritableFile` class
- [ ] Implement `IndexedDBAdapter` class
- [ ] Add barrel export `src/adapters/indexeddb/index.ts`
- [ ] Add `createIndexedDBAdapter()` factory function

**Files affected:**
- `src/adapters/indexeddb/schema.ts`
- `src/adapters/indexeddb/IndexedDBFile.ts`
- `src/adapters/indexeddb/IndexedDBDirectory.ts`
- `src/adapters/indexeddb/IndexedDBWritableFile.ts`
- `src/adapters/indexeddb/IndexedDBAdapter.ts`
- `src/adapters/indexeddb/index.ts`

### Phase 4: FileSystem Refactoring

**Deliverables:**
- [ ] Update `FileSystem` class to accept adapter
- [ ] Implement `getBackendType()` method
- [ ] Implement `export()` method (delegates to adapter)
- [ ] Implement `import()` method (delegates to adapter)
- [ ] Implement `close()` method
- [ ] Update `createFileSystem()` factory function
- [ ] Update barrel exports in `src/index.ts`

**Files affected:**
- `src/core/filesystem/FileSystem.ts`
- `src/factories.ts`
- `src/index.ts`

### Phase 5: Testing

**Deliverables:**
- [ ] Unit tests for OPFS adapter
- [ ] Unit tests for IndexedDB adapter
- [ ] Integration tests for migration
- [ ] Update existing tests if needed

**Files affected:**
- `tests/adapters/opfs/OPFSAdapter.test.ts`
- `tests/adapters/indexeddb/IndexedDBAdapter.test.ts`
- `tests/adapters/indexeddb/IndexedDBDirectory.test.ts`
- `tests/adapters/indexeddb/IndexedDBFile.test.ts`
- `tests/integration/adapter-migration.test.ts`

### Phase 6: Documentation

**Deliverables:**
- [ ] Update `guides/filesystem.md` with adapter information
- [ ] Add migration examples
- [ ] Update README.md

**Files affected:**
- `guides/filesystem.md`
- `README.md`



---

## Migration Workflow

### Scenario: Android WebView 132 Bug

The Android WebView 132 bug causes OPFS to fail. Here's how developers handle this:

```typescript
import {
createFileSystem,
createOPFSAdapter,
createIndexedDBAdapter,
} from '@mikesaintsg/filesystem'

async function initFileSystem() {
const opfsAdapter = createOPFSAdapter()

// Check if OPFS is available
if (await opfsAdapter.isAvailable()) {
// Check if we have old IndexedDB data to migrate
const idbAdapter = createIndexedDBAdapter()
const idbFS = await createFileSystem({ adapter: idbAdapter })
const idbRoot = await idbFS.getRoot()
const hasData = (await idbRoot.list()).length > 0

if (hasData) {
// Migrate from IndexedDB to OPFS
console.log('Migrating data to OPFS...')
const exported = await idbFS.export()
idbFS.close()

const opfsFS = await createFileSystem({ adapter: opfsAdapter })
await opfsFS.import(exported, { mode: 'replace' })

// Clean up old data
indexedDB.deleteDatabase('@mikesaintsg/filesystem')

return opfsFS
}

idbFS.close()
return createFileSystem({ adapter: opfsAdapter })
}

// OPFS not available, use IndexedDB
console.log('OPFS unavailable, using IndexedDB fallback')
return createFileSystem({ adapter: createIndexedDBAdapter() })
}
```

### Scenario: Manual Export/Import

Developers can also manually trigger exports for backup purposes:

```typescript
// Export to JSON file
async function backupFileSystem(fs) {
const exported = await fs.export()
const json = JSON.stringify(exported, null, 2)
const blob = new Blob([json], { type: 'application/json' })

// Trigger download
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = `filesystem-backup-${new Date().toISOString()}.json`
a.click()
URL.revokeObjectURL(url)
}

// Import from JSON file
async function restoreFileSystem(fs, file) {
const json = await file.text()
const exported = JSON.parse(json)
await fs.import(exported, { mode: 'replace' })
}
```

---

## File Structure

After refactoring, the source structure will be:

```
src/
├── adapters/
│   ├── opfs/
│   │   ├── OPFSAdapter.ts
│   │   └── index.ts
│   └── indexeddb/
│       ├── schema.ts
│       ├── IndexedDBFile.ts
│       ├── IndexedDBDirectory.ts
│       ├── IndexedDBWritableFile.ts
│       ├── IndexedDBAdapter.ts
│       └── index.ts
├── core/
│   ├── directory/
│   │   └── Directory.ts
│   ├── file/
│   │   ├── File.ts
│   │   ├── WritableFile.ts
│   │   └── SyncAccessHandle.ts
│   └── filesystem/
│       └── FileSystem.ts
├── constants.ts
├── errors.ts
├── factories.ts
├── globals.d.ts
├── helpers.ts
├── index.ts
└── types.ts
```

---

## Summary

This refactoring guide provides a complete implementation plan for making `@mikesaintsg/filesystem` adapter-based. Key points:

1. **Same API** — Existing code works unchanged
2. **Pluggable Backends** — OPFS (default) and IndexedDB adapters
3. **Developer-Controlled Migration** — `export()` and `import()` methods
4. **Clean Separation** — Adapters are self-contained modules
5. **Type Safety** — Full TypeScript strict mode support
6. **Progressive Implementation** — 6 phases from types to documentation

The approach leaves migration logic to developers, keeping the library focused on storage operations while providing the tools needed for data portability.

---

**License:** MIT © Mike Garcia
