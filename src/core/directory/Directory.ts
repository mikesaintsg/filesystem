/**
 * @mikesaintsg/filesystem
 *
 * Directory class implementing DirectoryInterface.
 * Wraps FileSystemDirectoryHandle for directory operations.
 */

import type {
	DirectoryInterface,
	FileInterface,
	DirectoryEntry,
	WalkEntry,
	WalkOptions,
	RemoveDirectoryOptions,
	CopyOptions,
	MoveOptions,
} from '../../types.js'
import { wrapDOMException, NotFoundError, TypeMismatchError } from '../../errors.js'
import { File } from '../file/File.js'

/**
 * Directory implementation wrapping FileSystemDirectoryHandle.
 *
 * @example
 * ```ts
 * const dir = fromDirectoryHandle(nativeHandle)
 * const file = await dir.createFile('test.txt')
 * await file.write('Hello')
 *
 * for await (const entry of dir.entries()) {
 *   console.log(entry.name)
 * }
 * ```
 */
export class Directory implements DirectoryInterface {
	readonly #handle: FileSystemDirectoryHandle

	constructor(handle: FileSystemDirectoryHandle) {
		this.#handle = handle
	}

	/** Native directory handle for escape hatch access */
	get native(): FileSystemDirectoryHandle {
		return this.#handle
	}

	// ---- Accessors ----

	/** Gets the directory name */
	getName(): string {
		return this.#handle.name
	}

	// ---- File Operations ----

	/**
	 * Gets a file by name (returns undefined if not found)
	 * @param name - File name
	 */
	async getFile(name: string): Promise<FileInterface | undefined> {
		try {
			const handle = await this.#handle.getFileHandle(name)
			return new File(handle)
		} catch (error) {
			if (error instanceof DOMException && error.name === 'NotFoundError') {
				return undefined
			}
			if (error instanceof DOMException && error.name === 'TypeMismatchError') {
				// Entry exists but is a directory, not a file
				return undefined
			}
			throw wrapDOMException(error, name)
		}
	}

	/**
	 * Gets a file by name (throws NotFoundError if not found)
	 * @param name - File name
	 */
	async resolveFile(name: string): Promise<FileInterface> {
		try {
			const handle = await this.#handle.getFileHandle(name)
			return new File(handle)
		} catch (error) {
			if (error instanceof DOMException && error.name === 'NotFoundError') {
				throw new NotFoundError(name)
			}
			throw wrapDOMException(error, name)
		}
	}

	/**
	 * Creates a file (overwrites if exists)
	 * @param name - File name
	 */
	async createFile(name: string): Promise<FileInterface> {
		try {
			const handle = await this.#handle.getFileHandle(name, { create: true })
			return new File(handle)
		} catch (error) {
			throw wrapDOMException(error, name)
		}
	}

	/**
	 * Checks if a file exists
	 * @param name - File name
	 */
	async hasFile(name: string): Promise<boolean> {
		try {
			await this.#handle.getFileHandle(name)
			return true
		} catch (error) {
			if (error instanceof DOMException && error.name === 'NotFoundError') {
				return false
			}
			if (error instanceof DOMException && error.name === 'TypeMismatchError') {
				// Entry exists but is a directory
				return false
			}
			throw wrapDOMException(error, name)
		}
	}

	/**
	 * Removes a file
	 * @param name - File name
	 */
	async removeFile(name: string): Promise<void> {
		try {
			// Verify it's a file first
			await this.#handle.getFileHandle(name)
			await this.#handle.removeEntry(name)
		} catch (error) {
			if (error instanceof DOMException && error.name === 'NotFoundError') {
				throw new NotFoundError(name)
			}
			if (error instanceof DOMException && error.name === 'TypeMismatchError') {
				throw new TypeMismatchError('file', name)
			}
			throw wrapDOMException(error, name)
		}
	}

	// ---- Directory Operations ----

	/**
	 * Gets a subdirectory by name (returns undefined if not found)
	 * @param name - Directory name
	 */
	async getDirectory(name: string): Promise<DirectoryInterface | undefined> {
		try {
			const handle = await this.#handle.getDirectoryHandle(name)
			return new Directory(handle)
		} catch (error) {
			if (error instanceof DOMException && error.name === 'NotFoundError') {
				return undefined
			}
			if (error instanceof DOMException && error.name === 'TypeMismatchError') {
				// Entry exists but is a file, not a directory
				return undefined
			}
			throw wrapDOMException(error, name)
		}
	}

	/**
	 * Gets a subdirectory by name (throws NotFoundError if not found)
	 * @param name - Directory name
	 */
	async resolveDirectory(name: string): Promise<DirectoryInterface> {
		try {
			const handle = await this.#handle.getDirectoryHandle(name)
			return new Directory(handle)
		} catch (error) {
			if (error instanceof DOMException && error.name === 'NotFoundError') {
				throw new NotFoundError(name)
			}
			throw wrapDOMException(error, name)
		}
	}

	/**
	 * Creates a subdirectory (creates if not exists)
	 * @param name - Directory name
	 */
	async createDirectory(name: string): Promise<DirectoryInterface> {
		try {
			const handle = await this.#handle.getDirectoryHandle(name, { create: true })
			return new Directory(handle)
		} catch (error) {
			throw wrapDOMException(error, name)
		}
	}

	/**
	 * Checks if a subdirectory exists
	 * @param name - Directory name
	 */
	async hasDirectory(name: string): Promise<boolean> {
		try {
			await this.#handle.getDirectoryHandle(name)
			return true
		} catch (error) {
			if (error instanceof DOMException && error.name === 'NotFoundError') {
				return false
			}
			if (error instanceof DOMException && error.name === 'TypeMismatchError') {
				// Entry exists but is a file
				return false
			}
			throw wrapDOMException(error, name)
		}
	}

	/**
	 * Removes a subdirectory
	 * @param name - Directory name
	 * @param options - Removal options
	 */
	async removeDirectory(name: string, options?: RemoveDirectoryOptions): Promise<void> {
		try {
			// Verify it's a directory first
			await this.#handle.getDirectoryHandle(name)
			await this.#handle.removeEntry(name, { recursive: options?.recursive ?? false })
		} catch (error) {
			if (error instanceof DOMException && error.name === 'NotFoundError') {
				throw new NotFoundError(name)
			}
			if (error instanceof DOMException && error.name === 'TypeMismatchError') {
				throw new TypeMismatchError('directory', name)
			}
			throw wrapDOMException(error, name)
		}
	}

	// ---- Path Operations ----

	/**
	 * Resolves a path to a file or directory
	 * @param segments - Path segments
	 */
	async resolvePath(...segments: readonly string[]): Promise<FileInterface | DirectoryInterface | undefined> {
		if (segments.length === 0) {
			return this
		}

		try {
			let currentHandle: FileSystemHandle = this.#handle

			for (let i = 0; i < segments.length; i++) {
				const segment = segments[i]
				if (segment === undefined) continue

				if (currentHandle.kind !== 'directory') {
					return undefined
				}

				const dirHandle = currentHandle as FileSystemDirectoryHandle
				const isLast = i === segments.length - 1

				if (isLast) {
					// Try as file first
					try {
						const fileHandle = await dirHandle.getFileHandle(segment)
						return new File(fileHandle)
					} catch {
						// Try as directory
						try {
							const subdirHandle = await dirHandle.getDirectoryHandle(segment)
							return new Directory(subdirHandle)
						} catch {
							return undefined
						}
					}
				} else {
					// Must be a directory to continue path
					try {
						currentHandle = await dirHandle.getDirectoryHandle(segment)
					} catch {
						return undefined
					}
				}
			}

			return undefined
		} catch {
			return undefined
		}
	}

	/**
	 * Creates nested directories (like mkdir -p)
	 * @param segments - Path segments
	 */
	async createPath(...segments: readonly string[]): Promise<DirectoryInterface> {
		if (segments.length === 0) {
			return this
		}

		try {
			let current: FileSystemDirectoryHandle = this.#handle

			for (const segment of segments) {
				if (segment === undefined) continue
				current = await current.getDirectoryHandle(segment, { create: true })
			}

			return new Directory(current)
		} catch (error) {
			throw wrapDOMException(error, segments.join('/'))
		}
	}

	// ---- Iteration ----

	/** Iterates all entries (files and directories) */
	async *entries(): AsyncIterable<DirectoryEntry> {
		try {
			for await (const [name, handle] of this.#handle.entries()) {
				yield {
					name,
					kind: handle.kind,
					handle,
				}
			}
		} catch (error) {
			throw wrapDOMException(error, this.#handle.name)
		}
	}

	/** Iterates files only */
	async *files(): AsyncIterable<FileInterface> {
		for await (const entry of this.entries()) {
			if (entry.kind === 'file') {
				yield new File(entry.handle as FileSystemFileHandle)
			}
		}
	}

	/** Iterates subdirectories only */
	async *directories(): AsyncIterable<DirectoryInterface> {
		for await (const entry of this.entries()) {
			if (entry.kind === 'directory') {
				yield new Directory(entry.handle as FileSystemDirectoryHandle)
			}
		}
	}

	/** Lists all entries as array */
	async list(): Promise<readonly DirectoryEntry[]> {
		const entries: DirectoryEntry[] = []
		for await (const entry of this.entries()) {
			entries.push(entry)
		}
		return entries
	}

	/** Lists all files as array */
	async listFiles(): Promise<readonly FileInterface[]> {
		const files: FileInterface[] = []
		for await (const file of this.files()) {
			files.push(file)
		}
		return files
	}

	/** Lists all subdirectories as array */
	async listDirectories(): Promise<readonly DirectoryInterface[]> {
		const directories: DirectoryInterface[] = []
		for await (const dir of this.directories()) {
			directories.push(dir)
		}
		return directories
	}

	/**
	 * Recursively walks directory tree
	 * @param options - Walk options
	 */
	async *walk(options?: WalkOptions): AsyncIterable<WalkEntry> {
		const maxDepth = options?.maxDepth ?? Infinity
		const includeFiles = options?.includeFiles ?? true
		const includeDirectories = options?.includeDirectories ?? true
		const filter = options?.filter

		yield* this.#walkRecursive([], 0, maxDepth, includeFiles, includeDirectories, filter)
	}

	async *#walkRecursive(
		path: readonly string[],
		depth: number,
		maxDepth: number,
		includeFiles: boolean,
		includeDirectories: boolean,
		filter?: (entry: DirectoryEntry, depth: number) => boolean,
	): AsyncIterable<WalkEntry> {
		if (depth > maxDepth) {
			return
		}

		for await (const entry of this.entries()) {
			// Apply filter if provided
			if (filter !== undefined && !filter(entry, depth)) {
				continue
			}

			const shouldYield =
				(entry.kind === 'file' && includeFiles) ||
				(entry.kind === 'directory' && includeDirectories)

			if (shouldYield) {
				yield {
					path,
					entry,
					depth,
				}
			}

			// Recurse into subdirectories
			if (entry.kind === 'directory' && depth < maxDepth) {
				const subdir = new Directory(entry.handle as FileSystemDirectoryHandle)
				yield* subdir.#walkRecursive(
					[...path, entry.name],
					depth + 1,
					maxDepth,
					includeFiles,
					includeDirectories,
					filter,
				)
			}
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
		} catch {
			// OPFS handles don't support requestPermission
			return true
		}
	}

	// ---- Comparison ----

	/**
	 * Checks if this directory is the same as another entry
	 * @param other - Entry to compare against
	 */
	async isSameEntry(other: FileInterface | DirectoryInterface): Promise<boolean> {
		try {
			return this.#handle.isSameEntry(other.native)
		} catch (error) {
			throw wrapDOMException(error, this.#handle.name)
		}
	}

	/**
	 * Gets relative path from this directory to a descendant entry
	 * @param descendant - Descendant entry
	 * @returns Path segments or null if not a descendant
	 */
	async resolve(descendant: FileInterface | DirectoryInterface): Promise<readonly string[] | null> {
		try {
			return this.#handle.resolve(descendant.native)
		} catch (error) {
			throw wrapDOMException(error, this.#handle.name)
		}
	}

	// ---- Convenience Methods ----

	/**
	 * Copies a file to a destination
	 * @param source - Source file name
	 * @param destination - Destination file name or directory
	 * @param options - Copy options
	 */
	async copyFile(source: string, destination: string | DirectoryInterface, options?: CopyOptions): Promise<FileInterface> {
		// Get source file
		const sourceFile = await this.getFile(source)
		if (!sourceFile) {
			throw new NotFoundError(source)
		}

		// Read source content
		const content = await sourceFile.getArrayBuffer()

		// Determine if destination is a string (file name) or a directory
		const isStringDest = typeof destination === 'string'
		const destName = isStringDest ? destination : source

		// Check if destination exists and overwrite is not allowed
		if (!options?.overwrite) {
			const exists = isStringDest
				? await this.hasFile(destName)
				: await destination.hasFile(destName)
			if (exists) {
				throw new TypeMismatchError('file', destName)
			}
		}

		// Create destination file and write content
		const destFile = isStringDest
			? await this.createFile(destName)
			: await destination.createFile(destName)
		await destFile.write(content)

		return destFile
	}

	/**
	 * Moves a file to a destination
	 * @param source - Source file name
	 * @param destination - Destination file name or directory
	 * @param options - Move options
	 */
	async moveFile(source: string, destination: string | DirectoryInterface, options?: MoveOptions): Promise<FileInterface> {
		// Copy the file first (only pass options if overwrite is explicitly set)
		const copyOptions: CopyOptions | undefined = options?.overwrite !== undefined ? { overwrite: options.overwrite } : undefined
		const destFile = await this.copyFile(source, destination, copyOptions)

		// Remove source file
		await this.removeFile(source)

		return destFile
	}
}
