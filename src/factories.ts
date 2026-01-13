/**
 * @mikesaintsg/filesystem
 *
 * Factory functions for creating file system instances.
 */

import type {
	FileSystemInterface,
	FileInterface,
	DirectoryInterface,
} from './types.js'
import { NotSupportedError } from './errors.js'
import { isOPFSSupported } from './helpers.js'

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

	// TODO: Implement FileSystem class in Phase 3
	return Promise.reject(new NotSupportedError('FileSystem implementation pending - Phase 3'))
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
export function fromFileHandle(_handle: FileSystemFileHandle): FileInterface {
	// TODO: Implement File class in Phase 2
	throw new NotSupportedError('File implementation pending - Phase 2')
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
export function fromDirectoryHandle(_handle: FileSystemDirectoryHandle): DirectoryInterface {
	// TODO: Implement Directory class in Phase 2
	throw new NotSupportedError('Directory implementation pending - Phase 2')
}
