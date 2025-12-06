/**
 * Cryptographic Core Tests - Using @redshift/crypto shared package
 *
 * L2: Function-Author - Tests for crypto operations
 * L4: Integration-Contractor - NIP-59 protocol compliance
 */

import { describe, expect, it } from 'bun:test';
import { generateSecretKey } from 'nostr-tools/pure';
import {
	createDTag,
	createDeletionEvent,
	createTombstone,
	decodeNpub,
	decodeNsec,
	isRedshiftSecretsEvent,
	getRedshiftSecretsFilter,
	parseDTag,
	unwrapGiftWrap,
	unwrapSecrets,
	validateNpub,
	validateNsec,
	wrapSecrets,
	NostrKinds,
	REDSHIFT_TYPE_TAG,
} from '../../src/lib/crypto';
import type { SecretBundle } from '../../src/lib/types';

describe('NIP-59 Gift Wrap', () => {
	// Generate a test private key
	const testPrivateKey = generateSecretKey();

	it('wraps and unwraps secrets to self', () => {
		const secrets: SecretBundle = {
			API_KEY: 'sk_test_123',
			DEBUG: 'true',
			PORT: '3000',
		};
		const dTag = 'project1|production';

		const { event } = wrapSecrets(secrets, testPrivateKey, dTag);

		// Verify outer event structure
		expect(event.kind).toBe(NostrKinds.GIFT_WRAP);
		expect(event.content).not.toContain('API_KEY');
		expect(event.content).not.toContain('sk_test_123');
		expect(event.sig).toBeDefined();

		// Unwrap and verify
		const unwrapped = unwrapSecrets(event, testPrivateKey);
		expect(unwrapped).toEqual(secrets);
	});

	it('adds redshift-secrets type tag to outer event', () => {
		const secrets: SecretBundle = { API_KEY: 'test' };
		const dTag = 'proj|env';

		const { event } = wrapSecrets(secrets, testPrivateKey, dTag);

		const typeTag = event.tags.find((t) => t[0] === 't');
		expect(typeTag).toBeDefined();
		expect(typeTag?.[1]).toBe(REDSHIFT_TYPE_TAG);
	});

	it('produces different ciphertext each time (randomized encryption)', () => {
		const secrets: SecretBundle = { KEY: 'value' };
		const dTag = 'proj|env';

		const wrap1 = wrapSecrets(secrets, testPrivateKey, dTag);
		const wrap2 = wrapSecrets(secrets, testPrivateKey, dTag);

		expect(wrap1.event.content).not.toBe(wrap2.event.content);
		expect(wrap1.event.id).not.toBe(wrap2.event.id);
	});

	it('handles JSON strings in values', () => {
		const secrets: SecretBundle = {
			FEATURE_FLAGS: JSON.stringify({
				new_ui: true,
				beta_features: ['feature_a', 'feature_b'],
				config: { timeout: 5000 },
			}),
		};
		const dTag = 'myproject|staging';

		const { event } = wrapSecrets(secrets, testPrivateKey, dTag);
		const unwrapped = unwrapSecrets(event, testPrivateKey);

		expect(unwrapped).toEqual(secrets);
	});

	it('handles empty secret bundle', () => {
		const secrets: SecretBundle = {};
		const dTag = 'empty|test';

		const { event } = wrapSecrets(secrets, testPrivateKey, dTag);
		const unwrapped = unwrapSecrets(event, testPrivateKey);

		expect(unwrapped).toEqual({});
	});

	it('preserves the d-tag in the rumor', () => {
		const secrets: SecretBundle = { KEY: 'value' };
		const dTag = 'myproject|production';

		const { rumor } = wrapSecrets(secrets, testPrivateKey, dTag);

		const dTagInRumor = rumor.tags.find((t) => t[0] === 'd');
		expect(dTagInRumor).toBeDefined();
		expect(dTagInRumor?.[1]).toBe(dTag);
	});

	it('unwrapGiftWrap returns secrets with d-tag metadata', () => {
		const secrets: SecretBundle = { API_KEY: 'test123', DEBUG: 'true' };
		const dTag = 'myproject|staging';

		const { event } = wrapSecrets(secrets, testPrivateKey, dTag);
		const result = unwrapGiftWrap(event, testPrivateKey);

		expect(result.secrets).toEqual(secrets);
		expect(result.dTag).toBe(dTag);
		expect(result.createdAt).toBeGreaterThan(0);
		expect(result.pubkey).toBeDefined();
	});

	it('fails to unwrap with wrong private key', () => {
		const secrets: SecretBundle = { SECRET: 'data' };
		const dTag = 'proj|env';

		const { event } = wrapSecrets(secrets, testPrivateKey, dTag);
		const wrongKey = generateSecretKey();

		expect(() => unwrapSecrets(event, wrongKey)).toThrow();
	});

	it('fails to unwrap malformed event', () => {
		const malformedEvent = {
			id: 'abc',
			pubkey: 'xyz',
			created_at: 123,
			kind: 1059,
			tags: [],
			content: 'not-encrypted-content',
			sig: 'invalid-sig',
		};

		expect(() => unwrapSecrets(malformedEvent, testPrivateKey)).toThrow();
	});
});

describe('isRedshiftSecretsEvent', () => {
	const testPrivateKey = generateSecretKey();

	it('returns true for wrapped secrets events', () => {
		const { event } = wrapSecrets({ KEY: 'value' }, testPrivateKey, 'proj|env');
		expect(isRedshiftSecretsEvent(event)).toBe(true);
	});

	it('returns false for events without type tag', () => {
		const fakeEvent = {
			id: 'abc',
			pubkey: 'xyz',
			created_at: 123,
			kind: NostrKinds.GIFT_WRAP,
			tags: [['p', 'somepubkey']],
			content: 'encrypted',
			sig: 'sig',
		};
		expect(isRedshiftSecretsEvent(fakeEvent)).toBe(false);
	});
});

describe('getRedshiftSecretsFilter', () => {
	it('returns correct relay filter', () => {
		const pubkey = 'abc123';
		const filter = getRedshiftSecretsFilter(pubkey);

		expect(filter.kinds).toEqual([NostrKinds.GIFT_WRAP]);
		expect(filter['#p']).toEqual([pubkey]);
		expect(filter['#t']).toEqual([REDSHIFT_TYPE_TAG]);
	});
});

describe('Tombstone (Logical Deletion)', () => {
	const testPrivateKey = generateSecretKey();

	it('creates a tombstone with empty secret bundle', () => {
		const dTag = 'project1|production';

		const { event, rumor } = createTombstone(testPrivateKey, dTag);

		expect(event.kind).toBe(NostrKinds.GIFT_WRAP);
		expect(event.sig).toBeDefined();

		const dTagInRumor = rumor.tags.find((t) => t[0] === 'd');
		expect(dTagInRumor?.[1]).toBe(dTag);

		const unwrapped = unwrapSecrets(event, testPrivateKey);
		expect(unwrapped).toEqual({});
	});

	it('tombstone can overwrite existing secrets', () => {
		const dTag = 'project1|production';

		const secrets: SecretBundle = { API_KEY: 'secret123' };
		const { event: secretEvent } = wrapSecrets(secrets, testPrivateKey, dTag);

		const unwrappedSecrets = unwrapSecrets(secretEvent, testPrivateKey);
		expect(unwrappedSecrets).toEqual(secrets);

		const { event: tombstoneEvent } = createTombstone(testPrivateKey, dTag);

		const unwrappedTombstone = unwrapSecrets(tombstoneEvent, testPrivateKey);
		expect(unwrappedTombstone).toEqual({});
	});
});

describe('NIP-09 Deletion', () => {
	const testPrivateKey = generateSecretKey();

	it('creates a valid deletion event', () => {
		const eventIds = ['abc123', 'def456'];

		const deletionEvent = createDeletionEvent(eventIds, testPrivateKey);

		expect(deletionEvent.kind).toBe(NostrKinds.DELETION);
		expect(deletionEvent.sig).toBeDefined();

		const eTags = deletionEvent.tags.filter((t) => t[0] === 'e');
		expect(eTags.length).toBe(2);
		expect(eTags.map((t) => t[1])).toContain('abc123');
		expect(eTags.map((t) => t[1])).toContain('def456');
	});

	it('includes reason when provided', () => {
		const eventIds = ['xyz789'];
		const reason = 'Project deleted';

		const deletionEvent = createDeletionEvent(eventIds, testPrivateKey, reason);

		expect(deletionEvent.content).toBe(reason);
	});
});

describe('Key Validation', () => {
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
		expect(publicKey.length).toBe(64);
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
