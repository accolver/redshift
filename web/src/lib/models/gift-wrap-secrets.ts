/**
 * Gift Wrap Secrets Model
 *
 * Handles reading encrypted secrets from NIP-59 Gift Wrap events.
 * This replaces the plaintext secrets model for secure storage.
 *
 * L4: Integration-Contractor - NIP-59 protocol compliance
 */

import { map } from 'rxjs/operators';
import { of, type Observable } from 'rxjs';
import type { EventStore } from 'applesauce-core';
import type { NostrEvent } from 'nostr-tools';
import { unwrapGiftWrap, isRedshiftSecretsEvent, parseDTag, NostrKinds } from '$lib/crypto';
import type { Secret } from '$lib/types/nostr';

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
 * GiftWrapSecretsModel - Returns secrets for a specific project/environment
 * by unwrapping Gift Wrap events.
 *
 * @param eventStore - The EventStore containing Gift Wrap events
 * @param privateKey - The user's private key for decryption
 * @param projectId - The project ID to filter by
 * @param environmentSlug - The environment slug to filter by
 */
export function GiftWrapSecretsModel(
	eventStore: EventStore,
	privateKey: Uint8Array,
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
			map((events) => {
				// Filter to only Redshift secrets events
				const redshiftEvents = events.filter((e) => isRedshiftSecretsEvent(e as NostrEvent));

				// Unwrap and find the latest for our target d-tag
				let latestSecrets: Secret[] = [];
				let latestTimestamp = 0;

				for (const event of redshiftEvents) {
					try {
						const result = unwrapGiftWrap(event as NostrEvent, privateKey);

						// Only consider events matching our target d-tag
						if (result.dTag !== targetDTag) {
							continue;
						}

						// Keep the latest
						if (result.createdAt > latestTimestamp) {
							latestTimestamp = result.createdAt;
							latestSecrets = bundleToSecrets(result.secrets);
						}
					} catch {
						// Skip events that fail to decrypt (not for us or corrupted)
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
 * @param privateKey - The user's private key for decryption
 * @param projectId - The project ID to filter by
 * @param environmentSlugs - List of environment slugs to fetch
 */
export function AllGiftWrapSecretsModel(
	eventStore: EventStore,
	privateKey: Uint8Array,
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
			map((events) => {
				// Filter to only Redshift secrets events
				const redshiftEvents = events.filter((e) => isRedshiftSecretsEvent(e as NostrEvent));

				// Track latest for each environment
				const latestByEnv = new Map<string, { secrets: Secret[]; timestamp: number }>();

				for (const event of redshiftEvents) {
					try {
						const result = unwrapGiftWrap(event as NostrEvent, privateKey);

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
					} catch {
						// Skip events that fail to decrypt
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
 * @param privateKey - The user's private key for decryption
 */
export function ListGiftWrapProjectsModel(
	eventStore: EventStore,
	privateKey: Uint8Array,
): Observable<string[]> {
	return eventStore
		.timeline({
			kinds: [NostrKinds.GIFT_WRAP],
		})
		.pipe(
			map((events) => {
				const redshiftEvents = events.filter((e) => isRedshiftSecretsEvent(e as NostrEvent));
				const projects = new Set<string>();

				for (const event of redshiftEvents) {
					try {
						const result = unwrapGiftWrap(event as NostrEvent, privateKey);
						if (result.dTag) {
							const parsed = parseDTag(result.dTag);
							if (parsed && parsed.projectId) {
								projects.add(parsed.projectId);
							}
						}
					} catch {
						// Skip events that fail to decrypt
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
 * @param privateKey - The user's private key for decryption
 * @param projectId - The project ID to filter by
 */
export function ListGiftWrapEnvironmentsModel(
	eventStore: EventStore,
	privateKey: Uint8Array,
	projectId: string,
): Observable<string[]> {
	return eventStore
		.timeline({
			kinds: [NostrKinds.GIFT_WRAP],
		})
		.pipe(
			map((events) => {
				const redshiftEvents = events.filter((e) => isRedshiftSecretsEvent(e as NostrEvent));
				const environments = new Set<string>();

				for (const event of redshiftEvents) {
					try {
						const result = unwrapGiftWrap(event as NostrEvent, privateKey);
						if (result.dTag) {
							const parsed = parseDTag(result.dTag);
							if (parsed && parsed.projectId === projectId && parsed.environment) {
								environments.add(parsed.environment);
							}
						}
					} catch {
						// Skip events that fail to decrypt
					}
				}

				return Array.from(environments);
			}),
		);
}
