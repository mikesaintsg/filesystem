/**
 * @mikesaintsg/filesystem
 *
 * SyncAccessHandle class implementing SyncAccessHandleInterface.
 * Wraps FileSystemSyncAccessHandle for synchronous file operations in Workers.
 */

import type { SyncAccessHandleInterface } from '../../types.js'

/**
 * Sync access handle implementation for high-performance file I/O in Workers.
 *
 * @remarks
 * This class is only available in Web Workers.
 * All operations are synchronous and blocking.
 *
 * @example
 * ```ts
 * const syncHandle = await fileHandle.createSyncAccessHandle()
 * const wrapper = fromSyncAccessHandle(syncHandle)
 *
 * const size = wrapper.getSize()
 * const buffer = new Uint8Array(size)
 * wrapper.read(buffer)
 * wrapper.close()
 * ```
 */
export class SyncAccessHandle implements SyncAccessHandleInterface {
	readonly #handle: FileSystemSyncAccessHandle

	constructor(handle: FileSystemSyncAccessHandle) {
		this.#handle = handle
	}

	/** Native sync access handle for escape hatch access */
	get native(): FileSystemSyncAccessHandle {
		return this.#handle
	}

	/** Gets file size in bytes */
	getSize(): number {
		return this.#handle.getSize()
	}

	/**
	 * Reads bytes into buffer
	 * @param buffer - Buffer to read into
	 * @param options - Read options
	 * @returns Number of bytes read
	 */
	read(buffer: ArrayBufferView, options?: { at?: number }): number {
		return this.#handle.read(buffer, options)
	}

	/**
	 * Writes buffer to file
	 * @param buffer - Buffer to write
	 * @param options - Write options
	 * @returns Number of bytes written
	 */
	write(buffer: ArrayBufferView, options?: { at?: number }): number {
		return this.#handle.write(buffer, options)
	}

	/**
	 * Resizes file to new size
	 * @param newSize - New file size
	 */
	truncate(newSize: number): void {
		this.#handle.truncate(newSize)
	}

	/** Persists changes to disk */
	flush(): void {
		this.#handle.flush()
	}

	/** Releases lock on file */
	close(): void {
		this.#handle.close()
	}
}

/**
 * Creates a SyncAccessHandleInterface from a native FileSystemSyncAccessHandle.
 *
 * @param handle - Native sync access handle
 * @returns SyncAccessHandleInterface wrapper
 */
export function fromSyncAccessHandle(handle: FileSystemSyncAccessHandle): SyncAccessHandleInterface {
	return new SyncAccessHandle(handle)
}
