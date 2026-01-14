# @mikesaintsg/filesystem

> A focused File System wrapper that enhances native browser APIs without abstracting them away

## Features

- ✅ **Type Safety** — Full TypeScript strict mode support
- ✅ **Promise-based** — Async/await for all operations
- ✅ **Ergonomic API** — Simplified file and directory operations
- ✅ **Native Access** — Full access to underlying File System handles via `.native`
- ✅ **Unified Interface** — Same API across OPFS, File System Access, drag-drop, and File API
- ✅ **Pluggable Storage** — Swap storage backends with adapters (OPFS, InMemory, IndexedDB)
- ✅ **Async Iterators** — Memory-efficient directory traversal with early break
- ✅ **Path Operations** — `mkdir -p` style nested directory creation
- ✅ **Convenience Methods** — `copyFile()`, `moveFile()` for common operations
- ✅ **Export/Import** — Migrate data between storage backends
- ✅ **Error Classes** — Typed errors with `NotFoundError`, `NotAllowedError`, etc.
- ✅ **Zero Dependencies** — Built entirely on Web Platform APIs

## Installation

```bash
npm install @mikesaintsg/filesystem
```

## Quick Start

```typescript
import { createFileSystem, fromDirectoryHandle } from '@mikesaintsg/filesystem'

// Get OPFS root via native API
const nativeRoot = await navigator.storage.getDirectory()
const root = fromDirectoryHandle(nativeRoot)

// Create a file and write content
const file = await root.createFile('hello.txt')
await file.write('Hello, File System!')

// Read the file back
const content = await file.getText()
console.log(content) // 'Hello, File System!'

// Create nested directories (like mkdir -p)
const cache = await root.createPath('data', 'cache', 'images')

// List directory contents
for await (const entry of root.entries()) {
	console.log(`${entry.kind}: ${entry.name}`)
}

// Need native access? It's there.
const nativeHandle = file.native
```

## Documentation

- **[API Guide](./guides/filesystem.md)** — Comprehensive usage documentation
- **[Polyfill Guide](./guides/polyfill.md)** — IndexedDB fallback for when OPFS is unavailable

## Core API

### File Operations

```typescript
// Reading
const text = await file.getText()
const buffer = await file.getArrayBuffer()
const blob = await file.getBlob()
const stream = file.getStream()

// Writing (atomic by default)
await file.write('Hello, World!')
await file.write(new Uint8Array([1, 2, 3]))
await file.write(new Blob(['data']))

// Write at position
await file.write('patch', { position: 10, keepExistingData: true })

// Append
await file.append(' - appended')

// Truncate
await file.truncate(100)

// Metadata
const metadata = await file.getMetadata()
console.log(metadata.size, metadata.lastModified)
```

### Directory Operations

```typescript
// File operations
const file = await directory.getFile('config.json')       // undefined if missing
const file = await directory.resolveFile('config.json')   // throws if missing
const file = await directory.createFile('new.txt')        // creates/overwrites
const exists = await directory.hasFile('maybe.txt')
await directory.removeFile('old.txt')

// Directory operations
const sub = await directory.createDirectory('subdir')
const deep = await directory.createPath('a', 'b', 'c')    // mkdir -p

// Iteration
for await (const entry of directory.entries()) { /* all */ }
for await (const file of directory.files()) { /* files only */ }
for await (const dir of directory.directories()) { /* dirs only */ }

// Recursive walk
for await (const { path, entry, depth } of directory.walk()) {
	console.log([...path, entry.name].join('/'))
}
```

### Writable Streams

```typescript
const writable = await file.openWritable()

await writable.write('First chunk')
await writable.write('Second chunk')
await writable.seek(0)
await writable.write('Overwrite')
await writable.truncate(100)

await writable.close() // Commit changes
// OR
await writable.abort() // Discard changes
```

### Error Handling

```typescript
import {
	NotFoundError,
	NotAllowedError,
	QuotaExceededError,
	isNotFoundError
} from '@mikesaintsg/filesystem'

try {
	const file = await directory.resolveFile('missing.txt')
} catch (error) {
	if (isNotFoundError(error)) {
		console.log(`File not found: ${error.path}`)
	}
}
```

### Storage Adapters

Swap storage backends without changing your code:

```typescript
import { createFileSystem, InMemoryAdapter } from '@mikesaintsg/filesystem'

// Default: Origin Private File System (OPFS)
const fs = await createFileSystem()

// In-memory storage (great for testing)
const memFS = await createFileSystem({ adapter: new InMemoryAdapter() })

// Same API, different backends
const root = await fs.getRoot()
const file = await root.createFile('hello.txt')
await file.write('Hello!')
```

### Convenience Methods

```typescript
// Copy a file within or across directories
const copy = await directory.copyFile('source.txt', 'backup.txt')

// Move/rename a file
await directory.moveFile('old.txt', 'new.txt')

// Move to another directory
const archive = await root.createDirectory('archive')
await directory.moveFile('file.txt', archive)
```

### Export & Import

Migrate data between storage backends:

```typescript
// Export from one file system
const exported = await fs.export()

// Import to another
await anotherFS.import(exported)

// With options
await fs.export({ includePaths: ['/data'], excludePaths: ['/temp'] })
await anotherFS.import(exported, { mergeBehavior: 'skip' })
```

## Development

```bash
# Install dependencies
npm install

# Run type checking
npm run check

# Run linting with autofix
npm run format

# Run tests
npm test

# Build package
npm run build

# Run showcase
npm run dev
```

## Browser Compatibility

| Feature                      | Chrome | Edge   | Safari | Firefox |
|------------------------------|--------|--------|--------|---------|
| OPFS (`getDirectory`)        | 86+    | 86+    | 15.2+  | 111+    |
| `FileSystemSyncAccessHandle` | 102+   | 102+   | 15.2+  | 111+    |
| `showOpenFilePicker`         | 86+    | 86+    | ❌     | ❌      |
| `showSaveFilePicker`         | 86+    | 86+    | ❌     | ❌      |
| `showDirectoryPicker`        | 86+    | 86+    | ❌     | ❌      |

### Known Issues

**Android WebView 132 Bug**: There is a known regression bug in Android WebView version 132 (affects Chrome/Edge on Android 14/15) that causes OPFS to fail with the error:

```
NotAllowedError: It was determined that certain files are unsafe for access...
```

This is a Chromium bug, not a limitation of this library. A fix is rolling out in subsequent WebView updates. See our [Polyfill Guide](./guides/polyfill.md) for IndexedDB fallback workarounds.

## Comparison

| Feature           | This Library          | Native APIs              |
|-------------------|-----------------------|--------------------------|
| Type safety       | ✅ Full strict mode    | ❌ No types              |
| Error handling    | ✅ Typed error classes | ⚠️ DOMException only     |
| Native access     | ✅ `.native` property  | N/A                      |
| Path operations   | ✅ `createPath()`      | ❌ Manual iteration      |
| Directory walk    | ✅ Async generator     | ❌ Manual recursion      |
| Unified interface | ✅ Same API everywhere | ❌ Different APIs        |
| Dependencies      | 0                     | N/A                      |

## License

MIT © Mike Garcia
