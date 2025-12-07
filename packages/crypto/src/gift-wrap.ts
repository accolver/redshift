/**
 * NIP-59 Gift Wrap implementation for Redshift
 *
 * Implements encrypted secret storage using:
 * - NIP-44: Versioned encryption (XChaCha20-Poly1305)
 * - NIP-59: Gift Wrap (rumor -> seal -> gift wrap)
 *
 * Key feature: Adds ["t", "redshift-secrets"] tag to outer event
 * for efficient relay filtering while keeping content encrypted.
 */

import type { Event as NostrToolsEvent } from 'nostr-tools/core';
import { createRumor, createSeal, unwrapEvent } from 'nostr-tools/nip59';
import { nip44 } from 'nostr-tools';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import type { GiftWrapResult, NostrEvent, SecretBundle, UnwrapResult } from './types.js';
import { NostrKinds, REDSHIFT_TYPE_TAG } from './types.js';

/**
 * Random timestamp within the last 2 days (for metadata protection)
 */
const TWO_DAYS = 2 * 24 * 60 * 60;
const randomNow = () => Math.round(Date.now() / 1000 - Math.random() * TWO_DAYS);

/**
 * Convert nostr-tools Event to our NostrEvent type
 */
function toNostrEvent(event: NostrToolsEvent): NostrEvent {
	return {
		id: event.id,
		pubkey: event.pubkey,
		created_at: event.created_at,
		kind: event.kind,
		tags: event.tags,
		content: event.content,
		sig: event.sig,
	};
}

/**
 * Wrap secrets in a NIP-59 Gift Wrap event.
 * The secrets are encrypted so only the owner (holder of privateKey) can decrypt.
 *
 * Adds ["t", "redshift-secrets"] tag to the outer event for relay filtering.
 *
 * @param secrets - The secret bundle to wrap
 * @param privateKey - The owner's private key (32 bytes)
 * @param dTag - The d-tag identifier (format: "projectId|environment")
 * @returns The wrapped event and original rumor
 */
export function wrapSecrets(
	secrets: SecretBundle,
	privateKey: Uint8Array,
	dTag: string,
): GiftWrapResult {
	// Get the public key from private key (we wrap to ourselves)
	const publicKey = getPublicKey(privateKey);

	// Create the rumor (unsigned event) with kind 30078 (parameterized replaceable)
	const rumor = createRumor(
		{
			kind: NostrKinds.SECRET_BUNDLE,
			content: JSON.stringify(secrets),
			tags: [['d', dTag]],
			created_at: Math.floor(Date.now() / 1000),
		},
		privateKey,
	);

	// Create the seal (kind 13) - encrypts the rumor
	const seal = createSeal(rumor, privateKey, publicKey);

	// Create the gift wrap (kind 1059) - encrypts the seal
	// We create our own wrap to include the type tag before signing
	const ephemeralKey = generateSecretKey();
	const conversationKey = nip44.v2.utils.getConversationKey(ephemeralKey, publicKey);
	const encryptedSeal = nip44.v2.encrypt(JSON.stringify(seal), conversationKey);

	const giftWrap = finalizeEvent(
		{
			kind: NostrKinds.GIFT_WRAP,
			content: encryptedSeal,
			created_at: randomNow(),
			tags: [
				['p', publicKey],
				['t', REDSHIFT_TYPE_TAG],
			],
		},
		ephemeralKey,
	);

	return {
		event: toNostrEvent(giftWrap),
		rumor: {
			pubkey: rumor.pubkey,
			created_at: rumor.created_at,
			kind: rumor.kind,
			tags: rumor.tags,
			content: rumor.content,
		},
	};
}

/**
 * Unwrap a NIP-59 Gift Wrap event to retrieve secrets.
 *
 * @param giftWrap - The Gift Wrap event to unwrap
 * @param privateKey - The recipient's private key
 * @returns The decrypted secret bundle
 * @throws Error if event cannot be unwrapped or content is invalid
 */
export function unwrapSecrets(giftWrap: NostrEvent, privateKey: Uint8Array): SecretBundle {
	const result = unwrapGiftWrap(giftWrap, privateKey);
	return result.secrets;
}

/**
 * Unwrap a NIP-59 Gift Wrap event with full metadata.
 *
 * @param giftWrap - The Gift Wrap event to unwrap
 * @param privateKey - The recipient's private key
 * @returns The decrypted secrets with metadata (d-tag, timestamp, pubkey)
 * @throws Error if event cannot be unwrapped or content is invalid
 */
export function unwrapGiftWrap(giftWrap: NostrEvent, privateKey: Uint8Array): UnwrapResult {
	// Unwrap the gift wrap to get the rumor
	const rumor = unwrapEvent(giftWrap as NostrToolsEvent, privateKey);

	// Parse the content as JSON to get the secrets
	let secrets: unknown;
	try {
		secrets = JSON.parse(rumor.content);
	} catch {
		throw new Error('Failed to parse secret bundle: invalid JSON content');
	}

	// Validate the parsed content is an object (SecretBundle)
	if (secrets === null || typeof secrets !== 'object' || Array.isArray(secrets)) {
		throw new Error('Invalid secret bundle: expected an object');
	}

	// Extract d-tag from rumor
	const dTagEntry = rumor.tags.find((t: string[]) => t[0] === 'd');
	const dTag = dTagEntry ? (dTagEntry[1] ?? null) : null;

	return {
		secrets: secrets as SecretBundle,
		dTag,
		createdAt: rumor.created_at,
		pubkey: rumor.pubkey,
	};
}

/**
 * Create a tombstone event (empty secret bundle) for logical deletion.
 *
 * @param privateKey - The owner's private key
 * @param dTag - The d-tag of the environment to tombstone
 * @returns The wrapped tombstone event
 */
export function createTombstone(privateKey: Uint8Array, dTag: string): GiftWrapResult {
	return wrapSecrets({}, privateKey, dTag);
}

/**
 * Encryption function type for signer-based Gift Wrap.
 * This matches the signature of NIP-07 and NIP-46 encrypt functions.
 */
export type EncryptFn = (pubkey: string, plaintext: string) => Promise<string>;

/**
 * Async result type for signer-based Gift Wrap
 */
export interface AsyncGiftWrapResult {
	event: NostrEvent;
	rumor: {
		pubkey: string;
		created_at: number;
		kind: number;
		tags: string[][];
		content: string;
	};
}

/**
 * Wrap secrets using NIP-07/NIP-46 signer for encryption.
 *
 * This function works with browser extensions (NIP-07) and remote signers (NIP-46)
 * by delegating the Seal encryption to the provided encrypt function, while using
 * a locally-generated ephemeral key for the outer Gift Wrap layer.
 *
 * Flow:
 * 1. Create Rumor (unsigned event with secrets)
 * 2. Create Seal by encrypting Rumor to self using signer's nip44.encrypt
 * 3. Create Gift Wrap by encrypting Seal with local ephemeral key
 *
 * @param secrets - The secret bundle to wrap
 * @param pubkey - The user's public key (hex)
 * @param dTag - The d-tag identifier (format: "projectId|environment")
 * @param encryptFn - NIP-44 encrypt function from signer (pubkey, plaintext) => ciphertext
 * @returns The wrapped event and original rumor
 */
export async function wrapSecretsWithSigner(
	secrets: SecretBundle,
	pubkey: string,
	dTag: string,
	encryptFn: EncryptFn,
): Promise<AsyncGiftWrapResult> {
	// Create the rumor (unsigned event) with kind 30078 (parameterized replaceable)
	// Note: We manually construct this since we don't have a private key for createRumor
	const rumor = {
		pubkey: pubkey,
		created_at: Math.floor(Date.now() / 1000),
		kind: NostrKinds.SECRET_BUNDLE,
		tags: [['d', dTag]],
		content: JSON.stringify(secrets),
	};

	// Create the seal (kind 13) - encrypts the rumor to ourselves
	// The seal content is the rumor encrypted with NIP-44 to our own pubkey
	const sealContent = await encryptFn(pubkey, JSON.stringify(rumor));

	const seal = {
		pubkey: pubkey,
		created_at: randomNow(), // Randomized for privacy
		kind: 13, // Seal kind
		tags: [],
		content: sealContent,
	};

	// Create the gift wrap (kind 1059) - encrypts the seal with ephemeral key
	// This layer uses a locally-generated key (doesn't need signer)
	const ephemeralKey = generateSecretKey();
	const conversationKey = nip44.v2.utils.getConversationKey(ephemeralKey, pubkey);
	const encryptedSeal = nip44.v2.encrypt(JSON.stringify(seal), conversationKey);

	const giftWrap = finalizeEvent(
		{
			kind: NostrKinds.GIFT_WRAP,
			content: encryptedSeal,
			created_at: randomNow(),
			tags: [
				['p', pubkey],
				['t', REDSHIFT_TYPE_TAG],
			],
		},
		ephemeralKey,
	);

	return {
		event: toNostrEvent(giftWrap),
		rumor: {
			pubkey: rumor.pubkey,
			created_at: rumor.created_at,
			kind: rumor.kind,
			tags: rumor.tags,
			content: rumor.content,
		},
	};
}

/**
 * Decryption function type for signer-based Gift Wrap unwrapping.
 */
export type DecryptFn = (pubkey: string, ciphertext: string) => Promise<string>;

/**
 * Unwrap a Gift Wrap event using NIP-07/NIP-46 signer for decryption.
 *
 * @param giftWrap - The Gift Wrap event to unwrap
 * @param decryptFn - NIP-44 decrypt function from signer
 * @returns The decrypted secrets with metadata
 */
export async function unwrapGiftWrapWithSigner(
	giftWrap: NostrEvent,
	decryptFn: DecryptFn,
): Promise<UnwrapResult> {
	// Get the ephemeral pubkey from the gift wrap event
	const ephemeralPubkey = giftWrap.pubkey;

	// Decrypt the outer layer (Gift Wrap -> Seal)
	// This uses the signer because we need our private key to decrypt from ephemeral
	const sealJson = await decryptFn(ephemeralPubkey, giftWrap.content);
	const seal = JSON.parse(sealJson) as { pubkey: string; content: string };

	// Decrypt the inner layer (Seal -> Rumor)
	// The seal was encrypted to ourselves, so decrypt from seal's pubkey
	const rumorJson = await decryptFn(seal.pubkey, seal.content);
	const rumor = JSON.parse(rumorJson) as {
		pubkey: string;
		created_at: number;
		kind: number;
		tags: string[][];
		content: string;
	};

	// Parse the rumor content as secrets
	let secrets: unknown;
	try {
		secrets = JSON.parse(rumor.content);
	} catch {
		throw new Error('Failed to parse secret bundle: invalid JSON content');
	}

	if (secrets === null || typeof secrets !== 'object' || Array.isArray(secrets)) {
		throw new Error('Invalid secret bundle: expected an object');
	}

	// Extract d-tag from rumor
	const dTagEntry = rumor.tags.find((t: string[]) => t[0] === 'd');
	const dTag = dTagEntry ? (dTagEntry[1] ?? null) : null;

	return {
		secrets: secrets as SecretBundle,
		dTag,
		createdAt: rumor.created_at,
		pubkey: rumor.pubkey,
	};
}

/**
 * Check if an event is a Redshift secrets event by looking for the type tag.
 *
 * @param event - The event to check
 * @returns True if the event has the redshift-secrets type tag
 */
export function isRedshiftSecretsEvent(event: NostrEvent): boolean {
	return (
		event.kind === NostrKinds.GIFT_WRAP &&
		event.tags.some((t) => t[0] === 't' && t[1] === REDSHIFT_TYPE_TAG)
	);
}

/**
 * Get the Nostr filter for querying Redshift secrets from relays.
 *
 * @param pubkey - The user's public key
 * @returns Filter object for relay subscription
 */
export function getRedshiftSecretsFilter(pubkey: string): {
	kinds: number[];
	'#p': string[];
	'#t': string[];
} {
	return {
		kinds: [NostrKinds.GIFT_WRAP],
		'#p': [pubkey],
		'#t': [REDSHIFT_TYPE_TAG],
	};
}
