/**
 * Cryptographic operations for Redshift CLI
 *
 * Re-exports from @redshift/crypto shared package with CLI-specific additions.
 *
 * L2: Function-Author - Core cryptographic functions
 * L4: Integration-Contractor - NIP-59, NIP-09 protocol compliance
 */

import { finalizeEvent } from 'nostr-tools/pure';

// Re-export everything from shared crypto package
export {
	wrapSecrets,
	unwrapSecrets,
	unwrapGiftWrap,
	createTombstone,
	wrapSecretsWithSigner,
	unwrapGiftWrapWithSigner,
	isRedshiftSecretsEvent,
	getRedshiftSecretsFilter,
	toNostrEvent,
	validateNsec,
	validateNpub,
	decodeNsec,
	decodeNpub,
	createDTag,
	parseDTag,
	NostrKinds,
	REDSHIFT_TYPE_TAG,
} from '@redshift/crypto';

export type {
	NostrEvent,
	UnsignedEvent,
	SecretBundle,
	GiftWrapResult,
	UnwrapResult,
	AsyncGiftWrapResult,
} from '@redshift/crypto';

// Import for local use
import { NostrKinds, toNostrEvent } from '@redshift/crypto';
import type { NostrEvent } from '@redshift/crypto';

/**
 * Create a NIP-09 deletion event for Gift Wrap events.
 *
 * Note: This function is CLI-specific and not in the shared package
 * because deletion events are typically signed by the user's real key,
 * not an ephemeral key.
 *
 * @param eventIds - IDs of Gift Wrap events to delete
 * @param privateKey - The owner's private key
 * @param reason - Optional reason for deletion
 * @returns The signed deletion event
 */
export function createDeletionEvent(
	eventIds: string[],
	privateKey: Uint8Array,
	reason?: string,
): NostrEvent {
	// Create tags with 'e' for each Gift Wrap event ID and 'k' to scope deletion to NIP-59 Gift Wraps.
	const tags: string[][] = [...eventIds.map((id) => ['e', id]), ['k', String(NostrKinds.GIFT_WRAP)]];

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
