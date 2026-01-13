/**
 * Showcase Types
 *
 * Shared types for the filesystem showcase demonstrations.
 */

/** Result of running an example */
export interface ExampleResult {
	readonly success: boolean
	readonly message: string
	readonly data?: unknown
	readonly code?: string
}

/** Interactive demo return type */
export interface InteractiveDemoResult {
	readonly html: string
	readonly init?: (container: HTMLElement) => Promise<void> | void
	readonly cleanup?: () => void
}

/** Log entry for event display */
export interface LogEntry {
	readonly timestamp: number
	readonly type: 'info' | 'success' | 'error' | 'warning'
	readonly message: string
}
