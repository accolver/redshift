/**
 * Login Command Tests
 *
 * L2: Function-Author - Tests for authentication logic
 * L5: Journey-Validator - User authentication flow
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nsecEncode } from 'nostr-tools/nip19';
import { generateSecretKey } from 'nostr-tools/pure';

// We need to test the helper functions that are exported
import {
	loginCommand,
	persistNsecCredential,
	sanitizeBunkerError,
	tryAuth,
	validateBunkerArgSafety,
} from '../../src/commands/login';
import { clearAuth, loadConfig, saveConfig } from '../../src/lib/config';

describe('Login Command', () => {
	const testDir = join(tmpdir(), `redshift-login-test-${Date.now()}`);
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
		delete process.env.REDSHIFT_NSEC;
		delete process.env.REDSHIFT_BUNKER;
	});

	afterEach(() => {
		// Restore environment
		process.env = { ...originalEnv };
		// Clean up
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	describe('tryAuth', () => {
		it('returns null when not logged in', async () => {
			const result = await tryAuth();
			expect(result).toBeNull();
		});

		it('returns auth from config file when nsec is stored', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);

			await saveConfig({ authMethod: 'nsec', nsec });

			const result = await tryAuth();

			expect(result).not.toBeNull();
			expect(result?.nsec).toBe(nsec);
			expect(result?.npub).toMatch(/^npub1/);
			expect(result?.privateKey).toBeInstanceOf(Uint8Array);
		});

		it('returns auth from REDSHIFT_NSEC env var', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);

			process.env.REDSHIFT_NSEC = nsec;

			const result = await tryAuth();

			expect(result).not.toBeNull();
			expect(result?.nsec).toBe(nsec);
		});

		it('prefers env var over config file', async () => {
			const sk1 = generateSecretKey();
			const nsec1 = nsecEncode(sk1);
			const sk2 = generateSecretKey();
			const nsec2 = nsecEncode(sk2);

			await saveConfig({ authMethod: 'nsec', nsec: nsec1 });
			process.env.REDSHIFT_NSEC = nsec2;

			const result = await tryAuth();

			expect(result?.nsec).toBe(nsec2);
		});

		it('returns null for invalid nsec in config', async () => {
			await saveConfig({ authMethod: 'nsec', nsec: 'invalid-nsec' });

			const result = await tryAuth();

			expect(result).toBeNull();
		});

		it('returns null for bunker auth (not yet supported in tryAuth)', async () => {
			await saveConfig({
				authMethod: 'bunker',
				bunker: {
					bunkerPubkey: 'abc123',
					relays: ['wss://relay.test'],
					clientSecretKey: 'def456',
				},
			});

			const result = await tryAuth();

			expect(result).toBeNull();
		});
	});

	describe('credential custody', () => {
		it('does not write plaintext nsec when the keychain is unavailable', async () => {
			const nsec = nsecEncode(generateSecretKey());
			await expect(persistNsecCredential(nsec, async () => false)).rejects.toThrow('keychain');
			expect(await loadConfig()).toEqual({});
		});

		it('records keychain auth without writing the nsec to config', async () => {
			const nsec = nsecEncode(generateSecretKey());
			await persistNsecCredential(nsec, async () => true);
			expect(await loadConfig()).toEqual({ authMethod: 'nsec' });
		});

		it('redacts bunker URI query credentials from failures', () => {
			const error = new Error(
				'Could not parse bunker://abc?relay=wss%3A%2F%2Frelay.test&secret=pairing-secret',
			);
			const message = sanitizeBunkerError(error);
			expect(message).not.toContain('pairing-secret');
			expect(message).toContain('bunker://abc?[REDACTED]');
		});

		it('rejects secret-bearing bunker URIs passed through argv', async () => {
			await expect(
				loginCommand({
					force: true,
					bunker: 'bunker://abc?relay=wss%3A%2F%2Frelay.test&secret=pairing-secret',
				}),
			).rejects.toThrow('--bunker-stdin');
			expect(() =>
				validateBunkerArgSafety('bunker://abc?relay=wss%3A%2F%2Frelay.test&secret=pairing-secret'),
			).toThrow('--bunker-stdin');
			expect(() => validateBunkerArgSafety('not-a-uri?secret=pairing-secret')).toThrow(
				'--bunker-stdin',
			);
			expect(() =>
				validateBunkerArgSafety('bunker://abc?relay=wss%3A%2F%2Frelay.test'),
			).not.toThrow();
		});
	});

	describe('clearAuth', () => {
		it('clears stored nsec from config', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);

			await saveConfig({ authMethod: 'nsec', nsec });

			// Verify it's stored
			let config = await loadConfig();
			expect(config.nsec).toBe(nsec);

			// Clear auth
			await clearAuth();

			// Verify it's cleared
			config = await loadConfig();
			expect(config.nsec).toBeUndefined();
			expect(config.authMethod).toBeUndefined();
		});

		it('clears bunker auth from config', async () => {
			await saveConfig({
				authMethod: 'bunker',
				bunker: {
					bunkerPubkey: 'abc123',
					relays: ['wss://relay.test'],
					clientSecretKey: 'def456',
				},
			});

			await clearAuth();

			const config = await loadConfig();
			expect(config.bunker).toBeUndefined();
			expect(config.authMethod).toBeUndefined();
		});
	});
});

describe('nsec validation edge cases', () => {
	const testDir = join(tmpdir(), `redshift-nsec-test-${Date.now()}`);

	beforeEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		mkdirSync(testDir, { recursive: true });
		process.env.REDSHIFT_CONFIG_DIR = testDir;
		delete process.env.REDSHIFT_NSEC;
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	it('rejects nsec with wrong prefix', async () => {
		process.env.REDSHIFT_NSEC = 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m';

		const result = await tryAuth();

		expect(result).toBeNull();
	});

	it('rejects empty nsec', async () => {
		process.env.REDSHIFT_NSEC = '';

		const result = await tryAuth();

		expect(result).toBeNull();
	});

	it('rejects nsec with invalid checksum', async () => {
		// Valid format but bad checksum (last char changed)
		process.env.REDSHIFT_NSEC = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe6';

		const result = await tryAuth();

		expect(result).toBeNull();
	});
});
