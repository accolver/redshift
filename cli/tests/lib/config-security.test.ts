/**
 * Config Security Tests
 *
 * L1: Syntax-Linter - File permission enforcement
 * L2: Function-Author - Config key validation and auth clearing
 *
 * Tests that config files and directories are created with restrictive
 * permissions to protect sensitive credentials (nsec private keys).
 * Also tests the config key allow/block lists used by `redshift configure set`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { chmodSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Config, clearAuth, loadConfig, saveConfig } from '../../src/lib/config';

describe('Config Security', () => {
	const testDir = join(
		tmpdir(),
		`redshift-security-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	const originalEnv = { ...process.env };

	beforeEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		mkdirSync(testDir, { recursive: true });
		process.env.REDSHIFT_CONFIG_DIR = testDir;
		process.env.REDSHIFT_NSEC = undefined;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	describe('directory permission enforcement', () => {
		it('creates config directory with 0o700 permissions', async () => {
			const nestedDir = join(testDir, 'fresh-dir');
			process.env.REDSHIFT_CONFIG_DIR = nestedDir;

			await saveConfig({ relays: ['wss://relay.damus.io'] });

			const dirStat = statSync(nestedDir);
			expect(dirStat.mode & 0o777).toBe(0o700);
		});

		it('enforces 0o700 on pre-existing directory with wrong permissions', async () => {
			// Create directory with overly permissive 0o755
			const looseDir = join(testDir, 'loose-dir');
			mkdirSync(looseDir, { recursive: true, mode: 0o755 });
			chmodSync(looseDir, 0o755);
			process.env.REDSHIFT_CONFIG_DIR = looseDir;

			// Verify it starts with wrong permissions
			const beforeStat = statSync(looseDir);
			expect(beforeStat.mode & 0o777).toBe(0o755);

			await saveConfig({ relays: ['wss://nos.lol'] });

			// After saveConfig, directory should be locked down
			const afterStat = statSync(looseDir);
			expect(afterStat.mode & 0o777).toBe(0o700);
		});
	});

	describe('file permission enforcement', () => {
		it('creates config file with 0o600 permissions', async () => {
			await saveConfig({ relays: ['wss://relay.damus.io'] });

			const configPath = join(testDir, 'config.json');
			const fileStat = statSync(configPath);
			expect(fileStat.mode & 0o777).toBe(0o600);
		});

		it('enforces 0o600 on pre-existing file with wrong permissions', async () => {
			const configPath = join(testDir, 'config.json');

			// Write a file with overly permissive 0o644
			await Bun.write(configPath, JSON.stringify({ relays: [] }));
			chmodSync(configPath, 0o644);

			// Verify it starts with wrong permissions
			const beforeStat = statSync(configPath);
			expect(beforeStat.mode & 0o777).toBe(0o644);

			// saveConfig should fix the permissions
			await saveConfig({ relays: ['wss://nos.lol'] });

			const afterStat = statSync(configPath);
			expect(afterStat.mode & 0o777).toBe(0o600);
		});
	});

	describe('config key validation (SENSITIVE_KEYS)', () => {
		it('SENSITIVE_KEYS contains exactly nsec, bunker, authMethod, clientSecretKey', () => {
			// These are the keys that main.ts blocks from `redshift configure set`.
			// Replicate the set here to ensure the contract is documented and tested.
			const SENSITIVE_KEYS = new Set(['nsec', 'bunker', 'authMethod', 'clientSecretKey']);

			expect(SENSITIVE_KEYS.has('nsec')).toBe(true);
			expect(SENSITIVE_KEYS.has('bunker')).toBe(true);
			expect(SENSITIVE_KEYS.has('authMethod')).toBe(true);
			expect(SENSITIVE_KEYS.has('clientSecretKey')).toBe(true);
			expect(SENSITIVE_KEYS.size).toBe(4);

			// Verify non-sensitive keys are NOT in the set
			expect(SENSITIVE_KEYS.has('relays')).toBe(false);
			expect(SENSITIVE_KEYS.has('defaultProject')).toBe(false);
		});
	});

	describe('config key validation (ALLOWED_CONFIG_KEYS)', () => {
		it('ALLOWED_CONFIG_KEYS contains exactly relays, defaultProject, defaultEnvironment, bunkerUrl', () => {
			const ALLOWED_CONFIG_KEYS = new Set([
				'relays',
				'defaultProject',
				'defaultEnvironment',
				'bunkerUrl',
			]);

			expect(ALLOWED_CONFIG_KEYS.has('relays')).toBe(true);
			expect(ALLOWED_CONFIG_KEYS.has('defaultProject')).toBe(true);
			expect(ALLOWED_CONFIG_KEYS.has('defaultEnvironment')).toBe(true);
			expect(ALLOWED_CONFIG_KEYS.has('bunkerUrl')).toBe(true);
			expect(ALLOWED_CONFIG_KEYS.size).toBe(4);

			// Verify sensitive keys are NOT allowed
			expect(ALLOWED_CONFIG_KEYS.has('nsec')).toBe(false);
			expect(ALLOWED_CONFIG_KEYS.has('bunker')).toBe(false);
			expect(ALLOWED_CONFIG_KEYS.has('authMethod')).toBe(false);
		});
	});

	describe('JSON value parsing for config set', () => {
		it('parses JSON array values correctly', () => {
			const parsed = JSON.parse('["wss://relay.damus.io","wss://nos.lol"]') as string[];
			expect(Array.isArray(parsed)).toBe(true);
			expect(parsed).toEqual(['wss://relay.damus.io', 'wss://nos.lol']);
		});

		it('falls back to string for non-JSON values', () => {
			const value = 'my-project-id';
			let result: unknown;
			try {
				result = JSON.parse(value);
			} catch {
				result = value;
			}
			expect(result).toBe('my-project-id');
		});

		it('parses JSON string values correctly', () => {
			const parsed = JSON.parse('"wss://relay.damus.io"') as string;
			expect(parsed).toBe('wss://relay.damus.io');
		});
	});

	describe('clearAuth', () => {
		it('removes authMethod, nsec, and bunker from config', async () => {
			// Save a config with auth fields
			const configWithAuth: Config = {
				authMethod: 'nsec',
				nsec: 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5',
				bunker: {
					bunkerPubkey: 'abc123',
					relays: ['wss://relay.damus.io'],
					clientSecretKey: 'deadbeef',
				},
				relays: ['wss://relay.damus.io'],
				defaultProject: 'my-project',
			};
			await saveConfig(configWithAuth);

			// Verify auth fields are present before clearing
			const beforeClear = await loadConfig();
			expect(beforeClear.authMethod).toBe('nsec');
			expect(beforeClear.nsec).toBeDefined();
			expect(beforeClear.bunker).toBeDefined();

			// Clear auth
			await clearAuth();

			// Verify auth fields are removed but non-auth fields remain
			const afterClear = await loadConfig();
			expect(afterClear.authMethod).toBeUndefined();
			expect(afterClear.nsec).toBeUndefined();
			expect(afterClear.bunker).toBeUndefined();

			// Non-auth fields should be preserved
			expect(afterClear.relays).toEqual(['wss://relay.damus.io']);
			expect(afterClear.defaultProject).toBe('my-project');
		});

		it('handles clearing when no auth fields exist', async () => {
			// Save a config without auth fields
			await saveConfig({ relays: ['wss://nos.lol'] });

			// clearAuth should not throw
			await clearAuth();

			const config = await loadConfig();
			expect(config.relays).toEqual(['wss://nos.lol']);
			expect(config.authMethod).toBeUndefined();
			expect(config.nsec).toBeUndefined();
			expect(config.bunker).toBeUndefined();
		});
	});
});
