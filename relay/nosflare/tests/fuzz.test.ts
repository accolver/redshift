import { describe, expect, it } from 'bun:test';
import fc from 'fast-check';
import { finalizeEvent } from 'nostr-tools/pure';
import { fuzzParameters, syntheticString } from '../../../tests/helpers/fuzz';
import { isNostrEvent, verifyEventSignature } from '../src/event-verifier';
import {
	authorizeEventWrite,
	authorizeReadFilters,
	getRedshiftRecipient,
	normalizeAuthRelayUrl,
} from '../src/relay-policy';
import type { NostrEvent, NostrFilter } from '../src/types';

const principal = 'a'.repeat(64);
const other = 'b'.repeat(64);
const fixedPrivateKey = new Uint8Array(32).fill(9);
const tags = fc.array(fc.array(syntheticString({ maxLength: 16 }), { maxLength: 4 }), {
	maxLength: 8,
});
const nearValidReadFilter = fc.record({
	kinds: fc.constantFrom<unknown>([1059], [], [1], [1059, 1059], [1059, 1], '1059', null),
	recipients: fc.constantFrom<unknown>(
		[principal],
		[],
		[other],
		[principal, principal],
		[principal, other],
		principal,
		null,
	),
	types: fc.constantFrom<unknown>(
		['redshift-secrets'],
		[],
		['other'],
		['redshift-secrets', 'other'],
		'redshift-secrets',
		null,
	),
	extra: fc.option(fc.jsonValue()),
});

function readFiltersAllowed(filters: unknown, authenticatedPrincipal: string | undefined): boolean {
	if (!authenticatedPrincipal || !Array.isArray(filters) || filters.length === 0) return false;
	return filters.every((value) => {
		if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
		const filter = value as Record<string, unknown>;
		return (
			Array.isArray(filter.kinds) &&
			filter.kinds.length === 1 &&
			filter.kinds[0] === 1059 &&
			Array.isArray(filter['#p']) &&
			filter['#p'].length === 1 &&
			filter['#p'][0] === authenticatedPrincipal &&
			Array.isArray(filter['#t']) &&
			filter['#t'].length === 1 &&
			filter['#t'][0] === 'redshift-secrets'
		);
	});
}

function eventWithTags(eventTags: string[][]): NostrEvent {
	return {
		id: 'c'.repeat(64),
		pubkey: other,
		created_at: 1,
		kind: 1059,
		tags: eventTags,
		content: 'ciphertext',
		sig: 'd'.repeat(128),
	};
}

describe('managed relay property tests', () => {
	it('never accepts or throws for arbitrary JSON event shapes', async () => {
		await fc.assert(
			fc.asyncProperty(fc.jsonValue(), async (value) => {
				expect(() => isNostrEvent(value)).not.toThrow();
				if (isNostrEvent(value)) {
					expect(value.id).toMatch(/^[0-9a-f]{64}$/);
					expect(value.pubkey).toMatch(/^[0-9a-f]{64}$/);
					expect(value.sig).toMatch(/^[0-9a-f]{128}$/);
				} else {
					expect(await verifyEventSignature(value as unknown as NostrEvent)).toBe(false);
				}
			}),
			fuzzParameters('relay arbitrary event shape'),
		);
	});

	it('verifies generated canonical events and rejects any content mutation', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.nat({ max: 2_000_000_000 }),
				fc.nat({ max: 65_535 }),
				tags,
				syntheticString({ maxLength: 256 }),
				async (createdAt, kind, eventTags, content) => {
					const event = finalizeEvent(
						{ kind, created_at: createdAt, tags: eventTags, content },
						fixedPrivateKey,
					) as NostrEvent;
					expect(await verifyEventSignature(event)).toBe(true);
					expect(await verifyEventSignature({ ...event, content: `${content}\0` })).toBe(false);
				},
			),
			fuzzParameters('relay canonical signature verification', { defaultRuns: 75 }),
		);
	}, 120_000);

	it('recognizes only one canonical recipient and one exact Redshift type tag', () => {
		fc.assert(
			fc.property(tags, (eventTags) => {
				const event = eventWithTags(eventTags);
				const recipient = getRedshiftRecipient(event);
				const recipientTags = eventTags.filter((tag) => tag[0] === 'p');
				const typeTags = eventTags.filter((tag) => tag[0] === 't' && tag[1] === 'redshift-secrets');
				const expected =
					recipientTags.length === 1 &&
					typeTags.length === 1 &&
					/^[0-9a-f]{64}$/.test(recipientTags[0]?.[1] ?? '')
						? (recipientTags[0]?.[1] ?? null)
						: null;
				expect(recipient).toBe(expected);
				expect(authorizeEventWrite(event, principal).allowed).toBe(expected === principal);
			}),
			fuzzParameters('relay exact recipient and type tags'),
		);
	});

	it('fails closed without throwing for arbitrary JSON read filters', () => {
		fc.assert(
			fc.property(fc.array(fc.jsonValue(), { maxLength: 8 }), (values) => {
				let decision: ReturnType<typeof authorizeReadFilters> | undefined;
				expect(() => {
					decision = authorizeReadFilters(values, principal);
				}).not.toThrow();
				expect(decision?.allowed).toBe(readFiltersAllowed(values, principal));
			}),
			fuzzParameters('relay arbitrary read filters'),
		);
	});

	it('accepts only exact recipient-scoped filters across near-valid mutations', () => {
		fc.assert(
			fc.property(
				fc.array(nearValidReadFilter, { minLength: 1, maxLength: 8 }),
				fc.boolean(),
				(filters, authenticated) => {
					const values: NostrFilter[] = filters.map((filter) => ({
						kinds: filter.kinds,
						'#p': filter.recipients,
						'#t': filter.types,
						...(filter.extra === null ? {} : { extra: filter.extra }),
					})) as NostrFilter[];
					const currentPrincipal = authenticated ? principal : undefined;
					const decision = authorizeReadFilters(values, currentPrincipal);
					const expected = readFiltersAllowed(values, currentPrincipal);
					expect(decision.allowed).toBe(expected);
					if (expected) expect(decision).toEqual({ allowed: true, principal });
				},
			),
			fuzzParameters('relay exact and near-valid scoped filters'),
		);
	});

	it('normalizes only unambiguous WebSocket relay URLs', () => {
		fc.assert(
			fc.property(syntheticString({ maxLength: 512 }), (value) => {
				expect(() => normalizeAuthRelayUrl(value)).not.toThrow();
				const normalized = normalizeAuthRelayUrl(value);
				if (normalized !== null) {
					const parsed = new URL(normalized);
					expect(['ws:', 'wss:']).toContain(parsed.protocol);
					expect(parsed.username).toBe('');
					expect(parsed.password).toBe('');
					expect(parsed.search).toBe('');
					expect(parsed.hash).toBe('');
					expect(parsed.href).toBe(normalized);
				}
			}),
			fuzzParameters('relay URL normalization'),
		);
	});
});
