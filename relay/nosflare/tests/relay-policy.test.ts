import { describe, expect, it } from 'bun:test';
import {
	authorizeEventWrite,
	authorizeReadFilters,
	getRedshiftRecipient,
	normalizeAuthRelayUrl,
} from '../src/relay-policy';
import type { NostrEvent, NostrFilter } from '../src/types';

const principal = 'a'.repeat(64);
const other = 'b'.repeat(64);

function event(tags: string[][], kind = 1059, pubkey = other): NostrEvent {
	return {
		id: 'c'.repeat(64),
		pubkey,
		created_at: 1,
		kind,
		tags,
		content: 'ciphertext',
		sig: 'd'.repeat(128),
	};
}

const scopedFilter = (): NostrFilter => ({
	kinds: [1059],
	'#p': [principal],
	'#t': ['redshift-secrets'],
});

describe('managed relay policy', () => {
	it('uses the sole typed Gift Wrap recipient as the account principal', () => {
		const giftWrap = event([
			['p', principal],
			['t', 'redshift-secrets'],
		]);
		expect(getRedshiftRecipient(giftWrap)).toBe(principal);
		expect(authorizeEventWrite(giftWrap, principal)).toEqual({
			allowed: true,
			principal,
		});
	});

	it('rejects missing, duplicate, malformed, and cross-recipient Gift Wraps', () => {
		const tagSets = [
			[['t', 'redshift-secrets']],
			[
				['p', principal],
				['p', principal],
				['t', 'redshift-secrets'],
			],
			[
				['p', 'bad'],
				['t', 'redshift-secrets'],
			],
			[['p', principal]],
			[
				['p', other],
				['t', 'redshift-secrets'],
			],
		];
		for (const tags of tagSets) {
			expect(authorizeEventWrite(event(tags), principal).allowed).toBe(false);
		}
	});

	it('rejects direct plaintext secret events', () => {
		expect(authorizeEventWrite(event([], 30078, principal), principal).allowed).toBe(false);
	});

	it('requires every read filter to scope kind, principal, and type', () => {
		expect(authorizeReadFilters([scopedFilter()], principal).allowed).toBe(true);
		for (const filter of [
			{},
			{ ...scopedFilter(), kinds: [1059, 1] },
			{ ...scopedFilter(), '#p': [other] },
			{ ...scopedFilter(), '#t': ['other'] },
		]) {
			expect(authorizeReadFilters([filter], principal).allowed).toBe(false);
		}
	});

	it('normalizes exact AUTH relay URLs and rejects ambiguous forms', () => {
		expect(normalizeAuthRelayUrl('wss://relay.example/path')).toBe('wss://relay.example/path');
		expect(normalizeAuthRelayUrl('https://relay.example')).toBeNull();
		expect(normalizeAuthRelayUrl('wss://user:pass@relay.example')).toBeNull();
		expect(normalizeAuthRelayUrl('wss://relay.example/?query=x')).toBeNull();
	});
});
