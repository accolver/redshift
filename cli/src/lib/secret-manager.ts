/**
 * Secret Manager - Core business logic for secret operations
 *
 * L2: Function-Author - Secret management functions
 * L4: Integration-Contractor - NIP-59 protocol compliance
 */

import type { EventTemplate, VerifiedEvent } from 'nostr-tools/core';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import {
	compareSecretVersions,
	createDTag,
	parseDTag,
	unwrapGiftWrap,
	unwrapGiftWrapWithSigner,
	unwrapSecrets as unwrapSecretsFromEvent,
	wrapSecrets as wrapSecretsToEvent,
	wrapSecretsWithSigner,
} from './crypto';
import type { AsyncGiftWrapResult, GiftWrapResult, UnwrapResult } from './crypto';
import { NotConnectedError, ValidationError } from './errors';
import type { RelayPool } from './relay';
import { createRelayPool, filterGiftWraps } from './relay';
import type { NostrEvent, SecretBundle } from './types';

/**
 * Signer abstraction for auth methods that do not expose a raw private key
 * (NIP-46 bunker now, NIP-07-style signers later).
 */
export interface SecretManagerSigner {
	getPublicKey(): string;
	signEvent(event: EventTemplate): Promise<VerifiedEvent | NostrEvent>;
	nip44Encrypt(pubkey: string, plaintext: string): Promise<string>;
	nip44Decrypt(pubkey: string, ciphertext: string): Promise<string>;
	close?(): Promise<void>;
}

/**
 * Cached secret entry with metadata
 */
interface SecretEntry {
	secrets: SecretBundle;
	dTag: string;
	createdAt: number;
	eventId: string;
}

/**
 * Cached decryption result keyed by event ID
 */
interface DecryptionCacheEntry {
	dTag: string;
	secrets: SecretBundle;
	createdAt: number;
	eventId: string;
}

/**
 * Short-lived cache for fetchAllSecrets Promise deduplication
 */
interface FetchAllCache {
	promise: Promise<Map<string, SecretBundle>>;
	expiresAt: number;
}

/** Cache TTL for fetchAllSecrets deduplication (5 seconds) */
const FETCH_ALL_CACHE_TTL_MS = 5000;

/**
 * SecretManager handles all secret-related operations including
 * encryption, relay communication, and state management.
 */
export class SecretManager {
	private privateKey: Uint8Array | null = null;
	private signer: SecretManagerSigner | null = null;
	private publicKey: string;
	private pool: RelayPool | null = null;

	/** Decryption cache keyed by event ID - avoids re-decrypting known events */
	private decryptionCache = new Map<string, DecryptionCacheEntry | null>();

	/** Short-lived cache for fetchAllSecrets Promise deduplication */
	private fetchAllCache: FetchAllCache | null = null;

	constructor(auth: Uint8Array | SecretManagerSigner) {
		if (auth instanceof Uint8Array) {
			this.privateKey = auth.slice();
			this.publicKey = getPublicKey(auth);
		} else {
			this.signer = auth;
			this.publicKey = auth.getPublicKey();
		}
	}

	/**
	 * Clear the decryption cache.
	 * Call this after publishing new secrets to ensure fresh data on next fetch.
	 */
	clearCache(): void {
		this.decryptionCache.clear();
		this.fetchAllCache = null;
	}

	/**
	 * Get the user's public key (npub hex format)
	 */
	getPublicKey(): string {
		return this.publicKey;
	}

	/**
	 * Connect to relays
	 */
	connect(relayUrls: string[]): void {
		if (this.pool) this.pool.close();
		this.pool = createRelayPool(relayUrls, {
			authSigner: async (event) => {
				if (this.privateKey) return finalizeEvent(event, this.privateKey);
				if (!this.signer) throw new Error('No signer available for relay authentication');
				return (await this.signer.signEvent(event)) as VerifiedEvent;
			},
		});
	}

	/**
	 * Close relay/signer resources and zero private key memory.
	 * This instance is terminal after close — the key cannot be restored.
	 */
	async close(): Promise<void> {
		if (this.pool) {
			this.pool.close();
			this.pool = null;
		}
		if (this.privateKey) {
			this.privateKey.fill(0);
		}
		if (this.signer?.close) {
			await this.signer.close();
		}
	}

	/**
	 * Disconnect from relays and zero private key memory.
	 * Prefer awaiting close() when command lifecycle permits it.
	 */
	disconnect(): void {
		void this.close();
	}

	/**
	 * Check if connected to relays
	 */
	isConnected(): boolean {
		return this.pool !== null;
	}

	/**
	 * Wrap secrets into a Gift Wrap event
	 */
	async wrapSecrets(
		secrets: SecretBundle,
		dTag: string,
	): Promise<GiftWrapResult | AsyncGiftWrapResult> {
		if (this.privateKey) {
			return wrapSecretsToEvent(secrets, this.privateKey, dTag);
		}
		if (!this.signer) {
			throw new Error('No signing method available');
		}
		return wrapSecretsWithSigner(
			secrets,
			this.publicKey,
			dTag,
			(pubkey, plaintext) => this.signer!.nip44Encrypt(pubkey, plaintext),
			async (event) => this.signer!.signEvent(event),
		);
	}

	/**
	 * Unwrap a Gift Wrap event to retrieve secrets
	 */
	async unwrapSecrets(event: NostrEvent): Promise<SecretBundle> {
		if (this.privateKey) {
			return unwrapSecretsFromEvent(event, this.privateKey);
		}
		return (await this.unwrapWithMetadata(event)).secrets;
	}

	/**
	 * Unwrap a Gift Wrap event with full metadata
	 */
	async unwrapWithMetadata(event: NostrEvent): Promise<UnwrapResult> {
		if (this.privateKey) {
			return unwrapGiftWrap(event, this.privateKey);
		}
		if (!this.signer) {
			throw new Error('No decryption method available');
		}
		return unwrapGiftWrapWithSigner(event, this.publicKey, (pubkey, ciphertext) =>
			this.signer!.nip44Decrypt(pubkey, ciphertext),
		);
	}

	/**
	 * Fetch and unwrap all Gift Wrap events from relays.
	 * Returns a map of d-tag to the latest secrets for that d-tag.
	 *
	 * Uses a decryption cache to avoid re-decrypting previously seen events,
	 * and a short-lived Promise cache to deduplicate concurrent calls
	 * (e.g., listProjects + listEnvironments called back-to-back).
	 */
	async fetchAllSecrets(): Promise<Map<string, SecretBundle>> {
		// Return cached Promise if still valid (deduplicates concurrent calls)
		if (this.fetchAllCache && Date.now() < this.fetchAllCache.expiresAt) {
			return this.fetchAllCache.promise;
		}

		const promise = this._fetchAllSecretsInternal();

		// Cache the Promise for short-lived deduplication
		this.fetchAllCache = {
			promise,
			expiresAt: Date.now() + FETCH_ALL_CACHE_TTL_MS,
		};

		// Clear the Promise cache when it settles (success or failure).
		// The .catch() on the finally chain suppresses an unhandled-rejection
		// warning that Bun/Node emit when a rejected promise has no error handler
		// attached before the microtask queue drains.
		promise
			.finally(() => {
				// Only clear if this is still our cached promise
				if (this.fetchAllCache?.promise === promise) {
					// Keep it alive until expiry for deduplication, but mark for cleanup
					setTimeout(() => {
						if (this.fetchAllCache?.promise === promise) {
							this.fetchAllCache = null;
						}
					}, FETCH_ALL_CACHE_TTL_MS);
				}
			})
			.catch(() => {
				// Rejection is handled by callers of fetchAllSecrets(); suppress here
				// to avoid an unhandled-rejection event on the .finally() chain.
			});

		return promise;
	}

	/**
	 * Internal implementation of fetchAllSecrets with decryption caching.
	 */
	private async _fetchAllSecretsInternal(): Promise<Map<string, SecretBundle>> {
		if (!this.pool) {
			throw new NotConnectedError();
		}

		const filter = filterGiftWraps(this.publicKey);
		const giftWraps = await this.pool.query(filter);

		// Unwrap all events and track latest by d-tag
		const latestByDTag = new Map<string, SecretEntry>();

		for (const gw of giftWraps) {
			// Check decryption cache first
			if (this.decryptionCache.has(gw.id)) {
				const cached = this.decryptionCache.get(gw.id);
				if (cached) {
					const existing = latestByDTag.get(cached.dTag);
					if (!existing || compareSecretVersions(cached, existing) > 0) {
						latestByDTag.set(cached.dTag, cached);
					}
				}
				continue; // Skip decryption (cached null means it failed before)
			}

			try {
				const result = await this.unwrapWithMetadata(gw);

				// Cache the successful decryption
				const entry: DecryptionCacheEntry = {
					dTag: result.dTag,
					secrets: result.secrets,
					createdAt: result.createdAt,
					eventId: result.eventId,
				};
				this.decryptionCache.set(gw.id, entry);

				const existing = latestByDTag.get(result.dTag);
				if (!existing || compareSecretVersions(entry, existing) > 0) {
					latestByDTag.set(result.dTag, entry);
				}
			} catch {
				// Cache the failure so we don't re-attempt (event not for us)
				this.decryptionCache.set(gw.id, null);
			}
		}

		// Convert to Map<string, SecretBundle>
		const secretsMap = new Map<string, SecretBundle>();
		for (const [dTag, entry] of latestByDTag) {
			if (Object.keys(entry.secrets).length > 0) {
				secretsMap.set(dTag, entry.secrets);
			}
		}

		return secretsMap;
	}

	/**
	 * List all projects (unique project IDs from d-tags)
	 */
	async listProjects(): Promise<string[]> {
		const allSecrets = await this.fetchAllSecrets();
		const projects = new Set<string>();

		for (const dTag of allSecrets.keys()) {
			const parsed = parseDTag(dTag);
			if (parsed) {
				projects.add(parsed.projectId);
			}
		}

		return Array.from(projects);
	}

	/**
	 * List all environments for a project
	 */
	async listEnvironments(projectId: string): Promise<string[]> {
		const allSecrets = await this.fetchAllSecrets();
		const environments: string[] = [];

		for (const dTag of allSecrets.keys()) {
			const parsed = parseDTag(dTag);
			if (parsed && parsed.projectId === projectId) {
				environments.push(parsed.environment);
			}
		}

		return environments;
	}

	/**
	 * Fetch secrets for a specific project/environment.
	 * Delegates to fetchAllSecrets() to reuse its decryption cache and
	 * Promise deduplication, then looks up the matching d-tag.
	 */
	async fetchSecrets(projectId: string, environment: string): Promise<SecretBundle | null> {
		const allSecrets = await this.fetchAllSecrets();
		const targetDTag = createDTag(projectId, environment);
		return allSecrets.get(targetDTag) ?? null;
	}

	/**
	 * Publish secrets to relays.
	 * Clears the decryption cache to ensure subsequent fetches see fresh data.
	 */
	async publishSecrets(
		projectId: string,
		environment: string,
		secrets: SecretBundle,
	): Promise<NostrEvent> {
		if (!this.pool) {
			throw new NotConnectedError();
		}

		const dTag = createDTag(projectId, environment);
		const { event } = await this.wrapSecrets(secrets, dTag);

		await this.pool.publish(event);

		// Invalidate caches so next fetch picks up the new event
		this.clearCache();

		return event;
	}

	/**
	 * Delete secrets by publishing a tombstone (empty bundle).
	 * Clears the decryption cache to ensure subsequent fetches see fresh data.
	 */
	async deleteSecrets(projectId: string, environment: string): Promise<NostrEvent> {
		if (!this.pool) {
			throw new NotConnectedError();
		}

		const dTag = createDTag(projectId, environment);
		const { event } = await this.wrapSecrets({}, dTag);

		await this.pool.publish(event);

		// Invalidate caches so next fetch picks up the tombstone
		this.clearCache();

		return event;
	}
}

/**
 * Inject secrets into an environment object.
 * SecretBundle values are always strings (validated at unwrap time).
 *
 * @param baseEnv - The base environment (e.g., process.env)
 * @param secrets - The secrets to inject
 * @returns New environment object with secrets injected
 */
const REDSHIFT_AUTH_VARIABLES = new Set(['REDSHIFT_NSEC', 'REDSHIFT_BUNKER']);
const BLOCKED_CHILD_SECRET_NAMES = new Set([
	...REDSHIFT_AUTH_VARIABLES,
	'NODE_OPTIONS',
	'NODE_PATH',
	'PYTHONPATH',
	'PYTHONHOME',
	'PYTHONSTARTUP',
	'RUBYOPT',
	'RUBYLIB',
	'BASH_ENV',
	'ENV',
	'LD_PRELOAD',
	'LD_LIBRARY_PATH',
	'DYLD_INSERT_LIBRARIES',
	'DYLD_LIBRARY_PATH',
	'DYLD_FRAMEWORK_PATH',
	'PERL5OPT',
	'PERL5LIB',
]);

export function validateInjectableSecretName(key: string): void {
	const canonicalKey = key.toUpperCase();
	if (BLOCKED_CHILD_SECRET_NAMES.has(canonicalKey)) {
		throw new ValidationError(
			`Secret "${key}" is not allowed because ${canonicalKey} can expose Redshift authentication or alter runtime startup`,
		);
	}
}

export function injectSecrets(
	baseEnv: Record<string, string | undefined>,
	secrets: SecretBundle,
): Record<string, string> {
	const result: Record<string, string> = {};

	for (const [key, value] of Object.entries(baseEnv)) {
		if (value !== undefined && !REDSHIFT_AUTH_VARIABLES.has(key.toUpperCase())) {
			result[key] = value;
		}
	}

	for (const [key, value] of Object.entries(secrets)) {
		validateInjectableSecretName(key);
		result[key] = value;
	}

	return result;
}

/**
 * Merge two secret bundles, with overlay taking precedence.
 */
export function mergeSecrets(base: SecretBundle, overlay: SecretBundle): SecretBundle {
	return { ...base, ...overlay };
}

/**
 * Extract unique project IDs from a list of d-tags.
 */
export function extractProjects(dTags: string[]): string[] {
	const projects = new Set<string>();

	for (const dTag of dTags) {
		const parsed = parseDTag(dTag);
		if (parsed) {
			projects.add(parsed.projectId);
		}
	}

	return Array.from(projects);
}
