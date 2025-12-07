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

import { map, switchMap } from 'rxjs/operators';
import { of, from, type Observable } from 'rxjs';
import type { EventStore } from 'applesauce-core';
import type { NostrEvent } from 'nostr-tools';
import {
	unwrapGiftWrap,
	unwrapGiftWrapWithSigner,
	isRedshiftSecretsEvent,
	parseDTag,
	NostrKinds,
	type DecryptFn,
	type UnwrapResult,
} from '$lib/crypto';
import type { Secret } from '$lib/types/nostr';

/**
 * Decryptor can be either a private key (for nsec) or a decrypt function (for NIP-07/bunker)
 */
export type Decryptor =
	| { type: 'privateKey'; key: Uint8Array }
	| { type: 'decryptFn'; fn: DecryptFn };

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
 * Unwrap events using the appropriate method based on decryptor type
 */
async function unwrapEvents(
	events: NostrEvent[],
	decryptor: Decryptor,
): Promise<Array<{ event: NostrEvent; result: UnwrapResult }>> {
	const results: Array<{ event: NostrEvent; result: UnwrapResult }> = [];

	for (const event of events) {
		try {
			let result: UnwrapResult;
			if (decryptor.type === 'privateKey') {
				result = unwrapGiftWrap(event, decryptor.key);
			} else {
				result = await unwrapGiftWrapWithSigner(event, decryptor.fn);
			}
			results.push({ event, result });
		} catch {
			// Skip events that fail to decrypt (not for us or corrupted)
		}
	}

	return results;
}

/**
 * GiftWrapSecretsModel - Returns secrets for a specific project/environment
 * by unwrapping Gift Wrap events.
 *
 * @param eventStore - The EventStore containing Gift Wrap events
 * @param decryptor - Either a private key or decrypt function
 * @param projectId - The project ID to filter by
 * @param environmentSlug - The environment slug to filter by
 */
export function GiftWrapSecretsModel(
	eventStore: EventStore,
	decryptor: Decryptor,
	projectId: string,
	environmentSlug: string,
): Observable<Secret[]> {
	const targetDTag = `${projectId}|${environmentSlug}`;

	// Query the timeline for Gift Wrap events
	return eventStore
		.timeline({
			kinds: [NostrKinds.GIFT_WRAP],
		})
		.pipe(
			switchMap((events) => {
				// Filter to only Redshift secrets events
				const redshiftEvents = events.filter((e) =>
					isRedshiftSecretsEvent(e as NostrEvent),
				) as NostrEvent[];

				// Unwrap all events
				return from(unwrapEvents(redshiftEvents, decryptor));
			}),
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
 * @param projectId - The project ID to filter by
 * @param environmentSlugs - List of environment slugs to fetch
 */
export function AllGiftWrapSecretsModel(
	eventStore: EventStore,
	decryptor: Decryptor,
	projectId: string,
	environmentSlugs: string[],
): Observable<Map<string, Secret[]>> {
	if (environmentSlugs.length === 0) {
		return of(new Map());
	}

	// Create target d-tags for all environments
	const targetDTags = new Set(environmentSlugs.map((slug) => `${projectId}|${slug}`));

	return eventStore
		.timeline({
			kinds: [NostrKinds.GIFT_WRAP],
		})
		.pipe(
			switchMap((events) => {
				// Filter to only Redshift secrets events
				const redshiftEvents = events.filter((e) =>
					isRedshiftSecretsEvent(e as NostrEvent),
				) as NostrEvent[];

				return from(unwrapEvents(redshiftEvents, decryptor));
			}),
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
): Observable<string[]> {
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
			map((unwrappedEvents) => {
				const projects = new Set<string>();

				for (const { result } of unwrappedEvents) {
					if (result.dTag) {
						const parsed = parseDTag(result.dTag);
						if (parsed && parsed.projectId) {
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
 * @param projectId - The project ID to filter by
 */
export function ListGiftWrapEnvironmentsModel(
	eventStore: EventStore,
	decryptor: Decryptor,
	projectId: string,
): Observable<string[]> {
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
			map((unwrappedEvents) => {
				const environments = new Set<string>();

				for (const { result } of unwrappedEvents) {
					if (result.dTag) {
						const parsed = parseDTag(result.dTag);
						if (parsed && parsed.projectId === projectId && parsed.environment) {
							environments.add(parsed.environment);
						}
					}
				}

				return Array.from(environments);
			}),
		);
}
