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
 * @returns Promise resolving to FileSystemInterface
 * @throws NotSupportedError if OPFS is not available
 *
 * @example
 * ```ts
 * const fs = await createFileSystem()
 * const root = await fs.getRoot()
 * const file = await root.createFile('hello.txt')
 * await file.write('Hello, World!')
 * ```
 */
export function createFileSystem(): Promise<FileSystemInterface> {
	if (!isOPFSSupported()) {
		return Promise.reject(new NotSupportedError('Origin Private File System is not supported in this browser'))
	}

	return Promise.resolve(new FileSystem())
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
