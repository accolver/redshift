import type { AuthState, ProfileMetadata } from '$lib/types/nostr';
import { SimplePool } from 'nostr-tools/pool';
import {
	secureStore,
	secureRetrieve,
	secureRemove,
	isSecureStorageAvailable,
} from './secure-storage';

/**
 * Authentication store using Svelte 5 Runes
 * Handles NIP-07 browser extension and local nsec authentication
 *
 * Security: When using nsec, the private key is encrypted with a non-extractable
 * AES-GCM key stored in IndexedDB before being saved to sessionStorage.
 * See secure-storage.ts for details.
 */

const NSEC_STORAGE_KEY = 'sk';

// Default relays for fetching profile metadata
const DEFAULT_RELAYS = [
	'wss://relay.damus.io',
	'wss://relay.primal.net',
	'wss://nos.lol',
	'wss://relay.nostr.band',
];

// Auth state using $state rune
let authState = $state<AuthState>({
	method: 'none',
	pubkey: null,
	isConnected: false,
	error: null,
	profile: null,
});

/**
 * Fetch user profile metadata (kind 0) from relays
 */
async function fetchProfile(pubkey: string): Promise<ProfileMetadata | null> {
	const pool = new SimplePool();

	try {
		const event = await pool.get(DEFAULT_RELAYS, {
			kinds: [0],
			authors: [pubkey],
			limit: 1,
		});

		if (event?.content) {
			const metadata = JSON.parse(event.content) as ProfileMetadata;
			return metadata;
		}
		return null;
	} catch (err) {
		console.error('Failed to fetch profile:', err);
		return null;
	} finally {
		pool.close(DEFAULT_RELAYS);
	}
}

/**
 * Check if NIP-07 extension is available
 */
export function hasNip07Extension(): boolean {
	return typeof window !== 'undefined' && typeof window.nostr !== 'undefined';
}

/**
 * Connect using NIP-07 browser extension (Alby, nos2x, etc.)
 */
export async function connectWithNip07(): Promise<boolean> {
	if (!hasNip07Extension()) {
		authState.error = 'No NIP-07 extension found. Install Alby or nos2x.';
		return false;
	}

	try {
		const pubkey = await window.nostr!.getPublicKey();
		authState = {
			method: 'nip07',
			pubkey,
			isConnected: true,
			error: null,
			profile: null,
		};
		// Fetch profile in background
		fetchProfile(pubkey).then((profile) => {
			if (profile) authState.profile = profile;
		});
		return true;
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to connect';
		authState.error = message;
		return false;
	}
}

/**
 * Connect using a local nsec (private key)
 *
 * Security: The nsec is encrypted with a non-extractable AES-GCM key
 * before being stored in sessionStorage. See secure-storage.ts for details.
 */
export async function connectWithNsec(nsec: string): Promise<boolean> {
	try {
		// Dynamic import to avoid bundling nostr-tools for users who don't need it
		const { nip19, getPublicKey } = await import('nostr-tools');

		let secretKey: Uint8Array;

		if (nsec.startsWith('nsec')) {
			const decoded = nip19.decode(nsec);
			if (decoded.type !== 'nsec') {
				throw new Error('Invalid nsec format');
			}
			secretKey = decoded.data;
		} else {
			// Assume hex format
			secretKey = Uint8Array.from(Buffer.from(nsec, 'hex'));
		}

		const pubkey = getPublicKey(secretKey);

		// Securely store the nsec (encrypted, cleared on tab close)
		if (isSecureStorageAvailable()) {
			await secureStore(NSEC_STORAGE_KEY, nsec);
		}
		// Note: If secure storage unavailable, we don't persist the key at all

		authState = {
			method: 'nsec',
			pubkey,
			isConnected: true,
			error: null,
			profile: null,
		};
		// Fetch profile in background
		fetchProfile(pubkey).then((profile) => {
			if (profile) authState.profile = profile;
		});
		return true;
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Invalid private key';
		authState.error = message;
		return false;
	}
}

/**
 * Disconnect and clear auth state
 */
export function disconnect(): void {
	secureRemove(NSEC_STORAGE_KEY);
	authState = {
		method: 'none',
		pubkey: null,
		isConnected: false,
		error: null,
		profile: null,
	};
}

/**
 * Get current auth state (reactive)
 */
export function getAuthState(): AuthState {
	return authState;
}

/**
 * Clear any auth error
 */
export function clearError(): void {
	authState.error = null;
}

/**
 * Try to restore auth from secure storage (for nsec) or check NIP-07
 */
export async function restoreAuth(): Promise<boolean> {
	// First check for securely stored nsec
	if (isSecureStorageAvailable()) {
		const storedNsec = await secureRetrieve(NSEC_STORAGE_KEY);
		if (storedNsec) {
			return connectWithNsec(storedNsec);
		}
	}

	// If no stored nsec, don't auto-connect NIP-07 (require explicit action)
	return false;
}
