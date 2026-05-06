import adapterCloudflare from '@sveltejs/adapter-cloudflare';
import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Use static adapter for CLI embed generation, Cloudflare adapter for CF Pages
const useCloudflare = process.env.CF_PAGES === '1';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: useCloudflare
			? adapterCloudflare()
			: adapterStatic({
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
