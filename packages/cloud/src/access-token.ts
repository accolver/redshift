/**
 * Access Token Generation and Validation
 *
 * Access tokens are NIP-78 events (Kind 30078) wrapped in NIP-59 Gift Wrap.
 * They grant Cloud subscribers access to the managed relay.
 */

import { getPublicKey, finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import { nip19 } from 'nostr-tools';
import * as nip44 from 'nostr-tools/nip44';
import { hexToBytes, bytesToHex } from 'nostr-tools/utils';

import {
	CloudKinds,
	CloudDTags,
	CloudTypeTags,
	type AccessToken,
	type AccessTokenContent,
	type CloudTier,
	type SignedEvent,
	type UnsignedEvent,
	type CreateTokenResult,
	type ValidateTokenResult,
} from './types';

/**
 * Duration constants
 */
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;
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
 * Sign a message with a private key (simple HMAC-based signature)
 */
function signMessage(_message: string, privateKey: Uint8Array): string {
	// Use the private key to create an HMAC signature
	const encoder = new TextEncoder();
	const messageBytes = encoder.encode(_message);
	const keyBytes = privateKey;

	// Simple XOR-based signature (in production, use proper schnorr)
	// This is a placeholder - real implementation should use nostr-tools signing
	const combined = new Uint8Array(32);
	for (let i = 0; i < 32; i++) {
		combined[i] = messageBytes[i % messageBytes.length] ^ keyBytes[i];
	}

	return bytesToHex(combined);
}

/**
 * Verify a message signature
 */
function verifySignature(_message: string, signature: string, _pubkey: string): boolean {
	// Placeholder verification - real implementation should verify schnorr signature
	// For now, just check that the signature is valid hex of correct length
	try {
		const sigBytes = hexToBytes(signature);
		return sigBytes.length === 32;
	} catch {
		return false;
	}
}

/**
 * Wrap an event in NIP-59 Gift Wrap
 */
function wrapEvent(
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
			['t', 'redshift-cloud'], // Type tag for relay filtering
		],
		content: encryptedSeal,
	};

	return finalizeEvent(giftWrap, ephemeralKey) as SignedEvent;
}

/**
 * Unwrap a NIP-59 Gift Wrap event
 */
function unwrapEvent(event: SignedEvent, recipientPrivkey: Uint8Array): UnsignedEvent | null {
	try {
		// Decrypt gift wrap to get seal
		const wrapConversationKey = nip44.v2.utils.getConversationKey(recipientPrivkey, event.pubkey);
		const sealJson = nip44.v2.decrypt(event.content, wrapConversationKey);
		const seal = JSON.parse(sealJson) as SignedEvent;

		// Decrypt seal to get rumor
		const sealConversationKey = nip44.v2.utils.getConversationKey(recipientPrivkey, seal.pubkey);
		const rumorJson = nip44.v2.decrypt(seal.content, sealConversationKey);
		return JSON.parse(rumorJson) as UnsignedEvent;
	} catch {
		return null;
	}
}

/**
 * Create an access token for a Cloud subscriber
 *
 * @param userPubkey - User's Nostr pubkey (hex)
 * @param operatorNsec - Relay operator's private key (nsec or hex)
 * @param invoiceId - BTCPay invoice ID
 * @param tier - Subscription tier
 * @param relayUrl - Managed relay URL
 * @returns The wrapped event and token data
 */
export function createAccessToken(
	userPubkey: string,
	operatorNsec: string,
	invoiceId: string,
	tier: CloudTier = 'cloud',
	relayUrl = 'wss://relay.redshiftapp.com',
): CreateTokenResult {
	const now = Math.floor(Date.now() / 1000);
	const expiresAt = now + THIRTY_DAYS_SECONDS;

	// Parse operator private key
	const operatorPrivkey = parsePrivateKey(operatorNsec);

	// Create signature for token verification
	const signatureMessage = `${userPubkey}:${tier}:${expiresAt}:${invoiceId}`;
	const signature = signMessage(signatureMessage, operatorPrivkey);

	// Token content
	const content: AccessTokenContent = {
		issuedAt: now,
		relayUrl,
		signature,
	};

	// Create the inner rumor (unsigned event)
	const rumor: UnsignedEvent = {
		kind: CloudKinds.APP_DATA,
		pubkey: userPubkey,
		created_at: now,
		tags: [
			['d', CloudDTags.ACCESS_TOKEN],
			['t', CloudTypeTags.CLOUD],
			['tier', tier],
			['expires', expiresAt.toString()],
			['invoice', invoiceId],
		],
		content: JSON.stringify(content),
	};

	// Wrap in NIP-59 Gift Wrap
	const wrappedEvent = wrapEvent(rumor, operatorPrivkey, userPubkey);

	const token: AccessToken = {
		tier,
		expiresAt,
		invoiceId,
		content,
		pubkey: userPubkey,
		createdAt: now,
	};

	return { event: wrappedEvent, token };
}

/**
 * Validate an access token event
 *
 * @param event - The Gift Wrap event containing the token
 * @param userPrivkey - User's private key for decryption
 * @param operatorPubkey - Relay operator's pubkey for signature verification
 * @returns Validation result
 */
export function validateAccessToken(
	event: SignedEvent,
	userPrivkey: Uint8Array,
	operatorPubkey: string,
): ValidateTokenResult {
	try {
		// Unwrap the Gift Wrap
		const rumor = unwrapEvent(event, userPrivkey);

		if (!rumor) {
			return { valid: false, reason: 'Failed to unwrap event' };
		}

		// Verify it's an access token
		const dTag = rumor.tags.find((t) => t[0] === 'd')?.[1];
		if (dTag !== CloudDTags.ACCESS_TOKEN) {
			return { valid: false, reason: 'Not an access token event' };
		}

		// Extract token data
		const tier = rumor.tags.find((t) => t[0] === 'tier')?.[1] as CloudTier;
		const expiresAt = Number(rumor.tags.find((t) => t[0] === 'expires')?.[1]);
		const invoiceId = rumor.tags.find((t) => t[0] === 'invoice')?.[1];

		if (!tier || !expiresAt || !invoiceId) {
			return { valid: false, reason: 'Missing required token fields' };
		}

		// Check expiration
		const now = Math.floor(Date.now() / 1000);
		if (expiresAt < now) {
			return { valid: false, reason: 'Token expired' };
		}

		// Parse content
		const content = JSON.parse(rumor.content) as AccessTokenContent;

		// Verify operator signature
		const signatureMessage = `${rumor.pubkey}:${tier}:${expiresAt}:${invoiceId}`;
		const isValidSig = verifySignature(signatureMessage, content.signature, operatorPubkey);

		if (!isValidSig) {
			return { valid: false, reason: 'Invalid operator signature' };
		}

		const token: AccessToken = {
			tier,
			expiresAt,
			invoiceId,
			content,
			pubkey: rumor.pubkey,
			createdAt: rumor.created_at,
		};

		return { valid: true, token };
	} catch (error) {
		return {
			valid: false,
			reason: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(token: AccessToken): boolean {
	const now = Math.floor(Date.now() / 1000);
	return token.expiresAt < now;
}

/**
 * Get days until token expiration
 */
export function getDaysUntilExpiry(token: AccessToken): number {
	const now = Math.floor(Date.now() / 1000);
	const secondsRemaining = token.expiresAt - now;
	return Math.max(0, Math.floor(secondsRemaining / (24 * 60 * 60)));
}

/**
 * Create a Nostr filter to query for access tokens
 */
export function getAccessTokenFilter(pubkey: string) {
	return {
		kinds: [CloudKinds.GIFT_WRAP],
		'#p': [pubkey],
		'#t': [CloudTypeTags.CLOUD],
	};
}
