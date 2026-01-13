/**
 * @mikesaintsg/filesystem
 *
 * Error classes for file system operations.
 */

import type { FileSystemErrorCode, FileSystemErrorData } from './types.js'

/**
 * Base error class for all file system errors
 */
export class FileSystemError extends Error implements FileSystemErrorData {
	readonly code: FileSystemErrorCode
	readonly path?: string
	override readonly cause?: Error

	constructor(code: FileSystemErrorCode, message: string, path?: string, cause?: Error) {
		super(message)
		this.name = 'FileSystemError'
		this.code = code
		if (path !== undefined) {
			this.path = path
		}
		if (cause !== undefined) {
			this.cause = cause
		}
	}
}

/**
 * Thrown when a file or directory is not found
 */
export class NotFoundError extends FileSystemError {
	constructor(path?: string, cause?: Error) {
		super('NOT_FOUND', path ? `Entry not found: ${path}` : 'Entry not found', path, cause)
		this.name = 'NotFoundError'
	}
}

/**
 * Thrown when permission is denied
 */
export class NotAllowedError extends FileSystemError {
	constructor(message?: string, path?: string, cause?: Error) {
		super('NOT_ALLOWED', message ?? 'Permission denied', path, cause)
		this.name = 'NotAllowedError'
	}
}

/**
 * Thrown when expected file but got directory or vice versa
 */
export class TypeMismatchError extends FileSystemError {
	constructor(expected: 'file' | 'directory', path?: string, cause?: Error) {
		super(
			'TYPE_MISMATCH',
			`Expected ${expected} but got ${expected === 'file' ? 'directory' : 'file'}`,
			path,
			cause,
		)
		this.name = 'TypeMismatchError'
	}
}

/**
 * Thrown when modification is not allowed
 */
export class NoModificationAllowedError extends FileSystemError {
	constructor(path?: string, cause?: Error) {
		super('NO_MODIFICATION_ALLOWED', 'Modification not allowed', path, cause)
		this.name = 'NoModificationAllowedError'
	}
}

/**
 * Thrown when file system is in invalid state
 */
export class InvalidStateError extends FileSystemError {
	constructor(message?: string, path?: string, cause?: Error) {
		super('INVALID_STATE', message ?? 'Invalid state', path, cause)
		this.name = 'InvalidStateError'
	}
}

/**
 * Thrown when storage quota is exceeded
 */
export class QuotaExceededError extends FileSystemError {
	constructor(path?: string, cause?: Error) {
		super('QUOTA_EXCEEDED', 'Storage quota exceeded', path, cause)
		this.name = 'QuotaExceededError'
	}
}

/**
 * Thrown when operation is aborted (e.g., user cancels picker)
 */
export class AbortError extends FileSystemError {
	constructor(message?: string, cause?: Error) {
		super('ABORT', message ?? 'Operation aborted', undefined, cause)
		this.name = 'AbortError'
	}
}

/**
 * Thrown when security restriction is violated
 */
export class SecurityError extends FileSystemError {
	constructor(message?: string, path?: string, cause?: Error) {
		super('SECURITY', message ?? 'Security error', path, cause)
		this.name = 'SecurityError'
	}
}

/**
 * Thrown when encoding error occurs
 */
export class EncodingError extends FileSystemError {
	constructor(message?: string, path?: string, cause?: Error) {
		super('ENCODING', message ?? 'Encoding error', path, cause)
		this.name = 'EncodingError'
	}
}

/**
 * Thrown when feature is not supported
 */
export class NotSupportedError extends FileSystemError {
	constructor(feature?: string, cause?: Error) {
		super('NOT_SUPPORTED', feature ? `Not supported: ${feature}` : 'Feature not supported', undefined, cause)
		this.name = 'NotSupportedError'
	}
}

/**
 * Wraps a native DOMException into the appropriate FileSystemError subclass
 */
export function wrapDOMException(error: unknown, path?: string): FileSystemError {
	if (error instanceof FileSystemError) {
		return error
	}

	if (error instanceof DOMException) {
		switch (error.name) {
			case 'NotFoundError':
				return new NotFoundError(path, error)
			case 'NotAllowedError':
				return new NotAllowedError(error.message, path, error)
			case 'TypeMismatchError':
				return new TypeMismatchError('file', path, error)
			case 'NoModificationAllowedError':
				return new NoModificationAllowedError(path, error)
			case 'InvalidStateError':
				return new InvalidStateError(error.message, path, error)
			case 'QuotaExceededError':
				return new QuotaExceededError(path, error)
			case 'AbortError':
				return new AbortError(error.message, error)
			case 'SecurityError':
				return new SecurityError(error.message, path, error)
			case 'EncodingError':
				return new EncodingError(error.message, path, error)
			case 'NotSupportedError':
				return new NotSupportedError(error.message, error)
			default:
				return new FileSystemError('NOT_SUPPORTED', error.message, path, error)
		}
	}

	if (error instanceof Error) {
		return new FileSystemError('NOT_SUPPORTED', error.message, path, error)
	}

	return new FileSystemError('NOT_SUPPORTED', String(error), path)
}
