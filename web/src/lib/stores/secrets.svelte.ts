import type { SecretsState } from '$lib/types/nostr';
import type { Subscription } from 'rxjs';
import { eventStore, publishEvent, REDSHIFT_KIND, getSecretsDTag } from './nostr.svelte';
import {
	SecretsModel,
	createSecretsContent,
	upsertSecret,
	removeSecret,
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

// Current context
let currentProjectId: string | null = null;
let currentEnvironmentSlug: string | null = null;

// Track active subscription
let subscription: Subscription | null = null;

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
 * Subscribe to secrets for a specific project/environment
 */
export function subscribeToSecrets(projectId: string, environmentSlug: string): void {
	const auth = getAuthState();

	// Clean up existing subscription
	if (subscription) {
		subscription.unsubscribe();
		subscription = null;
	}

	if (!auth.isConnected || !auth.pubkey) {
		secretsState.secrets = [];
		secretsState.error = 'Not authenticated';
		return;
	}

	// Update context
	currentProjectId = projectId;
	currentEnvironmentSlug = environmentSlug;

	secretsState.isLoading = true;
	secretsState.error = null;

	// Subscribe to SecretsModel from EventStore
	subscription = SecretsModel(eventStore, auth.pubkey, projectId, environmentSlug).subscribe({
		next: (secrets) => {
			secretsState.secrets = secrets;
			secretsState.isLoading = false;
			secretsState.error = null;
		},
		error: (err) => {
			secretsState.error = err instanceof Error ? err.message : 'Failed to load secrets';
			secretsState.isLoading = false;
		},
	});
}

/**
 * Unsubscribe from secrets
 */
export function unsubscribeFromSecrets(): void {
	if (subscription) {
		subscription.unsubscribe();
		subscription = null;
	}
	currentProjectId = null;
	currentEnvironmentSlug = null;
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
}
