/**
 * @mikesaintsg/filesystem
 *
 * OPFSAdapter - uses the Origin Private File System.
 * This is the default adapter when no adapter is provided.
 */

import type {
	StorageAdapterInterface,
	AdapterDirectoryEntry,
	FileMetadata,
	WriteData,
	WriteOptions,
	RemoveDirectoryOptions,
	StorageQuota,
	ExportedFileSystem,
	ExportedEntry,
	ExportOptions,
	ImportOptions,
	CopyOptions,
	MoveOptions,
} from '../types.js'
import { NotFoundError, TypeMismatchError, wrapDOMException } from '../errors.js'

/**
 * OPFSAdapter - uses the Origin Private File System.
 *
 * @example
 * ```ts
 * const adapter = new OPFSAdapter()
 * if (await adapter.isAvailable()) {
 *   await adapter.init()
 *   await adapter.writeFile('/hello.txt', 'Hello, World!')
 *   console.log(await adapter.getFileText('/hello.txt'))
 *   adapter.close()
 * }
 * ```
 */
export class OPFSAdapter implements StorageAdapterInterface {
	#root: FileSystemDirectoryHandle | null = null

	/** Checks if OPFS is available in the current environment */
	async isAvailable(): Promise<boolean> {
		if (typeof navigator?.storage?.getDirectory !== 'function') {
			return false
		}
		try {
			await navigator.storage.getDirectory()
			return true
		} catch {
			return false
		}
	}

	/** Initializes the adapter */
	async init(): Promise<void> {
		this.#root = await navigator.storage.getDirectory()
	}

	/** Closes the adapter and releases resources */
	close(): void {
		this.#root = null
	}

	// ---- File Operations ----

	/** Reads file content as text */
	async getFileText(path: string): Promise<string> {
		const handle = await this.#resolveFileHandle(path)
		const file = await handle.getFile()
		return file.text()
	}

	/** Reads file content as ArrayBuffer */
	async getFileArrayBuffer(path: string): Promise<ArrayBuffer> {
		const handle = await this.#resolveFileHandle(path)
		const file = await handle.getFile()
		return file.arrayBuffer()
	}

	/** Reads file content as Blob */
	async getFileBlob(path: string): Promise<Blob> {
		const handle = await this.#resolveFileHandle(path)
		return handle.getFile()
	}

	/** Gets file metadata */
	async getFileMetadata(path: string): Promise<FileMetadata> {
		const handle = await this.#resolveFileHandle(path)
		const file = await handle.getFile()
		return {
			name: file.name,
			size: file.size,
			type: file.type,
			lastModified: file.lastModified,
		}
	}

	/** Writes data to a file */
	async writeFile(path: string, data: WriteData, options?: WriteOptions): Promise<void> {
		const handle = await this.#resolveFileHandle(path, { create: true })
		const keepExisting = options?.keepExistingData ?? false
		const writable = await handle.createWritable({ keepExistingData: keepExisting })
		try {
			if (options?.position !== undefined) {
				await writable.seek(options.position)
			}
			await this.#writeDataToStream(writable, data)
			await writable.close()
		} catch (error) {
			await writable.abort()
			throw wrapDOMException(error, path)
		}
	}

	/** Appends data to a file */
	async appendFile(path: string, data: WriteData): Promise<void> {
		const handle = await this.#resolveFileHandle(path, { create: true })
		const writable = await handle.createWritable({ keepExistingData: true })
		try {
			const file = await handle.getFile()
			await writable.seek(file.size)
			await this.#writeDataToStream(writable, data)
			await writable.close()
		} catch (error) {
			await writable.abort()
			throw wrapDOMException(error, path)
		}
	}

	/** Truncates a file to specified size */
	async truncateFile(path: string, size: number): Promise<void> {
		const handle = await this.#resolveFileHandle(path)
		const writable = await handle.createWritable({ keepExistingData: true })
		try {
			await writable.truncate(size)
			await writable.close()
		} catch (error) {
			await writable.abort()
			throw wrapDOMException(error, path)
		}
	}

	/** Checks if a file exists at the path */
	async hasFile(path: string): Promise<boolean> {
		try {
			await this.#resolveFileHandle(path)
			return true
		} catch {
			return false
		}
	}

	/** Removes a file */
	async removeFile(path: string): Promise<void> {
		const segments = this.#parsePath(path)
		if (segments.length === 0) {
			throw new NotFoundError(path)
		}
		const fileName = segments.pop()!
		const parentHandle = await this.#resolveDirHandle(segments)
		try {
			await parentHandle.getFileHandle(fileName) // Verify it's a file
			await parentHandle.removeEntry(fileName)
		} catch (error) {
			if (error instanceof DOMException) {
				if (error.name === 'NotFoundError') {
					throw new NotFoundError(path)
				}
				if (error.name === 'TypeMismatchError') {
					throw new TypeMismatchError('file', path)
				}
			}
			throw wrapDOMException(error, path)
		}
	}

	/** Copies a file from source to destination */
	async copyFile(sourcePath: string, destinationPath: string, options?: CopyOptions): Promise<void> {
		// Read source content
		const content = await this.getFileArrayBuffer(sourcePath)

		// Check if destination exists
		const destExists = await this.hasFile(destinationPath)
		if (destExists && !options?.overwrite) {
			throw new TypeMismatchError('file', destinationPath)
		}

		// Write to destination
		await this.writeFile(destinationPath, content)
	}

	/** Moves a file from source to destination */
	async moveFile(sourcePath: string, destinationPath: string, options?: MoveOptions): Promise<void> {
		await this.copyFile(sourcePath, destinationPath, options)
		await this.removeFile(sourcePath)
	}

	// ---- Directory Operations ----

	/** Creates a directory at the path */
	async createDirectory(path: string): Promise<void> {
		const segments = this.#parsePath(path)
		if (segments.length === 0) return

		let current = this.#root!
		for (const segment of segments) {
			current = await current.getDirectoryHandle(segment, { create: true })
		}
	}

	/** Checks if a directory exists at the path */
	async hasDirectory(path: string): Promise<boolean> {
		const segments = this.#parsePath(path)
		if (segments.length === 0) return true // Root exists

		try {
			await this.#resolveDirHandle(segments)
			return true
		} catch {
			return false
		}
	}

	/** Removes a directory */
	async removeDirectory(path: string, options?: RemoveDirectoryOptions): Promise<void> {
		const segments = this.#parsePath(path)
		if (segments.length === 0) {
			throw new Error('Cannot remove root directory')
		}

		const dirName = segments.pop()!
		const parentHandle = await this.#resolveDirHandle(segments)

		try {
			await parentHandle.getDirectoryHandle(dirName) // Verify it's a directory
			await parentHandle.removeEntry(dirName, { recursive: options?.recursive ?? false })
		} catch (error) {
			if (error instanceof DOMException) {
				if (error.name === 'NotFoundError') {
					throw new NotFoundError(path)
				}
				if (error.name === 'TypeMismatchError') {
					throw new TypeMismatchError('directory', path)
				}
			}
			throw wrapDOMException(error, path)
		}
	}

	/** Lists entries in a directory */
	async listEntries(path: string): Promise<readonly AdapterDirectoryEntry[]> {
		const segments = this.#parsePath(path)
		const handle = await this.#resolveDirHandle(segments)
		const entries: AdapterDirectoryEntry[] = []

		for await (const [name, entryHandle] of handle.entries()) {
			entries.push({
				name,
				kind: entryHandle.kind,
			})
		}

		return entries
	}

	// ---- Quota & Migration ----

	/** Gets storage quota information */
	async getQuota(): Promise<StorageQuota> {
		const estimate = await navigator.storage.estimate()
		const usage = estimate.usage ?? 0
		const quota = estimate.quota ?? 0
		return {
			usage,
			quota,
			available: quota - usage,
			percentUsed: quota > 0 ? (usage / quota) * 100 : 0,
		}
	}

	/** Exports the file system to a portable format */
	async export(options?: ExportOptions): Promise<ExportedFileSystem> {
		const entries: ExportedEntry[] = []
		await this.#walkAndExport(this.#root!, '/', entries, options)
		return {
			version: 1,
			exportedAt: Date.now(),
			entries,
		}
	}

	/** Imports a file system from exported data */
	async import(data: ExportedFileSystem, options?: ImportOptions): Promise<void> {
		const mergeBehavior = options?.mergeBehavior ?? 'replace'

		// Sort entries to process directories before files
		const sortedEntries = [...data.entries].sort((a, b) => {
			if (a.kind === 'directory' && b.kind !== 'directory') return -1
			if (a.kind !== 'directory' && b.kind === 'directory') return 1
			return a.path.localeCompare(b.path)
		})

		for (const entry of sortedEntries) {
			if (entry.kind === 'directory') {
				await this.createDirectory(entry.path)
			} else {
				const exists = await this.hasFile(entry.path)
				if (exists) {
					if (mergeBehavior === 'skip') continue
					if (mergeBehavior === 'error') {
						throw new Error(`File already exists: ${entry.path}`)
					}
					// 'replace' - continue and overwrite
				}
				await this.writeFile(entry.path, entry.content)
			}
		}
	}

	// ---- Private Helpers ----

	#parsePath(path: string): string[] {
		return path.split('/').filter(s => s.length > 0)
	}

	async #resolveDirHandle(segments: string[]): Promise<FileSystemDirectoryHandle> {
		let current = this.#root!
		for (const segment of segments) {
			try {
				current = await current.getDirectoryHandle(segment)
			} catch (error) {
				throw wrapDOMException(error, segments.join('/'))
			}
		}
		return current
	}

	async #resolveFileHandle(path: string, options?: { create?: boolean }): Promise<FileSystemFileHandle> {
		const segments = this.#parsePath(path)
		if (segments.length === 0) {
			throw new NotFoundError(path)
		}

		const fileName = segments.pop()!
		const dirHandle = await this.#resolveDirHandle(segments)

		try {
			const shouldCreate = options?.create ?? false
			return await dirHandle.getFileHandle(fileName, { create: shouldCreate })
		} catch (error) {
			if (error instanceof DOMException && error.name === 'NotFoundError') {
				throw new NotFoundError(path)
			}
			throw wrapDOMException(error, path)
		}
	}

	async #writeDataToStream(writable: FileSystemWritableFileStream, data: WriteData): Promise<void> {
		if (data instanceof ReadableStream) {
			const reader = data.getReader()
			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				const copy = new Uint8Array(value)
				await writable.write(copy.buffer)
			}
		} else {
			await writable.write(data)
		}
	}

	async #walkAndExport(
		handle: FileSystemDirectoryHandle,
		currentPath: string,
		entries: ExportedEntry[],
		options?: ExportOptions,
	): Promise<void> {
		for await (const [name, entryHandle] of handle.entries()) {
			const entryPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`

			// Check include/exclude paths
			if (options?.includePaths && options.includePaths.length > 0) {
				const included = options.includePaths.some(p => entryPath.startsWith(p))
				if (!included) continue
			}

			if (options?.excludePaths && options.excludePaths.length > 0) {
				const excluded = options.excludePaths.some(p => entryPath.startsWith(p))
				if (excluded) continue
			}

			if (entryHandle.kind === 'file') {
				const fileHandle = entryHandle as FileSystemFileHandle
				const file = await fileHandle.getFile()
				const content = await file.arrayBuffer()
				entries.push({
					path: entryPath,
					name,
					kind: 'file',
					content,
					lastModified: file.lastModified,
				})
			} else {
				entries.push({
					path: entryPath,
					name,
					kind: 'directory',
				})
				// Recurse into subdirectory
				await this.#walkAndExport(entryHandle as FileSystemDirectoryHandle, entryPath, entries, options)
			}
		}
	}
}
