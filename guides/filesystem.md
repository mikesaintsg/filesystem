# @mikesaintsg/filesystem API Guide

> **A focused File System wrapper that enhances native browser APIs without abstracting them away**

This guide provides comprehensive documentation for all features, APIs, and usage patterns of the `@mikesaintsg/filesystem` library.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Core Concepts](#core-concepts)
5. [Storage Adapters](#storage-adapters)
6. [File System Operations](#file-system-operations)
7. [File Operations](#file-operations)
8. [Directory Operations](#directory-operations)
9. [Convenience Methods](#convenience-methods)
10. [Export & Import](#export--import)
11. [Writable Streams](#writable-streams)
12. [Sync Access (Workers)](#sync-access-workers)
13. [Directory Traversal](#directory-traversal)
14. [Picker Dialogs](#picker-dialogs)
15. [Drag & Drop Integration](#drag--drop-integration)
16. [Error Handling](#error-handling)
17. [Native Access](#native-access)
18. [TypeScript Integration](#typescript-integration)
19. [Performance Tips](#performance-tips)
20. [Browser Compatibility](#browser-compatibility)
21. [API Reference](#api-reference)

---

## Introduction

This library provides a type-safe, Promise-based wrapper around browser File System APIs that **enhances** the native APIs without abstracting them away. Developers get:

- **Type safety**: Strong TypeScript types with full strict mode support
- **Promise-based operations**: Async/await instead of complex callback patterns
- **Unified interface**: Single API surface across OPFS, File System Access API, and legacy APIs
- **Pluggable storage**: Swap storage backends with adapters (OPFS, InMemory, IndexedDB)
- **Native access**: Full access to underlying browser handles via `.native` property
- **Zero dependencies**: Built entirely on Web Platform APIs

### Value Proposition

| Native Browser APIs                    | This Library                           |
|----------------------------------------|----------------------------------------|
| Multiple inconsistent APIs             | Unified interface across all sources   |
| Callback-based directory iteration     | Async generators with early break      |
| No type safety                         | Full TypeScript strict mode support    |
| Manual permission management           | Simplified permission helpers          |
| Complex multi-batch `readEntries`      | Automatic batching for directory reads |
| No path-based operations               | `mkdir -p` style path creation         |

### API Landscape

This library wraps and unifies four distinct browser APIs:

| API                                | Read | Write | User Prompt | Origin-Private | Browser Support    |
|------------------------------------|------|-------|-------------|----------------|--------------------|
| **File API**                       | ✅   | ❌    | Via input   | N/A            | Universal          |
| **File and Directory Entries API** | ✅   | ❌    | Via drag-drop | N/A          | Chromium, Firefox  |
| **File System Access API**         | ✅   | ✅    | Native dialogs | ❌           | Chromium only      |
| **Origin Private File System**     | ✅   | ✅    | None needed | ✅             | All modern browsers |

---

## Installation

```bash
npm install @mikesaintsg/filesystem
```

---

## Quick Start

```typescript
import { createFileSystem } from '@mikesaintsg/filesystem'

// 1. Create file system interface
const fs = await createFileSystem()

// 2. Get the OPFS root directory
const root = await fs.getRoot()

// 3. Create a file and write content
const file = await root.createFile('hello.txt')
await file.write('Hello, File System!')

// 4. Read the file back
const content = await file.getText()
console.log(content) // 'Hello, File System!'

// 5. Create nested directories
const cache = await root.createPath('data', 'cache', 'images')

// 6. List directory contents
for await (const entry of root.entries()) {
	console.log(`${entry.kind}: ${entry.name}`)
}

// 7. Check storage quota
const quota = await fs.getQuota()
console.log(`Used: ${quota.percentUsed}%`)
```

### User File Access (Chromium Only)

```typescript
import { createFileSystem } from '@mikesaintsg/filesystem'

const fs = await createFileSystem()

// Check if user file access is available
if (fs.isUserAccessSupported()) {
	// Open file picker
	const files = await fs.showOpenFilePicker({
		types: [{ accept: { 'text/*': ['.txt', '.md'] } }]
	})

	for (const file of files) {
		const content = await file.getText()
		console.log(file.getName(), content)
	}

	// Save file picker
	const saveFile = await fs.showSaveFilePicker({
		suggestedName: 'document.txt'
	})
	await saveFile.write('Saved content')

	// Directory picker
	const dir = await fs.showDirectoryPicker()
	for await (const entry of dir.entries()) {
		console.log(entry.name)
	}
}
```

---

## Core Concepts

### Design Philosophy

Following the same patterns as `@mikesaintsg/indexeddb`:

1. **Enhance, don't abstract**: Expose native handles via `.native` property
2. **Promise-based**: Convert all callbacks to async/await
3. **Type-safe**: Strict TypeScript types without `any`, `!`, or unsafe casts
4. **Zero dependencies**: Use only native platform APIs
5. **Layered access**: OPFS for storage, File System Access for user interaction

### Entry Kinds

Every file system entry is either a file or directory:

```typescript
type EntryKind = 'file' | 'directory'
```

### Method Semantics

The library follows consistent patterns for data access, matching the IndexedDB wrapper:

| Method                  | Missing Entry            | Use Case                        |
|-------------------------|--------------------------|---------------------------------|
| `getFile()`             | Returns `undefined`      | Optional lookup, check result   |
| `resolveFile()`         | Throws `NotFoundError`   | Must exist, handle error        |
| `createFile()`          | Creates new file         | Always creates (overwrites)     |
| `getDirectory()`        | Returns `undefined`      | Optional lookup, check result   |
| `resolveDirectory()`    | Throws `NotFoundError`   | Must exist, handle error        |
| `createDirectory()`     | Creates new directory    | Always creates if not exists    |
| `removeFile()`          | Throws `NotFoundError`   | Delete file, must exist         |
| `removeDirectory()`     | Throws `NotFoundError`   | Delete directory, must exist    |

### Storage Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    FileSystemInterface                       │
├─────────────────────────────────────────────────────────────┤
│  getRoot()              → OPFS (universal support)          │
│  showOpenFilePicker()   → File System Access (Chromium)     │
│  fromDataTransferItem() → Entries API fallback              │
│  fromFile()             → File API (input elements)         │
└─────────────────────────────────────────────────────────────┘
```

---

## Storage Adapters

The library supports pluggable storage backends through the adapter pattern. This allows you to swap storage implementations without changing your application code.

### Built-in Adapters

| Adapter           | Description                          | Use Case                          |
|-------------------|--------------------------------------|-----------------------------------|
| `OPFSAdapter`     | Origin Private File System (default) | Production, persistent storage    |
| `InMemoryAdapter` | In-memory Map storage                | Testing, temporary data           |
| `IndexedDBAdapter`| IndexedDB-based storage              | Fallback when OPFS unavailable    |

### Using Adapters

```typescript
import { createFileSystem, InMemoryAdapter, OPFSAdapter } from '@mikesaintsg/filesystem'

// Default: Uses OPFS (OPFSAdapter)
const fs = await createFileSystem()

// Explicit OPFS adapter
const opfsFS = await createFileSystem({ adapter: new OPFSAdapter() })

// In-memory adapter (great for testing)
const memFS = await createFileSystem({ adapter: new InMemoryAdapter() })

// Same API regardless of adapter
const root = await fs.getRoot()
const file = await root.createFile('config.json')
await file.write('{"version": 1}')
```

### InMemoryAdapter

Perfect for unit testing and temporary data that doesn't need to persist:

```typescript
import { InMemoryAdapter } from '@mikesaintsg/filesystem'

// Direct adapter usage (low-level)
const adapter = new InMemoryAdapter()
await adapter.init()

// Write directly
await adapter.writeFile('/config.json', '{"debug": true}')
const content = await adapter.getFileText('/config.json')

// Create directories
await adapter.createDirectory('/data')
await adapter.writeFile('/data/cache.json', '[]')

// List entries
const entries = await adapter.listEntries('/data')

// Clean up
adapter.close()
```

### Adapter Availability Check

```typescript
const adapter = new OPFSAdapter()

if (await adapter.isAvailable()) {
	await adapter.init()
	// Use adapter
} else {
	// Fall back to InMemoryAdapter
	const fallback = new InMemoryAdapter()
	await fallback.init()
}
```

### Automatic Fallback Pattern

```typescript
import { createFileSystem, OPFSAdapter, InMemoryAdapter } from '@mikesaintsg/filesystem'

async function initFileSystem() {
	const opfs = new OPFSAdapter()
	
	if (await opfs.isAvailable()) {
		return createFileSystem({ adapter: opfs })
	}
	
	console.log('OPFS unavailable, using in-memory storage')
	return createFileSystem({ adapter: new InMemoryAdapter() })
}

const fs = await initFileSystem()
```

---

## File System Operations

### Creating the File System Interface

```typescript
import { createFileSystem } from '@mikesaintsg/filesystem'

const fs = await createFileSystem()
```

### getRoot() — OPFS Access

Get the root directory of the Origin Private File System:

```typescript
const root = await fs.getRoot()

// Root is a DirectoryInterface
const file = await root.createFile('app-data.json')
await file.write(JSON.stringify({ version: 1 }))
```

### getQuota() — Storage Information

```typescript
const quota = await fs.getQuota()

console.log(`Usage: ${quota.usage} bytes`)
console.log(`Quota: ${quota.quota} bytes`)
console.log(`Available: ${quota.available} bytes`)
console.log(`Used: ${quota.percentUsed.toFixed(1)}%`)
```

### isUserAccessSupported() — Feature Detection

Check if File System Access API picker dialogs are available:

```typescript
if (fs.isUserAccessSupported()) {
	// Safe to use showOpenFilePicker, showSaveFilePicker, showDirectoryPicker
	const files = await fs.showOpenFilePicker()
} else {
	// Fall back to <input type="file"> or drag-drop
	console.log('File pickers not available in this browser')
}
```

---

## File Operations

Access files through `DirectoryInterface.getFile()`, `DirectoryInterface.createFile()`, or picker dialogs.

### Reading Files

```typescript
// Get text content
const text = await file.getText()

// Get binary content
const buffer = await file.getArrayBuffer()

// Get as Blob
const blob = await file.getBlob()

// Get as readable stream (for large files)
const stream = file.getStream()
const reader = stream.getReader()
while (true) {
	const { done, value } = await reader.read()
	if (done) break
	processChunk(value)
}
```

### Writing Files

Writing is atomic by default—content is written to a temp file and swapped on completion:

```typescript
// Write string
await file.write('Hello, World!')

// Write binary data
await file.write(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]))

// Write Blob
await file.write(new Blob(['Hello'], { type: 'text/plain' }))

// Write at specific position
await file.write('Inserted', { position: 10 })

// Keep existing data when writing at position
await file.write('Patch', { position: 5, keepExistingData: true })
```

### Appending to Files

```typescript
// Append to end of file
await file.append(' - Appended text')

// Append binary data
await file.append(new Uint8Array([0x0A, 0x0A])) // Two newlines
```

### Truncating Files

```typescript
// Truncate to specific size
await file.truncate(100) // File is now exactly 100 bytes

// Empty the file
await file.truncate(0)
```

### File Metadata

```typescript
const name = file.getName() // 'document.txt'

const metadata = await file.getMetadata()
console.log(metadata.name)         // 'document.txt'
console.log(metadata.size)         // 1024
console.log(metadata.type)         // 'text/plain'
console.log(metadata.lastModified) // 1704067200000 (timestamp)
```

### Permissions

```typescript
// Check current permissions
const canRead = await file.hasReadPermission()
const canWrite = await file.hasWritePermission()

// Request write permission (shows prompt to user)
const granted = await file.requestWritePermission()
if (granted) {
	await file.write('Now I can write!')
}
```

### Comparing Files

```typescript
// Check if two handles point to the same file
const isSame = await file1.isSameEntry(file2)
```

---

## Directory Operations

Access directories through `fs.getRoot()`, picker dialogs, or from other directories.

### Getting and Creating Files

```typescript
// Get file (returns undefined if not found)
const file = await directory.getFile('config.json')
if (file) {
	const config = JSON.parse(await file.getText())
}

// Resolve file (throws NotFoundError if not found)
try {
	const file = await directory.resolveFile('required.txt')
	console.log(await file.getText())
} catch (error) {
	if (error instanceof NotFoundError) {
		console.log('File does not exist')
	}
}

// Create file (always creates, overwrites if exists)
const file = await directory.createFile('new-file.txt')
await file.write('Initial content')

// Check if file exists
const exists = await directory.hasFile('maybe.txt')
```

### Getting and Creating Directories

```typescript
// Get subdirectory (returns undefined if not found)
const subdir = await directory.getDirectory('cache')

// Resolve subdirectory (throws NotFoundError if not found)
const subdir = await directory.resolveDirectory('must-exist')

// Create subdirectory (creates if not exists)
const subdir = await directory.createDirectory('new-folder')

// Check if directory exists
const exists = await directory.hasDirectory('maybe-folder')
```

### Removing Entries

```typescript
// Remove a file
await directory.removeFile('old-file.txt')

// Remove an empty directory
await directory.removeDirectory('empty-folder')

// Remove a directory with contents
await directory.removeDirectory('full-folder', { recursive: true })
```

### Path-Based Operations

Create nested directories like `mkdir -p`:

```typescript
// Create path: data/cache/images (creates all intermediate directories)
const imagesDir = await root.createPath('data', 'cache', 'images')

// Resolve path to file or directory
const entry = await root.resolvePath('data', 'cache', 'settings.json')
if (entry && entry.kind === 'file') {
	const file = entry as FileInterface
	console.log(await file.getText())
}
```

### Directory Name

```typescript
const name = directory.getName() // 'my-folder'
```

### Comparing Directories

```typescript
// Check if two handles point to the same directory
const isSame = await dir1.isSameEntry(dir2)

// Get relative path from ancestor to descendant
const path = await parentDir.resolve(childFile)
// path: ['subdir', 'nested', 'file.txt'] or null if not a descendant
```

---

## Convenience Methods

Common file operations made simple with `copyFile()` and `moveFile()`.

### copyFile() — Copy a File

Copy a file within a directory or to another directory:

```typescript
// Copy to a new name in the same directory
const copy = await directory.copyFile('original.txt', 'backup.txt')

// Copy to another directory (keeps original name)
const archive = await root.createDirectory('archive')
const archived = await directory.copyFile('report.txt', archive)

// Copy with overwrite option
await directory.copyFile('source.txt', 'existing.txt', { overwrite: true })
```

### moveFile() — Move/Rename a File

Move a file to a new name or another directory:

```typescript
// Rename a file (same directory)
await directory.moveFile('old-name.txt', 'new-name.txt')

// Move to another directory (keeps original name)
const trash = await root.createDirectory('trash')
await directory.moveFile('delete-me.txt', trash)

// Move with overwrite option
await directory.moveFile('source.txt', 'existing.txt', { overwrite: true })
```

### Copy vs Move

| Operation  | Source File | Returns            |
|------------|-------------|-------------------|
| `copyFile` | Preserved   | New `FileInterface` |
| `moveFile` | Deleted     | Moved `FileInterface` |

---

## Export & Import

Migrate data between file systems or create backups with `export()` and `import()`.

### Exporting a File System

```typescript
// Export entire file system
const exported = await fs.export()

console.log(`Exported ${exported.entries.length} entries`)
console.log(`Exported at: ${new Date(exported.exportedAt).toISOString()}`)

// Export specific paths only
const partial = await fs.export({
	includePaths: ['/data', '/config']
})

// Exclude certain paths
const filtered = await fs.export({
	excludePaths: ['/temp', '/cache']
})
```

### Importing Data

```typescript
// Import from exported data
await fs.import(exported)

// Merge behaviors
await fs.import(exported, { mergeBehavior: 'replace' })  // Overwrite existing (default)
await fs.import(exported, { mergeBehavior: 'skip' })     // Keep existing files
```

### Migration Between Adapters

```typescript
import { createFileSystem, OPFSAdapter, InMemoryAdapter } from '@mikesaintsg/filesystem'

// Export from OPFS
const opfsFS = await createFileSystem({ adapter: new OPFSAdapter() })
const backup = await opfsFS.export()
opfsFS.close()

// Import to InMemory for testing
const memFS = await createFileSystem({ adapter: new InMemoryAdapter() })
await memFS.import(backup)

// Now memFS has all the same data
const root = await memFS.getRoot()
const files = await root.listFiles()
```

### Exported Data Format

```typescript
interface ExportedFileSystem {
	readonly version: number              // Export format version
	readonly exportedAt: number           // Timestamp (Date.now())
	readonly entries: readonly ExportedEntry[]  // All entries
}

interface ExportedEntry {
	readonly path: string                 // Full path
	readonly name: string                 // Entry name
	readonly kind: 'file' | 'directory'
	readonly content?: ArrayBuffer        // File content (files only)
	readonly lastModified?: number        // Timestamp (files only)
}
```

---

## Writable Streams

For large files or streaming writes, use the writable stream interface:

### Opening a Writable

```typescript
const writable = await file.openWritable()

try {
	// Write in chunks
	await writable.write('First chunk')
	await writable.write('Second chunk')
	await writable.write(new Uint8Array([0x0A]))

	// Seek to position
	await writable.seek(0)
	await writable.write('Overwrite beginning')

	// Resize file
	await writable.truncate(1000)

	// Commit changes
	await writable.close()
} catch (error) {
	// Abort on error (discards changes)
	await writable.abort()
	throw error
}
```

### Writable Stream Methods

| Method           | Description                              |
|------------------|------------------------------------------|
| `write(data)`    | Write data at current position           |
| `seek(position)` | Move cursor to byte position             |
| `truncate(size)` | Resize file to specified bytes           |
| `close()`        | Commit changes and close stream          |
| `abort()`        | Discard changes and close stream         |

### Write Data Types

The `write()` method accepts multiple data types:

```typescript
await writable.write('String content')
await writable.write(new ArrayBuffer(1024))
await writable.write(new Uint8Array([1, 2, 3]))
await writable.write(new Blob(['blob content']))
await writable.write(readableStream)
```

---

## Sync Access (Workers)

For high-performance file operations in Web Workers, use synchronous access handles:

### Creating a Sync Access Handle

```typescript
// In a Web Worker only
const root = await navigator.storage.getDirectory()
const fileHandle = await root.getFileHandle('database.sqlite', { create: true })
const syncHandle = await fileHandle.createSyncAccessHandle()

try {
	// Read entire file
	const size = syncHandle.getSize()
	const buffer = new ArrayBuffer(size)
	const view = new DataView(buffer)
	syncHandle.read(view, { at: 0 })

	// Write data
	const encoder = new TextEncoder()
	const data = encoder.encode('Hello, sync!')
	syncHandle.write(data, { at: 0 })

	// Resize file
	syncHandle.truncate(1024)

	// Ensure changes are persisted
	syncHandle.flush()
} finally {
	// Always close to release lock
	syncHandle.close()
}
```

### Sync Access Handle Interface

```typescript
interface SyncAccessHandleInterface {
	/** Native sync access handle */
	readonly native: FileSystemSyncAccessHandle

	// Accessors
	getSize(): number

	// Reading
	read(buffer: ArrayBufferView, options?: { at?: number }): number

	// Writing
	write(buffer: ArrayBufferView, options?: { at?: number }): number
	truncate(newSize: number): void
	flush(): void

	// Lifecycle
	close(): void
}
```

### When to Use Sync Access

| Use Case                     | Recommended Access   |
|------------------------------|----------------------|
| General file I/O             | Async (FileInterface)|
| SQLite/database files        | Sync in Worker       |
| Large binary file processing | Sync in Worker       |
| UI-triggered file saves      | Async (FileInterface)|
| Background data processing   | Sync in Worker       |

---

## Directory Traversal

### Iterating Entries

```typescript
// Iterate all entries (files and directories)
for await (const entry of directory.entries()) {
	console.log(`${entry.kind}: ${entry.name}`)
	if (entry.kind === 'file') {
		const file = await directory.resolveFile(entry.name)
		console.log(`  Size: ${(await file.getMetadata()).size}`)
	}
}

// Iterate files only
for await (const file of directory.files()) {
	console.log(file.getName())
}

// Iterate directories only
for await (const subdir of directory.directories()) {
	console.log(subdir.getName())
}
```

### Listing Contents

```typescript
// Get all entries as array
const entries = await directory.list()

// Get all files as array
const files = await directory.listFiles()

// Get all directories as array
const subdirs = await directory.listDirectories()
```

### Recursive Walking

```typescript
// Walk all entries recursively
for await (const { path, entry, depth } of directory.walk()) {
	const fullPath = [...path, entry.name].join('/')
	console.log(`${'  '.repeat(depth)}${entry.kind}: ${fullPath}`)
}

// Walk with options
for await (const { path, entry } of directory.walk({
	maxDepth: 3,
	includeFiles: true,
	includeDirectories: false,
	filter: (entry, depth) => !entry.name.startsWith('.')
})) {
	console.log(entry.name)
}
```

### Walk Options

| Option                | Type                                  | Default | Description                    |
|-----------------------|---------------------------------------|---------|--------------------------------|
| `maxDepth`            | `number`                              | ∞       | Maximum recursion depth        |
| `includeFiles`        | `boolean`                             | `true`  | Include files in results       |
| `includeDirectories`  | `boolean`                             | `true`  | Include directories in results |
| `filter`              | `(entry, depth) => boolean`           | —       | Filter function                |

---

## Picker Dialogs

File System Access API pickers are available in Chromium browsers only.

### Open File Picker

```typescript
if (fs.isUserAccessSupported()) {
	// Open single file
	const [file] = await fs.showOpenFilePicker()
	console.log(await file.getText())

	// Open multiple files
	const files = await fs.showOpenFilePicker({ multiple: true })
	for (const file of files) {
		console.log(file.getName())
	}

	// Filter by file type
	const images = await fs.showOpenFilePicker({
		types: [
			{
				description: 'Images',
				accept: {
					'image/*': ['.png', '.jpg', '.gif', '.webp']
				}
			}
		]
	})
}
```

### Save File Picker

```typescript
if (fs.isUserAccessSupported()) {
	const file = await fs.showSaveFilePicker({
		suggestedName: 'document.txt',
		types: [
			{
				description: 'Text Files',
				accept: { 'text/plain': ['.txt'] }
			}
		]
	})

	await file.write('Content to save')
}
```

### Directory Picker

```typescript
if (fs.isUserAccessSupported()) {
	// Read-only access
	const dir = await fs.showDirectoryPicker()

	// Read-write access
	const dir = await fs.showDirectoryPicker({ mode: 'readwrite' })

	// Start in specific location
	const dir = await fs.showDirectoryPicker({ startIn: 'documents' })
}
```

### Picker Options

#### OpenFilePickerOptions

| Option                   | Type                          | Description                        |
|--------------------------|-------------------------------|------------------------------------|
| `multiple`               | `boolean`                     | Allow multiple file selection      |
| `excludeAcceptAllOption` | `boolean`                     | Hide "All Files" filter option     |
| `types`                  | `FilePickerAcceptType[]`      | File type filters                  |
| `id`                     | `string`                      | Remember picker location by ID     |
| `startIn`                | `StartInDirectory`            | Initial directory                  |

#### SaveFilePickerOptions

| Option                   | Type                          | Description                        |
|--------------------------|-------------------------------|------------------------------------|
| `suggestedName`          | `string`                      | Default file name                  |
| `excludeAcceptAllOption` | `boolean`                     | Hide "All Files" filter option     |
| `types`                  | `FilePickerAcceptType[]`      | File type filters                  |
| `id`                     | `string`                      | Remember picker location by ID     |
| `startIn`                | `StartInDirectory`            | Initial directory                  |

#### DirectoryPickerOptions

| Option    | Type                       | Description                           |
|-----------|----------------------------|---------------------------------------|
| `id`      | `string`                   | Remember picker location by ID        |
| `startIn` | `StartInDirectory`         | Initial directory                     |
| `mode`    | `'read' \| 'readwrite'`    | Permission mode                       |

#### StartInDirectory

```typescript
type StartInDirectory =
	| 'desktop'
	| 'documents'
	| 'downloads'
	| 'music'
	| 'pictures'
	| 'videos'
	| FileSystemHandle
```

---

## Drag & Drop Integration

### From DataTransferItem

```typescript
dropZone.addEventListener('drop', async (event) => {
	event.preventDefault()

	const items = event.dataTransfer?.items
	if (!items) return

	const entries = await fs.fromDataTransferItems(items)

	for (const entry of entries) {
		if (entry.kind === 'file') {
			const file = entry as FileInterface
			console.log(`File: ${file.getName()}`)
		} else {
			const dir = entry as DirectoryInterface
			console.log(`Directory: ${dir.getName()}`)
			for await (const child of dir.entries()) {
				console.log(`  ${child.name}`)
			}
		}
	}
})

// Single item
const entry = await fs.fromDataTransferItem(items[0])
```

### From File Input

```typescript
const input = document.querySelector<HTMLInputElement>('input[type="file"]')

input.addEventListener('change', async () => {
	const files = input.files
	if (!files) return

	// Convert FileList to FileInterface array
	const fileInterfaces = await fs.fromFiles(files)

	for (const file of fileInterfaces) {
		console.log(file.getName())
		console.log(await file.getText())
	}
})

// Single file
const file = await fs.fromFile(input.files[0])
```

---

## Error Handling

### Error Classes

The library provides typed error classes for different failure modes:

```typescript
import {
	FileSystemError,
	NotFoundError,
	NotAllowedError,
	TypeMismatchError,
	QuotaExceededError,
	AbortError,
	SecurityError
} from '@mikesaintsg/filesystem'
```

### Error Hierarchy

| Error Class           | Code                      | When Thrown                           |
|-----------------------|---------------------------|---------------------------------------|
| `FileSystemError`     | Various                   | Base class for all errors             |
| `NotFoundError`       | `'NOT_FOUND'`             | Entry does not exist                  |
| `NotAllowedError`     | `'NOT_ALLOWED'`           | Permission denied                     |
| `TypeMismatchError`   | `'TYPE_MISMATCH'`         | Expected file but got directory       |
| `QuotaExceededError`  | `'QUOTA_EXCEEDED'`        | Storage limit reached                 |
| `AbortError`          | `'ABORT'`                 | User cancelled picker dialog          |
| `SecurityError`       | `'SECURITY'`              | Security restriction violated         |

### Error Codes

```typescript
type FileSystemErrorCode =
	| 'NOT_FOUND'
	| 'NOT_ALLOWED'
	| 'TYPE_MISMATCH'
	| 'NO_MODIFICATION_ALLOWED'
	| 'INVALID_STATE'
	| 'QUOTA_EXCEEDED'
	| 'ABORT'
	| 'SECURITY'
	| 'ENCODING'
	| 'NOT_SUPPORTED'
```

### Handling Errors

```typescript
// NotFoundError - entry does not exist
try {
	const file = await directory.resolveFile('missing.txt')
} catch (error) {
	if (error instanceof NotFoundError) {
		console.log(`File not found: ${error.path}`)
	}
}

// NotAllowedError - permission denied
try {
	await file.write('content')
} catch (error) {
	if (error instanceof NotAllowedError) {
		const granted = await file.requestWritePermission()
		if (granted) {
			await file.write('content')
		}
	}
}

// QuotaExceededError - storage full
try {
	await file.write(largeContent)
} catch (error) {
	if (error instanceof QuotaExceededError) {
		showStorageFullMessage()
	}
}

// AbortError - user cancelled picker
try {
	const files = await fs.showOpenFilePicker()
} catch (error) {
	if (error instanceof AbortError) {
		// User cancelled, not an error
		return
	}
	throw error
}

// Generic error handling
try {
	await someOperation()
} catch (error) {
	if (error instanceof FileSystemError) {
		console.log(`Error [${error.code}]: ${error.message}`)
		if (error.path) {
			console.log(`Path: ${error.path}`)
		}
	}
}
```

### Type Guards

```typescript
import {
	isNotFoundError,
	isNotAllowedError,
	isFileSystemError
} from '@mikesaintsg/filesystem'

try {
	await directory.resolveFile('file.txt')
} catch (error) {
	if (isNotFoundError(error)) {
		// error is typed as NotFoundError
	} else if (isFileSystemError(error)) {
		// error is typed as FileSystemError
	}
}
```

---

## Native Access

Every wrapper exposes its underlying native browser handle via the `.native` property:

### File

```typescript
const nativeHandle: FileSystemFileHandle = file.native

// Use native APIs
const nativeFile = await nativeHandle.getFile()
console.log(nativeFile.name, nativeFile.size)
```

### Directory

```typescript
const nativeHandle: FileSystemDirectoryHandle = directory.native

// Use native APIs
for await (const [name, handle] of nativeHandle.entries()) {
	console.log(name, handle.kind)
}
```

### Writable Stream

```typescript
const nativeStream: FileSystemWritableFileStream = writable.native

// Use native APIs
await nativeStream.write({ type: 'seek', position: 0 })
```

### Creating from Native Handles

```typescript
import { fromFileHandle, fromDirectoryHandle } from '@mikesaintsg/filesystem'

// From native file handle
const nativeFileHandle = await showOpenFilePicker().then(h => h[0])
const file = fromFileHandle(nativeFileHandle)

// From native directory handle
const nativeDirHandle = await navigator.storage.getDirectory()
const directory = fromDirectoryHandle(nativeDirHandle)
```

### When to Use Native Access

Use native access when you need:

- Features not exposed by the wrapper
- Maximum performance for specific operations
- Compatibility with other file system libraries
- Debugging with browser DevTools

---

## TypeScript Integration

### Strict Typing

The library is designed with TypeScript strict mode:

```typescript
// No `any` types
// No `!` non-null assertions
// No unsafe `as` casts

// Use type guards for narrowing
const entry = await directory.resolvePath('data', 'file.txt')
if (entry && entry.kind === 'file') {
	// entry is narrowed, but cast explicitly for FileInterface methods
	const file = entry as FileInterface
	console.log(await file.getText())
}
```

### Readonly by Default

Return types use `readonly` for immutability:

```typescript
// Arrays are readonly
const entries = await directory.list()
// entries: readonly DirectoryEntry[]

const path = await parent.resolve(child)
// path: readonly string[] | null

// Attempting to mutate is a compile error
entries.push(newEntry) // Error: Property 'push' does not exist
```

### Interface Pattern

Following the naming conventions from copilot-instructions.md:

```typescript
// Behavioral interfaces use Interface suffix
interface FileInterface { /* ... */ }
interface DirectoryInterface { /* ... */ }
interface FileSystemInterface { /* ... */ }
interface WritableFileInterface { /* ... */ }
interface SyncAccessHandleInterface { /* ... */ }

// Data-only interfaces have no suffix
interface FileMetadata { /* ... */ }
interface DirectoryEntry { /* ... */ }
interface StorageQuota { /* ... */ }
interface WalkEntry { /* ... */ }
interface WalkOptions { /* ... */ }
```

### Entry Kind Discrimination

```typescript
interface DirectoryEntry {
	readonly name: string
	readonly kind: EntryKind
	readonly handle: FileSystemHandle
}

// Use kind to discriminate
for await (const entry of directory.entries()) {
	switch (entry.kind) {
		case 'file':
			// Handle file
			break
		case 'directory':
			// Handle directory
			break
	}
}
```

---

## Performance Tips

### 1. Use Async Generators for Large Directories

```typescript
// ✅ Memory efficient: process one at a time
for await (const entry of directory.entries()) {
	processEntry(entry)
	if (shouldStop) break
}

// ❌ Memory heavy: loads all entries
const entries = await directory.list()
for (const entry of entries) {
	processEntry(entry)
}
```

### 2. Use Streams for Large Files

```typescript
// ✅ Memory efficient: stream processing
const stream = file.getStream()
const reader = stream.getReader()
while (true) {
	const { done, value } = await reader.read()
	if (done) break
	processChunk(value)
}

// ❌ Memory heavy: load entire file
const buffer = await file.getArrayBuffer()
processBuffer(buffer)
```

### 3. Use Sync Access in Workers for High-Throughput

```typescript
// ✅ Fast: synchronous operations in Worker
const syncHandle = await fileHandle.createSyncAccessHandle()
syncHandle.write(data, { at: offset })
syncHandle.flush()
syncHandle.close()

// ❌ Slower: async operations with overhead
const writable = await file.openWritable()
await writable.seek(offset)
await writable.write(data)
await writable.close()
```

### 4. Batch Path Creation

```typescript
// ✅ Efficient: single createPath call
const deep = await root.createPath('a', 'b', 'c', 'd', 'e')

// ❌ Inefficient: multiple separate calls
let dir = await root.createDirectory('a')
dir = await dir.createDirectory('b')
dir = await dir.createDirectory('c')
dir = await dir.createDirectory('d')
dir = await dir.createDirectory('e')
```

### 5. Use Existence Checks Before Operations

```typescript
// ✅ Check first, then act
if (await directory.hasFile('config.json')) {
	const file = await directory.resolveFile('config.json')
	// Process file
} else {
	// Handle missing file
}

// ❌ Try/catch for control flow
try {
	const file = await directory.resolveFile('config.json')
	// Process file
} catch {
	// Handle missing file
}
```

### 6. Limit Recursive Walks

```typescript
// ✅ Limited depth
for await (const entry of directory.walk({ maxDepth: 3 })) {
	processEntry(entry)
}

// ❌ Unlimited recursion on large trees
for await (const entry of directory.walk()) {
	processEntry(entry)
}
```

### 7. Use Filter in Walk

```typescript
// ✅ Filter at source
for await (const entry of directory.walk({
	filter: (e) => !e.name.startsWith('.') && e.name !== 'node_modules'
})) {
	processEntry(entry)
}

// ❌ Filter after iteration
for await (const entry of directory.walk()) {
	if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
		processEntry(entry)
	}
}
```

---

## Browser Compatibility

### Feature Detection

```typescript
import { createFileSystem } from '@mikesaintsg/filesystem'

const fs = await createFileSystem()

// OPFS support (all modern browsers)
const hasOPFS = typeof navigator?.storage?.getDirectory === 'function'

// File System Access API (Chromium only)
const hasUserAccess = fs.isUserAccessSupported()

// Sync access handles (Workers only)
const hasSyncAccess = typeof FileSystemSyncAccessHandle !== 'undefined'
```

### Browser Support Matrix

| Feature                      | Chrome | Edge   | Safari | Firefox |
|------------------------------|--------|--------|--------|---------|
| OPFS (`getDirectory`)        | 86+    | 86+    | 15.2+  | 111+    |
| `FileSystemSyncAccessHandle` | 102+   | 102+   | 15.2+  | 111+    |
| `showOpenFilePicker`         | 86+    | 86+    | ❌     | ❌      |
| `showSaveFilePicker`         | 86+    | 86+    | ❌     | ❌      |
| `showDirectoryPicker`        | 86+    | 86+    | ❌     | ❌      |
| `createWritable`             | 86+    | 86+    | ❌     | ❌      |

### Graceful Degradation

| Feature          | Chromium | Safari | Firefox | Fallback              |
|------------------|----------|--------|---------|------------------------|
| OPFS             | ✅       | ✅     | ✅      | None needed            |
| File pickers     | ✅       | ❌     | ❌      | `<input type="file">` |
| Save picker      | ✅       | ❌     | ❌      | Download blob          |
| Directory picker | ✅       | ❌     | ❌      | Drag-drop only         |
| Sync access      | ✅       | ✅     | ✅      | Async only             |

### Fallback Pattern

```typescript
async function openFile(): Promise<FileInterface | undefined> {
	const fs = await createFileSystem()

	if (fs.isUserAccessSupported()) {
		// Use native picker
		try {
			const [file] = await fs.showOpenFilePicker()
			return file
		} catch (error) {
			if (error instanceof AbortError) {
				return undefined // User cancelled
			}
			throw error
		}
	} else {
		// Fall back to input element
		return new Promise((resolve) => {
			const input = document.createElement('input')
			input.type = 'file'
			input.onchange = async () => {
				if (input.files?.[0]) {
					resolve(await fs.fromFile(input.files[0]))
				} else {
					resolve(undefined)
				}
			}
			input.click()
		})
	}
}
```

---

## API Reference

### Factory Functions

#### createFileSystem(): Promise\<FileSystemInterface\>

Creates a file system interface.

**Returns:** Promise resolving to FileSystemInterface

---

#### fromFileHandle(handle: FileSystemFileHandle): FileInterface

Creates a file interface from a native handle.

**Parameters:**
- `handle` - Native FileSystemFileHandle

**Returns:** FileInterface

---

#### fromDirectoryHandle(handle: FileSystemDirectoryHandle): DirectoryInterface

Creates a directory interface from a native handle.

**Parameters:**
- `handle` - Native FileSystemDirectoryHandle

**Returns:** DirectoryInterface

---

### FileSystemInterface

#### Methods

| Method                         | Returns                                           | Description                    |
|--------------------------------|---------------------------------------------------|--------------------------------|
| `getRoot()`                    | `Promise<DirectoryInterface>`                     | Get OPFS root directory        |
| `getQuota()`                   | `Promise<StorageQuota>`                           | Get storage quota info         |
| `isUserAccessSupported()`      | `boolean`                                         | Check picker support           |
| `showOpenFilePicker(options?)` | `Promise<readonly FileInterface[]>`               | Open file picker dialog        |
| `showSaveFilePicker(options?)` | `Promise<FileInterface>`                          | Save file picker dialog        |
| `showDirectoryPicker(options?)`| `Promise<DirectoryInterface>`                     | Directory picker dialog        |
| `fromDataTransferItem(item)`   | `Promise<FileInterface \| DirectoryInterface \| null>` | From drag-drop item      |
| `fromDataTransferItems(items)` | `Promise<readonly (FileInterface \| DirectoryInterface)[]>` | From drag-drop items |
| `fromFile(file)`               | `Promise<FileInterface>`                          | From File API                  |
| `fromFiles(files)`             | `Promise<readonly FileInterface[]>`               | From FileList                  |

---

### FileInterface

#### Properties

| Property | Type                    | Description           |
|----------|-------------------------|-----------------------|
| `native` | `FileSystemFileHandle`  | Native file handle    |

#### Methods

| Method                    | Returns                      | Description                    |
|---------------------------|------------------------------|--------------------------------|
| `getName()`               | `string`                     | File name                      |
| `getMetadata()`           | `Promise<FileMetadata>`      | File metadata                  |
| `getText()`               | `Promise<string>`            | Read as text                   |
| `getArrayBuffer()`        | `Promise<ArrayBuffer>`       | Read as binary                 |
| `getBlob()`               | `Promise<Blob>`              | Read as Blob                   |
| `getStream()`             | `ReadableStream<Uint8Array>` | Read as stream                 |
| `write(data, options?)`   | `Promise<void>`              | Write data (atomic)            |
| `append(data)`            | `Promise<void>`              | Append data                    |
| `truncate(size)`          | `Promise<void>`              | Resize file                    |
| `openWritable()`          | `Promise<WritableFileInterface>` | Open writable stream       |
| `hasReadPermission()`     | `Promise<boolean>`           | Check read permission          |
| `hasWritePermission()`    | `Promise<boolean>`           | Check write permission         |
| `requestWritePermission()`| `Promise<boolean>`           | Request write permission       |
| `isSameEntry(other)`      | `Promise<boolean>`           | Compare with another file      |

---

### DirectoryInterface

#### Properties

| Property | Type                         | Description              |
|----------|------------------------------|--------------------------|
| `native` | `FileSystemDirectoryHandle`  | Native directory handle  |

#### Methods

| Method                              | Returns                                            | Description                    |
|-------------------------------------|----------------------------------------------------|--------------------------------|
| `getName()`                         | `string`                                           | Directory name                 |
| `getFile(name)`                     | `Promise<FileInterface \| undefined>`              | Get file by name               |
| `resolveFile(name)`                 | `Promise<FileInterface>`                           | Get file or throw              |
| `createFile(name)`                  | `Promise<FileInterface>`                           | Create/overwrite file          |
| `hasFile(name)`                     | `Promise<boolean>`                                 | Check file exists              |
| `removeFile(name)`                  | `Promise<void>`                                    | Remove file                    |
| `getDirectory(name)`                | `Promise<DirectoryInterface \| undefined>`         | Get directory by name          |
| `resolveDirectory(name)`            | `Promise<DirectoryInterface>`                      | Get directory or throw         |
| `createDirectory(name)`             | `Promise<DirectoryInterface>`                      | Create directory               |
| `hasDirectory(name)`                | `Promise<boolean>`                                 | Check directory exists         |
| `removeDirectory(name, options?)`   | `Promise<void>`                                    | Remove directory               |
| `resolvePath(...segments)`          | `Promise<FileInterface \| DirectoryInterface \| undefined>` | Resolve path           |
| `createPath(...segments)`           | `Promise<DirectoryInterface>`                      | Create nested directories      |
| `entries()`                         | `AsyncIterable<DirectoryEntry>`                    | Iterate all entries            |
| `files()`                           | `AsyncIterable<FileInterface>`                     | Iterate files                  |
| `directories()`                     | `AsyncIterable<DirectoryInterface>`                | Iterate directories            |
| `list()`                            | `Promise<readonly DirectoryEntry[]>`               | List all entries               |
| `listFiles()`                       | `Promise<readonly FileInterface[]>`                | List files                     |
| `listDirectories()`                 | `Promise<readonly DirectoryInterface[]>`           | List directories               |
| `walk(options?)`                    | `AsyncIterable<WalkEntry>`                         | Recursive traversal            |
| `hasReadPermission()`               | `Promise<boolean>`                                 | Check read permission          |
| `hasWritePermission()`              | `Promise<boolean>`                                 | Check write permission         |
| `requestWritePermission()`          | `Promise<boolean>`                                 | Request write permission       |
| `isSameEntry(other)`                | `Promise<boolean>`                                 | Compare with another directory |
| `resolve(descendant)`               | `Promise<readonly string[] \| null>`               | Get relative path              |

---

### WritableFileInterface

#### Properties

| Property | Type                            | Description              |
|----------|---------------------------------|--------------------------|
| `native` | `FileSystemWritableFileStream`  | Native writable stream   |

#### Methods

| Method           | Returns          | Description                    |
|------------------|------------------|--------------------------------|
| `write(data)`    | `Promise<void>`  | Write at current position      |
| `seek(position)` | `Promise<void>`  | Move cursor                    |
| `truncate(size)` | `Promise<void>`  | Resize file                    |
| `close()`        | `Promise<void>`  | Commit and close               |
| `abort()`        | `Promise<void>`  | Discard and close              |

---

### SyncAccessHandleInterface

#### Properties

| Property | Type                          | Description                    |
|----------|-------------------------------|--------------------------------|
| `native` | `FileSystemSyncAccessHandle`  | Native sync access handle      |

#### Methods

| Method              | Returns   | Description                    |
|---------------------|-----------|--------------------------------|
| `getSize()`         | `number`  | File size in bytes             |
| `read(buffer, opts)`| `number`  | Read bytes, return count       |
| `write(buffer, opts)`| `number` | Write bytes, return count      |
| `truncate(newSize)` | `void`    | Resize file                    |
| `flush()`           | `void`    | Persist changes                |
| `close()`           | `void`    | Release lock                   |

---

### Types

```typescript
/** Entry kind discriminator */
type EntryKind = 'file' | 'directory'

/** File metadata snapshot */
interface FileMetadata {
	readonly name: string
	readonly size: number
	readonly type: string
	readonly lastModified: number
}

/** Directory entry for iteration */
interface DirectoryEntry {
	readonly name: string
	readonly kind: EntryKind
	readonly handle: FileSystemHandle
}

/** Storage quota information */
interface StorageQuota {
	readonly usage: number
	readonly quota: number
	readonly available: number
	readonly percentUsed: number
}

/** Walk entry with path info */
interface WalkEntry {
	readonly path: readonly string[]
	readonly entry: DirectoryEntry
	readonly depth: number
}

/** Walk options */
interface WalkOptions {
	readonly maxDepth?: number
	readonly includeFiles?: boolean
	readonly includeDirectories?: boolean
	readonly filter?: (entry: DirectoryEntry, depth: number) => boolean
}

/** Write operation data types */
type WriteData =
	| string
	| BufferSource
	| Blob
	| ReadableStream<Uint8Array>

/** Write options */
interface WriteOptions {
	readonly position?: number
	readonly keepExistingData?: boolean
}

/** Unsubscribe function type */
type Unsubscribe = () => void
```

---

### Error Types

```typescript
/** Base error class */
interface FileSystemError extends Error {
	readonly code: FileSystemErrorCode
	readonly path?: string
	readonly cause?: Error
}

/** Error code type */
type FileSystemErrorCode =
	| 'NOT_FOUND'
	| 'NOT_ALLOWED'
	| 'TYPE_MISMATCH'
	| 'NO_MODIFICATION_ALLOWED'
	| 'INVALID_STATE'
	| 'QUOTA_EXCEEDED'
	| 'ABORT'
	| 'SECURITY'
	| 'ENCODING'
	| 'NOT_SUPPORTED'
```

---

### Comparison with Node.js fs Module

| Node.js `fs`                       | Browser Wrapper                              | Notes                    |
|------------------------------------|----------------------------------------------|--------------------------|
| `fs.readFile()`                    | `file.getText()` / `file.getArrayBuffer()`   | Async only               |
| `fs.writeFile()`                   | `file.write()`                               | Atomic by default        |
| `fs.appendFile()`                  | `file.append()`                              |                          |
| `fs.readdir()`                     | `directory.list()`                           | Returns entry objects    |
| `fs.mkdir()`                       | `directory.createDirectory()`                |                          |
| `fs.mkdir(p, { recursive: true })` | `directory.createPath()`                     |                          |
| `fs.rm()`                          | `directory.removeFile/Directory()`           |                          |
| `fs.stat()`                        | `file.getMetadata()`                         |                          |
| `fs.existsSync()`                  | `directory.hasFile/Directory()`              | Always async             |
| `fs.createReadStream()`            | `file.getStream()`                           |                          |
| `fs.createWriteStream()`           | `file.openWritable()`                        |                          |

---

## License

MIT © Mike Garcia
