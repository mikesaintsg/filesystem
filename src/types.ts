/**
 * @mikesaintsg/filesystem
 *
 * Type definitions for the filesystem library.
 * All public types and interfaces are defined here as the SOURCE OF TRUTH.
 */

// ============================================================================
// Utility Types
// ============================================================================

/** Cleanup function returned by event subscriptions */
export type Unsubscribe = () => void

// ============================================================================
// Entry Types
// ============================================================================

/** Entry kind discriminator */
export type EntryKind = 'file' | 'directory'

// ============================================================================
// Data Types (no Interface suffix - data-only structures)
// ============================================================================

/** File metadata snapshot */
export interface FileMetadata {
	readonly name: string
	readonly size: number
	readonly type: string
	readonly lastModified: number
}

/** Directory entry for iteration */
export interface DirectoryEntry {
	readonly name: string
	readonly kind: EntryKind
	readonly handle: FileSystemHandle
}

/** Storage quota information */
export interface StorageQuota {
	readonly usage: number
	readonly quota: number
	readonly available: number
	readonly percentUsed: number
}

/** Walk entry with path info */
export interface WalkEntry {
	readonly path: readonly string[]
	readonly entry: DirectoryEntry
	readonly depth: number
}

/** Walk options */
export interface WalkOptions {
	readonly maxDepth?: number
	readonly includeFiles?: boolean
	readonly includeDirectories?: boolean
	readonly filter?: (entry: DirectoryEntry, depth: number) => boolean
}

/** Write operation data types */
export type WriteData =
	| string
	| BufferSource
	| Blob
	| ReadableStream<Uint8Array>

/** Write options */
export interface WriteOptions {
	readonly position?: number
	readonly keepExistingData?: boolean
}

/** Remove directory options */
export interface RemoveDirectoryOptions {
	readonly recursive?: boolean
}

// ============================================================================
// Storage Adapter Types
// ============================================================================

/** Directory entry for adapter iteration (handle-agnostic) */
export interface AdapterDirectoryEntry {
	readonly name: string
	readonly kind: EntryKind
}

/** Internal representation of a file or directory entry for InMemoryAdapter */
export interface MemoryEntry {
	path: string
	name: string
	parent: string
	kind: 'file' | 'directory'
	content?: ArrayBuffer
	lastModified?: number
}

/** Exported file entry for migration */
export interface ExportedFileEntry {
	readonly path: string
	readonly name: string
	readonly kind: 'file'
	readonly content: ArrayBuffer
	readonly lastModified: number
}

/** Exported directory entry for migration */
export interface ExportedDirectoryEntry {
	readonly path: string
	readonly name: string
	readonly kind: 'directory'
}

/** Exported entry union type */
export type ExportedEntry = ExportedFileEntry | ExportedDirectoryEntry

/** Exported file system data for migration */
export interface ExportedFileSystem {
	readonly version: number
	readonly exportedAt: number
	readonly entries: readonly ExportedEntry[]
}

/** Export options */
export interface ExportOptions {
	readonly includePaths?: readonly string[]
	readonly excludePaths?: readonly string[]
}

/** Import options */
export interface ImportOptions {
	readonly overwrite?: boolean
	readonly mergeBehavior?: 'replace' | 'skip' | 'error'
}

/** Copy options */
export interface CopyOptions {
	readonly overwrite?: boolean
}

/** Move options */
export interface MoveOptions {
	readonly overwrite?: boolean
}

/**
 * Storage adapter interface for pluggable backends.
 * All adapters implement this exact contract with identical method signatures.
 */
export interface StorageAdapterInterface {
	/** Checks if this adapter is available in the current environment. */
	isAvailable(): Promise<boolean>

	/** Initializes the adapter. */
	init(): Promise<void>

	/** Closes the adapter and releases resources. */
	close(): void

	// ---- File Operations ----

	/** Reads file content as text. */
	getFileText(path: string): Promise<string>

	/** Reads file content as ArrayBuffer. */
	getFileArrayBuffer(path: string): Promise<ArrayBuffer>

	/** Reads file content as Blob. */
	getFileBlob(path: string): Promise<Blob>

	/** Gets file metadata. */
	getFileMetadata(path: string): Promise<FileMetadata>

	/** Writes data to a file. */
	writeFile(path: string, data: WriteData, options?: WriteOptions): Promise<void>

	/** Appends data to a file. */
	appendFile(path: string, data: WriteData): Promise<void>

	/** Truncates a file to specified size. */
	truncateFile(path: string, size: number): Promise<void>

	/** Checks if a file exists at the path. */
	hasFile(path: string): Promise<boolean>

	/** Removes a file. */
	removeFile(path: string): Promise<void>

	/** Copies a file from source to destination. */
	copyFile(sourcePath: string, destinationPath: string, options?: CopyOptions): Promise<void>

	/** Moves a file from source to destination. */
	moveFile(sourcePath: string, destinationPath: string, options?: MoveOptions): Promise<void>

	// ---- Directory Operations ----

	/** Creates a directory at the path. */
	createDirectory(path: string): Promise<void>

	/** Checks if a directory exists at the path. */
	hasDirectory(path: string): Promise<boolean>

	/** Removes a directory. */
	removeDirectory(path: string, options?: RemoveDirectoryOptions): Promise<void>

	/** Lists entries in a directory. */
	listEntries(path: string): Promise<readonly AdapterDirectoryEntry[]>

	// ---- Quota & Migration ----

	/** Gets storage quota information. */
	getQuota(): Promise<StorageQuota>

	/** Exports the file system to a portable format. */
	export(options?: ExportOptions): Promise<ExportedFileSystem>

	/** Imports a file system from exported data. */
	import(data: ExportedFileSystem, options?: ImportOptions): Promise<void>
}

/** Options for creating a file system */
export interface FileSystemOptions {
	readonly adapter?: StorageAdapterInterface
}

// ============================================================================
// Picker Option Types
// ============================================================================

/** File type filter for pickers */
export interface FilePickerAcceptType {
	readonly description?: string
	readonly accept: Record<string, readonly string[]>
}

/** Start-in directory options for pickers */
export type StartInDirectory =
	| 'desktop'
	| 'documents'
	| 'downloads'
	| 'music'
	| 'pictures'
	| 'videos'
	| FileSystemHandle

/** Open file picker options */
export interface OpenFilePickerOptions {
	readonly multiple?: boolean
	readonly excludeAcceptAllOption?: boolean
	readonly types?: readonly FilePickerAcceptType[]
	readonly id?: string
	readonly startIn?: StartInDirectory
}

/** Save file picker options */
export interface SaveFilePickerOptions {
	readonly suggestedName?: string
	readonly excludeAcceptAllOption?: boolean
	readonly types?: readonly FilePickerAcceptType[]
	readonly id?: string
	readonly startIn?: StartInDirectory
}

/** Directory picker options */
export interface DirectoryPickerOptions {
	readonly id?: string
	readonly startIn?: StartInDirectory
	readonly mode?: 'read' | 'readwrite'
}

// ============================================================================
// Error Types
// ============================================================================

/** Error code type */
export type FileSystemErrorCode =
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

/** Base file system error interface */
export interface FileSystemErrorData {
	readonly code: FileSystemErrorCode
	readonly path?: string
	readonly cause?: Error
}

// ============================================================================
// Behavioral Interfaces (with Interface suffix)
// ============================================================================

/**
 * File interface - wraps FileSystemFileHandle
 *
 * Provides type-safe, Promise-based access to file operations
 * with full read/write capabilities.
 */
export interface FileInterface {
	/** Native file handle for escape hatch access */
	readonly native: FileSystemFileHandle

	// ---- Accessors ----

	/** Gets the file name */
	getName(): string

	/** Gets file metadata (name, size, type, lastModified) */
	getMetadata(): Promise<FileMetadata>

	// ---- Reading ----

	/** Reads file content as text */
	getText(): Promise<string>

	/** Reads file content as ArrayBuffer */
	getArrayBuffer(): Promise<ArrayBuffer>

	/** Reads file content as Blob */
	getBlob(): Promise<Blob>

	/** Gets a readable stream of file content */
	getStream(): ReadableStream<Uint8Array>

	// ---- Writing ----

	/**
	 * Writes data to the file (atomic operation)
	 * @param data - Data to write
	 * @param options - Write options
	 */
	write(data: WriteData, options?: WriteOptions): Promise<void>

	/**
	 * Appends data to the end of the file
	 * @param data - Data to append
	 */
	append(data: WriteData): Promise<void>

	/**
	 * Truncates the file to specified size
	 * @param size - New file size in bytes
	 */
	truncate(size: number): Promise<void>

	// ---- Streaming ----

	/** Opens a writable stream for the file */
	openWritable(): Promise<WritableFileInterface>

	// ---- Permissions ----

	/** Checks if read permission is granted */
	hasReadPermission(): Promise<boolean>

	/** Checks if write permission is granted */
	hasWritePermission(): Promise<boolean>

	/** Requests write permission from user */
	requestWritePermission(): Promise<boolean>

	// ---- Comparison ----

	/**
	 * Checks if this file is the same as another entry
	 * @param other - Entry to compare against
	 */
	isSameEntry(other: FileInterface | DirectoryInterface): Promise<boolean>
}

/**
 * Directory interface - wraps FileSystemDirectoryHandle
 *
 * Provides type-safe access to directory operations including
 * file/directory creation, iteration, and path-based operations.
 */
export interface DirectoryInterface {
	/** Native directory handle for escape hatch access */
	readonly native: FileSystemDirectoryHandle

	// ---- Accessors ----

	/** Gets the directory name */
	getName(): string

	// ---- File Operations ----

	/**
	 * Gets a file by name (returns undefined if not found)
	 * @param name - File name
	 */
	getFile(name: string): Promise<FileInterface | undefined>

	/**
	 * Gets a file by name (throws NotFoundError if not found)
	 * @param name - File name
	 */
	resolveFile(name: string): Promise<FileInterface>

	/**
	 * Creates a file (overwrites if exists)
	 * @param name - File name
	 */
	createFile(name: string): Promise<FileInterface>

	/**
	 * Checks if a file exists
	 * @param name - File name
	 */
	hasFile(name: string): Promise<boolean>

	/**
	 * Removes a file
	 * @param name - File name
	 */
	removeFile(name: string): Promise<void>

	/**
	 * Copies a file to a destination
	 * @param source - Source file name
	 * @param destination - Destination file name or directory
	 * @param options - Copy options
	 */
	copyFile(source: string, destination: string | DirectoryInterface, options?: CopyOptions): Promise<FileInterface>

	/**
	 * Moves a file to a destination
	 * @param source - Source file name
	 * @param destination - Destination file name or directory
	 * @param options - Move options
	 */
	moveFile(source: string, destination: string | DirectoryInterface, options?: MoveOptions): Promise<FileInterface>

	// ---- Directory Operations ----

	/**
	 * Gets a subdirectory by name (returns undefined if not found)
	 * @param name - Directory name
	 */
	getDirectory(name: string): Promise<DirectoryInterface | undefined>

	/**
	 * Gets a subdirectory by name (throws NotFoundError if not found)
	 * @param name - Directory name
	 */
	resolveDirectory(name: string): Promise<DirectoryInterface>

	/**
	 * Creates a subdirectory (creates if not exists)
	 * @param name - Directory name
	 */
	createDirectory(name: string): Promise<DirectoryInterface>

	/**
	 * Checks if a subdirectory exists
	 * @param name - Directory name
	 */
	hasDirectory(name: string): Promise<boolean>

	/**
	 * Removes a subdirectory
	 * @param name - Directory name
	 * @param options - Removal options
	 */
	removeDirectory(name: string, options?: RemoveDirectoryOptions): Promise<void>

	// ---- Path Operations ----

	/**
	 * Resolves a path to a file or directory
	 * @param segments - Path segments
	 */
	resolvePath(...segments: readonly string[]): Promise<FileInterface | DirectoryInterface | undefined>

	/**
	 * Creates nested directories (like mkdir -p)
	 * @param segments - Path segments
	 */
	createPath(...segments: readonly string[]): Promise<DirectoryInterface>

	// ---- Iteration ----

	/** Iterates all entries (files and directories) */
	entries(): AsyncIterable<DirectoryEntry>

	/** Iterates files only */
	files(): AsyncIterable<FileInterface>

	/** Iterates subdirectories only */
	directories(): AsyncIterable<DirectoryInterface>

	/** Lists all entries as array */
	list(): Promise<readonly DirectoryEntry[]>

	/** Lists all files as array */
	listFiles(): Promise<readonly FileInterface[]>

	/** Lists all subdirectories as array */
	listDirectories(): Promise<readonly DirectoryInterface[]>

	/**
	 * Recursively walks directory tree
	 * @param options - Walk options
	 */
	walk(options?: WalkOptions): AsyncIterable<WalkEntry>

	// ---- Permissions ----

	/** Checks if read permission is granted */
	hasReadPermission(): Promise<boolean>

	/** Checks if write permission is granted */
	hasWritePermission(): Promise<boolean>

	/** Requests write permission from user */
	requestWritePermission(): Promise<boolean>

	// ---- Comparison ----

	/**
	 * Checks if this directory is the same as another entry
	 * @param other - Entry to compare against
	 */
	isSameEntry(other: FileInterface | DirectoryInterface): Promise<boolean>

	/**
	 * Gets relative path from this directory to a descendant entry
	 * @param descendant - Descendant entry
	 * @returns Path segments or null if not a descendant
	 */
	resolve(descendant: FileInterface | DirectoryInterface): Promise<readonly string[] | null>
}

/**
 * Writable file interface - wraps FileSystemWritableFileStream
 *
 * Provides streaming write access to files with seek and truncate.
 */
export interface WritableFileInterface {
	/** Native writable stream for escape hatch access */
	readonly native: FileSystemWritableFileStream

	/**
	 * Writes data at current position
	 * @param data - Data to write
	 */
	write(data: WriteData): Promise<void>

	/**
	 * Moves cursor to byte position
	 * @param position - Byte position
	 */
	seek(position: number): Promise<void>

	/**
	 * Resizes file to specified bytes
	 * @param size - New file size
	 */
	truncate(size: number): Promise<void>

	/** Commits changes and closes stream */
	close(): Promise<void>

	/** Discards changes and closes stream */
	abort(): Promise<void>
}

/**
 * Sync access handle interface - wraps FileSystemSyncAccessHandle
 *
 * Provides synchronous file access for high-performance operations
 * in Web Workers only.
 */
export interface SyncAccessHandleInterface {
	/** Native sync access handle for escape hatch access */
	readonly native: FileSystemSyncAccessHandle

	/** Gets file size in bytes */
	getSize(): number

	/**
	 * Reads bytes into buffer
	 * @param buffer - Buffer to read into
	 * @param options - Read options
	 * @returns Number of bytes read
	 */
	read(buffer: ArrayBufferView, options?: { at?: number }): number

	/**
	 * Writes buffer to file
	 * @param buffer - Buffer to write
	 * @param options - Write options
	 * @returns Number of bytes written
	 */
	write(buffer: ArrayBufferView, options?: { at?: number }): number

	/**
	 * Resizes file to new size
	 * @param newSize - New file size
	 */
	truncate(newSize: number): void

	/** Persists changes to disk */
	flush(): void

	/** Releases lock on file */
	close(): void
}

/**
 * Main file system interface
 *
 * Entry point for all file system operations. Provides access to
 * OPFS, file pickers (Chromium), drag-drop integration, and File API.
 */
export interface FileSystemInterface {
	// ---- OPFS Access ----

	/** Gets the OPFS root directory */
	getRoot(): Promise<DirectoryInterface>

	/** Gets storage quota information */
	getQuota(): Promise<StorageQuota>

	// ---- Feature Detection ----

	/** Checks if file picker dialogs are supported (Chromium only) */
	isUserAccessSupported(): boolean

	// ---- File Pickers (Chromium Only) ----

	/**
	 * Opens file picker dialog
	 * @param options - Picker options
	 */
	showOpenFilePicker(options?: OpenFilePickerOptions): Promise<readonly FileInterface[]>

	/**
	 * Opens save file picker dialog
	 * @param options - Picker options
	 */
	showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileInterface>

	/**
	 * Opens directory picker dialog
	 * @param options - Picker options
	 */
	showDirectoryPicker(options?: DirectoryPickerOptions): Promise<DirectoryInterface>

	// ---- Source Adapters ----

	/**
	 * Converts a DataTransferItem to file or directory interface
	 * @param item - DataTransferItem from drag-drop event
	 */
	fromDataTransferItem(item: DataTransferItem): Promise<FileInterface | DirectoryInterface | null>

	/**
	 * Converts DataTransferItemList to array of file/directory interfaces
	 * @param items - DataTransferItemList from drag-drop event
	 */
	fromDataTransferItems(items: DataTransferItemList): Promise<readonly (FileInterface | DirectoryInterface)[]>

	/**
	 * Wraps a File API object
	 * @param file - File from input element
	 */
	fromFile(file: File): Promise<FileInterface>

	/**
	 * Wraps a FileList
	 * @param files - FileList from input element
	 */
	fromFiles(files: FileList): Promise<readonly FileInterface[]>

	// ---- Migration ----

	/**
	 * Exports the file system to a portable format
	 * @param options - Export options
	 */
	export(options?: ExportOptions): Promise<ExportedFileSystem>

	/**
	 * Imports a file system from exported data
	 * @param data - Exported file system data
	 * @param options - Import options
	 */
	import(data: ExportedFileSystem, options?: ImportOptions): Promise<void>

	// ---- Lifecycle ----

	/** Closes the file system and releases resources */
	close(): void
}
