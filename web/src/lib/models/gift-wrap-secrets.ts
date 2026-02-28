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
	NostrKinds,
	type UnwrapResult,
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

/**
 * Decryptor can be either a private key (for nsec) or a decrypt function (for NIP-07/bunker)
 */
export type Decryptor =
	| { type: 'privateKey'; key: Uint8Array }
	| { type: 'decryptFn'; fn: DecryptFn };

/**
 * Module-level decryption cache keyed by event ID.
 * Caches both successful results AND nulls (to avoid re-attempting
 * events that belong to other users or are corrupted).
 */
const decryptionCache = new Map<string, UnwrapResult | null>();

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
				result = await unwrapGiftWrapWithSigner(event, decryptor.fn);
			}
			// Cache successful decryption
			decryptionCache.set(event.id, result);
			results.push({ event, result });
		} catch {
			// Cache the failure so we don't re-attempt (event not for us or corrupted)
			decryptionCache.set(event.id, null);
		}
	}

	return results;
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
): Observable<Array<{ event: NostrEvent; result: UnwrapResult }>> {
	return eventStore
		.timeline({
			kinds: [NostrKinds.GIFT_WRAP],
		})
		.pipe(
			switchMap((events) => {
				const redshiftEvents = events.filter((e) =>
					isRedshiftSecretsEvent(e as NostrEvent),
				) as NostrEvent[];

				return from(unwrapEvents(redshiftEvents, decryptor));
			}),
			shareReplay(1),
		);
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
	sharedPipeline?: Observable<Array<{ event: NostrEvent; result: UnwrapResult }>>,
): Observable<Secret[]> {
	const targetDTag = `${projectName}|${environmentSlug}`;

	// Use shared pipeline if provided, otherwise create standalone
	const source$ = sharedPipeline ?? createSharedDecryptionPipeline(eventStore, decryptor);

	return source$.pipe(
		map((unwrappedEvents) => {
			// Find the latest for our target d-tag
			let latestSecrets: Secret[] = [];
			let latestTimestamp = 0;

			for (const { result } of unwrappedEvents) {
				// Only consider events matching our target d-tag
				if (result.dTag !== targetDTag) {
					continue;
				}

				// Keep the latest
				if (result.createdAt > latestTimestamp) {
					latestTimestamp = result.createdAt;
					latestSecrets = bundleToSecrets(result.secrets);
				}
			}

			return latestSecrets;
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
	sharedPipeline?: Observable<Array<{ event: NostrEvent; result: UnwrapResult }>>,
): Observable<Map<string, Secret[]>> {
	if (environmentSlugs.length === 0) {
		return of(new Map());
	}

	// Create target d-tags for all environments
	const targetDTags = new Set(environmentSlugs.map((slug) => `${projectName}|${slug}`));

	// Use shared pipeline if provided, otherwise create standalone
	const source$ = sharedPipeline ?? createSharedDecryptionPipeline(eventStore, decryptor);

	return source$.pipe(
		map((unwrappedEvents) => {
			// Track latest for each environment
			const latestByEnv = new Map<string, { secrets: Secret[]; timestamp: number }>();

			for (const { result } of unwrappedEvents) {
				// Only consider events matching our target d-tags
				if (!result.dTag || !targetDTags.has(result.dTag)) {
					continue;
				}

				// Parse the d-tag to get environment slug
				const parsed = parseDTag(result.dTag);
				if (!parsed || !parsed.environment) {
					continue;
				}

				const envSlug = parsed.environment;
				const existing = latestByEnv.get(envSlug);

				// Keep the latest for each environment
				if (!existing || result.createdAt > existing.timestamp) {
					latestByEnv.set(envSlug, {
						secrets: bundleToSecrets(result.secrets),
						timestamp: result.createdAt,
					});
				}
			}

			// Convert to final map format
			const envMap = new Map<string, Secret[]>();
			for (const [slug, data] of latestByEnv) {
				envMap.set(slug, data.secrets);
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
	sharedPipeline?: Observable<Array<{ event: NostrEvent; result: UnwrapResult }>>,
): Observable<string[]> {
	const source$ = sharedPipeline ?? createSharedDecryptionPipeline(eventStore, decryptor);

	return source$.pipe(
		map((unwrappedEvents) => {
			const projects = new Set<string>();

			for (const { result } of unwrappedEvents) {
				if (result.dTag) {
					const parsed = parseDTag(result.dTag);
					if (parsed?.projectId) {
						projects.add(parsed.projectId);
					}
				}
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
	sharedPipeline?: Observable<Array<{ event: NostrEvent; result: UnwrapResult }>>,
): Observable<string[]> {
	const source$ = sharedPipeline ?? createSharedDecryptionPipeline(eventStore, decryptor);

	return source$.pipe(
		map((unwrappedEvents) => {
			const environments = new Set<string>();

			for (const { result } of unwrappedEvents) {
				if (result.dTag) {
					const parsed = parseDTag(result.dTag);
					if (parsed?.projectId === projectName && parsed.environment) {
						environments.add(parsed.environment);
					}
				}
			}

			return Array.from(environments);
		}),
	);
}
