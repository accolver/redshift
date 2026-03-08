/**
 * Bunker Command - Run the NIP-46 bunker server
 *
 * Starts the bunker server that handles NIP-46 remote signing requests
 * for team keys, plus the HTTP server for OAuth bridge and admin API.
 *
 * L5: Journey-Validator - Bunker server lifecycle
 * L4: Integration-Contractor - NIP-46 relay subscription
 */

import type { Event as NostrEvent } from 'nostr-tools/core';
import type { Filter } from 'nostr-tools/filter';
import type { ParsedArgs } from '../lib/cli';

export type BunkerSubcommand = 'start' | 'status';

/**
 * Handle the bunker command dispatch.
 */
export async function bunkerCommand(parsed: ParsedArgs) {
	const subcommand = (parsed.subcommand || 'start') as BunkerSubcommand;

	switch (subcommand) {
		case 'start':
			return handleBunkerStart(parsed);
		case 'status':
			return handleBunkerStatus(parsed);
		default:
			console.error(`Unknown subcommand: ${subcommand}`);
			console.error('Available: start, status');
			process.exit(1);
	}
}

/**
 * Start the bunker NIP-46 server + HTTP server.
 *
 * 1. Load config from environment variables
 * 2. Open database and initialize schema
 * 3. Load team keys from database, decrypt, and register with BunkerServer
 * 4. Start the HTTP server (OAuth bridge + admin API)
 * 5. Subscribe to relays for NIP-46 events (Kind 24133)
 * 6. Keep running until SIGINT/SIGTERM
 */
async function handleBunkerStart(parsed: ParsedArgs) {
	// Dynamic imports — @redshift/bunker is a workspace package
	const bunker = await import('@redshift/bunker');
	const { SimplePool } = await import('nostr-tools/pool');

	// Load config from environment, applying CLI flag overrides
	let config: ReturnType<typeof bunker.loadConfig>;
	try {
		config = bunker.loadConfig();
	} catch (error) {
		console.error('Error:', error instanceof Error ? error.message : String(error));
		process.exit(1);
	}

	// Apply CLI flag overrides
	const port =
		typeof parsed.flags.port === 'string' ? Number.parseInt(parsed.flags.port, 10) : config.port;
	const host = typeof parsed.flags.host === 'string' ? parsed.flags.host : config.host;
	const databasePath =
		typeof parsed.flags.database === 'string' ? parsed.flags.database : config.databaseUrl;

	// Override config with CLI flags
	const effectiveConfig = {
		...config,
		port,
		host,
		databaseUrl: databasePath,
	};

	// Open database
	let db: ReturnType<typeof bunker.openDatabase>;
	try {
		db = bunker.openDatabase(effectiveConfig.databaseUrl);
	} catch (error) {
		console.error('Error:', error instanceof Error ? error.message : String(error));
		process.exit(1);
	}

	// Create NIP-46 server
	const server = new bunker.BunkerServer(db, {
		relays: effectiveConfig.nostrRelays,
		sessionTimeoutSeconds: effectiveConfig.sessionTimeout,
	});

	// Load team keys from database, decrypt, and register
	interface TeamRow {
		id: string;
		pubkey: string;
		encrypted_nsec: string;
	}
	const teams = db.query<TeamRow, []>('SELECT id, pubkey, encrypted_nsec FROM teams').all();

	let registeredCount = 0;
	for (const team of teams) {
		try {
			const nsecHex = bunker.decrypt(team.encrypted_nsec, effectiveConfig.masterKey);
			const privateKey = hexToBytes(nsecHex);
			server.registerTeamKey({
				teamId: team.id,
				pubkey: team.pubkey,
				privateKey,
			});
			registeredCount++;
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			console.error(`Warning: Failed to decrypt key for team ${team.id}: ${msg}`);
		}
	}

	// Start the NIP-46 server (session manager)
	server.start();

	// Start the HTTP server
	const httpServer = bunker.createHttpServer({
		config: effectiveConfig,
		db,
	});

	console.log('✓ Bunker server started');
	console.log(`  HTTP:     http://${effectiveConfig.host}:${String(effectiveConfig.port)}`);
	console.log(`  Database: ${effectiveConfig.databaseUrl}`);
	console.log(`  Teams:    ${String(registeredCount)} key(s) loaded`);
	console.log(`  Relays:   ${[...effectiveConfig.nostrRelays].join(', ')}`);

	// Subscribe to relays for NIP-46 events
	const teamPubkeys = server.getTeamPubkeys();
	const pool = new SimplePool();
	let sub: { close: () => void } | undefined;

	if (teamPubkeys.length > 0) {
		const relayUrls = [...effectiveConfig.nostrRelays];
		const filter: Filter = { kinds: [24133], '#p': teamPubkeys };
		sub = pool.subscribeMany(relayUrls, filter, {
			onevent: async (event: NostrEvent) => {
				await server.handleEvent(event, async (responseEvent: NostrEvent) => {
					await Promise.any(relayUrls.map((relay) => pool.publish([relay], responseEvent)));
				});
			},
		});
		const relayCount = String(effectiveConfig.nostrRelays.length);
		const keyCount = String(teamPubkeys.length);
		console.log(`  Subscribed to ${relayCount} relay(s) for ${keyCount} team key(s)`);
	} else {
		console.log('  No team keys loaded — relay subscription skipped');
	}

	console.log('');
	console.log('Press Ctrl+C to stop.');

	// Graceful shutdown
	const shutdown = () => {
		console.log('\nShutting down...');
		sub?.close();
		server.stop();
		httpServer.stop();
		db.close();
		process.exit(0);
	};

	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);

	// Keep the process alive
	await new Promise(() => {
		// Never resolves — process stays alive until signal
	});
}

/**
 * Check if a bunker is reachable at the configured URL.
 */
async function handleBunkerStatus(parsed: ParsedArgs) {
	const bunkerUrl = await getBunkerUrl();
	const json = parsed.globalFlags.json;

	const healthUrl = `${bunkerUrl}/health`;
	const startTime = performance.now();

	try {
		const response = await fetch(healthUrl);
		const elapsed = Math.round(performance.now() - startTime);

		if (!response.ok) {
			if (json) {
				console.log(
					JSON.stringify({
						status: 'error',
						url: bunkerUrl,
						httpStatus: response.status,
						responseTimeMs: elapsed,
					}),
				);
			} else {
				console.error(`✗ Bunker returned HTTP ${String(response.status)}`);
				console.error(`  URL: ${bunkerUrl}`);
				console.error(`  Response time: ${String(elapsed)}ms`);
			}
			process.exit(1);
		}

		const data = (await response.json()) as { status?: string };

		if (json) {
			console.log(
				JSON.stringify({
					status: data.status ?? 'ok',
					url: bunkerUrl,
					responseTimeMs: elapsed,
				}),
			);
		} else {
			console.log('✓ Bunker is reachable');
			console.log(`  URL:           ${bunkerUrl}`);
			console.log(`  Status:        ${data.status ?? 'ok'}`);
			console.log(`  Response time: ${String(elapsed)}ms`);
		}
	} catch (error) {
		const elapsed = Math.round(performance.now() - startTime);
		const msg = error instanceof Error ? error.message : String(error);

		if (json) {
			console.log(
				JSON.stringify({
					status: 'unreachable',
					url: bunkerUrl,
					error: msg,
					responseTimeMs: elapsed,
				}),
			);
		} else {
			console.error('✗ Bunker is unreachable');
			console.error(`  URL:   ${bunkerUrl}`);
			console.error(`  Error: ${msg}`);
		}
		process.exit(1);
	}
}

/**
 * Get the bunker URL from config or environment.
 * Exits with error if not configured.
 */
async function getBunkerUrl() {
	const envUrl = process.env.REDSHIFT_BUNKER_URL;
	if (envUrl) {
		return envUrl;
	}

	const { loadConfig } = await import('../lib/config');
	const config = await loadConfig();
	if (config.bunkerUrl) {
		return config.bunkerUrl;
	}

	console.error('Error: Bunker URL not configured.');
	console.error('Set it with: redshift configure set bunkerUrl=https://bunker.example.com');
	console.error('Or set REDSHIFT_BUNKER_URL environment variable.');
	process.exit(1);
}

/**
 * Convert a hex string to Uint8Array.
 */
function hexToBytes(hex: string) {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}
