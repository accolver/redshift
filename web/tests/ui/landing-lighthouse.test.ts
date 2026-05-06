import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

	test('configures CSP through SvelteKit so inline bootstrap scripts receive hashes', () => {
		const config = readWebFile('svelte.config.js');

		expect(config).toContain('csp:');
		expect(config).toContain("mode: 'auto'");
		expect(config).toContain("'script-src': ['self']");
		expect(config).toContain("'font-src': ['self']");
		expect(config).toContain("'upgrade-insecure-requests': true");
	});

	test('ships static security headers used by Cloudflare Pages', () => {
		const headers = readWebFile('_headers');

		expect(headers).toContain('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');
		expect(headers).toContain('Cross-Origin-Opener-Policy: same-origin');
		expect(headers).toContain('Permissions-Policy: camera=(), microphone=(), geolocation=()');
	});

	test('avoids low-contrast muted text on the terminal preview', () => {
		const page = readWebFile('src/routes/+page.svelte');

		expect(page).not.toContain('text-foreground/50');
	});
});
