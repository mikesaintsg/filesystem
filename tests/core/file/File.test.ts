/**
 * @mikesaintsg/filesystem
 *
 * Tests for File class.
 * Uses real OPFS APIs in browser via Playwright.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { fromDirectoryHandle } from '~/src/factories.js'
import { getTestRoot, uniqueTestDir } from '../../setup.js'
import type { DirectoryInterface } from '~/src/types.js'

describe('File', () => {
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
		it('returns the file name', async() => {
			const file = await testDir.createFile('test.txt')
			expect(file.getName()).toBe('test.txt')
		})

		it('returns name with extension', async() => {
			const file = await testDir.createFile('document.json')
			expect(file.getName()).toBe('document.json')
		})

		it('returns name without extension', async() => {
			const file = await testDir.createFile('README')
			expect(file.getName()).toBe('README')
		})
	})

	describe('getMetadata()', () => {
		it('returns file metadata', async() => {
			const file = await testDir.createFile('test.txt')
			await file.write('Hello, World!')

			const metadata = await file.getMetadata()
			expect(metadata.name).toBe('test.txt')
			expect(metadata.size).toBe(13) // 'Hello, World!'.length
			expect(typeof metadata.lastModified).toBe('number')
		})

		it('returns empty file metadata', async() => {
			const file = await testDir.createFile('empty.txt')

			const metadata = await file.getMetadata()
			expect(metadata.size).toBe(0)
		})

		it('updates size after write', async() => {
			const file = await testDir.createFile('test.txt')

			let metadata = await file.getMetadata()
			expect(metadata.size).toBe(0)

			await file.write('Test content')
			metadata = await file.getMetadata()
			expect(metadata.size).toBe(12)
		})
	})

	describe('getText()', () => {
		it('reads text content', async() => {
			const file = await testDir.createFile('test.txt')
			await file.write('Hello, World!')

			const content = await file.getText()
			expect(content).toBe('Hello, World!')
		})

		it('reads empty file', async() => {
			const file = await testDir.createFile('empty.txt')

			const content = await file.getText()
			expect(content).toBe('')
		})

		it('reads unicode content', async() => {
			const file = await testDir.createFile('unicode.txt')
			await file.write('Hello, 世界! 🌍')

			const content = await file.getText()
			expect(content).toBe('Hello, 世界! 🌍')
		})

		it('reads multiline content', async() => {
			const file = await testDir.createFile('multiline.txt')
			await file.write('Line 1\nLine 2\nLine 3')

			const content = await file.getText()
			expect(content).toBe('Line 1\nLine 2\nLine 3')
		})
	})

	describe('getArrayBuffer()', () => {
		it('reads binary content', async() => {
			const file = await testDir.createFile('binary.bin')
			const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]) // 'Hello'
			await file.write(data.buffer)

			const buffer = await file.getArrayBuffer()
			const view = new Uint8Array(buffer)
			expect(view).toEqual(data)
		})

		it('reads empty file as empty buffer', async() => {
			const file = await testDir.createFile('empty.bin')

			const buffer = await file.getArrayBuffer()
			expect(buffer.byteLength).toBe(0)
		})
	})

	describe('getBlob()', () => {
		it('reads content as Blob', async() => {
			const file = await testDir.createFile('test.txt')
			await file.write('Hello, World!')

			const blob = await file.getBlob()
			expect(blob.size).toBe(13)
			expect(await blob.text()).toBe('Hello, World!')
		})
	})

	describe('getStream()', () => {
		it('returns readable stream', async() => {
			const file = await testDir.createFile('test.txt')
			await file.write('Hello, World!')

			const stream = file.getStream()
			const reader = stream.getReader()

			const chunks: Uint8Array[] = []
			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				chunks.push(value)
			}

			const combined = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0))
			let offset = 0
			for (const chunk of chunks) {
				combined.set(chunk, offset)
				offset += chunk.length
			}

			const text = new TextDecoder().decode(combined)
			expect(text).toBe('Hello, World!')
		})
	})

	describe('write()', () => {
		it('writes string content', async() => {
			const file = await testDir.createFile('test.txt')
			await file.write('Hello, World!')

			expect(await file.getText()).toBe('Hello, World!')
		})

		it('overwrites existing content', async() => {
			const file = await testDir.createFile('test.txt')
			await file.write('First content')
			await file.write('Second')

			expect(await file.getText()).toBe('Second')
		})

		it('writes binary data', async() => {
			const file = await testDir.createFile('binary.bin')
			const data = new Uint8Array([1, 2, 3, 4, 5])
			await file.write(data.buffer)

			const buffer = await file.getArrayBuffer()
			expect(new Uint8Array(buffer)).toEqual(data)
		})

		it('writes Blob', async() => {
			const file = await testDir.createFile('test.txt')
			const blob = new Blob(['Hello from Blob'], { type: 'text/plain' })
			await file.write(blob)

			expect(await file.getText()).toBe('Hello from Blob')
		})

		it('writes at specific position', async() => {
			const file = await testDir.createFile('test.txt')
			await file.write('Hello, World!')
			await file.write('J', { position: 0, keepExistingData: true })

			expect(await file.getText()).toBe('Jello, World!')
		})

		it('keeps existing data when option is set', async() => {
			const file = await testDir.createFile('test.txt')
			await file.write('Hello, World!')
			await file.write('XXXX', { position: 7, keepExistingData: true })

			// 'Hello, World!' with 'XXXX' written at position 7:
			// 'Hello, ' (7 chars) + 'XXXX' (4 chars) + 'd!' (remaining 2 chars)
			expect(await file.getText()).toBe('Hello, XXXXd!')
		})
	})

	describe('append()', () => {
		it('appends to file', async() => {
			const file = await testDir.createFile('test.txt')
			await file.write('Hello')
			await file.append(', World!')

			expect(await file.getText()).toBe('Hello, World!')
		})

		it('appends to empty file', async() => {
			const file = await testDir.createFile('test.txt')
			await file.append('First line')

			expect(await file.getText()).toBe('First line')
		})

		it('appends multiple times', async() => {
			const file = await testDir.createFile('test.txt')
			await file.append('A')
			await file.append('B')
			await file.append('C')

			expect(await file.getText()).toBe('ABC')
		})
	})

	describe('truncate()', () => {
		it('truncates to smaller size', async() => {
			const file = await testDir.createFile('test.txt')
			await file.write('Hello, World!')
			await file.truncate(5)

			expect(await file.getText()).toBe('Hello')
		})

		it('truncates to zero', async() => {
			const file = await testDir.createFile('test.txt')
			await file.write('Hello, World!')
			await file.truncate(0)

			expect(await file.getText()).toBe('')
			const metadata = await file.getMetadata()
			expect(metadata.size).toBe(0)
		})

		it('extends file when truncating to larger size', async() => {
			const file = await testDir.createFile('test.txt')
			await file.write('Hi')
			await file.truncate(10)

			const metadata = await file.getMetadata()
			expect(metadata.size).toBe(10)
		})
	})

	describe('openWritable()', () => {
		it('returns writable stream', async() => {
			const file = await testDir.createFile('test.txt')
			const writable = await file.openWritable()

			await writable.write('Hello')
			await writable.write(', World!')
			await writable.close()

			expect(await file.getText()).toBe('Hello, World!')
		})

		it('supports seek', async() => {
			const file = await testDir.createFile('test.txt')
			const writable = await file.openWritable()

			await writable.write('Hello, World!')
			await writable.seek(7)
			await writable.write('Everyone!')
			await writable.close()

			expect(await file.getText()).toBe('Hello, Everyone!')
		})

		it('supports truncate', async() => {
			const file = await testDir.createFile('test.txt')
			const writable = await file.openWritable()

			await writable.write('Hello, World!')
			await writable.truncate(5)
			await writable.close()

			expect(await file.getText()).toBe('Hello')
		})

		it('abort discards changes', async() => {
			const file = await testDir.createFile('test.txt')
			await file.write('Original')

			const writable = await file.openWritable()
			await writable.write('New content that should be discarded')
			await writable.abort()

			expect(await file.getText()).toBe('Original')
		})
	})

	describe('native', () => {
		it('exposes native handle', async() => {
			const file = await testDir.createFile('test.txt')
			expect(file.native).toBeDefined()
			expect(file.native.kind).toBe('file')
			expect(file.native.name).toBe('test.txt')
		})
	})

	describe('isSameEntry()', () => {
		it('returns true for same file', async() => {
			const file1 = await testDir.createFile('test.txt')
			const file2 = await testDir.resolveFile('test.txt')

			expect(await file1.isSameEntry(file2)).toBe(true)
		})

		it('returns false for different files', async() => {
			const file1 = await testDir.createFile('file1.txt')
			const file2 = await testDir.createFile('file2.txt')

			expect(await file1.isSameEntry(file2)).toBe(false)
		})
	})

	describe('permissions', () => {
		it('hasReadPermission returns true for OPFS', async() => {
			const file = await testDir.createFile('test.txt')
			expect(await file.hasReadPermission()).toBe(true)
		})

		it('hasWritePermission returns true for OPFS', async() => {
			const file = await testDir.createFile('test.txt')
			expect(await file.hasWritePermission()).toBe(true)
		})

		it('requestWritePermission returns true for OPFS', async() => {
			const file = await testDir.createFile('test.txt')
			expect(await file.requestWritePermission()).toBe(true)
		})
	})

	describe('edge cases', () => {
		it('handles file with spaces in name', async() => {
			const file = await testDir.createFile('my file.txt')
			await file.write('Content')
			expect(file.getName()).toBe('my file.txt')
			expect(await file.getText()).toBe('Content')
		})

		it('handles file with special characters in name', async() => {
			const file = await testDir.createFile('file-with_special.chars.txt')
			await file.write('Content')
			expect(file.getName()).toBe('file-with_special.chars.txt')
		})

		it('handles large content', async() => {
			const file = await testDir.createFile('large.txt')
			const largeContent = 'X'.repeat(100000) // 100KB
			await file.write(largeContent)

			const content = await file.getText()
			expect(content.length).toBe(100000)
		})

		it('handles binary file with null bytes', async() => {
			const file = await testDir.createFile('binary.bin')
			const data = new Uint8Array([0, 1, 0, 2, 0, 3])
			await file.write(data.buffer)

			const buffer = await file.getArrayBuffer()
			expect(new Uint8Array(buffer)).toEqual(data)
		})
	})
})
