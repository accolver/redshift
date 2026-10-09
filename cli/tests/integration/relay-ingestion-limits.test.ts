import { expect, it } from 'bun:test';
import { HISTORY_LIMITS } from '@redshift/crypto';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { createRelayPool, filterGiftWraps } from '../../src/lib/relay';
import { RelayError } from '../../src/lib/errors';

it('closes an actual hostile relay subscription that ignores the requested limit', async () => {
	const key = generateSecretKey();
	const pubkey = getPublicKey(key);
	const events = Array.from({ length: HISTORY_LIMITS.maxObservedEvents + 5 }, (_, index) =>
		finalizeEvent(
			{
				kind: 1059,
				created_at: index,
				content: 'malicious relay ciphertext',
				tags: [
					['p', pubkey],
					['t', 'redshift-secrets'],
				],
			},
			key,
		),
	);
	let requests = 0;
	let closed = false;
	const server = Bun.serve({
		hostname: '127.0.0.1',
		port: 0,
		fetch(request, server) {
			if (server.upgrade(request)) return;
			return new Response('WebSocket required', { status: 426 });
		},
		websocket: {
			message(socket, raw) {
				const message: unknown = JSON.parse(String(raw));
				if (!Array.isArray(message)) return;
				if (message[0] === 'CLOSE') closed = true;
				if (message[0] !== 'REQ') return;
				requests += 1;
				for (const event of events) socket.send(JSON.stringify(['EVENT', message[1], event]));
				// Deliberately withhold EOSE: the client must stop on its own bound.
			},
		},
	});
	const pool = createRelayPool([`ws://127.0.0.1:${server.port}`], { enableRateLimiting: false });
	try {
		const query = pool.query(filterGiftWraps(pubkey), 10_000);
		await expect(query).rejects.toBeInstanceOf(RelayError);
		await expect(query).rejects.toThrow('safety bound');
		for (let i = 0; i < 50 && !closed; i++) await Bun.sleep(10);
		expect(closed).toBe(true);
		expect(requests).toBe(1);
	} finally {
		pool.close();
		await server.stop(true);
		key.fill(0);
	}
}, 20_000);
