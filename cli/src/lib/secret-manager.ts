/**
 * Secret Manager - Core business logic for secret operations
 *
 * L2: Function-Author - Secret management functions
 * L4: Integration-Contractor - NIP-59 protocol compliance
 */

import { getPublicKey } from 'nostr-tools/pure';
import {
	createDTag,
	createDeletionEvent,
	createTombstone,
	parseDTag,
	unwrapGiftWrap,
	unwrapSecrets as unwrapSecretsFromEvent,
	wrapSecrets as wrapSecretsToEvent,
} from './crypto';
import type { UnwrapResult } from './crypto';
import { NotConnectedError } from './errors';
import type { RelayPool } from './relay';
import { createRelayPool, filterGiftWraps } from './relay';
import type { GiftWrapResult, NostrEvent, SecretBundle } from './types';

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
	dTag: string | null;
	secrets: SecretBundle;
	createdAt: number;
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
	private privateKey: Uint8Array;
	private publicKey: string;
	private pool: RelayPool | null = null;

	/** Decryption cache keyed by event ID - avoids re-decrypting known events */
	private decryptionCache = new Map<string, DecryptionCacheEntry | null>();

	/** Short-lived cache for fetchAllSecrets Promise deduplication */
	private fetchAllCache: FetchAllCache | null = null;

	constructor(privateKey: Uint8Array) {
		this.privateKey = privateKey;
		this.publicKey = getPublicKey(privateKey);
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
		if (this.pool) {
			this.pool.close();
		}
		this.pool = createRelayPool(relayUrls);
	}

	/**
	 * Disconnect from relays and zero private key memory.
	 * This instance is terminal after disconnect — the key cannot be restored.
	 */
	disconnect(): void {
		if (this.pool) {
			this.pool.close();
			this.pool = null;
		}
		this.privateKey.fill(0);
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
	wrapSecrets(secrets: SecretBundle, dTag: string): GiftWrapResult {
		return wrapSecretsToEvent(secrets, this.privateKey, dTag);
	}

	/**
	 * Unwrap a Gift Wrap event to retrieve secrets
	 */
	unwrapSecrets(event: NostrEvent): SecretBundle {
		return unwrapSecretsFromEvent(event, this.privateKey);
	}

	/**
	 * Unwrap a Gift Wrap event with full metadata
	 */
	unwrapWithMetadata(event: NostrEvent): UnwrapResult {
		return unwrapGiftWrap(event, this.privateKey);
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
				if (cached?.dTag) {
					const existing = latestByDTag.get(cached.dTag);
					if (!existing || cached.createdAt > existing.createdAt) {
						latestByDTag.set(cached.dTag, {
							secrets: cached.secrets,
							dTag: cached.dTag,
							createdAt: cached.createdAt,
							eventId: gw.id,
						});
					}
				}
				continue; // Skip decryption (cached null means it failed before)
			}

			try {
				const result = unwrapGiftWrap(gw, this.privateKey);

				// Cache the successful decryption
				this.decryptionCache.set(gw.id, {
					dTag: result.dTag,
					secrets: result.secrets,
					createdAt: result.createdAt,
				});

				if (!result.dTag) {
					continue; // Skip events without d-tag
				}

				const existing = latestByDTag.get(result.dTag);
				if (!existing || result.createdAt > existing.createdAt) {
					latestByDTag.set(result.dTag, {
						secrets: result.secrets,
						dTag: result.dTag,
						createdAt: result.createdAt,
						eventId: gw.id,
					});
				}
			} catch {
				// Cache the failure so we don't re-attempt (event not for us)
				this.decryptionCache.set(gw.id, null);
			}
		}

		// Convert to Map<string, SecretBundle>
		const secretsMap = new Map<string, SecretBundle>();
		for (const [dTag, entry] of latestByDTag) {
			secretsMap.set(dTag, entry.secrets);
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
		const { event } = this.wrapSecrets(secrets, dTag);

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
		const { event } = createTombstone(this.privateKey, dTag);

		await this.pool.publish(event);

		// Invalidate caches so next fetch picks up the tombstone
		this.clearCache();

		return event;
	}

	/**
	 * Create a NIP-09 deletion request for specific events
	 */
	async requestDeletion(eventIds: string[], reason?: string): Promise<NostrEvent> {
		if (!this.pool) {
			throw new NotConnectedError();
		}

		const deletion = createDeletionEvent(eventIds, this.privateKey, reason);
		await this.pool.publish(deletion);

		return deletion;
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
export function injectSecrets(
	baseEnv: Record<string, string | undefined>,
	secrets: SecretBundle,
): Record<string, string> {
	const result: Record<string, string> = {};

	// Copy base environment
	for (const [key, value] of Object.entries(baseEnv)) {
		if (value !== undefined) {
			result[key] = value;
		}
	}

	// Inject secrets — values should always be strings per SecretBundle type,
	// but coerce defensively in case unvalidated data reaches this function
	for (const [key, value] of Object.entries(secrets)) {
		if (typeof value === 'string') {
			result[key] = value;
		} else if (typeof value === 'object' && value !== null) {
			result[key] = JSON.stringify(value);
		} else {
			result[key] = String(value);
		}
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
