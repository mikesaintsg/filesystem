/**
 * @mikesaintsg/filesystem
 *
 * ReadOnlyFile class implementing FileInterface for read-only sources.
 * Wraps a native File object without a handle, so write operations throw.
 */

import type { FileInterface, DirectoryInterface, FileMetadata } from '../../types.js'
import { NotSupportedError } from '../../errors.js'

/**
 * Read-only file wrapper for File API sources.
 * Wraps a native File object without a handle, so write operations throw.
 */
export class ReadOnlyFile implements FileInterface {
	readonly #file: globalThis.File
	#handle: FileSystemFileHandle | null = null

	constructor(file: globalThis.File) {
		this.#file = file
	}

	get native(): FileSystemFileHandle {
		if (!this.#handle) {
			// Create a minimal handle-like object for compatibility
			// This is a shim for File API sources which don't have real handles
			throw new NotSupportedError('File API sources do not have native handles')
		}
		return this.#handle
	}

	getName(): string {
		return this.#file.name
	}

	getMetadata(): Promise<FileMetadata> {
		return Promise.resolve({
			name: this.#file.name,
			size: this.#file.size,
			type: this.#file.type,
			lastModified: this.#file.lastModified,
		})
	}

	getText(): Promise<string> {
		return this.#file.text()
	}

	getArrayBuffer(): Promise<ArrayBuffer> {
		return this.#file.arrayBuffer()
	}

	getBlob(): Promise<Blob> {
		return Promise.resolve(this.#file)
	}

	getStream(): ReadableStream<Uint8Array> {
		return this.#file.stream()
	}

	write(): Promise<void> {
		return Promise.reject(new NotSupportedError('Cannot write to File API sources'))
	}

	append(): Promise<void> {
		return Promise.reject(new NotSupportedError('Cannot write to File API sources'))
	}

	truncate(): Promise<void> {
		return Promise.reject(new NotSupportedError('Cannot write to File API sources'))
	}

	openWritable(): Promise<never> {
		return Promise.reject(new NotSupportedError('Cannot write to File API sources'))
	}

	hasReadPermission(): Promise<boolean> {
		return Promise.resolve(true)
	}

	hasWritePermission(): Promise<boolean> {
		return Promise.resolve(false)
	}

	requestWritePermission(): Promise<boolean> {
		return Promise.resolve(false)
	}

	isSameEntry(other: FileInterface | DirectoryInterface): Promise<boolean> {
		if (other instanceof ReadOnlyFile) {
			return Promise.resolve(this.#file === other.#file)
		}
		return Promise.resolve(false)
	}
}
