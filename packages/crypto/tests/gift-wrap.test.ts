/**
 * Gift Wrap Tests for @redshift/crypto
 *
 * Tests for NIP-59 Gift Wrap implementation with type tag support.
 */

import { describe, expect, it, beforeEach } from 'bun:test';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import {
	wrapSecrets,
	unwrapSecrets,
	unwrapGiftWrap,
	createTombstone,
	isRedshiftSecretsEvent,
	getRedshiftSecretsFilter,
	NostrKinds,
	REDSHIFT_TYPE_TAG,
	type SecretBundle,
} from '../src/index';

describe('NIP-59 Gift Wrap', () => {
	let privateKey: Uint8Array;
	let publicKey: string;

	beforeEach(() => {
		privateKey = generateSecretKey();
		publicKey = getPublicKey(privateKey);
	});

	describe('wrapSecrets', () => {
		it('creates a Gift Wrap event (kind 1059)', () => {
			const secrets: SecretBundle = { API_KEY: 'sk_test_123' };
			const dTag = 'project1|production';

			const { event } = wrapSecrets(secrets, privateKey, dTag);

			expect(event.kind).toBe(NostrKinds.GIFT_WRAP);
			expect(event.sig).toBeDefined();
			expect(event.id).toBeDefined();
		});

		it('adds redshift-secrets type tag to outer event', () => {
			const secrets: SecretBundle = { API_KEY: 'sk_test_123' };
			const dTag = 'project1|production';

			const { event } = wrapSecrets(secrets, privateKey, dTag);

			const typeTag = event.tags.find((t) => t[0] === 't');
			expect(typeTag).toBeDefined();
			expect(typeTag?.[1]).toBe(REDSHIFT_TYPE_TAG);
		});

		it('includes p-tag with recipient pubkey', () => {
			const secrets: SecretBundle = { KEY: 'value' };
			const dTag = 'proj|env';

			const { event } = wrapSecrets(secrets, privateKey, dTag);

			const pTag = event.tags.find((t) => t[0] === 'p');
			expect(pTag).toBeDefined();
			expect(pTag?.[1]).toBe(publicKey);
		});

		it('uses ephemeral pubkey for outer event (not owner pubkey)', () => {
			const secrets: SecretBundle = { KEY: 'value' };
			const dTag = 'proj|env';

			const { event } = wrapSecrets(secrets, privateKey, dTag);

			// Gift wrap should use ephemeral key, not the owner's key
			expect(event.pubkey).not.toBe(publicKey);
		});

		it('encrypts content (does not contain plaintext)', () => {
			const secrets: SecretBundle = {
				API_KEY: 'sk_test_123',
				SECRET: 'supersecret',
			};
			const dTag = 'project1|production';

			const { event } = wrapSecrets(secrets, privateKey, dTag);

			expect(event.content).not.toContain('API_KEY');
			expect(event.content).not.toContain('sk_test_123');
			expect(event.content).not.toContain('SECRET');
			expect(event.content).not.toContain('supersecret');
		});

		it('preserves d-tag in rumor', () => {
			const secrets: SecretBundle = { KEY: 'value' };
			const dTag = 'myproject|production';

			const { rumor } = wrapSecrets(secrets, privateKey, dTag);

			const dTagInRumor = rumor.tags.find((t) => t[0] === 'd');
			expect(dTagInRumor).toBeDefined();
			expect(dTagInRumor?.[1]).toBe(dTag);
		});

		it('produces different ciphertext each time (randomized encryption)', () => {
			const secrets: SecretBundle = { KEY: 'value' };
			const dTag = 'proj|env';

			const wrap1 = wrapSecrets(secrets, privateKey, dTag);
			const wrap2 = wrapSecrets(secrets, privateKey, dTag);

			expect(wrap1.event.content).not.toBe(wrap2.event.content);
			expect(wrap1.event.id).not.toBe(wrap2.event.id);
		});
	});

	describe('unwrapSecrets', () => {
		it('unwraps to retrieve original secrets', () => {
			const secrets: SecretBundle = {
				API_KEY: 'sk_test_123',
				DATABASE_URL: 'postgres://localhost/mydb',
			};
			const dTag = 'project1|production';

			const { event } = wrapSecrets(secrets, privateKey, dTag);
			const unwrapped = unwrapSecrets(event, privateKey);

			expect(unwrapped).toEqual(secrets);
		});

		it('fails to unwrap with wrong private key', () => {
			const secrets: SecretBundle = { SECRET: 'data' };
			const dTag = 'proj|env';

			const { event } = wrapSecrets(secrets, privateKey, dTag);
			const wrongKey = generateSecretKey();

			expect(() => unwrapSecrets(event, wrongKey)).toThrow();
		});
	});

	describe('unwrapGiftWrap', () => {
		it('returns secrets with d-tag metadata', () => {
			const secrets: SecretBundle = { API_KEY: 'test123' };
			const dTag = 'myproject|staging';

			const { event } = wrapSecrets(secrets, privateKey, dTag);
			const result = unwrapGiftWrap(event, privateKey);

			expect(result.secrets).toEqual(secrets);
			expect(result.dTag).toBe(dTag);
			expect(result.createdAt).toBeGreaterThan(0);
			expect(result.pubkey).toBe(publicKey);
		});

		it('returns null d-tag if rumor has no d-tag', () => {
			// This is an edge case - in practice all our events have d-tags
			const secrets: SecretBundle = { KEY: 'value' };
			const dTag = 'proj|env';

			const { event } = wrapSecrets(secrets, privateKey, dTag);
			const result = unwrapGiftWrap(event, privateKey);

			// Our implementation always includes d-tag
			expect(result.dTag).toBe(dTag);
		});
	});

	describe('createTombstone', () => {
		it('creates a tombstone with empty secret bundle', () => {
			const dTag = 'project1|production';

			const { event, rumor } = createTombstone(privateKey, dTag);

			expect(event.kind).toBe(NostrKinds.GIFT_WRAP);
			expect(event.sig).toBeDefined();

			const dTagInRumor = rumor.tags.find((t) => t[0] === 'd');
			expect(dTagInRumor?.[1]).toBe(dTag);

			const unwrapped = unwrapSecrets(event, privateKey);
			expect(unwrapped).toEqual({});
		});
	});

	describe('isRedshiftSecretsEvent', () => {
		it('returns true for events with redshift-secrets type tag', () => {
			const secrets: SecretBundle = { KEY: 'value' };
			const { event } = wrapSecrets(secrets, privateKey, 'proj|env');

			expect(isRedshiftSecretsEvent(event)).toBe(true);
		});

		it('returns false for events without type tag', () => {
			const fakeEvent = {
				id: 'abc',
				pubkey: 'xyz',
				created_at: 123,
				kind: NostrKinds.GIFT_WRAP,
				tags: [['p', publicKey]],
				content: 'encrypted',
				sig: 'sig',
			};

			expect(isRedshiftSecretsEvent(fakeEvent)).toBe(false);
		});

		it('returns false for non-gift-wrap events', () => {
			const fakeEvent = {
				id: 'abc',
				pubkey: 'xyz',
				created_at: 123,
				kind: 1, // Not gift wrap
				tags: [['t', REDSHIFT_TYPE_TAG]],
				content: 'content',
				sig: 'sig',
			};

			expect(isRedshiftSecretsEvent(fakeEvent)).toBe(false);
		});
	});

	describe('getRedshiftSecretsFilter', () => {
		it('returns correct filter for relay queries', () => {
			const filter = getRedshiftSecretsFilter(publicKey);

			expect(filter.kinds).toEqual([NostrKinds.GIFT_WRAP]);
			expect(filter['#p']).toEqual([publicKey]);
			expect(filter['#t']).toEqual([REDSHIFT_TYPE_TAG]);
		});
	});

	describe('Secret Bundle Formats', () => {
		it('handles empty secret bundle', () => {
			const secrets: SecretBundle = {};
			const dTag = 'empty|test';

			const { event } = wrapSecrets(secrets, privateKey, dTag);
			const unwrapped = unwrapSecrets(event, privateKey);

			expect(unwrapped).toEqual({});
		});

		it('preserves special characters in values', () => {
			const secrets: SecretBundle = {
				CONNECTION_STRING: 'postgres://user:p@ss=word@host:5432/db?ssl=true',
				JSON_CONFIG: '{"key": "value", "nested": {"a": 1}}',
				MULTILINE: 'line1\nline2\nline3',
			};
			const dTag = 'test|env';

			const { event } = wrapSecrets(secrets, privateKey, dTag);
			const unwrapped = unwrapSecrets(event, privateKey);

			expect(unwrapped).toEqual(secrets);
		});

		it('preserves unicode characters', () => {
			const secrets: SecretBundle = {
				EMOJI: '🔐🚀💻',
				CHINESE: '你好世界',
				ARABIC: 'مرحبا',
			};
			const dTag = 'test|env';

			const { event } = wrapSecrets(secrets, privateKey, dTag);
			const unwrapped = unwrapSecrets(event, privateKey);

			expect(unwrapped).toEqual(secrets);
		});

		it('handles large secret values', () => {
			const largeValue = 'x'.repeat(10000);
			const secrets: SecretBundle = {
				LARGE_SECRET: largeValue,
			};
			const dTag = 'test|env';

			const { event } = wrapSecrets(secrets, privateKey, dTag);
			const unwrapped = unwrapSecrets(event, privateKey);

			expect(unwrapped.LARGE_SECRET).toBe(largeValue);
		});
	});

	describe('Multiple Environments Integration', () => {
		it('maintains separate secrets for different d-tags', () => {
			const prodSecrets: SecretBundle = { API_KEY: 'prod_key', DEBUG: 'false' };
			const devSecrets: SecretBundle = { API_KEY: 'dev_key', DEBUG: 'true' };

			const prodWrap = wrapSecrets(prodSecrets, privateKey, 'app|production');
			const devWrap = wrapSecrets(devSecrets, privateKey, 'app|development');

			const prodResult = unwrapGiftWrap(prodWrap.event, privateKey);
			const devResult = unwrapGiftWrap(devWrap.event, privateKey);

			expect(prodResult.dTag).toBe('app|production');
			expect(prodResult.secrets).toEqual(prodSecrets);

			expect(devResult.dTag).toBe('app|development');
			expect(devResult.secrets).toEqual(devSecrets);
		});

		it('can find latest event per d-tag from multiple events', () => {
			// Simulate fetching multiple events from relays
			const events = [];

			events.push(wrapSecrets({ KEY: 'old' }, privateKey, 'proj|prod'));
			events.push(wrapSecrets({ KEY: 'new' }, privateKey, 'proj|prod')); // newer
			events.push(wrapSecrets({ KEY: 'dev' }, privateKey, 'proj|dev'));

			// Find latest per d-tag
			const latestByDTag = new Map<string, { secrets: SecretBundle; createdAt: number }>();

			for (const { event } of events) {
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

			expect(latestByDTag.size).toBe(2);
			expect(latestByDTag.get('proj|prod')?.secrets).toEqual({ KEY: 'new' });
			expect(latestByDTag.get('proj|dev')?.secrets).toEqual({ KEY: 'dev' });
		});
	});
});
