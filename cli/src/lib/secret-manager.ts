/**
 * Secret Manager - Core business logic for secret operations
 *
 * L2: Function-Author - Secret management functions
 * L4: Integration-Contractor - NIP-59 protocol compliance
 */

import type { EventTemplate, VerifiedEvent } from 'nostr-tools/core';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import {
	HISTORY_LIMITS,
	MAX_RUMOR_FUTURE_SKEW_SECONDS,
	compareSecretVersions,
	createDTag,
	createSecretHistoryObservation,
	parseDTag,
	unwrapGiftWrap,
	unwrapGiftWrapWithSigner,
	unwrapSecrets as unwrapSecretsFromEvent,
	wrapSecrets as wrapSecretsToEvent,
	wrapSecretsWithSigner,
} from './crypto';
import type {
	AsyncGiftWrapResult,
	GiftWrapResult,
	SecretHistoryObservation,
	UnwrapResult,
	WrapOptions,
} from './crypto';
import { NotConnectedError, RecoveryError, ValidationError } from './errors';
import {
	createProvisionalRecoveryRecord,
	removeRecoveryRecord,
	saveRecoveryRecord,
	updateRecoveryRecord,
} from './publication-recovery';
import type { RecoveryRecord } from './publication-recovery';
import type { PublishReport, RelayPool } from './relay';
import {
	PublishQuorumError,
	createRelayPool,
	filterGiftWrapHistory,
	filterGiftWraps,
} from './relay';
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

export interface SecretManagerOptions {
	createPool?: typeof createRelayPool;
	saveRecovery?: (record: RecoveryRecord, expectedRevision?: string) => Promise<void>;
	removeRecovery?: (eventId: string) => Promise<void>;
}

export interface SecretPublication {
	event: NostrEvent;
	report: PublishReport;
}

/**
 * Cached secret entry with metadata
 */
export interface SecretStateSnapshot {
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
	pubkey: string;
}

/**
 * Short-lived cache for fetchAllSecrets Promise deduplication
 */
class SignerDecryptionError extends Error {
	readonly originalError: unknown;

	constructor(originalError: unknown) {
		super('Remote signer decryption failed');
		this.name = 'SignerDecryptionError';
		this.originalError = originalError;
	}
}

interface FetchAllCache {
	promise: Promise<Map<string, SecretBundle>>;
	expiresAt: number;
}

/** Cache TTL for fetchAllSecrets deduplication (5 seconds) */
const FETCH_ALL_CACHE_TTL_MS = 5000;
const HISTORY_TEXT_ENCODER = new TextEncoder();

/**
 * SecretManager handles all secret-related operations including
 * encryption, relay communication, and state management.
 */
export class SecretManager {
	private privateKey: Uint8Array | null = null;
	private signer: SecretManagerSigner | null = null;
	private publicKey: string;
	private pool: RelayPool | null = null;
	private lastPublication: SecretPublication | null = null;
	private readonly options: Required<SecretManagerOptions>;

	/** Decryption cache keyed by event ID - avoids re-decrypting known events */
	private decryptionCache = new Map<string, DecryptionCacheEntry | null>();

	/** Short-lived cache for fetchAllSecrets Promise deduplication */
	private fetchAllCache: FetchAllCache | null = null;

	constructor(auth: Uint8Array | SecretManagerSigner, options: SecretManagerOptions = {}) {
		this.options = {
			createPool: options.createPool ?? createRelayPool,
			saveRecovery: options.saveRecovery ?? saveRecoveryRecord,
			removeRecovery: options.removeRecovery ?? removeRecoveryRecord,
		};
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

	getLastPublication(): SecretPublication | null {
		return this.lastPublication;
	}

	/**
	 * Connect to relays
	 */
	connect(relayUrls: string[]): void {
		if (this.pool) this.pool.close();
		this.pool = this.options.createPool(relayUrls, {
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
		options?: WrapOptions,
	): Promise<GiftWrapResult | AsyncGiftWrapResult> {
		validatePublishTimestamp(options?.createdAt);
		if (this.privateKey) {
			return wrapSecretsToEvent(secrets, this.privateKey, dTag, options);
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
			options,
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
		return unwrapGiftWrapWithSigner(event, this.publicKey, async (pubkey, ciphertext) => {
			try {
				return await this.signer!.nip44Decrypt(pubkey, ciphertext);
			} catch (error) {
				// Every remote exception is uncertain. Structural ciphertext errors are rejected
				// inside unwrapGiftWrapWithSigner before this callback is invoked.
				throw new SignerDecryptionError(error);
			}
		});
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

	/** Return latest authenticated state, including logical tombstones and version evidence. */
	async fetchAllSecretStates(): Promise<Map<string, SecretStateSnapshot>> {
		const states = await this._fetchAllSecretStatesInternal();
		return new Map(
			[...states].map(([dTag, state]) => [dTag, { ...state, secrets: { ...state.secrets } }]),
		);
	}

	/**
	 * Observe bounded authenticated history for one exact project/environment.
	 * Relay retention is not complete history; a result at either cap is marked truncated.
	 */
	async fetchSecretHistory(
		projectId: string,
		environment: string,
	): Promise<SecretHistoryObservation> {
		if (!this.pool) throw new NotConnectedError();
		const targetDTag = createDTag(projectId, environment);
		const queriedGiftWraps = await this.pool.query(filterGiftWrapHistory(this.publicKey));
		const bounded = boundHistoryGiftWraps(queriedGiftWraps);
		const versions: UnwrapResult[] = [];
		for (const giftWrap of bounded.events) {
			const entry = await this.getDecryptionEntry(giftWrap);
			if (entry?.dTag === targetDTag) {
				versions.push({ ...entry, secrets: { ...entry.secrets } });
			}
		}
		return createSecretHistoryObservation(versions, bounded.observedEvents, bounded.truncated);
	}

	private async _fetchAllSecretsInternal(): Promise<Map<string, SecretBundle>> {
		const states = await this._fetchAllSecretStatesInternal();
		const secretsMap = new Map<string, SecretBundle>();
		for (const [dTag, entry] of states) {
			if (Object.keys(entry.secrets).length > 0) secretsMap.set(dTag, { ...entry.secrets });
		}
		return secretsMap;
	}

	/**
	 * Internal implementation of authenticated state selection with decryption caching.
	 */
	private async _fetchAllSecretStatesInternal(): Promise<Map<string, SecretStateSnapshot>> {
		if (!this.pool) {
			throw new NotConnectedError();
		}

		const filter = filterGiftWraps(this.publicKey);
		const giftWraps = await this.pool.query(filter);

		// Unwrap all events and track latest by d-tag
		const latestByDTag = new Map<string, SecretStateSnapshot>();

		for (const giftWrap of giftWraps) {
			const entry = await this.getDecryptionEntry(giftWrap);
			if (!entry) continue;
			const existing = latestByDTag.get(entry.dTag);
			if (!existing || compareSecretVersions(entry, existing) > 0) {
				latestByDTag.set(entry.dTag, {
					dTag: entry.dTag,
					secrets: entry.secrets,
					createdAt: entry.createdAt,
					eventId: entry.eventId,
				});
			}
		}

		return latestByDTag;
	}

	private async getDecryptionEntry(giftWrap: NostrEvent): Promise<DecryptionCacheEntry | null> {
		if (this.decryptionCache.has(giftWrap.id)) {
			return this.decryptionCache.get(giftWrap.id) ?? null;
		}
		try {
			const result = await this.unwrapWithMetadata(giftWrap);
			const entry: DecryptionCacheEntry = {
				dTag: result.dTag,
				secrets: { ...result.secrets },
				createdAt: result.createdAt,
				eventId: result.eventId,
				pubkey: result.pubkey,
			};
			this.decryptionCache.set(giftWrap.id, entry);
			return entry;
		} catch (error) {
			if (error instanceof SignerDecryptionError) {
				throw new ValidationError('Remote signer could not decrypt the observed secret state');
			}
			// Cache cryptographically invalid or unrelated events, but never transient signer failures.
			this.decryptionCache.set(giftWrap.id, null);
			return null;
		}
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
		options?: WrapOptions,
	): Promise<NostrEvent> {
		if (!this.pool) {
			throw new NotConnectedError();
		}
		this.lastPublication = null;

		const dTag = createDTag(projectId, environment);
		const { event } = await this.wrapSecrets(secrets, dTag, options);
		await this.publishWithRecovery(event, projectId, environment);
		return event;
	}

	/**
	 * Delete secrets by publishing a tombstone (empty bundle).
	 * Clears the decryption cache to ensure subsequent fetches see fresh data.
	 */
	async retryPublication(event: NostrEvent, relays: string[]): Promise<PublishReport> {
		if (!this.pool) throw new NotConnectedError();
		return this.pool.publishTo(relays, event, Math.max(1, relays.length));
	}

	async deleteSecrets(projectId: string, environment: string): Promise<NostrEvent> {
		if (!this.pool) {
			throw new NotConnectedError();
		}
		this.lastPublication = null;

		const dTag = createDTag(projectId, environment);
		const { event } = await this.wrapSecrets({}, dTag);
		await this.publishWithRecovery(event, projectId, environment);
		return event;
	}

	private async publishWithRecovery(
		event: NostrEvent,
		projectId: string,
		environment: string,
	): Promise<PublishReport> {
		if (!this.pool) throw new NotConnectedError();
		const provisional = createProvisionalRecoveryRecord({
			ownerPubkey: this.publicKey,
			project: projectId,
			environment,
			event,
			relays: this.pool.relays,
		});
		await this.options.saveRecovery(provisional);

		let report: PublishReport;
		try {
			report = await this.pool.publish(event);
		} catch (error) {
			if (!(error instanceof PublishQuorumError)) throw error;
			report = error.report;
			this.lastPublication = { event, report };
			if (report.accepted.length > 0) this.clearCache();
			await this.persistFinalRecovery(provisional, report);
			throw error;
		}

		this.lastPublication = { event, report };
		this.clearCache();
		await this.persistFinalRecovery(provisional, report);
		return report;
	}

	private async persistFinalRecovery(
		provisional: RecoveryRecord,
		report: PublishReport,
	): Promise<void> {
		const finalRecord = updateRecoveryRecord(provisional, report);
		try {
			await this.options.saveRecovery(finalRecord, provisional.revision);
			if (report.outcomes.every(({ state }) => state === 'accepted')) {
				await this.options.removeRecovery(provisional.event.id);
			}
		} catch (error) {
			throw new RecoveryError(
				`Remote publication may have succeeded, but local recovery persistence failed for event ${provisional.event.id}. Do not create a replacement event automatically.`,
				error,
			);
		}
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

function validatePublishTimestamp(createdAt?: number) {
	if (createdAt === undefined) return;
	const now = Math.floor(Date.now() / 1000);
	if (
		!Number.isSafeInteger(createdAt) ||
		createdAt < 0 ||
		createdAt > now + MAX_RUMOR_FUTURE_SKEW_SECONDS
	) {
		throw new ValidationError('Secret publication timestamp is outside the allowed range');
	}
}

export function getNextSecretTimestamp(
	observedCreatedAt?: number,
	now = Math.floor(Date.now() / 1000),
) {
	if (!Number.isSafeInteger(now) || now < 0) throw new ValidationError('Invalid current timestamp');
	if (observedCreatedAt === undefined) return now;
	if (!Number.isSafeInteger(observedCreatedAt) || observedCreatedAt < 0) {
		throw new ValidationError('Invalid observed secret timestamp');
	}
	const next = Math.max(now, observedCreatedAt + 1);
	if (next > now + MAX_RUMOR_FUTURE_SKEW_SECONDS) {
		throw new ValidationError('Cannot create a strictly newer secret within the future-skew bound');
	}
	return next;
}

/**
 * Apply one deterministic global bound after multi-relay query aggregation.
 * Relay filter limits are per relay and therefore cannot enforce this alone.
 */
export function boundHistoryGiftWraps(events: NostrEvent[]) {
	const unique = new Map<string, NostrEvent>();
	for (const event of events) {
		if (!unique.has(event.id)) unique.set(event.id, event);
	}
	const ordered = [...unique.values()].sort((left, right) => {
		if (left.created_at !== right.created_at) return right.created_at - left.created_at;
		return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
	});
	const retained: NostrEvent[] = [];
	let ciphertextBytes = 0;
	for (const event of ordered) {
		if (retained.length >= HISTORY_LIMITS.maxObservedEvents) break;
		const eventBytes = HISTORY_TEXT_ENCODER.encode(event.content).length;
		if (ciphertextBytes + eventBytes > HISTORY_LIMITS.maxCiphertextBytes) break;
		retained.push(event);
		ciphertextBytes += eventBytes;
	}
	return {
		events: retained,
		observedEvents: ordered.length,
		truncated:
			ordered.length >= HISTORY_LIMITS.maxObservedEvents || retained.length < ordered.length,
	};
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
