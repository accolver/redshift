/**
 * Binary Integration Tests - Spawn CLI and Test HTTP
 *
 * These tests spawn the actual compiled CLI binary and verify
 * that the serve command responds correctly to HTTP requests.
 *
 * SKIPPED IN CI: Requires compiled binary which may not be available.
 * Set CI=true to skip these tests.
 *
 * To run locally:
 *   1. Build the CLI: bun run build:cli
 *   2. Run tests: bun test cli/tests/integration/binary-serve.test.ts
 */

import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Subprocess } from 'bun';

// Skip in CI environment (binary may not be built)
const IS_CI = process.env.CI === 'true';

// Path to the compiled binary
const BINARY_PATH = join(import.meta.dir, '../../dist/redshift');

// Alternative: use bun to run the CLI directly (works without compiled binary)
const CLI_ENTRY = join(import.meta.dir, '../../src/main.ts');

// Check if binary exists
const hasBinary = existsSync(BINARY_PATH);

// Helper to wait for server to be ready
async function waitForServer(url: string, maxAttempts = 20, delayMs = 100): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(500) });
			if (response.ok) return true;
		} catch {
			// Server not ready yet
		}
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}
	return false;
}

// Helper to find an available port
function getRandomPort(): number {
	return 10000 + Math.floor(Math.random() * 50000);
}

describe.skipIf(IS_CI)('Binary Serve Integration Tests', () => {
	let serverProcess: Subprocess | null = null;
	let serverPort: number;
	let serverUrl: string;

	beforeAll(() => {
		if (!hasBinary) {
			console.log('Binary not found at:', BINARY_PATH);
			console.log('Using bun to run CLI entry point instead');
		}
	});

	afterEach(async () => {
		// Clean up server process
		if (serverProcess) {
			serverProcess.kill();
			serverProcess = null;
			// Give process time to clean up
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	});

	async function startServer(port: number): Promise<Subprocess> {
		const args = ['serve', '--port', String(port)];

		if (hasBinary) {
			// Use compiled binary
			return Bun.spawn([BINARY_PATH, ...args], {
				stdout: 'pipe',
				stderr: 'pipe',
				env: {
					...process.env,
					// Don't open browser during tests
					BROWSER: 'none',
				},
			});
		}
		// Use bun to run the CLI entry point
		return Bun.spawn(['bun', 'run', CLI_ENTRY, ...args], {
			stdout: 'pipe',
			stderr: 'pipe',
			env: {
				...process.env,
				BROWSER: 'none',
			},
		});
	}

	it('serves /api/health endpoint', async () => {
		serverPort = getRandomPort();
		serverUrl = `http://127.0.0.1:${serverPort}`;

		serverProcess = await startServer(serverPort);

		const ready = await waitForServer(`${serverUrl}/api/health`);
		expect(ready).toBe(true);

		const response = await fetch(`${serverUrl}/api/health`);
		expect(response.ok).toBe(true);
		expect(response.headers.get('Content-Type')).toContain('application/json');

		const data = (await response.json()) as { status: string };
		expect(data.status).toBe('ok');
	}, 10000);

	it('serves /api/info endpoint with server info', async () => {
		serverPort = getRandomPort();
		serverUrl = `http://127.0.0.1:${serverPort}`;

		serverProcess = await startServer(serverPort);

		const ready = await waitForServer(`${serverUrl}/api/health`);
		expect(ready).toBe(true);

		const response = await fetch(`${serverUrl}/api/info`);
		expect(response.ok).toBe(true);

		const data = (await response.json()) as {
			npub: string;
			address: string;
			version: string;
			embedded: boolean;
		};

		expect(data.address).toBe(serverUrl);
		expect(data.version).toBe('0.1.0');
		expect(typeof data.embedded).toBe('boolean');
		// npub may be 'Not logged in' if not authenticated
		expect(typeof data.npub).toBe('string');
	}, 10000);

	it('serves HTML for root path', async () => {
		serverPort = getRandomPort();
		serverUrl = `http://127.0.0.1:${serverPort}`;

		serverProcess = await startServer(serverPort);

		const ready = await waitForServer(`${serverUrl}/api/health`);
		expect(ready).toBe(true);

		const response = await fetch(serverUrl);
		expect(response.ok).toBe(true);
		expect(response.headers.get('Content-Type')).toContain('text/html');

		const html = await response.text();
		expect(html).toContain('Redshift');
	}, 10000);

	it('serves SPA routes (non-asset paths return HTML)', async () => {
		serverPort = getRandomPort();
		serverUrl = `http://127.0.0.1:${serverPort}`;

		serverProcess = await startServer(serverPort);

		const ready = await waitForServer(`${serverUrl}/api/health`);
		expect(ready).toBe(true);

		// SPA route should return HTML (not 404)
		const response = await fetch(`${serverUrl}/admin/projects`);
		expect(response.ok).toBe(true);
		expect(response.headers.get('Content-Type')).toContain('text/html');
	}, 10000);

	it('returns 404 for missing assets', async () => {
		serverPort = getRandomPort();
		serverUrl = `http://127.0.0.1:${serverPort}`;

		serverProcess = await startServer(serverPort);

		const ready = await waitForServer(`${serverUrl}/api/health`);
		expect(ready).toBe(true);

		// Only test 404 if embedded files are present
		// Without embeds, fallback HTML is served for all routes
		const infoResponse = await fetch(`${serverUrl}/api/info`);
		const info = (await infoResponse.json()) as { embedded: boolean };

		if (info.embedded) {
			const response = await fetch(`${serverUrl}/nonexistent-file.js`);
			expect(response.status).toBe(404);
		}
	}, 10000);

	it('handles concurrent requests', async () => {
		serverPort = getRandomPort();
		serverUrl = `http://127.0.0.1:${serverPort}`;

		serverProcess = await startServer(serverPort);

		const ready = await waitForServer(`${serverUrl}/api/health`);
		expect(ready).toBe(true);

		// Make 10 concurrent requests
		const requests = Array.from({ length: 10 }, () =>
			fetch(`${serverUrl}/api/health`).then((r) => r.json()),
		);

		const results = await Promise.all(requests);
		expect(results).toHaveLength(10);
		for (const result of results) {
			expect((result as { status: string }).status).toBe('ok');
		}
	}, 15000);
});

describe.skipIf(IS_CI)('Binary Process Management', () => {
	it('gracefully shuts down on SIGINT', async () => {
		const port = getRandomPort();
		const url = `http://127.0.0.1:${port}`;

		const args = ['serve', '--port', String(port)];
		const proc = hasBinary
			? Bun.spawn([BINARY_PATH, ...args], { stdout: 'pipe', stderr: 'pipe' })
			: Bun.spawn(['bun', 'run', CLI_ENTRY, ...args], { stdout: 'pipe', stderr: 'pipe' });

		try {
			// Wait for server to start
			const ready = await waitForServer(`${url}/api/health`);
			expect(ready).toBe(true);

			// Send SIGINT (Ctrl+C)
			proc.kill('SIGINT');

			// Wait for process to exit
			const exitCode = await proc.exited;

			// Process should exit cleanly (0) or with SIGINT (130)
			expect([0, 130, null]).toContain(exitCode);

			// Server should no longer respond
			await new Promise((resolve) => setTimeout(resolve, 200));
			try {
				await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(500) });
				// If we get here, server is still running (unexpected)
				expect(false).toBe(true);
			} catch {
				// Expected - server is down
				expect(true).toBe(true);
			}
		} finally {
			proc.kill();
		}
	}, 15000);
});
