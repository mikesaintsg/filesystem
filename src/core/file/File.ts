/**
 * @mikesaintsg/filesystem
 *
 * File class implementing FileInterface.
 * Wraps FileSystemFileHandle for file operations.
 */

import type {
	FileInterface,
	DirectoryInterface,
	FileMetadata,
	WriteData,
	WriteOptions,
	WritableFileInterface,
} from '../../types.js'
import { wrapDOMException, NotAllowedError } from '../../errors.js'
import { WritableFile } from './WritableFile.js'

/**
 * Writes data to a writable stream, handling ReadableStream conversion
 */
async function writeDataToStream(writable: FileSystemWritableFileStream, data: WriteData): Promise<void> {
	if (data instanceof ReadableStream) {
		const reader = data.getReader()
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			// Copy to a new Uint8Array with a plain ArrayBuffer
			const copy = new Uint8Array(value)
			await writable.write(copy.buffer)
		}
	} else {
		await writable.write(data)
	}
}

/**
 * File implementation wrapping FileSystemFileHandle.
 *
 * @example
 * ```ts
 * const file = fromFileHandle(nativeHandle)
 * const content = await file.getText()
 * await file.write('New content')
 * ```
 */
export class File implements FileInterface {
	readonly #handle: FileSystemFileHandle

	constructor(handle: FileSystemFileHandle) {
		this.#handle = handle
	}

	/** Native file handle for escape hatch access */
	get native(): FileSystemFileHandle {
		return this.#handle
	}

	// ---- Accessors ----

	/** Gets the file name */
	getName(): string {
		return this.#handle.name
	}

	/** Gets file metadata (name, size, type, lastModified) */
	async getMetadata(): Promise<FileMetadata> {
		try {
			const file = await this.#handle.getFile()
			return {
				name: file.name,
				size: file.size,
				type: file.type,
				lastModified: file.lastModified,
			}
		} catch (error) {
			throw wrapDOMException(error, this.#handle.name)
		}
	}

	// ---- Reading ----

	/** Reads file content as text */
	async getText(): Promise<string> {
		try {
			const file = await this.#handle.getFile()
			return file.text()
		} catch (error) {
			throw wrapDOMException(error, this.#handle.name)
		}
	}

	/** Reads file content as ArrayBuffer */
	async getArrayBuffer(): Promise<ArrayBuffer> {
		try {
			const file = await this.#handle.getFile()
			return file.arrayBuffer()
		} catch (error) {
			throw wrapDOMException(error, this.#handle.name)
		}
	}

	/** Reads file content as Blob */
	async getBlob(): Promise<Blob> {
		try {
			return this.#handle.getFile()
		} catch (error) {
			throw wrapDOMException(error, this.#handle.name)
		}
	}

	/** Gets a readable stream of file content */
	getStream(): ReadableStream<Uint8Array> {
		// We need to get the file first to access the stream
		// Since getStream should be sync, we create a stream that wraps the async operation
		const handle = this.#handle
		return new ReadableStream<Uint8Array>({
			async start(controller) {
				try {
					const file = await handle.getFile()
					const reader = file.stream().getReader()
					while (true) {
						const { done, value } = await reader.read()
						if (done) {
							controller.close()
							break
						}
						controller.enqueue(value)
					}
				} catch (error) {
					controller.error(wrapDOMException(error))
				}
			},
		})
	}

	// ---- Writing ----

	/**
	 * Writes data to the file (atomic operation)
	 * @param data - Data to write
	 * @param options - Write options
	 */
	async write(data: WriteData, options?: WriteOptions): Promise<void> {
		try {
			const writable = await this.#handle.createWritable({
				keepExistingData: options?.keepExistingData ?? false,
			})

			try {
				if (options?.position !== undefined) {
					await writable.seek(options.position)
				}
				await writeDataToStream(writable, data)
				await writable.close()
			} catch (error) {
				await writable.abort()
				throw error
			}
		} catch (error) {
			throw wrapDOMException(error, this.#handle.name)
		}
	}

	/**
	 * Appends data to the end of the file
	 * @param data - Data to append
	 */
	async append(data: WriteData): Promise<void> {
		try {
			const writable = await this.#handle.createWritable({
				keepExistingData: true,
			})

			try {
				// Seek to end of file
				const file = await this.#handle.getFile()
				await writable.seek(file.size)
				await writeDataToStream(writable, data)
				await writable.close()
			} catch (error) {
				await writable.abort()
				throw error
			}
		} catch (error) {
			throw wrapDOMException(error, this.#handle.name)
		}
	}

	/**
	 * Truncates the file to specified size
	 * @param size - New file size in bytes
	 */
	async truncate(size: number): Promise<void> {
		try {
			const writable = await this.#handle.createWritable({
				keepExistingData: true,
			})

			try {
				await writable.truncate(size)
				await writable.close()
			} catch (error) {
				await writable.abort()
				throw error
			}
		} catch (error) {
			throw wrapDOMException(error, this.#handle.name)
		}
	}

	// ---- Streaming ----

	/** Opens a writable stream for the file */
	async openWritable(): Promise<WritableFileInterface> {
		try {
			const stream = await this.#handle.createWritable()
			return new WritableFile(stream)
		} catch (error) {
			throw wrapDOMException(error, this.#handle.name)
		}
	}

	// ---- Permissions ----

	/** Checks if read permission is granted */
	async hasReadPermission(): Promise<boolean> {
		try {
			const result = await this.#handle.queryPermission({ mode: 'read' })
			return result === 'granted'
		} catch {
			// OPFS handles don't support queryPermission
			return true
		}
	}

	/** Checks if write permission is granted */
	async hasWritePermission(): Promise<boolean> {
		try {
			const result = await this.#handle.queryPermission({ mode: 'readwrite' })
			return result === 'granted'
		} catch {
			// OPFS handles don't support queryPermission
			return true
		}
	}

	/** Requests write permission from user */
	async requestWritePermission(): Promise<boolean> {
		try {
			const result = await this.#handle.requestPermission({ mode: 'readwrite' })
			return result === 'granted'
		} catch (error) {
			// OPFS handles don't support requestPermission
			if (error instanceof TypeError) {
				return true
			}
			throw new NotAllowedError('Permission request failed', this.#handle.name)
		}
	}

	// ---- Comparison ----

	/**
	 * Checks if this file is the same as another entry
	 * @param other - Entry to compare against
	 */
	async isSameEntry(other: FileInterface | DirectoryInterface): Promise<boolean> {
		try {
			return this.#handle.isSameEntry(other.native)
		} catch (error) {
			throw wrapDOMException(error, this.#handle.name)
		}
	}
}
