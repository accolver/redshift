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
	connectToBunker,
	createNostrConnectUri,
	formatBunkerPointer,
	isValidBunkerUrl,
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
import type { BunkerAuth } from '../lib/types';

export interface LoginOptions {
	nsec?: string;
	bunker?: string;
	connect?: boolean;
	force?: boolean;
}

/**
 * Execute the login command.
 */
export async function loginCommand(options: LoginOptions): Promise<void> {
	// Check if already logged in
	const existingAuth = await getAuth();
	if (existingAuth && !options.force) {
		await showCurrentAuth(existingAuth);
		console.log('\nUse --force to re-authenticate.');
		return;
	}

	// Determine auth method
	if (options.bunker) {
		await loginWithBunker(options.bunker);
	} else if (options.connect) {
		await loginWithNostrConnect();
	} else if (options.nsec) {
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

/**
 * Login with direct nsec
 */
async function loginWithNsec(nsec: string): Promise<void> {
	if (!validateNsec(nsec)) {
		console.error('Invalid nsec format. Please provide a valid Nostr private key.');
		console.error('Format: nsec1... (63 characters)');
		process.exit(1);
	}

	const privateKeyBytes = decodeNsec(nsec);
	const pubkey = getPublicKey(privateKeyBytes);
	const npub = npubEncode(pubkey);

	const config = await loadConfig();
	config.authMethod = 'nsec';
	config.nsec = nsec;
	delete config.bunker;
	await saveConfig(config);

	console.log('\n✓ Logged in successfully!');
	console.log(`  Public key: ${npub}`);
	console.log('\nYour private key has been stored in ~/.redshift/config.json');
	console.log('\nTip: For CI/CD, set REDSHIFT_NSEC environment variable instead.');
}

/**
 * Login with bunker URL
 */
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

		// Save bunker auth
		const bunkerAuth: BunkerAuth = {
			bunkerPubkey: connection.bunkerPointer.pubkey,
			relays: connection.bunkerPointer.relays,
			clientSecretKey: Buffer.from(connection.clientSecretKey).toString('hex'),
		};
		if (connection.bunkerPointer.secret) {
			bunkerAuth.secret = connection.bunkerPointer.secret;
		}
		await saveBunkerAuth(bunkerAuth);

		console.log('\n✓ Connected to bunker successfully!');
		console.log(`  User: ${npub}`);
		console.log(`  Bunker: ${formatBunkerPointer(connection.bunkerPointer)}`);
		console.log('\nYour bunker connection has been stored in ~/.redshift/config.json');

		await connection.signer.close();
	} catch (error) {
		console.error('Failed to connect to bunker:', error);
		process.exit(1);
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
	console.log(`  ${uri}\n`);
	console.log('Waiting for connection (timeout: 2 minutes)...');

	try {
		const connection = await waitForConnection(120000);
		const npub = npubEncode(connection.userPubkey);

		// Save bunker auth
		const bunkerAuth: BunkerAuth = {
			bunkerPubkey: connection.bunkerPointer.pubkey,
			relays: connection.bunkerPointer.relays,
			clientSecretKey: Buffer.from(connection.clientSecretKey).toString('hex'),
		};
		if (connection.bunkerPointer.secret) {
			bunkerAuth.secret = connection.bunkerPointer.secret;
		}
		await saveBunkerAuth(bunkerAuth);

		console.log('\n✓ Connected successfully!');
		console.log(`  User: ${npub}`);
		console.log(`  Bunker: ${formatBunkerPointer(connection.bunkerPointer)}`);

		await connection.signer.close();
	} catch (error) {
		console.error('\nConnection timed out or failed:', error);
		process.exit(1);
	}
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
			const nsec = await new Promise<string>((resolve) => {
				rl.question('\nEnter your nsec: ', (answer) => {
					rl.close();
					resolve(answer.trim());
				});
			});
			if (nsec) {
				await loginWithNsec(nsec);
			} else {
				console.error('No nsec provided.');
				process.exit(1);
			}
			break;
		}
		case '2': {
			const bunkerUrl = await new Promise<string>((resolve) => {
				rl.question('\nEnter bunker URL: ', (answer) => {
					rl.close();
					resolve(answer.trim());
				});
			});
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
export async function requireAuth(): Promise<{
	nsec: string;
	npub: string;
	privateKey: Uint8Array;
}> {
	const auth = await tryAuth();

	if (!auth) {
		const storedAuth = await getAuth();
		if (!storedAuth) {
			console.error('Not logged in. Run `redshift login` first.');
			console.error('Or set REDSHIFT_NSEC environment variable for CI/CD.');
		} else if (storedAuth.method !== 'nsec' || !storedAuth.nsec) {
			console.error('Bunker auth not yet fully supported for this command.');
			console.error('Please use nsec authentication for now.');
		} else {
			console.error('Invalid nsec stored in config. Please run `redshift login` again.');
		}
		process.exit(1);
	}

	return auth;
}
