import { afterEach, describe, expect, it, mock } from 'bun:test';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { recoveryCommand } from '../../src/commands/recovery';
import {
	createProvisionalRecoveryRecord,
	updateRecoveryRecord,
} from '../../src/lib/publication-recovery';
import type { RecoveryRecord } from '../../src/lib/publication-recovery';
import type { PublishReport } from '../../src/lib/relay';
import { SecretManager } from '../../src/lib/secret-manager';

const originalLog = console.log;
afterEach(() => {
	console.log = originalLog;
	process.exitCode = 0;
});

async function fixture(states: Array<'accepted' | 'rejected' | 'unavailable'>) {
	const privateKey = generateSecretKey();
	const ownerPubkey = getPublicKey(privateKey);
	const manager = new SecretManager(privateKey);
	const { event } = await manager.wrapSecrets({ KEY: 'value' }, 'project|dev');
	await manager.close();
	const relays = states.map((_, index) => `wss://${index + 1}.test`);
	const provisional = createProvisionalRecoveryRecord({
		ownerPubkey,
		project: 'project',
		environment: 'dev',
		event,
		relays,
	});
	const outcomes = provisional.report.outcomes.map((outcome, index) => ({
		...outcome,
		state: states[index] ?? 'unavailable',
		...(states[index] === 'accepted'
			? { reason: undefined }
			: { reason: states[index] === 'rejected' ? 'restricted: policy' : 'timeout' }),
	}));
	const report: PublishReport = {
		eventId: event.id,
		required: Math.floor(states.length / 2) + 1,
		accepted: outcomes.filter(({ state }) => state === 'accepted').map(({ relay }) => relay),
		failed: outcomes
			.filter(({ state }) => state !== 'accepted')
			.map(({ relay, reason }) => ({ relay, reason: reason ?? 'unknown' })),
		outcomes: outcomes.map(({ relay, state, reason }) => ({
			relay,
			state,
			...(reason === undefined ? {} : { reason }),
		})),
	};
	return { privateKey, record: updateRecoveryRecord(provisional, report) };
}

describe('recovery command', () => {
	it('lists and shows classified per-relay outcomes without plaintext content', async () => {
		const { record } = await fixture(['accepted', 'rejected', 'unavailable']);
		const lines: string[] = [];
		console.log = (...values: unknown[]) => lines.push(values.join(' '));
		const deps = {
			listRecords: async () => [record],
			loadRecord: async () => record,
		};
		await recoveryCommand({ subcommand: 'list' }, deps);
		await recoveryCommand({ subcommand: 'show', eventId: record.event.id }, deps);
		const output = lines.join('\n');
		expect(output).toContain(record.event.id);
		expect(output).toContain('accepted');
		expect(output).toContain('rejected');
		expect(output).toContain('unavailable');
		expect(output).not.toContain(record.event.content);
	});

	it('retries only unavailable relays with the exact event and retains permanent rejection', async () => {
		const { record } = await fixture(['accepted', 'rejected', 'unavailable']);
		let saved: RecoveryRecord | null = null;
		const removed = mock(async () => {});
		const retried = mock(async (event, relays: string[]) => {
			expect(event).toEqual(record.event);
			expect(relays).toEqual(['wss://3.test/']);
			return {
				eventId: event.id,
				required: 1,
				accepted: relays,
				failed: [],
				outcomes: relays.map((relay) => ({ relay, state: 'accepted' as const })),
			};
		});
		await recoveryCommand(
			{ subcommand: 'retry', eventId: record.event.id },
			{
				loadRecord: async () => record,
				requireCurrentAuth: async () => ({ pubkey: record.ownerPubkey }),
				createManager: () => ({
					getPublicKey: () => record.ownerPubkey,
					unwrapWithMetadata: async () => ({ dTag: 'project|dev' }),
					connect: () => {},
					retryPublication: retried,
					close: async () => {},
				}),
				saveRecord: async (value) => {
					saved = value;
				},
				removeRecord: removed,
			},
		);
		expect(retried).toHaveBeenCalledTimes(1);
		expect((saved as RecoveryRecord | null)?.report.outcomes.map(({ state }) => state)).toEqual([
			'accepted',
			'rejected',
			'accepted',
		]);
		expect(removed).not.toHaveBeenCalled();
	});

	it('returns a failure status when retry resolves unavailable relays into permanent rejection below quorum', async () => {
		const { record } = await fixture(['accepted', 'unavailable', 'unavailable']);
		await recoveryCommand(
			{ subcommand: 'retry', eventId: record.event.id },
			{
				loadRecord: async () => record,
				requireCurrentAuth: async () => ({ pubkey: record.ownerPubkey }),
				createManager: () => ({
					getPublicKey: () => record.ownerPubkey,
					unwrapWithMetadata: async () => ({ dTag: 'project|dev' }),
					connect: () => {},
					retryPublication: async (_event, relays) => ({
						eventId: record.event.id,
						required: 2,
						accepted: [],
						failed: relays.map((relay) => ({ relay, reason: 'restricted: policy' })),
						outcomes: relays.map((relay) => ({
							relay,
							state: 'rejected' as const,
							reason: 'restricted: policy',
						})),
					}),
					close: async () => {},
				}),
				saveRecord: async () => {},
				removeRecord: async () => {},
			},
		);
		expect(process.exitCode).toBe(1);
	});

	it('returns a failure status for a persisted terminal record below quorum', async () => {
		const { record } = await fixture(['accepted', 'rejected', 'rejected']);
		await recoveryCommand(
			{ subcommand: 'retry', eventId: record.event.id },
			{
				loadRecord: async () => record,
				requireCurrentAuth: async () => ({ pubkey: record.ownerPubkey }),
				createManager: () => ({
					getPublicKey: () => record.ownerPubkey,
					unwrapWithMetadata: async () => ({ dTag: 'project|dev' }),
					connect: () => {
						throw new Error('must not connect without unavailable relays');
					},
					retryPublication: async () => {
						throw new Error('must not retry without unavailable relays');
					},
					close: async () => {},
				}),
			},
		);
		expect(process.exitCode).toBe(1);
	});

	it('refuses a different owner before unwrap or publication', async () => {
		const { record } = await fixture(['accepted', 'unavailable']);
		const createManager = mock(() => {
			throw new Error('must not create manager');
		});
		await expect(
			recoveryCommand(
				{ subcommand: 'retry', eventId: record.event.id },
				{
					loadRecord: async () => record,
					requireCurrentAuth: async () => ({ pubkey: 'f'.repeat(64) }),
					createManager,
				},
			),
		).rejects.toThrow('different identity');
		expect(createManager).not.toHaveBeenCalled();
	});

	it('removes only local state without authentication or publication', async () => {
		const { record } = await fixture(['accepted', 'unavailable']);
		const removeRecord = mock(async () => {});
		await recoveryCommand({ subcommand: 'remove', eventId: record.event.id }, { removeRecord });
		expect(removeRecord).toHaveBeenCalledWith(record.event.id);
	});
});
