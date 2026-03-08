/**
 * Secret Manager - Core business logic for secret operations
 *
 * L2: Function-Author - Secret management functions
 * L4: Integration-Contractor - NIP-59 protocol compliance
 */

import { unwrapGiftWrapWithSigner, wrapSecretsWithSigner } from '@redshift/crypto';
import { getPublicKey } from 'nostr-tools/pure';
import {
	createDTag,
	createDeletionEvent,
	parseDTag,
	unwrapGiftWrap,
	unwrapSecrets as unwrapSecretsFromEvent,
	wrapSecrets as wrapSecretsToEvent,
} from './crypto';
import type { UnwrapResult } from './crypto';
import { NotConnectedError } from './errors';
import type { RelayPool } from './relay';
import { createRelayPool, filterGiftWraps } from './relay';
import type { GiftWrapResult, NostrEvent, NostrSigner, SecretBundle } from './types';

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
 *
 * Accepts either a raw Uint8Array private key (nsec auth) or a NostrSigner
 * (bunker auth). When a NostrSigner is provided, all crypto operations
 * are delegated to the signer (which may be a remote bunker).
 */
export class SecretManager {
	private privateKey: Uint8Array | null;
	private signer: NostrSigner | null;
	private publicKey: string;
	private pool: RelayPool | null = null;

	/** Decryption cache keyed by event ID - avoids re-decrypting known events */
	private decryptionCache = new Map<string, DecryptionCacheEntry | null>();

	/** Short-lived cache for fetchAllSecrets Promise deduplication */
	private fetchAllCache: FetchAllCache | null = null;

	constructor(keyOrSigner: Uint8Array | NostrSigner) {
		if (keyOrSigner instanceof Uint8Array) {
			this.privateKey = keyOrSigner;
			this.signer = null;
			this.publicKey = getPublicKey(keyOrSigner);
		} else {
			this.privateKey = null;
			this.signer = keyOrSigner;
			this.publicKey = keyOrSigner.pubkey;
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
		if (this.pool) {
			this.pool.close();
		}
		this.pool = createRelayPool(relayUrls);
	}

	/**
	 * Disconnect from relays
	 */
	disconnect(): void {
		if (this.pool) {
			this.pool.close();
			this.pool = null;
		}
	}

	/**
	 * Check if connected to relays
	 */
	isConnected(): boolean {
		return this.pool !== null;
	}

	/**
	 * Wrap secrets into a Gift Wrap event.
	 * Uses signer-based wrapping when a NostrSigner is provided.
	 */
	async wrapSecretsAsync(secrets: SecretBundle, dTag: string): Promise<GiftWrapResult> {
		const signer = this.signer;
		if (signer) {
			const result = await wrapSecretsWithSigner(
				secrets,
				this.publicKey,
				dTag,
				(pubkey: string, plaintext: string) => signer.encrypt(pubkey, plaintext),
				(event: { kind: number; created_at: number; tags: string[][]; content: string }) =>
					signer.signEvent(event),
			);
			return { event: result.event, rumor: result.rumor };
		}
		if (!this.privateKey) {
			throw new Error('No private key or signer available');
		}
		return wrapSecretsToEvent(secrets, this.privateKey, dTag);
	}

	/**
	 * Unwrap a Gift Wrap event with full metadata.
	 * Uses signer-based unwrapping when a NostrSigner is provided.
	 */
	async unwrapWithMetadataAsync(event: NostrEvent): Promise<UnwrapResult> {
		const signer = this.signer;
		if (signer) {
			return unwrapGiftWrapWithSigner(event, (pubkey: string, ciphertext: string) =>
				signer.decrypt(pubkey, ciphertext),
			);
		}
		if (!this.privateKey) {
			throw new Error('No private key or signer available');
		}
		return unwrapGiftWrap(event, this.privateKey);
	}

	/**
	 * Wrap secrets into a Gift Wrap event (sync, nsec-only).
	 * @deprecated Use wrapSecretsAsync for signer compatibility.
	 */
	wrapSecrets(secrets: SecretBundle, dTag: string): GiftWrapResult {
		if (!this.privateKey) {
			throw new Error(
				'Sync wrapSecrets requires a private key. Use wrapSecretsAsync for signer-based auth.',
			);
		}
		return wrapSecretsToEvent(secrets, this.privateKey, dTag);
	}

	/**
	 * Unwrap a Gift Wrap event to retrieve secrets (sync, nsec-only).
	 * @deprecated Use unwrapWithMetadataAsync for signer compatibility.
	 */
	unwrapSecrets(event: NostrEvent): SecretBundle {
		if (!this.privateKey) {
			throw new Error(
				'Sync unwrapSecrets requires a private key. Use unwrapWithMetadataAsync for signer-based auth.',
			);
		}
		return unwrapSecretsFromEvent(event, this.privateKey);
	}

	/**
	 * Unwrap a Gift Wrap event with full metadata (sync, nsec-only).
	 * @deprecated Use unwrapWithMetadataAsync for signer compatibility.
	 */
	unwrapWithMetadata(event: NostrEvent): UnwrapResult {
		if (!this.privateKey) {
			throw new Error(
				'Sync unwrapWithMetadata requires a private key. Use unwrapWithMetadataAsync for signer-based auth.',
			);
		}
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

		// Clear the Promise cache when it settles (success or failure)
		promise.finally(() => {
			// Only clear if this is still our cached promise
			if (this.fetchAllCache?.promise === promise) {
				// Keep it alive until expiry for deduplication, but mark for cleanup
				setTimeout(() => {
					if (this.fetchAllCache?.promise === promise) {
						this.fetchAllCache = null;
					}
				}, FETCH_ALL_CACHE_TTL_MS);
			}
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
				const result = await this.unwrapWithMetadataAsync(gw);

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
	 * Uses the decryption cache to avoid redundant decryption work.
	 */
	async fetchSecrets(projectId: string, environment: string): Promise<SecretBundle | null> {
		if (!this.pool) {
			throw new NotConnectedError();
		}

		const targetDTag = createDTag(projectId, environment);
		const filter = filterGiftWraps(this.publicKey);
		const giftWraps = await this.pool.query(filter);

		// Find the latest event with matching d-tag
		let latestSecrets: SecretBundle | null = null;
		let latestTimestamp = 0;

		for (const gw of giftWraps) {
			// Check decryption cache first
			if (this.decryptionCache.has(gw.id)) {
				const cached = this.decryptionCache.get(gw.id);
				if (cached?.dTag === targetDTag && cached.createdAt > latestTimestamp) {
					latestTimestamp = cached.createdAt;
					latestSecrets = cached.secrets;
				}
				continue; // Skip decryption (cached null means it failed before)
			}

			try {
				const result = await this.unwrapWithMetadataAsync(gw);

				// Cache the successful decryption
				this.decryptionCache.set(gw.id, {
					dTag: result.dTag,
					secrets: result.secrets,
					createdAt: result.createdAt,
				});

				// Only consider events with matching d-tag
				if (result.dTag !== targetDTag) {
					continue;
				}

				if (result.createdAt > latestTimestamp) {
					latestTimestamp = result.createdAt;
					latestSecrets = result.secrets;
				}
			} catch {
				// Cache the failure so we don't re-attempt
				this.decryptionCache.set(gw.id, null);
			}
		}

		return latestSecrets;
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
		const { event } = await this.wrapSecretsAsync(secrets, dTag);

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
		// Tombstone is an empty secret bundle wrapped via the signer path
		const { event } = await this.wrapSecretsAsync({}, dTag);

		await this.pool.publish(event);

		// Invalidate caches so next fetch picks up the tombstone
		this.clearCache();

		return event;
	}

	/**
	 * Create a NIP-09 deletion request for specific events.
	 * Note: Deletion events must be signed by the user's real key.
	 * For bunker auth, this uses the signer's signEvent.
	 */
	async requestDeletion(eventIds: string[], reason?: string): Promise<NostrEvent> {
		if (!this.pool) {
			throw new NotConnectedError();
		}

		let deletion: NostrEvent;
		const signer = this.signer;
		if (signer) {
			// Create tags with 'e' for each event ID to delete
			const tags: string[][] = eventIds.map((id) => ['e', id]);
			const signed = await signer.signEvent({
				kind: 5, // NIP-09 deletion
				created_at: Math.floor(Date.now() / 1000),
				tags,
				content: reason ?? '',
			});
			deletion = signed;
		} else if (this.privateKey) {
			deletion = createDeletionEvent(eventIds, this.privateKey, reason);
		} else {
			throw new Error('No private key or signer available');
		}

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
