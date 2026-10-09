import { describe, expect, test } from 'vitest';
import page from '../../src/routes/+page.svelte?raw';
import appHtml from '../../src/app.html?raw';
import layout from '../../src/routes/+layout.svelte?raw';
import pageOptions from '../../src/routes/+page.ts?raw';
import headers from '../../_headers?raw';
import hooks from '../../src/hooks.server.ts?raw';
import svelteConfig from '../../svelte.config.js?raw';
import navbar from '../../src/lib/components/Navbar.svelte?raw';
import adminPage from '../../src/routes/admin/projects/[slug]/[env]/+page.svelte?raw';

describe('landing page Lighthouse hygiene', () => {
	test('uses a main landmark for the public landing route', () => {
		expect(page).toContain('<main');
		expect(page).toContain('</main>');
	});

	test('does not load render-blocking third-party font stylesheets', () => {
		expect(appHtml).not.toContain('fonts.googleapis.com');
		expect(appHtml).not.toContain('fonts.gstatic.com');
		expect(layout).not.toContain('fonts.googleapis.com');
		expect(layout).not.toContain('fonts.gstatic.com');
	});

	test('serves the homepage as static HTML without hydration scripts', () => {
		expect(pageOptions).toContain('export const csr = false');
	});

	test('centralizes CSP in SvelteKit without broad inline script permission', () => {
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
		expect(page).not.toContain('text-foreground/50');
		expect(page).not.toContain('text-foreground/60');
	});

	test('keeps decorative logo images hidden from accessible names', () => {
		expect(page).toContain('img src="/favicon.svg" alt=""');
		expect(navbar).toContain('img src="/favicon.svg" alt=""');
	});

	test('does not register unload handlers that block bfcache', () => {
		expect(adminPage).not.toContain('beforeunload');
		expect(adminPage).not.toContain("addEventListener('unload");
		expect(adminPage).not.toContain('addEventListener("unload');
	});
});
