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

import {
	type NostrEvent,
	compareSecretVersions,
	createDTag,
	getRedshiftSecretsFilter,
	unwrapGiftWrap,
	unwrapGiftWrapWithSigner,
	wrapSecrets,
	wrapSecretsWithSigner,
} from '$lib/crypto';
import {
	AllGiftWrapSecretsModel,
	type Decryptor,
	GiftWrapSecretsModel,
	clearDecryptionCache,
	createSharedDecryptionPipeline,
} from '$lib/models/gift-wrap-secrets';
import {
	type MissingSecret,
	calculateMissingSecrets,
	removeSecret as modelRemoveSecret,
	upsertSecret as modelUpsertSecret,
} from '$lib/models/secrets';
import type { Secret, SecretsState } from '$lib/types/nostr';
import type { Subscription } from 'rxjs';
import {
	getAuthState,
	getDecryptFn,
	getEncryptFn,
	getPrivateKey,
	signEvent,
	supportsEncryption,
} from './auth.svelte';
// signEvent is used in wrapSecretsForPublish to sign the NIP-59 seal
import { eventStore, publishEvent } from './nostr.svelte';

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
 * Cached encrypt function for publishing (NIP-07/bunker)
 */
let cachedEncryptFn: ((pubkey: string, plaintext: string) => Promise<string>) | null = null;

/**
 * Cached private key for publishing (nsec only)
 */
let cachedPrivateKey: Uint8Array | null = null;

/**
 * The pubkey and auth method that were active when credentials were cached.
 * Used to detect auth changes and invalidate stale cached credentials.
 */
let cachedAuthPubkey: string | null = null;
let cachedAuthMethod: string | null = null;

/**
 * Check if cached credentials are stale (auth changed since caching).
 * If stale, clears all cached credentials so they'll be re-initialized.
 */
function invalidateStaleCachedCredentials(): void {
	const auth = getAuthState();
	if (
		cachedAuthPubkey !== null &&
		(auth.pubkey !== cachedAuthPubkey || auth.method !== cachedAuthMethod)
	) {
		// Zero key material before releasing references
		if (cachedPrivateKey) {
			cachedPrivateKey.fill(0);
		}
		cachedEncryptFn = null;
		cachedPrivateKey = null;
		cachedAuthPubkey = null;
		cachedAuthMethod = null;
	}
}

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
 * Build a decryptor from the current auth method's encryption capabilities.
 * Returns null if no decryption method is available.
 */
async function buildDecryptor(): Promise<Decryptor | null> {
	const privateKey = await getPrivateKey();
	const decryptFn = getDecryptFn();

	if (privateKey) {
		return { type: 'privateKey', key: privateKey };
	}
	if (decryptFn) {
		const expectedAuthor = getAuthState().pubkey;
		if (!expectedAuthor) return null;
		return { type: 'decryptFn', expectedAuthor, fn: decryptFn };
	}
	return null;
}

/**
 * Switch to a different environment within the same project using cached data.
 * Updates state from cache immediately, then resubscribes for live updates.
 */
function switchEnvironmentFromCache(
	projectSlug: string,
	environmentSlug: string,
	decryptor: Decryptor,
): void {
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
}

/**
 * Set up fresh subscriptions for a project/environment.
 * Cleans up existing subscriptions, creates a shared decryption pipeline,
 * and subscribes to both single-env and all-env models.
 */
function setupFreshSubscriptions(
	projectSlug: string,
	environmentSlug: string,
	allEnvironmentSlugs: string[],
	decryptor: Decryptor,
	hasCachedEnvData: boolean,
): void {
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
	currentEnvironmentSlugs = allEnvironmentSlugs;

	// Only show loading if we don't have cached data
	secretsState.isLoading = !hasCachedEnvData;
	secretsState.error = null;

	// If we have cached data for this env (but switching projects), use it immediately
	if (hasCachedEnvData && allEnvSecretsState.has(environmentSlug)) {
		secretsState.secrets = allEnvSecretsState.get(environmentSlug) ?? [];
	}

	// Create a shared decryption pipeline so both subscriptions share
	// a single decryption stream (via shareReplay), eliminating 2x decryption
	const sharedPipeline = createSharedDecryptionPipeline(eventStore, decryptor);

	// Subscribe to GiftWrapSecretsModel (decrypts Gift Wrap events)
	subscription = GiftWrapSecretsModel(
		eventStore,
		decryptor,
		projectSlug,
		environmentSlug,
		sharedPipeline,
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
			sharedPipeline,
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
 * Subscribe to secrets for a specific project/environment.
 * Uses NIP-59 Gift Wrap for encrypted storage.
 *
 * Orchestrates auth checks, decryptor building, credential caching,
 * and delegates to either cached environment switching or fresh subscriptions.
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

	// Build the decryptor from auth method
	const decryptor = await buildDecryptor();

	if (!decryptor) {
		secretsState.secrets = [];
		secretsState.error = 'Could not initialize encryption. Please re-authenticate.';
		return;
	}

	// Cache credentials for publishing, along with the auth identity.
	cachedPrivateKey = await getPrivateKey();
	cachedEncryptFn = getEncryptFn();
	cachedAuthPubkey = auth.pubkey;
	cachedAuthMethod = auth.method;

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
		switchEnvironmentFromCache(projectSlug, environmentSlug, decryptor);
		return;
	}

	// Set up fresh subscriptions for a new project or first load
	setupFreshSubscriptions(
		projectSlug,
		environmentSlug,
		allEnvironmentSlugs ?? [environmentSlug],
		decryptor,
		hasCachedEnvData,
	);
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
	// Zero key material before releasing references
	if (cachedPrivateKey) {
		cachedPrivateKey.fill(0);
	}
	cachedEncryptFn = null;
	cachedPrivateKey = null;
	cachedAuthPubkey = null;
	cachedAuthMethod = null;

	// Clear the decryption cache when switching users/sessions
	clearDecryptionCache();
}

/**
 * Wrap secrets using the appropriate method based on cached credentials
 */
async function ensurePublishCredentials(): Promise<void> {
	invalidateStaleCachedCredentials();
	if (cachedPrivateKey || cachedEncryptFn) return;
	cachedPrivateKey = await getPrivateKey();
	cachedEncryptFn = getEncryptFn();
	const auth = getAuthState();
	cachedAuthPubkey = auth.pubkey;
	cachedAuthMethod = auth.method;
}

async function nextRumorTimestamp(dTag: string): Promise<number> {
	await ensurePublishCredentials();
	const auth = getAuthState();
	if (!auth.pubkey) throw new Error('Not authenticated');
	const candidates = eventStore.database.getByFilters([getRedshiftSecretsFilter(auth.pubkey)]);
	let latest: { createdAt: number; eventId: string } | null = null;
	for (const candidate of candidates) {
		try {
			const result = cachedPrivateKey
				? unwrapGiftWrap(candidate, cachedPrivateKey)
				: cachedEncryptFn
					? await unwrapGiftWrapWithSigner(candidate, auth.pubkey, (pubkey, ciphertext) => {
							const decrypt = getDecryptFn();
							if (!decrypt) throw new Error('Decryption unavailable');
							return decrypt(pubkey, ciphertext);
						})
					: null;
			if (result?.dTag === dTag && (!latest || compareSecretVersions(result, latest) > 0)) {
				latest = result;
			}
		} catch {
			// Ignore ciphertext that is invalid or belongs to another identity.
		}
	}
	const now = Math.floor(Date.now() / 1000);
	if (latest && latest.createdAt >= now + 300) {
		throw new Error('Cannot create a newer secret version until the local clock catches up');
	}
	return Math.max(now, (latest?.createdAt ?? -1) + 1);
}

async function wrapSecretsForPublish(
	bundle: Record<string, string>,
	dTag: string,
	createdAt?: number,
): Promise<NostrEvent> {
	await ensurePublishCredentials();
	const rumorCreatedAt = createdAt ?? (await nextRumorTimestamp(dTag));
	const auth = getAuthState();

	if (cachedPrivateKey) {
		// Use direct private key wrapping (nsec)
		const { event } = wrapSecrets(bundle, cachedPrivateKey, dTag, {
			createdAt: rumorCreatedAt,
		});
		return event;
	}

	if (cachedEncryptFn && auth.pubkey) {
		// Use signer-based wrapping (NIP-07/bunker)
		// Pass signEvent as the signFn so the seal is properly signed per NIP-59
		const signerSignFn = async (evt: {
			kind: number;
			created_at: number;
			tags: string[][];
			content: string;
		}) => {
			const signed = await signEvent(evt as NostrEvent);
			return signed as {
				id: string;
				pubkey: string;
				created_at: number;
				kind: number;
				tags: string[][];
				content: string;
				sig: string;
			};
		};
		const { event } = await wrapSecretsWithSigner(
			bundle,
			auth.pubkey,
			dTag,
			cachedEncryptFn,
			signerSignFn,
			{ createdAt: rumorCreatedAt },
		);
		return event;
	}

	throw new Error('No encryption method available. Please re-authenticate.');
}

export async function publishSecretTombstone(
	projectSlug: string,
	environmentSlug: string,
): Promise<NostrEvent> {
	const dTag = createDTag(projectSlug, environmentSlug);
	const event = await wrapSecretsForPublish({}, dTag);
	await publishEvent(event, undefined, publicationContext(projectSlug, environmentSlug));
	return event;
}

/**
 * Set a secret (add or update) using NIP-59 Gift Wrap
 */
export async function setSecret(key: string, value: string): Promise<void> {
	if (!currentProjectSlug || !currentEnvironmentSlug) {
		throw new Error('No project/environment selected');
	}

	// Invalidate cached credentials if the auth identity has changed
	invalidateStaleCachedCredentials();

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
		const updatedSecrets = modelUpsertSecret(secretsState.secrets, trimmedKey, value);

		// Convert to bundle format and wrap with NIP-59
		const bundle = secretsToBundle(updatedSecrets);
		const dTag = createDTag(currentProjectSlug, currentEnvironmentSlug);
		const event = await wrapSecretsForPublish(bundle, dTag);

		// Publish the Gift Wrap event
		await publishEvent(
			event,
			undefined,
			publicationContext(currentProjectSlug, currentEnvironmentSlug),
		);

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
 *
 * Performance: Crypto wrapping is parallelized across all environments,
 * then events are published sequentially to respect relay rate limits.
 */
export async function setSecretToMultipleEnvs(
	projectSlug: string,
	key: string,
	value: string,
	environmentSlugs: string[],
): Promise<void> {
	// Invalidate cached credentials if the auth identity has changed
	invalidateStaleCachedCredentials();

	if (!cachedPrivateKey && !cachedEncryptFn) {
		throw new Error('Encryption not available. Please re-authenticate.');
	}

	const trimmedKey = key.trim().toUpperCase();
	if (!trimmedKey) {
		throw new Error('Secret key is required');
	}

	secretsState.isSaving = true;
	secretsState.saveError = null;

	const errors: { envSlug: string; error: Error }[] = [];

	try {
		// Phase 1: Prepare all wrapped events in parallel (crypto operations)
		const preparedEvents = await Promise.all(
			environmentSlugs.map(async (envSlug) => {
				const currentSecrets = allEnvSecretsState.get(envSlug) ?? [];
				const updatedSecrets = modelUpsertSecret(currentSecrets, trimmedKey, value);
				const bundle = secretsToBundle(updatedSecrets);
				const dTag = createDTag(projectSlug, envSlug);
				const event = await wrapSecretsForPublish(bundle, dTag);
				return { envSlug, event };
			}),
		);

		// Phase 2: Publish sequentially (respecting relay rate limits)
		for (const { envSlug, event } of preparedEvents) {
			try {
				await publishEvent(event, undefined, publicationContext(projectSlug, envSlug));
			} catch (err) {
				errors.push({
					envSlug,
					error: err instanceof Error ? err : new Error(String(err)),
				});
			}
		}

		// Report errors if any environments failed
		if (errors.length > 0) {
			const failedEnvs = errors.map((e) => e.envSlug).join(', ');
			const errorMsg = `Failed to publish to environments: ${failedEnvs}`;
			secretsState.saveError = errorMsg;
			throw new Error(errorMsg);
		}
	} catch (err) {
		if (!secretsState.saveError) {
			secretsState.saveError = err instanceof Error ? err.message : 'Failed to save secret';
		}
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

	// Invalidate cached credentials if the auth identity has changed
	invalidateStaleCachedCredentials();

	if (!cachedPrivateKey && !cachedEncryptFn) {
		throw new Error('Encryption not available. Please re-authenticate.');
	}

	secretsState.isSaving = true;
	secretsState.saveError = null;

	try {
		// Remove secret from array
		const updatedSecrets = modelRemoveSecret(secretsState.secrets, key);

		// Convert to bundle format and wrap with NIP-59
		const bundle = secretsToBundle(updatedSecrets);
		const dTag = createDTag(currentProjectSlug, currentEnvironmentSlug);
		const event = await wrapSecretsForPublish(bundle, dTag);

		// Publish the Gift Wrap event
		await publishEvent(
			event,
			undefined,
			publicationContext(currentProjectSlug, currentEnvironmentSlug),
		);

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

function publicationContext(project: string, environment: string) {
	const ownerPubkey = getAuthState().pubkey;
	if (!ownerPubkey) throw new Error('Authentication required for publication recovery');
	return { ownerPubkey, project, environment };
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
