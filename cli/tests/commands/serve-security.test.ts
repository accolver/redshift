/**
 * Serve Command Security Tests
 *
 * L1: Syntax-Linter - HTTP security header enforcement
 * L4: Integration-Contractor - Origin validation contract
 *
 * Tests that the serve command's HTTP server applies proper security headers
 * and validates request origins to prevent CSRF and data exfiltration.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { addSecurityHeaders, isAllowedOrigin } from '../../src/commands/serve';

describe('Serve Security', () => {
	describe('addSecurityHeaders', () => {
		let headers: Headers;

		beforeEach(() => {
			headers = new Headers();
		});

		it('sets X-Frame-Options to DENY', () => {
			addSecurityHeaders(headers, false);
			expect(headers.get('X-Frame-Options')).toBe('DENY');
		});

		it('sets X-Content-Type-Options to nosniff', () => {
			addSecurityHeaders(headers, false);
			expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
		});

		it('sets X-XSS-Protection to 1; mode=block', () => {
			addSecurityHeaders(headers, false);
			expect(headers.get('X-XSS-Protection')).toBe('1; mode=block');
		});

		it('sets Referrer-Policy to no-referrer', () => {
			addSecurityHeaders(headers, false);
			expect(headers.get('Referrer-Policy')).toBe('no-referrer');
		});

		it('sets Content-Security-Policy containing self directive', () => {
			addSecurityHeaders(headers, false);
			const csp = headers.get('Content-Security-Policy');
			expect(csp).not.toBeNull();
			expect(csp).toContain("'self'");
		});

		it('sets Content-Security-Policy with script-src and style-src', () => {
			addSecurityHeaders(headers, false);
			const csp = headers.get('Content-Security-Policy');
			expect(csp).toContain('script-src');
			expect(csp).toContain('style-src');
		});

		it('sets Cache-Control to no-store when isApiRoute is true', () => {
			addSecurityHeaders(headers, true);
			expect(headers.get('Cache-Control')).toBe('no-store');
		});

		it('does NOT set Cache-Control when isApiRoute is false', () => {
			addSecurityHeaders(headers, false);
			expect(headers.get('Cache-Control')).toBeNull();
		});

		it('sets all security headers simultaneously', () => {
			addSecurityHeaders(headers, true);

			// All headers should be present
			expect(headers.get('X-Frame-Options')).toBeTruthy();
			expect(headers.get('X-Content-Type-Options')).toBeTruthy();
			expect(headers.get('X-XSS-Protection')).toBeTruthy();
			expect(headers.get('Referrer-Policy')).toBeTruthy();
			expect(headers.get('Content-Security-Policy')).toBeTruthy();
			expect(headers.get('Cache-Control')).toBeTruthy();
		});

		it('does not overwrite pre-existing headers on the Headers object', () => {
			headers.set('X-Custom-Header', 'custom-value');
			addSecurityHeaders(headers, false);

			// Custom header should still be present
			expect(headers.get('X-Custom-Header')).toBe('custom-value');
			// Security headers should also be present
			expect(headers.get('X-Frame-Options')).toBe('DENY');
		});
	});

	describe('isAllowedOrigin', () => {
		const TEST_HOST = '127.0.0.1';
		const TEST_PORT = 3000;

		function makeRequest(path: string, requestHeaders?: Record<string, string>) {
			return new Request(`http://localhost:${TEST_PORT}${path}`, {
				headers: requestHeaders,
			});
		}

		describe('same-origin requests (no Origin header)', () => {
			it('returns true for request without Origin header (same-origin)', () => {
				const req = makeRequest('/');
				expect(isAllowedOrigin(req, TEST_HOST, TEST_PORT)).toBe(true);
			});

			it('returns true for non-API path without Origin header', () => {
				const req = makeRequest('/admin/projects');
				expect(isAllowedOrigin(req, TEST_HOST, TEST_PORT)).toBe(true);
			});
		});

		describe('localhost origin validation', () => {
			it('returns true for localhost origin with correct port', () => {
				const req = makeRequest('/api/secrets', {
					origin: `http://localhost:${TEST_PORT}`,
				});
				expect(isAllowedOrigin(req, TEST_HOST, TEST_PORT)).toBe(true);
			});

			it('returns true for 127.0.0.1 origin with correct port', () => {
				const req = makeRequest('/api/secrets', {
					origin: `http://127.0.0.1:${TEST_PORT}`,
				});
				expect(isAllowedOrigin(req, TEST_HOST, TEST_PORT)).toBe(true);
			});

			it('returns true for host-matching origin with correct port', () => {
				const req = makeRequest('/api/secrets', {
					origin: `http://${TEST_HOST}:${TEST_PORT}`,
				});
				expect(isAllowedOrigin(req, TEST_HOST, TEST_PORT)).toBe(true);
			});
		});

		describe('external origin rejection', () => {
			it('returns false for external origin (https://evil.com)', () => {
				const req = makeRequest('/api/secrets', {
					origin: 'https://evil.com',
				});
				expect(isAllowedOrigin(req, TEST_HOST, TEST_PORT)).toBe(false);
			});

			it('returns false for localhost with wrong port', () => {
				const req = makeRequest('/api/secrets', {
					origin: 'http://localhost:9999',
				});
				expect(isAllowedOrigin(req, TEST_HOST, TEST_PORT)).toBe(false);
			});

			it('returns false for HTTPS localhost (scheme mismatch)', () => {
				const req = makeRequest('/api/secrets', {
					origin: `https://localhost:${TEST_PORT}`,
				});
				expect(isAllowedOrigin(req, TEST_HOST, TEST_PORT)).toBe(false);
			});
		});

		describe('safe API paths (exempt from origin checks)', () => {
			it('returns true for /api/health without Origin header', () => {
				const req = makeRequest('/api/health');
				expect(isAllowedOrigin(req, TEST_HOST, TEST_PORT)).toBe(true);
			});

			it('returns true for /api/info without Origin header', () => {
				const req = makeRequest('/api/info');
				expect(isAllowedOrigin(req, TEST_HOST, TEST_PORT)).toBe(true);
			});
		});

		describe('API routes without Origin header', () => {
			it('returns false for /api/secrets without Origin or x-redshift-client header', () => {
				const req = makeRequest('/api/secrets');
				expect(isAllowedOrigin(req, TEST_HOST, TEST_PORT)).toBe(false);
			});

			it('returns true for /api/secrets with x-redshift-client header (no Origin)', () => {
				const req = makeRequest('/api/secrets', {
					'x-redshift-client': 'redshift-cli/1.0',
				});
				expect(isAllowedOrigin(req, TEST_HOST, TEST_PORT)).toBe(true);
			});

			it('returns false for /api/projects without Origin or x-redshift-client header', () => {
				const req = makeRequest('/api/projects');
				expect(isAllowedOrigin(req, TEST_HOST, TEST_PORT)).toBe(false);
			});

			it('returns true for /api/projects with x-redshift-client header', () => {
				const req = makeRequest('/api/projects', {
					'x-redshift-client': 'sdk',
				});
				expect(isAllowedOrigin(req, TEST_HOST, TEST_PORT)).toBe(true);
			});
		});
	});

	describe('end-to-end: security headers on real HTTP server', () => {
		let server: ReturnType<typeof Bun.serve> | null = null;

		afterEach(() => {
			if (server) {
				server.stop(true);
				server = null;
			}
		});

		it('returns security headers on API responses', async () => {
			server = Bun.serve({
				port: 0,
				hostname: '127.0.0.1',
				fetch(req) {
					const url = new URL(req.url);
					const responseHeaders = new Headers({ 'Content-Type': 'application/json' });
					addSecurityHeaders(responseHeaders, url.pathname.startsWith('/api/'));

					if (url.pathname === '/api/health') {
						return new Response(JSON.stringify({ status: 'ok' }), {
							headers: responseHeaders,
						});
					}
					return new Response('Not Found', { status: 404, headers: responseHeaders });
				},
			});

			const response = await fetch(`http://127.0.0.1:${server.port}/api/health`);
			expect(response.ok).toBe(true);

			// Verify all security headers are present
			expect(response.headers.get('X-Frame-Options')).toBe('DENY');
			expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
			expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
			expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
			expect(response.headers.get('Content-Security-Policy')).toContain("'self'");
			expect(response.headers.get('Cache-Control')).toBe('no-store');
		});

		it('returns security headers without Cache-Control on non-API responses', async () => {
			server = Bun.serve({
				port: 0,
				hostname: '127.0.0.1',
				fetch() {
					const responseHeaders = new Headers({ 'Content-Type': 'text/html' });
					addSecurityHeaders(responseHeaders, false);
					return new Response('<html></html>', { headers: responseHeaders });
				},
			});

			const response = await fetch(`http://127.0.0.1:${server.port}/`);
			expect(response.ok).toBe(true);

			expect(response.headers.get('X-Frame-Options')).toBe('DENY');
			expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
			// Cache-Control should NOT be set for non-API routes
			expect(response.headers.get('Cache-Control')).toBeNull();
		});

		it('blocks requests from disallowed origins with 403', async () => {
			const testHost = '127.0.0.1';
			// Use a known port reference to avoid non-null assertion in the closure.
			// We capture the port after server creation and use it in fetch calls.
			const portRef = { value: 0 };

			server = Bun.serve({
				port: 0,
				hostname: testHost,
				fetch(req) {
					if (!isAllowedOrigin(req, testHost, portRef.value)) {
						const blockedHeaders = new Headers();
						addSecurityHeaders(blockedHeaders, true);
						return new Response('Forbidden', { status: 403, headers: blockedHeaders });
					}

					const responseHeaders = new Headers({ 'Content-Type': 'application/json' });
					addSecurityHeaders(responseHeaders, true);
					return new Response(JSON.stringify({ status: 'ok' }), {
						headers: responseHeaders,
					});
				},
			});
			portRef.value = server.port ?? 0;

			// Request from evil origin should be blocked
			const blockedResponse = await fetch(`http://127.0.0.1:${String(server.port)}/api/secrets`, {
				headers: { origin: 'https://evil.com' },
			});
			expect(blockedResponse.status).toBe(403);

			// Even blocked responses should have security headers
			expect(blockedResponse.headers.get('X-Frame-Options')).toBe('DENY');
		});

		it('allows requests from correct localhost origin', async () => {
			const testHost = '127.0.0.1';
			const portRef = { value: 0 };

			server = Bun.serve({
				port: 0,
				hostname: testHost,
				fetch(req) {
					if (!isAllowedOrigin(req, testHost, portRef.value)) {
						return new Response('Forbidden', { status: 403 });
					}

					const responseHeaders = new Headers({ 'Content-Type': 'application/json' });
					addSecurityHeaders(responseHeaders, true);
					return new Response(JSON.stringify({ status: 'ok' }), {
						headers: responseHeaders,
					});
				},
			});
			portRef.value = server.port ?? 0;

			const port = String(server.port);
			const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
				headers: { origin: `http://127.0.0.1:${port}` },
			});
			expect(response.ok).toBe(true);
		});
	});
});
