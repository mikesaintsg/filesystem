/**
 * @mikesaintsg/filesystem
 *
 * Factory functions for creating file system instances.
 */

import type {
	FileSystemInterface,
	FileInterface,
	DirectoryInterface,
	WritableFileInterface,
	SyncAccessHandleInterface,
	FileSystemOptions,
} from './types.js'
import { NotSupportedError } from './errors.js'
import { isOPFSSupported } from './helpers.js'
import { File } from './core/file/File.js'
import { Directory } from './core/directory/Directory.js'
import { WritableFile } from './core/file/WritableFile.js'
import { SyncAccessHandle } from './core/file/SyncAccessHandle.js'
import { FileSystem } from './core/filesystem/FileSystem.js'

/**
 * Creates a file system interface.
 *
 * @param options - Optional configuration including adapter
 * @returns Promise resolving to FileSystemInterface
 * @throws NotSupportedError if OPFS is not available (when no adapter provided)
 *
 * @example
 * ```ts
 * // Default (OPFS)
 * const fs = await createFileSystem()
 * const root = await fs.getRoot()
 * const file = await root.createFile('hello.txt')
 * await file.write('Hello, World!')
 *
 * // With custom adapter
 * const fs = await createFileSystem({ adapter: new InMemoryAdapter() })
 * ```
 */
export async function createFileSystem(options?: FileSystemOptions): Promise<FileSystemInterface> {
	// If an adapter is provided, validate and initialize it
	// Note: The adapter-based FileSystem implementation is in progress.
	// Currently, adapters are validated but the FileSystem still uses native OPFS.
	// Future versions will support fully adapter-based operation.
	if (options?.adapter) {
		const adapter = options.adapter
		if (!await adapter.isAvailable()) {
			throw new NotSupportedError('Storage adapter is not available')
		}
		await adapter.init()
	}

	// Default: use native OPFS
	if (!isOPFSSupported()) {
		throw new NotSupportedError('Origin Private File System is not supported in this browser')
	}

	return new FileSystem()
}

/**
 * Creates a FileInterface from a native FileSystemFileHandle.
 *
 * @param handle - Native file handle
 * @returns FileInterface wrapper
 *
 * @example
 * ```ts
 * const [nativeHandle] = await showOpenFilePicker()
 * const file = fromFileHandle(nativeHandle)
 * console.log(await file.getText())
 * ```
 */
export function fromFileHandle(handle: FileSystemFileHandle): FileInterface {
	return new File(handle)
}

/**
 * Creates a DirectoryInterface from a native FileSystemDirectoryHandle.
 *
 * @param handle - Native directory handle
 * @returns DirectoryInterface wrapper
 *
 * @example
 * ```ts
 * const nativeHandle = await navigator.storage.getDirectory()
 * const directory = fromDirectoryHandle(nativeHandle)
 * for await (const entry of directory.entries()) {
 *   console.log(entry.name)
 * }
 * ```
 */
export function fromDirectoryHandle(handle: FileSystemDirectoryHandle): DirectoryInterface {
	return new Directory(handle)
}

/**
 * Creates a WritableFileInterface from a native FileSystemWritableFileStream.
 *
 * @param stream - Native writable file stream
 * @returns WritableFileInterface wrapper
 *
 * @example
 * ```ts
 * const nativeStream = await fileHandle.createWritable()
 * const writable = fromWritableStream(nativeStream)
 * await writable.write('Hello')
 * await writable.close()
 * ```
 */
export function fromWritableStream(stream: FileSystemWritableFileStream): WritableFileInterface {
	return new WritableFile(stream)
}

/**
 * Creates a SyncAccessHandleInterface from a native FileSystemSyncAccessHandle.
 *
 * @param handle - Native sync access handle
 * @returns SyncAccessHandleInterface wrapper
 *
 * @example
 * ```ts
 * // In a Web Worker
 * const nativeHandle = await fileHandle.createSyncAccessHandle()
 * const syncHandle = fromSyncAccessHandle(nativeHandle)
 * const size = syncHandle.getSize()
 * syncHandle.close()
 * ```
 */
export function fromSyncAccessHandle(handle: FileSystemSyncAccessHandle): SyncAccessHandleInterface {
	return new SyncAccessHandle(handle)
}
