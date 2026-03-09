/**
 * In-process NIP-01 Nostr relay mock using Bun's native WebSocket server.
 *
 * Used by integration tests to avoid requiring an external relay process.
 * Implements minimal NIP-01: EVENT, REQ, CLOSE messages with live subscriptions.
 */

import type { Server, ServerWebSocket } from 'bun';

export interface NostrEvent {
	id: string;
	pubkey: string;
	created_at: number;
	kind: number;
	tags: string[][];
	content: string;
	sig: string;
}

export interface NostrFilter {
	ids?: string[];
	authors?: string[];
	kinds?: number[];
	since?: number;
	until?: number;
	limit?: number;
	[key: string]: unknown; // for #e, #p, #t, #d tag filters
}

interface WebSocketData {
	id: string;
}

export interface MockRelay {
	url: string;
	port: number;
	server: Server<WebSocketData>;
	getEvents: () => Map<string, NostrEvent>;
	clear: () => void;
}

interface Subscription {
	filters: NostrFilter[];
	ws: ServerWebSocket<WebSocketData>;
}

/** Events stored by the relay. Key is event.id for regular events, or `kind:pubkey:dtag` for addressable events (kinds 30000-39999). */
const events = new Map<string, NostrEvent>();

/** Active subscriptions keyed by `wsId:subId` */
const subscriptions = new Map<string, Subscription>();

let wsCounter = 0;

/**
 * Determine the storage key for an event.
 * Addressable events (kinds 30000-39999) use `kind:pubkey:dtag`.
 * All other events use the event id.
 */
function storageKey(event: NostrEvent): string {
	if (event.kind >= 30000 && event.kind <= 39999) {
		const dTag = event.tags.find((t) => t[0] === 'd')?.[1] ?? '';
		return `${event.kind}:${event.pubkey}:${dTag}`;
	}
	return event.id;
}

/**
 * Check whether a single event matches a single NIP-01 filter.
 * All specified fields must match (AND logic).
 */
function matchesFilter(event: NostrEvent, filter: NostrFilter): boolean {
	// ids: event.id starts with any id in the array
	if (filter.ids) {
		const ids = filter.ids;
		if (!ids.some((prefix) => event.id.startsWith(prefix))) return false;
	}

	// authors: event.pubkey starts with any author in the array
	if (filter.authors) {
		const authors = filter.authors;
		if (!authors.some((prefix) => event.pubkey.startsWith(prefix))) return false;
	}

	// kinds: event.kind is in the array
	if (filter.kinds) {
		const kinds = filter.kinds;
		if (!kinds.includes(event.kind)) return false;
	}

	// since: event.created_at >= since
	if (filter.since !== undefined && event.created_at < filter.since) return false;

	// until: event.created_at <= until
	if (filter.until !== undefined && event.created_at > filter.until) return false;

	// Tag filters: #t, #d, #p, #e, etc.
	for (const key of Object.keys(filter)) {
		if (!key.startsWith('#')) continue;
		const tagName = key.slice(1); // e.g. 't' from '#t'
		const filterValues = filter[key];
		if (!Array.isArray(filterValues)) continue;
		const values = filterValues as string[];
		const hasMatch = event.tags.some((tag) => tag[0] === tagName && values.includes(tag[1] ?? ''));
		if (!hasMatch) return false;
	}

	return true;
}

/**
 * Query stored events matching any of the given filters.
 * Returns events sorted by created_at descending (most recent first).
 */
function queryEvents(filters: NostrFilter[]): NostrEvent[] {
	const matched = new Map<string, NostrEvent>();

	for (const event of events.values()) {
		for (const filter of filters) {
			if (matchesFilter(event, filter)) {
				// Deduplicate by event id
				matched.set(event.id, event);
				break;
			}
		}
	}

	// Sort by created_at descending
	const sorted = Array.from(matched.values()).sort((a, b) => b.created_at - a.created_at);

	// Apply limit from the first filter that has one (NIP-01: limit applies per filter)
	// For simplicity, apply the minimum limit across all filters that specify one
	let limit = Number.POSITIVE_INFINITY;
	for (const filter of filters) {
		if (filter.limit !== undefined && filter.limit < limit) {
			limit = filter.limit;
		}
	}

	return limit < Number.POSITIVE_INFINITY ? sorted.slice(0, limit) : sorted;
}

/**
 * Handle an incoming EVENT message: store the event and notify live subscriptions.
 */
function handleEvent(ws: ServerWebSocket<WebSocketData>, event: NostrEvent): void {
	const key = storageKey(event);

	// For addressable events, only replace if newer
	if (event.kind >= 30000 && event.kind <= 39999) {
		const existing = events.get(key);
		if (existing && existing.created_at >= event.created_at) {
			// Older or same timestamp — reject silently but still OK
			ws.send(JSON.stringify(['OK', event.id, true, '']));
			return;
		}
	}

	events.set(key, event);
	ws.send(JSON.stringify(['OK', event.id, true, '']));

	// Notify active subscriptions
	for (const [compositeKey, sub] of subscriptions) {
		for (const filter of sub.filters) {
			if (matchesFilter(event, filter)) {
				const subId = compositeKey.split(':').slice(1).join(':');
				try {
					sub.ws.send(JSON.stringify(['EVENT', subId, event]));
				} catch {
					// Client disconnected — clean up handled elsewhere
				}
				break; // Only send once per subscription
			}
		}
	}
}

/**
 * Handle an incoming REQ message: query stored events and send matches + EOSE.
 */
function handleReq(
	ws: ServerWebSocket<WebSocketData>,
	subId: string,
	filters: NostrFilter[],
): void {
	const wsId = ws.data.id;
	const compositeKey = `${wsId}:${subId}`;

	// Store subscription for live updates
	subscriptions.set(compositeKey, { filters, ws });

	// Query and send matching events
	const matching = queryEvents(filters);
	for (const event of matching) {
		ws.send(JSON.stringify(['EVENT', subId, event]));
	}

	ws.send(JSON.stringify(['EOSE', subId]));
}

/**
 * Handle an incoming CLOSE message: remove the subscription.
 */
function handleClose(ws: ServerWebSocket<WebSocketData>, subId: string): void {
	const wsId = ws.data.id;
	const compositeKey = `${wsId}:${subId}`;
	subscriptions.delete(compositeKey);
}

/**
 * Clean up all subscriptions for a disconnected WebSocket.
 */
function cleanupWs(ws: ServerWebSocket<WebSocketData>): void {
	const wsId = ws.data.id;
	for (const key of subscriptions.keys()) {
		if (key.startsWith(`${wsId}:`)) {
			subscriptions.delete(key);
		}
	}
}

/**
 * Start a mock NIP-01 relay on an auto-assigned port.
 */
export async function startMockRelay(): Promise<MockRelay> {
	// Reset state
	events.clear();
	subscriptions.clear();
	wsCounter = 0;

	const server = Bun.serve<WebSocketData>({
		port: 0, // Auto-assign
		fetch(req, server) {
			// Upgrade HTTP to WebSocket
			const upgraded = server.upgrade(req, {
				data: { id: String(++wsCounter) },
			});
			if (upgraded) return undefined;
			return new Response('Expected WebSocket', { status: 400 });
		},
		websocket: {
			open(_ws) {
				// No-op on open
			},
			message(ws, message) {
				const raw = typeof message === 'string' ? message : message.toString();
				let parsed: unknown[];
				try {
					parsed = JSON.parse(raw);
				} catch {
					return; // Ignore malformed messages
				}

				if (!Array.isArray(parsed) || parsed.length < 2) return;

				const type = parsed[0] as string;

				switch (type) {
					case 'EVENT': {
						const event = parsed[1] as NostrEvent;
						if (event?.id) {
							handleEvent(ws, event);
						}
						break;
					}
					case 'REQ': {
						const subId = parsed[1] as string;
						const filters = parsed.slice(2) as NostrFilter[];
						if (subId && filters.length > 0) {
							handleReq(ws, subId, filters);
						}
						break;
					}
					case 'CLOSE': {
						const subId = parsed[1] as string;
						if (subId) {
							handleClose(ws, subId);
						}
						break;
					}
				}
			},
			close(ws) {
				cleanupWs(ws);
			},
		},
	});

	const port = server.port;
	if (port === undefined) {
		throw new Error('Mock relay failed to bind to a port');
	}
	const url = `ws://localhost:${port}`;

	return {
		url,
		port,
		server,
		getEvents: () => events,
		clear: () => {
			events.clear();
			subscriptions.clear();
		},
	};
}

/**
 * Stop a mock relay server.
 */
export async function stopMockRelay(server: Server<WebSocketData>): Promise<void> {
	server.stop(true);
	events.clear();
	subscriptions.clear();
}
