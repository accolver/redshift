import { EventStore } from 'applesauce-core';
import { RelayPool, onlyEvents } from 'applesauce-relay';
import type { NostrEvent } from 'nostr-tools';
import { REDSHIFT_KIND } from '$lib/constants';
import { getRedshiftSecretsFilter, NostrKinds } from '$lib/crypto';
import { RateLimiter, withPublishBackoff } from '$lib/rate-limiter';

// Re-export constants for backward compatibility with existing imports
export { REDSHIFT_KIND, getSecretsDTag, getProjectDTag, parseDTag } from '$lib/constants';

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

// Default relays for Redshift
export const DEFAULT_RELAYS = [
	'wss://relay.damus.io',
	'wss://relay.primal.net',
	'wss://nos.lol',
	'wss://relay.nostr.band',
];

// Single EventStore instance for the entire app
export const eventStore = new EventStore();

// Single RelayPool instance for the entire app
export const relayPool = new RelayPool();

// Track active subscriptions
let activeSubscription: { unsubscribe: () => void } | null = null;

// Relay connection status
export type RelayStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface RelayState {
	status: RelayStatus;
	connectedCount: number;
	totalCount: number;
}

let relayState = $state<RelayState>({
	status: 'disconnected',
	connectedCount: 0,
	totalCount: 0,
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

	// Update relay state
	relayState = {
		status: 'connecting',
		connectedCount: 0,
		totalCount: relays.length,
	};

	// Subscribe to:
	// 1. NIP-59 Gift Wrap events (kind 1059) with redshift-secrets type tag for encrypted secrets
	// 2. Redshift events (Kind 30078) for project metadata
	// 3. Profile events (Kind 0) for displaying user info
	const secretsFilter = getRedshiftSecretsFilter(pubkey);
	activeSubscription = relayPool
		.subscription(relays, [
			secretsFilter,
			{ kinds: [REDSHIFT_KIND], authors: [pubkey] },
			{ kinds: [0], authors: [pubkey] },
		])
		.pipe(onlyEvents())
		.subscribe({
			next: (event: NostrEvent) => {
				eventStore.add(event);
				// Mark as connected once we receive any event
				if (relayState.status !== 'connected') {
					relayState = {
						...relayState,
						status: 'connected',
						connectedCount: relays.length, // Simplified - assume all connected if we get events
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

	// Set connected after a short delay (relays are async)
	setTimeout(() => {
		if (relayState.status === 'connecting') {
			relayState = {
				...relayState,
				status: 'connected',
				connectedCount: relays.length,
			};
		}
	}, 2000);
}

/**
 * Disconnect from relays and clean up
 */
export function disconnect(): void {
	if (activeSubscription) {
		activeSubscription.unsubscribe();
		activeSubscription = null;
	}
	relayState = {
		status: 'disconnected',
		connectedCount: 0,
		totalCount: 0,
	};
}

/**
 * Publish an event to relays with rate limiting and exponential backoff
 */
export async function publishEvent(
	event: NostrEvent,
	relays: string[] = DEFAULT_RELAYS,
): Promise<void> {
	// Add to local store immediately for optimistic updates
	eventStore.add(event);

	// Publish to relays with rate limiting and retry
	await rateLimiter.waitForSlot();

	// Publish with a timeout to avoid hanging on slow/failing relays
	const publishWithTimeout = async () => {
		const timeoutMs = 5000; // 5 second timeout per attempt
		const publishPromise = relayPool.publish(relays, event);
		const timeoutPromise = new Promise<void>((_, reject) =>
			setTimeout(() => reject(new Error('Publish timeout - relays may be slow')), timeoutMs),
		);

		await Promise.race([publishPromise, timeoutPromise]);
	};

	await withPublishBackoff(publishWithTimeout);
}
