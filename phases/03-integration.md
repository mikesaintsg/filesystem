# Phase 3: Integration

> **Status:** ✅ Complete
> **Started:** 2026-01-13
> **Completed:** 2026-01-13
> **Depends on:** Phase 2 (Core API) ✅ Complete

## Objective

Implement the main `FileSystemInterface` entry point with all source adapters. By end of phase, the library will support OPFS access, file pickers (Chromium), drag-drop integration, and File API input conversion.

## Deliverables

| # | Deliverable | Status | Assignee |
|---|-------------|--------|----------|
| 3.1 | `FileSystem` class implementing `FileSystemInterface` | ✅ Done | — |
| 3.2 | `createFileSystem()` factory function | ✅ Done | — |
| 3.3 | OPFS access via `getRoot()` | ✅ Done | — |
| 3.4 | Storage quota via `getQuota()` | ✅ Done | — |
| 3.5 | File picker integration (Chromium) | ✅ Done | — |
| 3.6 | DataTransfer/drag-drop integration | ✅ Done | — |
| 3.7 | File API integration (`fromFile`, `fromFiles`) | ✅ Done | — |
| 3.8 | Unit tests for FileSystem class | ✅ Done | — |
| 3.9 | Integration tests for all sources | ✅ Done | — |

**Status Legend:**
- ✅ Done
- 🔄 Active
- ⏳ Pending

## Current Focus: Complete

### Requirements

1. Implement main entry point class
2. Support OPFS access (universal browser support)
3. Support File System Access API pickers (Chromium only)
4. Support drag-drop file/folder conversion
5. Support File API input element conversion
6. Feature detection for picker availability

### Interface Contract

```typescript
// From src/types.ts
export interface FileSystemInterface {
	// OPFS Access
	getRoot(): Promise<DirectoryInterface>
	getQuota(): Promise<StorageQuota>

	// Feature Detection
	isUserAccessSupported(): boolean

	// File Pickers (Chromium only)
	showOpenFilePicker(options?: OpenFilePickerOptions): Promise<readonly FileInterface[]>
	showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileInterface>
	showDirectoryPicker(options?: DirectoryPickerOptions): Promise<DirectoryInterface>

	// Source Adapters
	fromDataTransferItem(item: DataTransferItem): Promise<FileInterface | DirectoryInterface | null>
	fromDataTransferItems(items: DataTransferItemList): Promise<readonly (FileInterface | DirectoryInterface)[]>
	fromFile(file: File): Promise<FileInterface>
	fromFiles(files: FileList): Promise<readonly FileInterface[]>
}
```

### Implementation Checklist

- [ ] Create `src/core/filesystem/FileSystem.ts`
- [ ] Implement `getRoot()` — returns OPFS root directory
- [ ] Implement `getQuota()` — returns storage quota info
- [ ] Implement `isUserAccessSupported()` — feature detection
- [ ] Implement `showOpenFilePicker()` — opens file picker dialog
- [ ] Implement `showSaveFilePicker()` — opens save dialog
- [ ] Implement `showDirectoryPicker()` — opens directory picker
- [ ] Implement `fromDataTransferItem()` — converts single drag-drop item
- [ ] Implement `fromDataTransferItems()` — converts multiple items
- [ ] Implement `fromFile()` — wraps File API object
- [ ] Implement `fromFiles()` — wraps FileList
- [ ] Create `createFileSystem()` factory function
- [ ] Add to barrel export

### Acceptance Criteria

```typescript
describe('FileSystem', () => {
	it('accesses OPFS root directory', async () => {
		const fs = await createFileSystem()
		const root = await fs.getRoot()
		expect(root.getName()).toBe('')
	})

	it('reports storage quota', async () => {
		const fs = await createFileSystem()
		const quota = await fs.getQuota()
		expect(typeof quota.usage).toBe('number')
		expect(typeof quota.quota).toBe('number')
	})

	it('detects picker support', async () => {
		const fs = await createFileSystem()
		expect(typeof fs.isUserAccessSupported()).toBe('boolean')
	})
})
```

### Blocked By

- Phase 2 (File and Directory implementations)

### Blocks

- Phase 4 (Showcase and documentation)

## Notes

- OPFS is supported in all modern browsers
- File pickers are Chromium-only; check `isUserAccessSupported()` first
- Drag-drop uses File and Directory Entries API as fallback
- File API wrapping creates read-only FileInterface instances
- For File API source, write operations should throw `NotAllowedError`

## Phase Completion Criteria

All of the following must be true:

- [ ] All deliverables marked ✅ Done
- [ ] `npm run check` passes
- [ ] `npm run test` passes with >80% coverage on new code
- [ ] No `it.todo()` remaining in phase scope
- [ ] PLAN.md updated to show Phase 3 complete
