// @vitest-environment node
/**
 * Gift Wrap Integration Tests
 *
 * Tests the full flow of encrypting, publishing, fetching, and decrypting secrets
 * using NIP-59 Gift Wrap.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import {
	wrapSecrets,
	unwrapGiftWrap,
	NostrKinds,
	type SecretBundle,
	type NostrEvent,
} from '$lib/crypto';

describe('Gift Wrap Integration', () => {
	let privateKey: Uint8Array;
	let publicKey: string;

	beforeEach(() => {
		privateKey = generateSecretKey();
		publicKey = getPublicKey(privateKey);
	});

	describe('Secret Lifecycle', () => {
		it('creates gift wrap events that can be queried by p-tag', () => {
			const secrets: SecretBundle = { API_KEY: 'test123' };
			const dTag = 'myproject|production';

			const { event } = wrapSecrets(secrets, privateKey, dTag);

			// Gift wrap should be kind 1059
			expect(event.kind).toBe(NostrKinds.GIFT_WRAP);

			// Should have p-tag with recipient pubkey for relay routing
			const pTag = event.tags.find((t) => t[0] === 'p');
			expect(pTag).toBeDefined();
			expect(pTag?.[1]).toBe(publicKey);

			// Content should be encrypted (not contain plaintext)
			expect(event.content).not.toContain('API_KEY');
			expect(event.content).not.toContain('test123');
		});

		it('unwraps gift wrap to retrieve original secrets and d-tag', () => {
			const secrets: SecretBundle = {
				API_KEY: 'sk_live_abc123',
				DATABASE_URL: 'postgres://localhost/mydb',
			};
			const dTag = 'myproject|staging';

			const { event } = wrapSecrets(secrets, privateKey, dTag);
			const result = unwrapGiftWrap(event, privateKey);

			expect(result.secrets).toEqual(secrets);
			expect(result.dTag).toBe(dTag);
			expect(result.pubkey).toBe(publicKey);
		});

		it('newer events replace older ones with same d-tag', () => {
			const dTag = 'myproject|production';

			// Create first version
			const secrets1: SecretBundle = { API_KEY: 'old_key' };
			const { event: event1 } = wrapSecrets(secrets1, privateKey, dTag);

			// Simulate time passing
			const secrets2: SecretBundle = { API_KEY: 'new_key', NEW_VAR: 'added' };
			const { event: event2 } = wrapSecrets(secrets2, privateKey, dTag);

			// Unwrap both
			const result1 = unwrapGiftWrap(event1, privateKey);
			const result2 = unwrapGiftWrap(event2, privateKey);

			// Both have same d-tag
			expect(result1.dTag).toBe(dTag);
			expect(result2.dTag).toBe(dTag);

			// Second should be newer (or equal due to same-second creation)
			expect(result2.createdAt).toBeGreaterThanOrEqual(result1.createdAt);
		});
	});

	describe('Multiple Projects/Environments', () => {
		it('maintains separate secrets for different d-tags', () => {
			const prodSecrets: SecretBundle = { API_KEY: 'prod_key', DEBUG: 'false' };
			const devSecrets: SecretBundle = { API_KEY: 'dev_key', DEBUG: 'true' };

			const { event: prodEvent } = wrapSecrets(prodSecrets, privateKey, 'app|production');
			const { event: devEvent } = wrapSecrets(devSecrets, privateKey, 'app|development');

			const prodResult = unwrapGiftWrap(prodEvent, privateKey);
			const devResult = unwrapGiftWrap(devEvent, privateKey);

			expect(prodResult.dTag).toBe('app|production');
			expect(prodResult.secrets).toEqual(prodSecrets);

			expect(devResult.dTag).toBe('app|development');
			expect(devResult.secrets).toEqual(devSecrets);
		});

		it('can simulate fetching all secrets and grouping by d-tag', () => {
			// Simulate multiple gift wrap events from a relay
			const events: NostrEvent[] = [];

			// Project A - production
			events.push(wrapSecrets({ KEY1: 'a1' }, privateKey, 'projectA|prod').event);
			events.push(wrapSecrets({ KEY1: 'a2' }, privateKey, 'projectA|prod').event); // newer

			// Project A - dev
			events.push(wrapSecrets({ KEY1: 'dev1' }, privateKey, 'projectA|dev').event);

			// Project B - production
			events.push(wrapSecrets({ OTHER: 'b1' }, privateKey, 'projectB|prod').event);

			// Simulate the "get latest by d-tag" logic
			const latestByDTag = new Map<string, { secrets: SecretBundle; createdAt: number }>();

			for (const event of events) {
				const result = unwrapGiftWrap(event, privateKey);
				if (!result.dTag) continue;

				const existing = latestByDTag.get(result.dTag);
				if (!existing || result.createdAt >= existing.createdAt) {
					latestByDTag.set(result.dTag, {
						secrets: result.secrets,
						createdAt: result.createdAt,
					});
				}
			}

			// Should have 3 unique d-tags
			expect(latestByDTag.size).toBe(3);

			// projectA|prod should have the newer version
			const prodA = latestByDTag.get('projectA|prod');
			expect(prodA?.secrets).toEqual({ KEY1: 'a2' });

			// projectA|dev and projectB|prod should be present
			expect(latestByDTag.has('projectA|dev')).toBe(true);
			expect(latestByDTag.has('projectB|prod')).toBe(true);
		});
	});

	describe('Error Cases', () => {
		it('fails to unwrap events encrypted for different recipient', () => {
			const otherPrivateKey = generateSecretKey();

			const secrets: SecretBundle = { SECRET: 'data' };
			const { event } = wrapSecrets(secrets, privateKey, 'proj|env');

			// Try to unwrap with different key
			expect(() => unwrapGiftWrap(event, otherPrivateKey)).toThrow();
		});

		it('handles empty secret bundle (tombstone)', () => {
			const { event } = wrapSecrets({}, privateKey, 'proj|env');
			const result = unwrapGiftWrap(event, privateKey);

			expect(result.secrets).toEqual({});
			expect(result.dTag).toBe('proj|env');
		});
	});

	describe('Relay Query Simulation', () => {
		it('p-tag filter matches recipient pubkey', () => {
			const { event } = wrapSecrets({ KEY: 'value' }, privateKey, 'proj|env');

			// Simulate relay filter matching
			const pTag = event.tags.find((t) => t[0] === 'p');
			const filterPubkey = publicKey;

			// This is how relays filter: #p contains the pubkey
			expect(pTag?.[1]).toBe(filterPubkey);
		});

		it('events from different users have different p-tags', () => {
			const otherPrivateKey = generateSecretKey();
			const otherPublicKey = getPublicKey(otherPrivateKey);

			const { event: myEvent } = wrapSecrets({ KEY: 'mine' }, privateKey, 'proj|env');
			const { event: otherEvent } = wrapSecrets({ KEY: 'theirs' }, otherPrivateKey, 'proj|env');

			const myPTag = myEvent.tags.find((t) => t[0] === 'p');
			const otherPTag = otherEvent.tags.find((t) => t[0] === 'p');

			expect(myPTag?.[1]).toBe(publicKey);
			expect(otherPTag?.[1]).toBe(otherPublicKey);
			expect(myPTag?.[1]).not.toBe(otherPTag?.[1]);
		});
	});
});
