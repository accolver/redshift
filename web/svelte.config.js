import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			// Cloudflare Pages routes configuration
			// - <prerendered> pages are served statically (no Worker invocation)
			// - /api/* routes invoke the Worker
			// - /admin/* routes use SPA fallback
			routes: {
				include: ['/*'],
				exclude: ['<all>'],
			},
			// SPA fallback for non-matching routes (admin SPA, 404s)
			fallback: 'spa',
		}),
		alias: {
			$components: 'src/lib/components',
			$ui: 'src/lib/components/ui',
		},
	},
};

export default config;
