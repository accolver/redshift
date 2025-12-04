import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			// Static site generation output
			pages: 'dist',
			assets: 'dist',
			fallback: 'index.html', // SPA fallback for admin routes
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
