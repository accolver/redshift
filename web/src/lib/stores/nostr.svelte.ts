import { REDSHIFT_KIND } from '$lib/constants';
import { HISTORY_LIMITS, getRedshiftSecretsFilter } from '$lib/crypto';
import { clearDecryptionCache } from '$lib/models/gift-wrap-secrets';
import {
	QuorumError,
	type QuorumReport,
	RateLimiter,
	executeWithQuorum,
	getUnavailableTargets,
	hasQuorum,
	parseNip20Reason,
	withPublishBackoff,
} from '$lib/rate-limiter';
import { DEFAULT_RELAYS as CRYPTO_DEFAULT_RELAYS } from '@redshift/crypto';
import { EventStore } from 'applesauce-core';
import { RelayPool, onlyEvents } from 'applesauce-relay';
import type { EventTemplate, NostrEvent } from 'nostr-tools';
import {
	firstValueFrom,
	last,
	scan,
	startWith,
	take,
	takeUntil,
	takeWhile,
	tap,
	timeout,
	timer,
} from 'rxjs';
import type { Subscription } from 'rxjs';
import {
	clearPublicationRecovery,
	finalizePublicationRecovery,
	getPublicationRecoveryRecord,
	isExactPublicationEvent,
	mergePublicationRecovery,
	normalizePublicationRelayUrls,
	preparePublicationRecovery,
	setPublicationRecoveryError,
	setPublicationRetrying,
} from './publication-recovery.svelte';
import type { PublicationContext } from './publication-recovery.svelte';

// Re-export constants for backward compatibility with existing imports
export { REDSHIFT_KIND, getProjectDTag } from '$lib/constants';

/**
 * Rate limiter instance for relay operations
 * - Max 10 requests per second
 * - Minimum 100ms between requests
 */
const rateLimiter = new RateLimiter(10, 1000, 100);
const HISTORY_TEXT_ENCODER = new TextEncoder();

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

// Single EventStore instance for the entire app. Disconnect clears it in place so
// shared model subscriptions remain bound to the same lifecycle-owned store.
export const eventStore = new EventStore();

// Single RelayPool instance for the entire app
export const relayPool = new RelayPool();

// Track active subscriptions
let activeSubscription: { unsubscribe: () => void } | null = null;
let managedRelayAuthSubscription: Subscription | null = null;
let connectionFallbackTimer: ReturnType<typeof setTimeout> | null = null;

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
	// Clean up resources owned by any previous connection lifecycle.
	if (activeSubscription) {
		activeSubscription.unsubscribe();
	}
	if (connectionFallbackTimer) {
		clearTimeout(connectionFallbackTimer);
		connectionFallbackTimer = null;
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

	const secretsFilter = {
		...getRedshiftSecretsFilter(pubkey),
		limit: HISTORY_LIMITS.maxObservedEvents,
	};

	// Every connection performs the same bounded full query. Raw outer-event timestamps
	// are untrusted and must never narrow a later state subscription.
	const redshiftFilter = { kinds: [REDSHIFT_KIND], authors: [pubkey] };
	const profileFilter = { kinds: [0], authors: [pubkey] };

	activeSubscription = relayPool
		.subscription(relays, [secretsFilter, redshiftFilter, profileFilter])
		.pipe(onlyEvents())
		.subscribe({
			next: (event: NostrEvent) => {
				eventStore.add(event);

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
	connectionFallbackTimer = setTimeout(() => {
		connectionFallbackTimer = null;
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
	if (connectionFallbackTimer) {
		clearTimeout(connectionFallbackTimer);
		connectionFallbackTimer = null;
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
	// Clear every cached event in place. This prevents cross-user leakage while
	// keeping shared Applesauce model subscriptions bound across relay reconnects.
	eventStore.removeByFilters({});
	// Clear the decryption cache so decrypted secrets from the previous user are purged
	clearDecryptionCache();
	// Reset sync flag so next session will sync again
	resetManagedRelaySync();
	// Recovery state is scoped to the authenticated browser session.
	clearPublicationRecovery();
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
export async function refreshRedshiftEvents(pubkey: string) {
	if (!/^[0-9a-f]{64}$/.test(pubkey)) throw new Error('Invalid Redshift history owner');
	const targets = normalizePublicationRelayUrls(
		relayState.relays.length > 0 ? relayState.relays : DEFAULT_RELAYS,
	);
	await rateLimiter.waitForSlot();
	const initial = {
		events: [] as NostrEvent[],
		ciphertextBytes: 0,
		truncated: false,
	};
	let deadlineReached = false;
	const deadline = timer(10_000).pipe(
		tap(() => {
			deadlineReached = true;
		}),
	);
	const collected = await firstValueFrom(
		relayPool
			.request(targets, [
				{ ...getRedshiftSecretsFilter(pubkey), limit: HISTORY_LIMITS.maxObservedEvents + 1 },
			])
			.pipe(
				takeUntil(deadline),
				scan((state, event) => {
					const eventBytes = HISTORY_TEXT_ENCODER.encode(event.content).length;
					if (
						state.events.length >= HISTORY_LIMITS.maxObservedEvents ||
						state.ciphertextBytes + eventBytes > HISTORY_LIMITS.maxCiphertextBytes
					) {
						state.truncated = true;
						return state;
					}
					state.events.push(event);
					state.ciphertextBytes += eventBytes;
					return state;
				}, initial),
				takeWhile((state) => !state.truncated, true),
				startWith(initial),
				last(),
			),
	);
	if (deadlineReached) throw new Error('Relay history refresh timed out before completion');
	const unique = new Map(collected.events.map((event) => [event.id, event]));
	const ordered = [...unique.values()].sort((left, right) => {
		if (left.created_at !== right.created_at) return right.created_at - left.created_at;
		return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
	});
	for (const event of ordered.slice(0, HISTORY_LIMITS.maxObservedEvents)) eventStore.add(event);
	return {
		observedEvents: ordered.length,
		truncated:
			collected.truncated ||
			collected.events.length >= HISTORY_LIMITS.maxObservedEvents ||
			ordered.length >= HISTORY_LIMITS.maxObservedEvents,
	};
}

export async function publishEvent(
	event: NostrEvent,
	relays?: string[],
	context?: PublicationContext,
): Promise<QuorumReport<string>> {
	const targets = normalizePublicationRelayUrls(
		relays ?? (relayState.relays.length > 0 ? relayState.relays : DEFAULT_RELAYS),
	);
	const recoverableSecretEvent = event.kind === 1059;
	if (recoverableSecretEvent) {
		const ownerPubkey = context?.ownerPubkey ?? eventOwner(event);
		preparePublicationRecovery(event, targets, { ...context, ownerPubkey });
	}
	let report: QuorumReport<string>;
	try {
		report = await executeWithQuorum(targets, event.id, (relay) =>
			publishEventToRelay(relay, event),
		);
	} catch (error) {
		if (!(error instanceof QuorumError)) throw error;
		if (recoverableSecretEvent) {
			finalizePublicationRecovery(event.id, error.report as QuorumReport<string>);
		}
		throw error;
	}
	if (recoverableSecretEvent) finalizePublicationRecovery(event.id, report);
	// Only expose the event as durable local state after publication quorum succeeds.
	eventStore.add(event);
	return report;
}

export async function retryPublication(eventId: string): Promise<QuorumReport<string>> {
	const record = getPublicationRecoveryRecord(eventId);
	if (!record) throw new Error(`Publication recovery record not found: ${eventId}`);
	const unavailable = getUnavailableTargets(record.report);
	if (unavailable.length === 0) return record.report;
	setPublicationRetrying(eventId, true);
	setPublicationRecoveryError(null);
	try {
		let retryReport: QuorumReport<string>;
		try {
			retryReport = await executeWithQuorum(unavailable, eventId, (relay) =>
				publishEventToRelay(relay, record.event),
			);
		} catch (error) {
			if (!(error instanceof QuorumError)) throw error;
			retryReport = error.report as QuorumReport<string>;
		}
		const merged = mergePublicationRecovery(eventId, retryReport);
		if (hasQuorum(merged)) eventStore.add(record.event);
		return merged;
	} catch (error) {
		setPublicationRecoveryError(error instanceof Error ? error.message : String(error));
		throw error;
	} finally {
		setPublicationRetrying(eventId, false);
	}
}

async function publishEventToRelay(relay: string, event: NostrEvent) {
	await withPublishBackoff(async () => {
		await rateLimiter.waitForSlot();
		try {
			const publishPromise = relayPool
				.publish([relay], event, { reconnect: false, timeout: 5000 })
				.then((responses) => {
					const response = responses[0];
					if (!response?.ok)
						throw new Error(response?.message || `Relay rejected event at ${relay}`);
				});
			await withPublishTimeout(publishPromise, relay);
		} catch (error) {
			if (parseNip20Reason(error).code !== 'duplicate') throw error;
			try {
				const candidate = await firstValueFrom(
					relayPool.request([relay], [{ ids: [event.id] }]).pipe(take(1), timeout({ first: 2000 })),
				);
				if (isExactPublicationEvent(candidate, event)) return;
			} catch {
				// Unconfirmed duplicate remains unavailable and follows normal retry policy.
			}
			throw error;
		}
	});
}

function eventOwner(event: NostrEvent) {
	if (event.kind !== 1059) return event.pubkey;
	const recipients = event.tags.filter((tag) => tag[0] === 'p');
	const owner = recipients.length === 1 ? recipients[0]?.[1] : undefined;
	if (!owner) throw new Error('Gift Wrap publication requires exactly one owner recipient');
	return owner;
}
