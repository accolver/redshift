import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const webRoot = process.cwd();

function readWebFile(path: string) {
	return readFileSync(resolve(webRoot, path), 'utf8');
}

describe('landing page Lighthouse hygiene', () => {
	test('uses a main landmark for the public landing route', () => {
		const page = readWebFile('src/routes/+page.svelte');

		expect(page).toContain('<main');
		expect(page).toContain('</main>');
	});

	test('does not load render-blocking third-party font stylesheets', () => {
		const appHtml = readWebFile('src/app.html');
		const layout = readWebFile('src/routes/+layout.svelte');

		expect(appHtml).not.toContain('fonts.googleapis.com');
		expect(appHtml).not.toContain('fonts.gstatic.com');
		expect(layout).not.toContain('fonts.googleapis.com');
		expect(layout).not.toContain('fonts.gstatic.com');
	});

	test('serves the homepage as static HTML without hydration scripts', () => {
		const pageOptions = readWebFile('src/routes/+page.ts');

		expect(pageOptions).toContain('export const csr = false');
	});

	test('centralizes CSP in SvelteKit without broad inline script permission', () => {
		const headers = readWebFile('_headers');
		const hooks = readWebFile('src/hooks.server.ts');
		const svelteConfig = readWebFile('svelte.config.js');

		expect(headers).not.toContain('Content-Security-Policy:');
		expect(hooks).not.toContain('Content-Security-Policy');
		expect(svelteConfig).toContain('name: `redshift-web-${webPackage.version}`');
		expect(svelteConfig).toContain("mode: 'auto'");
		expect(svelteConfig).toContain("'script-src': ['self']");
		expect(svelteConfig).not.toContain('cloudflareinsights.com');
		expect(svelteConfig).not.toMatch(/'script-src': \[[^\]]*unsafe-inline/);
		expect(headers).toContain('X-Robots-Tag: index, follow');
		expect(headers).toContain(
			'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
		);
		expect(headers).toContain('Cross-Origin-Opener-Policy: same-origin');
		expect(headers).toContain('Permissions-Policy: camera=(), microphone=(), geolocation=()');
	});

	test('avoids low-contrast muted text on the terminal preview', () => {
		const page = readWebFile('src/routes/+page.svelte');

		expect(page).not.toContain('text-foreground/50');
		expect(page).not.toContain('text-foreground/60');
	});

	test('keeps decorative logo images hidden from accessible names', () => {
		const page = readWebFile('src/routes/+page.svelte');
		const navbar = readWebFile('src/lib/components/Navbar.svelte');

		expect(page).toContain('img src="/favicon.svg" alt=""');
		expect(navbar).toContain('img src="/favicon.svg" alt=""');
	});

	test('does not register unload handlers that block bfcache', () => {
		const adminPage = readWebFile('src/routes/admin/projects/[slug]/[env]/+page.svelte');

		expect(adminPage).not.toContain('beforeunload');
		expect(adminPage).not.toContain("addEventListener('unload");
		expect(adminPage).not.toContain('addEventListener("unload');
	});
});
