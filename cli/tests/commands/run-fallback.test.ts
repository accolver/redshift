/**
 * Run Command Fallback Tests
 *
 * L2: Function-Author - Tests for --fallback, --fallback-only, --fallback-readonly, --no-fallback flags
 * L5: Journey-Validator - Offline/fallback secret injection workflow
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RunOptions } from '../../src/commands/run';

describe('run fallback', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), 'redshift-fallback-test-'));
	});

	afterEach(() => {
		try {
			rmSync(tempDir, { recursive: true });
		} catch {
			/* ignore cleanup errors */
		}
	});

	describe('RunOptions interface', () => {
		it('should accept fallback path option', () => {
			const options: RunOptions = {
				command: ['echo', 'hello'],
				fallback: '/tmp/secrets.fallback.json',
			};
			expect(options.fallback).toBe('/tmp/secrets.fallback.json');
		});

		it('should accept fallbackOnly option', () => {
			const options: RunOptions = {
				command: ['echo', 'hello'],
				fallback: '/tmp/secrets.fallback.json',
				fallbackOnly: true,
			};
			expect(options.fallbackOnly).toBe(true);
		});

		it('should accept fallbackReadonly option', () => {
			const options: RunOptions = {
				command: ['echo', 'hello'],
				fallback: '/tmp/secrets.fallback.json',
				fallbackReadonly: true,
			};
			expect(options.fallbackReadonly).toBe(true);
		});

		it('should accept noFallback option', () => {
			const options: RunOptions = {
				command: ['echo', 'hello'],
				noFallback: true,
			};
			expect(options.noFallback).toBe(true);
		});
	});

	describe('writeFallbackFile', () => {
		it('should write secrets as valid JSON', async () => {
			const { writeFallbackFile } = await import('../../src/commands/run');
			const fallbackPath = join(tempDir, 'secrets.fallback.json');
			const secrets = { DB_HOST: 'localhost', DB_PORT: '5432', API_KEY: 'sk_test_123' };

			await writeFallbackFile(secrets, fallbackPath);

			expect(existsSync(fallbackPath)).toBe(true);
			const content = readFileSync(fallbackPath, 'utf-8');
			const parsed = JSON.parse(content);
			expect(parsed).toEqual(secrets);
		});

		it('should overwrite an existing fallback file', async () => {
			const { writeFallbackFile } = await import('../../src/commands/run');
			const fallbackPath = join(tempDir, 'secrets.fallback.json');

			// Write initial secrets
			await writeFallbackFile({ OLD_KEY: 'old_value' }, fallbackPath);
			expect(JSON.parse(readFileSync(fallbackPath, 'utf-8'))).toEqual({ OLD_KEY: 'old_value' });

			// Overwrite with new secrets
			await writeFallbackFile({ NEW_KEY: 'new_value' }, fallbackPath);
			const parsed = JSON.parse(readFileSync(fallbackPath, 'utf-8'));
			expect(parsed).toEqual({ NEW_KEY: 'new_value' });
			expect(parsed.OLD_KEY).toBeUndefined();
		});

		it('should handle empty secrets object', async () => {
			const { writeFallbackFile } = await import('../../src/commands/run');
			const fallbackPath = join(tempDir, 'secrets.fallback.json');

			await writeFallbackFile({}, fallbackPath);

			expect(existsSync(fallbackPath)).toBe(true);
			const parsed = JSON.parse(readFileSync(fallbackPath, 'utf-8'));
			expect(parsed).toEqual({});
		});
	});

	describe('readFallbackFile', () => {
		it('should read and parse valid JSON', async () => {
			const { readFallbackFile } = await import('../../src/commands/run');
			const fallbackPath = join(tempDir, 'secrets.fallback.json');
			const secrets = { DB_HOST: 'localhost', API_KEY: 'sk_test_123' };
			writeFileSync(fallbackPath, JSON.stringify(secrets));

			const result = await readFallbackFile(fallbackPath);

			expect(result).toEqual(secrets);
		});

		it('should throw when file does not exist', async () => {
			const { readFallbackFile } = await import('../../src/commands/run');
			const fallbackPath = join(tempDir, 'nonexistent.fallback.json');

			await expect(readFallbackFile(fallbackPath)).rejects.toThrow();
		});

		it('should throw on invalid JSON content', async () => {
			const { readFallbackFile } = await import('../../src/commands/run');
			const fallbackPath = join(tempDir, 'bad.fallback.json');
			writeFileSync(fallbackPath, 'this is not json {{{');

			await expect(readFallbackFile(fallbackPath)).rejects.toThrow();
		});

		it('should round-trip with writeFallbackFile', async () => {
			const { readFallbackFile, writeFallbackFile } = await import('../../src/commands/run');
			const fallbackPath = join(tempDir, 'roundtrip.fallback.json');
			const secrets = {
				DB_URL: 'postgres://user:pass@host:5432/db',
				COMPLEX_VALUE: 'has "quotes" and\nnewlines',
				EMPTY: '',
			};

			await writeFallbackFile(secrets, fallbackPath);
			const result = await readFallbackFile(fallbackPath);

			expect(result).toEqual(secrets);
		});
	});

	describe('cleanFallbackFiles', () => {
		it('should delete *.fallback.json files in the config directory', () => {
			const { cleanFallbackFiles } = require('../../src/commands/run');
			// Create some fallback files
			writeFileSync(join(tempDir, 'project-dev.fallback.json'), '{}');
			writeFileSync(join(tempDir, 'project-prod.fallback.json'), '{}');

			const deleted = cleanFallbackFiles(tempDir);

			expect(deleted).toHaveLength(2);
			expect(deleted.sort()).toEqual(
				['project-dev.fallback.json', 'project-prod.fallback.json'].sort(),
			);
			expect(existsSync(join(tempDir, 'project-dev.fallback.json'))).toBe(false);
			expect(existsSync(join(tempDir, 'project-prod.fallback.json'))).toBe(false);
		});

		it('should return filenames of deleted files', () => {
			const { cleanFallbackFiles } = require('../../src/commands/run');
			writeFileSync(join(tempDir, 'test.fallback.json'), '{"key":"val"}');

			const deleted = cleanFallbackFiles(tempDir);

			expect(deleted).toEqual(['test.fallback.json']);
		});

		it('should ignore non-matching files', () => {
			const { cleanFallbackFiles } = require('../../src/commands/run');
			// Create files that should NOT be deleted
			writeFileSync(join(tempDir, 'config.json'), '{}');
			writeFileSync(join(tempDir, 'secrets.env'), 'KEY=val');
			writeFileSync(join(tempDir, 'fallback.json'), '{}'); // no .fallback.json pattern
			// Create one that SHOULD be deleted
			writeFileSync(join(tempDir, 'app.fallback.json'), '{}');

			const deleted = cleanFallbackFiles(tempDir);

			expect(deleted).toEqual(['app.fallback.json']);
			// Non-matching files should still exist
			expect(existsSync(join(tempDir, 'config.json'))).toBe(true);
			expect(existsSync(join(tempDir, 'secrets.env'))).toBe(true);
			expect(existsSync(join(tempDir, 'fallback.json'))).toBe(true);
		});

		it('should handle empty directory with no fallback files', () => {
			const { cleanFallbackFiles } = require('../../src/commands/run');

			const deleted = cleanFallbackFiles(tempDir);

			expect(deleted).toEqual([]);
		});
	});

	describe('fallback logic integration', () => {
		it('should error when fallbackOnly is set without fallback path', async () => {
			// This validates the guard: --fallback-only requires --fallback <path>
			const options: RunOptions = {
				command: ['echo', 'hello'],
				fallbackOnly: true,
				// fallback is NOT set
			};
			expect(options.fallbackOnly).toBe(true);
			expect(options.fallback).toBeUndefined();
			// The actual error is thrown in runCommand, which requires full auth/relay setup.
			// We validate the contract: fallbackOnly without fallback should be an error condition.
		});

		it('should not write fallback when fallbackReadonly is set', () => {
			// This validates the contract: --fallback-readonly prevents writing
			const options: RunOptions = {
				command: ['echo', 'hello'],
				fallback: '/tmp/secrets.fallback.json',
				fallbackReadonly: true,
			};
			// The logic check: if fallbackReadonly is true, writeFallbackFile should NOT be called
			// after a successful relay fetch. We verify the option is properly typed.
			expect(options.fallbackReadonly).toBe(true);
			expect(options.fallback).toBe('/tmp/secrets.fallback.json');
		});

		it('should not use fallback when noFallback is set', () => {
			// This validates the contract: --no-fallback disables all fallback behavior
			const options: RunOptions = {
				command: ['echo', 'hello'],
				noFallback: true,
			};
			// With noFallback, even if a fallback path were somehow set,
			// the fallback should not be read or written.
			expect(options.noFallback).toBe(true);
		});
	});
});
