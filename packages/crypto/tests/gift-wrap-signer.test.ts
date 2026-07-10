/**
 * Signer-based Gift Wrap Tests for @redshift/crypto
 *
 * Tests for NIP-59 Gift Wrap implementation using NIP-07/NIP-46 signer functions.
 * These are the encryption paths used by ALL web users (browser extensions, bunkers).
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { nip44 } from 'nostr-tools';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import {
	type DecryptFn,
	type EncryptFn,
	type NostrEvent,
	NostrKinds,
	REDSHIFT_TYPE_TAG,
	type SecretBundle,
	type SignFn,
	unwrapGiftWrapWithSigner as unwrapGiftWrapWithExpectedSigner,
	wrapSecretsWithSigner,
} from '../src/index';

/**
 * Create mock signer functions using real nostr-tools crypto.
 * These simulate what a NIP-07 extension or NIP-46 bunker would provide.
 */
function createMockSigner(secretKey: Uint8Array) {
	const pubkey = getPublicKey(secretKey);

	const encryptFn: EncryptFn = async (targetPubkey: string, plaintext: string) => {
		const conversationKey = nip44.v2.utils.getConversationKey(secretKey, targetPubkey);
		return nip44.v2.encrypt(plaintext, conversationKey);
	};

	const decryptFn: DecryptFn = async (senderPubkey: string, ciphertext: string) => {
		const conversationKey = nip44.v2.utils.getConversationKey(secretKey, senderPubkey);
		return nip44.v2.decrypt(ciphertext, conversationKey);
	};

	const signFn: SignFn = async (event) => {
		const signed = finalizeEvent(event, secretKey);
		return {
			id: signed.id,
			pubkey: signed.pubkey,
			created_at: signed.created_at,
			kind: signed.kind,
			tags: signed.tags,
			content: signed.content,
			sig: signed.sig,
		};
	};

	return { pubkey, encryptFn, decryptFn, signFn };
}

describe('NIP-59 Gift Wrap (Signer-based)', () => {
	let secretKey: Uint8Array;
	let pubkey: string;
	let encryptFn: EncryptFn;
	let decryptFn: DecryptFn;
	let signFn: SignFn;

	const unwrapGiftWrapWithSigner = (event: NostrEvent, fn: DecryptFn) =>
		unwrapGiftWrapWithExpectedSigner(event, pubkey, fn);

	beforeEach(() => {
		secretKey = generateSecretKey();
		const signer = createMockSigner(secretKey);
		pubkey = signer.pubkey;
		encryptFn = signer.encryptFn;
		decryptFn = signer.decryptFn;
		signFn = signer.signFn;
	});

	describe('wrapSecretsWithSigner + unwrapGiftWrapWithSigner roundtrip', () => {
		it('wraps and unwraps secrets correctly', async () => {
			const secrets: SecretBundle = {
				API_KEY: 'sk_test_123',
				DATABASE_URL: 'postgres://localhost/mydb',
			};
			const dTag = 'project1|production';

			const { event } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);
			const result = await unwrapGiftWrapWithSigner(event, decryptFn);

			expect(result.secrets).toEqual(secrets);
			expect(result.dTag).toBe(dTag);
			expect(result.pubkey).toBe(pubkey);
			expect(result.createdAt).toBeGreaterThan(0);
		});
	});

	describe('wrapSecretsWithSigner', () => {
		it('creates a Gift Wrap event with kind 1059', async () => {
			const secrets: SecretBundle = { API_KEY: 'sk_test_123' };
			const dTag = 'project1|production';

			const { event } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);

			expect(event.kind).toBe(NostrKinds.GIFT_WRAP);
			expect(event.sig).toBeDefined();
			expect(event.id).toBeDefined();
		});

		it('adds redshift-secrets type tag to outer event', async () => {
			const secrets: SecretBundle = { API_KEY: 'sk_test_123' };
			const dTag = 'project1|production';

			const { event } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);

			const typeTag = event.tags.find((t) => t[0] === 't');
			expect(typeTag).toBeDefined();
			expect(typeTag?.[1]).toBe(REDSHIFT_TYPE_TAG);
		});

		it('includes p-tag with recipient pubkey', async () => {
			const secrets: SecretBundle = { KEY: 'value' };
			const dTag = 'proj|env';

			const { event } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);

			const pTag = event.tags.find((t) => t[0] === 'p');
			expect(pTag).toBeDefined();
			expect(pTag?.[1]).toBe(pubkey);
		});

		it('uses ephemeral pubkey for outer event (not owner pubkey)', async () => {
			const secrets: SecretBundle = { KEY: 'value' };
			const dTag = 'proj|env';

			const { event } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);

			// Gift wrap should use ephemeral key, not the owner's key
			expect(event.pubkey).not.toBe(pubkey);
		});

		it('produces different ciphertext each time (randomized encryption)', async () => {
			const secrets: SecretBundle = { KEY: 'value' };
			const dTag = 'proj|env';

			const wrap1 = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);
			const wrap2 = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);

			expect(wrap1.event.content).not.toBe(wrap2.event.content);
			expect(wrap1.event.id).not.toBe(wrap2.event.id);
		});

		it('throws on empty d-tag', async () => {
			const secrets: SecretBundle = { KEY: 'value' };

			await expect(wrapSecretsWithSigner(secrets, pubkey, '', encryptFn, signFn)).rejects.toThrow(
				'Invalid d-tag',
			);
		});

		it('throws on invalid d-tag format (no pipe separator)', async () => {
			const secrets: SecretBundle = { KEY: 'value' };

			await expect(
				wrapSecretsWithSigner(secrets, pubkey, 'no-pipe-separator', encryptFn, signFn),
			).rejects.toThrow('Invalid d-tag');
		});
	});

	describe('unwrapGiftWrapWithSigner', () => {
		it('rejects a valid attacker-authored bundle addressed to another authenticated owner', async () => {
			const attackerKey = generateSecretKey();
			const attacker = createMockSigner(attackerKey);
			const { event } = await wrapSecretsWithSigner(
				{ KEY: 'attacker-controlled' },
				attacker.pubkey,
				'proj|env',
				attacker.encryptFn,
				attacker.signFn,
			);

			await expect(
				unwrapGiftWrapWithExpectedSigner(event, pubkey, attacker.decryptFn),
			).rejects.toThrow('recipient');
		});

		it('rejects a signer result when the expected owner is different', async () => {
			const { event } = await wrapSecretsWithSigner(
				{ KEY: 'value' },
				pubkey,
				'proj|env',
				encryptFn,
				signFn,
			);
			const differentOwner = getPublicKey(generateSecretKey());

			await expect(
				unwrapGiftWrapWithExpectedSigner(event, differentOwner, decryptFn),
			).rejects.toThrow('recipient');
		});

		it('fails to unwrap with wrong key decryptFn', async () => {
			const secrets: SecretBundle = { SECRET: 'data' };
			const dTag = 'proj|env';

			const { event } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);

			// Create a decryptFn with a different key
			const wrongKey = generateSecretKey();
			const wrongSigner = createMockSigner(wrongKey);

			await expect(unwrapGiftWrapWithSigner(event, wrongSigner.decryptFn)).rejects.toThrow();
		});

		it('rejects event with invalid signature', async () => {
			const secrets: SecretBundle = { SECRET: 'data' };
			const dTag = 'proj|env';

			const { event } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);

			// Tamper with the signature
			const tamperedEvent: NostrEvent = {
				...event,
				sig: event.sig.replace(/^./, event.sig[0] === 'a' ? 'b' : 'a'),
			};

			await expect(unwrapGiftWrapWithSigner(tamperedEvent, decryptFn)).rejects.toThrow(
				'signature verification failed',
			);
		});

		it('rejects event with missing signature fields', async () => {
			const secrets: SecretBundle = { SECRET: 'data' };
			const dTag = 'proj|env';

			const { event } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);

			// Remove sig
			const noSigEvent = { ...event, sig: '' };

			await expect(unwrapGiftWrapWithSigner(noSigEvent as NostrEvent, decryptFn)).rejects.toThrow(
				'missing id, pubkey, or sig',
			);
		});

		it('rejects tampered ciphertext', async () => {
			const secrets: SecretBundle = { SECRET: 'data' };
			const dTag = 'proj|env';

			const { event } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);

			// Tamper with the content — this will cause signature verification to fail
			// since the content is part of the signed event
			const tamperedEvent: NostrEvent = {
				...event,
				content: `${event.content.slice(0, -5)}XXXXX`,
			};

			// Signature check will fail because content changed
			await expect(unwrapGiftWrapWithSigner(tamperedEvent, decryptFn)).rejects.toThrow();
		});

		it('throws descriptive error when seal JSON parse fails', async () => {
			const secrets: SecretBundle = { KEY: 'value' };
			const dTag = 'proj|env';

			const { event } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);

			// Create a decryptFn that returns non-JSON
			const badDecryptFn: DecryptFn = async () => 'not-valid-json{{{';

			await expect(unwrapGiftWrapWithSigner(event, badDecryptFn)).rejects.toThrow('invalid JSON');
		});
	});

	describe('Secret Bundle Formats (Signer)', () => {
		it('handles empty secret bundle', async () => {
			const secrets: SecretBundle = {};
			const dTag = 'empty|test';

			const { event } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);
			const result = await unwrapGiftWrapWithSigner(event, decryptFn);

			expect(result.secrets).toEqual({});
		});

		it('preserves special characters in values', async () => {
			const secrets: SecretBundle = {
				CONNECTION_STRING: 'postgres://user:p@ss=word@host:5432/db?ssl=true',
				JSON_CONFIG: '{"key": "value", "nested": {"a": 1}}',
				MULTILINE: 'line1\nline2\nline3',
				QUOTES: 'she said "hello"',
			};
			const dTag = 'test|env';

			const { event } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);
			const result = await unwrapGiftWrapWithSigner(event, decryptFn);

			expect(result.secrets).toEqual(secrets);
		});

		it('preserves unicode characters', async () => {
			const secrets: SecretBundle = {
				EMOJI: '\u{1F510}\u{1F680}\u{1F4BB}',
				CHINESE: '\u4F60\u597D\u4E16\u754C',
				ARABIC: '\u0645\u0631\u062D\u0628\u0627',
			};
			const dTag = 'test|env';

			const { event } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);
			const result = await unwrapGiftWrapWithSigner(event, decryptFn);

			expect(result.secrets).toEqual(secrets);
		});

		it('rejects prototype pollution keys', async () => {
			// { __proto__: 'malicious' } in JS sets the prototype, not a key.
			// Use JSON.parse to create an object with a literal "__proto__" key.
			const secrets = JSON.parse('{"__proto__": "malicious"}') as SecretBundle;
			const dTag = 'test|env';

			await expect(wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn)).rejects.toThrow(
				'forbidden key "__proto__"',
			);
		});

		it('rejects constructor prototype pollution key', async () => {
			const dTag = 'test|env';

			// We need to manually construct a bundle with 'constructor' key
			// Using Record cast to bypass TypeScript's built-in constructor property type
			const secrets: Record<string, string> = { constructor: 'malicious' };

			await expect(
				wrapSecretsWithSigner(secrets as SecretBundle, pubkey, dTag, encryptFn, signFn),
			).rejects.toThrow('forbidden key "constructor"');
		});
	});

	describe('Edge cases (Signer)', () => {
		it('handles large secret values near NIP-44 limit', async () => {
			const largeValue = 'x'.repeat(10_000);
			const secrets: SecretBundle = { LARGE_KEY: largeValue };
			const dTag = 'test|env';

			const { event } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);
			const result = await unwrapGiftWrapWithSigner(event, decryptFn);

			expect(result.secrets.LARGE_KEY).toBe(largeValue);
			expect(result.secrets.LARGE_KEY.length).toBe(10_000);
		});

		it('handles many secrets in a bundle', async () => {
			const secrets: SecretBundle = {};
			for (let i = 0; i < 200; i++) {
				secrets[`KEY_${i}`] = `value_${i}_${'a'.repeat(100)}`;
			}
			const dTag = 'test|env';

			const { event } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);
			const result = await unwrapGiftWrapWithSigner(event, decryptFn);

			expect(Object.keys(result.secrets).length).toBe(200);
			expect(result.secrets.KEY_0).toBe(secrets.KEY_0);
			expect(result.secrets.KEY_199).toBe(secrets.KEY_199);
		});

		it('handles special characters in keys', async () => {
			const secrets: SecretBundle = {
				'KEY-WITH-DASHES': 'value1',
				KEY_WITH_UNDERSCORES: 'value2',
				'KEY.WITH.DOTS': 'value3',
				'KEY/WITH/SLASHES': 'value4',
				'KEY WITH SPACES': 'value5',
			};
			const dTag = 'test|env';

			const { event } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);
			const result = await unwrapGiftWrapWithSigner(event, decryptFn);

			expect(result.secrets).toEqual(secrets);
		});

		it('wrapping with a signer that throws produces clear error', async () => {
			const secrets: SecretBundle = { KEY: 'value' };
			const dTag = 'test|env';

			const failingSignFn: SignFn = async () => {
				throw new Error('Signer refused to sign');
			};

			await expect(
				wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, failingSignFn),
			).rejects.toThrow('Signer refused to sign');
		});

		it('wrapping with a failing encryptFn produces clear error', async () => {
			const secrets: SecretBundle = { KEY: 'value' };
			const dTag = 'test|env';

			const failingEncryptFn: EncryptFn = async () => {
				throw new Error('Encryption failed');
			};

			await expect(
				wrapSecretsWithSigner(secrets, pubkey, dTag, failingEncryptFn, signFn),
			).rejects.toThrow('Encryption failed');
		});
	});

	describe('Rumor metadata (Signer)', () => {
		it('preserves d-tag in rumor', async () => {
			const secrets: SecretBundle = { KEY: 'value' };
			const dTag = 'myproject|production';

			const { rumor } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);

			const dTagInRumor = rumor.tags.find((t) => t[0] === 'd');
			expect(dTagInRumor).toBeDefined();
			expect(dTagInRumor?.[1]).toBe(dTag);
		});

		it('sets rumor pubkey to user pubkey', async () => {
			const secrets: SecretBundle = { KEY: 'value' };
			const dTag = 'proj|env';

			const { rumor } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);

			expect(rumor.pubkey).toBe(pubkey);
		});

		it('sets rumor kind to SECRET_BUNDLE', async () => {
			const secrets: SecretBundle = { KEY: 'value' };
			const dTag = 'proj|env';

			const { rumor } = await wrapSecretsWithSigner(secrets, pubkey, dTag, encryptFn, signFn);

			expect(rumor.kind).toBe(NostrKinds.SECRET_BUNDLE);
		});
	});
});
