/**
 * @mikesaintsg/filesystem Showcase
 *
 * Comprehensive demonstration of ALL features of the @mikesaintsg/filesystem library.
 * Each tab showcases a specific category of functionality with interactive examples.
 *
 * Features covered:
 * - OPFS Storage: Create, read, write, delete files in private storage
 * - Directory Operations: Create nested directories, list contents, walk recursively
 * - File Operations: Read/write in different formats (text, binary, blob, stream)
 * - Writable Streams: Streaming writes with seek/truncate
 * - File Pickers: Open, save, directory pickers (Chromium only)
 * - Drag & Drop: Drop files and folders
 * - Storage Quota: Show quota usage
 * - Error Handling: Demonstrate typed errors
 *
 * MOBILE SUPPORT: When OPFS is unavailable (private browsing, Safari iOS limitations),
 * the showcase provides demo mode with simulated examples and clear explanations.
 */

import './styles.css'
import type { ExampleResult, InteractiveDemoResult } from './examples/types.js'
import {
	createFileSystem,
	isFilePickerSupported,
	formatBytes,
	isNotFoundError,
	isNotAllowedError,
	isQuotaExceededError,
	isAbortError,
	NotFoundError,
	ERROR_MESSAGES,
} from '~/src/index.js'
import type { FileSystemInterface, DirectoryInterface, FileInterface } from '~/src/types.js'

// ============================================================================
// App State
// ============================================================================

type TabId = 'opfs' | 'directories' | 'files' | 'streams' | 'pickers' | 'dragdrop' | 'errors'

let fs: FileSystemInterface | null = null
let root: DirectoryInterface | null = null
let activeTab: TabId = 'dragdrop' // Default to drag-drop which works everywhere
let opfsAvailable = false
let opfsError: string | null = null
const demoCleanups: (() => void)[] = []

// ============================================================================
// Tab Definitions
// ============================================================================

interface TabDefinition {
	readonly id: TabId
	readonly emoji: string
	readonly label: string
	readonly description: string
}

const TABS: readonly TabDefinition[] = [
	{ id: 'dragdrop', emoji: '🎯', label: 'Drag & Drop', description: 'Drop files and folders - works everywhere' },
	{ id: 'opfs', emoji: '💾', label: 'OPFS Storage', description: 'Origin Private File System - sandboxed storage for web apps' },
	{ id: 'directories', emoji: '📁', label: 'Directories', description: 'Create nested directories, list contents, recursive walk' },
	{ id: 'files', emoji: '📄', label: 'File Operations', description: 'Read/write text, binary, blob, stream formats' },
	{ id: 'streams', emoji: '🔄', label: 'Writable Streams', description: 'Streaming writes with seek, truncate, abort' },
	{ id: 'pickers', emoji: '📂', label: 'File Pickers', description: 'Native file dialogs (Chromium only)' },
	{ id: 'errors', emoji: '⚠️', label: 'Error Handling', description: 'Typed error classes and type guards' },
]

// Tabs that require OPFS to work
const OPFS_REQUIRED_TABS: readonly TabId[] = ['opfs', 'directories', 'files', 'streams']

function requiresOPFS(tab: TabId): boolean {
	return OPFS_REQUIRED_TABS.includes(tab)
}

// ============================================================================
// Example Definitions
// ============================================================================

interface ExampleDefinition {
	readonly id: string
	readonly title: string
	readonly description: string
	readonly run: () => Promise<ExampleResult> | ExampleResult
}

function getExamplesForTab(tab: TabId): readonly ExampleDefinition[] {
	switch (tab) {
		case 'opfs':
			return [
				{ id: 'quota', title: 'getQuota() - Storage Information', description: 'Check storage usage and available space', run: demonstrateQuota },
				{ id: 'create-file', title: 'createFile() - Create File', description: 'Create a new file in OPFS', run: demonstrateCreateFile },
				{ id: 'read-file', title: 'getText() - Read File', description: 'Read file content as text', run: demonstrateReadFile },
				{ id: 'write-file', title: 'write() - Write File', description: 'Write content to file (atomic)', run: demonstrateWriteFile },
				{ id: 'delete-file', title: 'removeFile() - Delete File', description: 'Remove a file from storage', run: demonstrateDeleteFile },
				{ id: 'native-access', title: '.native - Native Access', description: 'Access underlying FileSystemHandle', run: demonstrateNativeAccess },
			]
		case 'directories':
			return [
				{ id: 'create-dir', title: 'createDirectory() - Create Directory', description: 'Create a single directory', run: demonstrateCreateDirectory },
				{ id: 'create-path', title: 'createPath() - Nested Directories', description: 'Create nested directories like mkdir -p', run: demonstrateCreatePath },
				{ id: 'list-entries', title: 'list() - List Contents', description: 'List all files and directories', run: demonstrateListEntries },
				{ id: 'iterate', title: 'entries() - Async Iteration', description: 'Memory-efficient directory iteration', run: demonstrateAsyncIteration },
				{ id: 'walk', title: 'walk() - Recursive Walk', description: 'Recursively walk directory tree', run: demonstrateWalk },
				{ id: 'walk-filter', title: 'walk() with Filter', description: 'Walk with depth limit and filter', run: demonstrateWalkWithFilter },
			]
		case 'files':
			return [
				{ id: 'read-text', title: 'getText() - Read as Text', description: 'Read file content as string', run: demonstrateReadText },
				{ id: 'read-binary', title: 'getArrayBuffer() - Read as Binary', description: 'Read file as ArrayBuffer', run: demonstrateReadBinary },
				{ id: 'read-blob', title: 'getBlob() - Read as Blob', description: 'Read file as Blob object', run: demonstrateReadBlob },
				{ id: 'read-stream', title: 'getStream() - Read as Stream', description: 'Stream file content in chunks', run: demonstrateReadStream },
				{ id: 'write-position', title: 'write() with Position', description: 'Write at specific byte position', run: demonstrateWritePosition },
				{ id: 'append', title: 'append() - Append Data', description: 'Append content to end of file', run: demonstrateAppend },
				{ id: 'truncate', title: 'truncate() - Resize File', description: 'Truncate file to specific size', run: demonstrateTruncate },
				{ id: 'metadata', title: 'getMetadata() - File Info', description: 'Get file name, size, type, modified date', run: demonstrateMetadata },
			]
		case 'streams':
			return [
				{ id: 'stream-write', title: 'openWritable() - Stream Write', description: 'Open writable stream for file', run: demonstrateStreamWrite },
				{ id: 'stream-seek', title: 'seek() - Move Cursor', description: 'Seek to position in stream', run: demonstrateStreamSeek },
				{ id: 'stream-truncate', title: 'truncate() - Resize', description: 'Truncate file via stream', run: demonstrateStreamTruncate },
				{ id: 'stream-abort', title: 'abort() - Discard Changes', description: 'Abort stream and discard changes', run: demonstrateStreamAbort },
			]
		case 'pickers':
			return [
				{ id: 'feature-check', title: 'isUserAccessSupported()', description: 'Check if pickers are available', run: demonstratePickerSupport },
				{ id: 'open-picker', title: 'showOpenFilePicker()', description: 'Open file picker dialog', run: demonstrateOpenPicker },
				{ id: 'save-picker', title: 'showSaveFilePicker()', description: 'Save file picker dialog', run: demonstrateSavePicker },
				{ id: 'dir-picker', title: 'showDirectoryPicker()', description: 'Directory picker dialog', run: demonstrateDirectoryPicker },
			]
		case 'dragdrop':
			return [
				{ id: 'file-input', title: 'fromFile() - File Input', description: 'Convert File API to FileInterface', run: demonstrateFromFile },
				{ id: 'file-list', title: 'fromFiles() - FileList', description: 'Convert FileList to FileInterface[]', run: demonstrateFromFiles },
			]
		case 'errors':
			return [
				{ id: 'not-found', title: 'NotFoundError', description: 'Thrown when file/directory not found', run: demonstrateNotFoundError },
				{ id: 'type-guards', title: 'Type Guards', description: 'Safe error type checking', run: demonstrateTypeGuards },
				{ id: 'error-codes', title: 'Error Codes', description: 'All error code enumeration', run: demonstrateErrorCodes },
			]
	}
}

// ============================================================================
// OPFS Availability Check Helper
// ============================================================================

function checkOPFSAvailable(): ExampleResult | null {
	if (!opfsAvailable || !fs || !root) {
		return {
			success: false,
			message: `OPFS not available: ${opfsError ?? 'Unknown error'}. Try using Chrome, Edge, or Opera in normal browsing mode.`,
			code: `// OPFS may be unavailable due to:
// - Private/Incognito browsing mode
// - Safari iOS limitations
// - Browser security restrictions
// - Cross-origin iframe restrictions

// Check OPFS support before using:
import { isOPFSSupported } from '@mikesaintsg/filesystem'
if (isOPFSSupported()) {
    const fs = await createFileSystem()
    const root = await fs.getRoot()
}`,
		}
	}
	return null
}

// ============================================================================
// OPFS Examples
// ============================================================================

async function demonstrateQuota(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const quota = await fs!.getQuota()
	return {
		success: true,
		message: `Storage: ${formatBytes(quota.usage)} used of ${formatBytes(quota.quota)} (${quota.percentUsed.toFixed(1)}% used)`,
		data: quota,
		code: `const quota = await fs.getQuota()
console.log(\`Used: \${quota.usage} bytes\`)
console.log(\`Quota: \${quota.quota} bytes\`)
console.log(\`Available: \${quota.available} bytes\`)
console.log(\`Percent: \${quota.percentUsed.toFixed(1)}%\`)`,
	}
}

async function demonstrateCreateFile(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const file = await root!.createFile('demo-file.txt')
	await file.write('Hello, OPFS!')
	return {
		success: true,
		message: `Created file: ${file.getName()}`,
		data: { name: file.getName(), content: await file.getText() },
		code: `const file = await root.createFile('demo-file.txt')
await file.write('Hello, OPFS!')`,
	}
}

async function demonstrateReadFile(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const file = await root!.getFile('demo-file.txt')
	if (!file) {
		return { success: false, message: 'File not found. Run "Create File" first.' }
	}
	const content = await file.getText()
	return {
		success: true,
		message: `Read ${content.length} characters from file`,
		data: { name: file.getName(), content },
		code: `const file = await root.getFile('demo-file.txt')
if (file) {
    const content = await file.getText()
    console.log(content)
}`,
	}
}

async function demonstrateWriteFile(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const file = await root!.createFile('demo-file.txt')
	const content = `Updated at ${new Date().toISOString()}`
	await file.write(content)
	return {
		success: true,
		message: 'File written successfully (atomic write)',
		data: { name: file.getName(), content: await file.getText() },
		code: `const file = await root.createFile('demo-file.txt')
await file.write('New content')
// Write is atomic - content is written to temp file and swapped`,
	}
}

async function demonstrateDeleteFile(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const exists = await root!.hasFile('demo-file.txt')
	if (!exists) {
		return { success: false, message: 'File not found. Run "Create File" first.' }
	}
	await root!.removeFile('demo-file.txt')
	return {
		success: true,
		message: 'File deleted successfully',
		code: 'await root.removeFile(\'demo-file.txt\')',
	}
}

async function demonstrateNativeAccess(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const file = await root!.createFile('native-demo.txt')
	await file.write('Native access demo')
	const nativeHandle = file.native
	const nativeFile = await nativeHandle.getFile()
	await root!.removeFile('native-demo.txt')
	return {
		success: true,
		message: 'Accessed native FileSystemFileHandle',
		data: {
			handleKind: nativeHandle.kind,
			handleName: nativeHandle.name,
			nativeFileName: nativeFile.name,
			nativeFileSize: nativeFile.size,
		},
		code: `const nativeHandle = file.native
// nativeHandle is FileSystemFileHandle
const nativeFile = await nativeHandle.getFile()
console.log(nativeFile.name, nativeFile.size)`,
	}
}

// ============================================================================
// Directory Examples
// ============================================================================

async function demonstrateCreateDirectory(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const dir = await root!.createDirectory('demo-folder')
	return {
		success: true,
		message: `Created directory: ${dir.getName()}`,
		data: { name: dir.getName() },
		code: 'const dir = await root.createDirectory(\'demo-folder\')',
	}
}

async function demonstrateCreatePath(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const deep = await root!.createPath('data', 'cache', 'images')
	return {
		success: true,
		message: 'Created nested directories: data/cache/images',
		data: { path: 'data/cache/images', finalDir: deep.getName() },
		code: `// Like mkdir -p
const deep = await root.createPath('data', 'cache', 'images')
// Creates all intermediate directories`,
	}
}

async function demonstrateListEntries(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	// Create some demo content
	await root!.createFile('list-demo-1.txt')
	await root!.createFile('list-demo-2.txt')
	await root!.createDirectory('list-demo-folder')

	const entries = await root!.list()
	const summary = entries.map(e => `${e.kind}: ${e.name}`)

	// Cleanup
	await root!.removeFile('list-demo-1.txt')
	await root!.removeFile('list-demo-2.txt')
	await root!.removeDirectory('list-demo-folder')

	return {
		success: true,
		message: `Found ${entries.length} entries`,
		data: summary,
		code: `const entries = await directory.list()
for (const entry of entries) {
    console.log(\`\${entry.kind}: \${entry.name}\`)
}`,
	}
}

async function demonstrateAsyncIteration(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	// Create demo content
	await root!.createFile('iter-1.txt')
	await root!.createFile('iter-2.txt')
	await root!.createDirectory('iter-folder')

	const entries: string[] = []
	for await (const entry of root!.entries()) {
		entries.push(`${entry.kind}: ${entry.name}`)
		if (entries.length >= 5) break // Demo early break
	}

	// Cleanup
	await root!.removeFile('iter-1.txt')
	await root!.removeFile('iter-2.txt')
	await root!.removeDirectory('iter-folder')

	return {
		success: true,
		message: `Iterated ${entries.length} entries (with early break support)`,
		data: entries,
		code: `// Memory-efficient async iteration
for await (const entry of directory.entries()) {
    console.log(entry.name)
    if (shouldStop) break // Early break supported
}`,
	}
}

async function demonstrateWalk(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	// Create demo structure
	const demoDir = await root!.createDirectory('walk-demo')
	await demoDir.createFile('file1.txt')
	const subDir = await demoDir.createDirectory('subdir')
	await subDir.createFile('file2.txt')

	const walked: string[] = []
	for await (const { path, entry, depth } of demoDir.walk()) {
		const fullPath = [...path, entry.name].join('/')
		walked.push(`${'  '.repeat(depth)}${entry.kind}: ${fullPath}`)
	}

	// Cleanup
	await root!.removeDirectory('walk-demo', { recursive: true })

	return {
		success: true,
		message: `Walked ${walked.length} entries recursively`,
		data: walked,
		code: `for await (const { path, entry, depth } of directory.walk()) {
    const fullPath = [...path, entry.name].join('/')
    console.log(\`\${'  '.repeat(depth)}\${entry.kind}: \${fullPath}\`)
}`,
	}
}

async function demonstrateWalkWithFilter(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	// Create demo structure
	const demoDir = await root!.createDirectory('walk-filter-demo')
	await demoDir.createFile('visible.txt')
	await demoDir.createFile('.hidden')
	const subDir = await demoDir.createDirectory('visible-folder')
	await subDir.createFile('deep.txt')
	const deepDir = await subDir.createDirectory('deeper')
	await deepDir.createFile('too-deep.txt')

	const walked: string[] = []
	for await (const { entry } of demoDir.walk({
		maxDepth: 2,
		includeFiles: true,
		includeDirectories: true,
		filter: (e) => !e.name.startsWith('.'),
	})) {
		walked.push(`${entry.kind}: ${entry.name}`)
	}

	// Cleanup
	await root!.removeDirectory('walk-filter-demo', { recursive: true })

	return {
		success: true,
		message: `Walked ${walked.length} entries with maxDepth=2 and hidden file filter`,
		data: walked,
		code: `for await (const { entry } of directory.walk({
    maxDepth: 2,
    includeFiles: true,
    includeDirectories: true,
    filter: (e) => !e.name.startsWith('.')
})) {
    console.log(entry.name)
}`,
	}
}

// ============================================================================
// File Examples
// ============================================================================

async function demonstrateReadText(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const file = await root!.createFile('text-demo.txt')
	await file.write('Hello, World! 🌍')
	const text = await file.getText()
	await root!.removeFile('text-demo.txt')
	return {
		success: true,
		message: `Read text: "${text}"`,
		data: { text, length: text.length },
		code: 'const text = await file.getText()',
	}
}

async function demonstrateReadBinary(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const file = await root!.createFile('binary-demo.bin')
	await file.write(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]))
	const buffer = await file.getArrayBuffer()
	const view = new Uint8Array(buffer)
	await root!.removeFile('binary-demo.bin')
	return {
		success: true,
		message: `Read ${buffer.byteLength} bytes as ArrayBuffer`,
		data: { byteLength: buffer.byteLength, bytes: Array.from(view) },
		code: `const buffer = await file.getArrayBuffer()
const view = new Uint8Array(buffer)`,
	}
}

async function demonstrateReadBlob(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const file = await root!.createFile('blob-demo.txt')
	await file.write('Blob content')
	const blob = await file.getBlob()
	await root!.removeFile('blob-demo.txt')
	return {
		success: true,
		message: `Read as Blob: ${blob.size} bytes, type: ${blob.type || 'unknown'}`,
		data: { size: blob.size, type: blob.type },
		code: `const blob = await file.getBlob()
console.log(blob.size, blob.type)`,
	}
}

async function demonstrateReadStream(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const content = 'Stream content: chunk by chunk processing'
	const file = await root!.createFile('stream-demo.txt')
	await file.write(content)

	const stream = file.getStream()
	const reader = stream.getReader()
	let totalBytes = 0
	let chunks = 0

	while (true) {
		const { done, value } = await reader.read()
		if (done) break
		totalBytes += value.length
		chunks++
	}

	await root!.removeFile('stream-demo.txt')
	return {
		success: true,
		message: `Streamed ${totalBytes} bytes in ${chunks} chunk(s)`,
		data: { totalBytes, chunks },
		code: `const stream = file.getStream()
const reader = stream.getReader()
while (true) {
    const { done, value } = await reader.read()
    if (done) break
    processChunk(value)
}`,
	}
}

async function demonstrateWritePosition(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable
	const file = await root!.createFile('position-demo.txt')
	await file.write('Hello, World!')
	await file.write('XXXXX', { position: 7, keepExistingData: true })
	const result = await file.getText()
	await root!.removeFile('position-demo.txt')
	return {
		success: true,
		message: `Wrote at position 7: "${result}"`,
		data: { before: 'Hello, World!', after: result },
		code: `await file.write('Hello, World!')
await file.write('XXXXX', { position: 7, keepExistingData: true })
// Result: "Hello, XXXXX!"`,
	}
}

async function demonstrateAppend(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const file = await root!.createFile('append-demo.txt')
	await file.write('Line 1')
	await file.append('\nLine 2')
	await file.append('\nLine 3')
	const result = await file.getText()
	await root!.removeFile('append-demo.txt')
	return {
		success: true,
		message: 'Appended 2 lines to file',
		data: { content: result, lines: result.split('\n') },
		code: `await file.write('Line 1')
await file.append('\\nLine 2')
await file.append('\\nLine 3')`,
	}
}

async function demonstrateTruncate(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const file = await root!.createFile('truncate-demo.txt')
	await file.write('This is a long string that will be truncated')
	const before = await file.getText()
	await file.truncate(10)
	const after = await file.getText()
	await root!.removeFile('truncate-demo.txt')
	return {
		success: true,
		message: `Truncated from ${before.length} to ${after.length} bytes`,
		data: { before, after },
		code: `await file.write('Long content...')
await file.truncate(10) // File is now 10 bytes`,
	}
}

async function demonstrateMetadata(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const file = await root!.createFile('metadata-demo.txt')
	await file.write('Metadata demo content')
	const metadata = await file.getMetadata()
	await root!.removeFile('metadata-demo.txt')
	return {
		success: true,
		message: `File: ${metadata.name}, Size: ${formatBytes(metadata.size)}`,
		data: {
			name: metadata.name,
			size: metadata.size,
			type: metadata.type,
			lastModified: new Date(metadata.lastModified).toISOString(),
		},
		code: `const metadata = await file.getMetadata()
console.log(metadata.name)         // 'document.txt'
console.log(metadata.size)         // 1024
console.log(metadata.type)         // 'text/plain'
console.log(metadata.lastModified) // timestamp`,
	}
}

// ============================================================================
// Writable Stream Examples
// ============================================================================

async function demonstrateStreamWrite(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const file = await root!.createFile('writable-demo.txt')
	const writable = await file.openWritable()

	await writable.write('First chunk')
	await writable.write(' | ')
	await writable.write('Second chunk')
	await writable.close()

	const content = await file.getText()
	await root!.removeFile('writable-demo.txt')

	return {
		success: true,
		message: `Wrote via stream: "${content}"`,
		data: { content },
		code: `const writable = await file.openWritable()
await writable.write('First chunk')
await writable.write(' | ')
await writable.write('Second chunk')
await writable.close() // Commit changes`,
	}
}

async function demonstrateStreamSeek(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const file = await root!.createFile('seek-demo.txt')
	const writable = await file.openWritable()

	await writable.write('AAAAAAAAAA') // 10 A's
	await writable.seek(5)
	await writable.write('BBBBB') // Overwrite at position 5
	await writable.close()

	const content = await file.getText()
	await root!.removeFile('seek-demo.txt')

	return {
		success: true,
		message: `Seek and overwrite: "${content}"`,
		data: { content },
		code: `const writable = await file.openWritable()
await writable.write('AAAAAAAAAA')
await writable.seek(5)
await writable.write('BBBBB')
await writable.close()
// Result: "AAAAABBBBB"`,
	}
}

async function demonstrateStreamTruncate(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const file = await root!.createFile('stream-truncate-demo.txt')
	const writable = await file.openWritable()

	await writable.write('This content will be partially truncated')
	await writable.truncate(12)
	await writable.close()

	const content = await file.getText()
	await root!.removeFile('stream-truncate-demo.txt')

	return {
		success: true,
		message: `Truncated via stream: "${content}"`,
		data: { content, length: content.length },
		code: `const writable = await file.openWritable()
await writable.write('Long content here')
await writable.truncate(12)
await writable.close()`,
	}
}

async function demonstrateStreamAbort(): Promise<ExampleResult> {
	const unavailable = checkOPFSAvailable()
	if (unavailable) return unavailable

	const file = await root!.createFile('abort-demo.txt')
	await file.write('Original content')

	const writable = await file.openWritable()
	await writable.write('This will be discarded')
	await writable.abort() // Discard changes

	const content = await file.getText()
	await root!.removeFile('abort-demo.txt')

	return {
		success: true,
		message: `Aborted stream - original preserved: "${content}"`,
		data: { content },
		code: `await file.write('Original content')
const writable = await file.openWritable()
await writable.write('This will be discarded')
await writable.abort() // Discard changes
// File still contains 'Original content'`,
	}
}

// ============================================================================
// Picker Examples
// ============================================================================

function demonstratePickerSupport(): ExampleResult {
	const supported = fs?.isUserAccessSupported() ?? false
	return {
		success: true,
		message: supported ? 'File pickers ARE supported in this browser' : 'File pickers NOT supported (use fallbacks)',
		data: { supported, browser: navigator.userAgent.includes('Chrome') ? 'Chromium' : 'Other' },
		code: `if (fs.isUserAccessSupported()) {
    // Safe to use showOpenFilePicker, showSaveFilePicker, showDirectoryPicker
    const files = await fs.showOpenFilePicker()
} else {
    // Fall back to <input type="file"> or drag-drop
}`,
	}
}

async function demonstrateOpenPicker(): Promise<ExampleResult> {
	if (!fs?.isUserAccessSupported()) {
		return {
			success: false,
			message: 'File pickers not supported in this browser. Use Chrome, Edge, or Opera.',
			code: `// Fallback for unsupported browsers
const input = document.createElement('input')
input.type = 'file'
input.onchange = () => console.log(input.files)
input.click()`,
		}
	}

	try {
		const files = await fs.showOpenFilePicker({
			multiple: true,
			types: [{ description: 'Text Files', accept: { 'text/*': ['.txt', '.md', '.json'] } }],
		})

		const fileInfo = await Promise.all(files.map(async f => ({
			name: f.getName(),
			size: (await f.getMetadata()).size,
		})))

		return {
			success: true,
			message: `Selected ${files.length} file(s)`,
			data: fileInfo,
			code: `const files = await fs.showOpenFilePicker({
    multiple: true,
    types: [{
        description: 'Text Files',
        accept: { 'text/*': ['.txt', '.md', '.json'] }
    }]
})`,
		}
	} catch (error) {
		if (isAbortError(error)) {
			return { success: true, message: 'User cancelled picker (AbortError)' }
		}
		throw error
	}
}

async function demonstrateSavePicker(): Promise<ExampleResult> {
	if (!fs?.isUserAccessSupported()) {
		return {
			success: false,
			message: 'File pickers not supported in this browser.',
			code: `// Fallback: download blob
const blob = new Blob(['content'], { type: 'text/plain' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = 'file.txt'
a.click()`,
		}
	}

	try {
		const file = await fs.showSaveFilePicker({
			suggestedName: 'demo-export.txt',
			types: [{ description: 'Text Files', accept: { 'text/plain': ['.txt'] } }],
		})

		await file.write(`Exported at ${new Date().toISOString()}`)

		return {
			success: true,
			message: `Saved file: ${file.getName()}`,
			data: { name: file.getName() },
			code: `const file = await fs.showSaveFilePicker({
    suggestedName: 'document.txt',
    types: [{ accept: { 'text/plain': ['.txt'] } }]
})
await file.write('Content to save')`,
		}
	} catch (error) {
		if (isAbortError(error)) {
			return { success: true, message: 'User cancelled picker (AbortError)' }
		}
		throw error
	}
}

async function demonstrateDirectoryPicker(): Promise<ExampleResult> {
	if (!fs?.isUserAccessSupported()) {
		return {
			success: false,
			message: 'Directory picker not supported in this browser.',
		}
	}

	try {
		const dir = await fs.showDirectoryPicker({ mode: 'read' })
		const entries = await dir.list()

		return {
			success: true,
			message: `Selected directory: ${dir.getName()} (${entries.length} entries)`,
			data: {
				name: dir.getName(),
				entryCount: entries.length,
				entries: entries.slice(0, 5).map(e => `${e.kind}: ${e.name}`),
			},
			code: `const dir = await fs.showDirectoryPicker({ mode: 'read' })
for await (const entry of dir.entries()) {
    console.log(entry.name)
}`,
		}
	} catch (error) {
		if (isAbortError(error)) {
			return { success: true, message: 'User cancelled picker (AbortError)' }
		}
		throw error
	}
}

// ============================================================================
// Drag & Drop Examples (These work without OPFS!)
// ============================================================================

async function demonstrateFromFile(): Promise<ExampleResult> {
	// These functions work even without OPFS - they use a read-only wrapper
	// Create a File object programmatically for demo
	const nativeFile = new File(['Demo file content'], 'demo.txt', { type: 'text/plain' })

	// fs.fromFile works without OPFS - it creates a read-only wrapper
	if (!fs) {
		// Fallback: demonstrate that File API works directly
		const content = await nativeFile.text()
		return {
			success: true,
			message: `Direct File API: ${nativeFile.name}`,
			data: { name: nativeFile.name, content },
			code: `// Without fs wrapper, use File API directly
const file = input.files[0]
const content = await file.text()
console.log(content)`,
		}
	}

	const file = await fs.fromFile(nativeFile)
	const content = await file.getText()

	return {
		success: true,
		message: `Converted File to FileInterface: ${file.getName()}`,
		data: { name: file.getName(), content },
		code: `// From file input or drag-drop
const nativeFile = input.files[0]
const file = await fs.fromFile(nativeFile)
const content = await file.getText()
// Note: fromFile creates read-only wrapper`,
	}
}

async function demonstrateFromFiles(): Promise<ExampleResult> {
	// Create a mock FileList using DataTransfer
	const dt = new DataTransfer()
	dt.items.add(new File(['Content 1'], 'file1.txt', { type: 'text/plain' }))
	dt.items.add(new File(['Content 2'], 'file2.txt', { type: 'text/plain' }))
	const fileList = dt.files

	if (!fs) {
		// Fallback: demonstrate File API directly
		const names = Array.from(fileList).map(f => f.name)
		return {
			success: true,
			message: `Direct File API: ${fileList.length} files`,
			data: names,
			code: `// Without fs wrapper, iterate FileList directly
for (const file of input.files) {
    const content = await file.text()
    console.log(file.name, content)
}`,
		}
	}

	const files = await fs.fromFiles(fileList)

	return {
		success: true,
		message: `Converted ${files.length} files from FileList`,
		data: files.map(f => f.getName()),
		code: `// From <input type="file" multiple>
const files = await fs.fromFiles(input.files)
for (const file of files) {
    console.log(file.getName())
}`,
	}
}

// ============================================================================
// Error Examples (These can show simulated examples even without OPFS)
// ============================================================================

async function demonstrateNotFoundError(): Promise<ExampleResult> {
	// If OPFS not available, show simulated error example
	if (!opfsAvailable || !root) {
		// Demonstrate the error class without OPFS
		const error = new NotFoundError('non-existent-file.txt')
		return {
			success: true,
			message: `NotFoundError class: ${error.message}`,
			data: { code: error.code, path: error.path, name: error.name },
			code: `import { NotFoundError } from '@mikesaintsg/filesystem'

// Error is thrown when file/directory not found
try {
    await directory.resolveFile('missing.txt')
} catch (error) {
    if (error instanceof NotFoundError) {
        console.log(\`File not found: \${error.path}\`)
        console.log(\`Error code: \${error.code}\`)
    }
}`,
		}
	}

	try {
		await root.resolveFile('non-existent-file-12345.txt')
		return { success: false, message: 'Expected NotFoundError' }
	} catch (error) {
		if (error instanceof NotFoundError) {
			return {
				success: true,
				message: `Caught NotFoundError: ${error.message}`,
				data: { code: error.code, path: error.path },
				code: `try {
    await directory.resolveFile('missing.txt')
} catch (error) {
    if (error instanceof NotFoundError) {
        console.log(\`File not found: \${error.path}\`)
        console.log(\`Error code: \${error.code}\`)
    }
}`,
			}
		}
		throw error
	}
}

async function demonstrateTypeGuards(): Promise<ExampleResult> {
	// If OPFS not available, show simulated type guard example
	if (!opfsAvailable || !root) {
		const error = new NotFoundError('test.txt')
		const checks = {
			isNotFoundError: isNotFoundError(error),
			isNotAllowedError: isNotAllowedError(error),
			isQuotaExceededError: isQuotaExceededError(error),
			isAbortError: isAbortError(error),
		}

		return {
			success: true,
			message: 'Type guards provide safe error checking (simulated)',
			data: checks,
			code: `import { isNotFoundError, isNotAllowedError } from '@mikesaintsg/filesystem'

try {
    await directory.resolveFile('file.txt')
} catch (error) {
    if (isNotFoundError(error)) {
        // error is typed as NotFoundError
        console.log(error.path)
    } else if (isNotAllowedError(error)) {
        // error is typed as NotAllowedError
    }
}`,
		}
	}

	try {
		await root.resolveFile('non-existent-file.txt')
	} catch (error) {
		const checks = {
			isNotFoundError: isNotFoundError(error),
			isNotAllowedError: isNotAllowedError(error),
			isQuotaExceededError: isQuotaExceededError(error),
			isAbortError: isAbortError(error),
		}

		return {
			success: true,
			message: 'Type guards provide safe error checking',
			data: checks,
			code: `import { isNotFoundError, isNotAllowedError } from '@mikesaintsg/filesystem'

try {
    await directory.resolveFile('file.txt')
} catch (error) {
    if (isNotFoundError(error)) {
        // error is typed as NotFoundError
        console.log(error.path)
    } else if (isNotAllowedError(error)) {
        // error is typed as NotAllowedError
    }
}`,
		}
	}

	return { success: false, message: 'Expected error' }
}

function demonstrateErrorCodes(): ExampleResult {
	const codes = Object.keys(ERROR_MESSAGES)
	return {
		success: true,
		message: `${codes.length} error codes available`,
		data: ERROR_MESSAGES,
		code: `import { ERROR_MESSAGES } from '@mikesaintsg/filesystem'

// Available error codes:
// NOT_FOUND, NOT_ALLOWED, TYPE_MISMATCH,
// NO_MODIFICATION_ALLOWED, INVALID_STATE,
// QUOTA_EXCEEDED, ABORT, SECURITY,
// ENCODING, NOT_SUPPORTED`,
	}
}

// ============================================================================
// Interactive Demos
// ============================================================================

// Error patterns for detecting the Android WebView 132 bug
const WEBVIEW_BUG_PATTERNS = [
	'unsafe for access',
	'too many calls',
	'certain files are unsafe',
] as const

function isWebViewBug(): boolean {
	// Detect Android WebView 132 bug specifically
	// This bug manifests as NotAllowedError with specific message patterns
	if (!opfsError) return false

	const errorMsg = opfsError.toLowerCase()

	// Check for known WebView bug message patterns
	const matchesBugPattern = WEBVIEW_BUG_PATTERNS.some(pattern => errorMsg.includes(pattern))
	if (!matchesBugPattern) return false

	// Additional heuristic: check if on Android (user agent)
	const isAndroid = /android/i.test(navigator.userAgent)

	// Return true if patterns match (regardless of platform, as error messages are specific enough)
	// but give higher confidence if on Android
	return matchesBugPattern || (matchesBugPattern && isAndroid)
}

function createOpfsUnavailableMessage(): string {
	const isKnownBug = isWebViewBug()

	const bugNotice = isKnownBug ? `
		<div class="unavailable-bug-notice">
			<h5>🐛 Known Android WebView Bug Detected</h5>
			<p>This error appears to be caused by a <strong>known bug in Android WebView version 132</strong> (affects Chrome/Edge on Android 14/15).</p>
			<p><strong>This is NOT a limitation of your browser or this library</strong> - it's a temporary bug that Google has acknowledged and is fixing.</p>
			<p><strong>Workarounds:</strong></p>
			<ul>
				<li>📲 Update your browser/WebView to the latest version</li>
				<li>💻 Try on a desktop browser for full functionality</li>
				<li>🔄 Use IndexedDB as a fallback (see our <a href="https://github.com/mikesaintsg/filesystem/blob/main/guides/polyfill.md" target="_blank">Polyfill Guide</a>)</li>
			</ul>
		</div>
	` : ''

	return `
		<div class="demo-app opfs-unavailable">
			<h4>⚠️ OPFS Not Available</h4>
			<p class="demo-desc">Origin Private File System is not accessible in your current browser context.</p>

			${bugNotice}

			<div class="unavailable-reasons">
				<h5>Possible reasons:</h5>
				<ul>
					${isKnownBug ? '<li>🐛 <strong>Android WebView 132 bug</strong> - Known issue, fix is rolling out</li>' : ''}
					<li>🔒 <strong>Private/Incognito browsing mode</strong> - OPFS is often disabled</li>
					<li>📱 <strong>Safari iOS limitations</strong> - Safari has partial OPFS support</li>
					<li>🌐 <strong>Cross-origin iframe</strong> - OPFS requires same-origin context</li>
					<li>⚙️ <strong>Browser security restrictions</strong> - Some browsers block storage APIs</li>
				</ul>
			</div>

			<div class="unavailable-error">
				<h5>Error details:</h5>
				<code>${opfsError ?? 'Unknown error'}</code>
			</div>

			<div class="unavailable-alternatives">
				<h5>Try these alternatives:</h5>
				<ul>
					<li>✅ Use the <strong>Drag & Drop</strong> tab - works everywhere!</li>
					<li>✅ Use the <strong>Error Handling</strong> tab - demonstrates API usage</li>
					<li>✅ Open in <strong>Chrome, Edge, or Opera</strong> on desktop in normal browsing mode</li>
					<li>✅ Check the <strong>API Reference Examples</strong> below to see code snippets</li>
					<li>📖 Read our <strong><a href="https://github.com/mikesaintsg/filesystem/blob/main/guides/polyfill.md" target="_blank">Polyfill Guide</a></strong> for IndexedDB fallback</li>
				</ul>
			</div>
		</div>
	`
}

function createOpfsDemo(): InteractiveDemoResult {
	// Return unavailable message if OPFS is not accessible
	if (!opfsAvailable || !fs || !root) {
		return {
			html: createOpfsUnavailableMessage(),
		}
	}

	return {
		html: `
			<div class="demo-app opfs-demo">
				<h4>📦 OPFS File Manager</h4>
				<p class="demo-desc">Create, edit, and manage files in your browser's private storage</p>

				<div class="demo-form">
					<input type="text" id="filename-input" class="demo-input" placeholder="Filename (e.g., notes.txt)" value="notes.txt">
					<button id="create-btn" class="btn primary">Create File</button>
				</div>

				<div class="editor-section">
					<textarea id="file-content" class="demo-textarea" placeholder="Select or create a file to edit..."></textarea>
					<div class="editor-actions">
						<button id="save-btn" class="btn primary" disabled>💾 Save</button>
						<button id="delete-btn" class="btn danger" disabled>🗑️ Delete</button>
					</div>
				</div>

				<div class="file-list-section">
					<h5>📂 Files in OPFS Root</h5>
					<div id="file-list" class="demo-list">
						<p class="placeholder">Loading files...</p>
					</div>
				</div>

				<div class="quota-display">
					<span id="quota-info">Loading quota...</span>
				</div>
			</div>
		`,
		init: async(container) => {
			const filenameInputEl = container.querySelector<HTMLInputElement>('#filename-input')
			const createBtnEl = container.querySelector<HTMLButtonElement>('#create-btn')
			const fileContentEl = container.querySelector<HTMLTextAreaElement>('#file-content')
			const saveBtnEl = container.querySelector<HTMLButtonElement>('#save-btn')
			const deleteBtnEl = container.querySelector<HTMLButtonElement>('#delete-btn')
			const fileListEl = container.querySelector<HTMLDivElement>('#file-list')
			const quotaInfoEl = container.querySelector<HTMLSpanElement>('#quota-info')

			if (!filenameInputEl || !createBtnEl || !fileContentEl || !saveBtnEl || !deleteBtnEl || !fileListEl || !quotaInfoEl) return

			// Store in const after null check for use in nested functions
			const filenameInput = filenameInputEl
			const createBtn = createBtnEl
			const fileContent = fileContentEl
			const saveBtn = saveBtnEl
			const deleteBtn = deleteBtnEl
			const fileListDiv = fileListEl
			const quotaInfoSpan = quotaInfoEl

			let currentFile: FileInterface | null = null

			const updateQuota = async(): Promise<void> => {
				const quota = await fs!.getQuota()
				quotaInfoSpan.textContent = `Storage: ${formatBytes(quota.usage)} / ${formatBytes(quota.quota)} (${quota.percentUsed.toFixed(1)}% used)`
			}

			const refreshFileList = async(): Promise<void> => {
				const files = await root!.listFiles()
				if (files.length === 0) {
					fileListDiv.innerHTML = '<p class="placeholder">No files yet. Create one!</p>'
					return
				}

				fileListDiv.innerHTML = ''
				for (const file of files) {
					const metadata = await file.getMetadata()
					const item = document.createElement('div')
					item.className = 'list-item'
					item.innerHTML = `
						<div class="item-info">
							<strong>📄 ${file.getName()}</strong>
							<span class="item-meta">${formatBytes(metadata.size)} · ${new Date(metadata.lastModified).toLocaleString()}</span>
						</div>
						<button class="btn small primary select-btn">Open</button>
					`
					item.querySelector('.select-btn')?.addEventListener('click', () => {
						void (async() => {
							currentFile = file
							filenameInput.value = file.getName()
							fileContent.value = await file.getText()
							saveBtn.disabled = false
							deleteBtn.disabled = false
						})()
					})
					fileListDiv.appendChild(item)
				}
			}

			createBtn.addEventListener('click', () => {
				void (async() => {
					const name = filenameInput.value.trim()
					if (!name) return
					currentFile = await root!.createFile(name)
					fileContent.value = ''
					saveBtn.disabled = false
					deleteBtn.disabled = false
					await refreshFileList()
					await updateQuota()
				})()
			})

			saveBtn.addEventListener('click', () => {
				void (async() => {
					if (!currentFile) return
					await currentFile.write(fileContent.value)
					await refreshFileList()
					await updateQuota()
				})()
			})

			deleteBtn.addEventListener('click', () => {
				void (async() => {
					if (!currentFile) return
					await root!.removeFile(currentFile.getName())
					currentFile = null
					fileContent.value = ''
					filenameInput.value = ''
					saveBtn.disabled = true
					deleteBtn.disabled = true
					await refreshFileList()
					await updateQuota()
				})()
			})

			await refreshFileList()
			await updateQuota()
		},
	}
}

function createDirectoryDemo(): InteractiveDemoResult {
	// Return unavailable message if OPFS is not accessible
	if (!opfsAvailable || !fs || !root) {
		return {
			html: createOpfsUnavailableMessage(),
		}
	}

	return {
		html: `
			<div class="demo-app directory-demo">
				<h4>🗂️ Directory Explorer</h4>
				<p class="demo-desc">Create nested directories and explore the file tree</p>

				<div class="demo-form">
					<input type="text" id="path-input" class="demo-input" placeholder="Path (e.g., projects/webapp/src)" value="projects/webapp/src">
					<button id="create-path-btn" class="btn primary">Create Path</button>
				</div>

				<div class="tree-section">
					<h5>📁 Directory Tree</h5>
					<div id="dir-tree" class="demo-tree">
						<p class="placeholder">Loading...</p>
					</div>
				</div>

				<div class="walk-stats">
					<span id="walk-stats">Directories: 0 | Files: 0</span>
				</div>

				<button id="cleanup-btn" class="btn danger small">🗑️ Clean Demo Directories</button>
			</div>
		`,
		init: async(container) => {
			const pathInputEl = container.querySelector<HTMLInputElement>('#path-input')
			const createPathBtnEl = container.querySelector<HTMLButtonElement>('#create-path-btn')
			const dirTreeEl = container.querySelector<HTMLDivElement>('#dir-tree')
			const walkStatsEl = container.querySelector<HTMLSpanElement>('#walk-stats')
			const cleanupBtnEl = container.querySelector<HTMLButtonElement>('#cleanup-btn')

			if (!pathInputEl || !createPathBtnEl || !dirTreeEl || !walkStatsEl || !cleanupBtnEl) return

			// Store in const after null check for use in nested functions
			const pathInput = pathInputEl
			const createPathBtn = createPathBtnEl
			const dirTreeDiv = dirTreeEl
			const walkStatsSpan = walkStatsEl
			const cleanupBtn = cleanupBtnEl

			const refreshTree = async(): Promise<void> => {
				let dirCount = 0
				let fileCount = 0
				const lines: string[] = []

				lines.push('📁 / (OPFS Root)')

				for await (const { entry, depth } of root!.walk({ maxDepth: 4 })) {
					const indent = '  '.repeat(depth + 1)
					const icon = entry.kind === 'file' ? '📄' : '📁'
					lines.push(`${indent}${icon} ${entry.name}`)

					if (entry.kind === 'file') fileCount++
					else dirCount++
				}

				if (lines.length === 1) {
					dirTreeDiv.innerHTML = '<p class="placeholder">Empty. Create some directories!</p>'
				} else {
					dirTreeDiv.innerHTML = `<pre class="tree-view">${lines.join('\n')}</pre>`
				}

				walkStatsSpan.textContent = `Directories: ${dirCount} | Files: ${fileCount}`
			}

			createPathBtn.addEventListener('click', () => {
				void (async() => {
					const pathStr = pathInput.value.trim()
					if (!pathStr) return
					const segments = pathStr.split('/').filter(s => s)
					await root!.createPath(...segments)
					await refreshTree()
				})()
			})

			cleanupBtn.addEventListener('click', () => {
				void (async() => {
					const entries = await root!.list()
					for (const entry of entries) {
						if (entry.kind === 'directory') {
							await root!.removeDirectory(entry.name, { recursive: true })
						}
					}
					await refreshTree()
				})()
			})

			await refreshTree()
		},
	}
}

function createDragDropDemo(): InteractiveDemoResult {
	// Drag & Drop works everywhere - doesn't require OPFS!
	// Create a simple file wrapper for when fs is not available
	const createSimpleFileWrapper = (file: File): FileInterface => ({
		native: null as unknown as FileSystemFileHandle, // Not available without real handle
		getName: () => file.name,
		getMetadata: () => Promise.resolve({
			name: file.name,
			size: file.size,
			type: file.type,
			lastModified: file.lastModified,
		}),
		getText: () => file.text(),
		getArrayBuffer: () => file.arrayBuffer(),
		getBlob: () => Promise.resolve(file),
		getStream: () => file.stream(),
		write: () => Promise.reject(new Error('Read-only file')),
		append: () => Promise.reject(new Error('Read-only file')),
		truncate: () => Promise.reject(new Error('Read-only file')),
		openWritable: () => Promise.reject(new Error('Read-only file')),
		hasReadPermission: () => Promise.resolve(true),
		hasWritePermission: () => Promise.resolve(false),
		requestWritePermission: () => Promise.resolve(false),
		isSameEntry: () => Promise.resolve(false),
	})

	return {
		html: `
			<div class="demo-app dragdrop-demo">
				<h4>🎯 Drag & Drop Zone</h4>
				<p class="demo-desc">Drop files or folders here to inspect them${!opfsAvailable ? ' (works without OPFS!)' : ''}</p>

				<div id="drop-zone" class="drop-zone">
					<div class="drop-content">
						<span class="drop-icon">📁</span>
						<p>Drop files or folders here</p>
						<p class="drop-hint">or click to select files</p>
					</div>
					<input type="file" id="file-input" multiple hidden>
				</div>

				<div id="drop-results" class="drop-results">
					<p class="placeholder">Drop something to see results...</p>
				</div>
			</div>
		`,
		init: (container) => {
			const dropZoneEl = container.querySelector<HTMLDivElement>('#drop-zone')
			const fileInputEl = container.querySelector<HTMLInputElement>('#file-input')
			const resultsEl = container.querySelector<HTMLDivElement>('#drop-results')

			if (!dropZoneEl || !fileInputEl || !resultsEl) return

			// Store in const after null check for use in nested functions
			const dropZone = dropZoneEl
			const fileInput = fileInputEl
			const resultsDiv = resultsEl

			const showResults = async(files: readonly FileInterface[]): Promise<void> => {
				if (files.length === 0) {
					resultsDiv.innerHTML = '<p class="placeholder">No files found</p>'
					return
				}

				const items: string[] = []
				for (const file of files) {
					const metadata = await file.getMetadata()
					const preview = metadata.size < 1000 ? await file.getText() : '[Large file]'
					items.push(`
						<div class="result-item">
							<strong>📄 ${file.getName()}</strong>
							<span class="item-meta">${formatBytes(metadata.size)} · ${metadata.type || 'unknown type'}</span>
							<pre class="content-preview">${preview.slice(0, 200)}${preview.length > 200 ? '...' : ''}</pre>
						</div>
					`)
				}
				resultsDiv.innerHTML = items.join('')
			}

			dropZone.addEventListener('click', () => fileInput.click())

			dropZone.addEventListener('dragover', (e) => {
				e.preventDefault()
				dropZone.classList.add('dragover')
			})

			dropZone.addEventListener('dragleave', () => {
				dropZone.classList.remove('dragover')
			})

			dropZone.addEventListener('drop', (e) => {
				e.preventDefault()
				dropZone.classList.remove('dragover')

				void (async() => {
					const items = e.dataTransfer?.items
					if (!items) return

					// Process files directly using File API when fs is not available
					const files: FileInterface[] = []
					for (const item of items) {
						if (item.kind === 'file') {
							const file = item.getAsFile()
							if (file) {
								if (fs) {
									files.push(await fs.fromFile(file))
								} else {
									// Fallback: create a simple read-only wrapper
									files.push(createSimpleFileWrapper(file))
								}
							}
						}
					}
					await showResults(files)
				})()
			})

			fileInput.addEventListener('change', () => {
				void (async() => {
					if (fileInput.files) {
						if (fs) {
							const files = await fs.fromFiles(fileInput.files)
							await showResults(files)
						} else {
							// Fallback: create simple wrappers
							const files = Array.from(fileInput.files).map(createSimpleFileWrapper)
							await showResults(files)
						}
					}
				})()
			})
		},
	}
}

function getInteractiveDemoForTab(tab: TabId): InteractiveDemoResult | undefined {
	switch (tab) {
		case 'opfs':
			return createOpfsDemo()
		case 'directories':
			return createDirectoryDemo()
		case 'dragdrop':
			return createDragDropDemo()
		default:
			return undefined
	}
}

// ============================================================================
// UI Helpers
// ============================================================================

function createElement<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	options?: { className?: string; textContent?: string; id?: string },
): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag)
	if (options?.className) element.className = options.className
	if (options?.textContent) element.textContent = options.textContent
	if (options?.id) element.id = options.id
	return element
}

function formatData(data: unknown): string {
	if (data === undefined) return 'undefined'
	if (data === null) return 'null'
	try {
		return JSON.stringify(data, null, 2)
	} catch {
		return typeof data === 'string' ? data : '[Object]'
	}
}

// ============================================================================
// Rendering
// ============================================================================

function renderApp(): void {
	demoCleanups.forEach(cleanup => cleanup())
	demoCleanups.length = 0

	const app = document.getElementById('app')
	if (!app) return

	app.innerHTML = ''

	const container = createElement('div', { className: 'container' })

	// Header
	const header = createElement('header')
	const h1 = createElement('h1', { textContent: '📂 File System Showcase' })
	const subtitle = createElement('p', { textContent: 'Comprehensive demonstration of @mikesaintsg/filesystem features' })

	// Browser support badges - show actual availability, not just API detection
	const badges = createElement('div', { className: 'support-badges' })
	badges.innerHTML = `
		<span class="badge ${opfsAvailable ? 'supported' : 'unsupported'}">
			${opfsAvailable ? '✅' : '❌'} OPFS
		</span>
		<span class="badge ${isFilePickerSupported() ? 'supported' : 'unsupported'}">
			${isFilePickerSupported() ? '✅' : '❌'} File Pickers
		</span>
	`
	header.append(h1, subtitle, badges)

	// Show info banner when OPFS is not available
	if (!opfsAvailable) {
		const infoBanner = createElement('div', { className: 'info-banner' })
		infoBanner.innerHTML = `
			<strong>📱 Limited Mode:</strong> OPFS is not available in your current browser context.
			<span class="info-detail">The Drag & Drop and Error Handling tabs work without OPFS. Try Chrome, Edge, or Opera in normal browsing mode for full functionality.</span>
		`
		header.appendChild(infoBanner)
	}

	// Navigation
	const nav = createElement('nav', { className: 'tabs' })
	TABS.forEach(tab => {
		const isDisabled = requiresOPFS(tab.id) && !opfsAvailable
		const button = createElement('button', {
			className: `tab ${activeTab === tab.id ? 'active' : ''} ${isDisabled ? 'disabled-tab' : ''}`,
			textContent: `${tab.emoji} ${tab.label}`,
		})
		button.title = isDisabled
			? `${tab.description} (requires OPFS)`
			: tab.description
		button.addEventListener('click', () => {
			activeTab = tab.id
			renderApp()
		})
		nav.appendChild(button)
	})

	// Content
	const content = createElement('main', { id: 'content' })
	void renderTabContent(content)

	// Footer
	const footer = createElement('footer')
	footer.innerHTML = '<p>Zero dependencies · Full TypeScript support · MIT License</p>'

	container.append(header, nav, content, footer)
	app.appendChild(container)
}

async function renderTabContent(content: HTMLElement): Promise<void> {
	const currentTab = TABS.find(t => t.id === activeTab)
	if (!currentTab) return

	const section = createElement('section', { className: 'card' })

	// Tab header
	const h2 = createElement('h2', { textContent: `${currentTab.emoji} ${currentTab.label}` })
	const tabDesc = createElement('p', { className: 'subtitle', textContent: currentTab.description })
	section.append(h2, tabDesc)

	// Interactive demo
	const demo = getInteractiveDemoForTab(activeTab)
	if (demo) {
		const demoContainer = createElement('div', { className: 'interactive-demo-container' })
		demoContainer.innerHTML = demo.html
		section.appendChild(demoContainer)

		if (demo.init) {
			try {
				await demo.init(demoContainer)
			} catch (err) {
				console.error('Demo init error:', err)
			}
		}

		if (demo.cleanup) {
			demoCleanups.push(demo.cleanup)
		}

		const separator = createElement('div', { className: 'demo-separator' })
		separator.innerHTML = '<h3>📚 API Reference Examples</h3>'
		section.appendChild(separator)
	}

	// Examples list
	const examples = getExamplesForTab(activeTab)
	const examplesContainer = createElement('div', { className: 'examples-container' })

	examples.forEach(example => {
		const exampleCard = createExampleCard(example)
		examplesContainer.appendChild(exampleCard)
	})

	section.appendChild(examplesContainer)
	content.appendChild(section)
}

function createExampleCard(example: ExampleDefinition): HTMLElement {
	const card = createElement('div', { className: 'example-card' })

	const header = createElement('div', { className: 'example-header' })
	const title = createElement('h3', { textContent: example.title })
	const desc = createElement('p', { className: 'example-desc', textContent: example.description })
	header.append(title, desc)

	const runButton = createElement('button', { className: 'btn primary', textContent: '▶ Run Example' })
	const resultArea = createElement('div', { className: 'example-result' })
	resultArea.style.display = 'none'

	runButton.addEventListener('click', () => {
		void runExample(example, runButton, resultArea)
	})

	card.append(header, runButton, resultArea)
	return card
}

async function runExample(
	example: ExampleDefinition,
	button: HTMLButtonElement,
	resultArea: HTMLElement,
): Promise<void> {
	button.disabled = true
	button.textContent = '⏳ Running...'
	resultArea.style.display = 'block'
	resultArea.innerHTML = '<p class="loading">Running example...</p>'

	try {
		const result = await example.run()

		resultArea.innerHTML = ''

		const statusClass = result.success ? 'success' : 'error'
		const statusEmoji = result.success ? '✅' : '❌'
		const message = createElement('p', {
			className: `result-message ${statusClass}`,
			textContent: `${statusEmoji} ${result.message}`,
		})
		resultArea.appendChild(message)

		if (result.data !== undefined) {
			const dataSection = createElement('div', { className: 'result-data' })
			const dataLabel = createElement('h4', { textContent: '📊 Result Data' })
			const dataContent = createElement('pre')
			const code = createElement('code', { textContent: formatData(result.data) })
			dataContent.appendChild(code)
			dataSection.append(dataLabel, dataContent)
			resultArea.appendChild(dataSection)
		}

		if (result.code) {
			const codeSection = createElement('div', { className: 'result-code' })
			const codeLabel = createElement('h4', { textContent: '💻 Code Example' })
			const codeBlock = createElement('div', { className: 'code-block' })
			const pre = createElement('pre')
			const codeEl = createElement('code', { textContent: result.code })
			pre.appendChild(codeEl)
			codeBlock.appendChild(pre)
			codeSection.append(codeLabel, codeBlock)
			resultArea.appendChild(codeSection)
		}
	} catch (error) {
		resultArea.innerHTML = ''
		const errorMsg = createElement('p', {
			className: 'result-message error',
			textContent: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
		})
		resultArea.appendChild(errorMsg)
	} finally {
		button.disabled = false
		button.textContent = '▶ Run Example'
	}
}

// ============================================================================
// Initialize
// ============================================================================

async function initialize(): Promise<void> {
	// Try to initialize OPFS, but continue even if it fails
	try {
		fs = await createFileSystem()
		root = await fs.getRoot()
		opfsAvailable = true
		opfsError = null
		console.log('@mikesaintsg/filesystem showcase loaded with OPFS support')
	} catch (error) {
		console.warn('OPFS not available:', error)
		opfsAvailable = false
		opfsError = error instanceof Error ? error.message : String(error)
		// Don't show error screen - continue with limited functionality
		console.log('@mikesaintsg/filesystem showcase loaded in limited mode (no OPFS)')
	}

	// Always render the app - it works with or without OPFS
	renderApp()
}

void initialize()
