/**
 * @mikesaintsg/filesystem
 *
 * Tests for helper functions and type guards.
 */

import { describe, it, expect } from 'vitest'
import {
	isFileSystemError,
	isNotFoundError,
	isNotAllowedError,
	isAbortError,
	isFileKind,
	isDirectoryKind,
	isFileEntry,
	isDirectoryEntry,
	isValidEntryName,
	formatBytes,
	isOPFSSupported,
	isFilePickerSupported,
} from '~/src/helpers.js'
import {
	FileSystemError,
	NotFoundError,
	NotAllowedError,
	AbortError,
} from '~/src/errors.js'
import type { DirectoryEntry } from '~/src/types.js'

describe('helpers', () => {
	describe('error type guards', () => {
		it('isFileSystemError returns true for FileSystemError', () => {
			const error = new FileSystemError('NOT_FOUND', 'test')
			expect(isFileSystemError(error)).toBe(true)
		})

		it('isFileSystemError returns false for regular Error', () => {
			const error = new Error('test')
			expect(isFileSystemError(error)).toBe(false)
		})

		it('isNotFoundError returns true for NotFoundError', () => {
			const error = new NotFoundError('test.txt')
			expect(isNotFoundError(error)).toBe(true)
		})

		it('isNotFoundError returns false for other errors', () => {
			const error = new NotAllowedError()
			expect(isNotFoundError(error)).toBe(false)
		})

		it('isNotAllowedError returns true for NotAllowedError', () => {
			const error = new NotAllowedError()
			expect(isNotAllowedError(error)).toBe(true)
		})

		it('isAbortError returns true for AbortError', () => {
			const error = new AbortError()
			expect(isAbortError(error)).toBe(true)
		})
	})

	describe('entry type guards', () => {
		it('isFileKind returns true for file', () => {
			expect(isFileKind('file')).toBe(true)
		})

		it('isFileKind returns false for directory', () => {
			expect(isFileKind('directory')).toBe(false)
		})

		it('isDirectoryKind returns true for directory', () => {
			expect(isDirectoryKind('directory')).toBe(true)
		})

		it('isDirectoryKind returns false for file', () => {
			expect(isDirectoryKind('file')).toBe(false)
		})

		it('isFileEntry returns true for file entry', () => {
			const entry: DirectoryEntry = {
				name: 'test.txt',
				kind: 'file',
				handle: {} as FileSystemHandle,
			}
			expect(isFileEntry(entry)).toBe(true)
		})

		it('isDirectoryEntry returns true for directory entry', () => {
			const entry: DirectoryEntry = {
				name: 'folder',
				kind: 'directory',
				handle: {} as FileSystemHandle,
			}
			expect(isDirectoryEntry(entry)).toBe(true)
		})
	})

	describe('isValidEntryName', () => {
		it('returns true for valid names', () => {
			expect(isValidEntryName('file.txt')).toBe(true)
			expect(isValidEntryName('my-file')).toBe(true)
			expect(isValidEntryName('file_name.md')).toBe(true)
			expect(isValidEntryName('123')).toBe(true)
		})

		it('returns false for empty string', () => {
			expect(isValidEntryName('')).toBe(false)
		})

		it('returns false for path separators', () => {
			expect(isValidEntryName('path/file')).toBe(false)
			expect(isValidEntryName('path\\file')).toBe(false)
		})

		it('returns false for . and ..', () => {
			expect(isValidEntryName('.')).toBe(false)
			expect(isValidEntryName('..')).toBe(false)
		})

		it('returns true for dotfiles', () => {
			expect(isValidEntryName('.gitignore')).toBe(true)
			expect(isValidEntryName('.env')).toBe(true)
		})
	})

	describe('formatBytes', () => {
		it('formats 0 bytes', () => {
			expect(formatBytes(0)).toBe('0 B')
		})

		it('formats bytes', () => {
			expect(formatBytes(500)).toBe('500 B')
		})

		it('formats kilobytes', () => {
			expect(formatBytes(1024)).toBe('1.0 KB')
			expect(formatBytes(1536)).toBe('1.5 KB')
		})

		it('formats megabytes', () => {
			expect(formatBytes(1048576)).toBe('1.0 MB')
		})

		it('formats gigabytes', () => {
			expect(formatBytes(1073741824)).toBe('1.0 GB')
		})
	})

	describe('feature detection', () => {
		it('isOPFSSupported returns boolean', () => {
			expect(typeof isOPFSSupported()).toBe('boolean')
		})

		it('isFilePickerSupported returns boolean', () => {
			expect(typeof isFilePickerSupported()).toBe('boolean')
		})
	})
})
