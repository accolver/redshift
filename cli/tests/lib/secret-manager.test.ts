/**
 * SecretManager Tests - TDD
 *
 * L2: Function-Author - Secret management operations
 * L4: Integration-Contractor - NIP-59 protocol compliance
 */

import { describe, expect, it } from 'bun:test';
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
				DEBUG: true,
			};

			const wrapped = await manager.wrapSecrets(secrets, 'proj|dev');
			const unwrapped = await manager.unwrapSecrets(wrapped.event);

			expect(unwrapped).toEqual(secrets);
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

	it('converts numbers to strings', () => {
		const result = injectSecrets({}, { PORT: 3000, TIMEOUT: 5000 });

		expect(result.PORT).toBe('3000');
		expect(result.TIMEOUT).toBe('5000');
	});

	it('converts booleans to strings', () => {
		const result = injectSecrets({}, { DEBUG: true, VERBOSE: false });

		expect(result.DEBUG).toBe('true');
		expect(result.VERBOSE).toBe('false');
	});

	it('JSON.stringifies objects and arrays', () => {
		const secrets: SecretBundle = {
			FEATURE_FLAGS: { new_ui: true, beta: false },
			ALLOWED_ORIGINS: ['http://localhost', 'https://example.com'],
		};

		const result = injectSecrets({}, secrets);

		expect(result.FEATURE_FLAGS).toBe('{"new_ui":true,"beta":false}');
		expect(result.ALLOWED_ORIGINS).toBe('["http://localhost","https://example.com"]');
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
