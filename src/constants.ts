/**
 * @mikesaintsg/filesystem
 *
 * Constants for file system operations.
 */

import type { FileSystemErrorCode } from './types.js'

// ============================================================================
// Error Codes
// ============================================================================

/** All possible file system error codes */
export const ERROR_CODES: readonly FileSystemErrorCode[] = [
	'NOT_FOUND',
	'NOT_ALLOWED',
	'TYPE_MISMATCH',
	'NO_MODIFICATION_ALLOWED',
	'INVALID_STATE',
	'QUOTA_EXCEEDED',
	'ABORT',
	'SECURITY',
	'ENCODING',
	'NOT_SUPPORTED',
] as const

/** Error code to human-readable message mapping */
export const ERROR_MESSAGES: Readonly<Record<FileSystemErrorCode, string>> = {
	NOT_FOUND: 'The requested file or directory was not found',
	NOT_ALLOWED: 'Permission denied for this operation',
	TYPE_MISMATCH: 'Expected file but got directory, or vice versa',
	NO_MODIFICATION_ALLOWED: 'The file or directory cannot be modified',
	INVALID_STATE: 'The file system is in an invalid state',
	QUOTA_EXCEEDED: 'Storage quota has been exceeded',
	ABORT: 'The operation was aborted',
	SECURITY: 'A security error occurred',
	ENCODING: 'An encoding error occurred',
	NOT_SUPPORTED: 'This feature is not supported in this browser',
} as const

// ============================================================================
// MIME Types
// ============================================================================

/** Common MIME type mappings by extension */
export const MIME_TYPES: Readonly<Record<string, string>> = {
	// Text
	'.txt': 'text/plain',
	'.html': 'text/html',
	'.htm': 'text/html',
	'.css': 'text/css',
	'.js': 'text/javascript',
	'.mjs': 'text/javascript',
	'.ts': 'text/typescript',
	'.json': 'application/json',
	'.xml': 'application/xml',
	'.md': 'text/markdown',
	'.csv': 'text/csv',

	// Images
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.avif': 'image/avif',

	// Audio
	'.mp3': 'audio/mpeg',
	'.wav': 'audio/wav',
	'.ogg': 'audio/ogg',
	'.flac': 'audio/flac',
	'.m4a': 'audio/mp4',

	// Video
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.mkv': 'video/x-matroska',
	'.avi': 'video/x-msvideo',
	'.mov': 'video/quicktime',

	// Documents
	'.pdf': 'application/pdf',
	'.doc': 'application/msword',
	'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'.xls': 'application/vnd.ms-excel',
	'.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'.ppt': 'application/vnd.ms-powerpoint',
	'.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

	// Archives
	'.zip': 'application/zip',
	'.tar': 'application/x-tar',
	'.gz': 'application/gzip',
	'.7z': 'application/x-7z-compressed',
	'.rar': 'application/vnd.rar',

	// Binary
	'.wasm': 'application/wasm',
	'.bin': 'application/octet-stream',
} as const

/** Default MIME type for unknown extensions */
export const DEFAULT_MIME_TYPE = 'application/octet-stream'

// ============================================================================
// File System Constants
// ============================================================================

/** Default chunk size for streaming reads (64KB) */
export const DEFAULT_CHUNK_SIZE = 64 * 1024

/** Maximum file name length in most file systems */
export const MAX_FILENAME_LENGTH = 255

/** Reserved file names on Windows */
export const RESERVED_NAMES: readonly string[] = [
	'CON', 'PRN', 'AUX', 'NUL',
	'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
	'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
] as const
