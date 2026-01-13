# Phase 1: Foundation

> **Status:** ✅ Complete
> **Started:** 2026-01-13
> **Completed:** 2026-01-13
> **Depends on:** None

## Objective

Establish the complete type system and project structure for the filesystem library. By end of phase, all interfaces, types, error classes, and type guards will be defined in `src/types.ts`, with helper functions in `src/helpers.ts` and the barrel export configured.

## Deliverables

| # | Deliverable | Status | Assignee |
|---|-------------|--------|----------|
| 1.1 | Complete `src/types.ts` with all interfaces | ✅ Done | — |
| 1.2 | Error classes in `src/errors.ts` | ✅ Done | — |
| 1.3 | Helper functions and type guards in `src/helpers.ts` | ✅ Done | — |
| 1.4 | Constants in `src/constants.ts` | ✅ Done | — |
| 1.5 | Factory function stubs in `src/factories.ts` | ✅ Done | — |
| 1.6 | Barrel exports in `src/index.ts` | ✅ Done | — |
| 1.7 | Test setup in `tests/setup.ts` | ✅ Done | — |
| 1.8 | Unit tests for helpers and type guards | ✅ Done | — |

**Status Legend:**
- ✅ Done
- 🔄 Active
- ⏳ Pending

## Current Focus: Complete

### Requirements

1. Define all public interfaces following naming conventions (`Interface` suffix for behavioral)
2. Define all data-only types (no suffix): `FileMetadata`, `DirectoryEntry`, `StorageQuota`, `WalkEntry`, `WalkOptions`, `WriteOptions`
3. Define error code type `FileSystemErrorCode`
4. Use `readonly` for all interface properties and return types
5. Follow the method naming taxonomy from copilot-instructions

### Interface Contract

```typescript
// Core interfaces to define
export interface FileSystemInterface { /* main entry point */ }
export interface FileInterface { /* file operations */ }
export interface DirectoryInterface { /* directory operations */ }
export interface WritableFileInterface { /* streaming writes */ }
export interface SyncAccessHandleInterface { /* sync operations in Workers */ }

// Data types
export interface FileMetadata { /* file stats */ }
export interface DirectoryEntry { /* iteration entry */ }
export interface StorageQuota { /* quota info */ }
export interface WalkEntry { /* recursive walk entry */ }
export interface WalkOptions { /* walk configuration */ }
export interface WriteOptions { /* write configuration */ }

// Error types
export type FileSystemErrorCode = 'NOT_FOUND' | 'NOT_ALLOWED' | /* ... */
export interface FileSystemError extends Error { /* base error */ }
```

### Implementation Checklist

- [x] Create `src/types.ts` with all interfaces
- [x] Define `Unsubscribe` type alias
- [x] Define `EntryKind` type
- [x] Define `FileMetadata` interface
- [x] Define `DirectoryEntry` interface
- [x] Define `StorageQuota` interface
- [x] Define `WalkEntry` interface
- [x] Define `WalkOptions` interface
- [x] Define `WriteOptions` interface
- [x] Define `WriteData` type
- [x] Define `FileSystemErrorCode` type
- [x] Define `FileInterface`
- [x] Define `DirectoryInterface`
- [x] Define `WritableFileInterface`
- [x] Define `SyncAccessHandleInterface`
- [x] Define `FileSystemInterface`
- [x] Define picker option types

### Acceptance Criteria

```typescript
// These imports must work without errors
import type {
	FileSystemInterface,
	FileInterface,
	DirectoryInterface,
	WritableFileInterface,
	SyncAccessHandleInterface,
	FileMetadata,
	DirectoryEntry,
	StorageQuota,
	WalkEntry,
	WalkOptions,
	WriteOptions,
	WriteData,
	EntryKind,
	FileSystemErrorCode,
} from '~/src/types.js'

// Type checking must pass
const entry: DirectoryEntry = {
	name: 'test.txt',
	kind: 'file',
	handle: {} as FileSystemHandle,
}
```

### Blocked By

Nothing currently.

### Blocks

- 1.2 (Error classes) — needs error code types from types.ts
- 1.3 (Helpers) — needs interfaces for type guards
- 1.5 (Factories) — needs interfaces for return types

## Notes

- All interfaces must expose `.native` property for underlying browser handle
- Use `readonly` arrays and return types
- Follow method naming: `get*`, `resolve*`, `create*`, `has*`, `is*`, `remove*`
- Async iterables for `entries()`, `files()`, `directories()`, `walk()`
- Permission methods: `hasReadPermission()`, `hasWritePermission()`, `requestWritePermission()`

## Phase Completion Criteria

All of the following must be true:

- [x] All deliverables marked ✅ Done
- [x] `npm run check` passes
- [x] `npm run format` passes
- [x] No `it.todo()` remaining in phase scope
- [x] PLAN.md updated to show Phase 1 complete
