/**
 * Auth Context & SecretManager Signer Integration Tests
 *
 * Tests that SecretManager works correctly with both NsecSigner
 * and the NostrSigner interface (simulating bunker auth).
 *
 * L2: Function-Author - Tests for unified auth interface
 * L4: Integration-Contractor - NostrSigner contract compliance
 */

import { describe, expect, it } from 'bun:test';
import { wrapSecrets } from '@redshift/crypto';
import { npubEncode } from 'nostr-tools/nip19';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { SecretManager } from '../../src/lib/secret-manager';
import { NsecSigner } from '../../src/lib/signer';
import type { NostrSigner } from '../../src/lib/types';

describe('SecretManager with NostrSigner', () => {
	describe('constructor', () => {
		it('accepts a Uint8Array private key (backward compat)', () => {
			const sk = generateSecretKey();
			const manager = new SecretManager(sk);

			expect(manager.getPublicKey()).toBe(getPublicKey(sk));
		});

		it('accepts a NostrSigner', () => {
			const sk = generateSecretKey();
			const signer = new NsecSigner(sk);
			const manager = new SecretManager(signer);

			expect(manager.getPublicKey()).toBe(getPublicKey(sk));
		});
	});

	describe('wrapSecretsAsync', () => {
		it('wraps secrets with NsecSigner', async () => {
			const sk = generateSecretKey();
			const signer = new NsecSigner(sk);
			const manager = new SecretManager(signer);

			const secrets = { API_KEY: 'test-value' };
			const dTag = 'my-project|dev';

			const result = await manager.wrapSecretsAsync(secrets, dTag);

			expect(result.event).toBeDefined();
			expect(result.event.kind).toBe(1059);
			expect(result.event.id).toBeDefined();
			expect(result.event.sig).toBeDefined();
			expect(result.rumor).toBeDefined();
			expect(result.rumor.kind).toBe(30078);
		});

		it('wraps secrets with raw Uint8Array', async () => {
			const sk = generateSecretKey();
			const manager = new SecretManager(sk);

			const secrets = { DB_URL: 'postgres://localhost' };
			const dTag = 'my-project|prod';

			const result = await manager.wrapSecretsAsync(secrets, dTag);

			expect(result.event).toBeDefined();
			expect(result.event.kind).toBe(1059);
		});
	});

	describe('unwrapWithMetadataAsync', () => {
		it('unwraps events wrapped with NsecSigner', async () => {
			const sk = generateSecretKey();
			const signer = new NsecSigner(sk);
			const manager = new SecretManager(signer);

			const secrets = { SECRET: 'value123' };
			const dTag = 'test-project|staging';

			// Wrap with signer
			const { event } = await manager.wrapSecretsAsync(secrets, dTag);

			// Unwrap with same signer
			const result = await manager.unwrapWithMetadataAsync(event);

			expect(result.secrets).toEqual(secrets);
			expect(result.dTag).toBe(dTag);
		});

		it('unwraps events wrapped with raw key', async () => {
			const sk = generateSecretKey();

			// Wrap with raw key (using @redshift/crypto directly)
			const secrets = { KEY: 'raw-value' };
			const dTag = 'raw-project|dev';
			const { event } = wrapSecrets(secrets, sk, dTag);

			// Unwrap with NsecSigner
			const signer = new NsecSigner(sk);
			const manager = new SecretManager(signer);
			const result = await manager.unwrapWithMetadataAsync(event);

			expect(result.secrets).toEqual(secrets);
			expect(result.dTag).toBe(dTag);
		});
	});

	describe('sync methods with signer', () => {
		it('wrapSecrets throws when using signer (sync not supported)', () => {
			const sk = generateSecretKey();
			const signer = new NsecSigner(sk);
			const manager = new SecretManager(signer);

			expect(() => manager.wrapSecrets({ KEY: 'val' }, 'proj|dev')).toThrow('private key');
		});

		it('unwrapSecrets throws when using signer (sync not supported)', async () => {
			const sk = generateSecretKey();
			const { event } = wrapSecrets({ KEY: 'val' }, sk, 'proj|dev');

			const signer = new NsecSigner(sk);
			const manager = new SecretManager(signer);

			expect(() => manager.unwrapSecrets(event)).toThrow('private key');
		});

		it('unwrapWithMetadata throws when using signer (sync not supported)', async () => {
			const sk = generateSecretKey();
			const { event } = wrapSecrets({ KEY: 'val' }, sk, 'proj|dev');

			const signer = new NsecSigner(sk);
			const manager = new SecretManager(signer);

			expect(() => manager.unwrapWithMetadata(event)).toThrow('private key');
		});
	});
});

describe('Mock BunkerSigner as NostrSigner', () => {
	/**
	 * Simulates a bunker signer using a local key.
	 * This tests that the NostrSigner interface works correctly
	 * when backed by async operations (as a real bunker would be).
	 */
	function createMockBunkerSigner(sk: Uint8Array): NostrSigner {
		const realSigner = new NsecSigner(sk);
		return {
			pubkey: realSigner.pubkey,
			// Add artificial async delay to simulate network round-trip
			async signEvent(event) {
				await new Promise((resolve) => setTimeout(resolve, 1));
				return realSigner.signEvent(event);
			},
			async encrypt(pubkey, plaintext) {
				await new Promise((resolve) => setTimeout(resolve, 1));
				return realSigner.encrypt(pubkey, plaintext);
			},
			async decrypt(pubkey, ciphertext) {
				await new Promise((resolve) => setTimeout(resolve, 1));
				return realSigner.decrypt(pubkey, ciphertext);
			},
			async close() {
				// No-op for mock
			},
		};
	}

	it('SecretManager works with mock bunker signer', async () => {
		const sk = generateSecretKey();
		const mockSigner = createMockBunkerSigner(sk);
		const manager = new SecretManager(mockSigner);

		expect(manager.getPublicKey()).toBe(getPublicKey(sk));

		const secrets = { BUNKER_SECRET: 'remote-value' };
		const dTag = 'bunker-project|dev';

		// Wrap with mock bunker signer
		const { event } = await manager.wrapSecretsAsync(secrets, dTag);

		expect(event.kind).toBe(1059);
		expect(event.id).toBeDefined();

		// Unwrap with same mock bunker signer
		const result = await manager.unwrapWithMetadataAsync(event);

		expect(result.secrets).toEqual(secrets);
		expect(result.dTag).toBe(dTag);
	});

	it('cross-compatibility: wrap with raw key, unwrap with signer', async () => {
		const sk = generateSecretKey();

		// Wrap with raw key
		const secrets = { CROSS_KEY: 'cross-value' };
		const dTag = 'cross-project|prod';
		const { event } = wrapSecrets(secrets, sk, dTag);

		// Unwrap with mock bunker signer
		const mockSigner = createMockBunkerSigner(sk);
		const manager = new SecretManager(mockSigner);
		const result = await manager.unwrapWithMetadataAsync(event);

		expect(result.secrets).toEqual(secrets);
		expect(result.dTag).toBe(dTag);
	});

	it('cross-compatibility: wrap with signer, unwrap with raw key', async () => {
		const sk = generateSecretKey();

		// Wrap with mock bunker signer
		const mockSigner = createMockBunkerSigner(sk);
		const signerManager = new SecretManager(mockSigner);
		const secrets = { SIGNER_KEY: 'signer-value' };
		const dTag = 'signer-project|staging';
		const { event } = await signerManager.wrapSecretsAsync(secrets, dTag);

		// Unwrap with raw key
		const rawManager = new SecretManager(sk);
		const result = await rawManager.unwrapWithMetadataAsync(event);

		expect(result.secrets).toEqual(secrets);
		expect(result.dTag).toBe(dTag);
	});
});

describe('AuthContext npub format', () => {
	it('NsecSigner pubkey matches npub encoding', () => {
		const sk = generateSecretKey();
		const signer = new NsecSigner(sk);
		const expectedNpub = npubEncode(getPublicKey(sk));

		// Verify the pubkey can be encoded to npub
		const npub = npubEncode(signer.pubkey);
		expect(npub).toBe(expectedNpub);
		expect(npub).toMatch(/^npub1/);
	});
});
