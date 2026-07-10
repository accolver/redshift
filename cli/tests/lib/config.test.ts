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
	getAuth,
	getConfigDir,
	getPrivateKey,
	loadConfig,
	loadProjectConfig,
	normalizeRelayUrls,
	redactConfig,
	resetConfig,
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

			expect(loaded).toEqual({
				...config,
				relays: ['wss://relay.damus.io/', 'wss://nos.lol/'],
			});
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

	describe('relay validation and redaction', () => {
		it('normalizes, deduplicates, and accepts only secure or loopback WebSockets', () => {
			expect(
				normalizeRelayUrls(['wss://relay.example', 'wss://relay.example/', 'ws://127.0.0.1:8080']),
			).toEqual(['wss://relay.example/', 'ws://127.0.0.1:8080/']);
			for (const relay of [
				'https://relay.example',
				'ws://relay.example',
				'wss://user:pass@relay.example',
				'not-a-url',
			]) {
				expect(() => normalizeRelayUrls([relay])).toThrow();
			}
		});

		it('rejects invalid relay URLs from global and project configuration', async () => {
			await expect(saveConfig({ relays: ['https://relay.example'] })).rejects.toThrow();
			const projectDir = join(testDir, 'unsafe-project');
			mkdirSync(projectDir, { recursive: true });
			await Bun.write(
				join(projectDir, 'redshift.yaml'),
				'project: safe-project\nenvironment: dev\nrelays:\n  - ws://relay.example\n',
			);
			await expect(loadProjectConfig(projectDir)).rejects.toThrow();
		});

		it('redacts every stored credential field', () => {
			expect(
				redactConfig({
					authMethod: 'bunker',
					nsec: 'nsec-secret',
					bunker: {
						bunkerPubkey: 'a'.repeat(64),
						relays: ['wss://relay.example'],
						clientSecretKey: 'client-secret',
						secret: 'pairing-secret',
					},
				}),
			).toMatchObject({
				nsec: '[REDACTED]',
				bunker: { clientSecretKey: '[REDACTED]', secret: '[REDACTED]' },
			});
		});

		it('resets auth, relays, and defaults', async () => {
			await saveConfig({
				nsec: 'nsec-secret',
				relays: ['wss://relay.example'],
				defaultProject: 'project',
				defaultEnvironment: 'dev',
			});
			await resetConfig();
			expect(await loadConfig()).toEqual({});
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

			expect(loaded).toEqual({ ...projectConfig, relays: ['wss://custom.relay/'] });
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

	describe('resolveAuth with REDSHIFT_BUNKER env', () => {
		const originalBunkerEnv = process.env.REDSHIFT_BUNKER;

		afterEach(() => {
			if (originalBunkerEnv !== undefined) {
				process.env.REDSHIFT_BUNKER = originalBunkerEnv;
			} else {
				delete process.env.REDSHIFT_BUNKER;
			}
		});

		it('generates a non-empty clientSecretKey from bunker env', async () => {
			process.env.REDSHIFT_BUNKER = 'bunker://abc123?relay=wss://relay.test.com&secret=mysecret';
			const auth = await getAuth();

			expect(auth).not.toBeNull();
			expect(auth!.method).toBe('bunker');
			expect(auth!.bunker!.clientSecretKey).toBeTruthy();
			expect(auth!.bunker!.clientSecretKey.length).toBeGreaterThan(0);
		});
	});
});
