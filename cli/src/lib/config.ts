/**
 * Configuration management for Redshift CLI
 *
 * L2: Function-Author - Config storage and retrieval
 * L4: Integration-Contractor - File system contracts
 */

import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_RELAYS } from '@redshift/crypto';
import { generateSecretKey } from 'nostr-tools/pure';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { ConfigError } from './errors';
import {
	deleteBunkerKeyFromKeychain,
	deleteNsecFromKeychain,
	getBunkerKeyFromKeychain,
	getNsecFromKeychain,
} from './keychain';
import type { AuthMethod, BunkerAuth, RedshiftConfig } from './types';

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
}

export interface RelayConfigStatus {
	/** Relay URLs in effect for CLI operations */
	relays: string[];
	/** Whether relays came from user config or built-in defaults */
	source: 'custom' | 'default';
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
 * Ensure the config directory exists with restrictive permissions.
 *
 * SECURITY: The config directory may contain sensitive credentials (nsec)
 * when the system keychain is unavailable. Directory permissions are set
 * to 0o700 (owner-only access) to prevent other users from listing or
 * accessing config files.
 */
function ensureConfigDir(): void {
	const configDir = getConfigDir();
	if (!existsSync(configDir)) {
		mkdirSync(configDir, { recursive: true, mode: 0o700 });
	}
	// Ensure permissions are correct even if directory already existed
	chmodSync(configDir, 0o700);
}

/**
 * Save global config to ~/.redshift/config.json
 *
 * SECURITY: File permissions are set to 0o600 (owner read/write only)
 * because the config file may contain the user's nsec private key in
 * plaintext when the system keychain is unavailable. Without restrictive
 * permissions, other users on the system could read the private key.
 */
export async function saveConfig(config: Config): Promise<void> {
	ensureConfigDir();
	const configPath = join(getConfigDir(), CONFIG_FILE);
	await Bun.write(configPath, JSON.stringify(config, null, 2));
	// Set file permissions to owner read/write only (0o600)
	// This prevents other system users from reading the nsec private key
	chmodSync(configPath, 0o600);
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
	const parsed = JSON.parse(content);
	if (typeof parsed !== 'object' || parsed === null) {
		throw new ConfigError('Invalid config: expected an object', configPath);
	}
	return parsed as Config;
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
	const parsed = parseYaml(content);
	if (typeof parsed !== 'object' || parsed === null) {
		throw new ConfigError('Invalid project config: expected an object', configPath);
	}
	const config = parsed as Record<string, unknown>;
	if (typeof config.project !== 'string' || !config.project) {
		throw new ConfigError(
			'Invalid project config: "project" must be a non-empty string',
			configPath,
		);
	}
	if (typeof config.environment !== 'string' || !config.environment) {
		throw new ConfigError(
			'Invalid project config: "environment" must be a non-empty string',
			configPath,
		);
	}
	return parsed as RedshiftConfig;
}

/**
 * Get relay configuration status, including the source of the active relay set.
 */
export async function getRelayConfigStatus(): Promise<RelayConfigStatus> {
	const config = await loadConfig();

	if (Array.isArray(config.relays) && config.relays.length > 0) {
		return { relays: config.relays, source: 'custom' };
	}

	// Default public relays (from shared @redshift/crypto package)
	return { relays: [...DEFAULT_RELAYS], source: 'default' };
}

/**
 * Get default relay URLs.
 * Returns config relays or fallback defaults.
 */
export async function getRelays(): Promise<string[]> {
	const status = await getRelayConfigStatus();
	return status.relays;
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
			clientSecretKey: Buffer.from(generateSecretKey()).toString('hex'),
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

	// 3. Check config for explicit bunker auth before falling back to keychain nsec.
	// This prevents a previous local nsec from silently overriding a bunker login.
	const config = await loadConfig();

	if (config.authMethod === 'bunker' && config.bunker) {
		// Try to retrieve client key from keychain if not in config
		if (!config.bunker.clientSecretKey) {
			const keychainKey = await getBunkerKeyFromKeychain();
			if (keychainKey) {
				return {
					method: 'bunker',
					bunker: { ...config.bunker, clientSecretKey: keychainKey },
					source: 'keychain',
				};
			}
		}
		if (!config.bunker.clientSecretKey) {
			throw new ConfigError(
				'Bunker client key is missing. Run `redshift login --force --bunker <url>` to re-authenticate.',
				join(getConfigDir(), CONFIG_FILE),
			);
		}
		return { method: 'bunker', bunker: config.bunker, source: 'config' };
	}

	// 4. Check system keychain (most secure for nsec)
	const keychainNsec = await getNsecFromKeychain();
	if (keychainNsec) {
		return { method: 'nsec', nsec: keychainNsec, source: 'keychain' };
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
	await deleteBunkerKeyFromKeychain();

	// Clear from config file
	const config = await loadConfig();
	delete config.authMethod;
	delete config.nsec;
	delete config.bunker;
	await saveConfig(config);
}
