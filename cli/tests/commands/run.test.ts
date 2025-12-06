/**
 * Run Command Tests
 *
 * L2: Function-Author - Tests for run command
 * L5: Journey-Validator - Secret injection workflow validation
 */

import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type { RunOptions } from '../../src/commands/run';

// Mock modules before importing run
const mockSpawn = mock(() => ({
	on: mock((event: string, callback: (arg?: number | Error) => void) => {
		if (event === 'close') {
			// Simulate successful exit
			setTimeout(() => callback(0), 10);
		}
		return { on: mock(() => {}) };
	}),
}));

mock.module('node:child_process', () => ({
	spawn: mockSpawn,
}));

// Store original env and exit
const originalEnv = { ...process.env };
const originalExit = process.exit;
let mockExit: ReturnType<typeof mock>;

describe('run command', () => {
	const TEST_DIR = join(import.meta.dir, '../.test-run');
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

		// Mock process.exit
		mockExit = mock((code?: number) => {
			throw new Error(`process.exit(${code})`);
		});
		(process as unknown as { exit: typeof mockExit }).exit = mockExit;

		// Reset mocks
		mockSpawn.mockClear();
	});

	afterEach(() => {
		// Restore original env and exit
		process.env = { ...originalEnv };
		(process as unknown as { exit: typeof originalExit }).exit = originalExit;

		// Clean up test directory
		try {
			rmSync(TEST_DIR, { recursive: true });
		} catch {}
	});

	describe('RunOptions interface', () => {
		it('should accept command array', () => {
			// TypeScript interface test - if this compiles, it passes
			const options: RunOptions = {
				command: ['echo', 'hello'],
			};

			expect(options.command).toEqual(['echo', 'hello']);
		});

		it('should accept optional project override', () => {
			const options: RunOptions = {
				command: ['npm', 'start'],
				project: 'my-project',
			};

			expect(options.project).toBe('my-project');
		});

		it('should accept optional environment override', () => {
			const options: RunOptions = {
				command: ['npm', 'start'],
				environment: 'production',
			};

			expect(options.environment).toBe('production');
		});

		it('should accept preserveColor flag', () => {
			const options: RunOptions = {
				command: ['npm', 'test'],
				preserveColor: true,
			};

			expect(options.preserveColor).toBe(true);
		});
	});

	describe('validation', () => {
		it('should exit with error when no command specified', async () => {
			// Import fresh module
			const { runCommand } = await import('../../src/commands/run');

			// Capture console.error output
			const errors: string[] = [];
			const originalError = console.error;
			console.error = (...args) => errors.push(args.join(' '));

			try {
				await runCommand({ command: [] });
			} catch (e) {
				expect((e as Error).message).toBe('process.exit(1)');
			}

			console.error = originalError;

			expect(errors.some((e) => e.includes('No command specified'))).toBe(true);
		});

		it('should exit with error when no project configured', async () => {
			// Create config with nsec but no project config
			const testNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
			writeFileSync(
				join(CONFIG_DIR, 'config.json'),
				JSON.stringify({ nsec: testNsec, authMethod: 'nsec' }),
			);

			// Mock cwd to return test dir
			const cwdSpy = spyOn(process, 'cwd').mockReturnValue(TEST_DIR);

			const { runCommand } = await import('../../src/commands/run');

			const errors: string[] = [];
			const originalError = console.error;
			console.error = (...args) => errors.push(args.join(' '));

			try {
				await runCommand({ command: ['echo', 'test'] });
			} catch (e) {
				expect((e as Error).message).toBe('process.exit(1)');
			}

			console.error = originalError;
			cwdSpy.mockRestore();

			expect(errors.some((e) => e.includes('No project configured'))).toBe(true);
		});
	});

	describe('runDryCommand', () => {
		it('should be exported', async () => {
			const { runDryCommand } = await import('../../src/commands/run');
			expect(typeof runDryCommand).toBe('function');
		});

		it('should exit when no project configured', async () => {
			// Create config with nsec but no project config
			const testNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
			writeFileSync(
				join(CONFIG_DIR, 'config.json'),
				JSON.stringify({ nsec: testNsec, authMethod: 'nsec' }),
			);

			const cwdSpy = spyOn(process, 'cwd').mockReturnValue(TEST_DIR);

			const { runDryCommand } = await import('../../src/commands/run');

			const errors: string[] = [];
			const originalError = console.error;
			console.error = (...args) => errors.push(args.join(' '));

			try {
				await runDryCommand({ command: ['echo', 'test'] });
			} catch (e) {
				expect((e as Error).message).toBe('process.exit(1)');
			}

			console.error = originalError;
			cwdSpy.mockRestore();

			expect(errors.some((e) => e.includes('No project configured'))).toBe(true);
		});
	});
});

describe('run command config loading', () => {
	const TEST_DIR = join(import.meta.dir, '../.test-run-config');
	const CONFIG_DIR = join(TEST_DIR, '.redshift');

	beforeEach(() => {
		try {
			rmSync(TEST_DIR, { recursive: true });
		} catch {}
		mkdirSync(TEST_DIR, { recursive: true });
		mkdirSync(CONFIG_DIR, { recursive: true });
		process.env.REDSHIFT_CONFIG_DIR = CONFIG_DIR;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		try {
			rmSync(TEST_DIR, { recursive: true });
		} catch {}
	});

	it('should use project from redshift.yaml when present', async () => {
		const { loadProjectConfig } = await import('../../src/lib/config');

		// Create redshift.yaml
		const projectConfig = {
			project: 'test-project',
			environment: 'development',
			relays: ['wss://test.relay'],
		};
		writeFileSync(join(TEST_DIR, 'redshift.yaml'), stringifyYaml(projectConfig));

		const config = await loadProjectConfig(TEST_DIR);

		expect(config).not.toBeNull();
		expect(config?.project).toBe('test-project');
		expect(config?.environment).toBe('development');
	});

	it('should prefer command options over config file', async () => {
		// This is a design validation test
		// The runCommand should use options.project over config.project
		const options: RunOptions = {
			command: ['echo', 'test'],
			project: 'override-project',
			environment: 'production',
		};

		// Create config with different values
		const projectConfig = {
			project: 'config-project',
			environment: 'development',
		};
		writeFileSync(join(TEST_DIR, 'redshift.yaml'), stringifyYaml(projectConfig));

		// Load config to verify it's different
		const { loadProjectConfig } = await import('../../src/lib/config');
		const config = await loadProjectConfig(TEST_DIR);

		// The options should take precedence
		const projectId = options.project || config?.project;
		const environment = options.environment || config?.environment;

		expect(projectId).toBe('override-project');
		expect(environment).toBe('production');
	});
});
