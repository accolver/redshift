import { describe, expect, it } from 'bun:test';
import type { Event } from 'nostr-tools/core';
import { ResilientSimplePool } from '../src';

const event: Event = {
	id: 'a'.repeat(64),
	pubkey: 'b'.repeat(64),
	created_at: 1,
	kind: 24133,
	tags: [],
	content: 'encrypted',
	sig: 'c'.repeat(128),
};

const immediateBackoff = {
	numOfAttempts: 3,
	startingDelay: 1,
	maxDelay: 1,
	jitter: 'none' as const,
};

describe('ResilientSimplePool', () => {
	it('retries only the failed relay and preserves healthy relay delivery', async () => {
		const calls = new Map<string, number>();
		const pool = new ResilientSimplePool({
			minDelayMs: 0,
			backoff: immediateBackoff,
			publishRelay: async (relay) => {
				const count = (calls.get(relay) ?? 0) + 1;
				calls.set(relay, count);
				if (relay.includes('flaky') && count === 1) throw new Error('temporary timeout');
				return 'accepted';
			},
		});

		await expect(
			Promise.all(pool.publish(['wss://healthy.test', 'wss://flaky.test'], event)),
		).resolves.toEqual(['accepted', 'accepted']);
		expect(calls.get('wss://healthy.test')).toBe(1);
		expect(calls.get('wss://flaky.test')).toBe(2);
		pool.destroy();
	});

	it('does not retry permanent relay rejection', async () => {
		let calls = 0;
		const pool = new ResilientSimplePool({
			minDelayMs: 0,
			backoff: immediateBackoff,
			publishRelay: async () => {
				calls++;
				throw new Error('unauthorized client');
			},
		});

		await expect(pool.publish(['wss://relay.test'], event)[0]).rejects.toThrow('unauthorized');
		expect(calls).toBe(1);
		pool.destroy();
	});

	it('prevents transport work after idempotent destruction', async () => {
		let calls = 0;
		const pool = new ResilientSimplePool({
			minDelayMs: 0,
			backoff: immediateBackoff,
			publishRelay: async () => {
				calls++;
				return 'accepted';
			},
		});
		pool.destroy();
		pool.destroy();

		await expect(pool.publish(['wss://relay.test'], event)[0]).rejects.toThrow('pool is closed');
		expect(calls).toBe(0);
	});

	it('deduplicates relay targets before publishing', async () => {
		let calls = 0;
		const pool = new ResilientSimplePool({
			minDelayMs: 0,
			publishRelay: async () => {
				calls++;
				return 'accepted';
			},
		});

		await Promise.all(pool.publish(['wss://relay.test', 'wss://relay.test'], event));
		expect(calls).toBe(1);
		pool.destroy();
	});
});
