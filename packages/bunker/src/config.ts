/**
 * Configuration loader for @redshift/bunker
 *
 * Loads and validates configuration from environment variables.
 */

import { ConfigError } from './errors.js';
import type { BunkerConfig } from './types.js';

/** Default values for optional configuration */
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3333;
const DEFAULT_DATABASE_URL = 'bunker.db';
const DEFAULT_SESSION_TIMEOUT = 24 * 60 * 60; // 24 hours in seconds

/**
 * Parse a duration string (e.g., '24h', '30m', '7d') into seconds.
 * Falls back to parsing as raw seconds if no unit suffix.
 *
 * @throws {ConfigError} if the format is invalid
 */
export function parseDuration(value: string) {
	const match = /^(\d+)(s|m|h|d)?$/.exec(value.trim());
	if (!match) {
		throw new ConfigError(
			`Invalid duration format: "${value}". Use a number with optional suffix (s, m, h, d)`,
		);
	}

	const amount = Number.parseInt(match[1] ?? '0', 10);
	const unit = match[2] ?? 's';

	switch (unit) {
		case 's':
			return amount;
		case 'm':
			return amount * 60;
		case 'h':
			return amount * 3600;
		case 'd':
			return amount * 86400;
		default:
			return amount;
	}
}

/**
 * Validate a hex-encoded public key (64 hex characters = 32 bytes).
 */
function isValidPubkey(hex: string) {
	return /^[0-9a-fA-F]{64}$/.test(hex);
}

/**
 * Validate a relay URL (must be wss:// or ws://).
 */
function isValidRelayUrl(url: string) {
	try {
		const parsed = new URL(url);
		return parsed.protocol === 'wss:' || parsed.protocol === 'ws:';
	} catch {
		return false;
	}
}

/**
 * Load and validate bunker configuration from environment variables.
 *
 * Required:
 *   - MASTER_KEY: 64-char hex string (32 bytes)
 *   - NOSTR_RELAYS: comma-separated relay URLs (wss://...)
 *
 * Optional:
 *   - HOST: bind address (default: 127.0.0.1)
 *   - PORT: listen port (default: 3333)
 *   - DATABASE_URL: SQLite file path (default: bunker.db)
 *   - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET: Google OAuth
 *   - GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET: GitHub OAuth
 *   - ADMIN_PUBKEYS: comma-separated hex pubkeys
 *   - SESSION_TIMEOUT: duration string (default: 24h)
 *   - PUBLIC_URL: public-facing URL for OAuth callbacks
 *
 * @param env - Environment variables object (defaults to process.env)
 * @throws {ConfigError} if required variables are missing or invalid
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): BunkerConfig {
	const errors: string[] = [];

	// --- Required: MASTER_KEY ---
	const masterKey = env.MASTER_KEY;
	if (!masterKey) {
		errors.push('MASTER_KEY is required');
	} else if (!/^[0-9a-fA-F]{64}$/.test(masterKey)) {
		errors.push('MASTER_KEY must be a 64-character hex string (32 bytes)');
	}

	// --- Required: NOSTR_RELAYS ---
	const relaysRaw = env.NOSTR_RELAYS;
	let nostrRelays: string[] = [];
	if (!relaysRaw) {
		errors.push('NOSTR_RELAYS is required');
	} else {
		nostrRelays = relaysRaw
			.split(',')
			.map((r) => r.trim())
			.filter((r) => r.length > 0);

		if (nostrRelays.length === 0) {
			errors.push('NOSTR_RELAYS must contain at least one relay URL');
		}

		const invalidRelays = nostrRelays.filter((r) => !isValidRelayUrl(r));
		if (invalidRelays.length > 0) {
			errors.push(
				`Invalid relay URLs: ${invalidRelays.join(', ')}. Must use wss:// or ws:// protocol`,
			);
		}
	}

	// --- Optional: HOST ---
	const host = env.HOST ?? DEFAULT_HOST;

	// --- Optional: PORT ---
	let port = DEFAULT_PORT;
	if (env.PORT !== undefined) {
		const parsed = Number.parseInt(env.PORT, 10);
		if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
			errors.push('PORT must be a number between 1 and 65535');
		} else {
			port = parsed;
		}
	}

	// --- Optional: DATABASE_URL ---
	const databaseUrl = env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

	// --- Optional: OAuth ---
	const googleClientId = env.GOOGLE_CLIENT_ID ?? null;
	const googleClientSecret = env.GOOGLE_CLIENT_SECRET ?? null;
	const githubClientId = env.GITHUB_CLIENT_ID ?? null;
	const githubClientSecret = env.GITHUB_CLIENT_SECRET ?? null;

	// Validate OAuth pairs (both or neither)
	if ((googleClientId !== null) !== (googleClientSecret !== null)) {
		errors.push('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set or both be unset');
	}
	if ((githubClientId !== null) !== (githubClientSecret !== null)) {
		errors.push('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must both be set or both be unset');
	}

	// --- Optional: ADMIN_PUBKEYS ---
	let adminPubkeys: string[] = [];
	if (env.ADMIN_PUBKEYS) {
		adminPubkeys = env.ADMIN_PUBKEYS.split(',')
			.map((p) => p.trim())
			.filter((p) => p.length > 0);

		const invalidPubkeys = adminPubkeys.filter((p) => !isValidPubkey(p));
		if (invalidPubkeys.length > 0) {
			errors.push(
				`Invalid ADMIN_PUBKEYS: ${invalidPubkeys.join(', ')}. Must be 64-char hex strings`,
			);
		}
	}

	// --- Optional: SESSION_TIMEOUT ---
	let sessionTimeout = DEFAULT_SESSION_TIMEOUT;
	if (env.SESSION_TIMEOUT !== undefined) {
		try {
			sessionTimeout = parseDuration(env.SESSION_TIMEOUT);
		} catch (e) {
			errors.push(e instanceof ConfigError ? e.message : 'Invalid SESSION_TIMEOUT');
		}
	}

	// --- Optional: PUBLIC_URL ---
	const publicUrl = env.PUBLIC_URL ?? null;

	// --- Collect errors ---
	if (errors.length > 0) {
		throw new ConfigError(`Configuration errors:\n  - ${errors.join('\n  - ')}`);
	}

	return {
		masterKey: masterKey as string,
		nostrRelays,
		host,
		port,
		databaseUrl,
		googleClientId,
		googleClientSecret,
		githubClientId,
		githubClientSecret,
		adminPubkeys,
		sessionTimeout,
		publicUrl,
	};
}
