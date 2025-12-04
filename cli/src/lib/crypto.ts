/**
 * Cryptographic operations for Redshift
 * Implements NIP-59 Gift Wrap for secret storage
 *
 * L2: Function-Author - Core cryptographic functions
 * L4: Integration-Contractor - NIP-59, NIP-09 protocol compliance
 */

import type { Event as NostrToolsEvent } from 'nostr-tools/core';
import { decode as nip19Decode } from 'nostr-tools/nip19';
import { createRumor, createSeal, createWrap, unwrapEvent } from 'nostr-tools/nip59';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import type { GiftWrapResult, NostrEvent, SecretBundle, UnsignedEvent } from './types';
import { NostrKinds } from './types';

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
 * @param secrets - The secret bundle to wrap
 * @param privateKey - The owner's private key (nsec decoded to bytes)
 * @param dTag - The d-tag identifier (format: "projectId|environment")
 * @returns The wrapped event and original rumor
 */
export async function wrapSecrets(
	secrets: SecretBundle,
	privateKey: Uint8Array,
	dTag: string,
): Promise<GiftWrapResult> {
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
	const giftWrap = createWrap(seal, publicKey);

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
 * Result of unwrapping a Gift Wrap event
 */
export interface UnwrapResult {
	/** The decrypted secret bundle */
	secrets: SecretBundle;
	/** The d-tag from the inner rumor */
	dTag: string | null;
	/** The rumor's created_at timestamp */
	createdAt: number;
	/** The rumor's pubkey */
	pubkey: string;
}

/**
 * Unwrap a NIP-59 Gift Wrap event to retrieve secrets.
 *
 * @param giftWrap - The Gift Wrap event to unwrap
 * @param privateKey - The recipient's private key
 * @returns The decrypted secret bundle
 * @throws Error if event cannot be unwrapped or content is invalid
 */
export async function unwrapSecrets(
	giftWrap: NostrEvent,
	privateKey: Uint8Array,
): Promise<SecretBundle> {
	const result = await unwrapGiftWrap(giftWrap, privateKey);
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
export async function unwrapGiftWrap(
	giftWrap: NostrEvent,
	privateKey: Uint8Array,
): Promise<UnwrapResult> {
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
	const dTagEntry = rumor.tags.find((t) => t[0] === 'd');
	const dTag = dTagEntry ? (dTagEntry[1] ?? null) : null;

	return {
		secrets: secrets as SecretBundle,
		dTag,
		createdAt: rumor.created_at,
		pubkey: rumor.pubkey,
	};
}

/**
 * Create a NIP-09 deletion event for Gift Wrap events.
 *
 * @param eventIds - IDs of Gift Wrap events to delete
 * @param privateKey - The owner's private key
 * @param reason - Optional reason for deletion
 * @returns The signed deletion event
 */
export async function createDeletionEvent(
	eventIds: string[],
	privateKey: Uint8Array,
	reason?: string,
): Promise<NostrEvent> {
	// Create tags with 'e' for each event ID to delete
	const tags: string[][] = eventIds.map((id) => ['e', id]);

	// Create and sign the deletion event (kind 5)
	const event = finalizeEvent(
		{
			kind: NostrKinds.DELETION,
			content: reason ?? '',
			tags,
			created_at: Math.floor(Date.now() / 1000),
		},
		privateKey,
	);

	return toNostrEvent(event);
}

/**
 * Create a tombstone event (empty secret bundle) for logical deletion.
 *
 * @param privateKey - The owner's private key
 * @param dTag - The d-tag of the environment to tombstone
 * @returns The wrapped tombstone event
 */
export async function createTombstone(
	privateKey: Uint8Array,
	dTag: string,
): Promise<GiftWrapResult> {
	return wrapSecrets({}, privateKey, dTag);
}

/**
 * Validate that a string is a valid nsec (bech32 encoded private key).
 * Uses nip19.decode() for checksum validation, not just format matching.
 *
 * @param nsec - The string to validate
 * @returns True if valid nsec with correct checksum
 */
export function validateNsec(nsec: string): boolean {
	try {
		const decoded = nip19Decode(nsec);
		return decoded.type === 'nsec';
	} catch {
		return false;
	}
}

/**
 * Validate that a string is a valid npub (bech32 encoded public key).
 * Uses nip19.decode() for checksum validation, not just format matching.
 *
 * @param npub - The string to validate
 * @returns True if valid npub with correct checksum
 */
export function validateNpub(npub: string): boolean {
	try {
		const decoded = nip19Decode(npub);
		return decoded.type === 'npub';
	} catch {
		return false;
	}
}

/**
 * Decode an nsec string to raw private key bytes.
 *
 * @param nsec - The nsec string to decode
 * @returns The raw private key bytes
 * @throws Error if nsec is invalid
 */
export function decodeNsec(nsec: string): Uint8Array {
	const decoded = nip19Decode(nsec);
	if (decoded.type !== 'nsec') {
		throw new Error(`Expected nsec, got ${decoded.type}`);
	}
	return decoded.data;
}

/**
 * Decode an npub string to raw public key hex.
 *
 * @param npub - The npub string to decode
 * @returns The raw public key as hex string
 * @throws Error if npub is invalid
 */
export function decodeNpub(npub: string): string {
	const decoded = nip19Decode(npub);
	if (decoded.type !== 'npub') {
		throw new Error(`Expected npub, got ${decoded.type}`);
	}
	return decoded.data;
}

/**
 * Create a d-tag from project ID and environment.
 *
 * @param projectId - The project identifier
 * @param environment - The environment slug
 * @returns Formatted d-tag string
 */
export function createDTag(projectId: string, environment: string): string {
	return `${projectId}|${environment}`;
}

/**
 * Parse a d-tag into project ID and environment.
 *
 * @param dTag - The d-tag string to parse
 * @returns Object with projectId and environment, or null if invalid
 */
export function parseDTag(dTag: string): { projectId: string; environment: string } | null {
	const parts = dTag.split('|');
	if (parts.length !== 2 || !parts[0] || !parts[1]) {
		return null;
	}
	return {
		projectId: parts[0],
		environment: parts[1],
	};
}

// Re-export types for convenience
export { NostrKinds };
export type { GiftWrapResult, NostrEvent, SecretBundle, UnsignedEvent };
