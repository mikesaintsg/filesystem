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

	interface FileSystemHandlePermissionDescriptor {
		mode?: 'read' | 'readwrite'
	}

	interface FileSystemFileHandle {
		createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle>
		queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
		requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
	}

	interface FileSystemDirectoryHandle {
		entries(): AsyncIterableIterator<[string, FileSystemHandle]>
		keys(): AsyncIterableIterator<string>
		values(): AsyncIterableIterator<FileSystemHandle>
		queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
		requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
	}

	// File System Access API picker functions (Chromium only)
	interface Window {
		showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>
		showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>
		showDirectoryPicker?(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
	}

	interface OpenFilePickerOptions {
		multiple?: boolean | undefined
		excludeAcceptAllOption?: boolean | undefined
		types?: FilePickerAcceptType[] | undefined
		id?: string | undefined
		startIn?: StartInDirectory | undefined
	}

	interface SaveFilePickerOptions {
		suggestedName?: string | undefined
		excludeAcceptAllOption?: boolean | undefined
		types?: FilePickerAcceptType[] | undefined
		id?: string | undefined
		startIn?: StartInDirectory | undefined
	}

	interface DirectoryPickerOptions {
		id?: string | undefined
		startIn?: StartInDirectory | undefined
		mode?: 'read' | 'readwrite' | undefined
	}

	interface FilePickerAcceptType {
		description?: string
		accept: Record<string, readonly string[]>
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
