/**
 * NIP-07 Browser Extension Interface
 * @see https://github.com/nostr-protocol/nips/blob/master/07.md
 */

export interface NostrEvent {
	id?: string;
	pubkey?: string;
	created_at?: number;
	kind: number;
	tags: string[][];
	content: string;
	sig?: string;
}

export interface SignedEvent extends NostrEvent {
	id: string;
	pubkey: string;
	created_at: number;
	sig: string;
}

export interface Nip07Nostr {
	getPublicKey(): Promise<string>;
	signEvent(event: NostrEvent): Promise<SignedEvent>;
	getRelays?(): Promise<Record<string, { read: boolean; write: boolean }>>;
	nip04?: {
		encrypt(pubkey: string, plaintext: string): Promise<string>;
		decrypt(pubkey: string, ciphertext: string): Promise<string>;
	};
	nip44?: {
		encrypt(pubkey: string, plaintext: string): Promise<string>;
		decrypt(pubkey: string, ciphertext: string): Promise<string>;
	};
}

declare global {
	interface Window {
		nostr?: Nip07Nostr;
	}
}

export type AuthMethod = 'nip07' | 'nsec' | 'bunker' | 'none';

/**
 * Project environment (e.g., dev, staging, production)
 */
export interface Environment {
	id: string;
	slug: string;
	name: string;
	createdAt: number;
}

/**
 * A Redshift project containing secrets organized by environment
 *
 * - `slug`: Immutable identifier used in d-tags for secrets (lowercase, hyphens only)
 * - `displayName`: Human-readable name shown in UI (can be changed)
 */
export interface Project {
	id: string;
	/** Immutable slug used as the project identifier in d-tags (lowercase, hyphens only) */
	slug: string;
	/** Human-readable display name (can be changed) */
	displayName: string;
	createdAt: number;
	environments: Environment[];
}

/**
 * Projects store state
 */
export interface ProjectsState {
	projects: Project[];
	isLoading: boolean;
	error: string | null;
}

/**
 * A single secret key-value pair
 */
export interface Secret {
	key: string;
	value: string;
}

/**
 * Secrets bundle for a project environment
 */
export interface SecretsBundle {
	projectId: string;
	environmentSlug: string;
	secrets: Secret[];
	updatedAt: number;
}

/**
 * Secrets store state for the current environment
 */
export interface SecretsState {
	secrets: Secret[];
	isLoading: boolean;
	isSaving: boolean;
	error: string | null;
}

/**
 * User profile metadata from kind 0 events
 * @see NIP-01, NIP-24
 */
export interface ProfileMetadata {
	name?: string;
	display_name?: string;
	picture?: string;
	about?: string;
	nip05?: string;
}

export interface AuthState {
	method: AuthMethod;
	pubkey: string | null;
	isConnected: boolean;
	error: string | null;
	profile: ProfileMetadata | null;
}
