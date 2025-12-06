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
 * CLI command types
 */
export type CommandName =
	| 'login'
	| 'logout'
	| 'setup'
	| 'run'
	| 'secrets'
	| 'serve'
	| 'help'
	| 'version';

/**
 * Parsed CLI command result
 */
export interface ParsedCommand {
	command: CommandName;
	args: string[];
	flags: Record<string, string | boolean>;
}

/**
 * NIP-07 browser extension interface
 */
export interface Nip07Extension {
	getPublicKey(): Promise<string>;
	signEvent(
		event: import('@redshift/crypto').UnsignedEvent,
	): Promise<import('@redshift/crypto').NostrEvent>;
	getRelays?(): Promise<Record<string, { read: boolean; write: boolean }>>;
	nip04?: {
		encrypt(pubkey: string, plaintext: string): Promise<string>;
		decrypt(pubkey: string, ciphertext: string): Promise<string>;
	};
}

/**
 * Declare window.nostr for NIP-07 extensions
 */
declare global {
	interface Window {
		nostr?: Nip07Extension;
	}
}
