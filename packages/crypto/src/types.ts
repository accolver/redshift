/**
 * Shared types for Redshift cryptographic operations
 *
 * These types are used by both CLI and Web implementations.
 */

/**
 * A signed Nostr event
 */
export interface NostrEvent {
	id: string;
	pubkey: string;
	created_at: number;
	kind: number;
	tags: string[][];
	content: string;
	sig: string;
}

/**
 * An unsigned Nostr event (rumor in NIP-59 terminology)
 */
export interface UnsignedEvent {
	pubkey: string;
	created_at: number;
	kind: number;
	tags: string[][];
	content: string;
}

/**
 * A bundle of secrets stored as key-value pairs.
 * All values are strings (environment variables are always strings).
 */
export interface SecretBundle {
	[key: string]: string;
}

/**
 * Result of wrapping secrets in NIP-59 Gift Wrap
 */
export interface GiftWrapResult {
	/** The outer Gift Wrap event (kind 1059) */
	event: NostrEvent;
	/** The inner unsigned rumor before wrapping */
	rumor: UnsignedEvent;
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
	/** The rumor's pubkey (real author) */
	pubkey: string;
}

/**
 * Nostr event kinds used by Redshift
 */
export const NostrKinds = {
	/** NIP-59: Gift Wrap */
	GIFT_WRAP: 1059,
	/** NIP-59: Seal */
	SEAL: 13,
	/** NIP-09: Deletion Request */
	DELETION: 5,
	/** Parameterized Replaceable Event for secrets (inner rumor kind) */
	SECRET_BUNDLE: 30078,
} as const;

/**
 * Tag used to identify Redshift secret events
 */
export const REDSHIFT_TYPE_TAG = 'redshift-secrets';
