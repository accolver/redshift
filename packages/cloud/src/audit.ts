/**
 * Audit Event Generation
 *
 * Audit events are NIP-78 events (Kind 30078) wrapped in NIP-59 Gift Wrap.
 * They track user actions for Cloud subscribers with 90-day retention.
 *
 * The content is encrypted with NIP-44 so only the user can read their audit logs.
 */

import { getPublicKey, finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import * as nip44 from 'nostr-tools/nip44';
import { hexToBytes } from 'nostr-tools/utils';
import { nip19 } from 'nostr-tools';

import {
	CloudKinds,
	CloudDTags,
	CloudTypeTags,
	type AuditAction,
	type AuditDetails,
	type AuditEvent,
	type SignedEvent,
	type UnsignedEvent,
} from './types';

/**
 * Retention period for audit events (90 days in seconds)
 */
const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;

/**
 * Two days in seconds for timestamp randomization
 */
const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60;

/**
 * Generate a random timestamp within the past 2 days
 * Used to obscure the exact creation time in NIP-59
 */
function randomPastTimestamp(): number {
	const now = Math.floor(Date.now() / 1000);
	return now - Math.floor(Math.random() * TWO_DAYS_SECONDS);
}

/**
 * Parse a private key from nsec or hex format
 */
function parsePrivateKey(key: string): Uint8Array {
	if (key.startsWith('nsec')) {
		const decoded = nip19.decode(key);
		if (decoded.type !== 'nsec') {
			throw new Error('Invalid nsec format');
		}
		return decoded.data;
	}
	return hexToBytes(key);
}

/**
 * Result of creating an audit event
 */
export interface CreateAuditEventResult {
	/** The wrapped Gift Wrap event to publish */
	event: SignedEvent;
	/** The audit event data */
	audit: AuditEvent;
}

/**
 * Options for creating an audit event
 */
export interface CreateAuditEventOptions {
	/** User's Nostr pubkey (hex) */
	userPubkey: string;
	/** User's private key (nsec or hex) for encrypting content */
	userPrivkey: string;
	/** The action being audited */
	action: AuditAction;
	/** Target resource (e.g., project ID) */
	target: string;
	/** Optional additional details */
	details?: AuditDetails;
}

/**
 * Create an audit event for a Cloud subscriber action
 *
 * Audit events are encrypted with NIP-44 so only the user can decrypt them.
 * They include a NIP-40 expiration tag for automatic 7-day retention.
 *
 * @param options - Audit event options
 * @returns The wrapped event and audit data
 *
 * @example
 * ```typescript
 * const { event, audit } = createAuditEvent({
 *   userPubkey: '...',
 *   userPrivkey: 'nsec1...',
 *   action: 'secret:create',
 *   target: 'project-123',
 *   details: {
 *     description: 'Created secret API_KEY',
 *     context: { secretName: 'API_KEY' },
 *   },
 * });
 *
 * // Publish to relay
 * await relay.publish(event);
 * ```
 */
export function createAuditEvent(options: CreateAuditEventOptions): CreateAuditEventResult {
	const { userPubkey, userPrivkey, action, target, details } = options;

	const now = Math.floor(Date.now() / 1000);
	const expiresAt = now + NINETY_DAYS_SECONDS;

	// Parse user private key
	const privkey = parsePrivateKey(userPrivkey);

	// Create unique d-tag with timestamp for addressability
	const dTag = `${CloudDTags.AUDIT_PREFIX}.${now}`;

	// Encrypt details if provided
	let encryptedContent = '';
	if (details) {
		// Self-encrypt the details using NIP-44
		// The user encrypts to themselves so only they can read it
		const conversationKey = nip44.v2.utils.getConversationKey(privkey, userPubkey);
		encryptedContent = nip44.v2.encrypt(JSON.stringify(details), conversationKey);
	}

	// Create the inner rumor (unsigned event)
	const rumor: UnsignedEvent = {
		kind: CloudKinds.APP_DATA,
		pubkey: userPubkey,
		created_at: now,
		tags: [
			['d', dTag],
			['t', CloudTypeTags.AUDIT],
			['action', action],
			['target', target],
			['expiration', expiresAt.toString()], // NIP-40 expiration
		],
		content: encryptedContent,
	};

	// Wrap in NIP-59 Gift Wrap (to self)
	const wrappedEvent = wrapEventToSelf(rumor, privkey, userPubkey);

	const audit: AuditEvent = {
		action,
		target,
		timestamp: now,
		details,
		pubkey: userPubkey,
	};

	return { event: wrappedEvent, audit };
}

/**
 * Wrap an event in NIP-59 Gift Wrap (sending to self)
 */
function wrapEventToSelf(
	rumor: UnsignedEvent,
	senderPrivkey: Uint8Array,
	recipientPubkey: string,
): SignedEvent {
	const senderPubkey = getPublicKey(senderPrivkey);

	// Create seal (kind 13)
	const conversationKey = nip44.v2.utils.getConversationKey(senderPrivkey, recipientPubkey);
	const encryptedRumor = nip44.v2.encrypt(JSON.stringify(rumor), conversationKey);

	const seal: UnsignedEvent = {
		kind: CloudKinds.SEAL,
		pubkey: senderPubkey,
		created_at: randomPastTimestamp(),
		tags: [],
		content: encryptedRumor,
	};

	const signedSeal = finalizeEvent(seal, senderPrivkey) as SignedEvent;

	// Create gift wrap (kind 1059) with ephemeral key
	const ephemeralKey = generateSecretKey();
	const ephemeralPubkey = getPublicKey(ephemeralKey);

	const wrapConversationKey = nip44.v2.utils.getConversationKey(ephemeralKey, recipientPubkey);
	const encryptedSeal = nip44.v2.encrypt(JSON.stringify(signedSeal), wrapConversationKey);

	const giftWrap: UnsignedEvent = {
		kind: CloudKinds.GIFT_WRAP,
		pubkey: ephemeralPubkey,
		created_at: randomPastTimestamp(),
		tags: [
			['p', recipientPubkey],
			['t', CloudTypeTags.AUDIT], // Type tag for relay filtering
		],
		content: encryptedSeal,
	};

	return finalizeEvent(giftWrap, ephemeralKey) as SignedEvent;
}

/**
 * Unwrap and decrypt an audit event
 *
 * @param event - The Gift Wrap event containing the audit
 * @param userPrivkey - User's private key for decryption
 * @returns The audit event or null if decryption fails
 */
export function unwrapAuditEvent(event: SignedEvent, userPrivkey: Uint8Array): AuditEvent | null {
	try {
		const userPubkey = getPublicKey(userPrivkey);

		// Decrypt gift wrap to get seal
		const wrapConversationKey = nip44.v2.utils.getConversationKey(userPrivkey, event.pubkey);
		const sealJson = nip44.v2.decrypt(event.content, wrapConversationKey);
		const seal = JSON.parse(sealJson) as SignedEvent;

		// Decrypt seal to get rumor
		const sealConversationKey = nip44.v2.utils.getConversationKey(userPrivkey, seal.pubkey);
		const rumorJson = nip44.v2.decrypt(seal.content, sealConversationKey);
		const rumor = JSON.parse(rumorJson) as UnsignedEvent;

		// Verify it's an audit event
		const typeTag = rumor.tags.find((t) => t[0] === 't')?.[1];
		if (typeTag !== CloudTypeTags.AUDIT) {
			return null;
		}

		// Extract audit data from tags
		const action = rumor.tags.find((t) => t[0] === 'action')?.[1] as AuditAction;
		const target = rumor.tags.find((t) => t[0] === 'target')?.[1];

		if (!action || !target) {
			return null;
		}

		// Decrypt details if present
		let details: AuditDetails | undefined;
		if (rumor.content) {
			try {
				const conversationKey = nip44.v2.utils.getConversationKey(userPrivkey, userPubkey);
				const detailsJson = nip44.v2.decrypt(rumor.content, conversationKey);
				details = JSON.parse(detailsJson) as AuditDetails;
			} catch {
				// Content decryption failed, leave details undefined
			}
		}

		return {
			action,
			target,
			timestamp: rumor.created_at,
			details,
			pubkey: rumor.pubkey,
		};
	} catch {
		return null;
	}
}

/**
 * Create a Nostr filter to query for audit events
 *
 * @param pubkey - User's pubkey
 * @param since - Optional: only events after this timestamp
 * @returns Nostr filter object
 */
export function getAuditEventFilter(pubkey: string, since?: number) {
	const filter: Record<string, unknown> = {
		kinds: [CloudKinds.GIFT_WRAP],
		'#p': [pubkey],
		'#t': [CloudTypeTags.AUDIT],
	};

	if (since !== undefined) {
		filter.since = since;
	}

	return filter;
}

/**
 * Get human-readable description for an audit action
 */
export function getAuditActionLabel(action: AuditAction): string {
	const labels: Record<AuditAction, string> = {
		'secret:create': 'Created secret',
		'secret:update': 'Updated secret',
		'secret:delete': 'Deleted secret',
		'secret:read': 'Read secret',
		'subscription:start': 'Started subscription',
		'subscription:renew': 'Renewed subscription',
		'subscription:cancel': 'Cancelled subscription',
	};

	return labels[action] || action;
}
