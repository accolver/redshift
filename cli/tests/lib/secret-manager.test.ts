/**
 * SecretManager Tests - TDD
 *
 * L2: Function-Author - Secret management operations
 * L4: Integration-Contractor - NIP-59 protocol compliance
 */

import { describe, expect, it } from 'bun:test';
import { generateSecretKey } from 'nostr-tools/pure';
import {
	SecretManager,
	extractProjects,
	injectSecrets,
	mergeSecrets,
} from '../../src/lib/secret-manager';
import type { SecretBundle } from '../../src/lib/types';

describe('SecretManager', () => {
	// Generate test keys
	const testPrivateKey = new Uint8Array(32);
	crypto.getRandomValues(testPrivateKey);

	describe('constructor', () => {
		it('creates manager with private key', () => {
			const manager = new SecretManager(testPrivateKey);
			expect(manager).toBeDefined();
		});
	});

	describe('local operations (no relay)', () => {
		it('wraps and unwraps secrets locally', async () => {
			const manager = new SecretManager(testPrivateKey);
			const secrets: SecretBundle = {
				API_KEY: 'sk_test_123',
				DEBUG: 'true',
			};

			const wrapped = await manager.wrapSecrets(secrets, 'proj|dev');
			const unwrapped = await manager.unwrapSecrets(wrapped.event);

			expect(unwrapped).toEqual(secrets);
		});
	});

	describe('disconnect', () => {
		it('zeroes private key memory on disconnect', () => {
			const privateKey = generateSecretKey();
			const manager = new SecretManager(privateKey);

			// Key should be non-zero before disconnect
			expect(privateKey.some((b) => b !== 0)).toBe(true);

			manager.disconnect();

			// After disconnect, the key bytes should be zeroed
			expect(privateKey.every((b) => b === 0)).toBe(true);
		});
	});
});

describe('injectSecrets', () => {
	it('injects string secrets into environment', () => {
		const baseEnv = { PATH: '/usr/bin', HOME: '/home/user' };
		const secrets: SecretBundle = {
			API_KEY: 'secret123',
			DATABASE_URL: 'postgres://localhost',
		};

		const result = injectSecrets(baseEnv, secrets);

		expect(result.PATH).toBe('/usr/bin');
		expect(result.HOME).toBe('/home/user');
		expect(result.API_KEY).toBe('secret123');
		expect(result.DATABASE_URL).toBe('postgres://localhost');
	});

	it('does not mutate original environment', () => {
		const baseEnv = { EXISTING: 'value' };
		const secrets: SecretBundle = { NEW: 'secret' };

		injectSecrets(baseEnv, secrets);

		expect(baseEnv).toEqual({ EXISTING: 'value' });
	});

	it('secrets override existing env vars', () => {
		const baseEnv = { API_KEY: 'old_value' };
		const secrets: SecretBundle = { API_KEY: 'new_value' };

		const result = injectSecrets(baseEnv, secrets);

		expect(result.API_KEY).toBe('new_value');
	});
});

describe('mergeSecrets', () => {
	it('merges two secret bundles', () => {
		const base: SecretBundle = { A: '1', B: '2' };
		const overlay: SecretBundle = { B: '3', C: '4' };

		const result = mergeSecrets(base, overlay);

		expect(result).toEqual({ A: '1', B: '3', C: '4' });
	});

	it('returns copy when overlay is empty', () => {
		const base: SecretBundle = { A: '1' };
		const result = mergeSecrets(base, {});

		expect(result).toEqual({ A: '1' });
		expect(result).not.toBe(base); // Should be new object
	});
});

describe('extractProjects', () => {
	it('extracts unique project IDs from d-tags', () => {
		const dTags = ['proj1|dev', 'proj1|prod', 'proj2|dev', 'proj3|staging'];
		const projects = extractProjects(dTags);

		expect(projects).toEqual(['proj1', 'proj2', 'proj3']);
	});

	it('returns empty array for empty input', () => {
		expect(extractProjects([])).toEqual([]);
	});

	it('ignores invalid d-tags', () => {
		const dTags = ['proj1|dev', 'invalid', '', 'proj2|prod'];
		const projects = extractProjects(dTags);

		expect(projects).toEqual(['proj1', 'proj2']);
	});
});
