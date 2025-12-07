/**
 * Secrets Store using NIP-59 Gift Wrap Encryption
 *
 * This store manages secrets for the currently selected project/environment.
 * All secrets are encrypted using NIP-59 Gift Wrap before being published
 * to relays, ensuring end-to-end encryption.
 *
 * L5: Journey-Validator - Secret management workflow
 * L4: Integration-Contractor - NIP-59 protocol compliance
 */

import type { SecretsState, Secret } from '$lib/types/nostr';
import type { Subscription } from 'rxjs';
import { eventStore, publishEvent } from './nostr.svelte';
import {
	GiftWrapSecretsModel,
	AllGiftWrapSecretsModel,
	type Decryptor,
} from '$lib/models/gift-wrap-secrets';
import { calculateMissingSecrets, type MissingSecret } from '$lib/models/secrets';
import {
	getAuthState,
	getPrivateKey,
	supportsEncryption,
	getEncryptFn,
	getDecryptFn,
} from './auth.svelte';
import { wrapSecrets, wrapSecretsWithSigner, createDTag, type NostrEvent } from '$lib/crypto';

/**
 * Secrets state using $state rune
 */
let secretsState = $state<SecretsState>({
	secrets: [],
	isLoading: false,
	isSaving: false,
	error: null,
	saveError: null,
});

/**
 * Missing secrets state (secrets that exist in other environments but not current)
 */
let missingSecretsState = $state<{
	missing: MissingSecret[];
	isLoading: boolean;
}>({
	missing: [],
	isLoading: false,
});

/**
 * All environments secrets (for cross-env comparison)
 */
let allEnvSecretsState = $state<Map<string, Secret[]>>(new Map());

/**
 * Current context
 * Note: projectSlug is the immutable project identifier used in d-tags (e.g., "keyfate")
 */
let currentProjectSlug: string | null = null;
let currentEnvironmentSlug: string | null = null;
let currentEnvironmentSlugs: string[] = [];

/**
 * Cached decryptor for the current session
 */
let cachedDecryptor: Decryptor | null = null;

/**
 * Cached encrypt function for publishing (NIP-07/bunker)
 */
let cachedEncryptFn: ((pubkey: string, plaintext: string) => Promise<string>) | null = null;

/**
 * Cached private key for publishing (nsec only)
 */
let cachedPrivateKey: Uint8Array | null = null;

/**
 * Track active subscriptions
 */
let subscription: Subscription | null = null;
let allEnvSubscription: Subscription | null = null;

/**
 * Get current secrets state (reactive)
 */
export function getSecretsState(): SecretsState {
	return secretsState;
}

/**
 * Get current context
 */
export function getSecretsContext(): {
	projectSlug: string | null;
	environmentSlug: string | null;
} {
	return { projectSlug: currentProjectSlug, environmentSlug: currentEnvironmentSlug };
}

/**
 * Get missing secrets state (reactive)
 */
export function getMissingSecretsState(): { missing: MissingSecret[]; isLoading: boolean } {
	return missingSecretsState;
}

/**
 * Get all environments' secrets (for cross-env features)
 */
export function getAllEnvSecretsState(): Map<string, Secret[]> {
	return allEnvSecretsState;
}

/**
 * Convert Secret[] to SecretBundle (Record<string, string>) format
 */
function secretsToBundle(secrets: Secret[]): Record<string, string> {
	const bundle: Record<string, string> = {};
	for (const secret of secrets) {
		bundle[secret.key] = secret.value;
	}
	return bundle;
}

/**
 * Subscribe to secrets for a specific project/environment.
 * Uses NIP-59 Gift Wrap for encrypted storage.
 *
 * @param projectSlug - The immutable project slug used in d-tags (e.g., "keyfate")
 * @param environmentSlug - The environment slug
 * @param allEnvironmentSlugs - All environment slugs in the project (for missing secrets calculation)
 */
export async function subscribeToSecrets(
	projectSlug: string,
	environmentSlug: string,
	allEnvironmentSlugs?: string[],
): Promise<void> {
	const auth = getAuthState();

	if (!auth.isConnected || !auth.pubkey) {
		secretsState.secrets = [];
		secretsState.error = 'Not authenticated';
		return;
	}

	// Check if encryption is supported
	if (!supportsEncryption()) {
		secretsState.secrets = [];
		secretsState.error =
			'Secrets management requires NIP-44 encryption support. Please use nsec login, a NIP-07 extension with NIP-44 support (like Alby), or a NIP-46 bunker.';
		return;
	}

	// Get encryption capabilities based on auth method
	const privateKey = await getPrivateKey();
	const encryptFn = getEncryptFn();
	const decryptFn = getDecryptFn();

	// Build the decryptor
	let decryptor: Decryptor | null = null;
	if (privateKey) {
		decryptor = { type: 'privateKey', key: privateKey };
	} else if (decryptFn) {
		decryptor = { type: 'decryptFn', fn: decryptFn };
	}

	if (!decryptor) {
		secretsState.secrets = [];
		secretsState.error = 'Could not initialize encryption. Please re-authenticate.';
		return;
	}

	// Cache credentials for publishing and decryption
	cachedDecryptor = decryptor;
	cachedPrivateKey = privateKey;
	cachedEncryptFn = encryptFn;

	// Skip if already subscribed to the same project/environment
	if (
		currentProjectSlug === projectSlug &&
		currentEnvironmentSlug === environmentSlug &&
		subscription !== null
	) {
		return;
	}

	// Check if we're just switching environments within the same project
	// and we already have cached data for all environments
	const isSameProject = currentProjectSlug === projectSlug;
	const hasCachedEnvData = isSameProject && allEnvSecretsState.size > 0;

	// If switching environments within the same project and we have cached data,
	// immediately update from cache (no loading state needed)
	if (hasCachedEnvData && allEnvSecretsState.has(environmentSlug)) {
		const cachedSecrets = allEnvSecretsState.get(environmentSlug) ?? [];
		secretsState.secrets = cachedSecrets;
		secretsState.isLoading = false;
		secretsState.error = null;
		missingSecretsState.missing = calculateMissingSecrets(allEnvSecretsState, environmentSlug);

		// Update current environment context
		currentEnvironmentSlug = environmentSlug;

		// Still need to update the single-env subscription for reactivity to new events
		if (subscription) {
			subscription.unsubscribe();
		}
		subscription = GiftWrapSecretsModel(
			eventStore,
			decryptor,
			projectSlug,
			environmentSlug,
		).subscribe({
			next: (secrets) => {
				secretsState.secrets = secrets;
				secretsState.isLoading = false;
				secretsState.error = null;

				// Recalculate missing secrets when current env secrets change
				if (allEnvSecretsState.size > 0) {
					missingSecretsState.missing = calculateMissingSecrets(allEnvSecretsState, environmentSlug);
				}
			},
			error: (err) => {
				secretsState.error = err instanceof Error ? err.message : 'Failed to load secrets';
				secretsState.isLoading = false;
			},
		});

		return;
	}

	// Clean up existing subscriptions
	if (subscription) {
		subscription.unsubscribe();
		subscription = null;
	}
	if (allEnvSubscription) {
		allEnvSubscription.unsubscribe();
		allEnvSubscription = null;
	}

	// Update context
	currentProjectSlug = projectSlug;
	currentEnvironmentSlug = environmentSlug;
	currentEnvironmentSlugs = allEnvironmentSlugs ?? [environmentSlug];

	// Only show loading if we don't have cached data
	secretsState.isLoading = !hasCachedEnvData;
	secretsState.error = null;

	// If we have cached data for this env (but switching projects), use it immediately
	if (hasCachedEnvData && allEnvSecretsState.has(environmentSlug)) {
		secretsState.secrets = allEnvSecretsState.get(environmentSlug) ?? [];
	}

	// Subscribe to GiftWrapSecretsModel (decrypts Gift Wrap events)
	subscription = GiftWrapSecretsModel(
		eventStore,
		decryptor,
		projectSlug,
		environmentSlug,
	).subscribe({
		next: (secrets) => {
			secretsState.secrets = secrets;
			secretsState.isLoading = false;
			secretsState.error = null;

			// Recalculate missing secrets when current env secrets change
			if (allEnvSecretsState.size > 0) {
				missingSecretsState.missing = calculateMissingSecrets(allEnvSecretsState, environmentSlug);
			}
		},
		error: (err) => {
			secretsState.error = err instanceof Error ? err.message : 'Failed to load secrets';
			secretsState.isLoading = false;
		},
	});

	// Subscribe to all environments for missing secrets calculation
	if (currentEnvironmentSlugs.length > 1) {
		missingSecretsState.isLoading = !hasCachedEnvData;
		allEnvSubscription = AllGiftWrapSecretsModel(
			eventStore,
			decryptor,
			projectSlug,
			currentEnvironmentSlugs,
		).subscribe({
			next: (envMap) => {
				allEnvSecretsState = envMap;
				missingSecretsState.missing = calculateMissingSecrets(envMap, environmentSlug);
				missingSecretsState.isLoading = false;
			},
			error: (err) => {
				console.error('Failed to load all environments secrets:', err);
				missingSecretsState.isLoading = false;
			},
		});
	} else {
		missingSecretsState.missing = [];
		missingSecretsState.isLoading = false;
	}
}

/**
 * Unsubscribe from secrets
 */
export function unsubscribeFromSecrets(): void {
	if (subscription) {
		subscription.unsubscribe();
		subscription = null;
	}
	if (allEnvSubscription) {
		allEnvSubscription.unsubscribe();
		allEnvSubscription = null;
	}
	currentProjectSlug = null;
	currentEnvironmentSlug = null;
	currentEnvironmentSlugs = [];
	cachedDecryptor = null;
	cachedEncryptFn = null;
	cachedPrivateKey = null;
}

/**
 * Add or update a secret in the array
 */
function upsertSecret(secrets: Secret[], key: string, value: string): Secret[] {
	const existing = secrets.findIndex((s) => s.key === key);
	if (existing >= 0) {
		return secrets.map((s, i) => (i === existing ? { key, value } : s));
	}
	return [...secrets, { key, value }];
}

/**
 * Remove a secret from the array
 */
function removeSecretFromArray(secrets: Secret[], key: string): Secret[] {
	return secrets.filter((s) => s.key !== key);
}

/**
 * Wrap secrets using the appropriate method based on cached credentials
 */
async function wrapSecretsForPublish(
	bundle: Record<string, string>,
	dTag: string,
): Promise<NostrEvent> {
	const auth = getAuthState();

	if (cachedPrivateKey) {
		// Use direct private key wrapping (nsec)
		const { event } = wrapSecrets(bundle, cachedPrivateKey, dTag);
		return event;
	}

	if (cachedEncryptFn && auth.pubkey) {
		// Use signer-based wrapping (NIP-07/bunker)
		const { event } = await wrapSecretsWithSigner(bundle, auth.pubkey, dTag, cachedEncryptFn);
		return event;
	}

	throw new Error('No encryption method available. Please re-authenticate.');
}

/**
 * Set a secret (add or update) using NIP-59 Gift Wrap
 */
export async function setSecret(key: string, value: string): Promise<void> {
	if (!currentProjectSlug || !currentEnvironmentSlug) {
		throw new Error('No project/environment selected');
	}

	if (!cachedPrivateKey && !cachedEncryptFn) {
		throw new Error('Encryption not available. Please re-authenticate.');
	}

	const trimmedKey = key.trim().toUpperCase();
	if (!trimmedKey) {
		throw new Error('Secret key is required');
	}

	secretsState.isSaving = true;
	secretsState.saveError = null;

	try {
		// Update secrets array
		const updatedSecrets = upsertSecret(secretsState.secrets, trimmedKey, value);

		// Convert to bundle format and wrap with NIP-59
		const bundle = secretsToBundle(updatedSecrets);
		const dTag = createDTag(currentProjectSlug, currentEnvironmentSlug);
		const event = await wrapSecretsForPublish(bundle, dTag);

		// Publish the Gift Wrap event
		await publishEvent(event);

		// Optimistically update local state
		secretsState.secrets = updatedSecrets;
	} catch (err) {
		secretsState.saveError = err instanceof Error ? err.message : 'Failed to save secret';
		throw err;
	} finally {
		secretsState.isSaving = false;
	}
}

/**
 * Set a secret to multiple environments using NIP-59 Gift Wrap
 */
export async function setSecretToMultipleEnvs(
	projectSlug: string,
	key: string,
	value: string,
	environmentSlugs: string[],
): Promise<void> {
	if (!cachedPrivateKey && !cachedEncryptFn) {
		throw new Error('Encryption not available. Please re-authenticate.');
	}

	const trimmedKey = key.trim().toUpperCase();
	if (!trimmedKey) {
		throw new Error('Secret key is required');
	}

	secretsState.isSaving = true;
	secretsState.saveError = null;

	try {
		// Process each environment
		for (const envSlug of environmentSlugs) {
			// Get current secrets for this environment
			const currentSecrets = allEnvSecretsState.get(envSlug) ?? [];

			// Update secrets array
			const updatedSecrets = upsertSecret(currentSecrets, trimmedKey, value);

			// Convert to bundle format and wrap with NIP-59
			const bundle = secretsToBundle(updatedSecrets);
			const dTag = createDTag(projectSlug, envSlug);
			const event = await wrapSecretsForPublish(bundle, dTag);

			// Publish the Gift Wrap event
			await publishEvent(event);
		}
	} catch (err) {
		secretsState.saveError = err instanceof Error ? err.message : 'Failed to save secret';
		throw err;
	} finally {
		secretsState.isSaving = false;
	}
}

/**
 * Delete a secret using NIP-59 Gift Wrap
 */
export async function deleteSecret(key: string): Promise<void> {
	if (!currentProjectSlug || !currentEnvironmentSlug) {
		throw new Error('No project/environment selected');
	}

	if (!cachedPrivateKey && !cachedEncryptFn) {
		throw new Error('Encryption not available. Please re-authenticate.');
	}

	secretsState.isSaving = true;
	secretsState.saveError = null;

	try {
		// Remove secret from array
		const updatedSecrets = removeSecretFromArray(secretsState.secrets, key);

		// Convert to bundle format and wrap with NIP-59
		const bundle = secretsToBundle(updatedSecrets);
		const dTag = createDTag(currentProjectSlug, currentEnvironmentSlug);
		const event = await wrapSecretsForPublish(bundle, dTag);

		// Publish the Gift Wrap event
		await publishEvent(event);

		// Optimistically update local state
		secretsState.secrets = updatedSecrets;
	} catch (err) {
		secretsState.saveError = err instanceof Error ? err.message : 'Failed to delete secret';
		throw err;
	} finally {
		secretsState.isSaving = false;
	}
}

/**
 * Clear save error (for dismissing error messages)
 */
export function clearSaveError(): void {
	secretsState.saveError = null;
}

/**
 * Reset the store
 */
export function resetSecretsStore(): void {
	unsubscribeFromSecrets();
	secretsState = {
		secrets: [],
		isLoading: false,
		isSaving: false,
		error: null,
		saveError: null,
	};
	missingSecretsState = {
		missing: [],
		isLoading: false,
	};
	allEnvSecretsState = new Map();
}
