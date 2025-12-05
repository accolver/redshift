import { map } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import type { EventStore } from 'applesauce-core';
import type { NostrEvent } from 'nostr-tools';
import { REDSHIFT_KIND, getSecretsDTag } from '$lib/stores/nostr.svelte';
import type { Secret, SecretsBundle } from '$lib/types/nostr';

/**
 * Secrets event content stored in Kind 30078 event
 * d-tag format: <project_id>|<environment_slug>
 */
interface SecretsEventContent {
	type: 'secrets';
	secrets: Secret[];
	updatedAt?: number;
}

/**
 * Parse a Nostr event into a SecretsBundle object
 */
function parseSecretsEvent(event: NostrEvent): SecretsBundle | null {
	try {
		const content = JSON.parse(event.content) as SecretsEventContent;

		// Only parse secrets-type events
		if (content.type !== 'secrets') {
			return null;
		}

		// Get the d-tag and parse it
		const dTag = event.tags.find((t) => t[0] === 'd')?.[1];
		if (!dTag || !dTag.includes('|')) return null;

		const [projectId, environmentSlug] = dTag.split('|');

		return {
			projectId,
			environmentSlug,
			secrets: content.secrets ?? [],
			updatedAt: content.updatedAt ?? event.created_at * 1000,
		};
	} catch {
		return null;
	}
}

/**
 * SecretsModel - Returns secrets for a specific project environment
 *
 * This model subscribes to a replaceable event with d-tag: <projectId>|<envSlug>
 */
export function SecretsModel(
	eventStore: EventStore,
	pubkey: string,
	projectId: string,
	environmentSlug: string,
): Observable<Secret[]> {
	const dTag = getSecretsDTag(projectId, environmentSlug);

	return eventStore.replaceable(REDSHIFT_KIND, pubkey, dTag).pipe(
		map((event) => {
			if (!event) return [];
			const bundle = parseSecretsEvent(event);
			return bundle?.secrets ?? [];
		}),
	);
}

/**
 * SecretsBundleModel - Returns the full secrets bundle with metadata
 */
export function SecretsBundleModel(
	eventStore: EventStore,
	pubkey: string,
	projectId: string,
	environmentSlug: string,
): Observable<SecretsBundle | null> {
	const dTag = getSecretsDTag(projectId, environmentSlug);

	return eventStore.replaceable(REDSHIFT_KIND, pubkey, dTag).pipe(
		map((event) => {
			if (!event) return null;
			return parseSecretsEvent(event);
		}),
	);
}

/**
 * Create a secrets event content object
 */
export function createSecretsContent(secrets: Secret[]): SecretsEventContent {
	return {
		type: 'secrets',
		secrets,
		updatedAt: Date.now(),
	};
}

/**
 * Parse secrets from event content (already JSON parsed)
 */
export function parseSecretsContent(content: unknown): Secret[] {
	if (!content || typeof content !== 'object') return [];
	const typed = content as SecretsEventContent;
	if (typed.type !== 'secrets') return [];
	return typed.secrets ?? [];
}

/**
 * Add or update a secret in the secrets array
 */
export function upsertSecret(secrets: Secret[], key: string, value: string): Secret[] {
	const existing = secrets.findIndex((s) => s.key === key);
	if (existing >= 0) {
		// Update existing
		return secrets.map((s, i) => (i === existing ? { key, value } : s));
	} else {
		// Add new
		return [...secrets, { key, value }];
	}
}

/**
 * Remove a secret from the secrets array
 */
export function removeSecret(secrets: Secret[], key: string): Secret[] {
	return secrets.filter((s) => s.key !== key);
}
