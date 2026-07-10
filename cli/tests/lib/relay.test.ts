/**
 * Relay Module Tests - TDD
 *
 * L4: Integration-Contractor - Nostr relay communication
 */

import { describe, expect, it } from 'bun:test';
import { RateLimiter } from '../../src/lib/rate-limiter';
import {
	PublishQuorumError,
	createRelayPool,
	filterGiftWraps,
	getLatestByDTag,
	publishWithQuorum,
} from '../../src/lib/relay';
import type { NostrEvent } from '../../src/lib/types';

describe('Relay Module', () => {
	describe('createRelayPool', () => {
		it('creates a pool with given relay URLs', () => {
			const relays = ['wss://relay1.test', 'wss://relay2.test'];
			const pool = createRelayPool(relays);

			expect(pool).toBeDefined();
			expect(pool.relays).toEqual(relays);
		});

		it('creates pool with empty relay list', () => {
			const pool = createRelayPool([]);
			expect(pool.relays).toEqual([]);
		});

		it('creates pool with rate limiting enabled by default', () => {
			const relays = ['wss://relay1.test'];
			const pool = createRelayPool(relays);

			// Pool should have resetRateLimiter method
			expect(pool.resetRateLimiter).toBeDefined();
			expect(typeof pool.resetRateLimiter).toBe('function');
		});

		it('accepts custom rate limiter via options', () => {
			const customLimiter = new RateLimiter(5, 500, 50);
			const pool = createRelayPool(['wss://relay1.test'], {
				rateLimiter: customLimiter,
			});

			expect(pool).toBeDefined();
			expect(pool.resetRateLimiter).toBeDefined();
		});

		it('can disable rate limiting via options', () => {
			const pool = createRelayPool(['wss://relay1.test'], {
				enableRateLimiting: false,
			});

			expect(pool).toBeDefined();
		});

		it('can disable retry via options', () => {
			const pool = createRelayPool(['wss://relay1.test'], {
				enableRetry: false,
			});

			expect(pool).toBeDefined();
		});

		it('can disable both rate limiting and retry', () => {
			const pool = createRelayPool(['wss://relay1.test'], {
				enableRateLimiting: false,
				enableRetry: false,
			});

			expect(pool).toBeDefined();
		});
	});

	describe('publishWithQuorum', () => {
		const event = createMockRumor('proj|env', 1);

		it('reports degraded success after a majority accepts', async () => {
			const report = await publishWithQuorum(
				['wss://one.test', 'wss://two.test', 'wss://three.test'],
				event,
				async (relay) => {
					if (relay === 'wss://three.test') throw new Error('offline');
				},
			);
			expect(report.required).toBe(2);
			expect(report.accepted).toEqual(['wss://one.test', 'wss://two.test']);
			expect(report.failed).toEqual([{ relay: 'wss://three.test', reason: 'offline' }]);
		});

		it('throws a typed report when partial acceptance is below quorum', async () => {
			const operation = publishWithQuorum(
				['wss://one.test', 'wss://two.test', 'wss://three.test'],
				event,
				async (relay) => {
					if (relay !== 'wss://one.test') throw new Error(`rejected ${relay}`);
				},
			);
			try {
				await operation;
				throw new Error('Expected quorum failure');
			} catch (error) {
				expect(error).toBeInstanceOf(PublishQuorumError);
				if (!(error instanceof PublishQuorumError)) return;
				expect(error.report.eventId).toBe(event.id);
				expect(error.report.accepted).toEqual(['wss://one.test']);
				expect(error.report.failed).toHaveLength(2);
			}
		});

		it('fails closed for an empty relay set', async () => {
			await expect(publishWithQuorum([], event, async () => {})).rejects.toBeInstanceOf(
				PublishQuorumError,
			);
		});
	});

	describe('filterGiftWraps', () => {
		it('creates correct filter for gift wrap events', () => {
			const pubkey = 'abc123pubkey';
			const filter = filterGiftWraps(pubkey);

			expect(filter.kinds).toEqual([1059]); // Gift Wrap kind
			expect(filter['#p']).toEqual([pubkey]);
		});

		it('includes since timestamp when provided', () => {
			const pubkey = 'abc123';
			const since = 1700000000;
			const filter = filterGiftWraps(pubkey, since);

			expect(filter.since).toBe(since);
		});
	});

	describe('getLatestByDTag', () => {
		it('returns latest event for each d-tag', () => {
			const events = [
				createMockRumor('proj1|dev', 1000),
				createMockRumor('proj1|dev', 2000), // Latest for proj1|dev
				createMockRumor('proj1|prod', 1500),
				createMockRumor('proj2|dev', 3000),
			];

			const latest = getLatestByDTag(events);

			expect(Object.keys(latest).length).toBe(3);
			expect(latest['proj1|dev']?.created_at).toBe(2000);
			expect(latest['proj1|prod']?.created_at).toBe(1500);
			expect(latest['proj2|dev']?.created_at).toBe(3000);
		});

		it('returns empty object for empty input', () => {
			const latest = getLatestByDTag([]);
			expect(latest).toEqual({});
		});

		it('handles events without d-tag', () => {
			const events = [
				createMockRumor('proj1|dev', 1000),
				{ ...createMockRumor('', 2000), tags: [] }, // No d-tag
			];

			const latest = getLatestByDTag(events);

			expect(Object.keys(latest).length).toBe(1);
			expect(latest['proj1|dev']).toBeDefined();
		});

		it('correctly identifies newer event regardless of array order', () => {
			const events = [
				createMockRumor('proj|env', 5000), // Newer but first
				createMockRumor('proj|env', 1000), // Older but second
			];

			const latest = getLatestByDTag(events);

			expect(latest['proj|env']?.created_at).toBe(5000);
		});

		it('selects the lexicographically lowest ID for equal timestamps regardless of order', () => {
			const lower = { ...createMockRumor('proj|env', 5000), id: '0'.repeat(64) };
			const higher = { ...createMockRumor('proj|env', 5000), id: 'f'.repeat(64) };

			expect((getLatestByDTag([higher, lower])['proj|env'] as NostrEvent | undefined)?.id).toBe(
				lower.id,
			);
			expect((getLatestByDTag([lower, higher])['proj|env'] as NostrEvent | undefined)?.id).toBe(
				lower.id,
			);
		});
	});
});

// Helper to create mock rumor events
function createMockRumor(dTag: string, createdAt: number): NostrEvent {
	return {
		id: `event-${dTag}-${createdAt}`,
		pubkey: 'testpubkey',
		created_at: createdAt,
		kind: 30078,
		tags: dTag ? [['d', dTag]] : [],
		content: JSON.stringify({ SECRET: 'value' }),
		sig: 'testsig',
	};
}
