/**
 * Core type definitions for Redshift CLI
 *
 * Re-exports shared types from @redshift/crypto and adds CLI-specific types.
 *
 * L4: Integration-Contractor - API Contracts
 */

// Re-export shared types from crypto package
export type {
	NostrEvent,
	UnsignedEvent,
	SecretBundle,
	GiftWrapResult,
	UnwrapResult,
} from '@redshift/crypto';

export { NostrKinds, REDSHIFT_TYPE_TAG } from '@redshift/crypto';

/**
 * Configuration for a Redshift project
 * Stored in redshift.yaml
 */
export interface RedshiftConfig {
	/** Project identifier */
	project: string;
	/** Environment slug (e.g., 'development', 'production') */
	environment: string;
	/** Optional relay URLs to use */
	relays?: string[];
}

/**
 * Authentication method
 */
export type AuthMethod = 'nsec' | 'bunker' | 'nip07';

/**
 * Stored bunker connection info
 */
export interface BunkerAuth {
	/** Bunker public key */
	bunkerPubkey: string;
	/** Relay URLs for bunker communication */
	relays: string[];
	/** Optional secret for reconnection */
	secret?: string;
	/** Client secret key (hex encoded) */
	clientSecretKey: string;
}

/**
 * Unified signer interface for Nostr operations.
 *
 * Abstracts over local key (nsec) and remote signer (NIP-46 bunker)
 * so that all CLI commands can work with either auth method.
 *
 * L4: Integration-Contractor - Unified auth contract
 */
export interface NostrSigner {
	/** The user's public key (hex) */
	readonly pubkey: string;

	/** Sign a Nostr event template */
	signEvent(event: {
		kind: number;
		created_at: number;
		tags: string[][];
		content: string;
	}): Promise<{
		id: string;
		pubkey: string;
		created_at: number;
		kind: number;
		tags: string[][];
		content: string;
		sig: string;
	}>;

	/** Encrypt plaintext using NIP-44 */
	encrypt(pubkey: string, plaintext: string): Promise<string>;

	/** Decrypt ciphertext using NIP-44 */
	decrypt(pubkey: string, ciphertext: string): Promise<string>;

	/** Optional cleanup (e.g., close bunker connection) */
	close?(): Promise<void>;
}
