import { describe, expect, it } from 'bun:test';
import { executeWithQuorum, QuorumError } from '../src';

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
});
