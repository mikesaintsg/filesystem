/**
 * @mikesaintsg/filesystem
 *
 * InMemoryAdapter - stores everything in memory.
 * Useful for testing and temporary storage.
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
	MemoryEntry,
} from '../types.js'
import { NotFoundError, TypeMismatchError } from '../errors.js'

/**
 * InMemoryAdapter - stores everything in memory.
 *
 * @example
 * ```ts
 * const adapter = new InMemoryAdapter()
 * await adapter.init()
 * await adapter.writeFile('/hello.txt', 'Hello, World!')
 * console.log(await adapter.getFileText('/hello.txt'))
 * adapter.close()
 * ```
 */
export class InMemoryAdapter implements StorageAdapterInterface {
	#entries = new Map<string, MemoryEntry>()

	/** Checks if this adapter is available (always true for InMemory) */
	isAvailable(): Promise<boolean> {
		return Promise.resolve(true)
	}

	/** Initializes the adapter */
	init(): Promise<void> {
		this.#entries.clear()
		// Create root directory
		this.#entries.set('/', {
			path: '/',
			name: '',
			parent: '',
			kind: 'directory',
		})
		return Promise.resolve()
	}

	/** Closes the adapter and clears memory */
	close(): void {
		this.#entries.clear()
	}

	// ---- File Operations ----

	/** Reads file content as text */
	getFileText(path: string): Promise<string> {
		const entry = this.#entries.get(path)
		if (entry?.kind !== 'file') {
			return Promise.reject(new NotFoundError(path))
		}
		if (!entry.content) {
			return Promise.resolve('')
		}
		return Promise.resolve(new TextDecoder().decode(entry.content))
	}

	/** Reads file content as ArrayBuffer */
	getFileArrayBuffer(path: string): Promise<ArrayBuffer> {
		const entry = this.#entries.get(path)
		if (entry?.kind !== 'file') {
			return Promise.reject(new NotFoundError(path))
		}
		return Promise.resolve(entry.content ?? new ArrayBuffer(0))
	}

	/** Reads file content as Blob */
	getFileBlob(path: string): Promise<Blob> {
		const entry = this.#entries.get(path)
		if (entry?.kind !== 'file') {
			return Promise.reject(new NotFoundError(path))
		}
		return Promise.resolve(new Blob([entry.content ?? new ArrayBuffer(0)]))
	}

	/** Gets file metadata */
	getFileMetadata(path: string): Promise<FileMetadata> {
		const entry = this.#entries.get(path)
		if (entry?.kind !== 'file') {
			return Promise.reject(new NotFoundError(path))
		}
		return Promise.resolve({
			name: entry.name,
			size: entry.content?.byteLength ?? 0,
			type: '',
			lastModified: entry.lastModified ?? Date.now(),
		})
	}

	/** Writes data to a file */
	async writeFile(path: string, data: WriteData, options?: WriteOptions): Promise<void> {
		const content = await this.#toArrayBuffer(data)
		const existingEntry = this.#entries.get(path)

		if (options?.keepExistingData && existingEntry?.kind === 'file' && existingEntry.content) {
			const position = options.position ?? existingEntry.content.byteLength
			const newContent = this.#mergeArrayBuffers(existingEntry.content, content, position)
			this.#entries.set(path, {
				path,
				name: this.#getName(path),
				parent: this.#getParent(path),
				kind: 'file',
				content: newContent,
				lastModified: Date.now(),
			})
		} else if (options?.position !== undefined && existingEntry?.kind === 'file' && existingEntry.content) {
			const newContent = this.#mergeArrayBuffers(existingEntry.content, content, options.position)
			this.#entries.set(path, {
				path,
				name: this.#getName(path),
				parent: this.#getParent(path),
				kind: 'file',
				content: newContent,
				lastModified: Date.now(),
			})
		} else {
			this.#entries.set(path, {
				path,
				name: this.#getName(path),
				parent: this.#getParent(path),
				kind: 'file',
				content,
				lastModified: Date.now(),
			})
		}

		// Ensure parent directories exist
		await this.#ensureParentDirectories(path)
	}

	/** Appends data to a file */
	async appendFile(path: string, data: WriteData): Promise<void> {
		const existing = this.#entries.get(path)
		if (existing?.kind !== 'file') {
			// Create file if it doesn't exist
			await this.writeFile(path, data)
			return
		}

		const content = await this.#toArrayBuffer(data)
		const existingContent = existing.content ?? new ArrayBuffer(0)
		const newContent = new ArrayBuffer(existingContent.byteLength + content.byteLength)
		const view = new Uint8Array(newContent)
		view.set(new Uint8Array(existingContent), 0)
		view.set(new Uint8Array(content), existingContent.byteLength)

		this.#entries.set(path, {
			...existing,
			content: newContent,
			lastModified: Date.now(),
		})
	}

	/** Truncates a file to specified size */
	truncateFile(path: string, size: number): Promise<void> {
		const entry = this.#entries.get(path)
		if (entry?.kind !== 'file') {
			return Promise.reject(new NotFoundError(path))
		}

		const existingContent = entry.content ?? new ArrayBuffer(0)
		let newContent: ArrayBuffer

		if (size <= existingContent.byteLength) {
			// Shrink
			newContent = existingContent.slice(0, size)
		} else {
			// Extend with zeros
			newContent = new ArrayBuffer(size)
			new Uint8Array(newContent).set(new Uint8Array(existingContent))
		}

		this.#entries.set(path, {
			...entry,
			content: newContent,
			lastModified: Date.now(),
		})
		return Promise.resolve()
	}

	/** Checks if a file exists at the path */
	hasFile(path: string): Promise<boolean> {
		const entry = this.#entries.get(path)
		return Promise.resolve(entry?.kind === 'file')
	}

	/** Removes a file */
	removeFile(path: string): Promise<void> {
		const entry = this.#entries.get(path)
		if (!entry) {
			return Promise.reject(new NotFoundError(path))
		}
		if (entry.kind !== 'file') {
			return Promise.reject(new TypeMismatchError('file', path))
		}
		this.#entries.delete(path)
		return Promise.resolve()
	}

	/** Copies a file from source to destination */
	async copyFile(sourcePath: string, destinationPath: string, options?: CopyOptions): Promise<void> {
		const source = this.#entries.get(sourcePath)
		if (source?.kind !== 'file') {
			throw new NotFoundError(sourcePath)
		}

		const destExists = this.#entries.has(destinationPath)
		if (destExists && !options?.overwrite) {
			throw new TypeMismatchError('file', destinationPath)
		}

		const entry: MemoryEntry = {
			path: destinationPath,
			name: this.#getName(destinationPath),
			parent: this.#getParent(destinationPath),
			kind: 'file',
			lastModified: Date.now(),
		}
		if (source.content) {
			entry.content = source.content.slice(0)
		}
		this.#entries.set(destinationPath, entry)

		await this.#ensureParentDirectories(destinationPath)
	}

	/** Moves a file from source to destination */
	async moveFile(sourcePath: string, destinationPath: string, options?: MoveOptions): Promise<void> {
		await this.copyFile(sourcePath, destinationPath, options)
		await this.removeFile(sourcePath)
	}

	// ---- Directory Operations ----

	/** Creates a directory at the path */
	async createDirectory(path: string): Promise<void> {
		// Normalize path
		const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path
		if (normalizedPath === '') {
			return // Root already exists
		}

		if (!this.#entries.has(normalizedPath)) {
			this.#entries.set(normalizedPath, {
				path: normalizedPath,
				name: this.#getName(normalizedPath),
				parent: this.#getParent(normalizedPath),
				kind: 'directory',
			})
		}

		await this.#ensureParentDirectories(normalizedPath)
	}

	/** Checks if a directory exists at the path */
	hasDirectory(path: string): Promise<boolean> {
		const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path
		if (normalizedPath === '' || normalizedPath === '/') {
			return Promise.resolve(true) // Root always exists
		}
		const entry = this.#entries.get(normalizedPath)
		return Promise.resolve(entry?.kind === 'directory')
	}

	/** Removes a directory */
	removeDirectory(path: string, options?: RemoveDirectoryOptions): Promise<void> {
		const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path
		const entry = this.#entries.get(normalizedPath)

		if (!entry) {
			return Promise.reject(new NotFoundError(path))
		}
		if (entry.kind !== 'directory') {
			return Promise.reject(new TypeMismatchError('directory', path))
		}

		// Check for children
		const hasChildren = Array.from(this.#entries.values()).some(
			e => e.parent === normalizedPath && e.path !== normalizedPath,
		)

		if (hasChildren && !options?.recursive) {
			return Promise.reject(new Error('Directory not empty'))
		}

		if (options?.recursive) {
			// Remove all children
			for (const [key, e] of this.#entries) {
				if (e.path.startsWith(normalizedPath + '/') || e.path === normalizedPath) {
					if (key !== '/') {
						this.#entries.delete(key)
					}
				}
			}
		} else {
			this.#entries.delete(normalizedPath)
		}
		return Promise.resolve()
	}

	/** Lists entries in a directory */
	listEntries(path: string): Promise<readonly AdapterDirectoryEntry[]> {
		const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path
		const parentPath = normalizedPath === '/' ? '/' : normalizedPath

		const entries: AdapterDirectoryEntry[] = []
		for (const entry of this.#entries.values()) {
			if (entry.parent === parentPath && entry.path !== '/') {
				entries.push({
					name: entry.name,
					kind: entry.kind,
				})
			}
		}
		return Promise.resolve(entries)
	}

	// ---- Quota & Migration ----

	/** Gets storage quota information */
	getQuota(): Promise<StorageQuota> {
		let usage = 0
		for (const entry of this.#entries.values()) {
			if (entry.content) {
				usage += entry.content.byteLength
			}
			// Add some overhead for metadata
			usage += entry.path.length + entry.name.length + 50
		}

		const quota = 100 * 1024 * 1024 // 100MB simulated quota
		return Promise.resolve({
			usage,
			quota,
			available: quota - usage,
			percentUsed: quota > 0 ? (usage / quota) * 100 : 0,
		})
	}

	/** Exports the file system to a portable format */
	export(options?: ExportOptions): Promise<ExportedFileSystem> {
		const entries: ExportedEntry[] = []

		for (const entry of this.#entries.values()) {
			if (entry.path === '/') continue // Skip root

			// Check include/exclude paths
			if (options?.includePaths && options.includePaths.length > 0) {
				const included = options.includePaths.some(p => entry.path.startsWith(p))
				if (!included) continue
			}

			if (options?.excludePaths && options.excludePaths.length > 0) {
				const excluded = options.excludePaths.some(p => entry.path.startsWith(p))
				if (excluded) continue
			}

			if (entry.kind === 'file') {
				entries.push({
					path: entry.path,
					name: entry.name,
					kind: 'file',
					content: entry.content ?? new ArrayBuffer(0),
					lastModified: entry.lastModified ?? Date.now(),
				})
			} else {
				entries.push({
					path: entry.path,
					name: entry.name,
					kind: 'directory',
				})
			}
		}

		return Promise.resolve({
			version: 1,
			exportedAt: Date.now(),
			entries,
		})
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
			const exists = this.#entries.has(entry.path)

			if (exists) {
				if (mergeBehavior === 'skip') continue
				if (mergeBehavior === 'error') {
					throw new Error(`Entry already exists: ${entry.path}`)
				}
				// 'replace' - continue and overwrite
			}

			if (entry.kind === 'directory') {
				await this.createDirectory(entry.path)
			} else {
				await this.writeFile(entry.path, entry.content)
			}
		}
	}

	// ---- Private Helpers ----

	#getName(path: string): string {
		const parts = path.split('/').filter(p => p.length > 0)
		return parts[parts.length - 1] ?? ''
	}

	#getParent(path: string): string {
		const lastSlash = path.lastIndexOf('/')
		if (lastSlash <= 0) return '/'
		return path.substring(0, lastSlash)
	}

	async #toArrayBuffer(data: WriteData): Promise<ArrayBuffer> {
		if (typeof data === 'string') {
			return new TextEncoder().encode(data).buffer
		}
		if (data instanceof ArrayBuffer) {
			return data
		}
		if (data instanceof Blob) {
			return data.arrayBuffer()
		}
		if (ArrayBuffer.isView(data)) {
			return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
		}
		if (data instanceof ReadableStream) {
			const reader = data.getReader()
			const chunks: Uint8Array[] = []
			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				chunks.push(value)
			}
			const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
			const result = new Uint8Array(totalLength)
			let offset = 0
			for (const chunk of chunks) {
				result.set(chunk, offset)
				offset += chunk.length
			}
			return result.buffer
		}
		return new ArrayBuffer(0)
	}

	#mergeArrayBuffers(existing: ArrayBuffer, newData: ArrayBuffer, position: number): ArrayBuffer {
		const newLength = Math.max(existing.byteLength, position + newData.byteLength)
		const result = new ArrayBuffer(newLength)
		const view = new Uint8Array(result)

		// Copy existing data
		view.set(new Uint8Array(existing))

		// Write new data at position
		view.set(new Uint8Array(newData), position)

		return result
	}

	async #ensureParentDirectories(path: string): Promise<void> {
		const parent = this.#getParent(path)
		if (parent !== '/' && parent !== '' && !this.#entries.has(parent)) {
			await this.createDirectory(parent)
		}
	}
}
