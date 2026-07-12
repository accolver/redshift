/**
 * Gift Wrap Secrets Model
 *
 * Handles reading encrypted secrets from NIP-59 Gift Wrap events.
 * Supports both:
 * - nsec: Direct private key access (synchronous)
 * - NIP-07/bunker: Signer-based decryption (async, but we batch decrypt)
 *
 * L4: Integration-Contractor - NIP-59 protocol compliance
 */

import {
	type DecryptFn,
	HISTORY_LIMITS,
	NostrKinds,
	type SecretHistoryObservation,
	type SecretVersion,
	type UnwrapResult,
	compareSecretVersions,
	createSecretHistoryObservation,
	isRedshiftSecretsEvent,
	parseDTag,
	unwrapGiftWrap,
	unwrapGiftWrapWithSigner,
} from '$lib/crypto';
import type { Secret } from '$lib/types/nostr';
import type { EventStore } from 'applesauce-core';
import type { NostrEvent } from 'nostr-tools';
import { type Observable, from, of } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';

export interface SharedDecryptionBatch {
	events: Array<{ event: NostrEvent; result: UnwrapResult }>;
	observedEvents: number;
	truncated: boolean;
}

/**
 * Decryptor can be either a private key (for nsec) or a decrypt function (for NIP-07/bunker)
 */
export type Decryptor =
	| { type: 'privateKey'; key: Uint8Array }
	| { type: 'decryptFn'; expectedAuthor: string; fn: DecryptFn };

/**
 * Module-level decryption cache keyed by event ID.
 * Caches both successful results AND nulls (to avoid re-attempting
 * events that belong to other users or are corrupted).
 */
const decryptionCache = new Map<string, UnwrapResult | null>();
const HISTORY_TEXT_ENCODER = new TextEncoder();

class RemoteSignerDecryptionError extends Error {
	constructor(readonly originalError: unknown) {
		super('Remote signer decryption failed');
		this.name = 'RemoteSignerDecryptionError';
	}
}

/**
 * Clear the decryption cache.
 * Call this when the user logs out or switches accounts.
 */
export function clearDecryptionCache(): void {
	decryptionCache.clear();
}

/**
 * Convert a SecretBundle (Record<string, unknown>) to Secret[] format
 */
function bundleToSecrets(bundle: Record<string, unknown>): Secret[] {
	return Object.entries(bundle).map(([key, value]) => ({
		key,
		value: typeof value === 'string' ? value : JSON.stringify(value),
	}));
}

/**
 * Unwrap events using the appropriate method based on decryptor type.
 * Uses a module-level decryption cache to avoid redundant decryption work.
 * This is especially important because multiple RxJS subscriptions
 * (GiftWrapSecretsModel and AllGiftWrapSecretsModel) both call this
 * function on the same set of events.
 */
async function unwrapEvents(
	events: NostrEvent[],
	decryptor: Decryptor,
): Promise<Array<{ event: NostrEvent; result: UnwrapResult }>> {
	const results: Array<{ event: NostrEvent; result: UnwrapResult }> = [];

	for (const event of events) {
		// Check cache first (keyed by event ID)
		if (decryptionCache.has(event.id)) {
			const cached = decryptionCache.get(event.id);
			if (cached) {
				results.push({ event, result: cached });
			}
			// null means it failed before - skip without re-attempting
			continue;
		}

		try {
			let result: UnwrapResult;
			if (decryptor.type === 'privateKey') {
				result = unwrapGiftWrap(event, decryptor.key);
			} else {
				result = await unwrapGiftWrapWithSigner(
					event,
					decryptor.expectedAuthor,
					async (pubkey, ciphertext) => {
						try {
							return await decryptor.fn(pubkey, ciphertext);
						} catch (error) {
							// Every remote exception is uncertain. Shared crypto rejects malformed
							// payload structure before invoking this callback.
							throw new RemoteSignerDecryptionError(error);
						}
					},
				);
			}
			// Cache successful decryption
			decryptionCache.set(event.id, result);
			results.push({ event, result });
		} catch (error) {
			if (error instanceof RemoteSignerDecryptionError) {
				throw new Error('The remote signer could not decrypt observed secret state', {
					cause: error.originalError,
				});
			}
			// Cache cryptographically invalid or unrelated events, but never signer uncertainty.
			decryptionCache.set(event.id, null);
		}
	}

	return results;
}

function selectLatestByDTag(unwrappedEvents: Array<{ event: NostrEvent; result: UnwrapResult }>) {
	const latest = new Map<string, UnwrapResult>();
	for (const { result } of unwrappedEvents) {
		const existing = latest.get(result.dTag);
		if (!existing || compareSecretVersions(result, existing) > 0) {
			latest.set(result.dTag, result);
		}
	}
	return latest;
}

function isNewerVersion(candidate: SecretVersion, current: SecretVersion | null) {
	return current === null || compareSecretVersions(candidate, current) > 0;
}

function assertCompleteCurrentBatch(batch: SharedDecryptionBatch) {
	if (batch.truncated) {
		throw new Error(
			'Observed secret state reached the fixed safety bound; current selection is blocked',
		);
	}
}

/**
 * Create a shared decryption pipeline that can be consumed by multiple
 * subscribers without duplicating decryption work.
 *
 * Uses `shareReplay(1)` so that:
 * - Multiple subscribers share a single decryption stream
 * - Late subscribers immediately get the latest decrypted results
 * - Combined with the decryption cache, this eliminates redundant crypto ops
 *
 * @param eventStore - The EventStore containing Gift Wrap events
 * @param decryptor - Either a private key or decrypt function
 */
export function createSharedDecryptionPipeline(
	eventStore: EventStore,
	decryptor: Decryptor,
): Observable<SharedDecryptionBatch> {
	return eventStore
		.timeline({
			kinds: [NostrKinds.GIFT_WRAP],
		})
		.pipe(
			switchMap((events) => {
				const redshiftEvents = events.filter((event) =>
					isRedshiftSecretsEvent(event as NostrEvent),
				) as NostrEvent[];
				const bounded = boundRedshiftHistoryEvents(redshiftEvents);
				return from(unwrapEvents(bounded.events, decryptor)).pipe(
					map((unwrapped) => ({
						events: unwrapped,
						observedEvents: bounded.observedEvents,
						truncated: bounded.truncated,
					})),
				);
			}),
			shareReplay({ bufferSize: 1, refCount: true }),
		);
}

export function boundRedshiftHistoryEvents(events: NostrEvent[]) {
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
 * GiftWrapSecretsModel - Returns secrets for a specific project/environment
 * by unwrapping Gift Wrap events.
 *
 * @param eventStore - The EventStore containing Gift Wrap events
 * @param decryptor - Either a private key or decrypt function
 * @param projectName - The human-friendly project name (used in d-tag)
 * @param environmentSlug - The environment slug to filter by
 * @param sharedPipeline - Optional shared decryption pipeline (avoids duplicate decryption)
 */
export function GiftWrapSecretsModel(
	eventStore: EventStore,
	decryptor: Decryptor,
	projectName: string,
	environmentSlug: string,
	sharedPipeline?: Observable<SharedDecryptionBatch>,
): Observable<Secret[]> {
	const targetDTag = `${projectName}|${environmentSlug}`;

	// Use shared pipeline if provided, otherwise create standalone
	const source$ = sharedPipeline ?? createSharedDecryptionPipeline(eventStore, decryptor);

	return source$.pipe(
		map((batch) => {
			assertCompleteCurrentBatch(batch);
			let latest: UnwrapResult | null = null;
			for (const { result } of batch.events) {
				if (result.dTag === targetDTag && isNewerVersion(result, latest)) {
					latest = result;
				}
			}
			return latest ? bundleToSecrets(latest.secrets) : [];
		}),
	);
}

/**
 * GiftWrapHistoryModel - Returns bounded authenticated observed history for one d-tag.
 * Relay retention is not complete or durable history.
 */
export function GiftWrapHistoryModel(
	eventStore: EventStore,
	decryptor: Decryptor,
	projectName: string,
	environmentSlug: string,
	sharedPipeline?: Observable<SharedDecryptionBatch>,
): Observable<SecretHistoryObservation> {
	const targetDTag = `${projectName}|${environmentSlug}`;
	const source$ = sharedPipeline ?? createSharedDecryptionPipeline(eventStore, decryptor);
	return source$.pipe(
		map((batch) => {
			const versions = batch.events
				.map(({ result }) => result)
				.filter((result) => result.dTag === targetDTag);
			return createSecretHistoryObservation(versions, batch.observedEvents, batch.truncated);
		}),
	);
}

/**
 * AllGiftWrapSecretsModel - Returns secrets from all environments for a project
 *
 * @param eventStore - The EventStore containing Gift Wrap events
 * @param decryptor - Either a private key or decrypt function
 * @param projectName - The human-friendly project name (used in d-tag)
 * @param environmentSlugs - List of environment slugs to fetch
 * @param sharedPipeline - Optional shared decryption pipeline (avoids duplicate decryption)
 */
export function AllGiftWrapSecretsModel(
	eventStore: EventStore,
	decryptor: Decryptor,
	projectName: string,
	environmentSlugs: string[],
	sharedPipeline?: Observable<SharedDecryptionBatch>,
): Observable<Map<string, Secret[]>> {
	if (environmentSlugs.length === 0) {
		return of(new Map());
	}

	// Create target d-tags for all environments
	const targetDTags = new Set(environmentSlugs.map((slug) => `${projectName}|${slug}`));

	// Use shared pipeline if provided, otherwise create standalone
	const source$ = sharedPipeline ?? createSharedDecryptionPipeline(eventStore, decryptor);

	return source$.pipe(
		map((batch) => {
			assertCompleteCurrentBatch(batch);
			const latestByEnv = new Map<string, UnwrapResult>();

			for (const { result } of batch.events) {
				if (!targetDTags.has(result.dTag)) continue;
				const parsed = parseDTag(result.dTag);
				if (!parsed?.environment) continue;

				const existing = latestByEnv.get(parsed.environment) ?? null;
				if (isNewerVersion(result, existing)) {
					latestByEnv.set(parsed.environment, result);
				}
			}

			const envMap = new Map<string, Secret[]>();
			for (const [slug, result] of latestByEnv) {
				envMap.set(slug, bundleToSecrets(result.secrets));
			}

			// Add empty arrays for environments with no secrets
			for (const slug of environmentSlugs) {
				if (!envMap.has(slug)) {
					envMap.set(slug, []);
				}
			}

			return envMap;
		}),
	);
}

/**
 * ListGiftWrapProjectsModel - Returns all unique project IDs from Gift Wrap events
 *
 * @param eventStore - The EventStore containing Gift Wrap events
 * @param decryptor - Either a private key or decrypt function
 */
export function ListGiftWrapProjectsModel(
	eventStore: EventStore,
	decryptor: Decryptor,
	sharedPipeline?: Observable<SharedDecryptionBatch>,
): Observable<string[]> {
	const source$ = sharedPipeline ?? createSharedDecryptionPipeline(eventStore, decryptor);

	return source$.pipe(
		map((batch) => {
			assertCompleteCurrentBatch(batch);
			const projects = new Set<string>();
			for (const result of selectLatestByDTag(batch.events).values()) {
				if (Object.keys(result.secrets).length === 0) continue;
				const parsed = parseDTag(result.dTag);
				if (parsed?.projectId) projects.add(parsed.projectId);
			}
			return Array.from(projects);
		}),
	);
}

/**
 * ListGiftWrapEnvironmentsModel - Returns all environments for a project from Gift Wrap events
 *
 * @param eventStore - The EventStore containing Gift Wrap events
 * @param decryptor - Either a private key or decrypt function
 * @param projectName - The human-friendly project name (used in d-tag)
 * @param sharedPipeline - Optional shared decryption pipeline (avoids duplicate decryption)
 */
export function ListGiftWrapEnvironmentsModel(
	eventStore: EventStore,
	decryptor: Decryptor,
	projectName: string,
	sharedPipeline?: Observable<SharedDecryptionBatch>,
): Observable<string[]> {
	const source$ = sharedPipeline ?? createSharedDecryptionPipeline(eventStore, decryptor);

	return source$.pipe(
		map((batch) => {
			assertCompleteCurrentBatch(batch);
			const environments = new Set<string>();
			for (const result of selectLatestByDTag(batch.events).values()) {
				if (Object.keys(result.secrets).length === 0) continue;
				const parsed = parseDTag(result.dTag);
				if (parsed?.projectId === projectName && parsed.environment) {
					environments.add(parsed.environment);
				}
			}
			return Array.from(environments);
		}),
	);
}
