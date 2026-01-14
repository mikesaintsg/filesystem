/**
 * @mikesaintsg/filesystem
 *
 * Tests for FileSystem class.
 * Uses real OPFS APIs in browser via Playwright.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createFileSystem } from '~/src/factories.js'
import { getTestRoot, uniqueTestDir, createTestFile } from '../../setup.js'
import type { FileSystemInterface, DirectoryInterface } from '~/src/types.js'
import { NotSupportedError } from '~/src/errors.js'

describe('FileSystem', () => {
	let fs: FileSystemInterface
	let testDir: DirectoryInterface
	let testDirName: string

	beforeEach(async() => {
		fs = await createFileSystem()
		const root = await fs.getRoot()
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

	describe('createFileSystem()', () => {
		it('creates a file system instance', async() => {
			const newFs = await createFileSystem()
			expect(newFs).toBeDefined()
		})
	})

	describe('getRoot()', () => {
		it('returns OPFS root directory', async() => {
			const root = await fs.getRoot()
			expect(root).toBeDefined()
			expect(root.getName()).toBe('')
		})

		it('returns same root on multiple calls', async() => {
			const root1 = await fs.getRoot()
			const root2 = await fs.getRoot()
			expect(await root1.isSameEntry(root2)).toBe(true)
		})
	})

	describe('getQuota()', () => {
		it('returns storage quota information', async() => {
			const quota = await fs.getQuota()
			expect(typeof quota.usage).toBe('number')
			expect(typeof quota.quota).toBe('number')
			expect(typeof quota.available).toBe('number')
			expect(typeof quota.percentUsed).toBe('number')
		})

		it('has available = quota - usage', async() => {
			const quota = await fs.getQuota()
			expect(quota.available).toBe(quota.quota - quota.usage)
		})

		it('updates usage after writing file', async() => {
			const quotaBefore = await fs.getQuota()

			// Write some data
			const file = await testDir.createFile('quota-test.txt')
			const largeContent = 'X'.repeat(10000) // 10KB
			await file.write(largeContent)

			const quotaAfter = await fs.getQuota()
			// Usage should have increased (may not be exact due to metadata)
			expect(quotaAfter.usage).toBeGreaterThanOrEqual(quotaBefore.usage)
		})
	})

	describe('isUserAccessSupported()', () => {
		it('returns a boolean', () => {
			const result = fs.isUserAccessSupported()
			expect(typeof result).toBe('boolean')
		})

		it('returns true in Chromium', () => {
			// Running in Playwright with Chromium
			expect(fs.isUserAccessSupported()).toBe(true)
		})
	})

	describe('fromFile()', () => {
		it('wraps a File object', async() => {
			const nativeFile = createTestFile('Hello, World!', 'test.txt')
			const file = await fs.fromFile(nativeFile)

			expect(file.getName()).toBe('test.txt')
			expect(await file.getText()).toBe('Hello, World!')
		})

		it('returns read-only file', async() => {
			const nativeFile = createTestFile('content', 'test.txt')
			const file = await fs.fromFile(nativeFile)

			// Write should throw NotSupportedError
			await expect(file.write('new content')).rejects.toThrow(NotSupportedError)
		})

		it('preserves file metadata', async() => {
			const nativeFile = createTestFile('Hello', 'document.txt', 'text/plain')
			const file = await fs.fromFile(nativeFile)

			const metadata = await file.getMetadata()
			expect(metadata.name).toBe('document.txt')
			expect(metadata.size).toBe(5)
			expect(metadata.type).toBe('text/plain')
		})
	})

	describe('fromFiles()', () => {
		it('wraps a FileList', async() => {
			// Create a FileList-like object (DataTransfer can create real FileLists)
			const dt = new DataTransfer()
			dt.items.add(new File(['content1'], 'file1.txt'))
			dt.items.add(new File(['content2'], 'file2.txt'))

			const files = await fs.fromFiles(dt.files)

			expect(files.length).toBe(2)
			expect(files[0]?.getName()).toBe('file1.txt')
			expect(files[1]?.getName()).toBe('file2.txt')
		})

		it('returns empty array for empty FileList', async() => {
			const dt = new DataTransfer()
			const files = await fs.fromFiles(dt.files)
			expect(files.length).toBe(0)
		})
	})

	describe('full workflow', () => {
		it('creates files and directories through the API', async() => {
			// Get root
			const root = await fs.getRoot()
			expect(root).toBeDefined()

			// Create nested structure
			const workDir = await root.createDirectory('workflow-test-' + Date.now())
			const dataDir = await workDir.createPath('data', 'cache')

			// Create and write file
			const file = await dataDir.createFile('config.json')
			await file.write('{"version": 1}')

			// Read back
			const content = await file.getText()
			expect(content).toBe('{"version": 1}')

			// Verify path
			const resolved = await workDir.resolvePath('data', 'cache', 'config.json')
			expect(resolved).toBeDefined()

			// Cleanup
			await root.removeDirectory(workDir.getName(), { recursive: true })
		})

		it('walks directory tree', async() => {
			// Create structure
			await testDir.createFile('root.txt')
			const sub = await testDir.createDirectory('sub')
			await sub.createFile('nested.txt')

			// Walk
			const entries: string[] = []
			for await (const entry of testDir.walk()) {
				entries.push(entry.entry.name)
			}

			expect(entries).toContain('root.txt')
			expect(entries).toContain('sub')
			expect(entries).toContain('nested.txt')
		})
	})

	describe('File API source (ReadOnlyFile)', () => {
		it('can read text', async() => {
			const nativeFile = createTestFile('Hello!', 'test.txt')
			const file = await fs.fromFile(nativeFile)
			expect(await file.getText()).toBe('Hello!')
		})

		it('can read as ArrayBuffer', async() => {
			const nativeFile = createTestFile('Data', 'test.bin')
			const file = await fs.fromFile(nativeFile)

			const buffer = await file.getArrayBuffer()
			expect(buffer.byteLength).toBe(4)
		})

		it('can read as Blob', async() => {
			const nativeFile = createTestFile('Blob data', 'test.txt')
			const file = await fs.fromFile(nativeFile)

			const blob = await file.getBlob()
			expect(blob.size).toBe(9)
		})

		it('can get stream', async() => {
			const nativeFile = createTestFile('Stream data', 'test.txt')
			const file = await fs.fromFile(nativeFile)

			const stream = file.getStream()
			const reader = stream.getReader()
			const { done, value } = await reader.read()
			expect(done).toBe(false)
			expect(value).toBeDefined()
			reader.releaseLock()
		})

		it('hasReadPermission returns true', async() => {
			const nativeFile = createTestFile('test', 'test.txt')
			const file = await fs.fromFile(nativeFile)
			expect(await file.hasReadPermission()).toBe(true)
		})

		it('hasWritePermission returns false', async() => {
			const nativeFile = createTestFile('test', 'test.txt')
			const file = await fs.fromFile(nativeFile)
			expect(await file.hasWritePermission()).toBe(false)
		})

		it('requestWritePermission returns false', async() => {
			const nativeFile = createTestFile('test', 'test.txt')
			const file = await fs.fromFile(nativeFile)
			expect(await file.requestWritePermission()).toBe(false)
		})

		it('append throws NotSupportedError', async() => {
			const nativeFile = createTestFile('test', 'test.txt')
			const file = await fs.fromFile(nativeFile)
			await expect(file.append('more')).rejects.toThrow(NotSupportedError)
		})

		it('truncate throws NotSupportedError', async() => {
			const nativeFile = createTestFile('test', 'test.txt')
			const file = await fs.fromFile(nativeFile)
			await expect(file.truncate(0)).rejects.toThrow(NotSupportedError)
		})

		it('openWritable throws NotSupportedError', async() => {
			const nativeFile = createTestFile('test', 'test.txt')
			const file = await fs.fromFile(nativeFile)
			await expect(file.openWritable()).rejects.toThrow(NotSupportedError)
		})

		it('native throws NotSupportedError', async() => {
			const nativeFile = createTestFile('test', 'test.txt')
			const file = await fs.fromFile(nativeFile)
			expect(() => file.native).toThrow(NotSupportedError)
		})

		it('isSameEntry compares File objects', async() => {
			const nativeFile1 = createTestFile('test', 'test.txt')
			const nativeFile2 = createTestFile('test', 'test.txt')

			const file1 = await fs.fromFile(nativeFile1)
			const file1Copy = await fs.fromFile(nativeFile1)
			const file2 = await fs.fromFile(nativeFile2)

			expect(await file1.isSameEntry(file1Copy)).toBe(true)
			expect(await file1.isSameEntry(file2)).toBe(false)
		})
	})

	describe('export()', () => {
		it('exports file system entries', async() => {
			const file = await testDir.createFile('export-test.txt')
			await file.write('Export content')

			const exported = await fs.export()

			expect(exported.version).toBe(1)
			expect(typeof exported.exportedAt).toBe('number')
			expect(exported.entries.length).toBeGreaterThan(0)
		})

		it('exports files with content', async() => {
			const file = await testDir.createFile('content-test.txt')
			await file.write('Hello, World!')

			const exported = await fs.export()
			const fileEntry = exported.entries.find(e =>
				e.kind === 'file' && e.name === 'content-test.txt',
			)

			expect(fileEntry).toBeDefined()
			if (fileEntry?.kind === 'file') {
				expect(fileEntry.content.byteLength).toBeGreaterThan(0)
			}
		})

		it('respects includePaths option', async() => {
			const includeDir = await testDir.createDirectory('include')
			const excludeDir = await testDir.createDirectory('exclude')
			const includeFile = await includeDir.createFile('file.txt')
			await includeFile.write('Include me')
			const excludeFile = await excludeDir.createFile('file.txt')
			await excludeFile.write('Exclude me')

			const includePath = `/${testDirName}/include`
			const exported = await fs.export({ includePaths: [includePath] })

			const paths = exported.entries.map(e => e.path)
			const hasInclude = paths.some(p => p.includes('/include'))
			const hasExclude = paths.some(p => p.includes('/exclude'))

			expect(hasInclude).toBe(true)
			expect(hasExclude).toBe(false)
		})
	})

	describe('import()', () => {
		it('imports file system entries', async() => {
			const importData = {
				version: 1,
				exportedAt: Date.now(),
				entries: [
					{
						path: `/${testDirName}/imported.txt`,
						name: 'imported.txt',
						kind: 'file' as const,
						content: new TextEncoder().encode('Imported content').buffer,
						lastModified: Date.now(),
					},
				],
			}

			await fs.import(importData)

			const file = await testDir.getFile('imported.txt')
			expect(file).toBeDefined()
			expect(await file?.getText()).toBe('Imported content')
		})

		it('imports directories', async() => {
			const importData = {
				version: 1,
				exportedAt: Date.now(),
				entries: [
					{
						path: `/${testDirName}/imported-dir`,
						name: 'imported-dir',
						kind: 'directory' as const,
					},
				],
			}

			await fs.import(importData)

			expect(await testDir.hasDirectory('imported-dir')).toBe(true)
		})

		it('skips existing files with skip merge behavior', async() => {
			const existingFile = await testDir.createFile('existing.txt')
			await existingFile.write('Original')

			const importData = {
				version: 1,
				exportedAt: Date.now(),
				entries: [
					{
						path: `/${testDirName}/existing.txt`,
						name: 'existing.txt',
						kind: 'file' as const,
						content: new TextEncoder().encode('New').buffer,
						lastModified: Date.now(),
					},
				],
			}

			await fs.import(importData, { mergeBehavior: 'skip' })

			expect(await existingFile.getText()).toBe('Original')
		})
	})

	describe('close()', () => {
		it('closes without error', () => {
			expect(() => fs.close()).not.toThrow()
		})
	})
})
