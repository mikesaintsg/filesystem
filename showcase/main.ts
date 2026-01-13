/**
 * @mikesaintsg/filesystem Showcase
 *
 * Demonstrates all major features of the library
 * through interactive examples with sensible defaults.
 */

import './styles.css'
import {
	isOPFSSupported,
	isFilePickerSupported,
	formatBytes,
	ERROR_MESSAGES,
} from '~/src/index.js'

// ============================================================================
// DOM Setup
// ============================================================================

const app = document.getElementById('app')
if (!app) throw new Error('App element not found')

app.innerHTML = `
	<div class="showcase">
		<header>
			<h1>@mikesaintsg/filesystem</h1>
			<p class="tagline">Type-safe File System wrapper for the browser</p>
		</header>

		<section class="feature-detection">
			<h2>Browser Support</h2>
			<div class="grid">
				<div class="card" id="opfs-support">
					<h3>OPFS</h3>
					<span class="status"></span>
				</div>
				<div class="card" id="picker-support">
					<h3>File Pickers</h3>
					<span class="status"></span>
				</div>
			</div>
		</section>

		<section class="demo">
			<h2>Quick Demo</h2>
			<div class="demo-area">
				<p>This library provides a unified, type-safe interface for browser file system APIs:</p>
				<ul>
					<li><strong>Origin Private File System (OPFS)</strong> - Sandboxed storage for web apps</li>
					<li><strong>File System Access API</strong> - Native file picker dialogs (Chromium)</li>
					<li><strong>File API</strong> - Input element file selection</li>
					<li><strong>Entries API</strong> - Drag and drop support</li>
				</ul>
			</div>
		</section>

		<section class="utilities">
			<h2>Utility Functions</h2>
			<div class="grid">
				<div class="card">
					<h3>formatBytes()</h3>
					<code id="format-demo"></code>
				</div>
				<div class="card">
					<h3>Error Codes</h3>
					<code id="error-demo"></code>
				</div>
			</div>
		</section>

		<footer>
			<p>Zero dependencies · Full TypeScript support · MIT License</p>
		</footer>
	</div>
`

// ============================================================================
// Feature Detection
// ============================================================================

function updateFeatureStatus(id: string, supported: boolean): void {
	const card = document.getElementById(id)
	if (!card) return

	const status = card.querySelector('.status')
	if (!status) return

	status.textContent = supported ? '✅ Supported' : '❌ Not Available'
	status.className = `status ${supported ? 'supported' : 'unsupported'}`
}

updateFeatureStatus('opfs-support', isOPFSSupported())
updateFeatureStatus('picker-support', isFilePickerSupported())

// ============================================================================
// Utility Demos
// ============================================================================

const formatDemo = document.getElementById('format-demo')
if (formatDemo) {
	const sizes = [0, 1024, 1048576, 1073741824]
	formatDemo.innerHTML = sizes
		.map(size => `${size} → ${formatBytes(size)}`)
		.join('<br>')
}

const errorDemo = document.getElementById('error-demo')
if (errorDemo) {
	const codes = ['NOT_FOUND', 'NOT_ALLOWED', 'QUOTA_EXCEEDED'] as const
	errorDemo.innerHTML = codes
		.map(code => `${code}: ${ERROR_MESSAGES[code]}`)
		.join('<br>')
}

// Log that showcase loaded

console.log('@mikesaintsg/filesystem showcase loaded')
