/**
 * Relay Module Tests - TDD
 *
 * L4: Integration-Contractor - Nostr relay communication
 */

import { describe, expect, it } from 'bun:test';
import { createRelayPool, filterGiftWraps, getLatestByDTag } from '../../src/lib/relay';
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
