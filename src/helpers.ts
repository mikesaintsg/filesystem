/**
 * @mikesaintsg/filesystem
 *
 * Helper functions and type guards.
 */

import {
	FileSystemError,
	NotFoundError,
	NotAllowedError,
	TypeMismatchError,
	NoModificationAllowedError,
	InvalidStateError,
	QuotaExceededError,
	AbortError,
	SecurityError,
	EncodingError,
	NotSupportedError,
} from './errors.js'
import type { EntryKind, DirectoryEntry, FileInterface, DirectoryInterface } from './types.js'

// ============================================================================
// Error Type Guards
// ============================================================================

/**
 * Checks if value is a FileSystemError
 */
export function isFileSystemError(value: unknown): value is FileSystemError {
	return value instanceof FileSystemError
}

/**
 * Checks if value is a NotFoundError
 */
export function isNotFoundError(value: unknown): value is NotFoundError {
	return value instanceof NotFoundError
}

/**
 * Checks if value is a NotAllowedError
 */
export function isNotAllowedError(value: unknown): value is NotAllowedError {
	return value instanceof NotAllowedError
}

/**
 * Checks if value is a TypeMismatchError
 */
export function isTypeMismatchError(value: unknown): value is TypeMismatchError {
	return value instanceof TypeMismatchError
}

/**
 * Checks if value is a NoModificationAllowedError
 */
export function isNoModificationAllowedError(value: unknown): value is NoModificationAllowedError {
	return value instanceof NoModificationAllowedError
}

/**
 * Checks if value is an InvalidStateError
 */
export function isInvalidStateError(value: unknown): value is InvalidStateError {
	return value instanceof InvalidStateError
}

/**
 * Checks if value is a QuotaExceededError
 */
export function isQuotaExceededError(value: unknown): value is QuotaExceededError {
	return value instanceof QuotaExceededError
}

/**
 * Checks if value is an AbortError
 */
export function isAbortError(value: unknown): value is AbortError {
	return value instanceof AbortError
}

/**
 * Checks if value is a SecurityError
 */
export function isSecurityError(value: unknown): value is SecurityError {
	return value instanceof SecurityError
}

/**
 * Checks if value is an EncodingError
 */
export function isEncodingError(value: unknown): value is EncodingError {
	return value instanceof EncodingError
}

/**
 * Checks if value is a NotSupportedError
 */
export function isNotSupportedError(value: unknown): value is NotSupportedError {
	return value instanceof NotSupportedError
}

// ============================================================================
// Entry Type Guards
// ============================================================================

/**
 * Checks if entry kind is 'file'
 */
export function isFileKind(kind: EntryKind): kind is 'file' {
	return kind === 'file'
}

/**
 * Checks if entry kind is 'directory'
 */
export function isDirectoryKind(kind: EntryKind): kind is 'directory' {
	return kind === 'directory'
}

/**
 * Checks if directory entry is a file entry
 */
export function isFileEntry(entry: DirectoryEntry): boolean {
	return entry.kind === 'file'
}

/**
 * Checks if directory entry is a directory entry
 */
export function isDirectoryEntry(entry: DirectoryEntry): boolean {
	return entry.kind === 'directory'
}

// ============================================================================
// Interface Type Guards
// ============================================================================

/**
 * Checks if value is a FileInterface
 */
export function isFileInterface(value: unknown): value is FileInterface {
	if (typeof value !== 'object' || value === null) {
		return false
	}
	const obj = value as Record<string, unknown>
	return (
		'native' in obj &&
		typeof obj.getName === 'function' &&
		typeof obj.getText === 'function' &&
		typeof obj.write === 'function'
	)
}

/**
 * Checks if value is a DirectoryInterface
 */
export function isDirectoryInterface(value: unknown): value is DirectoryInterface {
	if (typeof value !== 'object' || value === null) {
		return false
	}
	const obj = value as Record<string, unknown>
	return (
		'native' in obj &&
		typeof obj.getName === 'function' &&
		typeof obj.getFile === 'function' &&
		typeof obj.createDirectory === 'function'
	)
}

// ============================================================================
// Handle Type Guards
// ============================================================================

/**
 * Checks if value is a FileSystemFileHandle
 */
export function isFileSystemFileHandle(value: unknown): value is FileSystemFileHandle {
	if (typeof value !== 'object' || value === null) {
		return false
	}
	const obj = value as Record<string, unknown>
	return obj.kind === 'file' && typeof obj.getFile === 'function'
}

/**
 * Checks if value is a FileSystemDirectoryHandle
 */
export function isFileSystemDirectoryHandle(value: unknown): value is FileSystemDirectoryHandle {
	if (typeof value !== 'object' || value === null) {
		return false
	}
	const obj = value as Record<string, unknown>
	return obj.kind === 'directory' && typeof obj.getFileHandle === 'function'
}

// ============================================================================
// Feature Detection Helpers
// ============================================================================

/**
 * Checks if OPFS is supported
 */
export function isOPFSSupported(): boolean {
	return typeof navigator !== 'undefined' &&
		typeof navigator.storage !== 'undefined' &&
		typeof navigator.storage.getDirectory === 'function'
}

/**
 * Checks if File System Access API pickers are supported
 */
export function isFilePickerSupported(): boolean {
	return typeof window !== 'undefined' &&
		'showOpenFilePicker' in window &&
		typeof (window as Window & { showOpenFilePicker?: unknown }).showOpenFilePicker === 'function'
}

/**
 * Checks if sync access handles are supported (Workers only)
 */
export function isSyncAccessSupported(): boolean {
	return typeof globalThis !== 'undefined' &&
		'FileSystemSyncAccessHandle' in globalThis
}

// ============================================================================
// Utility Helpers
// ============================================================================

/**
 * Validates that a name is a valid file/directory name
 * @param name - Name to validate
 * @returns true if valid
 */
export function isValidEntryName(name: string): boolean {
	if (typeof name !== 'string' || name.length === 0) {
		return false
	}
	// Cannot contain path separators
	if (name.includes('/') || name.includes('\\')) {
		return false
	}
	// Cannot be . or ..
	if (name === '.' || name === '..') {
		return false
	}
	return true
}

/**
 * Formats bytes as human-readable string
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B'
	const units = ['B', 'KB', 'MB', 'GB', 'TB']
	const i = Math.floor(Math.log(bytes) / Math.log(1024))
	const size = bytes / Math.pow(1024, i)
	return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
