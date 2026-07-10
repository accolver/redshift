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
import { validateNsec } from './crypto';
import { ConfigError } from './errors';
import {
	deleteBunkerKeyFromKeychain,
	deleteNsecFromKeychain,
	getBunkerKeyFromKeychain,
	getNsecFromKeychain,
	storeBunkerKeyInKeychain,
	storeNsecInKeychain,
} from './keychain';
import type { AuthMethod, BunkerAuth, RedshiftConfig } from './types';
import { validateEnvironment, validateProjectId, validateRelayUrl } from './validation';

/**
 * Global Redshift configuration stored in ~/.redshift/config.json
 */
export interface Config {
	/** Authentication method */
	authMethod?: AuthMethod;
	/** Legacy plaintext nsec accepted only for one-time keychain migration */
	nsec?: string;
	/** Bunker auth info for NIP-46 */
	bunker?: BunkerAuth;
	/** Default relay URLs */
	relays?: string[];
	/** Default project ID */
	defaultProject?: string;
	/** Default environment slug */
	defaultEnvironment?: string;
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
const MAX_RELAY_URLS = 16;
const REDACTED = '[REDACTED]';

export function normalizeRelayUrls(relays: string[], source = 'relay configuration'): string[] {
	if (relays.length === 0) {
		throw new ConfigError(`${source} must contain at least one relay URL`);
	}
	if (relays.length > MAX_RELAY_URLS) {
		throw new ConfigError(`${source} cannot contain more than ${MAX_RELAY_URLS} relay URLs`);
	}

	const normalized = new Set<string>();
	for (const relay of relays) {
		const trimmed = relay.trim();
		const validation = validateRelayUrl(trimmed);
		if (!validation.valid) {
			throw new ConfigError(`Invalid ${source} URL "${relay}": ${validation.error}`);
		}
		const parsed = new URL(trimmed);
		if (parsed.username || parsed.password) {
			throw new ConfigError(`Invalid ${source} URL "${relay}": credentials are not allowed`);
		}
		normalized.add(parsed.href);
	}
	return [...normalized];
}

function validateGlobalConfig(config: Config): Config {
	return {
		...config,
		...(config.relays ? { relays: normalizeRelayUrls(config.relays, 'global relay') } : {}),
		...(config.bunker
			? {
					bunker: {
						...config.bunker,
						relays: normalizeRelayUrls(config.bunker.relays, 'bunker relay'),
					},
				}
			: {}),
	};
}

export function redactConfig(config: Config): Record<string, unknown> {
	return {
		...config,
		...(config.nsec ? { nsec: REDACTED } : {}),
		...(config.bunker
			? {
					bunker: {
						...config.bunker,
						...(config.bunker.clientSecretKey ? { clientSecretKey: REDACTED } : {}),
						...(config.bunker.secret ? { secret: REDACTED } : {}),
					},
				}
			: {}),
	};
}

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

/** Persist validated config. This private path also supports one-time legacy sanitization. */
async function writeConfig(config: Config): Promise<void> {
	ensureConfigDir();
	const configPath = join(getConfigDir(), CONFIG_FILE);
	const validated = validateGlobalConfig(config);
	await Bun.write(configPath, JSON.stringify(validated, null, 2));
	chmodSync(configPath, 0o600);
}

function assertNoPlaintextCredentials(config: Config) {
	if (config.nsec || config.bunker?.clientSecretKey || config.bunker?.secret) {
		throw new ConfigError(
			'Plaintext credentials cannot be saved in config; use the system keychain or command-scoped REDSHIFT_NSEC/REDSHIFT_BUNKER.',
			join(getConfigDir(), CONFIG_FILE),
		);
	}
}

/** Save non-secret global configuration to ~/.redshift/config.json. */
export async function saveConfig(config: Config): Promise<void> {
	assertNoPlaintextCredentials(config);
	await writeConfig(config);
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
	return validateGlobalConfig(parsed as Config);
}

/**
 * Get the private key (nsec) from available sources.
 * Priority: ENV > Keychain > Config file
 *
 * @returns The nsec and its source, or null if not found
 */
function withoutLegacyNsec(config: Config): Config {
	const { nsec: _nsec, ...sanitized } = config;
	return sanitized;
}

function withoutLegacyBunkerSecrets(config: Config): Config {
	const { nsec: _nsec, ...withoutNsec } = config;
	if (!config.bunker) return withoutNsec;
	const { clientSecretKey: _clientSecretKey, secret: _secret, ...pointer } = config.bunker;
	return { ...withoutNsec, bunker: pointer };
}

async function resolveStoredNsec(config: Config): Promise<PrivateKeyResult | null> {
	const keychainNsec = await getNsecFromKeychain();
	if (keychainNsec && validateNsec(keychainNsec)) {
		if (config.nsec) await writeConfig(withoutLegacyNsec(config));
		return { nsec: keychainNsec, source: 'keychain' };
	}
	if (!config.nsec) {
		return keychainNsec ? { nsec: keychainNsec, source: 'keychain' } : null;
	}
	if (!validateNsec(config.nsec)) {
		throw new ConfigError(
			'Legacy config contains an invalid nsec. Re-authenticate or use REDSHIFT_NSEC for command-scoped authentication.',
			join(getConfigDir(), CONFIG_FILE),
		);
	}
	if (!(await storeNsecInKeychain(config.nsec))) {
		throw new ConfigError(
			'Legacy plaintext nsec could not be migrated because the system keychain is unavailable. Use REDSHIFT_NSEC for command-scoped authentication.',
			join(getConfigDir(), CONFIG_FILE),
		);
	}
	const migratedNsec = config.nsec;
	await writeConfig(withoutLegacyNsec(config));
	return { nsec: migratedNsec, source: 'keychain' };
}

/** Resolve an nsec from command scope or secure storage, migrating legacy plaintext once. */
export async function getPrivateKey(): Promise<PrivateKeyResult | null> {
	const envNsec = process.env.REDSHIFT_NSEC;
	if (envNsec) return { nsec: envNsec, source: 'env' };
	return resolveStoredNsec(await loadConfig());
}

/**
 * Save project-specific config to redshift.yaml in the given directory.
 */
export async function saveProjectConfig(projectDir: string, config: RedshiftConfig): Promise<void> {
	const configPath = join(projectDir, PROJECT_CONFIG_FILE);
	const projectValidation = validateProjectId(config.project);
	if (!projectValidation.valid) {
		throw new ConfigError(`Invalid project config: ${projectValidation.error}`, configPath);
	}
	const environmentValidation = validateEnvironment(config.environment);
	if (!environmentValidation.valid) {
		throw new ConfigError(`Invalid environment config: ${environmentValidation.error}`, configPath);
	}
	const validated: RedshiftConfig = {
		...config,
		...(config.relays ? { relays: normalizeRelayUrls(config.relays, 'project relay') } : {}),
	};
	const yaml = stringifyYaml(validated);
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
	const projectValidation = validateProjectId(config.project);
	if (!projectValidation.valid) {
		throw new ConfigError(`Invalid project config: ${projectValidation.error}`, configPath);
	}
	const environmentValidation = validateEnvironment(config.environment);
	if (!environmentValidation.valid) {
		throw new ConfigError(`Invalid environment config: ${environmentValidation.error}`, configPath);
	}
	const result = parsed as RedshiftConfig;
	return {
		...result,
		...(result.relays ? { relays: normalizeRelayUrls(result.relays, 'project relay') } : {}),
	};
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
		const relays = normalizeRelayUrls(url.searchParams.getAll('relay'), 'bunker relay');
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
		let clientSecretKey = await getBunkerKeyFromKeychain();
		if (clientSecretKey && /^[0-9a-f]{64}$/i.test(clientSecretKey)) {
			if (config.bunker.clientSecretKey || config.bunker.secret) {
				await writeConfig(withoutLegacyBunkerSecrets(config));
			}
		} else if (config.bunker.clientSecretKey) {
			if (!/^[0-9a-f]{64}$/i.test(config.bunker.clientSecretKey)) {
				throw new ConfigError(
					'Legacy config contains an invalid bunker client key. Re-authenticate with `redshift login --force --bunker-stdin`.',
					join(getConfigDir(), CONFIG_FILE),
				);
			}
			if (!(await storeBunkerKeyInKeychain(config.bunker.clientSecretKey))) {
				throw new ConfigError(
					'Legacy plaintext bunker client key could not be migrated because the system keychain is unavailable. Re-authenticate with `redshift login --force --bunker-stdin` or use REDSHIFT_BUNKER for command-scoped authentication.',
					join(getConfigDir(), CONFIG_FILE),
				);
			}
			clientSecretKey = config.bunker.clientSecretKey;
			await writeConfig(withoutLegacyBunkerSecrets(config));
		}
		if (!clientSecretKey || !/^[0-9a-f]{64}$/i.test(clientSecretKey)) {
			throw new ConfigError(
				'Bunker client key is missing. Run `redshift login --force --bunker-stdin` or use REDSHIFT_BUNKER for command-scoped authentication.',
				join(getConfigDir(), CONFIG_FILE),
			);
		}
		const sanitized = withoutLegacyBunkerSecrets(config);
		return {
			method: 'bunker',
			bunker: { ...sanitized.bunker!, clientSecretKey },
			source: 'keychain',
		};
	}

	const storedNsec = await resolveStoredNsec(config);
	return storedNsec ? { method: 'nsec', ...storedNsec } : null;
}

/**
 * Save bunker auth to config
 */
export async function saveBunkerAuth(bunker: BunkerAuth): Promise<void> {
	if (bunker.clientSecretKey || bunker.secret) {
		throw new ConfigError('Bunker credentials cannot be persisted in config.');
	}
	const config = await loadConfig();
	config.authMethod = 'bunker';
	config.bunker = {
		bunkerPubkey: bunker.bunkerPubkey,
		relays: bunker.relays,
	};
	delete config.nsec;
	await saveConfig(config);
}

/**
 * Clear all auth from config and keychain
 */
export async function resetConfig(): Promise<void> {
	await deleteNsecFromKeychain();
	await deleteBunkerKeyFromKeychain();
	await saveConfig({});
}

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
