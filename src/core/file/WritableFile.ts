/**
 * @mikesaintsg/filesystem
 *
 * WritableFile class implementing WritableFileInterface.
 * Wraps FileSystemWritableFileStream for streaming write operations.
 */

import type { WritableFileInterface, WriteData } from '../../types.js'
import { wrapDOMException } from '../../errors.js'

/**
 * Writable file implementation for streaming writes.
 *
 * @example
 * ```ts
 * const writable = await file.openWritable()
 * await writable.write('Hello')
 * await writable.seek(0)
 * await writable.write('J')
 * await writable.close()
 * ```
 */
export class WritableFile implements WritableFileInterface {
	readonly #stream: FileSystemWritableFileStream

	constructor(stream: FileSystemWritableFileStream) {
		this.#stream = stream
	}

	/** Native writable stream for escape hatch access */
	get native(): FileSystemWritableFileStream {
		return this.#stream
	}

	/**
	 * Writes data at current position
	 * @param data - Data to write
	 */
	async write(data: WriteData): Promise<void> {
		try {
			// Handle ReadableStream separately as it's not in FileSystemWriteChunkType
			if (data instanceof ReadableStream) {
				const reader = data.getReader()
				while (true) {
					const { done, value } = await reader.read()
					if (done) break
					// Copy to a new Uint8Array with a plain ArrayBuffer
					const copy = new Uint8Array(value)
					await this.#stream.write(copy.buffer)
				}
			} else {
				await this.#stream.write(data)
			}
		} catch (error) {
			throw wrapDOMException(error)
		}
	}

	/**
	 * Moves cursor to byte position
	 * @param position - Byte position
	 */
	async seek(position: number): Promise<void> {
		try {
			await this.#stream.seek(position)
		} catch (error) {
			throw wrapDOMException(error)
		}
	}

	/**
	 * Resizes file to specified bytes
	 * @param size - New file size
	 */
	async truncate(size: number): Promise<void> {
		try {
			await this.#stream.truncate(size)
		} catch (error) {
			throw wrapDOMException(error)
		}
	}

	/** Commits changes and closes stream */
	async close(): Promise<void> {
		try {
			await this.#stream.close()
		} catch (error) {
			throw wrapDOMException(error)
		}
	}

	/** Discards changes and closes stream */
	async abort(): Promise<void> {
		try {
			await this.#stream.abort()
		} catch (error) {
			throw wrapDOMException(error)
		}
	}
}

/**
 * Creates a WritableFileInterface from a native FileSystemWritableFileStream.
 *
 * @param stream - Native writable file stream
 * @returns WritableFileInterface wrapper
 */
export function fromWritableStream(stream: FileSystemWritableFileStream): WritableFileInterface {
	return new WritableFile(stream)
}
