/**
 * Core type definitions for Redshift
 * L4: Integration-Contractor - API Contracts
 */

/**
 * A bundle of secrets stored as key-value pairs.
 * Values can be primitives or complex objects (JSON-serialized when injected to env).
 */
export interface SecretBundle {
	[key: string]: string | number | boolean | object;
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
 * An unsigned Nostr event (rumor)
 */
export interface UnsignedEvent {
	pubkey: string;
	created_at: number;
	kind: number;
	tags: string[][];
	content: string;
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
	/** Parameterized Replaceable Event for secrets */
	SECRET_BUNDLE: 30078,
} as const;

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
	signEvent(event: UnsignedEvent): Promise<NostrEvent>;
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
