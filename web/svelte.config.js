import { readFileSync } from 'node:fs';
import adapterCloudflare from '@sveltejs/adapter-cloudflare';
import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Use static adapter for CLI embed generation, Cloudflare adapter for CF Pages
const useCloudflare = process.env.CF_PAGES === '1';
const webPackage = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		version: {
			name: `redshift-web-${webPackage.version}`,
		},
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'base-uri': ['self'],
				'object-src': ['none'],
				'script-src': ['self'],
				'style-src': ['self', 'unsafe-inline'],
				'font-src': ['self'],
				'connect-src': ['self', 'wss:', 'https://relay.redshiftapp.com'],
				'img-src': ['self', 'data:', 'https:'],
				'form-action': ['self'],
				'frame-ancestors': ['none'],
				'upgrade-insecure-requests': true,
			},
		},
		adapter: useCloudflare
			? adapterCloudflare()
			: adapterStatic({
					pages: 'dist',
					assets: 'dist',
					fallback: 'index.html',
					precompress: false,
					strict: true,
				}),
		alias: {
			$components: 'src/lib/components',
			$ui: 'src/lib/components/ui',
		},
	},
};

export default config;
