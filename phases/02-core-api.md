# Phase 2: Core API

> **Status:** ✅ Complete
> **Started:** 2026-01-13
> **Completed:** 2026-01-13
> **Depends on:** Phase 1 (Foundation) ✅ Complete

## Objective

Implement the core file and directory operations. By end of phase, `FileInterface` and `DirectoryInterface` implementations will be complete with full read/write capabilities, directory iteration, and path-based operations.

## Deliverables

| # | Deliverable | Status | Assignee |
|---|-------------|--------|----------|
| 2.1 | `File` class implementing `FileInterface` | ✅ Done | — |
| 2.2 | `Directory` class implementing `DirectoryInterface` | ✅ Done | — |
| 2.3 | `WritableFile` class implementing `WritableFileInterface` | ✅ Done | — |
| 2.4 | `SyncAccessHandle` class implementing `SyncAccessHandleInterface` | ✅ Done | — |
| 2.5 | Factory functions: `fromFileHandle()`, `fromDirectoryHandle()` | ✅ Done | — |
| 2.6 | Unit tests for File class | ✅ Done | — |
| 2.7 | Unit tests for Directory class | ✅ Done | — |
| 2.8 | Unit tests for WritableFile class | ✅ Done | — |

**Status Legend:**
- ✅ Done
- 🔄 Active
- ⏳ Pending

## Current Focus: Complete

### Requirements

1. Wrap `FileSystemFileHandle` with enhanced API
2. Implement all read methods: `getText()`, `getArrayBuffer()`, `getBlob()`, `getStream()`
3. Implement write methods: `write()`, `append()`, `truncate()`
4. Implement permission methods: `hasReadPermission()`, `hasWritePermission()`, `requestWritePermission()`
5. Expose `.native` property for underlying handle access

### Interface Contract

```typescript
// From src/types.ts
export interface FileInterface {
	readonly native: FileSystemFileHandle

	// Accessors
	getName(): string
	getMetadata(): Promise<FileMetadata>

	// Reading
	getText(): Promise<string>
	getArrayBuffer(): Promise<ArrayBuffer>
	getBlob(): Promise<Blob>
	getStream(): ReadableStream<Uint8Array>

	// Writing
	write(data: WriteData, options?: WriteOptions): Promise<void>
	append(data: WriteData): Promise<void>
	truncate(size: number): Promise<void>

	// Streaming
	openWritable(): Promise<WritableFileInterface>

	// Permissions
	hasReadPermission(): Promise<boolean>
	hasWritePermission(): Promise<boolean>
	requestWritePermission(): Promise<boolean>

	// Comparison
	isSameEntry(other: FileInterface | DirectoryInterface): Promise<boolean>
}
```

### Implementation Checklist

- [x] Create `src/core/file/File.ts`
- [x] Implement constructor accepting `FileSystemFileHandle`
- [x] Implement `getName()` — returns handle name
- [x] Implement `getMetadata()` — returns file stats
- [x] Implement `getText()` — reads as text
- [x] Implement `getArrayBuffer()` — reads as binary
- [x] Implement `getBlob()` — returns Blob
- [x] Implement `getStream()` — returns readable stream
- [x] Implement `write()` — atomic write operation
- [x] Implement `append()` — append to file
- [x] Implement `truncate()` — resize file
- [x] Implement `openWritable()` — returns WritableFileInterface
- [x] Implement permission methods
- [x] Implement `isSameEntry()`
- [x] Add to barrel export

### Acceptance Criteria

```typescript
describe('File', () => {
	it('reads text content', async () => {
		const file = fromFileHandle(nativeHandle)
		await file.write('Hello, World!')
		expect(await file.getText()).toBe('Hello, World!')
	})

	it('provides file metadata', async () => {
		const file = fromFileHandle(nativeHandle)
		const metadata = await file.getMetadata()
		expect(metadata.name).toBe('test.txt')
		expect(typeof metadata.size).toBe('number')
	})
})
```

### Blocked By

- Phase 1 (types.ts must be complete)

### Blocks

- 2.5 (Factory functions) — needs File class
- Phase 3 (FileSystemInterface) — needs File and Directory

## Notes

- Use `#` private fields for internal state
- Write operations should be atomic by default (temp file swap)
- Permission methods only relevant for File System Access API handles
- OPFS handles have implicit permissions

## Phase Completion Criteria

All of the following must be true:

- [x] All deliverables marked ✅ Done
- [x] `npm run check` passes
- [x] `npm run test` passes with >80% coverage on new code
- [x] No `it.todo()` remaining in phase scope
- [x] PLAN.md updated to show Phase 2 complete
