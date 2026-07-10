/**
 * Login Command - Authenticate with Nostr identity
 *
 * Supports:
 * - Direct nsec input
 * - NIP-46 Bunker (remote signer)
 * - Environment variables for CI/CD
 *
 * L5: Journey-Validator - User authentication flow
 */

import { createInterface } from 'node:readline';
import { npubEncode } from 'nostr-tools/nip19';
import { getPublicKey } from 'nostr-tools/pure';
import {
	BunkerSecretManager,
	closeBunkerSigner,
	connectToBunker,
	createNostrConnectUri,
	formatBunkerPointer,
	isValidBunkerUrl,
	reconnectFromBunkerAuth,
} from '../lib/bunker';
import {
	type AuthResult,
	clearAuth,
	getAuth,
	getRelays,
	loadConfig,
	saveBunkerAuth,
	saveConfig,
} from '../lib/config';
import { decodeNsec, validateNsec } from '../lib/crypto';
import { AuthError, ValidationError } from '../lib/errors';
import {
	deleteNsecFromKeychain,
	getKeychainServiceName,
	storeBunkerKeyInKeychain,
	storeNsecInKeychain,
} from '../lib/keychain';
import type { SecretManagerSigner } from '../lib/secret-manager';
import { renderTerminalQr } from '../lib/terminal-qr';
import type { BunkerAuth } from '../lib/types';

export interface LoginOptions {
	nsec?: string;
	bunker?: string;
	bunkerStdin?: boolean;
	connect?: boolean;
	force?: boolean;
}

/**
 * Execute the login command.
 */
export async function loginCommand(options: LoginOptions): Promise<void> {
	// Skip stored auth lookup for --force so stale/incomplete bunker state can be repaired.
	if (!options.force) {
		const existingAuth = await getAuth();
		if (existingAuth) {
			await showCurrentAuth(existingAuth);
			console.log('\nUse --force to re-authenticate.');
			return;
		}
	}

	// Determine auth method
	if (options.bunker) {
		console.log('Warning: Passing a bunker URI via argv can expose its one-time pairing secret.');
		console.log('Prefer --bunker-stdin or REDSHIFT_BUNKER.\n');
		await loginWithBunker(options.bunker);
	} else if (options.bunkerStdin) {
		const bunkerUrl = await promptHidden('Enter bunker URI: ');
		if (!bunkerUrl) throw new ValidationError('No bunker URI provided.');
		await loginWithBunker(bunkerUrl);
	} else if (options.connect) {
		await loginWithNostrConnect();
	} else if (options.nsec) {
		console.log('Warning: Passing nsec via command-line flag is visible in process listings.');
		console.log(
			'Consider using REDSHIFT_NSEC environment variable or interactive login instead.\n',
		);
		await loginWithNsec(options.nsec);
	} else {
		// Interactive - ask user which method
		await interactiveLogin();
	}
}

/**
 * Show current authentication status
 */
async function showCurrentAuth(auth: AuthResult): Promise<void> {
	if (auth.method === 'nsec' && auth.nsec) {
		const privateKeyBytes = decodeNsec(auth.nsec);
		const pubkey = getPublicKey(privateKeyBytes);
		const npub = npubEncode(pubkey);
		console.log(`Currently logged in as ${npub}`);
		console.log(`(using nsec from ${auth.source})`);
	} else if (auth.method === 'bunker' && auth.bunker) {
		console.log('Currently connected to bunker');
		console.log(`  Bunker: ${auth.bunker.bunkerPubkey.substring(0, 16)}...`);
		console.log(`  Relays: ${auth.bunker.relays.join(', ')}`);
		console.log(`(from ${auth.source})`);
	}
}

type StoreNsecCredential = (nsec: string) => Promise<boolean>;

export async function persistNsecCredential(
	nsec: string,
	storeCredential: StoreNsecCredential = storeNsecInKeychain,
): Promise<string> {
	if (!validateNsec(nsec)) {
		throw new ValidationError('Invalid nsec format. Expected a checksummed nsec1 private key.');
	}

	const privateKeyBytes = decodeNsec(nsec);
	try {
		const npub = npubEncode(getPublicKey(privateKeyBytes));
		if (!(await storeCredential(nsec))) {
			throw new AuthError(
				'System keychain unavailable; the nsec was not persisted. Use REDSHIFT_NSEC for command-scoped authentication.',
				'nsec',
			);
		}
		const current = await loadConfig();
		const { authMethod: _authMethod, nsec: _nsec, bunker: _bunker, ...nonAuthConfig } = current;
		await saveConfig({ ...nonAuthConfig, authMethod: 'nsec' });
		return npub;
	} finally {
		privateKeyBytes.fill(0);
	}
}

async function loginWithNsec(nsec: string): Promise<void> {
	const npub = await persistNsecCredential(nsec);
	console.log('\n✓ Logged in successfully!');
	console.log(`  Public key: ${npub}`);
	console.log('\nYour private key has been stored securely in the system keychain.');
	console.log(`  Service: ${getKeychainServiceName()}`);
	console.log('\nTip: For CI/CD, set REDSHIFT_NSEC environment variable instead.');
}

export function sanitizeBunkerError(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return message
		.replace(/(bunker:\/\/[^?\s"']+)\?[^\s"']+/gi, '$1?[REDACTED]')
		.replace(/([?&]secret=)[^&\s"']+/gi, '$1[REDACTED]');
}

/** Login with a bunker pointer while retaining the client key only in keychain. */
async function loginWithBunker(bunkerUrl: string): Promise<void> {
	console.log('Connecting to bunker...');
	try {
		const connection = await connectToBunker(bunkerUrl, {
			onAuth: (url) => {
				console.log('\n⚠️  Authentication required. Please visit:');
				console.log(`   ${url}`);
			},
		});
		const npub = npubEncode(connection.userPubkey);
		const clientKeyHex = Buffer.from(connection.clientSecretKey).toString('hex');
		const storedInKeychain = await storeBunkerKeyInKeychain(clientKeyHex);
		await deleteNsecFromKeychain();
		// Retain the NIP-46 client key as a 0600 config fallback. Never persist the
		// one-time pairing secret from the bunker URI.
		const bunkerAuth: BunkerAuth = {
			bunkerPubkey: connection.bunkerPointer.pubkey,
			relays: connection.bunkerPointer.relays,
			clientSecretKey: clientKeyHex,
		};
		await saveBunkerAuth(bunkerAuth);
		console.log('\n✓ Connected to bunker successfully!');
		console.log(`  User: ${npub}`);
		console.log(`  Bunker: ${formatBunkerPointer(connection.bunkerPointer)}`);
		if (storedInKeychain) {
			console.log('\nClient key stored in the system keychain and 0600 config fallback.');
			console.log(`  Service: ${getKeychainServiceName()}`);
		} else {
			console.log('\n⚠️  System keychain unavailable. Client key stored in 0600 config fallback.');
		}
		await closeBunkerSigner(connection.signer);
		connection.clientSecretKey.fill(0);
	} catch (error) {
		if (error instanceof AuthError) throw error;
		throw new AuthError(`Failed to connect to bunker: ${sanitizeBunkerError(error)}`, 'bunker');
	}
}

/**
 * Login with nostrconnect:// flow (client-initiated)
 */
async function loginWithNostrConnect(): Promise<void> {
	console.log('Creating NostrConnect URI...\n');

	const relays = await getRelays();
	const { uri, waitForConnection } = await createNostrConnectUri(relays, 'Redshift CLI');

	console.log('Scan this QR code or paste the URI in your bunker app:\n');
	console.log(renderTerminalQr(uri));
	console.log(`\nURI: ${uri}\n`);
	console.log('Waiting for connection (timeout: 2 minutes)...');

	try {
		const connection = await waitForConnection(120000);
		const npub = npubEncode(connection.userPubkey);
		const clientKeyHex = Buffer.from(connection.clientSecretKey).toString('hex');
		const storedInKeychain = await storeBunkerKeyInKeychain(clientKeyHex);
		await deleteNsecFromKeychain();
		// Retain the NIP-46 client key as a 0600 config fallback. Never persist the
		// one-time pairing secret from the nostrconnect URI.
		const bunkerAuth: BunkerAuth = {
			bunkerPubkey: connection.bunkerPointer.pubkey,
			relays: connection.bunkerPointer.relays,
			clientSecretKey: clientKeyHex,
		};
		await saveBunkerAuth(bunkerAuth);
		console.log('\n✓ Connected successfully!');
		console.log(`  User: ${npub}`);
		console.log(`  Bunker: ${formatBunkerPointer(connection.bunkerPointer)}`);
		if (storedInKeychain) {
			console.log('\nClient key stored in the system keychain and 0600 config fallback.');
			console.log(`  Service: ${getKeychainServiceName()}`);
		} else {
			console.log('\n⚠️  System keychain unavailable. Client key stored in 0600 config fallback.');
		}
		await closeBunkerSigner(connection.signer);
		connection.clientSecretKey.fill(0);
	} catch (error) {
		if (error instanceof AuthError) throw error;
		throw new AuthError(`Connection timed out or failed: ${sanitizeBunkerError(error)}`, 'bunker');
	}
}

/**
 * Prompt for hidden input (for sensitive data like nsec).
 * Characters are not echoed to the terminal.
 */
async function promptHidden(prompt: string): Promise<string> {
	return new Promise((resolve) => {
		process.stdout.write(prompt);

		// Enable raw mode to capture input without echoing
		if (process.stdin.isTTY) {
			process.stdin.setRawMode(true);
		}
		process.stdin.resume();
		process.stdin.setEncoding('utf8');

		let input = '';

		const onData = (char: string) => {
			// Handle Ctrl+C
			if (char === '\u0003') {
				process.stdout.write('\n');
				process.exit(0);
			}

			// Handle Enter
			if (char === '\r' || char === '\n') {
				if (process.stdin.isTTY) {
					process.stdin.setRawMode(false);
				}
				process.stdin.pause();
				process.stdin.removeListener('data', onData);
				process.stdout.write('\n');
				resolve(input.trim());
				return;
			}

			// Handle Backspace
			if (char === '\u007F' || char === '\b') {
				if (input.length > 0) {
					input = input.slice(0, -1);
				}
				return;
			}

			// Accumulate character (don't echo)
			input += char;
		};

		process.stdin.on('data', onData);
	});
}

/**
 * Interactive login flow
 */
async function interactiveLogin(): Promise<void> {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	console.log('Redshift Login');
	console.log('==============\n');
	console.log('Choose authentication method:\n');
	console.log('  1. Enter nsec directly');
	console.log('  2. Connect via bunker URL (bunker://...)');
	console.log('  3. Generate NostrConnect QR code');
	console.log('');

	const choice = await new Promise<string>((resolve) => {
		rl.question('Select option [1-3]: ', (answer) => {
			resolve(answer.trim());
		});
	});

	switch (choice) {
		case '1': {
			rl.close();
			const nsec = await promptHidden('\nEnter your nsec: ');
			if (nsec) {
				await loginWithNsec(nsec);
			} else {
				console.error('No nsec provided.');
				process.exit(1);
			}
			break;
		}
		case '2': {
			rl.close();
			const bunkerUrl = await promptHidden('\nEnter bunker URL: ');
			if (bunkerUrl && isValidBunkerUrl(bunkerUrl)) {
				await loginWithBunker(bunkerUrl);
			} else {
				console.error('Invalid bunker URL.');
				process.exit(1);
			}
			break;
		}
		case '3':
			rl.close();
			await loginWithNostrConnect();
			break;
		default:
			rl.close();
			console.error('Invalid option.');
			process.exit(1);
	}
}

/**
 * Logout - clear stored credentials
 */
export async function logoutCommand(): Promise<void> {
	// clearAuth handles both keychain and config file
	await clearAuth();
	console.log('✓ Logged out successfully.');
}

/**
 * Try to get auth credentials without exiting.
 * Returns null if not logged in or auth is invalid.
 */
export async function tryAuth(): Promise<{
	nsec: string;
	npub: string;
	privateKey: Uint8Array;
} | null> {
	const auth = await getAuth();

	if (!auth) {
		return null;
	}

	// For now, only nsec auth provides direct private key access
	if (auth.method !== 'nsec' || !auth.nsec) {
		return null;
	}

	if (!validateNsec(auth.nsec)) {
		return null;
	}

	const privateKey = decodeNsec(auth.nsec);
	const pubkey = getPublicKey(privateKey);
	const npub = npubEncode(pubkey);

	return { nsec: auth.nsec, npub, privateKey };
}

/**
 * Check if user is logged in and return their credentials.
 * Exits with error if not logged in.
 */
export interface RequiredAuth {
	/** Present for local nsec auth */
	nsec?: string;
	/** User public key encoded as npub */
	npub: string;
	/** User public key as hex */
	pubkey: string;
	/** Present for local nsec auth */
	privateKey?: Uint8Array;
	/** Present for signer-backed auth such as NIP-46 bunker */
	signer?: SecretManagerSigner;
}

export async function requireAuth(): Promise<RequiredAuth> {
	const auth = await tryAuth();

	if (auth) {
		return { ...auth, pubkey: getPublicKey(auth.privateKey) };
	}

	const storedAuth = await getAuth();
	if (!storedAuth) {
		console.error('Not logged in. Run `redshift login` first.');
		console.error('Or set REDSHIFT_NSEC or REDSHIFT_BUNKER for CI/CD.');
		process.exit(1);
	}

	if (storedAuth.method === 'bunker' && storedAuth.bunker) {
		try {
			const connection = await reconnectFromBunkerAuth(storedAuth.bunker, {
				usePairingSecret: storedAuth.source === 'env',
				onAuth: (url) => {
					console.log('\n⚠️  Authentication required. Please visit:');
					console.log(`   ${url}`);
				},
			});
			const signer = new BunkerSecretManager(connection, storedAuth.bunker.relays);
			return {
				npub: npubEncode(connection.userPubkey),
				pubkey: connection.userPubkey,
				signer,
			};
		} catch (error) {
			console.error('Failed to connect to bunker:', error);
			process.exit(1);
		}
	}

	console.error('Invalid nsec stored in config. Please run `redshift login` again.');
	process.exit(1);
}
