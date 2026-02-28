import type { Secret } from '$lib/types/nostr';

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

/**
 * Represents a secret that exists in other environments but not the current one
 */
export interface MissingSecret {
	key: string;
	existsIn: string[]; // Environment slugs where this secret exists
}

/**
 * Calculate missing secrets for the current environment
 * Returns secrets that exist in other environments but not in the current one
 */
export function calculateMissingSecrets(
	allEnvSecrets: Map<string, Secret[]>,
	currentEnvSlug: string,
): MissingSecret[] {
	const currentSecrets = allEnvSecrets.get(currentEnvSlug) ?? [];
	const currentKeys = new Set(currentSecrets.map((s) => s.key));

	// Find all unique keys across all environments
	const keyToEnvs = new Map<string, string[]>();

	for (const [envSlug, secrets] of allEnvSecrets) {
		if (envSlug === currentEnvSlug) continue;
		for (const secret of secrets) {
			if (!currentKeys.has(secret.key)) {
				const envs = keyToEnvs.get(secret.key) ?? [];
				envs.push(envSlug);
				keyToEnvs.set(secret.key, envs);
			}
		}
	}

	// Convert to array and sort alphabetically
	const missing: MissingSecret[] = [];
	for (const [key, existsIn] of keyToEnvs) {
		missing.push({ key, existsIn });
	}

	return missing.sort((a, b) => a.key.localeCompare(b.key));
}
