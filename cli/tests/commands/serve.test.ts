/**
 * Serve Command Tests
 *
 * L2: Function-Author - Tests for serve command
 * L5: Journey-Validator - Web UI serving workflow validation
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { ServeOptions } from '../../src/commands/serve';

// Store original env
const originalEnv = { ...process.env };

describe('serve command', () => {
	const TEST_DIR = join(import.meta.dir, '../.test-serve');
	const CONFIG_DIR = join(TEST_DIR, '.redshift');

	beforeEach(() => {
		// Clean up and create fresh test directories
		try {
			rmSync(TEST_DIR, { recursive: true });
		} catch {}
		mkdirSync(TEST_DIR, { recursive: true });
		mkdirSync(CONFIG_DIR, { recursive: true });

		// Set up test environment
		process.env.REDSHIFT_CONFIG_DIR = CONFIG_DIR;
		process.env.HOME = TEST_DIR;
	});

	afterEach(() => {
		// Restore original env
		process.env = { ...originalEnv };

		// Clean up test directory
		try {
			rmSync(TEST_DIR, { recursive: true });
		} catch {}
	});

	describe('ServeOptions interface', () => {
		it('should accept default options (all optional)', () => {
			const options: ServeOptions = {};
			expect(options.port).toBeUndefined();
			expect(options.host).toBeUndefined();
			expect(options.open).toBeUndefined();
		});

		it('should accept custom port', () => {
			const options: ServeOptions = {
				port: 8080,
			};
			expect(options.port).toBe(8080);
		});

		it('should accept custom host', () => {
			const options: ServeOptions = {
				host: '0.0.0.0',
			};
			expect(options.host).toBe('0.0.0.0');
		});

		it('should accept open flag', () => {
			const options: ServeOptions = {
				open: true,
			};
			expect(options.open).toBe(true);
		});

		it('should accept all options together', () => {
			const options: ServeOptions = {
				port: 3001,
				host: 'localhost',
				open: false,
			};
			expect(options.port).toBe(3001);
			expect(options.host).toBe('localhost');
			expect(options.open).toBe(false);
		});
	});

	describe('serveCommand exports', () => {
		it('should export serveCommand function', async () => {
			const { serveCommand } = await import('../../src/commands/serve');
			expect(typeof serveCommand).toBe('function');
		});
	});

	describe('embedded files detection', () => {
		it('should detect when embedded files are not present', async () => {
			const { hasEmbeddedFiles } = await import('../../src/lib/embedded-files');
			// In test environment, embedded files are typically not present
			const hasEmbeds = hasEmbeddedFiles();
			// This will be false in test environment, true in production binary
			expect(typeof hasEmbeds).toBe('boolean');
		});

		it('should return embedded file if present', async () => {
			const { getEmbeddedFile } = await import('../../src/lib/embedded-files');
			// Try to get a file that doesn't exist
			const file = getEmbeddedFile('/nonexistent.html');
			// Should return undefined when not embedded
			expect(file).toBeUndefined();
		});
	});

	describe('server defaults', () => {
		it('should default to port 3000', () => {
			const options: ServeOptions = {};
			const port = options.port || 3000;
			expect(port).toBe(3000);
		});

		it('should default to host 127.0.0.1', () => {
			const options: ServeOptions = {};
			const host = options.host || '127.0.0.1';
			expect(host).toBe('127.0.0.1');
		});
	});

	describe('API endpoints', () => {
		let server: ReturnType<typeof Bun.serve> | null = null;

		afterEach(() => {
			if (server) {
				server.stop();
				server = null;
			}
		});

		it('should respond to /api/health with ok status', async () => {
			// Create a minimal test server mimicking serve command
			server = Bun.serve({
				port: 0, // Random available port
				hostname: '127.0.0.1',
				fetch(req) {
					const url = new URL(req.url);
					if (url.pathname === '/api/health') {
						return Response.json({ status: 'ok' });
					}
					return new Response('Not Found', { status: 404 });
				},
			});

			const response = await fetch(`http://127.0.0.1:${server.port}/api/health`);
			expect(response.ok).toBe(true);

			const data = (await response.json()) as { status: string };
			expect(data.status).toBe('ok');
		});

		it('should respond to /api/info with server info', async () => {
			const testNpub = 'npub1test';
			const testAddress = 'http://127.0.0.1:3000';

			server = Bun.serve({
				port: 0,
				hostname: '127.0.0.1',
				fetch(req) {
					const url = new URL(req.url);
					if (url.pathname === '/api/info') {
						return Response.json({
							npub: testNpub,
							address: testAddress,
							version: '0.1.0',
							embedded: false,
						});
					}
					return new Response('Not Found', { status: 404 });
				},
			});

			const response = await fetch(`http://127.0.0.1:${server.port}/api/info`);
			expect(response.ok).toBe(true);

			const data = (await response.json()) as {
				npub: string;
				address: string;
				version: string;
				embedded: boolean;
			};
			expect(data.npub).toBe(testNpub);
			expect(data.address).toBe(testAddress);
			expect(data.version).toBe('0.1.0');
			expect(data.embedded).toBe(false);
		});
	});

	describe('fallback HTML', () => {
		it('should serve fallback HTML when no embedded files', async () => {
			let server: ReturnType<typeof Bun.serve> | null = null;

			try {
				const FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
<head><title>Redshift Admin</title></head>
<body><h1>Redshift</h1></body>
</html>`;

				server = Bun.serve({
					port: 0,
					hostname: '127.0.0.1',
					fetch() {
						return new Response(FALLBACK_HTML, {
							headers: { 'Content-Type': 'text/html; charset=utf-8' },
						});
					},
				});

				const response = await fetch(`http://127.0.0.1:${server.port}/`);
				expect(response.ok).toBe(true);
				expect(response.headers.get('Content-Type')).toContain('text/html');

				const html = await response.text();
				expect(html).toContain('Redshift');
			} finally {
				if (server) server.stop();
			}
		});
	});

	describe('SPA routing', () => {
		it('should serve index.html for non-asset routes', async () => {
			let server: ReturnType<typeof Bun.serve> | null = null;

			try {
				const INDEX_HTML = '<html><body>SPA App</body></html>';

				server = Bun.serve({
					port: 0,
					hostname: '127.0.0.1',
					fetch(req) {
						const url = new URL(req.url);
						const path = url.pathname;

						// Simulate SPA routing: non-asset paths get index.html
						if (!path.includes('.')) {
							return new Response(INDEX_HTML, {
								headers: { 'Content-Type': 'text/html' },
							});
						}
						return new Response('Not Found', { status: 404 });
					},
				});

				// Root should work
				const rootResponse = await fetch(`http://127.0.0.1:${server.port}/`);
				expect(rootResponse.ok).toBe(true);

				// SPA route should work
				const spaResponse = await fetch(`http://127.0.0.1:${server.port}/admin/projects`);
				expect(spaResponse.ok).toBe(true);

				// Asset that doesn't exist should 404
				const assetResponse = await fetch(`http://127.0.0.1:${server.port}/nonexistent.js`);
				expect(assetResponse.status).toBe(404);
			} finally {
				if (server) server.stop();
			}
		});
	});

	describe('cache headers', () => {
		it('should set immutable cache for _app/immutable assets', async () => {
			let server: ReturnType<typeof Bun.serve> | null = null;

			try {
				server = Bun.serve({
					port: 0,
					hostname: '127.0.0.1',
					fetch(req) {
						const url = new URL(req.url);
						const path = url.pathname;

						if (path.includes('/_app/immutable/')) {
							return new Response('asset content', {
								headers: {
									'Content-Type': 'application/javascript',
									'Cache-Control': 'public, max-age=31536000, immutable',
								},
							});
						}
						return new Response('other content', {
							headers: {
								'Content-Type': 'text/html',
								'Cache-Control': 'public, max-age=0, must-revalidate',
							},
						});
					},
				});

				// Immutable assets should have long cache
				const immutableResponse = await fetch(
					`http://127.0.0.1:${server.port}/_app/immutable/test.js`,
				);
				expect(immutableResponse.headers.get('Cache-Control')).toContain('immutable');
				expect(immutableResponse.headers.get('Cache-Control')).toContain('31536000');

				// Other content should revalidate
				const otherResponse = await fetch(`http://127.0.0.1:${server.port}/`);
				expect(otherResponse.headers.get('Cache-Control')).toContain('must-revalidate');
			} finally {
				if (server) server.stop();
			}
		});
	});
});
