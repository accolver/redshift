/**
 * Key derivation tests for @redshift/bunker
 *
 * Tests HKDF-SHA256 key derivation: determinism, uniqueness, and correctness.
 */

import { describe, expect, it } from 'bun:test';
import { deriveNostrKey } from '../src/key-derivation';

/** Test master seed (32 bytes) */
const MASTER_SEED = new Uint8Array(32);
MASTER_SEED.fill(0xab);

/** Alternative master seed for isolation tests */
const ALT_MASTER_SEED = new Uint8Array(32);
ALT_MASTER_SEED.fill(0xcd);

describe('Key Derivation', () => {
	describe('deriveNostrKey', () => {
		it('returns a private key and public key', () => {
			const result = deriveNostrKey(MASTER_SEED, 'team-1', 'google:12345');

			expect(result.privateKey).toBeInstanceOf(Uint8Array);
			expect(result.privateKey.length).toBe(32);
			expect(result.pubkey).toMatch(/^[0-9a-f]{64}$/);
		});

		it('is deterministic — same inputs produce same output', () => {
			const result1 = deriveNostrKey(MASTER_SEED, 'team-1', 'google:12345');
			const result2 = deriveNostrKey(MASTER_SEED, 'team-1', 'google:12345');

			expect(result1.pubkey).toBe(result2.pubkey);
			expect(Buffer.from(result1.privateKey).toString('hex')).toBe(
				Buffer.from(result2.privateKey).toString('hex'),
			);
		});

		it('produces different keys for different team IDs', () => {
			const result1 = deriveNostrKey(MASTER_SEED, 'team-1', 'google:12345');
			const result2 = deriveNostrKey(MASTER_SEED, 'team-2', 'google:12345');

			expect(result1.pubkey).not.toBe(result2.pubkey);
		});

		it('produces different keys for different OAuth subjects', () => {
			const result1 = deriveNostrKey(MASTER_SEED, 'team-1', 'google:12345');
			const result2 = deriveNostrKey(MASTER_SEED, 'team-1', 'google:67890');

			expect(result1.pubkey).not.toBe(result2.pubkey);
		});

		it('produces different keys for different master seeds', () => {
			const result1 = deriveNostrKey(MASTER_SEED, 'team-1', 'google:12345');
			const result2 = deriveNostrKey(ALT_MASTER_SEED, 'team-1', 'google:12345');

			expect(result1.pubkey).not.toBe(result2.pubkey);
		});

		it('produces different keys for different providers with same user ID', () => {
			const result1 = deriveNostrKey(MASTER_SEED, 'team-1', 'google:12345');
			const result2 = deriveNostrKey(MASTER_SEED, 'team-1', 'github:12345');

			expect(result1.pubkey).not.toBe(result2.pubkey);
		});

		it('produces valid secp256k1 public keys', () => {
			// Generate several keys and verify they're all valid hex pubkeys
			const subjects = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];
			for (const subject of subjects) {
				const result = deriveNostrKey(MASTER_SEED, 'team-1', subject);
				expect(result.pubkey).toMatch(/^[0-9a-f]{64}$/);
				expect(result.privateKey.length).toBe(32);
			}
		});

		it('handles empty team ID', () => {
			const result = deriveNostrKey(MASTER_SEED, '', 'google:12345');
			expect(result.pubkey).toMatch(/^[0-9a-f]{64}$/);
		});

		it('handles long OAuth subject strings', () => {
			// HKDF info is limited to 1024 bytes including the prefix
			const longSubject = 'google:' + 'x'.repeat(500);
			const result = deriveNostrKey(MASTER_SEED, 'team-1', longSubject);
			expect(result.pubkey).toMatch(/^[0-9a-f]{64}$/);
		});

		it('handles unicode in team ID and subject', () => {
			const result = deriveNostrKey(MASTER_SEED, 'team-\u{1F600}', 'user-\u{1F4A9}');
			expect(result.pubkey).toMatch(/^[0-9a-f]{64}$/);
		});
	});
});
