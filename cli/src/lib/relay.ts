/**
 * Nostr Relay Communication Module
 *
 * L4: Integration-Contractor - Nostr protocol communication
 */

import type { Filter } from 'nostr-tools/filter';
import { SimplePool } from 'nostr-tools/pool';
import type { NostrEvent, UnsignedEvent } from './types';
import { NostrKinds } from './types';

/**
 * Relay pool wrapper for managing connections
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
	 * Publish an event to all relays
	 */
	publish(event: NostrEvent): Promise<void>;
	/**
	 * Query events and wait for EOSE
	 */
	query(filter: Filter, timeout?: number): Promise<NostrEvent[]>;
	/**
	 * Close all relay connections
	 */
	close(): void;
}

/**
 * Create a relay pool for the given URLs.
 */
export function createRelayPool(relayUrls: string[]): RelayPool {
	const pool = new SimplePool();

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
			await Promise.all(pool.publish(relayUrls, event));
		},

		async query(filter, timeout = 10000) {
			// Use querySync for simpler query handling
			try {
				const events = await pool.querySync(relayUrls, filter, {
					maxWait: timeout,
				});
				return events as NostrEvent[];
			} catch (err) {
				console.error('Query error:', err);
				return [];
			}
		},

		close() {
			pool.close(relayUrls);
		},
	};
}

/**
 * Create a filter for fetching Gift Wrap events addressed to a pubkey.
 */
export function filterGiftWraps(pubkey: string, since?: number): Filter {
	const filter: Filter = {
		kinds: [NostrKinds.GIFT_WRAP],
		'#p': [pubkey],
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
		if (!existing || event.created_at > existing.created_at) {
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
