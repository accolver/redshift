import { describe, expect, it } from 'bun:test';
import { serveLandingPage } from '../src/relay-worker';

describe('managed relay landing page supply chain', () => {
	it('uses a restrictive nonce CSP and no mutable third-party scripts', async () => {
		const response = serveLandingPage();
		const html = await response.text();
		const csp = response.headers.get('content-security-policy') ?? '';
		const nonce = csp.match(/script-src 'nonce-([^']+)'/)?.[1];
		expect(nonce).toBeTruthy();
		expect(csp).toContain(`style-src 'nonce-${nonce}'`);
		expect(csp).toContain("default-src 'none'");
		expect(csp).not.toContain('unsafe-inline');
		expect(html).toContain(`<script nonce="${nonce}">`);
		expect(html).toContain(`<style nonce="${nonce}">`);
		expect(html).not.toContain('unpkg.com');
		expect(html).not.toContain('cdn.jsdelivr.net');
		expect(html).not.toContain('@latest');
		expect(html).not.toContain('@main');
		expect(html).not.toContain('onclick=');
	});
});
