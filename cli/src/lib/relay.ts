/**
 * Nostr Relay Communication Module
 *
 * L4: Integration-Contractor - Nostr protocol communication
 *
 * This module provides rate-limited and resilient relay connections
 * with exponential backoff for transient failures.
 */

import type { EventTemplate, VerifiedEvent } from 'nostr-tools/core';
import { verifyEvent } from 'nostr-tools/pure';
import type { Filter } from 'nostr-tools/filter';
import { SimplePool } from 'nostr-tools/pool';
import { normalizeRelayUrls } from './config';
import { HISTORY_LIMITS, compareSecretVersions } from './crypto';
import { RelayError } from './errors';
import {
	QuorumError,
	RateLimiter,
	executeWithQuorum,
	getUnavailableTargets,
	mergeQuorumReports,
	parseNip20Reason,
	withPublishBackoff,
	withQueryBackoff,
} from './rate-limiter';
import type { QuorumOutcomeState, QuorumReport } from './rate-limiter';
import type { NostrEvent, UnsignedEvent } from './types';
import { NostrKinds, REDSHIFT_TYPE_TAG } from './types';

/**
 * Default rate limiter configuration for relay operations
 * - Max 10 requests per second window
 * - Minimum 100ms between requests
 */
const defaultRateLimiter = new RateLimiter(10, 1000, 100);

export interface RelayPublishOutcome {
	relay: string;
	state: QuorumOutcomeState;
	reason?: string;
}

export interface PublishReport {
	eventId: string;
	required: number;
	accepted: string[];
	failed: Array<{ relay: string; reason: string }>;
	outcomes: RelayPublishOutcome[];
}

export class PublishQuorumError extends RelayError {
	readonly report: PublishReport;
	readonly event: NostrEvent;

	constructor(report: PublishReport, event: NostrEvent) {
		super(
			`Publish quorum failed: ${report.accepted.length}/${report.required} relays accepted event ${report.eventId}`,
			'publish',
		);
		this.name = 'PublishQuorumError';
		this.report = report;
		this.event = event;
	}
}

function fromSharedReport(report: QuorumReport<string>): PublishReport {
	return {
		eventId: report.operationId,
		required: report.required,
		accepted: report.accepted,
		failed: report.failed.map(({ target, reason }) => ({ relay: target, reason })),
		outcomes: report.outcomes.map(({ target, state, reason }) => ({
			relay: target,
			state,
			...(reason === undefined ? {} : { reason }),
		})),
	};
}

function toSharedReport(report: PublishReport): QuorumReport<string> {
	return {
		operationId: report.eventId,
		required: report.required,
		accepted: report.accepted,
		failed: report.failed.map(({ relay, reason }) => ({ target: relay, reason })),
		outcomes: report.outcomes.map(({ relay, state, reason }) => ({
			target: relay,
			state,
			...(reason === undefined ? {} : { reason }),
		})),
	};
}

export function getUnavailableRelays(report: PublishReport): string[] {
	return getUnavailableTargets(toSharedReport(report));
}

export function mergePublishReports(previous: PublishReport, retry: PublishReport): PublishReport {
	return fromSharedReport(mergeQuorumReports(toSharedReport(previous), toSharedReport(retry)));
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
		return fromSharedReport(shared);
	} catch (error) {
		if (!(error instanceof QuorumError)) throw error;
		throw new PublishQuorumError(fromSharedReport(error.report as QuorumReport<string>), event);
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
	/** Publish an exact signed event to an explicit configured relay subset. */
	publishTo(relays: string[], event: NostrEvent, required?: number): Promise<PublishReport>;
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
function isByteIdenticalVerifiedEvent(candidate: NostrEvent, expected: NostrEvent) {
	return (
		verifyEvent(candidate) &&
		candidate.id === expected.id &&
		candidate.pubkey === expected.pubkey &&
		candidate.created_at === expected.created_at &&
		candidate.kind === expected.kind &&
		candidate.content === expected.content &&
		candidate.sig === expected.sig &&
		JSON.stringify(candidate.tags) === JSON.stringify(expected.tags)
	);
}

export interface RelayPoolOptions {
	/** Sign a NIP-42 AUTH template when a relay challenges this client. */
	authSigner?: (event: EventTemplate) => Promise<VerifiedEvent>;
	/** Deterministic transport seams for tests. */
	publishRelay?: (relay: string, event: NostrEvent) => Promise<void>;
	queryRelay?: (relay: string, filter: Filter, timeout: number) => Promise<NostrEvent[]>;
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
	const normalizedRelayUrls = normalizeRelayUrls(relayUrls, 'relay pool');
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

	const publishTo = async (
		targetRelays: string[],
		event: NostrEvent,
		required = Math.floor(targetRelays.length / 2) + 1,
	) => {
		for (const relay of targetRelays) {
			if (!normalizedRelayUrls.includes(relay))
				throw new RelayError(`Relay is not configured: ${relay}`, 'publish');
		}
		return publishWithQuorum(
			targetRelays,
			event,
			async (relay) => {
				const publishOperation = async () => {
					if (enableRateLimiting) await rateLimiter.waitForSlot();
					try {
						if (options.publishRelay) await options.publishRelay(relay, event);
						else {
							const publication = pool.publish([relay], event)[0];
							if (!publication) throw new Error(`No publication promise created for ${relay}`);
							const result = await publication;
							if (result.startsWith('connection failure:')) throw new Error(result);
						}
					} catch (error) {
						if (parseNip20Reason(error).code !== 'duplicate') throw error;
						try {
							const matches = options.queryRelay
								? await options.queryRelay(relay, { ids: [event.id] }, 2000)
								: ((await pool.querySync(
										[relay],
										{ ids: [event.id] },
										{ maxWait: 2000 },
									)) as NostrEvent[]);
							if (matches.some((candidate) => isByteIdenticalVerifiedEvent(candidate, event)))
								return;
						} catch {
							// Confirmation failure does not prove permanent rejection.
						}
						throw error;
					}
				};
				if (enableRetry) await withPublishBackoff(publishOperation);
				else await publishOperation();
			},
			required,
		);
	};

	return {
		relays: normalizedRelayUrls,
		pool,

		subscribe(filter, onEvent, onEose) {
			const params: { onevent: (event: NostrEvent) => void; oneose?: () => void } = {
				onevent: (event) => onEvent(event as NostrEvent),
			};
			if (onEose) {
				params.oneose = onEose;
			}
			const sub = pool.subscribeMany(normalizedRelayUrls, filter, params);
			return { close: () => sub.close() };
		},

		async publish(event) {
			return publishTo(normalizedRelayUrls, event);
		},

		publishTo,

		async query(filter, timeout = 5000) {
			const queryOperation = async (): Promise<NostrEvent[]> => {
				// Rate limit before querying
				if (enableRateLimiting) {
					await rateLimiter.waitForSlot();
				}
				const events = await pool.querySync(normalizedRelayUrls, filter, {
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
			pool.close(normalizedRelayUrls);
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
export function filterGiftWrapHistory(pubkey: string): Filter {
	return {
		...filterGiftWraps(pubkey),
		limit: HISTORY_LIMITS.maxObservedEvents,
	};
}

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
