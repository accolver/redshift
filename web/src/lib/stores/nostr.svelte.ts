import { EventStore } from 'applesauce-core';
import { RelayPool, onlyEvents } from 'applesauce-relay';
import type { NostrEvent } from 'nostr-tools';

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

// Redshift uses Kind 30078 (Parameterized Replaceable) for project/secret data
export const REDSHIFT_KIND = 30078;

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

	// Subscribe to all Redshift events (Kind 30078) for this user
	// Also subscribe to profile events (Kind 0) for displaying user info
	activeSubscription = relayPool
		.subscription(relays, [
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
 * Publish an event to relays
 */
export async function publishEvent(
	event: NostrEvent,
	relays: string[] = DEFAULT_RELAYS,
): Promise<void> {
	// Add to local store immediately for optimistic updates
	eventStore.add(event);

	// Publish to relays
	await relayPool.publish(relays, event);
}

/**
 * Get the d-tag value for a project
 * Format: <project_id> (just the project ID for project metadata)
 */
export function getProjectDTag(projectId: string): string {
	return projectId;
}

/**
 * Get the d-tag value for secrets in an environment
 * Format: <project_id>|<environment_slug>
 */
export function getSecretsDTag(projectId: string, environmentSlug: string): string {
	return `${projectId}|${environmentSlug}`;
}

/**
 * Parse a d-tag to extract project and environment info
 */
export function parseDTag(dTag: string): { projectId: string; environmentSlug?: string } {
	const parts = dTag.split('|');
	return {
		projectId: parts[0],
		environmentSlug: parts[1],
	};
}
