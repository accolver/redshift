/**
 * NIP-46 Bunker (Remote Signer) Support
 *
 * Allows users to authenticate using a remote signer (bunker)
 * instead of providing their nsec directly.
 *
 * L4: Integration-Contractor - NIP-46 protocol compliance
 * L5: Journey-Validator - Secure authentication flow
 */

import type { EventTemplate } from 'nostr-tools/core';
import {
	type BunkerPointer,
	BunkerSigner,
	type BunkerSignerParams,
	parseBunkerInput,
} from 'nostr-tools/nip46';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { getRelays } from './config';
import type { NostrSigner } from './types';

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
		await signer.connect();

		// Get the user's public key
		const userPubkey = await signer.getPublicKey();

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
		await signer.connect();
		const userPubkey = await signer.getPublicKey();

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
	params.set('perms', 'sign_event:1059,sign_event:30078,sign_event:5,nip44_encrypt,nip44_decrypt');

	const uri = `nostrconnect://${clientPubkey}?${params.toString()}`;

	return {
		uri,
		clientSecretKey,
		waitForConnection: async (timeout = 120000) => {
			const signer = await BunkerSigner.fromURI(clientSecretKey, uri, {}, timeout);

			const userPubkey = await signer.getPublicKey();

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
 * Wrapper that makes a BunkerSigner compatible with NostrSigner.
 * Signs events using the remote bunker instead of a local key.
 *
 * Implements the NostrSigner interface so it can be used interchangeably
 * with NsecSigner in all CLI commands.
 */
export class BunkerSecretManager implements NostrSigner {
	readonly pubkey: string;
	private bunkerSigner: BunkerSigner;
	private relays: string[];

	constructor(connection: BunkerConnection, relays: string[]) {
		this.bunkerSigner = connection.signer;
		this.pubkey = connection.userPubkey;
		this.relays = relays;
	}

	/**
	 * Get the user's public key
	 */
	getPublicKey(): string {
		return this.pubkey;
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
	async signEvent(event: {
		kind: number;
		created_at: number;
		tags: string[][];
		content: string;
	}) {
		const signed = await this.bunkerSigner.signEvent(event as EventTemplate);
		return {
			id: signed.id,
			pubkey: signed.pubkey,
			created_at: signed.created_at,
			kind: signed.kind,
			tags: signed.tags,
			content: signed.content,
			sig: signed.sig,
		};
	}

	/**
	 * Encrypt content using NIP-44 via bunker
	 */
	async encrypt(pubkey: string, plaintext: string): Promise<string> {
		return this.bunkerSigner.nip44Encrypt(pubkey, plaintext);
	}

	/**
	 * Decrypt content using NIP-44 via bunker
	 */
	async decrypt(pubkey: string, ciphertext: string): Promise<string> {
		return this.bunkerSigner.nip44Decrypt(pubkey, ciphertext);
	}

	/**
	 * Close the bunker connection
	 */
	async close(): Promise<void> {
		await this.bunkerSigner.close();
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
