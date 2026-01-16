import { defineConfig } from 'vite'
import { resolve } from 'path'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
	plugins: [viteSingleFile()],
	root: 'showcase',
	publicDir: false,
	build: {
		outDir: '../dist/showcase',
		emptyOutDir: true,
		sourcemap: false,
	},
	resolve: {
		alias: {
			'@mikesaintsg/filesystem': resolve(__dirname, '../src', 'index.ts'),
		},
	},
})
