# Project Plan: @mikesaintsg/filesystem

> **Status:** Phase 4 of 4 — Polish (Complete)
> **Last Updated:** 2026-01-13
> **Next Milestone:** Ready for npm publish

## Vision

A type-safe, Promise-based wrapper around browser File System APIs that **enhances** native APIs without abstracting them away. Developers get full TypeScript support, unified interfaces across OPFS, File System Access API, File API, and drag-drop entries, with zero runtime dependencies. Every wrapper exposes its underlying native handle via `.native` for escape hatch access.

## Non-Goals

Explicit boundaries. What we are NOT building:

- ❌ Node.js file system support (browser-only library)
- ❌ Polyfills for unsupported browsers
- ❌ Virtual file systems or in-memory storage
- ❌ File content parsing (JSON, CSV, etc.)
- ❌ File synchronization or cloud storage
- ❌ Encryption or compression utilities

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FileSystemInterface                       │
├─────────────────────────────────────────────────────────────┤
│  getRoot()              → OPFS (universal support)          │
│  showOpenFilePicker()   → File System Access (Chromium)     │
│  fromDataTransferItem() → Entries API fallback              │
│  fromFile()             → File API (input elements)         │
└─────────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   ┌───────────┐    ┌───────────────┐   ┌─────────────────────┐
   │  FileInterface │    │DirectoryInterface│   │WritableFileInterface│
   └───────────┘    └───────────────┘   └─────────────────────┘
         │                 │
         │                 ├── entries() → AsyncIterable
         │                 ├── files() → AsyncIterable
         │                 ├── directories() → AsyncIterable
         │                 └── walk() → AsyncIterable<WalkEntry>
         │
         ├── getText() / getArrayBuffer() / getBlob() / getStream()
         ├── write() / append() / truncate()
         └── openWritable() → WritableFileInterface
```

**Components:**

1. **FileSystemInterface** — Main entry point; creates file system instance, accesses OPFS root, file pickers, and converts drag-drop/File API sources
2. **FileInterface** — Wraps `FileSystemFileHandle`; read/write operations, metadata, permissions, stream access
3. **DirectoryInterface** — Wraps `FileSystemDirectoryHandle`; create/get/remove files and directories, iteration, path operations
4. **WritableFileInterface** — Wraps `FileSystemWritableFileStream`; streaming writes, seek, truncate
5. **SyncAccessHandleInterface** — Wraps `FileSystemSyncAccessHandle`; synchronous operations in Workers
6. **Error Classes** — Typed error hierarchy: `NotFoundError`, `NotAllowedError`, `QuotaExceededError`, etc.

## Phases

| # | Phase | Status | Description |
|---|-------|--------|-------------|
| 1 | Foundation | ✅ Complete | Types, project structure, error classes |
| 2 | Core API | ✅ Complete | FileInterface, DirectoryInterface, WritableFileInterface |
| 3 | Integration | ✅ Complete | FileSystemInterface, pickers, drag-drop, File API |
| 4 | Polish | ✅ Complete | Docs, showcase, edge cases, comprehensive tests |

**Status Legend:**
- ✅ Complete
- 🔄 Active
- ⏳ Pending

## Decisions Log

### 2026-01-13: Method Semantics Pattern
**Decision:** Use `get*` for optional lookup (returns undefined), `resolve*` for required lookup (throws), `create*` for always-create operations
**Rationale:** Matches the pattern established in @mikesaintsg/indexeddb for consistency across libraries
**Alternatives rejected:** Single method with boolean flag, separate `*OrThrow` methods

### 2026-01-13: Native Access Pattern
**Decision:** Every wrapper exposes `.native` property for direct access to underlying browser handle
**Rationale:** Allows escape hatch for features not exposed by wrapper, debugging, and interop with other libraries
**Alternatives rejected:** Hiding native handles entirely, requiring explicit unwrap method

### 2026-01-13: Error Class Hierarchy
**Decision:** Create typed error classes extending base `FileSystemError` with error codes
**Rationale:** Enables type-safe error handling with `instanceof` checks and discriminant patterns
**Alternatives rejected:** Using native DOMException directly, string-based error codes

## Open Questions

- [ ] Should `walk()` support a `signal` option for AbortController integration?
- [ ] Should we provide convenience methods for common patterns like `copyFile()`, `moveFile()`?
- [ ] Should `SyncAccessHandleInterface` be a separate export or integrated into `FileInterface`?

## References

- [File System Access API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)
- [Origin Private File System (OPFS)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
- [File and Directory Entries API](https://developer.mozilla.org/en-US/docs/Web/API/File_and_Directory_Entries_API)
- [File API](https://developer.mozilla.org/en-US/docs/Web/API/File_API)
