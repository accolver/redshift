import type { NostrEvent } from 'nostr-tools';

export type TestRelayBehavior = 'accept' | 'reject';

export interface NostrTestRelay {
	url: string;
	port: number;
	publishCount: number;
	publishedEvents: NostrEvent[];
	getEvent(id: string): NostrEvent | undefined;
	stop(): Promise<void>;
}

interface SocketData {
	connectionId: string;
}

export async function startNostrTestRelay(
	options: {
		port?: number;
		behavior?: TestRelayBehavior;
		rejectionReason?: string;
	} = {},
): Promise<NostrTestRelay> {
	const events = new Map<string, NostrEvent>();
	const publishedEvents: NostrEvent[] = [];
	let publishCount = 0;
	const behavior = options.behavior ?? 'accept';
	const rejectionReason = options.rejectionReason ?? 'restricted: deterministic test policy';
	const server = Bun.serve<SocketData>({
		hostname: '127.0.0.1',
		port: options.port ?? 0,
		fetch(request, bunServer) {
			if (bunServer.upgrade(request, { data: { connectionId: crypto.randomUUID() } })) {
				return undefined;
			}
			return new Response('Nostr test relay', { status: 200 });
		},
		websocket: {
			message(socket, message) {
				let frame: unknown;
				try {
					frame = JSON.parse(
						typeof message === 'string' ? message : new TextDecoder().decode(message),
					);
				} catch {
					socket.send(JSON.stringify(['NOTICE', 'invalid JSON']));
					return;
				}
				if (!Array.isArray(frame) || typeof frame[0] !== 'string') return;
				if (frame[0] === 'EVENT') {
					const event = frame[1];
					if (!isNostrEvent(event)) return;
					publishCount++;
					publishedEvents.push(structuredClone(event));
					if (behavior === 'reject') {
						socket.send(JSON.stringify(['OK', event.id, false, rejectionReason]));
					} else {
						events.set(event.id, structuredClone(event));
						socket.send(JSON.stringify(['OK', event.id, true, '']));
					}
					return;
				}
				if (frame[0] === 'REQ' && typeof frame[1] === 'string') {
					const subscriptionId = frame[1];
					const filters = frame.slice(2).filter(isFilter);
					for (const event of events.values()) {
						if (filters.length === 0 || filters.some((filter) => matchesFilter(event, filter))) {
							socket.send(JSON.stringify(['EVENT', subscriptionId, event]));
						}
					}
					socket.send(JSON.stringify(['EOSE', subscriptionId]));
				}
			},
		},
	});

	const boundPort = server.port;
	if (!boundPort) throw new Error('Nostr test relay did not bind a port');
	return {
		url: `ws://127.0.0.1:${boundPort}/`,
		port: boundPort,
		get publishCount() {
			return publishCount;
		},
		publishedEvents,
		getEvent: (id) => events.get(id),
		async stop() {
			await server.stop(true);
		},
	};
}

export function startUnavailableTestEndpoint() {
	const server = Bun.serve({
		port: 0,
		hostname: '127.0.0.1',
		fetch: () => new Response('temporarily unavailable', { status: 503 }),
	});
	const port = server.port;
	if (!port) throw new Error('Unable to bind an unavailable test endpoint');
	return {
		port,
		url: `ws://127.0.0.1:${port}/`,
		async stop() {
			await server.stop(true);
		},
	};
}

type TestFilter = Record<string, unknown>;

function isFilter(value: unknown): value is TestFilter {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function matchesFilter(event: NostrEvent, filter: TestFilter) {
	if (Array.isArray(filter.ids) && !filter.ids.includes(event.id)) return false;
	if (Array.isArray(filter.authors) && !filter.authors.includes(event.pubkey)) return false;
	if (Array.isArray(filter.kinds) && !filter.kinds.includes(event.kind)) return false;
	if (typeof filter.since === 'number' && event.created_at < filter.since) return false;
	if (typeof filter.until === 'number' && event.created_at > filter.until) return false;
	for (const [key, values] of Object.entries(filter)) {
		if (!key.startsWith('#') || !Array.isArray(values)) continue;
		const tagName = key.slice(1);
		if (!event.tags.some((tag) => tag[0] === tagName && values.includes(tag[1]))) return false;
	}
	return true;
}

function isNostrEvent(value: unknown): value is NostrEvent {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const event = value as Record<string, unknown>;
	return (
		typeof event.id === 'string' &&
		typeof event.pubkey === 'string' &&
		typeof event.created_at === 'number' &&
		typeof event.kind === 'number' &&
		Array.isArray(event.tags) &&
		typeof event.content === 'string' &&
		typeof event.sig === 'string'
	);
}
