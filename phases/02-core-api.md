# Phase 2: Core API

> **Status:** ⏳ Pending
> **Started:** —
> **Target:** —
> **Depends on:** Phase 1 (Foundation) ⏳ Pending

## Objective

Implement the core file and directory operations. By end of phase, `FileInterface` and `DirectoryInterface` implementations will be complete with full read/write capabilities, directory iteration, and path-based operations.

## Deliverables

| # | Deliverable | Status | Assignee |
|---|-------------|--------|----------|
| 2.1 | `File` class implementing `FileInterface` | ⏳ Pending | — |
| 2.2 | `Directory` class implementing `DirectoryInterface` | ⏳ Pending | — |
| 2.3 | `WritableFile` class implementing `WritableFileInterface` | ⏳ Pending | — |
| 2.4 | `SyncAccessHandle` class implementing `SyncAccessHandleInterface` | ⏳ Pending | — |
| 2.5 | Factory functions: `fromFileHandle()`, `fromDirectoryHandle()` | ⏳ Pending | — |
| 2.6 | Unit tests for File class | ⏳ Pending | — |
| 2.7 | Unit tests for Directory class | ⏳ Pending | — |
| 2.8 | Unit tests for WritableFile class | ⏳ Pending | — |

**Status Legend:**
- ✅ Done
- 🔄 Active
- ⏳ Pending

## Current Focus: 2.1 File Implementation

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

- [ ] Create `src/core/file/File.ts`
- [ ] Implement constructor accepting `FileSystemFileHandle`
- [ ] Implement `getName()` — returns handle name
- [ ] Implement `getMetadata()` — returns file stats
- [ ] Implement `getText()` — reads as text
- [ ] Implement `getArrayBuffer()` — reads as binary
- [ ] Implement `getBlob()` — returns Blob
- [ ] Implement `getStream()` — returns readable stream
- [ ] Implement `write()` — atomic write operation
- [ ] Implement `append()` — append to file
- [ ] Implement `truncate()` — resize file
- [ ] Implement `openWritable()` — returns WritableFileInterface
- [ ] Implement permission methods
- [ ] Implement `isSameEntry()`
- [ ] Add to barrel export

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

- [ ] All deliverables marked ✅ Done
- [ ] `npm run check` passes
- [ ] `npm run test` passes with >80% coverage on new code
- [ ] No `it.todo()` remaining in phase scope
- [ ] PLAN.md updated to show Phase 2 complete
