/**
 * Keychain Integration Tests with Config/Auth Flow
 *
 * L4: Integration-Contractor - Tests keychain integration with config module
 *
 * These tests verify that keychain works correctly with the authentication
 * flow in config.ts and login.ts
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { npubEncode, nsecEncode } from 'nostr-tools/nip19';

import { tryAuth } from '../../src/commands/login';
import { clearAuth, getAuth, getPrivateKey, loadConfig, saveConfig } from '../../src/lib/config';
import {
	deleteNsecFromKeychain,
	getNsecFromKeychain,
	isKeychainAvailable,
	storeNsecInKeychain,
} from '../../src/lib/keychain';

describe('Keychain + Config Integration', () => {
	const testDir = join(tmpdir(), `redshift-keychain-integration-${Date.now()}`);
	const originalEnv = { ...process.env };

	beforeEach(async () => {
		// Clean test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		mkdirSync(testDir, { recursive: true });

		// Set test config directory
		process.env.REDSHIFT_CONFIG_DIR = testDir;
		// Clear any existing env vars
		delete process.env.REDSHIFT_NSEC;
		delete process.env.REDSHIFT_BUNKER;

		// Clean keychain
		await deleteNsecFromKeychain();
	});

	afterEach(async () => {
		// Restore environment
		process.env = { ...originalEnv };
		// Clean up directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		// Clean keychain
		await deleteNsecFromKeychain();
	});

	describe('getPrivateKey priority', () => {
		it('returns env var first (highest priority)', async () => {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);

			// Store in both keychain and config
			await storeNsecInKeychain('keychain-nsec');
			await saveConfig({ authMethod: 'nsec', nsec: 'config-nsec' });

			// Set env var
			process.env.REDSHIFT_NSEC = nsec;

			const result = await getPrivateKey();

			expect(result).not.toBeNull();
			expect(result?.nsec).toBe(nsec);
			expect(result?.source).toBe('env');
		});

		it('returns keychain second (when env not set)', async () => {
			const available = await isKeychainAvailable();

			if (!available) {
				console.log('Keychain not available, skipping priority test');
				return;
			}

			const sk = generateSecretKey();
			const keychainNsec = nsecEncode(sk);

			// Store in both keychain and config
			await storeNsecInKeychain(keychainNsec);
			await saveConfig({ authMethod: 'nsec', nsec: 'config-nsec' });

			const result = await getPrivateKey();

			expect(result).not.toBeNull();
			expect(result?.nsec).toBe(keychainNsec);
			expect(result?.source).toBe('keychain');
		});

		it('returns config file third (when keychain empty)', async () => {
			const sk = generateSecretKey();
			const configNsec = nsecEncode(sk);

			// Only store in config (keychain empty)
			await deleteNsecFromKeychain();
			await saveConfig({ authMethod: 'nsec', nsec: configNsec });

			const result = await getPrivateKey();

			expect(result).not.toBeNull();
			expect(result?.nsec).toBe(configNsec);
			expect(result?.source).toBe('config');
		});

		it('returns null when nothing configured', async () => {
			await deleteNsecFromKeychain();
			// No config file, no env var

			const result = await getPrivateKey();

			expect(result).toBeNull();
		});
	});

	describe('getAuth priority', () => {
		it('prefers env over keychain over config', async () => {
			const available = await isKeychainAvailable();

			const envSk = generateSecretKey();
			const envNsec = nsecEncode(envSk);

			const keychainSk = generateSecretKey();
			const keychainNsec = nsecEncode(keychainSk);

			const configSk = generateSecretKey();
			const configNsec = nsecEncode(configSk);

			// Set up all three sources
			if (available) {
				await storeNsecInKeychain(keychainNsec);
			}
			await saveConfig({ authMethod: 'nsec', nsec: configNsec });
			process.env.REDSHIFT_NSEC = envNsec;

			const result = await getAuth();

			expect(result?.method).toBe('nsec');
			expect(result?.nsec).toBe(envNsec);
			expect(result?.source).toBe('env');

			// Clear env, should get keychain
			delete process.env.REDSHIFT_NSEC;
			const result2 = await getAuth();

			if (available) {
				expect(result2?.nsec).toBe(keychainNsec);
				expect(result2?.source).toBe('keychain');
			} else {
				expect(result2?.nsec).toBe(configNsec);
				expect(result2?.source).toBe('config');
			}
		});

		it('returns keychain auth with correct source', async () => {
			const available = await isKeychainAvailable();

			if (!available) {
				console.log('Keychain not available, skipping source test');
				return;
			}

			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);

			await storeNsecInKeychain(nsec);

			const result = await getAuth();

			expect(result?.source).toBe('keychain');
			expect(result?.method).toBe('nsec');
			expect(result?.nsec).toBe(nsec);
		});
	});

	describe('clearAuth clears both keychain and config', () => {
		it('clears nsec from keychain when calling clearAuth', async () => {
			const available = await isKeychainAvailable();

			if (!available) {
				console.log('Keychain not available, skipping clearAuth test');
				return;
			}

			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);

			// Store in keychain
			await storeNsecInKeychain(nsec);

			// Verify it's there
			const before = await getNsecFromKeychain();
			expect(before).toBe(nsec);

			// Clear auth
			await clearAuth();

			// Verify keychain is cleared
			const after = await getNsecFromKeychain();
			expect(after).toBeNull();
		});

		it('clears both keychain and config file', async () => {
			const available = await isKeychainAvailable();
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);

			// Store in both
			if (available) {
				await storeNsecInKeychain(nsec);
			}
			await saveConfig({ authMethod: 'nsec', nsec });

			// Clear auth
			await clearAuth();

			// Verify both are cleared
			if (available) {
				const keychainNsec = await getNsecFromKeychain();
				expect(keychainNsec).toBeNull();
			}

			const config = await loadConfig();
			expect(config.nsec).toBeUndefined();
			expect(config.authMethod).toBeUndefined();
		});
	});

	describe('tryAuth with keychain', () => {
		it('returns valid auth from keychain', async () => {
			const available = await isKeychainAvailable();

			if (!available) {
				console.log('Keychain not available, skipping tryAuth test');
				return;
			}

			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			const expectedPubkey = getPublicKey(sk);
			const expectedNpub = npubEncode(expectedPubkey);

			await storeNsecInKeychain(nsec);

			const result = await tryAuth();

			expect(result).not.toBeNull();
			expect(result?.nsec).toBe(nsec);
			expect(result?.npub).toBe(expectedNpub);
			expect(result?.privateKey).toBeInstanceOf(Uint8Array);
		});

		it('returns null for invalid nsec in keychain', async () => {
			const available = await isKeychainAvailable();

			if (!available) {
				console.log('Keychain not available, skipping invalid nsec test');
				return;
			}

			// Store invalid nsec
			await storeNsecInKeychain('invalid-not-a-real-nsec');

			const result = await tryAuth();

			expect(result).toBeNull();
		});
	});
});

describe('Keychain migration scenarios', () => {
	const testDir = join(tmpdir(), `redshift-keychain-migration-${Date.now()}`);
	const originalEnv = { ...process.env };

	beforeEach(async () => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		mkdirSync(testDir, { recursive: true });
		process.env.REDSHIFT_CONFIG_DIR = testDir;
		delete process.env.REDSHIFT_NSEC;
		await deleteNsecFromKeychain();
	});

	afterEach(async () => {
		process.env = { ...originalEnv };
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		await deleteNsecFromKeychain();
	});

	it('user with existing config file gets migrated to keychain on next login', async () => {
		const available = await isKeychainAvailable();

		if (!available) {
			console.log('Keychain not available, skipping migration test');
			return;
		}

		const oldSk = generateSecretKey();
		const oldNsec = nsecEncode(oldSk);

		// Simulate old config file auth
		await saveConfig({ authMethod: 'nsec', nsec: oldNsec });

		// Verify old auth works
		const oldAuth = await tryAuth();
		expect(oldAuth?.nsec).toBe(oldNsec);

		// Now simulate "re-login" by storing in keychain
		const newSk = generateSecretKey();
		const newNsec = nsecEncode(newSk);

		await storeNsecInKeychain(newNsec);
		// Clear nsec from config (simulating login.ts behavior)
		const config = await loadConfig();
		delete config.nsec;
		await saveConfig(config);

		// New auth should come from keychain
		const newAuth = await tryAuth();
		expect(newAuth?.nsec).toBe(newNsec);
	});

	it('handles case where keychain has old key and config has new key', async () => {
		const available = await isKeychainAvailable();

		if (!available) {
			console.log('Keychain not available, skipping precedence test');
			return;
		}

		const keychainSk = generateSecretKey();
		const keychainNsec = nsecEncode(keychainSk);

		const configSk = generateSecretKey();
		const configNsec = nsecEncode(configSk);

		// Both have different keys
		await storeNsecInKeychain(keychainNsec);
		await saveConfig({ authMethod: 'nsec', nsec: configNsec });

		// Keychain should win
		const result = await getPrivateKey();
		expect(result?.nsec).toBe(keychainNsec);
		expect(result?.source).toBe('keychain');
	});
});

describe('Keychain edge cases', () => {
	const testDir = join(tmpdir(), `redshift-keychain-edge-${Date.now()}`);

	beforeEach(async () => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		mkdirSync(testDir, { recursive: true });
		process.env.REDSHIFT_CONFIG_DIR = testDir;
		delete process.env.REDSHIFT_NSEC;
		await deleteNsecFromKeychain();
	});

	afterEach(async () => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		await deleteNsecFromKeychain();
	});

	it('bunker auth in config is not affected by keychain nsec', async () => {
		const available = await isKeychainAvailable();

		// Store nsec in keychain
		if (available) {
			const sk = generateSecretKey();
			const nsec = nsecEncode(sk);
			await storeNsecInKeychain(nsec);
		}

		// Store bunker auth in config
		await saveConfig({
			authMethod: 'bunker',
			bunker: {
				bunkerPubkey: 'abc123',
				relays: ['wss://relay.test'],
				clientSecretKey: 'def456',
			},
		});

		// getAuth should still find nsec from keychain (it checks nsec sources first)
		const result = await getAuth();

		if (available) {
			// If keychain is available, nsec from keychain takes precedence
			expect(result?.method).toBe('nsec');
			expect(result?.source).toBe('keychain');
		} else {
			// If no keychain, bunker from config
			expect(result?.method).toBe('bunker');
			expect(result?.source).toBe('config');
		}
	});

	it('handles rapid auth checks without race conditions', async () => {
		const available = await isKeychainAvailable();

		if (!available) {
			console.log('Keychain not available, skipping rapid check test');
			return;
		}

		const sk = generateSecretKey();
		const nsec = nsecEncode(sk);

		await storeNsecInKeychain(nsec);

		// Fire 10 concurrent auth checks
		const results = await Promise.all([
			tryAuth(),
			tryAuth(),
			tryAuth(),
			tryAuth(),
			tryAuth(),
			tryAuth(),
			tryAuth(),
			tryAuth(),
			tryAuth(),
			tryAuth(),
		]);

		// All should return the same valid auth
		expect(results.every((r) => r !== null)).toBe(true);
		expect(results.every((r) => r?.nsec === nsec)).toBe(true);
	});
});
