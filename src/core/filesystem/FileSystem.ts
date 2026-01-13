/**
 * @mikesaintsg/filesystem
 *
 * FileSystem class implementing FileSystemInterface.
 * Main entry point for all file system operations.
 */

import type {
	FileSystemInterface,
	FileInterface,
	DirectoryInterface,
	StorageQuota,
	OpenFilePickerOptions,
	SaveFilePickerOptions,
	DirectoryPickerOptions,
} from '../../types.js'
import { NotSupportedError, AbortError, wrapDOMException } from '../../errors.js'
import { File as FileWrapper } from '../file/File.js'
import { Directory } from '../directory/Directory.js'

/**
 * Read-only file wrapper for File API sources.
 * Wraps a native File object without a handle, so write operations throw.
 */
class ReadOnlyFile implements FileInterface {
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

	getMetadata() {
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

/**
 * FileSystem implementation.
 *
 * Provides access to OPFS, file pickers, drag-drop, and File API sources.
 *
 * @example
 * ```ts
 * const fs = await createFileSystem()
 * const root = await fs.getRoot()
 * const file = await root.createFile('hello.txt')
 * await file.write('Hello, World!')
 * ```
 */
export class FileSystem implements FileSystemInterface {
	// ---- OPFS Access ----

	/** Gets the OPFS root directory */
	async getRoot(): Promise<DirectoryInterface> {
		try {
			const root = await navigator.storage.getDirectory()
			return new Directory(root)
		} catch (error) {
			throw wrapDOMException(error)
		}
	}

	/** Gets storage quota information */
	async getQuota(): Promise<StorageQuota> {
		try {
			const estimate = await navigator.storage.estimate()
			const usage = estimate.usage ?? 0
			const quota = estimate.quota ?? 0
			const available = quota - usage
			const percentUsed = quota > 0 ? (usage / quota) * 100 : 0

			return {
				usage,
				quota,
				available,
				percentUsed,
			}
		} catch (error) {
			throw wrapDOMException(error)
		}
	}

	// ---- Feature Detection ----

	/** Checks if file picker dialogs are supported (Chromium only) */
	isUserAccessSupported(): boolean {
		return typeof window !== 'undefined' &&
			typeof window.showOpenFilePicker === 'function'
	}

	// ---- File Pickers (Chromium Only) ----

	/**
	 * Opens file picker dialog
	 * @param options - Picker options
	 */
	async showOpenFilePicker(options?: OpenFilePickerOptions): Promise<readonly FileInterface[]> {
		if (!this.isUserAccessSupported()) {
			throw new NotSupportedError('File pickers are not supported in this browser')
		}

		try {
			// Convert readonly types array to mutable for the native API
			const nativeOptions: globalThis.OpenFilePickerOptions | undefined = options ? {
				multiple: options.multiple,
				excludeAcceptAllOption: options.excludeAcceptAllOption,
				id: options.id,
				startIn: options.startIn,
				types: options.types ? options.types.map(t => ({ ...t })) : undefined,
			} : undefined
			const handles = await window.showOpenFilePicker!(nativeOptions)
			return handles.map(handle => new FileWrapper(handle))
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				throw new AbortError('User cancelled file picker')
			}
			throw wrapDOMException(error)
		}
	}

	/**
	 * Opens save file picker dialog
	 * @param options - Picker options
	 */
	async showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileInterface> {
		if (!this.isUserAccessSupported()) {
			throw new NotSupportedError('File pickers are not supported in this browser')
		}

		try {
			// Convert readonly types array to mutable for the native API
			const nativeOptions: globalThis.SaveFilePickerOptions | undefined = options ? {
				suggestedName: options.suggestedName,
				excludeAcceptAllOption: options.excludeAcceptAllOption,
				id: options.id,
				startIn: options.startIn,
				types: options.types ? options.types.map(t => ({ ...t })) : undefined,
			} : undefined
			const handle = await window.showSaveFilePicker!(nativeOptions)
			return new FileWrapper(handle)
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				throw new AbortError('User cancelled file picker')
			}
			throw wrapDOMException(error)
		}
	}

	/**
	 * Opens directory picker dialog
	 * @param options - Picker options
	 */
	async showDirectoryPicker(options?: DirectoryPickerOptions): Promise<DirectoryInterface> {
		if (!this.isUserAccessSupported()) {
			throw new NotSupportedError('Directory picker is not supported in this browser')
		}

		try {
			const handle = await window.showDirectoryPicker!(options)
			return new Directory(handle)
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				throw new AbortError('User cancelled directory picker')
			}
			throw wrapDOMException(error)
		}
	}

	// ---- Source Adapters ----

	/**
	 * Converts a DataTransferItem to file or directory interface
	 * @param item - DataTransferItem from drag-drop event
	 */
	async fromDataTransferItem(item: DataTransferItem): Promise<FileInterface | DirectoryInterface | null> {
		// Try File System Access API first (Chromium)
		if ('getAsFileSystemHandle' in item && typeof item.getAsFileSystemHandle === 'function') {
			try {
				const handle = await (item as { getAsFileSystemHandle(): Promise<FileSystemHandle | null> }).getAsFileSystemHandle()
				if (!handle) return null

				if (handle.kind === 'file') {
					return new FileWrapper(handle as FileSystemFileHandle)
				} else {
					return new Directory(handle as FileSystemDirectoryHandle)
				}
			} catch {
				// Fall through to legacy API
			}
		}

		// Legacy File and Directory Entries API
		const entry = item.webkitGetAsEntry?.()
		if (!entry) {
			// Last resort: try as plain file
			const file = item.getAsFile()
			if (file) {
				return new ReadOnlyFile(file)
			}
			return null
		}

		if (entry.isFile) {
			return new Promise<FileInterface | null>((resolve) => {
				(entry as FileSystemFileEntry).file(
					(file) => resolve(new ReadOnlyFile(file)),
					() => resolve(null),
				)
			})
		} else if (entry.isDirectory) {
			// For directory entries from legacy API, we can't get a handle
			// Return null as we can't create a proper DirectoryInterface
			return null
		}

		return null
	}

	/**
	 * Converts DataTransferItemList to array of file/directory interfaces
	 * @param items - DataTransferItemList from drag-drop event
	 */
	async fromDataTransferItems(items: DataTransferItemList): Promise<readonly (FileInterface | DirectoryInterface)[]> {
		const results: (FileInterface | DirectoryInterface)[] = []

		// DataTransferItemList is array-like but not iterable in all browsers
		const itemsArray = Array.from({ length: items.length }, (_, i) => items[i])

		for (const item of itemsArray) {
			if (item?.kind === 'file') {
				const entry = await this.fromDataTransferItem(item)
				if (entry) {
					results.push(entry)
				}
			}
		}

		return results
	}

	/**
	 * Wraps a File API object
	 * @param file - File from input element
	 */
	fromFile(file: globalThis.File): Promise<FileInterface> {
		return Promise.resolve(new ReadOnlyFile(file))
	}

	/**
	 * Wraps a FileList
	 * @param files - FileList from input element
	 */
	fromFiles(files: FileList): Promise<readonly FileInterface[]> {
		// FileList is array-like but not iterable in all browsers
		const filesArray = Array.from({ length: files.length }, (_, i) => files[i])
		const results: FileInterface[] = []

		for (const file of filesArray) {
			if (file) {
				results.push(new ReadOnlyFile(file))
			}
		}

		return Promise.resolve(results)
	}
}
