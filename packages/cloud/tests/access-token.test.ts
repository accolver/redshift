/**
 * Access Token Tests
 *
 * Tests for NIP-78 + NIP-59 access token generation and validation
 */

import { describe, expect, it } from 'bun:test';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { nsecEncode } from 'nostr-tools/nip19';

import {
	createAccessToken,
	validateAccessToken,
	isTokenExpired,
	getDaysUntilExpiry,
	getAccessTokenFilter,
	CloudKinds,
	CloudTypeTags,
	type AccessToken,
} from '../src';

describe('createAccessToken', () => {
	it('creates a valid access token event', () => {
		const userKey = generateSecretKey();
		const userPubkey = getPublicKey(userKey);
		const operatorKey = generateSecretKey();
		const operatorNsec = nsecEncode(operatorKey);

		const { event, token } = createAccessToken(
			userPubkey,
			operatorNsec,
			'inv_123',
			'cloud',
			'wss://relay.example.com',
		);

		// Event should be a valid Gift Wrap
		expect(event.kind).toBe(CloudKinds.GIFT_WRAP);
		expect(event.id).toBeDefined();
		expect(event.sig).toBeDefined();
		expect(event.tags).toContainEqual(['p', userPubkey]);
		expect(event.tags).toContainEqual(['t', 'redshift-cloud']);

		// Token should have correct data
		expect(token.tier).toBe('cloud');
		expect(token.invoiceId).toBe('inv_123');
		expect(token.pubkey).toBe(userPubkey);
		expect(token.content.relayUrl).toBe('wss://relay.example.com');
		expect(token.content.signature).toBeDefined();
		expect(token.expiresAt).toBeGreaterThan(Date.now() / 1000);
	});

	it('creates tokens for different tiers', () => {
		const userPubkey = getPublicKey(generateSecretKey());
		const operatorNsec = nsecEncode(generateSecretKey());

		const cloudToken = createAccessToken(userPubkey, operatorNsec, 'inv_1', 'cloud');
		const teamsToken = createAccessToken(userPubkey, operatorNsec, 'inv_2', 'teams');
		const enterpriseToken = createAccessToken(userPubkey, operatorNsec, 'inv_3', 'enterprise');

		expect(cloudToken.token.tier).toBe('cloud');
		expect(teamsToken.token.tier).toBe('teams');
		expect(enterpriseToken.token.tier).toBe('enterprise');
	});

	it('sets expiration to 30 days from now', () => {
		const userPubkey = getPublicKey(generateSecretKey());
		const operatorNsec = nsecEncode(generateSecretKey());

		const { token } = createAccessToken(userPubkey, operatorNsec, 'inv_123');

		const now = Math.floor(Date.now() / 1000);
		const thirtyDays = 30 * 24 * 60 * 60;

		// Should be approximately 30 days from now (within 10 seconds)
		expect(token.expiresAt).toBeGreaterThan(now + thirtyDays - 10);
		expect(token.expiresAt).toBeLessThan(now + thirtyDays + 10);
	});

	it('accepts hex private key format', () => {
		const userPubkey = getPublicKey(generateSecretKey());
		const operatorKey = generateSecretKey();
		// Convert Uint8Array to hex string
		const operatorHex = Array.from(operatorKey)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');

		const { token } = createAccessToken(userPubkey, operatorHex, 'inv_123');

		expect(token.tier).toBe('cloud');
	});
});

describe('validateAccessToken', () => {
	it('validates a freshly created token', () => {
		const userKey = generateSecretKey();
		const userPubkey = getPublicKey(userKey);
		const operatorKey = generateSecretKey();
		const operatorPubkey = getPublicKey(operatorKey);
		const operatorNsec = nsecEncode(operatorKey);

		const { event } = createAccessToken(userPubkey, operatorNsec, 'inv_123');

		const result = validateAccessToken(event, userKey, operatorPubkey);

		expect(result.valid).toBe(true);
		expect(result.token).toBeDefined();
		expect(result.token?.tier).toBe('cloud');
		expect(result.token?.invoiceId).toBe('inv_123');
	});

	it('rejects token with wrong user key', () => {
		const userKey = generateSecretKey();
		const userPubkey = getPublicKey(userKey);
		const wrongUserKey = generateSecretKey();
		const operatorKey = generateSecretKey();
		const operatorPubkey = getPublicKey(operatorKey);
		const operatorNsec = nsecEncode(operatorKey);

		const { event } = createAccessToken(userPubkey, operatorNsec, 'inv_123');

		const result = validateAccessToken(event, wrongUserKey, operatorPubkey);

		expect(result.valid).toBe(false);
		expect(result.reason).toContain('unwrap');
	});

	it('returns reason for invalid events', () => {
		const userKey = generateSecretKey();
		const operatorPubkey = getPublicKey(generateSecretKey());

		// Create a malformed event
		const badEvent = {
			id: '123',
			pubkey: 'abc',
			created_at: 0,
			kind: CloudKinds.GIFT_WRAP,
			tags: [],
			content: 'invalid',
			sig: 'xyz',
		};

		const result = validateAccessToken(badEvent, userKey, operatorPubkey);

		expect(result.valid).toBe(false);
		expect(result.reason).toBeDefined();
	});
});

describe('isTokenExpired', () => {
	it('returns false for non-expired token', () => {
		const token: AccessToken = {
			tier: 'cloud',
			expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
			invoiceId: 'inv_123',
			content: {
				issuedAt: Math.floor(Date.now() / 1000),
				relayUrl: 'wss://relay.example.com',
				signature: 'sig',
			},
			pubkey: 'abc',
			createdAt: Math.floor(Date.now() / 1000),
		};

		expect(isTokenExpired(token)).toBe(false);
	});

	it('returns true for expired token', () => {
		const token: AccessToken = {
			tier: 'cloud',
			expiresAt: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
			invoiceId: 'inv_123',
			content: {
				issuedAt: Math.floor(Date.now() / 1000) - 7200,
				relayUrl: 'wss://relay.example.com',
				signature: 'sig',
			},
			pubkey: 'abc',
			createdAt: Math.floor(Date.now() / 1000) - 7200,
		};

		expect(isTokenExpired(token)).toBe(true);
	});
});

describe('getDaysUntilExpiry', () => {
	it('returns correct days for future expiration', () => {
		const daysInFuture = 15;
		const token: AccessToken = {
			tier: 'cloud',
			expiresAt: Math.floor(Date.now() / 1000) + daysInFuture * 24 * 60 * 60,
			invoiceId: 'inv_123',
			content: {
				issuedAt: Math.floor(Date.now() / 1000),
				relayUrl: 'wss://relay.example.com',
				signature: 'sig',
			},
			pubkey: 'abc',
			createdAt: Math.floor(Date.now() / 1000),
		};

		const days = getDaysUntilExpiry(token);
		expect(days).toBe(daysInFuture);
	});

	it('returns 0 for expired token', () => {
		const token: AccessToken = {
			tier: 'cloud',
			expiresAt: Math.floor(Date.now() / 1000) - 3600,
			invoiceId: 'inv_123',
			content: {
				issuedAt: Math.floor(Date.now() / 1000) - 7200,
				relayUrl: 'wss://relay.example.com',
				signature: 'sig',
			},
			pubkey: 'abc',
			createdAt: Math.floor(Date.now() / 1000) - 7200,
		};

		expect(getDaysUntilExpiry(token)).toBe(0);
	});
});

describe('getAccessTokenFilter', () => {
	it('creates correct filter for user pubkey', () => {
		const pubkey = 'abc123';
		const filter = getAccessTokenFilter(pubkey);

		expect(filter.kinds).toContain(CloudKinds.GIFT_WRAP);
		expect(filter['#p']).toContain(pubkey);
		expect(filter['#t']).toContain(CloudTypeTags.CLOUD);
	});
});
