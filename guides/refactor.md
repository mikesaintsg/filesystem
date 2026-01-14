# IndexedDBAdapter Implementation Guide

> **Implementing the IndexedDBAdapter using @mikesaintsg/indexeddb for fallback storage when OPFS is unavailable**

---

## Overview

The adapter system is already in place with `StorageAdapterInterface`, `OPFSAdapter`, and `InMemoryAdapter` implemented. This guide focuses on implementing the `IndexedDBAdapter` which provides a fallback storage option when OPFS is unavailable (e.g., in Safari iOS private browsing, older browsers).

### Completed Adapters

| Adapter           | Status      | Description                          |
|-------------------|-------------|--------------------------------------|
| `OPFSAdapter`     | ✅ Complete | Origin Private File System (default) |
| `InMemoryAdapter` | ✅ Complete | In-memory Map storage for testing    |
| `IndexedDBAdapter`| 🔄 Pending  | IndexedDB-based persistent storage   |

---

## IndexedDBAdapter Design

The `IndexedDBAdapter` will use `@mikesaintsg/indexeddb` to store files and directories in IndexedDB. This provides:

- **Persistence**: Data survives page reloads
- **Fallback**: Works when OPFS is unavailable
- **Cross-browser**: IndexedDB has wider support than OPFS

### Database Schema

```typescript
interface FileSystemEntry {
readonly path: string        // Primary key, e.g., '/data/config.json'
readonly name: string        // Entry name, e.g., 'config.json'
readonly parent: string      // Parent path, e.g., '/data' (indexed)
readonly kind: 'file' | 'directory'
readonly content?: ArrayBuffer    // File content (files only)
readonly lastModified?: number    // Timestamp (files only)
}

interface FileSystemSchema {
readonly entries: FileSystemEntry
}
```

### Database Configuration

```typescript
import { createDatabase } from '@mikesaintsg/indexeddb'

const db = await createDatabase<FileSystemSchema>({
name: '@mikesaintsg/filesystem',
version: 1,
stores: {
entries: {
keyPath: 'path',
indexes: [
{ name: 'byParent', keyPath: 'parent' }
]
}
}
})
```

---

## Implementation

### Class Structure

```typescript
// src/adapters/IndexedDBAdapter.ts

import { createDatabase, type DatabaseInterface } from '@mikesaintsg/indexeddb'
import type {
StorageAdapterInterface,
FileMetadata,
WriteData,
WriteOptions,
RemoveDirectoryOptions,
AdapterDirectoryEntry,
StorageQuota,
ExportedFileSystem,
ExportOptions,
ImportOptions,
CopyOptions,
} from '../types.js'
import { NotFoundError, TypeMismatchError } from '../errors.js'

interface FileSystemEntry {
readonly path: string
readonly name: string
readonly parent: string
readonly kind: 'file' | 'directory'
readonly content?: ArrayBuffer
readonly lastModified?: number
}

interface FileSystemSchema {
readonly entries: FileSystemEntry
}

export class IndexedDBAdapter implements StorageAdapterInterface {
#db: DatabaseInterface<FileSystemSchema> | null = null
#dbName: string

constructor(dbName = '@mikesaintsg/filesystem') {
this.#dbName = dbName
}

// ---- Lifecycle ----

isAvailable(): Promise<boolean> {
return Promise.resolve(typeof indexedDB !== 'undefined')
}

async init(): Promise<void> {
this.#db = await createDatabase<FileSystemSchema>({
name: this.#dbName,
version: 1,
stores: {
entries: {
keyPath: 'path',
indexes: [
{ name: 'byParent', keyPath: 'parent' }
]
}
}
})

// Ensure root directory exists
const root = await this.#db.store('entries').get('/')
if (!root) {
await this.#db.store('entries').set({
path: '/',
name: '',
parent: '',
kind: 'directory',
})
}
}

close(): void {
this.#db?.close()
this.#db = null
}

// ---- File Operations ----

async getFileText(path: string): Promise<string> {
const entry = await this.#getEntry(path)
if (!entry || entry.kind !== 'file') {
throw new NotFoundError(path)
}
if (!entry.content) {
return ''
}
return new TextDecoder().decode(entry.content)
}

async getFileArrayBuffer(path: string): Promise<ArrayBuffer> {
const entry = await this.#getEntry(path)
if (!entry || entry.kind !== 'file') {
throw new NotFoundError(path)
}
return entry.content ?? new ArrayBuffer(0)
}

async getFileBlob(path: string): Promise<Blob> {
const buffer = await this.getFileArrayBuffer(path)
return new Blob([buffer])
}

async getFileMetadata(path: string): Promise<FileMetadata> {
const entry = await this.#getEntry(path)
if (!entry || entry.kind !== 'file') {
throw new NotFoundError(path)
}
return {
name: entry.name,
size: entry.content?.byteLength ?? 0,
type: '',
lastModified: entry.lastModified ?? Date.now(),
}
}

async writeFile(path: string, data: WriteData, options?: WriteOptions): Promise<void> {
const content = await this.#toArrayBuffer(data)
const existing = await this.#getEntry(path)

let finalContent = content
if (options?.keepExistingData && existing?.content && options?.position !== undefined) {
// Merge with existing content
const existingArray = new Uint8Array(existing.content)
const newArray = new Uint8Array(content)
const resultSize = Math.max(existingArray.length, options.position + newArray.length)
const result = new Uint8Array(resultSize)
result.set(existingArray)
result.set(newArray, options.position)
finalContent = result.buffer
}

await this.#db!.store('entries').set({
path,
name: this.#getName(path),
parent: this.#getParent(path),
kind: 'file',
content: finalContent,
lastModified: Date.now(),
})

// Ensure parent directories exist
await this.#ensureParentDirectories(path)
}

async appendFile(path: string, data: WriteData): Promise<void> {
const existing = await this.#getEntry(path)
const newContent = await this.#toArrayBuffer(data)

let content: ArrayBuffer
if (existing?.content) {
const merged = new Uint8Array(existing.content.byteLength + newContent.byteLength)
merged.set(new Uint8Array(existing.content))
merged.set(new Uint8Array(newContent), existing.content.byteLength)
content = merged.buffer
} else {
content = newContent
}

await this.#db!.store('entries').set({
path,
name: this.#getName(path),
parent: this.#getParent(path),
kind: 'file',
content,
lastModified: Date.now(),
})
}

async truncateFile(path: string, size: number): Promise<void> {
const entry = await this.#getEntry(path)
if (!entry || entry.kind !== 'file') {
throw new NotFoundError(path)
}

const existing = entry.content ?? new ArrayBuffer(0)
let newContent: ArrayBuffer

if (size <= existing.byteLength) {
newContent = existing.slice(0, size)
} else {
newContent = new ArrayBuffer(size)
new Uint8Array(newContent).set(new Uint8Array(existing))
}

await this.#db!.store('entries').set({
...entry,
content: newContent,
lastModified: Date.now(),
})
}

async hasFile(path: string): Promise<boolean> {
const entry = await this.#getEntry(path)
return entry?.kind === 'file'
}

async removeFile(path: string): Promise<void> {
const entry = await this.#getEntry(path)
if (!entry) {
throw new NotFoundError(path)
}
if (entry.kind !== 'file') {
throw new TypeMismatchError('file', path)
}
await this.#db!.store('entries').remove(path)
}

async copyFile(sourcePath: string, destPath: string, options?: CopyOptions): Promise<void> {
const source = await this.#getEntry(sourcePath)
if (!source || source.kind !== 'file') {
throw new NotFoundError(sourcePath)
}

if (!options?.overwrite) {
const existing = await this.#getEntry(destPath)
if (existing) {
throw new TypeMismatchError('file', destPath)
}
}

await this.#db!.store('entries').set({
path: destPath,
name: this.#getName(destPath),
parent: this.#getParent(destPath),
kind: 'file',
content: source.content,
lastModified: Date.now(),
})

await this.#ensureParentDirectories(destPath)
}

async moveFile(sourcePath: string, destPath: string, options?: CopyOptions): Promise<void> {
await this.copyFile(sourcePath, destPath, options)
await this.#db!.store('entries').remove(sourcePath)
}

// ---- Directory Operations ----

async createDirectory(path: string): Promise<void> {
const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path
if (normalizedPath === '' || normalizedPath === '/') {
return // Root always exists
}

await this.#db!.store('entries').set({
path: normalizedPath,
name: this.#getName(normalizedPath),
parent: this.#getParent(normalizedPath),
kind: 'directory',
})

await this.#ensureParentDirectories(normalizedPath)
}

async hasDirectory(path: string): Promise<boolean> {
const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path
if (normalizedPath === '' || normalizedPath === '/') {
return true
}
const entry = await this.#getEntry(normalizedPath)
return entry?.kind === 'directory'
}

async removeDirectory(path: string, options?: RemoveDirectoryOptions): Promise<void> {
const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path
const entry = await this.#getEntry(normalizedPath)

if (!entry) {
throw new NotFoundError(path)
}
if (entry.kind !== 'directory') {
throw new TypeMismatchError('directory', path)
}

// Check for children using index
const children = await this.#db!.store('entries')
.index('byParent')
.all(IDBKeyRange.only(normalizedPath))

if (children.length > 0 && !options?.recursive) {
throw new Error('Directory not empty')
}

if (options?.recursive) {
// Remove all descendants
const allEntries = await this.#db!.store('entries').all()
for (const e of allEntries) {
if (e.path.startsWith(normalizedPath + '/') || e.path === normalizedPath) {
if (e.path !== '/') {
await this.#db!.store('entries').remove(e.path)
}
}
}
} else {
await this.#db!.store('entries').remove(normalizedPath)
}
}

async listEntries(path: string): Promise<readonly AdapterDirectoryEntry[]> {
const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path
const parentPath = normalizedPath === '/' ? '/' : normalizedPath

const entries = await this.#db!.store('entries')
.index('byParent')
.all(IDBKeyRange.only(parentPath))

return entries.map(e => ({
name: e.name,
kind: e.kind,
}))
}

// ---- Quota & Migration ----

async getQuota(): Promise<StorageQuota> {
// IndexedDB doesn't have a direct quota API, use Storage API estimate
if (navigator.storage?.estimate) {
const estimate = await navigator.storage.estimate()
return {
usage: estimate.usage ?? 0,
quota: estimate.quota ?? 0,
available: (estimate.quota ?? 0) - (estimate.usage ?? 0),
percentUsed: estimate.quota ? ((estimate.usage ?? 0) / estimate.quota) * 100 : 0,
}
}

// Fallback: calculate from stored data
const entries = await this.#db!.store('entries').all()
let usage = 0
for (const entry of entries) {
if (entry.content) {
usage += entry.content.byteLength
}
usage += entry.path.length + entry.name.length + 50
}

const quota = 50 * 1024 * 1024 // 50MB default estimate
return {
usage,
quota,
available: quota - usage,
percentUsed: (usage / quota) * 100,
}
}

async export(options?: ExportOptions): Promise<ExportedFileSystem> {
const allEntries = await this.#db!.store('entries').all()
const entries: ExportedEntry[] = []

for (const entry of allEntries) {
if (entry.path === '/') continue

if (options?.includePaths?.length) {
if (!options.includePaths.some(p => entry.path.startsWith(p))) continue
}

if (options?.excludePaths?.length) {
if (options.excludePaths.some(p => entry.path.startsWith(p))) continue
}

if (entry.kind === 'file') {
entries.push({
path: entry.path,
name: entry.name,
kind: 'file',
content: entry.content ?? new ArrayBuffer(0),
lastModified: entry.lastModified ?? Date.now(),
})
} else {
entries.push({
path: entry.path,
name: entry.name,
kind: 'directory',
})
}
}

return {
version: 1,
exportedAt: Date.now(),
entries,
}
}

async import(data: ExportedFileSystem, options?: ImportOptions): Promise<void> {
const mergeBehavior = options?.mergeBehavior ?? 'replace'

// Sort: directories first
const sorted = [...data.entries].sort((a, b) => {
if (a.kind === 'directory' && b.kind !== 'directory') return -1
if (a.kind !== 'directory' && b.kind === 'directory') return 1
return a.path.localeCompare(b.path)
})

for (const entry of sorted) {
if (mergeBehavior === 'skip') {
const existing = await this.#getEntry(entry.path)
if (existing) continue
}

if (entry.kind === 'directory') {
await this.createDirectory(entry.path)
} else {
await this.#db!.store('entries').set({
path: entry.path,
name: entry.name,
parent: this.#getParent(entry.path),
kind: 'file',
content: entry.content,
lastModified: entry.lastModified,
})
}
}
}

// ---- Private Helpers ----

#getEntry(path: string): Promise<FileSystemEntry | undefined> {
return this.#db!.store('entries').get(path)
}

#getName(path: string): string {
return path.split('/').pop() ?? ''
}

#getParent(path: string): string {
const lastSlash = path.lastIndexOf('/')
return lastSlash <= 0 ? '/' : path.substring(0, lastSlash)
}

async #ensureParentDirectories(path: string): Promise<void> {
const parent = this.#getParent(path)
if (parent === '/' || parent === '') return

const existing = await this.#getEntry(parent)
if (!existing) {
await this.#db!.store('entries').set({
path: parent,
name: this.#getName(parent),
parent: this.#getParent(parent),
kind: 'directory',
})
await this.#ensureParentDirectories(parent)
}
}

async #toArrayBuffer(data: WriteData): Promise<ArrayBuffer> {
if (typeof data === 'string') {
return new TextEncoder().encode(data).buffer as ArrayBuffer
}
if (data instanceof ArrayBuffer) {
return data
}
if (ArrayBuffer.isView(data)) {
return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
}
if (data instanceof Blob) {
return data.arrayBuffer()
}
if (data instanceof ReadableStream) {
const chunks: Uint8Array[] = []
const reader = data.getReader()
while (true) {
const { done, value } = await reader.read()
if (done) break
chunks.push(value)
}
const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
const result = new Uint8Array(totalLength)
let offset = 0
for (const chunk of chunks) {
result.set(chunk, offset)
offset += chunk.length
}
return result.buffer as ArrayBuffer
}
throw new Error('Unsupported data type')
}
}
```

---

## Usage

### Basic Usage

```typescript
import { createFileSystem, IndexedDBAdapter } from '@mikesaintsg/filesystem'

const fs = await createFileSystem({ adapter: new IndexedDBAdapter() })
const root = await fs.getRoot()

const file = await root.createFile('hello.txt')
await file.write('Hello, IndexedDB!')

const content = await file.getText()
console.log(content) // 'Hello, IndexedDB!'
```

### Automatic Fallback

```typescript
import { createFileSystem, OPFSAdapter, IndexedDBAdapter } from '@mikesaintsg/filesystem'

async function initFileSystem() {
const opfs = new OPFSAdapter()

if (await opfs.isAvailable()) {
return createFileSystem({ adapter: opfs })
}

// Fall back to IndexedDB
return createFileSystem({ adapter: new IndexedDBAdapter() })
}
```

### Custom Database Name

```typescript
// Use a custom database name to avoid conflicts
const adapter = new IndexedDBAdapter('my-app-filesystem')
const fs = await createFileSystem({ adapter })
```

---

## Implementation Checklist

- [ ] Create `src/adapters/IndexedDBAdapter.ts`
- [ ] Add `@mikesaintsg/indexeddb` as a dependency
- [ ] Implement all `StorageAdapterInterface` methods
- [ ] Add tests in `tests/adapters/IndexedDBAdapter.test.ts`
- [ ] Update exports in `src/adapters/index.ts`
- [ ] Update documentation

---

## Testing

```typescript
// tests/adapters/IndexedDBAdapter.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { IndexedDBAdapter } from '../../src/adapters/IndexedDBAdapter.js'

describe('IndexedDBAdapter', () => {
let adapter: IndexedDBAdapter

beforeEach(async () => {
adapter = new IndexedDBAdapter('test-fs-' + Date.now())
await adapter.init()
})

afterEach(() => {
adapter.close()
})

describe('file operations', () => {
it('writes and reads text files', async () => {
await adapter.writeFile('/hello.txt', 'Hello, World!')
const content = await adapter.getFileText('/hello.txt')
expect(content).toBe('Hello, World!')
})

it('writes and reads binary files', async () => {
const data = new Uint8Array([1, 2, 3, 4, 5])
await adapter.writeFile('/data.bin', data)
const buffer = await adapter.getFileArrayBuffer('/data.bin')
expect(new Uint8Array(buffer)).toEqual(data)
})

// More tests...
})

describe('directory operations', () => {
it('creates nested directories', async () => {
await adapter.createDirectory('/a/b/c')
expect(await adapter.hasDirectory('/a')).toBe(true)
expect(await adapter.hasDirectory('/a/b')).toBe(true)
expect(await adapter.hasDirectory('/a/b/c')).toBe(true)
})

// More tests...
})
})
```

---

## Dependencies

Add `@mikesaintsg/indexeddb` to `package.json`:

```json
{
"dependencies": {
"@mikesaintsg/indexeddb": "^1.0.0"
}
}
```

---

**License:** MIT © Mike Garcia
