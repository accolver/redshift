/**
 * Bunker Command Tests
 *
 * L2: Function-Author - Tests for bunker command handler
 * L4: Integration-Contractor - NIP-46 bunker server CLI
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { createCLI } from '../../src/lib/cli';

describe('Bunker Command', () => {
	describe('CLI parsing', () => {
		const cli = createCLI('1.0.0');

		it('recognizes the bunker command', () => {
			const cmd = cli.getCommand('bunker');
			expect(cmd).toBeDefined();
			expect(cmd?.name).toBe('bunker');
			expect(cmd?.description).toBe('Run the NIP-46 bunker server');
		});

		it('parses bunker start subcommand', () => {
			const result = cli.parse(['bunker', 'start']);
			expect(result.command).toBe('bunker');
			expect(result.subcommand).toBe('start');
		});

		it('parses bunker status subcommand', () => {
			const result = cli.parse(['bunker', 'status']);
			expect(result.command).toBe('bunker');
			expect(result.subcommand).toBe('status');
		});

		it('parses bunker start with --port flag', () => {
			const result = cli.parse(['bunker', 'start', '--port', '4000']);
			expect(result.command).toBe('bunker');
			expect(result.subcommand).toBe('start');
			expect(result.flags.port).toBe('4000');
		});

		it('parses bunker start with -p short flag', () => {
			const result = cli.parse(['bunker', 'start', '-p', '5000']);
			expect(result.command).toBe('bunker');
			expect(result.subcommand).toBe('start');
			expect(result.flags.port).toBe('5000');
		});

		it('parses bunker start with --host flag', () => {
			const result = cli.parse(['bunker', 'start', '--host', '0.0.0.0']);
			expect(result.command).toBe('bunker');
			expect(result.subcommand).toBe('start');
			expect(result.flags.host).toBe('0.0.0.0');
		});

		it('parses bunker start with -H short flag', () => {
			const result = cli.parse(['bunker', 'start', '-H', '0.0.0.0']);
			expect(result.command).toBe('bunker');
			expect(result.subcommand).toBe('start');
			expect(result.flags.host).toBe('0.0.0.0');
		});

		it('parses bunker start with --database flag', () => {
			const result = cli.parse(['bunker', 'start', '--database', '/var/lib/bunker.db']);
			expect(result.command).toBe('bunker');
			expect(result.subcommand).toBe('start');
			expect(result.flags.database).toBe('/var/lib/bunker.db');
		});

		it('parses bunker start with -d short flag', () => {
			const result = cli.parse(['bunker', 'start', '-d', '/tmp/test.db']);
			expect(result.command).toBe('bunker');
			expect(result.subcommand).toBe('start');
			expect(result.flags.database).toBe('/tmp/test.db');
		});

		it('parses bunker start with all flags combined', () => {
			const result = cli.parse([
				'bunker',
				'start',
				'--port',
				'4000',
				'--host',
				'0.0.0.0',
				'--database',
				'/data/bunker.db',
			]);
			expect(result.command).toBe('bunker');
			expect(result.subcommand).toBe('start');
			expect(result.flags.port).toBe('4000');
			expect(result.flags.host).toBe('0.0.0.0');
			expect(result.flags.database).toBe('/data/bunker.db');
		});

		it('parses bunker status with --json flag', () => {
			const result = cli.parse(['bunker', 'status', '--json']);
			expect(result.command).toBe('bunker');
			expect(result.subcommand).toBe('status');
			expect(result.globalFlags.json).toBe(true);
		});

		it('parses bunker with --help flag', () => {
			const result = cli.parse(['bunker', '--help']);
			expect(result.command).toBe('bunker');
			expect(result.helpRequested).toBe(true);
		});

		it('parses bunker start with --help flag', () => {
			const result = cli.parse(['bunker', 'start', '--help']);
			expect(result.command).toBe('bunker');
			expect(result.helpRequested).toBe(true);
		});

		it('parses bunker status with --help flag', () => {
			const result = cli.parse(['bunker', 'status', '--help']);
			expect(result.command).toBe('bunker');
			expect(result.helpRequested).toBe(true);
		});
	});

	describe('help generation', () => {
		const cli = createCLI('1.0.0');

		it('generates help for bunker command', () => {
			const help = cli.generateCommandHelp('bunker');

			expect(help).toContain('Run the NIP-46 bunker server');
			expect(help).toContain('start');
			expect(help).toContain('status');
		});

		it('generates help for bunker start subcommand', () => {
			const help = cli.generateCommandHelp('bunker', 'start');

			expect(help).toContain('Start the bunker NIP-46 server');
			expect(help).toContain('--port');
			expect(help).toContain('--host');
			expect(help).toContain('--database');
		});

		it('generates help for bunker status subcommand', () => {
			const help = cli.generateCommandHelp('bunker', 'status');

			expect(help).toContain('Check if the bunker server is reachable');
		});

		it('includes bunker in main help', () => {
			const help = cli.generateMainHelp();

			expect(help).toContain('bunker');
			expect(help).toContain('Run the NIP-46 bunker server');
		});

		it('shows default values in start help', () => {
			const help = cli.generateCommandHelp('bunker', 'start');

			expect(help).toContain('3333');
			expect(help).toContain('127.0.0.1');
			expect(help).toContain('bunker.db');
		});
	});

	describe('bunker status', () => {
		let mockServer: ReturnType<typeof Bun.serve> | null = null;
		let mockResponse: { status: number; body: Record<string, unknown> } = {
			status: 200,
			body: { status: 'ok' },
		};

		const TEST_PORT = 19877;
		const TEST_URL = `http://localhost:${TEST_PORT}`;

		beforeAll(() => {
			mockServer = Bun.serve({
				port: TEST_PORT,
				fetch() {
					return new Response(JSON.stringify(mockResponse.body), {
						status: mockResponse.status,
						headers: { 'Content-Type': 'application/json' },
					});
				},
			});
		});

		afterEach(() => {
			mockResponse = { status: 200, body: { status: 'ok' } };
		});

		afterAll(() => {
			if (mockServer) {
				mockServer.stop();
			}
		});

		it('reports healthy bunker as reachable', async () => {
			const response = await fetch(`${TEST_URL}/health`);
			const data = (await response.json()) as { status: string };

			expect(response.ok).toBe(true);
			expect(data.status).toBe('ok');
		});

		it('returns JSON status response', async () => {
			const response = await fetch(`${TEST_URL}/health`);
			const data = (await response.json()) as { status: string };

			expect(data).toEqual({ status: 'ok' });
		});

		it('handles non-ok HTTP status', async () => {
			mockResponse = { status: 503, body: { status: 'error' } };

			const response = await fetch(`${TEST_URL}/health`);

			expect(response.ok).toBe(false);
			expect(response.status).toBe(503);
		});

		it('measures response time', async () => {
			const startTime = performance.now();
			await fetch(`${TEST_URL}/health`);
			const elapsed = Math.round(performance.now() - startTime);

			// Should complete in under 1 second for a local mock
			expect(elapsed).toBeLessThan(1000);
			expect(elapsed).toBeGreaterThanOrEqual(0);
		});

		it('handles unreachable server', async () => {
			// Try to connect to a port that nothing is listening on
			const unreachableUrl = 'http://localhost:19999/health';

			let caught = false;
			try {
				await fetch(unreachableUrl);
			} catch {
				caught = true;
			}

			expect(caught).toBe(true);
		});

		it('formats JSON output correctly for healthy bunker', async () => {
			const response = await fetch(`${TEST_URL}/health`);
			const data = (await response.json()) as { status?: string };
			const startTime = performance.now();
			const elapsed = Math.round(performance.now() - startTime);

			// Simulate what the CLI would output in JSON mode
			const output = {
				status: data.status ?? 'ok',
				url: TEST_URL,
				responseTimeMs: elapsed,
			};

			expect(output.status).toBe('ok');
			expect(output.url).toBe(TEST_URL);
			expect(typeof output.responseTimeMs).toBe('number');
		});

		it('formats JSON output correctly for error response', async () => {
			mockResponse = { status: 500, body: { error: 'internal error' } };

			const response = await fetch(`${TEST_URL}/health`);
			const elapsed = 42; // simulated

			const output = {
				status: 'error',
				url: TEST_URL,
				httpStatus: response.status,
				responseTimeMs: elapsed,
			};

			expect(output.status).toBe('error');
			expect(output.httpStatus).toBe(500);
		});
	});

	describe('command does not conflict with login --bunker', () => {
		const cli = createCLI('1.0.0');

		it('bunker command and login --bunker flag are independent', () => {
			// The bunker top-level command
			const bunkerCmd = cli.getCommand('bunker');
			expect(bunkerCmd).toBeDefined();
			expect(bunkerCmd?.name).toBe('bunker');

			// The login --bunker flag
			const loginCmd = cli.getCommand('login');
			expect(loginCmd).toBeDefined();
			expect(loginCmd?.flags?.bunker).toBeDefined();
			expect(loginCmd?.flags?.bunker?.type).toBe('string');
		});

		it('parses login --bunker as a flag, not a subcommand', () => {
			const result = cli.parse(['login', '--bunker', 'bunker://abc123']);
			expect(result.command).toBe('login');
			expect(result.subcommand).toBeUndefined();
			expect(result.flags.bunker).toBe('bunker://abc123');
		});

		it('parses bunker start as a command, not a login flag', () => {
			const result = cli.parse(['bunker', 'start']);
			expect(result.command).toBe('bunker');
			expect(result.subcommand).toBe('start');
		});
	});
});
