import cloudflareAdapter from '@sveltejs/adapter-cloudflare';
import staticAdapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Use Cloudflare adapter for production, static for local builds
const isCloudflare = process.env.CF_PAGES === '1';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: isCloudflare
			? cloudflareAdapter()
			: staticAdapter({
					pages: 'dist',
					assets: 'dist',
					fallback: 'index.html',
					precompress: false,
					strict: true
				}),
		alias: {
			$components: 'src/lib/components',
			$ui: 'src/lib/components/ui'
		}
	}
};

export default config;
