/**
 * Configuration management for Redshift CLI
 *
 * L2: Function-Author - Config storage and retrieval
 * L4: Integration-Contractor - File system contracts
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { deleteNsecFromKeychain, getNsecFromKeychain } from './keychain';
import type { AuthMethod, BunkerAuth, RedshiftConfig } from './types';

/**
 * Cached subscription data stored in config
 */
export interface CachedSubscription {
	status: {
		active: boolean;
		tier?: 'cloud' | 'teams' | 'enterprise';
		expiresAt?: number;
		daysRemaining?: number;
		relayUrl?: string;
	};
	fetchedAt: number;
	pubkey: string;
}

/**
 * Global Redshift configuration stored in ~/.redshift/config.json
 */
export interface Config {
	/** Authentication method */
	authMethod?: AuthMethod;
	/** User's nsec (encrypted at rest in future versions) */
	nsec?: string;
	/** Bunker auth info for NIP-46 */
	bunker?: BunkerAuth;
	/** Default relay URLs */
	relays?: string[];
	/** Default project ID */
	defaultProject?: string;
	/** Cached subscription status */
	subscription?: CachedSubscription;
}

/**
 * Result of getPrivateKey indicating where the key came from
 */
export interface PrivateKeyResult {
	nsec: string;
	source: 'env' | 'config' | 'keychain';
}

/**
 * Result of getAuth with any auth method
 */
export interface AuthResult {
	method: AuthMethod;
	/** Present for nsec auth */
	nsec?: string;
	/** Present for bunker auth */
	bunker?: BunkerAuth;
	source: 'env' | 'config' | 'keychain';
}

const CONFIG_FILE = 'config.json';
const PROJECT_CONFIG_FILE = 'redshift.yaml';

/**
 * Get the Redshift config directory path.
 * Respects REDSHIFT_CONFIG_DIR env var for testing.
 */
export function getConfigDir(): string {
	if (process.env.REDSHIFT_CONFIG_DIR) {
		return process.env.REDSHIFT_CONFIG_DIR;
	}
	const homeDir = process.env.HOME || process.env.USERPROFILE || '';
	return join(homeDir, '.redshift');
}

/**
 * Ensure the config directory exists.
 */
function ensureConfigDir(): void {
	const configDir = getConfigDir();
	if (!existsSync(configDir)) {
		mkdirSync(configDir, { recursive: true });
	}
}

/**
 * Save global config to ~/.redshift/config.json
 */
export async function saveConfig(config: Config): Promise<void> {
	ensureConfigDir();
	const configPath = join(getConfigDir(), CONFIG_FILE);
	await Bun.write(configPath, JSON.stringify(config, null, 2));
}

/**
 * Load global config from ~/.redshift/config.json
 * Returns empty config if file doesn't exist.
 */
export async function loadConfig(): Promise<Config> {
	const configPath = join(getConfigDir(), CONFIG_FILE);

	if (!existsSync(configPath)) {
		return {};
	}

	const file = Bun.file(configPath);
	const content = await file.text();
	return JSON.parse(content) as Config;
}

/**
 * Get the private key (nsec) from available sources.
 * Priority: ENV > Keychain > Config file
 *
 * @returns The nsec and its source, or null if not found
 */
export async function getPrivateKey(): Promise<PrivateKeyResult | null> {
	// 1. Check environment variable (CI/CD mode)
	const envNsec = process.env.REDSHIFT_NSEC;
	if (envNsec) {
		return { nsec: envNsec, source: 'env' };
	}

	// 2. Check system keychain (most secure)
	const keychainNsec = await getNsecFromKeychain();
	if (keychainNsec) {
		return { nsec: keychainNsec, source: 'keychain' };
	}

	// 3. Fall back to config file
	const config = await loadConfig();
	if (config.nsec) {
		return { nsec: config.nsec, source: 'config' };
	}

	return null;
}

/**
 * Save project-specific config to redshift.yaml in the given directory.
 */
export async function saveProjectConfig(projectDir: string, config: RedshiftConfig): Promise<void> {
	const configPath = join(projectDir, PROJECT_CONFIG_FILE);
	const yaml = stringifyYaml(config);
	await Bun.write(configPath, yaml);
}

/**
 * Load project-specific config from redshift.yaml.
 * Returns null if file doesn't exist.
 */
export async function loadProjectConfig(projectDir: string): Promise<RedshiftConfig | null> {
	const configPath = join(projectDir, PROJECT_CONFIG_FILE);

	if (!existsSync(configPath)) {
		return null;
	}

	const file = Bun.file(configPath);
	const content = await file.text();
	return parseYaml(content) as RedshiftConfig;
}

/**
 * Get default relay URLs.
 * Returns config relays or fallback defaults.
 */
export async function getRelays(): Promise<string[]> {
	const config = await loadConfig();

	if (config.relays && config.relays.length > 0) {
		return config.relays;
	}

	// Default public relays
	return ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'];
}

/**
 * Get auth credentials from available sources.
 * Priority: ENV (nsec) > Keychain > Config (nsec or bunker)
 *
 * @returns Auth result or null if not authenticated
 */
export async function getAuth(): Promise<AuthResult | null> {
	// 1. Check environment variable (CI/CD mode - nsec only)
	const envNsec = process.env.REDSHIFT_NSEC;
	if (envNsec) {
		return { method: 'nsec', nsec: envNsec, source: 'env' };
	}

	// 2. Check bunker URL in env (for CI/CD with bunker)
	const envBunker = process.env.REDSHIFT_BUNKER;
	if (envBunker) {
		// Parse bunker URL from env
		// Format: bunker://<pubkey>?relay=...&secret=...
		const url = new URL(envBunker);
		const bunkerPubkey = url.hostname || url.pathname.replace('//', '');
		const relays = url.searchParams.getAll('relay');
		const secret = url.searchParams.get('secret');

		const bunkerAuth: BunkerAuth = {
			bunkerPubkey,
			relays,
			clientSecretKey: '', // Will need to generate or retrieve
		};
		if (secret) {
			bunkerAuth.secret = secret;
		}

		return {
			method: 'bunker',
			bunker: bunkerAuth,
			source: 'env',
		};
	}

	// 3. Check system keychain (most secure for nsec)
	const keychainNsec = await getNsecFromKeychain();
	if (keychainNsec) {
		return { method: 'nsec', nsec: keychainNsec, source: 'keychain' };
	}

	// 4. Check config file
	const config = await loadConfig();

	// Prefer bunker if configured
	if (config.authMethod === 'bunker' && config.bunker) {
		return { method: 'bunker', bunker: config.bunker, source: 'config' };
	}

	// Fall back to nsec in config file
	if (config.nsec) {
		return { method: 'nsec', nsec: config.nsec, source: 'config' };
	}

	return null;
}

/**
 * Save bunker auth to config
 */
export async function saveBunkerAuth(bunker: BunkerAuth): Promise<void> {
	const config = await loadConfig();
	config.authMethod = 'bunker';
	config.bunker = bunker;
	// Clear nsec when switching to bunker
	delete config.nsec;
	await saveConfig(config);
}

/**
 * Clear all auth from config and keychain
 */
export async function clearAuth(): Promise<void> {
	// Clear from keychain (ignore errors - may not be available)
	await deleteNsecFromKeychain();

	// Clear from config file
	const config = await loadConfig();
	delete config.authMethod;
	delete config.nsec;
	delete config.bunker;
	await saveConfig(config);
}
