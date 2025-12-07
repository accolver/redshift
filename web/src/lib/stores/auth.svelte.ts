import type { AuthState, ProfileMetadata, NostrEvent, SignedEvent } from '$lib/types/nostr';
import { SimplePool } from 'nostr-tools/pool';
import {
	secureStore,
	secureRetrieve,
	secureRemove,
	isSecureStorageAvailable,
} from './secure-storage';
import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import { nip19, getPublicKey } from 'nostr-tools';
import { BunkerSigner, parseBunkerInput } from 'nostr-tools/nip46';

/**
 * Authentication store using Svelte 5 Runes
 * Handles NIP-07 browser extension, local nsec, and NIP-46 bunker authentication
 *
 * Security: When using nsec, the private key is encrypted with a non-extractable
 * AES-GCM key stored in IndexedDB before being saved to sessionStorage.
 * See secure-storage.ts for details.
 */

const NSEC_STORAGE_KEY = 'sk';
const BUNKER_LOCAL_KEY = 'bunker_local_sk';
const BUNKER_URI_KEY = 'bunker_uri';

// Active bunker signer instance (kept in memory, not serializable)
let activeBunkerSigner: BunkerSigner | null = null;

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
 * Parse an nsec string (bech32 or hex) into a Uint8Array secret key
 */
function parseNsec(nsec: string): Uint8Array {
	if (nsec.startsWith('nsec')) {
		const decoded = nip19.decode(nsec);
		if (decoded.type !== 'nsec') {
			throw new Error('Invalid nsec format');
		}
		return decoded.data;
	}
	// Assume hex format
	return Uint8Array.from(Buffer.from(nsec, 'hex'));
}

/**
 * Connect using a local nsec (private key)
 *
 * Security: The nsec is encrypted with a non-extractable AES-GCM key
 * before being stored in sessionStorage. See secure-storage.ts for details.
 */
export async function connectWithNsec(nsec: string): Promise<boolean> {
	try {
		const secretKey = parseNsec(nsec);
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
 * Connect using a NIP-46 bunker URI
 *
 * The bunker URI format is: bunker://<remote-signer-pubkey>?relay=<relay-url>&secret=<secret>
 *
 * @param bunkerUri - The bunker connection URI (e.g., bunker://... or nostrconnect://...)
 */
export async function connectWithBunker(bunkerUri: string): Promise<boolean> {
	try {
		// Parse the bunker URI
		const bunkerPointer = await parseBunkerInput(bunkerUri);
		if (!bunkerPointer) {
			throw new Error('Invalid bunker URI');
		}

		// Generate or retrieve a local secret key for the bunker session
		let localSecretKey: Uint8Array;
		if (isSecureStorageAvailable()) {
			const storedLocalKey = await secureRetrieve(BUNKER_LOCAL_KEY);
			if (storedLocalKey) {
				localSecretKey = parseNsec(storedLocalKey);
			} else {
				localSecretKey = generateSecretKey();
				const localNsec = nip19.nsecEncode(localSecretKey);
				await secureStore(BUNKER_LOCAL_KEY, localNsec);
			}
		} else {
			// Generate ephemeral key if secure storage unavailable
			localSecretKey = generateSecretKey();
		}

		// Create the bunker signer instance
		const pool = new SimplePool();
		const bunker = BunkerSigner.fromBunker(localSecretKey, bunkerPointer, { pool });

		// Connect to the bunker (this may prompt user approval in the bunker app)
		await bunker.connect();

		// Get the user's pubkey from the bunker
		const pubkey = await bunker.getPublicKey();

		// Store the bunker instance and URI
		activeBunkerSigner = bunker;
		if (isSecureStorageAvailable()) {
			await secureStore(BUNKER_URI_KEY, bunkerUri);
		}

		authState = {
			method: 'bunker',
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
		const message = err instanceof Error ? err.message : 'Failed to connect to bunker';
		authState.error = message;
		return false;
	}
}

/**
 * Disconnect and clear auth state
 */
export async function disconnect(): Promise<void> {
	// Clean up bunker connection if active
	if (activeBunkerSigner) {
		try {
			await activeBunkerSigner.close();
		} catch {
			// Ignore errors during cleanup
		}
		activeBunkerSigner = null;
	}

	// Remove stored credentials
	secureRemove(NSEC_STORAGE_KEY);
	secureRemove(BUNKER_LOCAL_KEY);
	secureRemove(BUNKER_URI_KEY);

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
 * Try to restore auth from secure storage (nsec or bunker)
 */
export async function restoreAuth(): Promise<boolean> {
	if (!isSecureStorageAvailable()) {
		return false;
	}

	// First check for securely stored nsec
	const storedNsec = await secureRetrieve(NSEC_STORAGE_KEY);
	if (storedNsec) {
		return connectWithNsec(storedNsec);
	}

	// Check for stored bunker URI
	const storedBunkerUri = await secureRetrieve(BUNKER_URI_KEY);
	if (storedBunkerUri) {
		return connectWithBunker(storedBunkerUri);
	}

	// If nothing stored, don't auto-connect (require explicit action)
	return false;
}

/**
 * Get the raw private key for encryption operations.
 * Only available when using nsec authentication.
 *
 * @returns The private key as Uint8Array, or null if not available
 */
export async function getPrivateKey(): Promise<Uint8Array | null> {
	if (authState.method !== 'nsec' || !authState.isConnected) {
		return null;
	}

	const storedNsec = await secureRetrieve(NSEC_STORAGE_KEY);
	if (!storedNsec) {
		return null;
	}

	return parseNsec(storedNsec);
}

/**
 * Check if the current auth method supports NIP-59 Gift Wrap encryption.
 *
 * Supports:
 * - nsec: Direct private key access
 * - NIP-07: Browser extension with nip44 support
 * - bunker: Remote signer with nip44 support
 *
 * @returns true if Gift Wrap encryption is supported
 */
export function supportsEncryption(): boolean {
	if (authState.method === 'nsec') {
		return true;
	}

	if (authState.method === 'nip07' && window.nostr?.nip44) {
		return true;
	}

	if (authState.method === 'bunker' && activeBunkerSigner) {
		return true;
	}

	return false;
}

/**
 * Get NIP-44 encrypt function for the current auth method.
 * Used for signer-based Gift Wrap encryption.
 *
 * @returns Encrypt function or null if not supported
 */
export function getEncryptFn(): ((pubkey: string, plaintext: string) => Promise<string>) | null {
	if (authState.method === 'nip07' && window.nostr?.nip44) {
		return (pubkey: string, plaintext: string) => window.nostr!.nip44!.encrypt(pubkey, plaintext);
	}

	if (authState.method === 'bunker' && activeBunkerSigner) {
		return (pubkey: string, plaintext: string) =>
			activeBunkerSigner!.nip44Encrypt(pubkey, plaintext);
	}

	// nsec doesn't need this - it uses the direct wrapSecrets function
	return null;
}

/**
 * Get NIP-44 decrypt function for the current auth method.
 * Used for signer-based Gift Wrap decryption.
 *
 * @returns Decrypt function or null if not supported
 */
export function getDecryptFn(): ((pubkey: string, ciphertext: string) => Promise<string>) | null {
	if (authState.method === 'nip07' && window.nostr?.nip44) {
		return (pubkey: string, ciphertext: string) => window.nostr!.nip44!.decrypt(pubkey, ciphertext);
	}

	if (authState.method === 'bunker' && activeBunkerSigner) {
		return (pubkey: string, ciphertext: string) =>
			activeBunkerSigner!.nip44Decrypt(pubkey, ciphertext);
	}

	// nsec doesn't need this - it uses the direct unwrapGiftWrap function
	return null;
}

/**
 * Sign an event using the current authentication method
 *
 * For NIP-07: Uses the browser extension to sign
 * For nsec: Signs locally using nostr-tools
 * For bunker: Uses the remote NIP-46 signer
 *
 * @param event - The unsigned event to sign (must have kind, tags, content)
 * @returns The signed event with id, pubkey, created_at, and sig
 */
export async function signEvent(event: NostrEvent): Promise<SignedEvent> {
	if (!authState.isConnected || !authState.pubkey) {
		throw new Error('Not authenticated');
	}

	// Ensure event has created_at
	const eventWithTimestamp = {
		...event,
		created_at: event.created_at ?? Math.floor(Date.now() / 1000),
	};

	if (authState.method === 'nip07') {
		// Use NIP-07 browser extension
		if (!window.nostr) {
			throw new Error('NIP-07 extension not available');
		}
		return await window.nostr.signEvent(eventWithTimestamp);
	}

	if (authState.method === 'nsec') {
		// Sign locally using stored nsec
		const storedNsec = await secureRetrieve(NSEC_STORAGE_KEY);
		if (!storedNsec) {
			throw new Error('Private key not found in secure storage');
		}

		const secretKey = parseNsec(storedNsec);

		// Use nostr-tools finalizeEvent which adds id, pubkey, and sig
		const signedEvent = finalizeEvent(eventWithTimestamp, secretKey);

		return signedEvent as SignedEvent;
	}

	if (authState.method === 'bunker') {
		// Use NIP-46 bunker for remote signing
		if (!activeBunkerSigner) {
			throw new Error('Bunker connection not available');
		}

		const signedEvent = await activeBunkerSigner.signEvent(eventWithTimestamp);
		return signedEvent as SignedEvent;
	}

	throw new Error('No valid authentication method available');
}
