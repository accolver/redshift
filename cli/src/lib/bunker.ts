/**
 * NIP-46 Bunker (Remote Signer) Support
 *
 * Allows users to authenticate using a remote signer (bunker)
 * instead of providing their nsec directly.
 *
 * L4: Integration-Contractor - NIP-46 protocol compliance
 * L5: Journey-Validator - Secure authentication flow
 */

import type { EventTemplate, VerifiedEvent } from 'nostr-tools/core';
import type { BunkerAuth } from './types';
import {
	type BunkerPointer,
	BunkerSigner,
	type BunkerSignerParams,
	parseBunkerInput,
} from 'nostr-tools/nip46';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { getRelays } from './config';

const DEFAULT_BUNKER_CONNECT_TIMEOUT_MS = 15000;

/**
 * Run an async bunker operation with a timeout so relay or bunker outages do not hang CLI commands.
 */
export async function withBunkerTimeout<T>(
	operation: Promise<T>,
	timeoutMs = DEFAULT_BUNKER_CONNECT_TIMEOUT_MS,
	message = 'Timed out connecting to bunker',
): Promise<T> {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			operation,
			new Promise<T>((_, reject) => {
				timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
			}),
		]);
	} finally {
		if (timeout) clearTimeout(timeout);
	}
}

/**
 * Result of bunker connection
 */
export interface BunkerConnection {
	/** The connected signer */
	signer: BunkerSigner;
	/** User's public key (hex) */
	userPubkey: string;
	/** The bunker pointer for reconnection */
	bunkerPointer: BunkerPointer;
	/** Client secret key (for reconnection) */
	clientSecretKey: Uint8Array;
}

/**
 * Bunker connection options
 */
export interface BunkerConnectOptions {
	/** Callback when auth URL is needed (for web auth flow) */
	onAuth?: (url: string) => void;
	/** Timeout for connection in ms */
	timeout?: number;
	/** Use a one-shot pairing secret from env auth. Never set for persisted auth. */
	usePairingSecret?: boolean;
}

/**
 * Parse a bunker URL or NIP-05 identifier.
 *
 * Supported formats:
 * - bunker://<pubkey>?relay=wss://...&secret=...
 * - user@domain.com (NIP-05 with NIP-46 support)
 *
 * @param input - Bunker URL or NIP-05 identifier
 * @returns BunkerPointer or null if invalid
 */
export async function parseBunkerUrl(input: string): Promise<BunkerPointer | null> {
	return parseBunkerInput(input);
}

/**
 * Connect to a bunker using a bunker:// URL or NIP-05.
 *
 * @param bunkerUrl - The bunker URL or NIP-05 identifier
 * @param options - Connection options
 * @returns BunkerConnection with signer and pubkey
 */
export async function connectToBunker(
	bunkerUrl: string,
	options: BunkerConnectOptions = {},
): Promise<BunkerConnection> {
	// Parse bunker input
	const bp = await parseBunkerInput(bunkerUrl);
	if (!bp) {
		throw new Error(`Invalid bunker URL or NIP-05: ${bunkerUrl}`);
	}

	// Generate client keypair
	const clientSecretKey = generateSecretKey();

	// Set up params
	const params: BunkerSignerParams = {};
	if (options.onAuth) {
		params.onauth = options.onAuth;
	}

	// Create signer from bunker pointer
	const signer = BunkerSigner.fromBunker(clientSecretKey, bp, params);

	try {
		// Connect to the bunker
		await withBunkerTimeout(signer.connect(), options.timeout, 'Timed out connecting to bunker');

		// Get the user's public key
		const userPubkey = await withBunkerTimeout(
			signer.getPublicKey(),
			options.timeout,
			'Timed out fetching bunker public key',
		);
		await withBunkerTimeout(signer.switchRelays(), options.timeout, 'Timed out switching bunker relays');

		return {
			signer,
			userPubkey,
			bunkerPointer: bp,
			clientSecretKey,
		};
	} catch (error) {
		// Clean up on error
		await signer.close();
		throw error;
	}
}

/**
 * Reconnect to a bunker using stored credentials.
 *
 * @param bp - The bunker pointer
 * @param clientSecretKey - The client's secret key from previous connection
 * @param options - Connection options
 * @returns BunkerConnection
 */
export async function reconnectToBunker(
	bp: BunkerPointer,
	clientSecretKey: Uint8Array,
	options: BunkerConnectOptions = {},
): Promise<BunkerConnection> {
	const params: BunkerSignerParams = {};
	if (options.onAuth) {
		params.onauth = options.onAuth;
	}

	const signer = BunkerSigner.fromBunker(clientSecretKey, bp, params);

	try {
		await withBunkerTimeout(signer.connect(), options.timeout, 'Timed out connecting to bunker');
		const userPubkey = await withBunkerTimeout(
			signer.getPublicKey(),
			options.timeout,
			'Timed out fetching bunker public key',
		);
		await withBunkerTimeout(signer.switchRelays(), options.timeout, 'Timed out switching bunker relays');

		return {
			signer,
			userPubkey,
			bunkerPointer: bp,
			clientSecretKey,
		};
	} catch (error) {
		await signer.close();
		throw error;
	}
}

/**
 * Convert stored bunker auth metadata into a nostr-tools BunkerPointer.
 */
export function bunkerAuthToPointer(auth: BunkerAuth, includeSecret = false): BunkerPointer {
	return {
		pubkey: auth.bunkerPubkey,
		relays: auth.relays,
		secret: includeSecret ? (auth.secret ?? null) : null,
	};
}

/**
 * Decode a hex-encoded 32-byte client secret key from config/keychain storage.
 */
export function decodeClientSecretKey(hexKey: string): Uint8Array {
	if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
		throw new Error('Invalid bunker client secret key: expected 64 hex characters');
	}
	const key = new Uint8Array(32);
	for (let i = 0; i < key.length; i++) {
		key[i] = Number.parseInt(hexKey.slice(i * 2, i * 2 + 2), 16);
	}
	return key;
}

/**
 * Reconnect from stored bunker auth metadata.
 */
export async function reconnectFromBunkerAuth(
	auth: BunkerAuth,
	options: BunkerConnectOptions = {},
): Promise<BunkerConnection> {
	return reconnectToBunker(
		bunkerAuthToPointer(auth, options.usePairingSecret === true),
		decodeClientSecretKey(auth.clientSecretKey),
		options,
	);
}

/**
 * Create a nostrconnect:// URI for client-initiated connection.
 *
 * The user scans this with their bunker app to authorize the connection.
 *
 * @param relays - Relay URLs for communication
 * @param name - Application name to display
 * @returns Object with URI and wait function
 */
export async function createNostrConnectUri(
	relays?: string[],
	name = 'Redshift',
): Promise<{
	uri: string;
	clientSecretKey: Uint8Array;
	waitForConnection: (timeout?: number) => Promise<BunkerConnection>;
}> {
	const clientSecretKey = generateSecretKey();
	const clientPubkey = getPublicKey(clientSecretKey);

	// Use provided relays or defaults
	const relayUrls = relays || (await getRelays());

	// Generate a random secret
	const secret = Array.from(crypto.getRandomValues(new Uint8Array(16)))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	// Build URI
	const params = new URLSearchParams();
	for (const relay of relayUrls) {
		params.append('relay', relay);
	}
	params.set('secret', secret);
	params.set('name', name);
	params.set('perms', 'get_public_key,switch_relays,sign_event:13,nip44_encrypt,nip44_decrypt');

	const uri = `nostrconnect://${clientPubkey}?${params.toString()}`;

	return {
		uri,
		clientSecretKey,
		waitForConnection: async (timeout = 120000) => {
			const signer = await BunkerSigner.fromURI(clientSecretKey, uri, {}, timeout);

			const userPubkey = await signer.getPublicKey();
			await signer.switchRelays();

			// Extract bunker pointer from signer
			const bp = signer.bp;

			return {
				signer,
				userPubkey,
				bunkerPointer: bp,
				clientSecretKey,
			};
		},
	};
}

/**
 * Wrapper that makes a BunkerSigner compatible with SecretManager.
 * Signs events using the remote bunker instead of a local key.
 */
export class BunkerSecretManager {
	private signer: BunkerSigner;
	private userPubkey: string;
	private relays: string[];

	constructor(connection: BunkerConnection, relays: string[]) {
		this.signer = connection.signer;
		this.userPubkey = connection.userPubkey;
		this.relays = relays;
	}

	/**
	 * Get the user's public key
	 */
	getPublicKey(): string {
		return this.userPubkey;
	}

	/**
	 * Get the relay URLs for publishing
	 */
	getRelays(): string[] {
		return this.relays;
	}

	/**
	 * Sign an event using the bunker
	 */
	async signEvent(event: EventTemplate): Promise<VerifiedEvent> {
		return this.signer.signEvent(event);
	}

	/**
	 * Encrypt content using NIP-44 via bunker.
	 */
	async nip44Encrypt(pubkey: string, plaintext: string): Promise<string> {
		return this.signer.nip44Encrypt(pubkey, plaintext);
	}

	/**
	 * Decrypt content using NIP-44 via bunker.
	 */
	async nip44Decrypt(pubkey: string, ciphertext: string): Promise<string> {
		return this.signer.nip44Decrypt(pubkey, ciphertext);
	}

	/** Backwards-compatible alias for older callers. */
	async encrypt(pubkey: string, plaintext: string): Promise<string> {
		return this.nip44Encrypt(pubkey, plaintext);
	}

	/** Backwards-compatible alias for older callers. */
	async decrypt(pubkey: string, ciphertext: string): Promise<string> {
		return this.nip44Decrypt(pubkey, ciphertext);
	}

	/**
	 * Close the bunker connection
	 */
	async close(): Promise<void> {
		await this.signer.close();
	}
}

/**
 * Validate a bunker URL format.
 *
 * Accepts:
 * - bunker://<64-char-hex-pubkey>... (NIP-46 bunker URI)
 * - user@domain.tld (NIP-05 format with NIP-46 support)
 */
export function isValidBunkerUrl(input: string): boolean {
	if (input.startsWith('bunker://')) {
		// Must have a 64-char hex pubkey after bunker://
		const afterScheme = input.slice('bunker://'.length);
		return /^[0-9a-f]{64}/.test(afterScheme);
	}
	// NIP-05 format: user@domain.tld
	return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input);
}

/**
 * Format bunker pointer for display
 */
export function formatBunkerPointer(bp: BunkerPointer): string {
	const pubkeyShort = `${bp.pubkey.substring(0, 8)}...${bp.pubkey.substring(bp.pubkey.length - 8)}`;
	return `bunker://${pubkeyShort} via ${bp.relays[0] || 'unknown relay'}`;
}
