/**
 * @mikesaintsg/filesystem
 *
 * Tests for Directory class.
 * Uses real OPFS APIs in browser via Playwright.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { fromDirectoryHandle } from '~/src/factories.js'
import { getTestRoot, uniqueTestDir } from '../../setup.js'
import type { DirectoryInterface } from '~/src/types.js'
import { NotFoundError, TypeMismatchError } from '~/src/errors.js'

describe('Directory', () => {
	let root: DirectoryInterface
	let testDir: DirectoryInterface
	let testDirName: string

	beforeEach(async() => {
		const nativeRoot = await getTestRoot()
		root = fromDirectoryHandle(nativeRoot)
		testDirName = uniqueTestDir()
		testDir = await root.createDirectory(testDirName)
	})

	afterEach(async() => {
		const nativeRoot = await getTestRoot()
		try {
			await nativeRoot.removeEntry(testDirName, { recursive: true })
		} catch {
			// Ignore if already removed
		}
	})

	describe('getName()', () => {
		it('returns the directory name', async() => {
			const dir = await testDir.createDirectory('subdir')
			expect(dir.getName()).toBe('subdir')
		})

		it('returns name for test directory', () => {
			expect(testDir.getName()).toBe(testDirName)
		})
	})

	describe('getFile()', () => {
		it('returns file if exists', async() => {
			await testDir.createFile('test.txt')
			const file = await testDir.getFile('test.txt')
			expect(file).toBeDefined()
			expect(file?.getName()).toBe('test.txt')
		})

		it('returns undefined if file does not exist', async() => {
			const file = await testDir.getFile('nonexistent.txt')
			expect(file).toBeUndefined()
		})

		it('returns undefined if name is a directory', async() => {
			await testDir.createDirectory('subdir')
			const file = await testDir.getFile('subdir')
			expect(file).toBeUndefined()
		})
	})

	describe('resolveFile()', () => {
		it('returns file if exists', async() => {
			await testDir.createFile('test.txt')
			const file = await testDir.resolveFile('test.txt')
			expect(file.getName()).toBe('test.txt')
		})

		it('throws NotFoundError if file does not exist', async() => {
			await expect(testDir.resolveFile('nonexistent.txt'))
				.rejects.toThrow(NotFoundError)
		})
	})

	describe('createFile()', () => {
		it('creates a new file', async() => {
			const file = await testDir.createFile('new.txt')
			expect(file.getName()).toBe('new.txt')
			expect(await testDir.hasFile('new.txt')).toBe(true)
		})

		it('overwrites existing file', async() => {
			const file1 = await testDir.createFile('test.txt')
			await file1.write('Original')

			const file2 = await testDir.createFile('test.txt')
			// File is recreated (empty)
			expect(file2.getName()).toBe('test.txt')
		})
	})

	describe('hasFile()', () => {
		it('returns true if file exists', async() => {
			await testDir.createFile('test.txt')
			expect(await testDir.hasFile('test.txt')).toBe(true)
		})

		it('returns false if file does not exist', async() => {
			expect(await testDir.hasFile('nonexistent.txt')).toBe(false)
		})

		it('returns false if name is a directory', async() => {
			await testDir.createDirectory('subdir')
			expect(await testDir.hasFile('subdir')).toBe(false)
		})
	})

	describe('removeFile()', () => {
		it('removes a file', async() => {
			await testDir.createFile('test.txt')
			await testDir.removeFile('test.txt')
			expect(await testDir.hasFile('test.txt')).toBe(false)
		})

		it('throws NotFoundError if file does not exist', async() => {
			await expect(testDir.removeFile('nonexistent.txt'))
				.rejects.toThrow(NotFoundError)
		})

		it('throws TypeMismatchError if name is a directory', async() => {
			await testDir.createDirectory('subdir')
			await expect(testDir.removeFile('subdir'))
				.rejects.toThrow(TypeMismatchError)
		})
	})

	describe('getDirectory()', () => {
		it('returns directory if exists', async() => {
			await testDir.createDirectory('subdir')
			const dir = await testDir.getDirectory('subdir')
			expect(dir).toBeDefined()
			expect(dir?.getName()).toBe('subdir')
		})

		it('returns undefined if directory does not exist', async() => {
			const dir = await testDir.getDirectory('nonexistent')
			expect(dir).toBeUndefined()
		})

		it('returns undefined if name is a file', async() => {
			await testDir.createFile('file.txt')
			const dir = await testDir.getDirectory('file.txt')
			expect(dir).toBeUndefined()
		})
	})

	describe('resolveDirectory()', () => {
		it('returns directory if exists', async() => {
			await testDir.createDirectory('subdir')
			const dir = await testDir.resolveDirectory('subdir')
			expect(dir.getName()).toBe('subdir')
		})

		it('throws NotFoundError if directory does not exist', async() => {
			await expect(testDir.resolveDirectory('nonexistent'))
				.rejects.toThrow(NotFoundError)
		})
	})

	describe('createDirectory()', () => {
		it('creates a new directory', async() => {
			const dir = await testDir.createDirectory('newdir')
			expect(dir.getName()).toBe('newdir')
			expect(await testDir.hasDirectory('newdir')).toBe(true)
		})

		it('returns existing directory if already exists', async() => {
			await testDir.createDirectory('subdir')
			const dir = await testDir.createDirectory('subdir')
			expect(dir.getName()).toBe('subdir')
		})
	})

	describe('hasDirectory()', () => {
		it('returns true if directory exists', async() => {
			await testDir.createDirectory('subdir')
			expect(await testDir.hasDirectory('subdir')).toBe(true)
		})

		it('returns false if directory does not exist', async() => {
			expect(await testDir.hasDirectory('nonexistent')).toBe(false)
		})

		it('returns false if name is a file', async() => {
			await testDir.createFile('file.txt')
			expect(await testDir.hasDirectory('file.txt')).toBe(false)
		})
	})

	describe('removeDirectory()', () => {
		it('removes an empty directory', async() => {
			await testDir.createDirectory('subdir')
			await testDir.removeDirectory('subdir')
			expect(await testDir.hasDirectory('subdir')).toBe(false)
		})

		it('throws NotFoundError if directory does not exist', async() => {
			await expect(testDir.removeDirectory('nonexistent'))
				.rejects.toThrow(NotFoundError)
		})

		it('throws TypeMismatchError if name is a file', async() => {
			await testDir.createFile('file.txt')
			await expect(testDir.removeDirectory('file.txt'))
				.rejects.toThrow(TypeMismatchError)
		})

		it('removes directory with contents when recursive', async() => {
			const subdir = await testDir.createDirectory('subdir')
			await subdir.createFile('file.txt')

			await testDir.removeDirectory('subdir', { recursive: true })
			expect(await testDir.hasDirectory('subdir')).toBe(false)
		})
	})

	describe('createPath()', () => {
		it('creates nested directories', async() => {
			const deep = await testDir.createPath('a', 'b', 'c')
			expect(deep.getName()).toBe('c')

			// Verify path exists
			const a = await testDir.resolveDirectory('a')
			const b = await a.resolveDirectory('b')
			const c = await b.resolveDirectory('c')
			expect(c.getName()).toBe('c')
		})

		it('returns self for empty path', async() => {
			const result = await testDir.createPath()
			expect(result.getName()).toBe(testDirName)
		})

		it('creates single directory', async() => {
			const result = await testDir.createPath('single')
			expect(result.getName()).toBe('single')
		})
	})

	describe('resolvePath()', () => {
		it('resolves path to file', async() => {
			const subdir = await testDir.createDirectory('subdir')
			await subdir.createFile('file.txt')

			const result = await testDir.resolvePath('subdir', 'file.txt')
			expect(result).toBeDefined()
			expect(result?.native.kind).toBe('file')
		})

		it('resolves path to directory', async() => {
			await testDir.createPath('a', 'b')

			const result = await testDir.resolvePath('a', 'b')
			expect(result).toBeDefined()
			expect(result?.native.kind).toBe('directory')
		})

		it('returns undefined for nonexistent path', async() => {
			const result = await testDir.resolvePath('nonexistent', 'path')
			expect(result).toBeUndefined()
		})

		it('returns self for empty path', async() => {
			const result = await testDir.resolvePath()
			expect(result).toBeDefined()
			expect(result?.getName()).toBe(testDirName)
		})
	})

	describe('entries()', () => {
		it('iterates all entries', async() => {
			await testDir.createFile('file1.txt')
			await testDir.createFile('file2.txt')
			await testDir.createDirectory('subdir')

			const entries = []
			for await (const entry of testDir.entries()) {
				entries.push(entry)
			}

			expect(entries.length).toBe(3)
			const names = entries.map(e => e.name).sort()
			expect(names).toEqual(['file1.txt', 'file2.txt', 'subdir'])
		})

		it('returns empty for empty directory', async() => {
			const entries = []
			for await (const entry of testDir.entries()) {
				entries.push(entry)
			}
			expect(entries.length).toBe(0)
		})
	})

	describe('files()', () => {
		it('iterates only files', async() => {
			await testDir.createFile('file1.txt')
			await testDir.createFile('file2.txt')
			await testDir.createDirectory('subdir')

			const files = []
			for await (const file of testDir.files()) {
				files.push(file)
			}

			expect(files.length).toBe(2)
			const names = files.map(f => f.getName()).sort()
			expect(names).toEqual(['file1.txt', 'file2.txt'])
		})
	})

	describe('directories()', () => {
		it('iterates only directories', async() => {
			await testDir.createFile('file.txt')
			await testDir.createDirectory('dir1')
			await testDir.createDirectory('dir2')

			const dirs = []
			for await (const dir of testDir.directories()) {
				dirs.push(dir)
			}

			expect(dirs.length).toBe(2)
			const names = dirs.map(d => d.getName()).sort()
			expect(names).toEqual(['dir1', 'dir2'])
		})
	})

	describe('list()', () => {
		it('lists all entries as array', async() => {
			await testDir.createFile('file.txt')
			await testDir.createDirectory('subdir')

			const entries = await testDir.list()
			expect(entries.length).toBe(2)
		})
	})

	describe('listFiles()', () => {
		it('lists all files as array', async() => {
			await testDir.createFile('file1.txt')
			await testDir.createFile('file2.txt')
			await testDir.createDirectory('subdir')

			const files = await testDir.listFiles()
			expect(files.length).toBe(2)
		})
	})

	describe('listDirectories()', () => {
		it('lists all directories as array', async() => {
			await testDir.createFile('file.txt')
			await testDir.createDirectory('dir1')
			await testDir.createDirectory('dir2')

			const dirs = await testDir.listDirectories()
			expect(dirs.length).toBe(2)
		})
	})

	describe('walk()', () => {
		it('walks directory tree recursively', async() => {
			await testDir.createFile('root.txt')
			const sub = await testDir.createDirectory('sub')
			await sub.createFile('sub.txt')
			const deep = await sub.createDirectory('deep')
			await deep.createFile('deep.txt')

			const entries = []
			for await (const entry of testDir.walk()) {
				entries.push(entry)
			}

			// Should have: root.txt, sub, sub.txt, deep, deep.txt
			expect(entries.length).toBe(5)
		})

		it('respects maxDepth option', async() => {
			const sub = await testDir.createDirectory('sub')
			await sub.createDirectory('deep')

			const entries = []
			for await (const entry of testDir.walk({ maxDepth: 0 })) {
				entries.push(entry)
			}

			// Only top level
			expect(entries.length).toBe(1)
			expect(entries[0]?.entry.name).toBe('sub')
		})

		it('filters by includeFiles option', async() => {
			await testDir.createFile('file.txt')
			await testDir.createDirectory('subdir')

			const entries = []
			for await (const entry of testDir.walk({ includeFiles: false })) {
				entries.push(entry)
			}

			expect(entries.length).toBe(1)
			expect(entries[0]?.entry.kind).toBe('directory')
		})

		it('filters by includeDirectories option', async() => {
			await testDir.createFile('file.txt')
			await testDir.createDirectory('subdir')

			const entries = []
			for await (const entry of testDir.walk({ includeDirectories: false })) {
				entries.push(entry)
			}

			expect(entries.length).toBe(1)
			expect(entries[0]?.entry.kind).toBe('file')
		})

		it('applies filter function', async() => {
			await testDir.createFile('keep.txt')
			await testDir.createFile('skip.txt')
			await testDir.createDirectory('keepdir')

			const entries = []
			for await (const entry of testDir.walk({
				filter: (e) => e.name.startsWith('keep'),
			})) {
				entries.push(entry)
			}

			expect(entries.length).toBe(2)
		})

		it('provides correct path and depth', async() => {
			const sub = await testDir.createDirectory('sub')
			await sub.createFile('file.txt')

			const entries = []
			for await (const entry of testDir.walk()) {
				entries.push(entry)
			}

			const subEntry = entries.find(e => e.entry.name === 'sub')
			expect(subEntry?.depth).toBe(0)
			expect(subEntry?.path).toEqual([])

			const fileEntry = entries.find(e => e.entry.name === 'file.txt')
			expect(fileEntry?.depth).toBe(1)
			expect(fileEntry?.path).toEqual(['sub'])
		})
	})

	describe('native', () => {
		it('exposes native handle', () => {
			expect(testDir.native).toBeDefined()
			expect(testDir.native.kind).toBe('directory')
		})
	})

	describe('isSameEntry()', () => {
		it('returns true for same directory', async() => {
			const dir1 = await testDir.createDirectory('subdir')
			const dir2 = await testDir.resolveDirectory('subdir')

			expect(await dir1.isSameEntry(dir2)).toBe(true)
		})

		it('returns false for different directories', async() => {
			const dir1 = await testDir.createDirectory('dir1')
			const dir2 = await testDir.createDirectory('dir2')

			expect(await dir1.isSameEntry(dir2)).toBe(false)
		})
	})

	describe('resolve()', () => {
		it('returns path to descendant file', async() => {
			const sub = await testDir.createDirectory('sub')
			const file = await sub.createFile('file.txt')

			const path = await testDir.resolve(file)
			expect(path).toEqual(['sub', 'file.txt'])
		})

		it('returns null for non-descendant', async() => {
			const otherDir = await root.createDirectory('other-' + Date.now())
			const file = await otherDir.createFile('file.txt')

			const path = await testDir.resolve(file)
			expect(path).toBeNull()

			// Cleanup
			await root.removeDirectory('other-' + Date.now(), { recursive: true }).catch(() => {})
		})
	})

	describe('permissions', () => {
		it('hasReadPermission returns true for OPFS', async() => {
			expect(await testDir.hasReadPermission()).toBe(true)
		})

		it('hasWritePermission returns true for OPFS', async() => {
			expect(await testDir.hasWritePermission()).toBe(true)
		})

		it('requestWritePermission returns true for OPFS', async() => {
			expect(await testDir.requestWritePermission()).toBe(true)
		})
	})

	describe('edge cases', () => {
		it('handles directory with spaces in name', async() => {
			const dir = await testDir.createDirectory('my directory')
			expect(dir.getName()).toBe('my directory')
		})

		it('handles directory with special characters', async() => {
			const dir = await testDir.createDirectory('dir-with_special.chars')
			expect(dir.getName()).toBe('dir-with_special.chars')
		})

		it('handles deeply nested paths', async() => {
			const deep = await testDir.createPath('a', 'b', 'c', 'd', 'e', 'f')
			expect(deep.getName()).toBe('f')

			const result = await testDir.resolvePath('a', 'b', 'c', 'd', 'e', 'f')
			expect(result).toBeDefined()
		})

		it('handles many files in directory', async() => {
			for (let i = 0; i < 50; i++) {
				await testDir.createFile(`file${i}.txt`)
			}

			const files = await testDir.listFiles()
			expect(files.length).toBe(50)
		})
	})
})
