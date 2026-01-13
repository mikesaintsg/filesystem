/**
 * @mikesaintsg/filesystem
 *
 * Test setup and utilities.
 * Uses real browser APIs via Playwright - no mocks.
 */

/**
 * Delays execution for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Creates a test Blob with specified content
 */
export function createTestBlob(content: string, type = 'text/plain'): Blob {
	return new Blob([content], { type })
}

/**
 * Creates a test File with specified content
 */
export function createTestFile(content: string, name = 'test.txt', type = 'text/plain'): File {
	return new File([content], name, { type })
}

/**
 * Gets the OPFS root directory for testing
 * @returns Promise<FileSystemDirectoryHandle>
 */
export async function getTestRoot(): Promise<FileSystemDirectoryHandle> {
	return navigator.storage.getDirectory()
}

/**
 * Cleans up a directory by removing all entries
 * @param dir - Directory handle to clean
 */
export async function cleanDirectory(dir: FileSystemDirectoryHandle): Promise<void> {
	const entries: string[] = []
	for await (const [name] of dir.entries()) {
		entries.push(name)
	}
	for (const name of entries) {
		await dir.removeEntry(name, { recursive: true })
	}
}

/**
 * Creates a unique test directory name
 */
export function uniqueTestDir(): string {
	return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
