/**
 * @mikesaintsg/filesystem
 *
 * Tests for InMemoryAdapter.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { InMemoryAdapter } from '~/src/adapters/InMemoryAdapter.js'
import { NotFoundError, TypeMismatchError } from '~/src/errors.js'

describe('InMemoryAdapter', () => {
	let adapter: InMemoryAdapter

	beforeEach(async() => {
		adapter = new InMemoryAdapter()
		await adapter.init()
	})

	afterEach(() => {
		adapter.close()
	})

	describe('isAvailable()', () => {
		it('returns true always', async() => {
			const newAdapter = new InMemoryAdapter()
			expect(await newAdapter.isAvailable()).toBe(true)
		})
	})

	describe('init() and close()', () => {
		it('initializes with root directory', async() => {
			expect(await adapter.hasDirectory('/')).toBe(true)
		})

		it('clears entries on close', async() => {
			await adapter.writeFile('/test.txt', 'content')
			adapter.close()
			await adapter.init()
			expect(await adapter.hasFile('/test.txt')).toBe(false)
		})
	})

	describe('file operations', () => {
		describe('writeFile() and getFileText()', () => {
			it('writes and reads text content', async() => {
				await adapter.writeFile('/test.txt', 'Hello, World!')
				const content = await adapter.getFileText('/test.txt')
				expect(content).toBe('Hello, World!')
			})

			it('overwrites existing content', async() => {
				await adapter.writeFile('/test.txt', 'First')
				await adapter.writeFile('/test.txt', 'Second')
				expect(await adapter.getFileText('/test.txt')).toBe('Second')
			})

			it('writes at specific position', async() => {
				await adapter.writeFile('/test.txt', 'Hello, World!')
				await adapter.writeFile('/test.txt', 'XXXX', { position: 7, keepExistingData: true })
				expect(await adapter.getFileText('/test.txt')).toBe('Hello, XXXXd!')
			})

			it('writes binary data', async() => {
				const data = new Uint8Array([1, 2, 3, 4, 5])
				await adapter.writeFile('/binary.bin', data.buffer)
				const buffer = await adapter.getFileArrayBuffer('/binary.bin')
				expect(new Uint8Array(buffer)).toEqual(data)
			})

			it('writes Blob data', async() => {
				const blob = new Blob(['Hello from Blob'])
				await adapter.writeFile('/blob.txt', blob)
				expect(await adapter.getFileText('/blob.txt')).toBe('Hello from Blob')
			})
		})

		describe('getFileArrayBuffer()', () => {
			it('reads content as ArrayBuffer', async() => {
				const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f])
				await adapter.writeFile('/binary.bin', data.buffer)
				const buffer = await adapter.getFileArrayBuffer('/binary.bin')
				expect(new Uint8Array(buffer)).toEqual(data)
			})

			it('throws NotFoundError for missing file', async() => {
				await expect(adapter.getFileArrayBuffer('/missing.txt')).rejects.toThrow(NotFoundError)
			})
		})

		describe('getFileBlob()', () => {
			it('reads content as Blob', async() => {
				await adapter.writeFile('/test.txt', 'Hello')
				const blob = await adapter.getFileBlob('/test.txt')
				expect(blob.size).toBe(5)
			})
		})

		describe('getFileMetadata()', () => {
			it('returns file metadata', async() => {
				await adapter.writeFile('/test.txt', 'Hello, World!')
				const metadata = await adapter.getFileMetadata('/test.txt')
				expect(metadata.name).toBe('test.txt')
				expect(metadata.size).toBe(13)
				expect(typeof metadata.lastModified).toBe('number')
			})

			it('throws NotFoundError for missing file', async() => {
				await expect(adapter.getFileMetadata('/missing.txt')).rejects.toThrow(NotFoundError)
			})
		})

		describe('appendFile()', () => {
			it('appends to existing file', async() => {
				await adapter.writeFile('/test.txt', 'Hello')
				await adapter.appendFile('/test.txt', ', World!')
				expect(await adapter.getFileText('/test.txt')).toBe('Hello, World!')
			})

			it('creates file if not exists', async() => {
				await adapter.appendFile('/new.txt', 'Content')
				expect(await adapter.getFileText('/new.txt')).toBe('Content')
			})
		})

		describe('truncateFile()', () => {
			it('truncates to smaller size', async() => {
				await adapter.writeFile('/test.txt', 'Hello, World!')
				await adapter.truncateFile('/test.txt', 5)
				expect(await adapter.getFileText('/test.txt')).toBe('Hello')
			})

			it('extends file when truncating to larger size', async() => {
				await adapter.writeFile('/test.txt', 'Hi')
				await adapter.truncateFile('/test.txt', 10)
				const metadata = await adapter.getFileMetadata('/test.txt')
				expect(metadata.size).toBe(10)
			})

			it('throws NotFoundError for missing file', async() => {
				await expect(adapter.truncateFile('/missing.txt', 5)).rejects.toThrow(NotFoundError)
			})
		})

		describe('hasFile()', () => {
			it('returns true for existing file', async() => {
				await adapter.writeFile('/test.txt', 'content')
				expect(await adapter.hasFile('/test.txt')).toBe(true)
			})

			it('returns false for missing file', async() => {
				expect(await adapter.hasFile('/missing.txt')).toBe(false)
			})

			it('returns false for directory', async() => {
				await adapter.createDirectory('/folder')
				expect(await adapter.hasFile('/folder')).toBe(false)
			})
		})

		describe('removeFile()', () => {
			it('removes a file', async() => {
				await adapter.writeFile('/test.txt', 'content')
				await adapter.removeFile('/test.txt')
				expect(await adapter.hasFile('/test.txt')).toBe(false)
			})

			it('throws NotFoundError for missing file', async() => {
				await expect(adapter.removeFile('/missing.txt')).rejects.toThrow(NotFoundError)
			})

			it('throws TypeMismatchError for directory', async() => {
				await adapter.createDirectory('/folder')
				await expect(adapter.removeFile('/folder')).rejects.toThrow(TypeMismatchError)
			})
		})

		describe('copyFile()', () => {
			it('copies a file', async() => {
				await adapter.writeFile('/source.txt', 'Original content')
				await adapter.copyFile('/source.txt', '/dest.txt')

				expect(await adapter.getFileText('/dest.txt')).toBe('Original content')
				expect(await adapter.hasFile('/source.txt')).toBe(true)
			})

			it('throws error if destination exists and overwrite is false', async() => {
				await adapter.writeFile('/source.txt', 'Source')
				await adapter.writeFile('/dest.txt', 'Dest')

				await expect(adapter.copyFile('/source.txt', '/dest.txt')).rejects.toThrow(TypeMismatchError)
			})

			it('overwrites destination when overwrite is true', async() => {
				await adapter.writeFile('/source.txt', 'Source')
				await adapter.writeFile('/dest.txt', 'Dest')
				await adapter.copyFile('/source.txt', '/dest.txt', { overwrite: true })

				expect(await adapter.getFileText('/dest.txt')).toBe('Source')
			})
		})

		describe('moveFile()', () => {
			it('moves a file', async() => {
				await adapter.writeFile('/source.txt', 'Content')
				await adapter.moveFile('/source.txt', '/dest.txt')

				expect(await adapter.getFileText('/dest.txt')).toBe('Content')
				expect(await adapter.hasFile('/source.txt')).toBe(false)
			})

			it('throws error if source does not exist', async() => {
				await expect(adapter.moveFile('/missing.txt', '/dest.txt')).rejects.toThrow(NotFoundError)
			})
		})
	})

	describe('directory operations', () => {
		describe('createDirectory()', () => {
			it('creates a directory', async() => {
				await adapter.createDirectory('/folder')
				expect(await adapter.hasDirectory('/folder')).toBe(true)
			})

			it('creates nested directories', async() => {
				await adapter.createDirectory('/a')
				await adapter.createDirectory('/a/b')
				await adapter.createDirectory('/a/b/c')
				expect(await adapter.hasDirectory('/a/b/c')).toBe(true)
			})
		})

		describe('hasDirectory()', () => {
			it('returns true for root', async() => {
				expect(await adapter.hasDirectory('/')).toBe(true)
			})

			it('returns true for existing directory', async() => {
				await adapter.createDirectory('/folder')
				expect(await adapter.hasDirectory('/folder')).toBe(true)
			})

			it('returns false for missing directory', async() => {
				expect(await adapter.hasDirectory('/missing')).toBe(false)
			})

			it('returns false for file', async() => {
				await adapter.writeFile('/file.txt', 'content')
				expect(await adapter.hasDirectory('/file.txt')).toBe(false)
			})
		})

		describe('removeDirectory()', () => {
			it('removes an empty directory', async() => {
				await adapter.createDirectory('/folder')
				await adapter.removeDirectory('/folder')
				expect(await adapter.hasDirectory('/folder')).toBe(false)
			})

			it('throws error for non-empty directory without recursive', async() => {
				await adapter.createDirectory('/folder')
				await adapter.writeFile('/folder/file.txt', 'content')
				await expect(adapter.removeDirectory('/folder')).rejects.toThrow()
			})

			it('removes directory with contents when recursive', async() => {
				await adapter.createDirectory('/folder')
				await adapter.writeFile('/folder/file.txt', 'content')
				await adapter.removeDirectory('/folder', { recursive: true })
				expect(await adapter.hasDirectory('/folder')).toBe(false)
			})
		})

		describe('listEntries()', () => {
			it('lists entries in root', async() => {
				await adapter.writeFile('/file.txt', 'content')
				await adapter.createDirectory('/folder')

				const entries = await adapter.listEntries('/')
				expect(entries.length).toBe(2)

				const names = entries.map(e => e.name).sort()
				expect(names).toContain('file.txt')
				expect(names).toContain('folder')
			})

			it('lists entries in subdirectory', async() => {
				await adapter.createDirectory('/folder')
				await adapter.writeFile('/folder/file1.txt', 'content')
				await adapter.writeFile('/folder/file2.txt', 'content')

				const entries = await adapter.listEntries('/folder')
				expect(entries.length).toBe(2)
			})

			it('returns empty array for empty directory', async() => {
				await adapter.createDirectory('/empty')
				const entries = await adapter.listEntries('/empty')
				expect(entries.length).toBe(0)
			})
		})
	})

	describe('quota', () => {
		it('returns quota information', async() => {
			const quota = await adapter.getQuota()
			expect(typeof quota.usage).toBe('number')
			expect(typeof quota.quota).toBe('number')
			expect(typeof quota.available).toBe('number')
			expect(typeof quota.percentUsed).toBe('number')
		})

		it('updates usage after writing', async() => {
			const before = await adapter.getQuota()
			await adapter.writeFile('/large.txt', 'X'.repeat(10000))
			const after = await adapter.getQuota()
			expect(after.usage).toBeGreaterThan(before.usage)
		})
	})

	describe('export/import', () => {
		it('exports all entries', async() => {
			await adapter.writeFile('/file.txt', 'Content')
			await adapter.createDirectory('/folder')
			await adapter.writeFile('/folder/nested.txt', 'Nested')

			const exported = await adapter.export()

			expect(exported.version).toBe(1)
			expect(exported.entries.length).toBe(3)
		})

		it('imports entries', async() => {
			const exported = {
				version: 1,
				exportedAt: Date.now(),
				entries: [
					{ path: '/imported.txt', name: 'imported.txt', kind: 'file' as const, content: new TextEncoder().encode('Imported!').buffer, lastModified: Date.now() },
					{ path: '/dir', name: 'dir', kind: 'directory' as const },
				],
			}

			await adapter.import(exported)

			expect(await adapter.getFileText('/imported.txt')).toBe('Imported!')
			expect(await adapter.hasDirectory('/dir')).toBe(true)
		})

		it('respects merge behavior: skip', async() => {
			await adapter.writeFile('/existing.txt', 'Original')

			const exported = {
				version: 1,
				exportedAt: Date.now(),
				entries: [
					{ path: '/existing.txt', name: 'existing.txt', kind: 'file' as const, content: new TextEncoder().encode('New').buffer, lastModified: Date.now() },
				],
			}

			await adapter.import(exported, { mergeBehavior: 'skip' })
			expect(await adapter.getFileText('/existing.txt')).toBe('Original')
		})

		it('respects merge behavior: error', async() => {
			await adapter.writeFile('/existing.txt', 'Original')

			const exported = {
				version: 1,
				exportedAt: Date.now(),
				entries: [
					{ path: '/existing.txt', name: 'existing.txt', kind: 'file' as const, content: new TextEncoder().encode('New').buffer, lastModified: Date.now() },
				],
			}

			await expect(adapter.import(exported, { mergeBehavior: 'error' })).rejects.toThrow()
		})

		it('respects merge behavior: replace (default)', async() => {
			await adapter.writeFile('/existing.txt', 'Original')

			const exported = {
				version: 1,
				exportedAt: Date.now(),
				entries: [
					{ path: '/existing.txt', name: 'existing.txt', kind: 'file' as const, content: new TextEncoder().encode('New').buffer, lastModified: Date.now() },
				],
			}

			await adapter.import(exported)
			expect(await adapter.getFileText('/existing.txt')).toBe('New')
		})

		it('exports with include paths filter', async() => {
			await adapter.writeFile('/keep/file.txt', 'Keep')
			await adapter.writeFile('/exclude/file.txt', 'Exclude')

			const exported = await adapter.export({ includePaths: ['/keep'] })

			// The /keep directory and /keep/file.txt should be included
			expect(exported.entries.length).toBe(2)
			const paths = exported.entries.map(e => e.path).sort()
			expect(paths).toContain('/keep')
			expect(paths).toContain('/keep/file.txt')
		})

		it('exports with exclude paths filter', async() => {
			await adapter.writeFile('/keep.txt', 'Keep')
			await adapter.writeFile('/exclude/file.txt', 'Exclude')

			const exported = await adapter.export({ excludePaths: ['/exclude'] })

			expect(exported.entries.some(e => e.path.startsWith('/exclude'))).toBe(false)
		})
	})

	describe('edge cases', () => {
		it('handles unicode content', async() => {
			await adapter.writeFile('/unicode.txt', 'Hello, 世界! 🌍')
			expect(await adapter.getFileText('/unicode.txt')).toBe('Hello, 世界! 🌍')
		})

		it('handles empty file', async() => {
			await adapter.writeFile('/empty.txt', '')
			expect(await adapter.getFileText('/empty.txt')).toBe('')
			const metadata = await adapter.getFileMetadata('/empty.txt')
			expect(metadata.size).toBe(0)
		})

		it('handles file with special characters in name', async() => {
			await adapter.writeFile('/file-with_special.chars.txt', 'content')
			expect(await adapter.hasFile('/file-with_special.chars.txt')).toBe(true)
		})

		it('handles deeply nested paths', async() => {
			await adapter.writeFile('/a/b/c/d/e/f.txt', 'deep')
			expect(await adapter.getFileText('/a/b/c/d/e/f.txt')).toBe('deep')
			expect(await adapter.hasDirectory('/a/b/c/d/e')).toBe(true)
		})
	})
})
