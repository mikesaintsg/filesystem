/**
 * @mikesaintsg/filesystem
 *
 * Global type declarations for File System APIs not yet in TypeScript DOM libs.
 */

// FileSystemSyncAccessHandle is available in Workers but may not be in TS DOM lib
declare global {
	interface FileSystemSyncAccessHandle {
		close(): void
		flush(): void
		getSize(): number
		read(buffer: ArrayBufferView, options?: { at?: number }): number
		truncate(newSize: number): void
		write(buffer: ArrayBufferView, options?: { at?: number }): number
	}

	interface FileSystemFileHandle {
		createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle>
	}

	interface FileSystemDirectoryHandle {
		entries(): AsyncIterableIterator<[string, FileSystemHandle]>
		keys(): AsyncIterableIterator<string>
		values(): AsyncIterableIterator<FileSystemHandle>
	}

	// File System Access API picker functions (Chromium only)
	interface Window {
		showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>
		showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>
		showDirectoryPicker?(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
	}

	interface OpenFilePickerOptions {
		multiple?: boolean
		excludeAcceptAllOption?: boolean
		types?: FilePickerAcceptType[]
		id?: string
		startIn?: StartInDirectory
	}

	interface SaveFilePickerOptions {
		suggestedName?: string
		excludeAcceptAllOption?: boolean
		types?: FilePickerAcceptType[]
		id?: string
		startIn?: StartInDirectory
	}

	interface DirectoryPickerOptions {
		id?: string
		startIn?: StartInDirectory
		mode?: 'read' | 'readwrite'
	}

	interface FilePickerAcceptType {
		description?: string
		accept: Record<string, string[]>
	}

	type StartInDirectory =
		| 'desktop'
		| 'documents'
		| 'downloads'
		| 'music'
		| 'pictures'
		| 'videos'
		| FileSystemHandle
}

export {}
