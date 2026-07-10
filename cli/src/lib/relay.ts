/**
 * Nostr Relay Communication Module
 *
 * L4: Integration-Contractor - Nostr protocol communication
 *
 * This module provides rate-limited and resilient relay connections
 * with exponential backoff for transient failures.
 */

import type { EventTemplate, VerifiedEvent } from 'nostr-tools/core';
import type { Filter } from 'nostr-tools/filter';
import { SimplePool } from 'nostr-tools/pool';
import { compareSecretVersions } from './crypto';
import { RelayError } from './errors';
import {
	QuorumError,
	RateLimiter,
	executeWithQuorum,
	withPublishBackoff,
	withQueryBackoff,
} from './rate-limiter';
import type { NostrEvent, UnsignedEvent } from './types';
import { NostrKinds, REDSHIFT_TYPE_TAG } from './types';

/**
 * Default rate limiter configuration for relay operations
 * - Max 10 requests per second window
 * - Minimum 100ms between requests
 */
const defaultRateLimiter = new RateLimiter(10, 1000, 100);

export interface PublishReport {
	eventId: string;
	required: number;
	accepted: string[];
	failed: Array<{ relay: string; reason: string }>;
}

export class PublishQuorumError extends RelayError {
	readonly report: PublishReport;

	constructor(report: PublishReport) {
		super(
			`Publish quorum failed: ${report.accepted.length}/${report.required} relays accepted event ${report.eventId}`,
			'publish',
		);
		this.name = 'PublishQuorumError';
		this.report = report;
	}
}

export async function publishWithQuorum(
	relays: string[],
	event: NostrEvent,
	publishOne: (relay: string, event: NostrEvent) => Promise<void>,
	required = Math.floor(relays.length / 2) + 1,
): Promise<PublishReport> {
	try {
		const shared = await executeWithQuorum(
			relays,
			event.id,
			(relay) => publishOne(relay, event),
			required,
		);
		return {
			eventId: shared.operationId,
			required: shared.required,
			accepted: shared.accepted,
			failed: shared.failed.map(({ target, reason }) => ({ relay: target, reason })),
		};
	} catch (error) {
		if (!(error instanceof QuorumError)) throw error;
		throw new PublishQuorumError({
			eventId: error.report.operationId,
			required: error.report.required,
			accepted: error.report.accepted as string[],
			failed: error.report.failed.map(({ target, reason }) => ({
				relay: String(target),
				reason,
			})),
		});
	}
}

/**
 * Relay pool wrapper for managing connections with rate limiting
 */
export interface RelayPool {
	relays: string[];
	pool: SimplePool;
	/**
	 * Subscribe to events matching filter
	 */
	subscribe(
		filter: Filter,
		onEvent: (event: NostrEvent) => void,
		onEose?: () => void,
	): { close: () => void };
	/**
	 * Publish an event to all relays (with rate limiting and retry)
	 */
	publish(event: NostrEvent): Promise<PublishReport>;
	/**
	 * Query events and wait for EOSE (with rate limiting and retry)
	 */
	query(filter: Filter, timeout?: number): Promise<NostrEvent[]>;
	/**
	 * Close all relay connections
	 */
	close(): void;
	/**
	 * Reset the rate limiter (useful for testing)
	 */
	resetRateLimiter(): void;
}

/**
 * Options for creating a relay pool
 */
export interface RelayPoolOptions {
	/** Sign a NIP-42 AUTH template when a relay challenges this client. */
	authSigner?: (event: EventTemplate) => Promise<VerifiedEvent>;
	/** Custom rate limiter instance (optional) */
	rateLimiter?: RateLimiter;
	/** Whether to enable rate limiting (default: true) */
	enableRateLimiting?: boolean;
	/** Whether to enable exponential backoff retries (default: true) */
	enableRetry?: boolean;
}

/**
 * Create a relay pool for the given URLs with rate limiting and retry support.
 */
export function createRelayPool(relayUrls: string[], options: RelayPoolOptions = {}): RelayPool {
	type AuthCapableSimplePoolConstructor = new (options?: {
		automaticallyAuth?: (
			relayUrl: string,
		) => null | ((event: EventTemplate) => Promise<VerifiedEvent>);
	}) => SimplePool;
	const PoolConstructor = SimplePool as unknown as AuthCapableSimplePoolConstructor;
	const pool = new PoolConstructor(
		options.authSigner ? { automaticallyAuth: () => options.authSigner ?? null } : undefined,
	);
	const {
		rateLimiter = defaultRateLimiter,
		enableRateLimiting = true,
		enableRetry = true,
	} = options;

	return {
		relays: relayUrls,
		pool,

		subscribe(filter, onEvent, onEose) {
			const params: { onevent: (event: NostrEvent) => void; oneose?: () => void } = {
				onevent: (event) => onEvent(event as NostrEvent),
			};
			if (onEose) {
				params.oneose = onEose;
			}
			const sub = pool.subscribeMany(relayUrls, filter, params);
			return { close: () => sub.close() };
		},

		async publish(event) {
			return publishWithQuorum(relayUrls, event, async (relay) => {
				const publishOperation = async () => {
					if (enableRateLimiting) await rateLimiter.waitForSlot();
					await Promise.all(pool.publish([relay], event));
				};
				if (enableRetry) {
					await withPublishBackoff(publishOperation);
				} else {
					await publishOperation();
				}
			});
		},

		async query(filter, timeout = 5000) {
			const queryOperation = async (): Promise<NostrEvent[]> => {
				// Rate limit before querying
				if (enableRateLimiting) {
					await rateLimiter.waitForSlot();
				}
				const events = await pool.querySync(relayUrls, filter, {
					maxWait: timeout,
				});
				return events as NostrEvent[];
			};

			try {
				if (enableRetry) {
					return await withQueryBackoff(queryOperation);
				}
				return await queryOperation();
			} catch (err) {
				const originalError = err instanceof Error ? err : new Error(String(err));
				throw new RelayError(
					`Query failed after retries: ${originalError.message}`,
					'query',
					originalError,
				);
			}
		},

		close() {
			pool.close(relayUrls);
		},

		resetRateLimiter() {
			rateLimiter.reset();
		},
	};
}

/**
 * Create a filter for fetching Redshift Gift Wrap events addressed to a pubkey.
 *
 * Filters by:
 * - kind: 1059 (Gift Wrap)
 * - p-tag: recipient pubkey
 * - t-tag: "redshift-secrets" (to only get Redshift events, not DMs, etc.)
 */
export function filterGiftWraps(pubkey: string, since?: number): Filter {
	const filter: Filter = {
		kinds: [NostrKinds.GIFT_WRAP],
		'#p': [pubkey],
		'#t': [REDSHIFT_TYPE_TAG],
	};

	if (since !== undefined) {
		filter.since = since;
	}

	return filter;
}

/**
 * Given a list of unwrapped rumor events, return only the latest
 * event for each unique d-tag.
 *
 * This implements the "replaceable event" logic: newer events
 * (higher created_at) replace older ones with the same d-tag.
 */
export function getLatestByDTag(
	events: Array<NostrEvent | UnsignedEvent>,
): Record<string, NostrEvent | UnsignedEvent> {
	const latest: Record<string, NostrEvent | UnsignedEvent> = {};

	for (const event of events) {
		const dTag = event.tags.find((t) => t[0] === 'd')?.[1];
		if (!dTag) continue;

		const existing = latest[dTag];
		if (!existing) {
			latest[dTag] = event;
			continue;
		}
		const eventId = 'id' in event ? event.id : JSON.stringify(event);
		const existingId = 'id' in existing ? existing.id : JSON.stringify(existing);
		if (
			compareSecretVersions(
				{ createdAt: event.created_at, eventId },
				{ createdAt: existing.created_at, eventId: existingId },
			) > 0
		) {
			latest[dTag] = event;
		}
	}

	return latest;
}

/**
 * Create a filter for fetching deletion events.
 */
export function filterDeletions(pubkey: string, since?: number): Filter {
	const filter: Filter = {
		kinds: [NostrKinds.DELETION],
		authors: [pubkey],
	};

	if (since !== undefined) {
		filter.since = since;
	}

	return filter;
}
