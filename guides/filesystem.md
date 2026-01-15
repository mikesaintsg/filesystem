# @mikesaintsg/filesystem API Guide

> **Zero-dependency, type-safe File System Access API wrapper with OPFS-first architecture.**

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
22. [License](#license)

---

## Introduction

### Value Proposition

`@mikesaintsg/filesystem` provides a unified API for browser file system operations: 

- **OPFS-first architecture** — Origin Private File System as the primary, native storage mechanism
- **Zero dependencies** — Built entirely on native browser APIs
- **Full TypeScript support** — Type-safe file and directory operations
- **Adapter pattern** — Pluggable storage backends for different environments
- **Migration support** — Export/import for seamless adapter transitions
- **Escape hatches** — Access native handles when needed

### API Landscape

| API | Purpose | Browser Support | Primary Use |
|-----|---------|-----------------|-------------|
| **OPFS** | Private file storage | All modern browsers | ✅ Primary |
| **File System Access API** | User file access | Chromium only | Fallback/User files |
| **File API** | Read-only file access | All browsers | Input handling |
| **Drag & Drop** | File drop handling | All browsers | User interaction |

### When to Use filesystem vs Other Packages

| Use Case | Recommendation |
|----------|----------------|
| Large binary files (> 1MB) | ✅ Use filesystem (OPFS) |
| Streaming read/write | ✅ Use filesystem |
| File-like operations (seek, truncate) | ✅ Use filesystem |
| High-performance I/O in Workers | ✅ Use filesystem (Sync Access) |
| User-selected files | ✅ Use filesystem (pickers/drag-drop) |
| Structured data with queries | Use `@mikesaintsg/indexeddb` |
| Simple key-value storage | Use `@mikesaintsg/storage` |
| Small blobs with metadata queries | Use indexeddb |
| Blobs < 1MB with relationships | Use indexeddb |

---

## Installation

```bash
npm install @mikesaintsg/filesystem
```

---

## Quick Start

```ts
import { createFileSystem } from '@mikesaintsg/filesystem'

// Create file system (uses OPFS by default)
const fs = await createFileSystem()

// Get OPFS root directory
const root = await fs.getRoot()

// Create a file
const file = await root. createFile('hello.txt')
await file.write('Hello, World!')

// Read the file
const content = await file. getText()
console.log(content) // 'Hello, World!'

// Create nested directories
const docs = await root.createPath('documents', 'projects')
const readme = await docs.createFile('README.md')
await readme.write('# My Project')

// List directory contents
for await (const entry of root.entries()) {
	console.log(entry.name, entry.kind)
}
```

### User File Access (Chromium Only)

```ts
// Check if file pickers are supported
if (fs.isUserAccessSupported()) {
	// Open file picker
	const [file] = await fs.showOpenFilePicker()
	const content = await file.getText()
	console.log(content)

	// Save file picker
	const saveFile = await fs.showSaveFilePicker({
		suggestedName: 'document.txt',
	})
	await saveFile.write('Document content')

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

1. **OPFS is primary** — The Origin Private File System is the native, performant way to handle files in browsers.  It's available in all modern browsers and doesn't require user permission.

2. **Adapters fill gaps** — When OPFS isn't available (e.g., not served from a server), adapters provide fallback behavior with the same API.

3. **Seamless migration** — Export/import enables moving between adapters without data loss.  Start with InMemoryAdapter during development, migrate to OPFS in production.

4. **Native when needed** — Every wrapper exposes its underlying native handle for advanced use cases or integration with other libraries.

### Entry Kinds

```ts
type EntryKind = 'file' | 'directory'
```

Every entry in the file system is either a file or directory.  This discriminator is available on all entry objects and enables type narrowing.

### Method Semantics

This library follows consistent naming conventions:

| Method | Returns | When Not Found | Use Case |
|--------|---------|----------------|----------|
| `getFile(name)` | `FileInterface \| undefined` | Returns `undefined` | Optional lookup |
| `resolveFile(name)` | `FileInterface` | Throws `NotFoundError` | Required lookup |
| `createFile(name)` | `FileInterface` | Creates new (overwrites) | Always get a file |
| `hasFile(name)` | `boolean` | Returns `false` | Existence check |
| `removeFile(name)` | `void` | No-op | Delete |

The same pattern applies to directory methods:  `getDirectory`, `resolveDirectory`, `createDirectory`, `hasDirectory`, `removeDirectory`.

### Storage Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                          │
├─────────────────────────────────────────────────────────────┤
│                 @mikesaintsg/filesystem                      │
│                    (Unified API)                             │
├─────────────────────────────────────────────────────────────┤
│                   Storage Adapter                            │
│  ┌───────────────────┬─────────────────────────────────┐    │
│  │   OPFSAdapter     │      InMemoryAdapter            │    │
│  │   (Primary)       │      (Fallback/Testing)         │    │
│  └───────────────────┴─────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                    Browser APIs                              │
│     OPFS  |  File System Access API  |  File API            │
└─────────────────────────────────────────────────────────────┘
```

---

## Storage Adapters

### Built-in Adapters

| Adapter | Use Case | Persistence | Performance | Browser Support |
|---------|----------|-------------|-------------|-----------------|
| `OPFSAdapter` | Production (default) | ✅ Persistent | Fast | All modern |
| `InMemoryAdapter` | Testing, fallback | ❌ Ephemeral | Fastest | All |

### Using Adapters

```ts
import {
	createFileSystem,
	createOPFSAdapter,
	createInMemoryAdapter,
} from '@mikesaintsg/filesystem'

// Default:  OPFS adapter (recommended for production)
const fs = await createFileSystem()

// Explicit OPFS adapter
const fs = await createFileSystem({
	adapter: createOPFSAdapter(),
})

// In-memory adapter for testing
const fs = await createFileSystem({
	adapter: createInMemoryAdapter(),
})
```

### InMemoryAdapter

Useful for: 
- Unit testing without browser APIs
- Environments where OPFS isn't available
- Temporary file operations
- Development and prototyping

```ts
import { createFileSystem, createInMemoryAdapter } from '@mikesaintsg/filesystem'

const fs = await createFileSystem({
	adapter: createInMemoryAdapter(),
})

// Works exactly like OPFS, but data is lost on page refresh
const root = await fs.getRoot()
const file = await root.createFile('temp.txt')
await file.write('Temporary data')

// All operations work the same
const content = await file.getText()
console.log(content) // 'Temporary data'
```

### Adapter Availability Check

```ts
// Check if OPFS is available
if (fs.isOPFSSupported()) {
	console.log('OPFS is available')
} else {
	console.log('OPFS not available - using fallback')
}

// Check if user file access is available (Chromium only)
if (fs.isUserAccessSupported()) {
	console.log('File pickers available')
}
```

### Automatic Fallback Pattern

```ts
import {
	createFileSystem,
	createOPFSAdapter,
	createInMemoryAdapter,
} from '@mikesaintsg/filesystem'

async function createFileSystemWithFallback(): Promise<FileSystemInterface> {
	const opfsAdapter = createOPFSAdapter()

	if (await opfsAdapter.isAvailable()) {
		console.log('Using OPFS storage')
		return createFileSystem({ adapter: opfsAdapter })
	}

	console.warn('OPFS not available, using in-memory storage')
	console.warn('Data will not persist across page reloads')
	return createFileSystem({ adapter: createInMemoryAdapter() })
}

const fs = await createFileSystemWithFallback()
```

---

## File System Operations

### Creating the File System Interface

```ts
import { createFileSystem } from '@mikesaintsg/filesystem'

// Default configuration (OPFS)
const fs = await createFileSystem()

// With explicit adapter
const fs = await createFileSystem({
	adapter: createOPFSAdapter(),
})
```

### getRoot() — OPFS Access

```ts
const root = await fs.getRoot()
// root is DirectoryInterface pointing to OPFS root

// Now you can create files and directories
const file = await root. createFile('data.json')
const subdir = await root.createDirectory('documents')
```

### getQuota() — Storage Information

```ts
const quota = await fs.getQuota()
// {
//   usage: 1234567,        // Bytes currently used
//   quota: 1073741824,     // Total quota available
//   available: 1072506857, // Bytes remaining
//   percentUsed: 0.115,    // Usage as percentage (0-1)
// }

if (quota.percentUsed > 0.9) {
	console.warn('Storage nearly full!')
}
```

### isOPFSSupported() — OPFS Feature Detection

```ts
if (fs.isOPFSSupported()) {
	// Full OPFS functionality available
	const root = await fs.getRoot()
} else {
	// Running with fallback adapter
	console.warn('OPFS not supported in this environment')
}
```

### isUserAccessSupported() — Picker Feature Detection

```ts
if (fs.isUserAccessSupported()) {
	// showOpenFilePicker, showSaveFilePicker, showDirectoryPicker available
	const files = await fs.showOpenFilePicker()
} else {
	// Chromium-only features not available
	// Use <input type="file"> instead
	console.log('File pickers not supported, use file input')
}
```

---

## File Operations

### Reading Files

```ts
const file = await root.resolveFile('document.txt')

// As text (UTF-8)
const text = await file.getText()

// As ArrayBuffer (binary)
const buffer = await file.getArrayBuffer()

// As Blob
const blob = await file.getBlob()

// As ReadableStream (for large files)
const stream = file.getStream()
const reader = stream.getReader()
while (true) {
	const { done, value } = await reader. read()
	if (done) break
	processChunk(value)
}
```

### Writing Files

```ts
const file = await root.createFile('output.txt')

// Write string
await file.write('Hello, World!')

// Write ArrayBuffer
const buffer = new TextEncoder().encode('Binary data')
await file.write(buffer)

// Write Blob
const blob = new Blob(['Blob content'], { type: 'text/plain' })
await file.write(blob)

// Write ReadableStream
const response = await fetch('https://example.com/data')
await file.write(response.body)

// Write with options
await file.write('Additional content', {
	position: 100,          // Start writing at byte 100
	keepExistingData: true, // Don't truncate existing content
})
```

### Appending to Files

```ts
// Append to end of file
await file.append('More content\n')
await file.append(additionalBuffer)

// Equivalent to:
// await file.write(data, { position: fileSize, keepExistingData: true })
```

### Truncating Files

```ts
// Truncate to specific size
await file.truncate(1000) // Keep first 1000 bytes

// Clear file completely
await file.truncate(0)
```

### File Metadata

```ts
const metadata = await file.getMetadata()
// {
//   name: 'document.txt',
//   size: 1234,
//   type: 'text/plain',
//   lastModified: 1699123456789,
// }

// Just the name (synchronous)
const name = file.getName()
```

### Permissions

For files obtained via pickers (not OPFS), permissions may need to be requested:

```ts
// Check current permissions
const canRead = await file.hasReadPermission()
const canWrite = await file.hasWritePermission()

// Request write permission (shows browser prompt)
if (! canWrite) {
	const granted = await file.requestWritePermission()
	if (granted) {
		await file.write('Now I can write!')
	}
}
```

### Comparing Files

```ts
const file1 = await root.resolveFile('a.txt')
const file2 = await root.resolveFile('b.txt')

// Check if two handles point to the same file
const same = await file1.isSameEntry(file2)
```

---

## Directory Operations

### Getting and Creating Files

```ts
// Get file (returns undefined if not found)
const file = await dir.getFile('readme.txt')
if (file) {
	const content = await file.getText()
}

// Resolve file (throws NotFoundError if not found)
try {
	const file = await dir.resolveFile('readme.txt')
	const content = await file.getText()
} catch (error) {
	if (isFileSystemError(error) && error.code === 'NOT_FOUND') {
		console.log('File not found')
	}
}

// Create file (creates new or overwrites existing)
const file = await dir. createFile('new-file.txt')
await file.write('Initial content')

// Check existence
const exists = await dir.hasFile('readme.txt')

// Remove file
await dir.removeFile('readme.txt')
```

### Getting and Creating Directories

```ts
// Get subdirectory (returns undefined if not found)
const subdir = await dir.getDirectory('src')
if (subdir) {
	for await (const entry of subdir. entries()) {
		console.log(entry.name)
	}
}

// Resolve subdirectory (throws NotFoundError if not found)
const subdir = await dir.resolveDirectory('src')

// Create subdirectory (creates if not exists, returns existing if exists)
const subdir = await dir.createDirectory('src')

// Check existence
const exists = await dir.hasDirectory('src')

// Remove empty directory
await dir.removeDirectory('empty-dir')

// Remove directory with contents
await dir.removeDirectory('full-dir', { recursive: true })
```

### Removing Entries

```ts
// Remove file
await dir.removeFile('file. txt')

// Remove empty directory
await dir.removeDirectory('empty-dir')

// Remove directory with all contents (recursive)
await dir.removeDirectory('project', { recursive: true })
```

### Path-Based Operations

```ts
// Resolve nested path to file or directory
const entry = await root.resolvePath('src', 'components', 'Button.tsx')
// Returns FileInterface | DirectoryInterface | undefined

if (entry) {
	// Use type narrowing based on what you expect
	// or check the entry type
}

// Create nested directories (like mkdir -p)
const deep = await root.createPath('src', 'components', 'ui', 'buttons')
// Creates all intermediate directories that don't exist
// Returns the final DirectoryInterface

// Now create a file in the nested directory
const file = await deep.createFile('PrimaryButton.tsx')
```

### Directory Name

```ts
const name = dir.getName()
// For root directory, this is typically an empty string
```

### Comparing Directories

```ts
// Check if two handles point to the same directory
const same = await dir1.isSameEntry(dir2)

// Get relative path from parent to descendant
const path = await parent.resolve(descendant)
// Returns:  readonly string[] like ['src', 'components', 'Button.tsx']
// Returns: null if descendant is not inside parent
```

---

## Convenience Methods

### copyFile() — Copy a File

```ts
// Copy within same directory (new name)
const copy = await dir.copyFile('original.txt', 'copy.txt')

// Copy to another directory (keeps same name)
const copy = await dir.copyFile('original.txt', targetDir)

// Copy with overwrite (default is to fail if destination exists)
const copy = await dir.copyFile('original.txt', 'copy.txt', {
	overwrite: true,
})
```

### moveFile() — Move/Rename a File

```ts
// Rename file in same directory
const moved = await dir.moveFile('old-name.txt', 'new-name.txt')

// Move to another directory (keeps same name)
const moved = await dir.moveFile('file.txt', targetDir)

// Move with overwrite
const moved = await dir.moveFile('file.txt', 'target.txt', {
	overwrite: true,
})
```

### Copy vs Move

| Operation | Source File | Creates New | Performance | Use Case |
|-----------|-------------|-------------|-------------|----------|
| `copyFile` | Preserved | Yes | Reads + Writes data | Backup, duplicate |
| `moveFile` | Removed | Effectively | Usually faster | Reorganize, rename |

---

## Export & Import

### Exporting a File System

```ts
const exported = await fs.export()
// {
//   version: 1,
//   exportedAt: 1699123456789,
//   entries: [
//     { path: '/documents', name: 'documents', kind: 'directory' },
//     {
//       path: '/documents/readme.txt',
//       name: 'readme.txt',
//       kind: 'file',
//       content: ArrayBuffer,
//       lastModified: 1699123456789,
//     },
//   ],
// }

// Export with filters
const exported = await fs.export({
	includePaths: ['/documents', '/images'],
	excludePaths: ['/documents/temp', '/images/cache'],
})

// Save to downloadable file
const json = JSON.stringify(exported, (key, value) => {
	// Handle ArrayBuffer serialization
	if (value instanceof ArrayBuffer) {
		return { __type: 'ArrayBuffer', data: Array.from(new Uint8Array(value)) }
	}
	return value
})
const blob = new Blob([json], { type: 'application/json' })
```

### Importing Data

```ts
// Load from file
const json = await file.text()
const data = JSON.parse(json, (key, value) => {
	// Handle ArrayBuffer deserialization
	if (value && value.__type === 'ArrayBuffer') {
		return new Uint8Array(value.data).buffer
	}
	return value
})

// Import with options
await fs.import(data, {
	overwrite: true,           // Overwrite existing files
	mergeBehavior: 'replace',  // 'replace' | 'skip' | 'error'
})
```

### Migration Between Adapters

```ts
// Scenario:  Migrate from InMemoryAdapter to OPFS

// 1. Export from in-memory
const memoryFs = await createFileSystem({
	adapter: createInMemoryAdapter(),
})
// ...  populate with data during development
const data = await memoryFs.export()

// 2. Import to OPFS
const opfsFs = await createFileSystem({
	adapter: createOPFSAdapter(),
})
await opfsFs.import(data)

// Now data persists across page reloads
```

### Exported Data Format

```ts
interface ExportedFileSystem {
	readonly version: number
	readonly exportedAt: number
	readonly entries:  readonly ExportedEntry[]
}

type ExportedEntry = ExportedFileEntry | ExportedDirectoryEntry

interface ExportedFileEntry {
	readonly path: string
	readonly name:  string
	readonly kind: 'file'
	readonly content: ArrayBuffer
	readonly lastModified: number
}

interface ExportedDirectoryEntry {
	readonly path: string
	readonly name: string
	readonly kind: 'directory'
}
```

---

## Writable Streams

For large files or streaming writes, use writable streams instead of the atomic `write()` method.

### Opening a Writable

```ts
const file = await root.createFile('large-file.bin')
const writable = await file.openWritable()

try {
	// Write multiple chunks
	await writable.write(chunk1)
	await writable.write(chunk2)
	await writable.write(chunk3)

	// Commit changes
	await writable.close()
} catch (error) {
	// Discard changes on error
	await writable.abort()
	throw error
}
```

### Writable Stream Methods

```ts
// Write at current position
await writable.write('string data')
await writable.write(arrayBuffer)
await writable.write(blob)
await writable.write(readableStream)

// Seek to specific position
await writable.seek(1000) // Move to byte 1000

// Truncate file
await writable.truncate(5000) // Resize to 5000 bytes

// Commit and close
await writable.close()

// Abort and discard all changes
await writable.abort()
```

### Write Data Types

```ts
type WriteData =
	| string                      // UTF-8 encoded
	| BufferSource                // ArrayBuffer or TypedArray
	| Blob                        // Blob object
	| ReadableStream<Uint8Array>  // Stream of bytes
```

---

## Sync Access (Workers)

For high-performance file I/O in Web Workers, use synchronous access handles.  This API is **only available in Web Workers**, not the main thread.

### Creating a Sync Access Handle

```ts
// In a Web Worker
const file = await root.resolveFile('data.bin')
const handle = await file. createSyncAccessHandle()

try {
	// Get file size
	const size = handle.getSize()

	// Synchronous read
	const buffer = new Uint8Array(1024)
	const bytesRead = handle.read(buffer, { at: 0 })

	// Synchronous write
	const data = new Uint8Array([1, 2, 3, 4])
	const bytesWritten = handle.write(data, { at: 0 })

	// Resize file
	handle.truncate(1000)

	// Flush changes to disk
	handle.flush()
} finally {
	// Always close to release the lock
	handle.close()
}
```

### Sync Access Handle Interface

```ts
interface SyncAccessHandleInterface {
	readonly native: FileSystemSyncAccessHandle

	/** Gets file size in bytes */
	getSize(): number

	/**
	 * Reads bytes into buffer. 
	 * @returns Number of bytes read
	 */
	read(buffer: ArrayBufferView, options?: { readonly at?:  number }): number

	/**
	 * Writes buffer to file.
	 * @returns Number of bytes written
	 */
	write(buffer: ArrayBufferView, options?: { readonly at?: number }): number

	/** Resizes file to new size */
	truncate(newSize: number): void

	/** Persists changes to disk */
	flush(): void

	/** Releases lock on file */
	close(): void
}
```

### When to Use Sync Access

| Scenario | Recommendation |
|----------|----------------|
| Main thread file I/O | Use async methods (`write`, `getText`, etc.) |
| Worker with frequent small reads/writes | ✅ Use sync access |
| Worker processing large files | ✅ Use sync access |
| SQLite-style database files | ✅ Use sync access |
| Simple one-off file operations | Use async methods |

---

## Directory Traversal

### Iterating Entries

```ts
// All entries (files and directories)
for await (const entry of dir.entries()) {
	console.log(entry.name, entry.kind)
	// entry.handle is the native FileSystemHandle
}

// Files only
for await (const file of dir.files()) {
	const content = await file.getText()
	console.log(file.getName(), content.length)
}

// Directories only
for await (const subdir of dir.directories()) {
	console.log('Subdirectory:', subdir. getName())
}
```

### Listing Contents

```ts
// All entries as array
const entries = await dir. list()
// readonly DirectoryEntry[]

// Files as array
const files = await dir. listFiles()
// readonly FileInterface[]

// Directories as array
const subdirs = await dir.listDirectories()
// readonly DirectoryInterface[]
```

### Recursive Walking

```ts
// Walk entire directory tree
for await (const entry of dir.walk()) {
	console.log(
		entry.path. join('/'),  // Full path as array
		entry.entry.kind,      // 'file' or 'directory'
		entry. depth            // Nesting level (0 = direct child)
	)
}
```

### Walk Options

```ts
interface WalkOptions {
	readonly maxDepth?: number
	readonly includeFiles?: boolean
	readonly includeDirectories?: boolean
	readonly filter?: (entry: DirectoryEntry, depth: number) => boolean
}

// Limit recursion depth
for await (const entry of dir.walk({ maxDepth: 2 })) {
	// Only goes 2 levels deep
}

// Files only, skip hidden files
for await (const entry of dir.walk({
	includeFiles: true,
	includeDirectories:  false,
	filter: (entry) => !entry.name.startsWith('.'),
})) {
	console.log(entry.path.join('/'))
}

// Find all TypeScript files
for await (const entry of dir.walk({
	includeDirectories: false,
	filter: (entry) => entry.name.endsWith('.ts'),
})) {
	console.log('Found:', entry.path.join('/'))
}
```

---

## Picker Dialogs

**Chromium only. ** Always check `fs.isUserAccessSupported()` before using these methods.

### Open File Picker

```ts
if (fs.isUserAccessSupported()) {
	// Single file
	const [file] = await fs.showOpenFilePicker()
	const content = await file. getText()

	// Multiple files
	const files = await fs.showOpenFilePicker({ multiple: true })
	for (const file of files) {
		console.log(file.getName())
	}

	// With file type filter
	const images = await fs.showOpenFilePicker({
		types: [
			{
				description: 'Images',
				accept: {
					'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
				},
			},
		],
	})
}
```

### Save File Picker

```ts
if (fs.isUserAccessSupported()) {
	const file = await fs.showSaveFilePicker({
		suggestedName: 'document.txt',
		types: [
			{
				description: 'Text files',
				accept: { 'text/plain': ['. txt'] },
			},
			{
				description: 'Markdown',
				accept: { 'text/markdown': ['.md'] },
			},
		],
	})

	await file.write('Document content')
}
```

### Directory Picker

```ts
if (fs.isUserAccessSupported()) {
	const dir = await fs.showDirectoryPicker({
		mode: 'readwrite', // Request write access
	})

	// List contents
	for await (const entry of dir.entries()) {
		console.log(entry.name, entry.kind)
	}

	// Create files in user-selected directory
	const newFile = await dir.createFile('new-file. txt')
	await newFile.write('Created by app')
}
```

### Picker Options

#### OpenFilePickerOptions

```ts
interface OpenFilePickerOptions {
	readonly multiple?: boolean                    // Allow multiple selection
	readonly excludeAcceptAllOption?: boolean      // Hide "All files" option
	readonly types?: readonly FilePickerAcceptType[]  // File type filters
	readonly id?: string                           // Remember last directory
	readonly startIn?: StartInDirectory            // Initial directory
}
```

#### SaveFilePickerOptions

```ts
interface SaveFilePickerOptions {
	readonly suggestedName?: string                // Default filename
	readonly excludeAcceptAllOption?: boolean      // Hide "All files" option
	readonly types?: readonly FilePickerAcceptType[]  // File type filters
	readonly id?: string                           // Remember last directory
	readonly startIn?: StartInDirectory            // Initial directory
}
```

#### DirectoryPickerOptions

```ts
interface DirectoryPickerOptions {
	readonly id?: string                  // Remember last directory
	readonly startIn?: StartInDirectory   // Initial directory
	readonly mode?: 'read' | 'readwrite'  // Access mode
}
```

#### FilePickerAcceptType

```ts
interface FilePickerAcceptType {
	readonly description?:  string
	readonly accept:  Readonly<Record<string, readonly string[]>>
}

// Example
const imageTypes:  FilePickerAcceptType = {
	description: 'Image files',
	accept: {
		'image/png': ['. png'],
		'image/jpeg': ['.jpg', '.jpeg'],
		'image/gif': ['.gif'],
	},
}
```

#### StartInDirectory

```ts
type StartInDirectory =
	| 'desktop'
	| 'documents'
	| 'downloads'
	| 'music'
	| 'pictures'
	| 'videos'
	| FileSystemHandle  // Start in directory containing this handle
```

---

## Drag & Drop Integration

### From DataTransferItem

```ts
const dropZone = document.getElementById('drop-zone')

dropZone.addEventListener('dragover', (event) => {
	event.preventDefault()
})

dropZone.addEventListener('drop', async (event) => {
	event.preventDefault()

	for (const item of event.dataTransfer.items) {
		const entry = await fs.fromDataTransferItem(item)

		if (! entry) continue

		// Check if it's a file or directory
		if ('getText' in entry) {
			// It's a FileInterface
			const file = entry as FileInterface
			console.log('File:', file.getName())
			const content = await file.getText()
		} else {
			// It's a DirectoryInterface
			const dir = entry as DirectoryInterface
			console.log('Directory:', dir. getName())
			for await (const child of dir.entries()) {
				console.log('  -', child.name)
			}
		}
	}
})

// Or batch process all items
dropZone.addEventListener('drop', async (event) => {
	event.preventDefault()
	const entries = await fs.fromDataTransferItems(event.dataTransfer.items)

	for (const entry of entries) {
		console.log(entry.getName())
	}
})
```

### From File Input

```ts
const input = document.querySelector('input[type="file"]') as HTMLInputElement

input.addEventListener('change', async () => {
	if (! input.files) return

	// Multiple files
	const files = await fs.fromFiles(input.files)
	for (const file of files) {
		const content = await file.getText()
		console.log(file.getName(), content.length)
	}
})

// Single file
input.addEventListener('change', async () => {
	if (!input.files? .[0]) return

	const file = await fs.fromFile(input.files[0])
	const content = await file.getText()
})
```

---

## Error Handling

### Error Classes

```ts
import { FileSystemError, isFileSystemError } from '@mikesaintsg/filesystem'

try {
	await dir.resolveFile('nonexistent. txt')
} catch (error) {
	if (isFileSystemError(error)) {
		console.log('Code:', error.code)
		console.log('Path:', error.path)
		console.log('Cause:', error.cause)
	}
}
```

### Error Hierarchy

```ts
class FileSystemError extends Error {
	readonly code: FileSystemErrorCode
	readonly path?:  string
	readonly cause?: Error
}
```

### Error Codes

| Code | Cause |
|------|-------|
| `NOT_FOUND` | File or directory doesn't exist |
| `NOT_ALLOWED` | Permission denied |
| `TYPE_MISMATCH` | Expected file, got directory (or vice versa) |
| `NO_MODIFICATION_ALLOWED` | Read-only file system or entry |
| `INVALID_STATE` | Handle is no longer valid |
| `QUOTA_EXCEEDED` | Storage quota exceeded |
| `ABORT` | Operation was aborted by user |
| `SECURITY` | Security restriction (e.g., cross-origin) |
| `ENCODING` | Invalid encoding |
| `NOT_SUPPORTED` | Feature not supported in this browser |

### Handling Errors

```ts
import { isFileSystemError } from '@mikesaintsg/filesystem'

try {
	await dir.resolveFile('config.json')
} catch (error) {
	if (isFileSystemError(error)) {
		switch (error.code) {
			case 'NOT_FOUND':
				console.log('File not found, creating default')
				const file = await dir.createFile('config.json')
				await file.write('{}')
				break
			case 'NOT_ALLOWED':
				console.log('Permission denied')
				const granted = await dir.requestWritePermission()
				if (granted) {
					// Retry operation
				}
				break
			case 'QUOTA_EXCEEDED':
				console. log('Storage full')
				// Clean up old files
				break
			default:
				throw error
		}
	} else {
		throw error
	}
}
```

### Type Guards

```ts
import {
	isFileSystemError,
	isNotFoundError,
	isNotAllowedError,
	isQuotaExceededError,
} from '@mikesaintsg/filesystem'

if (isFileSystemError(error)) { /* any file system error */ }
if (isNotFoundError(error)) { /* NOT_FOUND error */ }
if (isNotAllowedError(error)) { /* NOT_ALLOWED error */ }
if (isQuotaExceededError(error)) { /* QUOTA_EXCEEDED error */ }
```

---

## Native Access

Every wrapper exposes its underlying native object via the `native` property.

### File

```ts
const file = await root.resolveFile('document.txt')
const nativeHandle:  FileSystemFileHandle = file.native

// Use native API directly
const nativeFile = await nativeHandle.getFile()
console.log(nativeFile.size)
```

### Directory

```ts
const dir = await root. resolveDirectory('documents')
const nativeHandle: FileSystemDirectoryHandle = dir.native

// Use native API directly
for await (const [name, handle] of nativeHandle.entries()) {
	console.log(name, handle.kind)
}
```

### Writable Stream

```ts
const writable = await file.openWritable()
const nativeStream:  FileSystemWritableFileStream = writable.native

// Use native API directly
await nativeStream.write({ type: 'write', position: 0, data: 'Hello' })
```

### Creating from Native Handles

```ts
import { fromFileHandle, fromDirectoryHandle } from '@mikesaintsg/filesystem'

// Wrap existing native handles
const fileInterface = fromFileHandle(nativeFileHandle)
const dirInterface = fromDirectoryHandle(nativeDirHandle)

// Now use the wrapped interface
const content = await fileInterface.getText()
```

### When to Use Native Access

- Complex operations not supported by the wrapper
- Integration with other libraries expecting native handles
- Performance-critical operations
- Debugging and inspection
- Using features not yet wrapped

---

## TypeScript Integration

### Strict Typing

All methods are fully typed:

```ts
// Return types are precise
const file: FileInterface | undefined = await dir.getFile('readme.txt')
const file: FileInterface = await dir.resolveFile('readme.txt') // throws if not found

// Content types match operation
const text: string = await file.getText()
const buffer: ArrayBuffer = await file.getArrayBuffer()
const blob: Blob = await file.getBlob()
const stream: ReadableStream<Uint8Array> = file.getStream()
```

### Readonly by Default

All returned collections are readonly:

```ts
const entries = await dir.list()
// entries is readonly DirectoryEntry[]

entries.push(newEntry) // ❌ TypeScript error
entries[0].name = 'new' // ❌ TypeScript error
```

### Interface Pattern

Behavioral interfaces use the `Interface` suffix:

```ts
import type {
	FileInterface,
	DirectoryInterface,
	FileSystemInterface,
	WritableFileInterface,
	SyncAccessHandleInterface,
	StorageAdapterInterface,
} from '@mikesaintsg/filesystem'

// Data types don't have the suffix
import type {
	FileMetadata,
	DirectoryEntry,
	StorageQuota,
	WalkEntry,
	ExportedFileSystem,
} from '@mikesaintsg/filesystem'
```

### Entry Kind Discrimination

```ts
const entry = await root.resolvePath('something')

if (entry) {
	// Need to determine if file or directory
	// Option 1: Check for file-specific method
	if ('getText' in entry) {
		const file = entry as FileInterface
		const content = await file.getText()
	} else {
		const dir = entry as DirectoryInterface
		for await (const child of dir.entries()) {
			console.log(child.name)
		}
	}
}
```

---

## Performance Tips

### 1. Use Async Generators for Large Directories

```ts
// ❌ Memory-heavy for large directories
const allEntries = await dir.list()
const allFiles = await dir.listFiles()

// ✅ Memory-efficient streaming
for await (const entry of dir.entries()) {
	process(entry)
}

for await (const file of dir.files()) {
	process(file)
}
```

### 2. Use Streams for Large Files

```ts
// ❌ Loads entire file into memory
const content = await file.getArrayBuffer()

// ✅ Stream processing
const stream = file.getStream()
const reader = stream.getReader()
while (true) {
	const { done, value } = await reader.read()
	if (done) break
	processChunk(value)
}

// ✅ Streaming write
const writable = await file.openWritable()
for (const chunk of chunks) {
	await writable.write(chunk)
}
await writable.close()
```

### 3. Use Sync Access in Workers for High-Throughput

```ts
// In a Web Worker for database-like access patterns
const handle = await file.createSyncAccessHandle()

// Synchronous I/O is much faster for frequent small operations
for (let i = 0; i < 10000; i++) {
	handle.read(buffer, { at: i * 64 })
	// Process buffer
	handle.write(result, { at: i * 64 })
}

handle.flush()
handle.close()
```

### 4. Batch Path Creation

```ts
// ❌ Multiple round trips
await root.createDirectory('src')
const src = await root.resolveDirectory('src')
await src.createDirectory('components')
const components = await src.resolveDirectory('components')
await components.createDirectory('ui')

// ✅ Single operation
const ui = await root.createPath('src', 'components', 'ui')
```

### 5. Use Existence Checks Before Operations

```ts
// ❌ Try/catch is slower for expected failures
try {
	await dir. resolveFile('maybe-exists.txt')
} catch {
	// Handle not found
}

// ✅ Check first when you expect it might not exist
if (await dir.hasFile('maybe-exists.txt')) {
	const file = await dir.resolveFile('maybe-exists.txt')
}

// Or use get() which returns undefined
const file = await dir.getFile('maybe-exists.txt')
if (file) {
	// Use file
}
```

### 6. Limit Recursive Walks

```ts
// ❌ Could be very slow for deep trees
for await (const entry of dir.walk()) {
	// Walks entire tree
}

// ✅ Limit depth
for await (const entry of dir.walk({ maxDepth: 3 })) {
	// Only goes 3 levels deep
}

// ✅ Filter early
for await (const entry of dir.walk({
	filter: (entry) => !entry.name.startsWith('.'),
	includeDirectories: false, // Skip directories if not needed
})) {
	// Only matching entries
}
```

### 7. Use Filter in Walk

```ts
// ❌ Filter after iteration
const allEntries:  WalkEntry[] = []
for await (const entry of dir.walk()) {
	if (entry.entry.name. endsWith('.ts')) {
		allEntries.push(entry)
	}
}

// ✅ Filter during iteration
for await (const entry of dir.walk({
	filter: (entry) => entry.name.endsWith('.ts'),
})) {
	// Only .ts files
}
```

---

## Browser Compatibility

### Feature Detection

```ts
// Check OPFS support
if (fs.isOPFSSupported()) {
	// Full OPFS functionality
}

// Check picker support (Chromium only)
if (fs.isUserAccessSupported()) {
	// showOpenFilePicker, showSaveFilePicker, showDirectoryPicker
}

// Check sync access support (Workers only)
if (typeof FileSystemSyncAccessHandle !== 'undefined') {
	// Sync access available
}
```

### Browser Support Matrix

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| OPFS | 86+ | 111+ | 15.2+ | 86+ |
| File Pickers | 86+ | ❌ | ❌ | 86+ |
| Drag & Drop (file handles) | 86+ | ❌ | ❌ | 86+ |
| Sync Access Handle | 102+ | 111+ | ❌ | 102+ |
| File API (read-only) | ✅ | ✅ | ✅ | ✅ |

### Graceful Degradation

```ts
async function saveFile(content: string, filename: string): Promise<void> {
	const fs = await createFileSystem()

	// Try native file picker first (best UX)
	if (fs.isUserAccessSupported()) {
		try {
			const file = await fs.showSaveFilePicker({
				suggestedName: filename,
			})
			await file.write(content)
			return
		} catch (error) {
			// User cancelled or other error, fall through
			if (isFileSystemError(error) && error.code === 'ABORT') {
				return // User cancelled, don't fall back
			}
		}
	}

	// Fallback:  Download via anchor element
	const blob = new Blob([content], { type: 'text/plain' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = filename
	a.click()
	URL.revokeObjectURL(url)
}
```

### Fallback Pattern

```ts
import {
	createFileSystem,
	createOPFSAdapter,
	createInMemoryAdapter,
} from '@mikesaintsg/filesystem'

async function createBestFileSystem(): Promise<FileSystemInterface> {
	// Try OPFS first (persistent, best performance)
	const opfsAdapter = createOPFSAdapter()
	if (await opfsAdapter.isAvailable()) {
		return createFileSystem({ adapter: opfsAdapter })
	}

	// Fallback to in-memory (works everywhere, not persistent)
	console.warn('OPFS not available, using in-memory storage')
	return createFileSystem({ adapter: createInMemoryAdapter() })
}
```

---

## API Reference

### Factory Functions

#### createFileSystem(options? ): Promise\<FileSystemInterface\>

Creates a file system interface with the specified adapter.

```ts
// Default (OPFS)
const fs = await createFileSystem()

// With explicit adapter
const fs = await createFileSystem({
	adapter: createInMemoryAdapter(),
})
```

#### createOPFSAdapter(): StorageAdapterInterface

Creates an OPFS storage adapter.

```ts
const adapter = createOPFSAdapter()
if (await adapter.isAvailable()) {
	const fs = await createFileSystem({ adapter })
}
```

#### createInMemoryAdapter(): StorageAdapterInterface

Creates an in-memory storage adapter.

```ts
const adapter = createInMemoryAdapter()
const fs = await createFileSystem({ adapter })
```

#### fromFileHandle(handle: FileSystemFileHandle): FileInterface

Wraps a native file handle.

```ts
const fileInterface = fromFileHandle(nativeHandle)
```

#### fromDirectoryHandle(handle: FileSystemDirectoryHandle): DirectoryInterface

Wraps a native directory handle.

```ts
const dirInterface = fromDirectoryHandle(nativeHandle)
```

### FileSystemInterface

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getRoot()` | `Promise<DirectoryInterface>` | Get OPFS root directory |
| `getQuota()` | `Promise<StorageQuota>` | Get storage quota info |
| `isOPFSSupported()` | `boolean` | Check OPFS availability |
| `isUserAccessSupported()` | `boolean` | Check picker availability |
| `showOpenFilePicker(opts?)` | `Promise<readonly FileInterface[]>` | Open file picker |
| `showSaveFilePicker(opts?)` | `Promise<FileInterface>` | Save file picker |
| `showDirectoryPicker(opts?)` | `Promise<DirectoryInterface>` | Directory picker |
| `fromDataTransferItem(item)` | `Promise<FileInterface \| DirectoryInterface \| null>` | From drag-drop |
| `fromDataTransferItems(items)` | `Promise<readonly (FileInterface \| DirectoryInterface)[]>` | From drag-drop |
| `fromFile(file)` | `Promise<FileInterface>` | From File object |
| `fromFiles(files)` | `Promise<readonly FileInterface[]>` | From FileList |
| `export(opts?)` | `Promise<ExportedFileSystem>` | Export file system |
| `import(data, opts?)` | `Promise<void>` | Import file system |
| `close()` | `void` | Close and release resources |

### FileInterface

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `native` | `FileSystemFileHandle` | Native handle |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getName()` | `string` | File name |
| `getMetadata()` | `Promise<FileMetadata>` | File metadata |
| `getText()` | `Promise<string>` | Read as text |
| `getArrayBuffer()` | `Promise<ArrayBuffer>` | Read as buffer |
| `getBlob()` | `Promise<Blob>` | Read as blob |
| `getStream()` | `ReadableStream<Uint8Array>` | Get readable stream |
| `write(data, opts?)` | `Promise<void>` | Write data |
| `append(data)` | `Promise<void>` | Append data |
| `truncate(size)` | `Promise<void>` | Truncate file |
| `openWritable()` | `Promise<WritableFileInterface>` | Open writable stream |
| `hasReadPermission()` | `Promise<boolean>` | Check read permission |
| `hasWritePermission()` | `Promise<boolean>` | Check write permission |
| `requestWritePermission()` | `Promise<boolean>` | Request write permission |
| `isSameEntry(other)` | `Promise<boolean>` | Compare entries |

### DirectoryInterface

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `native` | `FileSystemDirectoryHandle` | Native handle |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getName()` | `string` | Directory name |
| `getFile(name)` | `Promise<FileInterface \| undefined>` | Get file |
| `resolveFile(name)` | `Promise<FileInterface>` | Get file (throws) |
| `createFile(name)` | `Promise<FileInterface>` | Create file |
| `hasFile(name)` | `Promise<boolean>` | Check file exists |
| `removeFile(name)` | `Promise<void>` | Remove file |
| `copyFile(src, dest, opts?)` | `Promise<FileInterface>` | Copy file |
| `moveFile(src, dest, opts?)` | `Promise<FileInterface>` | Move file |
| `getDirectory(name)` | `Promise<DirectoryInterface \| undefined>` | Get directory |
| `resolveDirectory(name)` | `Promise<DirectoryInterface>` | Get directory (throws) |
| `createDirectory(name)` | `Promise<DirectoryInterface>` | Create directory |
| `hasDirectory(name)` | `Promise<boolean>` | Check directory exists |
| `removeDirectory(name, opts?)` | `Promise<void>` | Remove directory |
| `resolvePath(... segments)` | `Promise<FileInterface \| DirectoryInterface \| undefined>` | Resolve path |
| `createPath(...segments)` | `Promise<DirectoryInterface>` | Create nested path |
| `entries()` | `AsyncIterable<DirectoryEntry>` | Iterate entries |
| `files()` | `AsyncIterable<FileInterface>` | Iterate files |
| `directories()` | `AsyncIterable<DirectoryInterface>` | Iterate directories |
| `list()` | `Promise<readonly DirectoryEntry[]>` | List entries |
| `listFiles()` | `Promise<readonly FileInterface[]>` | List files |
| `listDirectories()` | `Promise<readonly DirectoryInterface[]>` | List directories |
| `walk(opts?)` | `AsyncIterable<WalkEntry>` | Walk recursively |
| `hasReadPermission()` | `Promise<boolean>` | Check read permission |
| `hasWritePermission()` | `Promise<boolean>` | Check write permission |
| `requestWritePermission()` | `Promise<boolean>` | Request write permission |
| `isSameEntry(other)` | `Promise<boolean>` | Compare entries |
| `resolve(descendant)` | `Promise<readonly string[] \| null>` | Get relative path |

### WritableFileInterface

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `native` | `FileSystemWritableFileStream` | Native stream |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `write(data)` | `Promise<void>` | Write data |
| `seek(position)` | `Promise<void>` | Seek to position |
| `truncate(size)` | `Promise<void>` | Truncate file |
| `close()` | `Promise<void>` | Commit and close |
| `abort()` | `Promise<void>` | Abort and discard |

### SyncAccessHandleInterface

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `native` | `FileSystemSyncAccessHandle` | Native handle |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getSize()` | `number` | Get file size |
| `read(buffer, opts?)` | `number` | Read bytes |
| `write(buffer, opts?)` | `number` | Write bytes |
| `truncate(newSize)` | `void` | Resize file |
| `flush()` | `void` | Flush to disk |
| `close()` | `void` | Release lock |

### Types

```ts
type EntryKind = 'file' | 'directory'
type Unsubscribe = () => void

type WriteData =
	| string
	| BufferSource
	| Blob
	| ReadableStream<Uint8Array>

type StartInDirectory =
	| 'desktop'
	| 'documents'
	| 'downloads'
	| 'music'
	| 'pictures'
	| 'videos'
	| FileSystemHandle

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

### Comparison with Node.js fs Module

| Node.js fs | @mikesaintsg/filesystem | Notes |
|------------|-------------------------|-------|
| `fs.readFile()` | `file.getText()` / `file.getArrayBuffer()` | Async only |
| `fs.writeFile()` | `file.write()` | Atomic by default |
| `fs.appendFile()` | `file.append()` | |
| `fs.mkdir()` | `dir.createDirectory()` | |
| `fs.mkdir({ recursive: true })` | `dir.createPath()` | |
| `fs.readdir()` | `dir.list()` / `dir.entries()` | Async iterator available |
| `fs.rm()` | `dir.removeFile()` / `dir.removeDirectory()` | |
| `fs.stat()` | `file.getMetadata()` | |
| `fs.existsSync()` | `dir.hasFile()` / `dir.hasDirectory()` | Async only |
| `fs.createReadStream()` | `file.getStream()` | |
| `fs.createWriteStream()` | `file.openWritable()` | |
| `fs.copyFile()` | `dir.copyFile()` | |
| `fs.rename()` | `dir.moveFile()` | |

---

## License

MIT