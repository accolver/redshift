/**
 * Cryptographic Core Tests - TDD Phase 1
 *
 * L2: Function-Author - Tests written before implementation
 * L4: Integration-Contractor - NIP-59 protocol compliance
 */

import { describe, expect, it } from 'bun:test';
import {
	createDTag,
	createDeletionEvent,
	createTombstone,
	decodeNpub,
	decodeNsec,
	parseDTag,
	unwrapGiftWrap,
	unwrapSecrets,
	validateNpub,
	validateNsec,
	wrapSecrets,
} from '../../src/lib/crypto';
import type { SecretBundle } from '../../src/lib/types';

describe('NIP-59 Gift Wrap', () => {
	// Generate a test private key (32 bytes)
	const testPrivateKey = new Uint8Array(32);
	crypto.getRandomValues(testPrivateKey);

	it('wraps and unwraps secrets to self', async () => {
		const secrets: SecretBundle = {
			API_KEY: 'sk_test_123',
			DEBUG: true,
			PORT: 3000,
		};
		const dTag = 'project1|production';

		const { event } = await wrapSecrets(secrets, testPrivateKey, dTag);

		// Verify outer event structure
		expect(event.kind).toBe(1059); // Gift Wrap kind
		expect(event.content).not.toContain('API_KEY'); // Content should be encrypted
		expect(event.content).not.toContain('sk_test_123');
		expect(event.sig).toBeDefined();

		// Unwrap and verify
		const unwrapped = await unwrapSecrets(event, testPrivateKey);
		expect(unwrapped).toEqual(secrets);
	});

	it('produces different ciphertext each time (randomized encryption)', async () => {
		const secrets: SecretBundle = { KEY: 'value' };
		const dTag = 'proj|env';

		const wrap1 = await wrapSecrets(secrets, testPrivateKey, dTag);
		const wrap2 = await wrapSecrets(secrets, testPrivateKey, dTag);

		// Each wrap should produce different ciphertext
		expect(wrap1.event.content).not.toBe(wrap2.event.content);
		expect(wrap1.event.id).not.toBe(wrap2.event.id);
	});

	it('handles complex nested objects', async () => {
		const secrets: SecretBundle = {
			FEATURE_FLAGS: {
				new_ui: true,
				beta_features: ['feature_a', 'feature_b'],
				config: { timeout: 5000 },
			},
		};
		const dTag = 'myproject|staging';

		const { event } = await wrapSecrets(secrets, testPrivateKey, dTag);
		const unwrapped = await unwrapSecrets(event, testPrivateKey);

		expect(unwrapped).toEqual(secrets);
	});

	it('handles empty secret bundle', async () => {
		const secrets: SecretBundle = {};
		const dTag = 'empty|test';

		const { event } = await wrapSecrets(secrets, testPrivateKey, dTag);
		const unwrapped = await unwrapSecrets(event, testPrivateKey);

		expect(unwrapped).toEqual({});
	});

	it('preserves the d-tag in the rumor', async () => {
		const secrets: SecretBundle = { KEY: 'value' };
		const dTag = 'myproject|production';

		const { rumor } = await wrapSecrets(secrets, testPrivateKey, dTag);

		// The rumor should have the d-tag
		const dTagInRumor = rumor.tags.find((t) => t[0] === 'd');
		expect(dTagInRumor).toBeDefined();
		expect(dTagInRumor?.[1]).toBe(dTag);
	});

	it('unwrapGiftWrap returns secrets with d-tag metadata', async () => {
		const secrets: SecretBundle = { API_KEY: 'test123', DEBUG: true };
		const dTag = 'myproject|staging';

		const { event } = await wrapSecrets(secrets, testPrivateKey, dTag);
		const result = await unwrapGiftWrap(event, testPrivateKey);

		expect(result.secrets).toEqual(secrets);
		expect(result.dTag).toBe(dTag);
		expect(result.createdAt).toBeGreaterThan(0);
		expect(result.pubkey).toBeDefined();
	});

	it('fails to unwrap with wrong private key', async () => {
		const secrets: SecretBundle = { SECRET: 'data' };
		const dTag = 'proj|env';

		const { event } = await wrapSecrets(secrets, testPrivateKey, dTag);

		// Try to unwrap with a different key
		const wrongKey = new Uint8Array(32);
		crypto.getRandomValues(wrongKey);

		await expect(unwrapSecrets(event, wrongKey)).rejects.toThrow();
	});

	it('fails to unwrap malformed event (missing required fields)', async () => {
		const malformedEvent = {
			id: 'abc',
			pubkey: 'xyz',
			created_at: 123,
			kind: 1059,
			tags: [],
			content: 'not-encrypted-content',
			sig: 'invalid-sig',
		};

		await expect(unwrapSecrets(malformedEvent, testPrivateKey)).rejects.toThrow();
	});
});

describe('Tombstone (Logical Deletion)', () => {
	const testPrivateKey = new Uint8Array(32);
	crypto.getRandomValues(testPrivateKey);

	it('creates a tombstone with empty secret bundle', async () => {
		const dTag = 'project1|production';

		const { event, rumor } = await createTombstone(testPrivateKey, dTag);

		// Verify it's a valid gift wrap
		expect(event.kind).toBe(1059);
		expect(event.sig).toBeDefined();

		// Verify d-tag is preserved
		const dTagInRumor = rumor.tags.find((t) => t[0] === 'd');
		expect(dTagInRumor?.[1]).toBe(dTag);

		// Unwrap and verify it's an empty bundle
		const unwrapped = await unwrapSecrets(event, testPrivateKey);
		expect(unwrapped).toEqual({});
	});

	it('tombstone can overwrite existing secrets', async () => {
		const dTag = 'project1|production';

		// First, create secrets
		const secrets = { API_KEY: 'secret123' };
		const { event: secretEvent } = await wrapSecrets(secrets, testPrivateKey, dTag);

		// Verify secrets exist
		const unwrappedSecrets = await unwrapSecrets(secretEvent, testPrivateKey);
		expect(unwrappedSecrets).toEqual(secrets);

		// Create tombstone (same d-tag will replace in relay)
		const { event: tombstoneEvent } = await createTombstone(testPrivateKey, dTag);

		// Verify tombstone is empty
		const unwrappedTombstone = await unwrapSecrets(tombstoneEvent, testPrivateKey);
		expect(unwrappedTombstone).toEqual({});
	});
});

describe('NIP-09 Deletion', () => {
	const testPrivateKey = new Uint8Array(32);
	crypto.getRandomValues(testPrivateKey);

	it('creates a valid deletion event', async () => {
		const eventIds = ['abc123', 'def456'];

		const deletionEvent = await createDeletionEvent(eventIds, testPrivateKey);

		expect(deletionEvent.kind).toBe(5); // Deletion kind
		expect(deletionEvent.sig).toBeDefined();

		// Should have 'e' tags for each event ID
		const eTags = deletionEvent.tags.filter((t) => t[0] === 'e');
		expect(eTags.length).toBe(2);
		expect(eTags.map((t) => t[1])).toContain('abc123');
		expect(eTags.map((t) => t[1])).toContain('def456');
	});

	it('includes reason when provided', async () => {
		const eventIds = ['xyz789'];
		const reason = 'Project deleted';

		const deletionEvent = await createDeletionEvent(eventIds, testPrivateKey, reason);

		expect(deletionEvent.content).toBe(reason);
	});
});

describe('Key Validation', () => {
	// These are valid test keys generated for testing purposes
	const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
	const validNpub = 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m';

	it('validates correct nsec with checksum verification', () => {
		expect(validateNsec(validNsec)).toBe(true);
	});

	it('rejects invalid nsec formats', () => {
		expect(validateNsec('')).toBe(false);
		expect(validateNsec('nsec1')).toBe(false);
		expect(validateNsec('npub1abc')).toBe(false);
		expect(validateNsec('nsec1UPPERCASE')).toBe(false);
		expect(validateNsec(`nsec1toolong${'a'.repeat(60)}`)).toBe(false);
	});

	it('rejects nsec with invalid checksum', () => {
		// Valid format but bad checksum (last char changed)
		const badChecksum = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe6';
		expect(validateNsec(badChecksum)).toBe(false);
	});

	it('validates correct npub with checksum verification', () => {
		expect(validateNpub(validNpub)).toBe(true);
	});

	it('rejects invalid npub formats', () => {
		expect(validateNpub('')).toBe(false);
		expect(validateNpub('npub1')).toBe(false);
		expect(validateNpub('nsec1abc')).toBe(false);
	});

	it('rejects npub with invalid checksum', () => {
		// Valid format but bad checksum (last char changed)
		const badChecksum = 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63n';
		expect(validateNpub(badChecksum)).toBe(false);
	});
});

describe('Key Decoding', () => {
	const validNsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
	const validNpub = 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m';

	it('decodes valid nsec to Uint8Array', () => {
		const privateKey = decodeNsec(validNsec);
		expect(privateKey).toBeInstanceOf(Uint8Array);
		expect(privateKey.length).toBe(32);
	});

	it('decodes valid npub to hex string', () => {
		const publicKey = decodeNpub(validNpub);
		expect(typeof publicKey).toBe('string');
		expect(publicKey.length).toBe(64); // 32 bytes as hex
	});

	it('throws on invalid nsec', () => {
		expect(() => decodeNsec('invalid')).toThrow();
		expect(() => decodeNsec(validNpub)).toThrow('Expected nsec');
	});

	it('throws on invalid npub', () => {
		expect(() => decodeNpub('invalid')).toThrow();
		expect(() => decodeNpub(validNsec)).toThrow('Expected npub');
	});
});

describe('D-Tag Utilities', () => {
	it('creates d-tag from project and environment', () => {
		expect(createDTag('proj123', 'production')).toBe('proj123|production');
		expect(createDTag('my-project', 'dev')).toBe('my-project|dev');
	});

	it('parses valid d-tag', () => {
		const result = parseDTag('project123|staging');
		expect(result).toEqual({
			projectId: 'project123',
			environment: 'staging',
		});
	});

	it('returns null for invalid d-tag', () => {
		expect(parseDTag('')).toBeNull();
		expect(parseDTag('nopipe')).toBeNull();
		expect(parseDTag('|empty')).toBeNull();
		expect(parseDTag('empty|')).toBeNull();
		expect(parseDTag('too|many|pipes')).toBeNull();
	});
});
