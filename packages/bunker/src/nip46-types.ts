/**
 * NIP-46 protocol type definitions for @redshift/bunker
 *
 * Defines the wire protocol types for NIP-46 remote signer communication.
 * Kind 24133 events carry encrypted JSON payloads between client and bunker.
 */

/** NIP-46 request methods supported by the bunker */
export type Nip46Method =
	| 'connect'
	| 'get_public_key'
	| 'sign_event'
	| 'nip44_encrypt'
	| 'nip44_decrypt';

/** NIP-46 request payload (client → bunker) */
export interface Nip46Request {
	readonly id: string;
	readonly method: Nip46Method;
	readonly params: readonly string[];
}

/** NIP-46 response payload (bunker → client) */
export interface Nip46Response {
	readonly id: string;
	readonly result: string;
	readonly error?: string;
}

/** NIP-46 error response payload */
export interface Nip46ErrorResponse {
	readonly id: string;
	readonly result: string;
	readonly error: string;
}

/** Kind number for NIP-46 events */
export const NIP46_KIND = 24133;

/** RBAC permission identifiers */
export type Permission = 'readSecrets' | 'writeSecrets' | 'manageMembers' | 'deleteTeam';

/** Configuration for the NIP-46 server */
export interface Nip46ServerConfig {
	/** Relay URLs to subscribe to */
	readonly relays: readonly string[];
	/** Session timeout in seconds (default: 86400 = 24h) */
	readonly sessionTimeoutSeconds: number;
}

/**
 * Represents a team key pair managed by the bunker.
 * The bunker holds the private key and signs on behalf of authorized members.
 */
export interface TeamKeyInfo {
	readonly teamId: string;
	readonly pubkey: string;
	readonly privateKey: Uint8Array;
}

/**
 * Incoming NIP-46 event context — the decrypted request
 * along with metadata about who sent it and which team it targets.
 */
export interface Nip46RequestContext {
	readonly request: Nip46Request;
	readonly senderPubkey: string;
	readonly teamPubkey: string;
}
