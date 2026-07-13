/**
 * Bunker Command - Run a minimal local NIP-46 remote signer prototype.
 *
 * L4: Integration-Contractor - NIP-46 remote signer process
 * L5: Journey-Validator - Local bunker pairing workflow
 */

import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { getConfigDir, getRelays } from '../lib/config';
import { type Nip46RelayPool, startNip46BunkerService } from '../lib/nip46-bunker';

interface StoredBunkerPrototypeConfig {
	signerSecretKey: string;
	userSecretKey: string;
	secret: string;
	relays: string[];
	createdAt: number;
}

export interface BunkerCommandOptions {
	subcommand: 'start' | 'status';
	relays?: string[];
	/** Explicit consent for Phase 1 plaintext local prototype key storage. */
	insecurePlaintextKeys?: boolean;
	/** Injectable relay pool for tests. */
	relayPool?: Nip46RelayPool;
	/** Start then immediately close, for command tests without a long-running process. */
	runOnceForTest?: boolean;
}

const BUNKER_DIR = 'bunker';
const BUNKER_CONFIG = 'prototype.json';

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

function hexToBytes(hex: string): Uint8Array {
	if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
		throw new Error('Invalid stored bunker key');
	}
	const bytes = new Uint8Array(32);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

function randomSecret(): string {
	return bytesToHex(generateSecretKey()).slice(0, 32);
}

function getBunkerConfigPath() {
	const dir = join(getConfigDir(), BUNKER_DIR);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true, mode: 0o700 });
	}
	chmodSync(dir, 0o700);
	return join(dir, BUNKER_CONFIG);
}

async function saveConfig(path: string, config: StoredBunkerPrototypeConfig): Promise<void> {
	await Bun.write(path, JSON.stringify(config, null, 2));
	chmodSync(path, 0o600);
}

async function loadOrCreateConfig(
	relays: string[],
	allowCreatePlaintextKeys: boolean,
	rotateSecret: boolean,
): Promise<StoredBunkerPrototypeConfig> {
	const path = getBunkerConfigPath();
	if (existsSync(path)) {
		const parsed = JSON.parse(await Bun.file(path).text()) as StoredBunkerPrototypeConfig;
		const config = {
			...parsed,
			secret: rotateSecret ? randomSecret() : parsed.secret,
			relays: relays.length > 0 ? relays : parsed.relays,
		};
		if (rotateSecret || relays.length > 0) {
			await saveConfig(path, config);
		}
		return config;
	}

	if (!allowCreatePlaintextKeys) {
		throw new Error(
			'Local bunker prototype stores keys in plaintext. Re-run with --insecure-plaintext-keys to create prototype keys.',
		);
	}

	const config: StoredBunkerPrototypeConfig = {
		signerSecretKey: bytesToHex(generateSecretKey()),
		userSecretKey: bytesToHex(generateSecretKey()),
		secret: randomSecret(),
		relays,
		createdAt: Math.floor(Date.now() / 1000),
	};
	await saveConfig(path, config);
	return config;
}

function bunkerUri(config: StoredBunkerPrototypeConfig, includeSecret = true): string {
	const signerPubkey = getPublicKey(hexToBytes(config.signerSecretKey));
	const params = new URLSearchParams();
	for (const relay of config.relays) {
		params.append('relay', relay);
	}
	params.set('secret', includeSecret ? config.secret : 'REDACTED');
	return `bunker://${signerPubkey}?${params.toString()}`;
}

export async function bunkerCommand(options: BunkerCommandOptions): Promise<void> {
	const relays = options.relays && options.relays.length > 0 ? options.relays : await getRelays();
	const config = await loadOrCreateConfig(
		relays,
		options.subcommand === 'start' && options.insecurePlaintextKeys === true,
		options.subcommand === 'start',
	);
	const signerSecretKey = hexToBytes(config.signerSecretKey);
	const userSecretKey = hexToBytes(config.userSecretKey);

	if (options.subcommand === 'status') {
		console.log('Redshift bunker prototype');
		console.log(`  Config: ${getBunkerConfigPath()}`);
		console.log(`  Signer pubkey: ${getPublicKey(signerSecretKey)}`);
		console.log(`  User pubkey: ${getPublicKey(userSecretKey)}`);
		console.log(`  Relays: ${config.relays.join(', ')}`);
		console.log('  Running: unavailable from one-shot status command');
		console.log('  Connected clients: unavailable from one-shot status command');
		console.log(`  Connection URI: ${bunkerUri(config, false)}`);
		console.log('  Run `redshift bunker start` to rotate and print a fresh one-time pairing URI.');
		return;
	}

	console.log('Starting Redshift bunker prototype...');
	console.log(`Signer pubkey: ${getPublicKey(signerSecretKey)}`);
	console.log(`User pubkey: ${getPublicKey(userSecretKey)}`);
	console.log(`Relays: ${config.relays.join(', ')}`);
	console.log('');
	console.log('Connect with:');
	console.log('  redshift login --bunker-stdin');
	console.log('  Then paste the one-time pairing URI printed above.');
	console.log('');
	console.log(
		'Security note: this prototype stores local keys in a 0600 plaintext file under ~/.redshift/bunker.',
	);
	console.log('Press Ctrl+C to stop.');

	const service = startNip46BunkerService({
		signerSecretKey,
		userSecretKey,
		relays: config.relays,
		secret: config.secret,
		...(options.relayPool ? { relayPool: options.relayPool } : {}),
	});

	if (options.runOnceForTest) {
		await service.close();
		return;
	}

	let stopping = false;
	const stop = () => {
		if (stopping) return;
		stopping = true;
		void service.close().then(
			() => process.exit(0),
			(error: unknown) => {
				console.error(
					'Failed to stop bunker service:',
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			},
		);
	};
	process.once('SIGINT', stop);
	process.once('SIGTERM', stop);

	await new Promise<never>(() => {
		// Keep process alive until a signal is received.
	});
}
