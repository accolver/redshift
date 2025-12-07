import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: {
				// Enable runes mode for .svelte.ts files in tests
				runes: true,
			},
		}),
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
		globals: true,
		environment: 'jsdom',
		globalSetup: ['./vitest.global-setup.ts'],
		setupFiles: ['./vitest.setup.ts'],
		alias: {
			$lib: path.resolve('./src/lib'),
			$components: path.resolve('./src/lib/components'),
			$ui: path.resolve('./src/lib/components/ui'),
		},
	},
	resolve: {
		conditions: ['browser'],
	},
});
