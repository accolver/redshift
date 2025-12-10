/**
 * Audit Event Tests
 *
 * Tests for NIP-78 + NIP-59 + NIP-44 audit event generation and decryption
 */

import { describe, expect, it } from 'bun:test';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { nsecEncode } from 'nostr-tools/nip19';

import {
	createAuditEvent,
	unwrapAuditEvent,
	getAuditEventFilter,
	getAuditActionLabel,
	CloudKinds,
	CloudTypeTags,
} from '../src';

describe('createAuditEvent', () => {
	it('creates a valid audit event', () => {
		const userKey = generateSecretKey();
		const userPubkey = getPublicKey(userKey);
		const userNsec = nsecEncode(userKey);

		const { event, audit } = createAuditEvent({
			userPubkey,
			userPrivkey: userNsec,
			action: 'secret:create',
			target: 'project-123',
		});

		// Event should be a valid Gift Wrap
		expect(event.kind).toBe(CloudKinds.GIFT_WRAP);
		expect(event.id).toBeDefined();
		expect(event.sig).toBeDefined();
		expect(event.tags).toContainEqual(['p', userPubkey]);
		expect(event.tags).toContainEqual(['t', CloudTypeTags.AUDIT]);

		// Audit should have correct data
		expect(audit.action).toBe('secret:create');
		expect(audit.target).toBe('project-123');
		expect(audit.pubkey).toBe(userPubkey);
		expect(audit.timestamp).toBeGreaterThan(0);
	});

	it('includes encrypted details when provided', () => {
		const userKey = generateSecretKey();
		const userPubkey = getPublicKey(userKey);
		const userNsec = nsecEncode(userKey);

		const details = {
			description: 'Created secret API_KEY',
			context: { secretName: 'API_KEY', environment: 'production' },
		};

		const { event, audit } = createAuditEvent({
			userPubkey,
			userPrivkey: userNsec,
			action: 'secret:create',
			target: 'project-123',
			details,
		});

		// Event content should be encrypted (not empty)
		expect(event.content).toBeDefined();
		expect(event.content.length).toBeGreaterThan(0);

		// Audit should include details
		expect(audit.details).toEqual(details);
	});

	it('creates events for all audit action types', () => {
		const userKey = generateSecretKey();
		const userPubkey = getPublicKey(userKey);
		const userNsec = nsecEncode(userKey);

		const actions = [
			'secret:create',
			'secret:update',
			'secret:delete',
			'secret:read',
			'subscription:start',
			'subscription:renew',
			'subscription:cancel',
		] as const;

		for (const action of actions) {
			const { audit } = createAuditEvent({
				userPubkey,
				userPrivkey: userNsec,
				action,
				target: 'test-target',
			});

			expect(audit.action).toBe(action);
		}
	});

	it('accepts hex private key format', () => {
		const userKey = generateSecretKey();
		const userPubkey = getPublicKey(userKey);
		const userHex = Array.from(userKey)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');

		const { audit } = createAuditEvent({
			userPubkey,
			userPrivkey: userHex,
			action: 'secret:read',
			target: 'project-456',
		});

		expect(audit.action).toBe('secret:read');
	});
});

describe('unwrapAuditEvent', () => {
	it('unwraps and decrypts an audit event', () => {
		const userKey = generateSecretKey();
		const userPubkey = getPublicKey(userKey);
		const userNsec = nsecEncode(userKey);

		const details = {
			description: 'Updated secret DB_PASSWORD',
			ipHash: 'abc123hash',
		};

		const { event } = createAuditEvent({
			userPubkey,
			userPrivkey: userNsec,
			action: 'secret:update',
			target: 'project-789',
			details,
		});

		const unwrapped = unwrapAuditEvent(event, userKey);

		expect(unwrapped).not.toBeNull();
		expect(unwrapped?.action).toBe('secret:update');
		expect(unwrapped?.target).toBe('project-789');
		expect(unwrapped?.details).toEqual(details);
	});

	it('returns null for event encrypted to different user', () => {
		const userKey = generateSecretKey();
		const userPubkey = getPublicKey(userKey);
		const userNsec = nsecEncode(userKey);
		const differentUserKey = generateSecretKey();

		const { event } = createAuditEvent({
			userPubkey,
			userPrivkey: userNsec,
			action: 'secret:delete',
			target: 'project-123',
		});

		const unwrapped = unwrapAuditEvent(event, differentUserKey);

		expect(unwrapped).toBeNull();
	});

	it('handles events without details', () => {
		const userKey = generateSecretKey();
		const userPubkey = getPublicKey(userKey);
		const userNsec = nsecEncode(userKey);

		const { event } = createAuditEvent({
			userPubkey,
			userPrivkey: userNsec,
			action: 'subscription:start',
			target: 'user-subscription',
		});

		const unwrapped = unwrapAuditEvent(event, userKey);

		expect(unwrapped).not.toBeNull();
		expect(unwrapped?.action).toBe('subscription:start');
		expect(unwrapped?.details).toBeUndefined();
	});

	it('returns null for malformed events', () => {
		const userKey = generateSecretKey();

		const badEvent = {
			id: '123',
			pubkey: 'abc',
			created_at: 0,
			kind: CloudKinds.GIFT_WRAP,
			tags: [],
			content: 'invalid-content',
			sig: 'xyz',
		};

		const unwrapped = unwrapAuditEvent(badEvent, userKey);

		expect(unwrapped).toBeNull();
	});
});

describe('getAuditEventFilter', () => {
	it('creates correct filter for user pubkey', () => {
		const pubkey = 'user123pubkey';
		const filter = getAuditEventFilter(pubkey);

		expect(filter.kinds).toContain(CloudKinds.GIFT_WRAP);
		expect(filter['#p']).toContain(pubkey);
		expect(filter['#t']).toContain(CloudTypeTags.AUDIT);
	});

	it('includes since parameter when provided', () => {
		const pubkey = 'user123pubkey';
		const since = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

		const filter = getAuditEventFilter(pubkey, since);

		expect(filter.since).toBe(since);
	});

	it('omits since parameter when not provided', () => {
		const pubkey = 'user123pubkey';
		const filter = getAuditEventFilter(pubkey);

		expect(filter.since).toBeUndefined();
	});
});

describe('getAuditActionLabel', () => {
	it('returns human-readable labels for all actions', () => {
		expect(getAuditActionLabel('secret:create')).toBe('Created secret');
		expect(getAuditActionLabel('secret:update')).toBe('Updated secret');
		expect(getAuditActionLabel('secret:delete')).toBe('Deleted secret');
		expect(getAuditActionLabel('secret:read')).toBe('Read secret');
		expect(getAuditActionLabel('subscription:start')).toBe('Started subscription');
		expect(getAuditActionLabel('subscription:renew')).toBe('Renewed subscription');
		expect(getAuditActionLabel('subscription:cancel')).toBe('Cancelled subscription');
	});
});
