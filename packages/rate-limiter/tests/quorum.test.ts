import { describe, expect, it } from 'bun:test';
import {
	classifyQuorumFailure,
	executeWithQuorum,
	getUnavailableTargets,
	mergeQuorumReports,
	parseNip20Reason,
	sanitizeRelayReason,
	QuorumError,
} from '../src';

describe('executeWithQuorum', () => {
	it('returns per-target outcomes after majority success', async () => {
		const report = await executeWithQuorum(['one', 'two', 'three'], 'event-id', async (target) => {
			if (target === 'three') throw new Error('offline');
		});
		expect(report).toEqual({
			operationId: 'event-id',
			required: 2,
			accepted: ['one', 'two'],
			failed: [{ target: 'three', reason: 'offline' }],
			outcomes: [
				{ target: 'one', state: 'accepted' },
				{ target: 'two', state: 'accepted' },
				{ target: 'three', state: 'unavailable', reason: 'offline' },
			],
		});
	});

	it('throws a typed report below quorum and fails closed with no targets', async () => {
		await expect(
			executeWithQuorum(['one', 'two', 'three'], 'event-id', async (target) => {
				if (target !== 'one') throw new Error('rejected');
			}),
		).rejects.toBeInstanceOf(QuorumError);
		await expect(executeWithQuorum([], 'event-id', async () => {})).rejects.toBeInstanceOf(
			QuorumError,
		);
	});

	it('classifies exact NIP-20 permanent and transient reason prefixes', () => {
		for (const code of ['invalid', 'pow', 'blocked', 'restricted']) {
			expect(classifyQuorumFailure(new Error(`${code}: policy`))).toBe('rejected');
		}
		for (const reason of [
			'rate-limited: later',
			'error: relay fault',
			'duplicate: content already exists',
			'timeout',
			'contains blocked but is not a typed reason',
		]) {
			expect(classifyQuorumFailure(new Error(reason))).toBe('unavailable');
		}
		expect(parseNip20Reason(new Error(' restricted: private relay '))).toEqual({
			code: 'restricted',
			message: 'private relay',
		});
		expect(parseNip20Reason(new Error('not-a-code: blocked'))).toEqual({
			code: 'unknown',
			message: 'not-a-code: blocked',
		});
	});

	it('selects only unavailable targets', async () => {
		const report = await executeWithQuorum(
			['accepted', 'rejected', 'unavailable'],
			'event-id',
			async (target) => {
				if (target === 'rejected') throw new Error('restricted: private relay');
				if (target === 'unavailable') throw new Error('timeout');
			},
			1,
		);
		expect(getUnavailableTargets(report)).toEqual(['unavailable']);
	});

	it('merges retry outcomes deterministically without changing the original threshold', async () => {
		const previous = await executeWithQuorum(
			['accepted', 'rejected', 'unavailable'],
			'event-id',
			async (target) => {
				if (target === 'rejected') throw new Error('restricted: private relay');
				if (target === 'unavailable') throw new Error('timeout');
			},
			1,
		);
		const retry = await executeWithQuorum(['unavailable'], 'event-id', async () => {}, 1);
		const merged = mergeQuorumReports(previous, retry);
		expect(merged.required).toBe(1);
		expect(merged.outcomes).toEqual([
			{ target: 'accepted', state: 'accepted' },
			{ target: 'rejected', state: 'rejected', reason: 'restricted: private relay' },
			{ target: 'unavailable', state: 'accepted' },
		]);
		expect(merged.accepted).toEqual(['accepted', 'unavailable']);
		expect(merged.failed).toEqual([{ target: 'rejected', reason: 'restricted: private relay' }]);
	});

	it('never lets stale retry reports replace accepted or rejected outcomes', async () => {
		const accepted = await executeWithQuorum(['one'], 'event-id', async () => {});
		const staleAccepted = await executeWithQuorum(['one'], 'event-id', async () => {});
		expect(() => mergeQuorumReports(accepted, staleAccepted)).toThrow('no longer unavailable');

		const rejected = await executeWithQuorum(
			['one', 'two'],
			'event-id',
			async (target) => {
				if (target === 'two') throw new Error('restricted: policy');
			},
			1,
		);
		const retryRejected = await executeWithQuorum(['two'], 'event-id', async () => {});
		expect(() => mergeQuorumReports(rejected, retryRejected)).toThrow('no longer unavailable');
	});

	it('escapes terminal control characters in relay reasons', async () => {
		expect(sanitizeRelayReason('blocked: line\n\u001b]0;owned\u0007')).toBe(
			'blocked: line\\u000a\\u001b]0;owned\\u0007',
		);
		const report = await executeWithQuorum(
			['one', 'two'],
			'event-id',
			async (target) => {
				if (target === 'two') throw new Error('error: bad\n\u001b[31m');
			},
			1,
		);
		expect(report.failed[0]?.reason).toBe('error: bad\\u000a\\u001b[31m');
	});

	it('rejects report merges for different operations or unknown targets', async () => {
		const previous = await executeWithQuorum(['one'], 'event-id', async () => {});
		const otherEvent = await executeWithQuorum(['one'], 'other-id', async () => {});
		const unknownTarget = await executeWithQuorum(['two'], 'event-id', async () => {});
		expect(() => mergeQuorumReports(previous, otherEvent)).toThrow('operation IDs');
		expect(() => mergeQuorumReports(previous, unknownTarget)).toThrow('unknown target');
	});
});
