/**
 * Config Module Tests - TDD
 *
 * L2: Function-Author - Config storage and retrieval
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	type Config,
	getConfigDir,
	getPrivateKey,
	loadConfig,
	loadProjectConfig,
	saveConfig,
	saveProjectConfig,
} from '../../src/lib/config';

describe('Config Module', () => {
	const testDir = join(tmpdir(), `redshift-test-${Date.now()}`);
	const originalEnv = { ...process.env };

	beforeEach(() => {
		// Clean test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		mkdirSync(testDir, { recursive: true });

		// Set test config directory
		process.env.REDSHIFT_CONFIG_DIR = testDir;
		// Clear any existing nsec env var
		process.env.REDSHIFT_NSEC = undefined;
	});

	afterEach(() => {
		// Restore environment
		process.env = { ...originalEnv };
		// Clean up
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	describe('getConfigDir', () => {
		it('returns custom dir when REDSHIFT_CONFIG_DIR is set', () => {
			process.env.REDSHIFT_CONFIG_DIR = '/custom/path';
			expect(getConfigDir()).toBe('/custom/path');
		});

		it('returns default ~/.redshift when no env var', () => {
			process.env.REDSHIFT_CONFIG_DIR = undefined;
			const homeDir = process.env.HOME || process.env.USERPROFILE || '';
			expect(getConfigDir()).toBe(join(homeDir, '.redshift'));
		});
	});

	describe('saveConfig / loadConfig', () => {
		it('saves and loads config correctly', async () => {
			const config: Config = {
				nsec: 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5',
				relays: ['wss://relay.damus.io', 'wss://nos.lol'],
				defaultProject: 'my-project',
			};

			await saveConfig(config);
			const loaded = await loadConfig();

			expect(loaded).toEqual(config);
		});

		it('returns empty config when file does not exist', async () => {
			const loaded = await loadConfig();
			expect(loaded).toEqual({});
		});

		it('creates config directory if it does not exist', async () => {
			const nestedDir = join(testDir, 'nested', 'config');
			process.env.REDSHIFT_CONFIG_DIR = nestedDir;

			await saveConfig({ nsec: 'nsec1test' });

			expect(existsSync(nestedDir)).toBe(true);
		});
	});

	describe('getPrivateKey', () => {
		it('returns nsec from REDSHIFT_NSEC env var (CI/CD mode)', async () => {
			const envNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
			process.env.REDSHIFT_NSEC = envNsec;

			const result = await getPrivateKey();

			expect(result).toEqual({ nsec: envNsec, source: 'env' });
		});

		it('returns nsec from config file when env var not set', async () => {
			const configNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
			await saveConfig({ nsec: configNsec });

			const result = await getPrivateKey();

			expect(result).toEqual({ nsec: configNsec, source: 'config' });
		});

		it('returns null when no nsec available', async () => {
			const result = await getPrivateKey();
			expect(result).toBeNull();
		});

		it('prefers env var over config file', async () => {
			const envNsec = 'nsec1envenvenvenvenvenvenvenvenvenvenvenvenvenvenvenvenvenvenv';
			const configNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

			process.env.REDSHIFT_NSEC = envNsec;
			await saveConfig({ nsec: configNsec });

			const result = await getPrivateKey();

			expect(result?.nsec).toBe(envNsec);
			expect(result?.source).toBe('env');
		});
	});

	describe('Project Config (redshift.yaml)', () => {
		it('saves and loads project config', async () => {
			const projectDir = join(testDir, 'my-project');
			mkdirSync(projectDir, { recursive: true });

			const projectConfig = {
				project: 'proj-123',
				environment: 'production',
				relays: ['wss://custom.relay'],
			};

			await saveProjectConfig(projectDir, projectConfig);
			const loaded = await loadProjectConfig(projectDir);

			expect(loaded).toEqual(projectConfig);
		});

		it('returns null when redshift.yaml does not exist', async () => {
			const loaded = await loadProjectConfig(testDir);
			expect(loaded).toBeNull();
		});

		it('throws on invalid YAML', async () => {
			const projectDir = join(testDir, 'bad-project');
			mkdirSync(projectDir, { recursive: true });
			const configPath = join(projectDir, 'redshift.yaml');
			await Bun.write(configPath, 'invalid: yaml: content: [');

			await expect(loadProjectConfig(projectDir)).rejects.toThrow();
		});
	});
});
