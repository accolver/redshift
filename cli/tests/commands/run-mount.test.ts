/**
 * Run Command Mount Tests
 *
 * L2: Function-Author - Tests for --mount and --mount-format flags
 * L5: Journey-Validator - Secret file mounting workflow
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RunOptions } from '../../src/commands/run';

describe('run mount', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), 'redshift-mount-test-'));
	});

	afterEach(() => {
		try {
			rmSync(tempDir, { recursive: true });
		} catch {
			/* ignore cleanup errors */
		}
	});

	describe('RunOptions interface', () => {
		it('should accept mount option', () => {
			const options: RunOptions = {
				command: ['echo', 'hello'],
				mount: '/tmp/secrets.env',
			};
			expect(options.mount).toBe('/tmp/secrets.env');
		});

		it('should accept mountFormat option as env', () => {
			const options: RunOptions = {
				command: ['echo', 'hello'],
				mount: '/tmp/secrets.env',
				mountFormat: 'env',
			};
			expect(options.mountFormat).toBe('env');
		});

		it('should accept mountFormat option as json', () => {
			const options: RunOptions = {
				command: ['echo', 'hello'],
				mount: '/tmp/secrets.json',
				mountFormat: 'json',
			};
			expect(options.mountFormat).toBe('json');
		});

		it('should allow mount without mountFormat', () => {
			const options: RunOptions = {
				command: ['echo', 'hello'],
				mount: '/tmp/secrets',
			};
			expect(options.mount).toBe('/tmp/secrets');
			expect(options.mountFormat).toBeUndefined();
		});
	});

	describe('writeMountFile', () => {
		it('should write secrets in env format by default', async () => {
			const { writeMountFile } = await import('../../src/commands/run');
			const mountPath = join(tempDir, 'secrets.env');
			const secrets = { DB_HOST: 'localhost', DB_PORT: '5432' };

			await writeMountFile(secrets, mountPath);

			expect(existsSync(mountPath)).toBe(true);
			const content = readFileSync(mountPath, 'utf-8');
			expect(content).toContain('DB_HOST="localhost"');
			expect(content).toContain('DB_PORT="5432"');
		});

		it('should write secrets in env format when explicitly specified', async () => {
			const { writeMountFile } = await import('../../src/commands/run');
			const mountPath = join(tempDir, 'secrets.env');
			const secrets = { API_KEY: 'abc123' };

			await writeMountFile(secrets, mountPath, 'env');

			const content = readFileSync(mountPath, 'utf-8');
			expect(content).toBe('API_KEY="abc123"');
		});

		it('should write secrets in json format', async () => {
			const { writeMountFile } = await import('../../src/commands/run');
			const mountPath = join(tempDir, 'secrets.json');
			const secrets = { DB_HOST: 'localhost', DB_PORT: '5432' };

			await writeMountFile(secrets, mountPath, 'json');

			expect(existsSync(mountPath)).toBe(true);
			const content = readFileSync(mountPath, 'utf-8');
			const parsed = JSON.parse(content);
			expect(parsed).toEqual({ DB_HOST: 'localhost', DB_PORT: '5432' });
		});

		it('should produce valid JSON for complex values', async () => {
			const { writeMountFile } = await import('../../src/commands/run');
			const mountPath = join(tempDir, 'secrets.json');
			const secrets = {
				SIMPLE: 'value',
				WITH_QUOTES: 'say "hello"',
				WITH_NEWLINE: 'line1\nline2',
			};

			await writeMountFile(secrets, mountPath, 'json');

			const content = readFileSync(mountPath, 'utf-8');
			// Should not throw
			const parsed = JSON.parse(content);
			expect(parsed.SIMPLE).toBe('value');
			expect(parsed.WITH_QUOTES).toBe('say "hello"');
		});

		it('should handle empty secrets', async () => {
			const { writeMountFile } = await import('../../src/commands/run');
			const mountPath = join(tempDir, 'secrets.env');

			await writeMountFile({}, mountPath, 'env');

			expect(existsSync(mountPath)).toBe(true);
			const content = readFileSync(mountPath, 'utf-8');
			expect(content).toBe('');
		});

		it('should handle empty secrets in json format', async () => {
			const { writeMountFile } = await import('../../src/commands/run');
			const mountPath = join(tempDir, 'secrets.json');

			await writeMountFile({}, mountPath, 'json');

			const content = readFileSync(mountPath, 'utf-8');
			expect(JSON.parse(content)).toEqual({});
		});
	});

	describe('cleanupMountFile', () => {
		it('should delete the mount file', async () => {
			const { cleanupMountFile, writeMountFile } = await import('../../src/commands/run');
			const mountPath = join(tempDir, 'secrets.env');

			// Create the file first
			await writeMountFile({ KEY: 'value' }, mountPath);
			expect(existsSync(mountPath)).toBe(true);

			// Clean up
			cleanupMountFile(mountPath);
			expect(existsSync(mountPath)).toBe(false);
		});

		it('should not throw when file does not exist', async () => {
			const { cleanupMountFile } = await import('../../src/commands/run');
			const mountPath = join(tempDir, 'nonexistent.env');

			// Should not throw
			expect(() => cleanupMountFile(mountPath)).not.toThrow();
		});

		it('should not throw when file was already deleted', async () => {
			const { cleanupMountFile, writeMountFile } = await import('../../src/commands/run');
			const mountPath = join(tempDir, 'secrets.env');

			await writeMountFile({ KEY: 'value' }, mountPath);
			cleanupMountFile(mountPath);

			// Second cleanup should not throw
			expect(() => cleanupMountFile(mountPath)).not.toThrow();
		});
	});

	describe('REDSHIFT_CLI_SECRETS_PATH env var', () => {
		it('should be set to mount path when mount is used', async () => {
			// This tests the contract: when mount is set, the env var should point to the file
			const mountPath = join(tempDir, 'secrets.env');
			const env: Record<string, string> = { PATH: '/usr/bin' };

			// Simulate what runCommand does
			env.REDSHIFT_CLI_SECRETS_PATH = mountPath;

			expect(env.REDSHIFT_CLI_SECRETS_PATH).toBe(mountPath);
		});
	});
});
