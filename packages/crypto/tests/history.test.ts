import { describe, expect, it } from 'bun:test';
import {
	HISTORY_LIMITS,
	compareSecretHistoryVersions,
	createHistoryCursor,
	createSecretHistoryObservation,
	decodeHistoryCursor,
	paginateSecretHistory,
} from '../src/history';
import {
	MAX_NIP44_CIPHERTEXT_LENGTH,
	validateNip44CiphertextStructure,
	wrapSecrets,
} from '../src/gift-wrap';
import type { UnwrapResult } from '../src/types';

function version(
	eventId: string,
	createdAt: number,
	secrets: Record<string, string>,
	dTag = 'project|dev',
): UnwrapResult {
	return { eventId, createdAt, secrets, dTag, pubkey: 'a'.repeat(64) };
}

const ids = {
	low: `0${'1'.repeat(63)}`,
	middle: `8${'2'.repeat(63)}`,
	high: `f${'3'.repeat(63)}`,
};

describe('authenticated secret history', () => {
	it('deduplicates, orders by logical version, marks current, and preserves tombstones', () => {
		const observation = createSecretHistoryObservation(
			[
				version(ids.high, 101, { API_KEY: 'new' }),
				version(ids.middle, 100, {}),
				version(ids.low, 101, { API_KEY: 'winner' }),
				version(ids.low, 101, { API_KEY: 'winner' }),
			],
			4,
			false,
		);

		expect(observation.versions.map(({ eventId }) => eventId)).toEqual([
			ids.low,
			ids.high,
			ids.middle,
		]);
		expect(observation.versions.map(({ current, tombstone }) => ({ current, tombstone }))).toEqual([
			{ current: true, tombstone: false },
			{ current: false, tombstone: false },
			{ current: false, tombstone: true },
		]);
		expect(observation.observedEvents).toBe(4);
		expect(observation.truncated).toBe(false);
	});

	it('is independent of input order and returns defensive secret copies', () => {
		const source = [
			version(ids.middle, 100, { ZED: 'z', API_KEY: 'one' }),
			version(ids.low, 101, { API_KEY: 'two' }),
		];
		const forward = createSecretHistoryObservation(source, 2, false);
		const reverse = createSecretHistoryObservation([...source].reverse(), 2, false);
		expect(forward).toEqual(reverse);
		forward.versions[0]!.secrets.API_KEY = 'mutated';
		expect(source[1]!.secrets.API_KEY).toBe('two');
	});

	it('rejects work beyond fixed input, key, value, and aggregate bounds', () => {
		const excessiveInput = Array.from(
			{ length: HISTORY_LIMITS.maxObservedEvents + 1 },
			(_, index) => version(index.toString(16).padStart(64, '0'), index, {}),
		);
		expect(() =>
			createSecretHistoryObservation(excessiveInput, excessiveInput.length, true),
		).toThrow('observation bound');
		const excessiveKeys = Object.fromEntries(
			Array.from({ length: HISTORY_LIMITS.maxSecretsPerVersion + 1 }, (_, index) => [
				`KEY_${index}`,
				'value',
			]),
		);
		expect(() =>
			createSecretHistoryObservation([version(ids.low, 1, excessiveKeys)], 1, false),
		).toThrow('key-count bound');
		expect(() =>
			createSecretHistoryObservation(
				[
					version(ids.low, 1, {
						KEY: 'x'.repeat(HISTORY_LIMITS.maxSecretValueBytes + 1),
					}),
				],
				1,
				false,
			),
		).toThrow('byte bound');
	});

	it('caps per-d-tag versions and preserves an outer observation truncation marker', () => {
		const versions = Array.from({ length: HISTORY_LIMITS.maxVersionsPerDTag + 5 }, (_, index) =>
			version(index.toString(16).padStart(64, '0'), 10_000 - index, { KEY: String(index) }),
		);
		const capped = createSecretHistoryObservation(versions, versions.length, false);
		expect(capped.versions).toHaveLength(HISTORY_LIMITS.maxVersionsPerDTag);
		expect(capped.truncated).toBe(true);
		const outer = createSecretHistoryObservation(versions.slice(0, 2), 1_000, true);
		expect(outer.truncated).toBe(true);
	});

	it('paginates after an exact stable cursor without duplicates', () => {
		const observation = createSecretHistoryObservation(
			[
				version(ids.low, 103, { A: '1' }),
				version(ids.middle, 102, { B: '2' }),
				version(ids.high, 101, { C: '3' }),
			],
			3,
			false,
		);
		const first = paginateSecretHistory(observation, { limit: 2 });
		expect(first.items.map(({ eventId }) => eventId)).toEqual([ids.low, ids.middle]);
		expect(first.nextCursor).toBe(createHistoryCursor(observation.versions[1]!));
		const second = paginateSecretHistory(observation, {
			limit: 2,
			cursor: first.nextCursor ?? undefined,
		});
		expect(second.items.map(({ eventId }) => eventId)).toEqual([ids.high]);
		expect(second.nextCursor).toBeNull();
	});

	it('rejects malformed, excessive, unknown, and stale cursors and limits', () => {
		const observation = createSecretHistoryObservation([version(ids.low, 1, { A: '1' })], 1, false);
		for (const cursor of [
			'',
			'v2.1.' + ids.low,
			'v1.-1.' + ids.low,
			'v1.1.' + 'a'.repeat(64).toUpperCase(),
			'v1.1.' + ids.high,
		]) {
			expect(() => paginateSecretHistory(observation, { limit: 1, cursor })).toThrow();
		}
		for (const limit of [0, 101, 1.5]) {
			expect(() => paginateSecretHistory(observation, { limit })).toThrow();
		}
		expect(() => decodeHistoryCursor(`v1.1.${ids.low}.trailing`)).toThrow();
	});

	it('compares key presence and values without returning values', () => {
		const older = version(ids.middle, 100, {
			UNCHANGED: 'same',
			CHANGED: 'old-value',
			REMOVED: 'removed-value',
		});
		const newer = version(ids.low, 101, {
			UNCHANGED: 'same',
			CHANGED: 'new-value',
			ADDED: 'added-value',
		});
		const diff = compareSecretHistoryVersions(older, newer);
		expect(diff).toEqual({
			added: ['ADDED'],
			removed: ['REMOVED'],
			changed: ['CHANGED'],
			unchanged: ['UNCHANGED'],
		});
		expect(JSON.stringify(diff)).not.toContain('old-value');
		expect(JSON.stringify(diff)).not.toContain('new-value');
		expect(JSON.stringify(diff)).not.toContain('added-value');
	});

	it('validates NIP-44 structure locally before remote signer use', () => {
		const privateKey = new Uint8Array(32).fill(7);
		const { event } = wrapSecrets({ KEY: 'value' }, privateKey, 'project|dev');
		expect(() => validateNip44CiphertextStructure(event.content)).not.toThrow();
		for (const payload of [
			'',
			'#'.repeat(132),
			'A'.repeat(132),
			'A'.repeat(MAX_NIP44_CIPHERTEXT_LENGTH + 4),
			`${'!'.repeat(131)}=`,
		]) {
			expect(() => validateNip44CiphertextStructure(payload)).toThrow('NIP-44 ciphertext');
		}
	});

	it('rejects mixed owners and inconsistent duplicate IDs', () => {
		const first = version(ids.low, 100, { KEY: 'one' });
		const otherOwner = { ...version(ids.middle, 101, { KEY: 'two' }), pubkey: 'b'.repeat(64) };
		expect(() => createSecretHistoryObservation([first, otherOwner], 2, false)).toThrow(
			'authenticated owner',
		);
		expect(() =>
			createSecretHistoryObservation(
				[first, { ...first, secrets: { KEY: 'inconsistent' } }],
				2,
				false,
			),
		).toThrow('inconsistent authenticated state');
	});

	it('reports tombstone removals and rejects cross-d-tag comparisons', () => {
		const live = version(ids.middle, 100, { API_KEY: 'secret', TOKEN: 'token' });
		const tombstone = version(ids.low, 101, {});
		expect(compareSecretHistoryVersions(live, tombstone)).toEqual({
			added: [],
			removed: ['API_KEY', 'TOKEN'],
			changed: [],
			unchanged: [],
		});
		expect(() =>
			compareSecretHistoryVersions(live, version(ids.high, 102, {}, 'other|dev')),
		).toThrow('same d-tag');
	});
});
