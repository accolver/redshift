#!/usr/bin/env bun

import type { NostrEvent } from 'nostr-tools';

const args = Bun.argv.slice(2);
const port = Number(valueAfter('--port'));
const behavior = valueAfter('--behavior') === 'reject' ? 'reject' : 'accept';
if (!Number.isInteger(port) || port < 0) throw new Error('--port is required');

const events = new Map<string, NostrEvent>();
const publishedEvents: NostrEvent[] = [];
let publishCount = 0;

const server = Bun.serve({
	hostname: '127.0.0.1',
	port,
	fetch(request, bunServer) {
		const url = new URL(request.url);
		if (url.pathname === '/stats') {
			return Response.json({ publishCount, publishedEvents, events: [...events.values()] });
		}
		if (bunServer.upgrade(request)) return undefined;
		return new Response('Nostr test relay');
	},
	websocket: {
		message(socket, message) {
			let frame: unknown;
			try {
				frame = JSON.parse(
					typeof message === 'string' ? message : new TextDecoder().decode(message),
				);
			} catch {
				return;
			}
			if (!Array.isArray(frame) || typeof frame[0] !== 'string') return;
			if (frame[0] === 'EVENT' && isNostrEvent(frame[1])) {
				const event = frame[1];
				publishCount++;
				publishedEvents.push(structuredClone(event));
				if (behavior === 'reject') {
					socket.send(
						JSON.stringify(['OK', event.id, false, 'restricted: deterministic test policy']),
					);
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

console.log(`ready:${server.port}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(signal, async () => {
		await server.stop(true);
		process.exit(0);
	});
}

function valueAfter(flag: string) {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

type TestFilter = Record<string, unknown>;

function isFilter(value: unknown): value is TestFilter {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function matchesFilter(event: NostrEvent, filter: TestFilter) {
	if (Array.isArray(filter.ids) && !filter.ids.includes(event.id)) return false;
	if (Array.isArray(filter.authors) && !filter.authors.includes(event.pubkey)) return false;
	if (Array.isArray(filter.kinds) && !filter.kinds.includes(event.kind)) return false;
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
