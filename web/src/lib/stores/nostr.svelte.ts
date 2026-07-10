import { REDSHIFT_KIND } from '$lib/constants';
import { getRedshiftSecretsFilter } from '$lib/crypto';
import { clearDecryptionCache } from '$lib/models/gift-wrap-secrets';
import {
	type QuorumReport,
	RateLimiter,
	executeWithQuorum,
	withPublishBackoff,
} from '$lib/rate-limiter';
import { DEFAULT_RELAYS as CRYPTO_DEFAULT_RELAYS } from '@redshift/crypto';
import { EventStore } from 'applesauce-core';
import { RelayPool, onlyEvents } from 'applesauce-relay';
import type { EventTemplate, NostrEvent } from 'nostr-tools';
import type { Subscription } from 'rxjs';

// Re-export constants for backward compatibility with existing imports
export { REDSHIFT_KIND, getProjectDTag } from '$lib/constants';

/**
 * Rate limiter instance for relay operations
 * - Max 10 requests per second
 * - Minimum 100ms between requests
 */
const rateLimiter = new RateLimiter(10, 1000, 100);

/**
 * Shared Nostr infrastructure for the entire app
 * Following the Applesauce paradigm: EventStore as single source of truth
 */

// Default relays for Redshift (from shared @redshift/crypto package)
export const DEFAULT_RELAYS: string[] = [...CRYPTO_DEFAULT_RELAYS];

// Managed relay for Cloud tier subscribers
export const MANAGED_RELAY = 'wss://relay.redshiftapp.com';
export const MANAGED_RELAY_API = 'https://relay.redshiftapp.com';

interface RuntimeRelayConfig {
	relays?: unknown;
}

declare global {
	interface Window {
		__REDSHIFT_RUNTIME_CONFIG__?: RuntimeRelayConfig;
	}
}

export function getRuntimeRelays(
	config: RuntimeRelayConfig | undefined = typeof window !== 'undefined'
		? window.__REDSHIFT_RUNTIME_CONFIG__
		: undefined,
) {
	if (!Array.isArray(config?.relays)) return [...DEFAULT_RELAYS];
	const relays: string[] = [];
	for (const value of config.relays) {
		if (typeof value !== 'string') return [...DEFAULT_RELAYS];
		try {
			const url = new URL(value);
			const localPlaintext =
				url.protocol === 'ws:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
			if (url.protocol !== 'wss:' && !localPlaintext) return [...DEFAULT_RELAYS];
			relays.push(url.href);
		} catch {
			return [...DEFAULT_RELAYS];
		}
	}
	return relays.length > 0 ? [...new Set(relays)] : [...DEFAULT_RELAYS];
}

// Cache for payment status to avoid repeated API calls
let paymentStatusCache: { pubkey: string; paid: boolean; checkedAt: number } | null = null;
const PAYMENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Track if we've synced secrets to managed relay this session
let hasSyncedToManagedRelay = false;

/**
 * Check if a pubkey has paid for managed relay access
 */
export async function checkManagedRelayAccess(pubkey: string): Promise<boolean> {
	// Check cache first
	if (
		paymentStatusCache &&
		paymentStatusCache.pubkey === pubkey &&
		Date.now() - paymentStatusCache.checkedAt < PAYMENT_CACHE_TTL
	) {
		return paymentStatusCache.paid;
	}

	try {
		const response = await fetch(
			`${MANAGED_RELAY_API}/api/check-payment?pubkey=${encodeURIComponent(pubkey)}`,
		);
		if (!response.ok) return false;

		const data = await response.json();
		const paid = data.paid === true;

		// Cache the result
		paymentStatusCache = { pubkey, paid, checkedAt: Date.now() };

		return paid;
	} catch (error) {
		console.error('Error checking managed relay access:', error);
		return false;
	}
}

/**
 * Get relays for a user, including managed relay if they have access
 */
export async function getRelaysForUser(pubkey: string): Promise<string[]> {
	const hasAccess = await checkManagedRelayAccess(pubkey);
	const baseRelays = getRuntimeRelays();

	if (hasAccess) {
		return [MANAGED_RELAY, ...baseRelays.filter((relay) => relay !== MANAGED_RELAY)];
	}

	return baseRelays;
}

/**
 * Sync all existing secrets to the managed relay
 * Called when user has paid for managed relay access
 */
export async function syncSecretsToManagedRelay(): Promise<{ synced: number; errors: number }> {
	if (hasSyncedToManagedRelay) {
		console.debug('Already synced to managed relay this session');
		return { synced: 0, errors: 0 };
	}

	let synced = 0;
	let errors = 0;

	// Get all gift-wrapped secrets (kind 1059) and Redshift app data (kind 30078)
	const secretEvents = eventStore.database.getByFilters([{ kinds: [1059, REDSHIFT_KIND] }]);

	console.debug(`Syncing ${secretEvents.length} events to managed relay...`);

	// Publish each event to the managed relay
	for (const event of secretEvents) {
		try {
			await rateLimiter.waitForSlot();
			await relayPool.publish([MANAGED_RELAY], event);
			synced++;
		} catch (error) {
			console.error(`Failed to sync event ${event.id} to managed relay:`, error);
			errors++;
		}
	}

	hasSyncedToManagedRelay = true;
	console.debug(`Synced ${synced} events to managed relay (${errors} errors)`);

	return { synced, errors };
}

/**
 * Reset the sync flag (e.g., when user disconnects)
 */
export function resetManagedRelaySync(): void {
	hasSyncedToManagedRelay = false;
}

/**
 * Clear the payment status cache (for testing)
 */
export function clearPaymentCache(): void {
	paymentStatusCache = null;
}

// Single EventStore instance for the entire app
// Using `let` so it can be replaced with a fresh instance on disconnect/logout
export let eventStore = new EventStore();

// Single RelayPool instance for the entire app
export const relayPool = new RelayPool();

// Track active subscriptions
let activeSubscription: { unsubscribe: () => void } | null = null;
let managedRelayAuthSubscription: Subscription | null = null;

interface ManagedAuthRelay {
	readonly authenticated: boolean;
	challenge$: {
		subscribe(observer: (challenge: string | null) => void): Subscription;
	};
	authenticate(signer: {
		signEvent(event: EventTemplate): NostrEvent | Promise<NostrEvent>;
	}): Promise<{ ok: boolean; message?: string }>;
}

export function watchManagedRelayAuthentication(
	relay: ManagedAuthRelay,
	signAuthEvent: (event: EventTemplate) => Promise<NostrEvent>,
	onError: (error: Error) => void,
): Subscription {
	let inFlight = false;
	return relay.challenge$.subscribe((challenge) => {
		if (!challenge || relay.authenticated || inFlight) return;
		inFlight = true;
		void relay
			.authenticate({ signEvent: signAuthEvent })
			.then((response) => {
				if (!response.ok) throw new Error(response.message || 'Relay authentication rejected');
			})
			.catch((error: unknown) => {
				onError(error instanceof Error ? error : new Error(String(error)));
			})
			.finally(() => {
				inFlight = false;
			});
	});
}

// Track the latest event timestamp seen for incremental sync on reconnection
let lastSeenTimestamp: number | null = null;

// Relay connection status
export type RelayStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface RelayState {
	status: RelayStatus;
	connectedCount: number;
	totalCount: number;
	relays: string[];
	hasManagedAccess: boolean;
}

let relayState = $state<RelayState>({
	status: 'disconnected',
	connectedCount: 0,
	totalCount: 0,
	relays: [],
	hasManagedAccess: false,
});

/**
 * Get current relay connection state (reactive)
 */
export function getRelayState(): RelayState {
	return relayState;
}

/**
 * Connect to relays and start syncing events for a user
 */
export function connectAndSync(pubkey: string, relays: string[] = DEFAULT_RELAYS): void {
	// Clean up any existing subscription
	if (activeSubscription) {
		activeSubscription.unsubscribe();
	}

	managedRelayAuthSubscription?.unsubscribe();
	managedRelayAuthSubscription = null;

	// Update relay state
	const hasManagedAccess = relays.includes(MANAGED_RELAY);
	relayState = {
		status: 'connecting',
		connectedCount: 0,
		totalCount: relays.length,
		relays,
		hasManagedAccess,
	};

	// Subscribe to:
	// 1. NIP-59 Gift Wrap events (kind 1059) with redshift-secrets type tag for encrypted secrets
	// 2. Redshift events (Kind 30078) for project metadata
	// 3. Profile events (Kind 0) for displaying user info
	if (hasManagedAccess) {
		managedRelayAuthSubscription = watchManagedRelayAuthentication(
			relayPool.relay(MANAGED_RELAY),
			async (template) => {
				const { signEvent } = await import('./auth.svelte');
				return signEvent(template);
			},
			(error) => {
				console.error('Managed relay authentication failed:', error);
				relayState = { ...relayState, status: 'error' };
			},
		);
	}

	const secretsFilter = getRedshiftSecretsFilter(pubkey);

	// Build filters, adding `since` for incremental sync on reconnection
	// Subtract 60 seconds as safety margin against clock skew between relays
	const sinceTimestamp = lastSeenTimestamp ? lastSeenTimestamp - 60 : undefined;
	const secretsFilterWithSince = sinceTimestamp
		? { ...secretsFilter, since: sinceTimestamp }
		: secretsFilter;
	const redshiftFilter = sinceTimestamp
		? { kinds: [REDSHIFT_KIND], authors: [pubkey], since: sinceTimestamp }
		: { kinds: [REDSHIFT_KIND], authors: [pubkey] };
	const profileFilter = sinceTimestamp
		? { kinds: [0], authors: [pubkey], since: sinceTimestamp }
		: { kinds: [0], authors: [pubkey] };

	activeSubscription = relayPool
		.subscription(relays, [secretsFilterWithSince, redshiftFilter, profileFilter])
		.pipe(onlyEvents())
		.subscribe({
			next: (event: NostrEvent) => {
				eventStore.add(event);

				// Track the latest event timestamp for incremental sync
				if (lastSeenTimestamp === null || event.created_at > lastSeenTimestamp) {
					lastSeenTimestamp = event.created_at;
				}

				// Mark as connected once we receive any event
				if (relayState.status !== 'connected') {
					relayState = {
						...relayState,
						status: 'connected',
						connectedCount: 1, // At least one relay delivered an event
					};
				}
			},
			error: (err) => {
				console.error('Relay subscription error:', err);
				relayState = {
					...relayState,
					status: 'error',
				};
			},
		});

	// Fallback timeout: if no events are received within 10 seconds,
	// mark as connected with no data rather than error.
	// New users with zero events will hit this, and it's not an error.
	// Normal connections will be marked 'connected' when the first event arrives
	// (see the next() handler above).
	setTimeout(() => {
		if (relayState.status === 'connecting') {
			relayState = {
				...relayState,
				// Mark as connected but with no data, not as error
				// New users with zero events will hit this, and it's not an error
				status: 'connected',
				connectedCount: 0,
			};
		}
	}, 10000);
}

/**
 * Disconnect from relays and clean up
 */
export function disconnect(): void {
	if (activeSubscription) {
		activeSubscription.unsubscribe();
		activeSubscription = null;
	}
	managedRelayAuthSubscription?.unsubscribe();
	managedRelayAuthSubscription = null;
	relayState = {
		status: 'disconnected',
		connectedCount: 0,
		totalCount: 0,
		relays: [],
		hasManagedAccess: false,
	};
	// Replace EventStore with a fresh instance to clear all cached events
	// This prevents encrypted events from a previous user leaking to the next session
	eventStore = new EventStore();
	// Clear the decryption cache so decrypted secrets from the previous user are purged
	clearDecryptionCache();
	// Reset incremental sync timestamp so next session fetches all events
	lastSeenTimestamp = null;
	// Reset sync flag so next session will sync again
	resetManagedRelaySync();
}

export async function withPublishTimeout<T>(
	operation: Promise<T>,
	relay: string,
	timeoutMs = 5000,
) {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		const timeoutPromise = new Promise<never>((_, reject) => {
			timeout = setTimeout(() => reject(new Error(`Publish timeout for ${relay}`)), timeoutMs);
		});
		return await Promise.race([operation, timeoutPromise]);
	} finally {
		if (timeout) clearTimeout(timeout);
	}
}

/**
 * Publish an event to relays with rate limiting and exponential backoff
 */
export async function publishEvent(
	event: NostrEvent,
	relays?: string[],
): Promise<QuorumReport<string>> {
	const targets = relays ?? (relayState.relays.length > 0 ? relayState.relays : DEFAULT_RELAYS);
	const report = await executeWithQuorum(targets, event.id, async (relay) => {
		await withPublishBackoff(async () => {
			await rateLimiter.waitForSlot();
			const publishPromise = relayPool.publish([relay], event).then(() => undefined);
			await withPublishTimeout(publishPromise, relay);
		});
	});

	// Only expose the event as durable local state after publication quorum succeeds.
	eventStore.add(event);
	return report;
}
