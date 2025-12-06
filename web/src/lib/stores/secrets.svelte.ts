import type { SecretsState, Secret } from '$lib/types/nostr';
import type { Subscription } from 'rxjs';
import { eventStore, publishEvent, REDSHIFT_KIND, getSecretsDTag } from './nostr.svelte';
import {
	SecretsModel,
	AllEnvironmentsSecretsModel,
	calculateMissingSecrets,
	createSecretsContent,
	upsertSecret,
	removeSecret,
	type MissingSecret,
} from '$lib/models/secrets';
import { getAuthState, signEvent } from './auth.svelte';

/**
 * Secrets store using Svelte 5 Runes + Applesauce EventStore
 *
 * Manages secrets for the currently selected project/environment
 */

// Secrets state using $state rune
let secretsState = $state<SecretsState>({
	secrets: [],
	isLoading: false,
	isSaving: false,
	error: null,
});

// Missing secrets state (secrets that exist in other environments but not current)
let missingSecretsState = $state<{
	missing: MissingSecret[];
	isLoading: boolean;
}>({
	missing: [],
	isLoading: false,
});

// All environments secrets (for cross-env comparison)
let allEnvSecretsState = $state<Map<string, Secret[]>>(new Map());

// Current context
let currentProjectId: string | null = null;
let currentEnvironmentSlug: string | null = null;
let currentEnvironmentSlugs: string[] = [];

// Track active subscriptions
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
export function getSecretsContext(): { projectId: string | null; environmentSlug: string | null } {
	return { projectId: currentProjectId, environmentSlug: currentEnvironmentSlug };
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
 * Subscribe to secrets for a specific project/environment
 * @param allEnvironmentSlugs - All environment slugs in the project (for missing secrets calculation)
 */
export function subscribeToSecrets(
	projectId: string,
	environmentSlug: string,
	allEnvironmentSlugs?: string[],
): void {
	const auth = getAuthState();

	// Clean up existing subscriptions
	if (subscription) {
		subscription.unsubscribe();
		subscription = null;
	}
	if (allEnvSubscription) {
		allEnvSubscription.unsubscribe();
		allEnvSubscription = null;
	}

	if (!auth.isConnected || !auth.pubkey) {
		secretsState.secrets = [];
		secretsState.error = 'Not authenticated';
		return;
	}

	// Update context
	currentProjectId = projectId;
	currentEnvironmentSlug = environmentSlug;
	currentEnvironmentSlugs = allEnvironmentSlugs ?? [environmentSlug];

	secretsState.isLoading = true;
	secretsState.error = null;

	// Subscribe to SecretsModel from EventStore
	subscription = SecretsModel(eventStore, auth.pubkey, projectId, environmentSlug).subscribe({
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
		missingSecretsState.isLoading = true;
		allEnvSubscription = AllEnvironmentsSecretsModel(
			eventStore,
			auth.pubkey,
			projectId,
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
	currentProjectId = null;
	currentEnvironmentSlug = null;
	currentEnvironmentSlugs = [];
}

/**
 * Set a secret (add or update)
 */
export async function setSecret(key: string, value: string): Promise<void> {
	if (!currentProjectId || !currentEnvironmentSlug) {
		throw new Error('No project/environment selected');
	}

	const auth = getAuthState();
	if (!auth.isConnected || !auth.pubkey) {
		throw new Error('Must be connected to set secrets');
	}

	const trimmedKey = key.trim().toUpperCase();
	if (!trimmedKey) {
		throw new Error('Secret key is required');
	}

	secretsState.isSaving = true;
	secretsState.error = null;

	try {
		// Update secrets array
		const updatedSecrets = upsertSecret(secretsState.secrets, trimmedKey, value);
		const content = createSecretsContent(updatedSecrets);

		// Create the unsigned event
		const unsignedEvent = {
			kind: REDSHIFT_KIND,
			created_at: Math.floor(Date.now() / 1000),
			tags: [['d', getSecretsDTag(currentProjectId, currentEnvironmentSlug)]],
			content: JSON.stringify(content),
		};

		// Sign the event using the current auth method
		const signedEvent = await signEvent(unsignedEvent);

		// Publish to relays
		await publishEvent(signedEvent);
	} catch (err) {
		secretsState.error = err instanceof Error ? err.message : 'Failed to save secret';
		throw err;
	} finally {
		secretsState.isSaving = false;
	}
}

/**
 * Set a secret to multiple environments
 * Used for the multi-environment save feature
 */
export async function setSecretToMultipleEnvs(
	projectId: string,
	key: string,
	value: string,
	environmentSlugs: string[],
): Promise<void> {
	const auth = getAuthState();
	if (!auth.isConnected || !auth.pubkey) {
		throw new Error('Must be connected to set secrets');
	}

	const trimmedKey = key.trim().toUpperCase();
	if (!trimmedKey) {
		throw new Error('Secret key is required');
	}

	secretsState.isSaving = true;
	secretsState.error = null;

	try {
		// Process each environment
		for (const envSlug of environmentSlugs) {
			// Get current secrets for this environment
			const currentSecrets = allEnvSecretsState.get(envSlug) ?? [];

			// Update secrets array
			const updatedSecrets = upsertSecret(currentSecrets, trimmedKey, value);
			const content = createSecretsContent(updatedSecrets);

			// Create the unsigned event
			const unsignedEvent = {
				kind: REDSHIFT_KIND,
				created_at: Math.floor(Date.now() / 1000),
				tags: [['d', getSecretsDTag(projectId, envSlug)]],
				content: JSON.stringify(content),
			};

			// Sign the event using the current auth method
			const signedEvent = await signEvent(unsignedEvent);

			// Publish to relays
			await publishEvent(signedEvent);
		}
	} catch (err) {
		secretsState.error = err instanceof Error ? err.message : 'Failed to save secret';
		throw err;
	} finally {
		secretsState.isSaving = false;
	}
}

/**
 * Delete a secret
 */
export async function deleteSecret(key: string): Promise<void> {
	if (!currentProjectId || !currentEnvironmentSlug) {
		throw new Error('No project/environment selected');
	}

	const auth = getAuthState();
	if (!auth.isConnected || !auth.pubkey) {
		throw new Error('Must be connected to delete secrets');
	}

	secretsState.isSaving = true;
	secretsState.error = null;

	try {
		// Remove secret from array
		const updatedSecrets = removeSecret(secretsState.secrets, key);
		const content = createSecretsContent(updatedSecrets);

		// Create the unsigned event
		const unsignedEvent = {
			kind: REDSHIFT_KIND,
			created_at: Math.floor(Date.now() / 1000),
			tags: [['d', getSecretsDTag(currentProjectId, currentEnvironmentSlug)]],
			content: JSON.stringify(content),
		};

		// Sign the event using the current auth method
		const signedEvent = await signEvent(unsignedEvent);

		// Publish to relays
		await publishEvent(signedEvent);
	} catch (err) {
		secretsState.error = err instanceof Error ? err.message : 'Failed to delete secret';
		throw err;
	} finally {
		secretsState.isSaving = false;
	}
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
	};
	missingSecretsState = {
		missing: [],
		isLoading: false,
	};
	allEnvSecretsState = new Map();
}
