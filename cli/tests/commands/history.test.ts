import { afterEach, describe, expect, it, mock } from 'bun:test';
import { historyCommand } from '../../src/commands/history';
import type { SecretHistoryObservation, SecretHistoryVersion } from '../../src/lib/crypto';
import type { PublishReport } from '../../src/lib/relay';
import type { SecretPublication } from '../../src/lib/secret-manager';
import type { NostrEvent, SecretBundle } from '../../src/lib/types';

const originalLog = console.log;
const originalError = console.error;

afterEach(() => {
	console.log = originalLog;
	console.error = originalError;
});

const ids = {
	current: 'a'.repeat(64),
	older: 'b'.repeat(64),
	tombstone: 'c'.repeat(64),
	concurrent: 'd'.repeat(64),
	published: 'e'.repeat(64),
};

function version(
	eventId: string,
	createdAt: number,
	secrets: SecretBundle,
	current = false,
): SecretHistoryVersion {
	return {
		eventId,
		createdAt,
		dTag: 'project|dev',
		secrets,
		tombstone: Object.keys(secrets).length === 0,
		current,
	};
}

function observation(): SecretHistoryObservation {
	return {
		versions: [
			version(ids.current, 103, { API_KEY: 'current-secret', SHARED: 'same' }, true),
			version(ids.older, 102, { API_KEY: 'older-secret', OLD_ONLY: 'removed', SHARED: 'same' }),
			version(ids.tombstone, 101, {}),
		],
		observedEvents: 4,
		truncated: false,
	};
}

function report(
	eventId: string,
	states: Array<'accepted' | 'rejected' | 'unavailable'>,
): PublishReport {
	const outcomes = states.map((state, index) => ({
		relay: `wss://${index + 1}.test/`,
		state,
		...(state === 'accepted' ? {} : { reason: state === 'rejected' ? 'policy' : 'timeout' }),
	}));
	return {
		eventId,
		required: Math.floor(states.length / 2) + 1,
		accepted: outcomes.filter(({ state }) => state === 'accepted').map(({ relay }) => relay),
		failed: outcomes
			.filter(({ state }) => state !== 'accepted')
			.map(({ relay, reason }) => ({ relay, reason: reason ?? 'unknown' })),
		outcomes,
	};
}

function dependencies(overrides: Record<string, unknown> = {}) {
	let publication: SecretPublication | null = null;
	const publishSecrets = mock(
		async (
			_project: string,
			_environment: string,
			_secrets: SecretBundle,
			options?: { createdAt?: number },
		) => {
			const event = {
				id: ids.published,
				pubkey: 'f'.repeat(64),
				created_at: options?.createdAt ?? 0,
				kind: 1059,
				tags: [],
				content: 'encrypted',
				sig: '0'.repeat(128),
			} satisfies NostrEvent;
			publication = { event, report: report(event.id, ['accepted', 'accepted', 'unavailable']) };
			return event;
		},
	);
	const manager = {
		getPublicKey: () => 'f'.repeat(64),
		connect: () => {},
		fetchSecretHistory: async () => observation(),
		publishSecrets,
		getLastPublication: () => publication,
		close: async () => {},
	};
	return {
		manager,
		publishSecrets,
		deps: {
			loadProjectConfig: async () => null,
			requireCurrentAuth: async () => ({ pubkey: 'f'.repeat(64), npub: 'npub1test' }),
			getRelayUrls: async () => ['wss://1.test/'],
			createManager: () => manager,
			now: () => 150,
			...overrides,
		},
	};
}

describe('history command', () => {
	it('lists only deterministic observed metadata with pagination and truncation', async () => {
		const lines: string[] = [];
		console.log = (...values: unknown[]) => lines.push(values.join(' '));
		const { deps, manager } = dependencies();
		manager.fetchSecretHistory = async () => ({ ...observation(), truncated: true });
		await historyCommand(
			{ subcommand: 'list', project: 'project', environment: 'dev', limit: 2, json: true },
			deps,
		);
		const output = lines.join('\n');
		const parsed = JSON.parse(output) as {
			versions: Array<Record<string, unknown>>;
			truncated: boolean;
			nextCursor: string;
		};
		expect(parsed.versions).toHaveLength(2);
		expect(parsed.versions[0]).toMatchObject({
			eventId: ids.current,
			current: true,
			tombstone: false,
			keyCount: 2,
		});
		expect(parsed.truncated).toBe(true);
		expect(parsed.nextCursor).toBe(`v1.102.${ids.older}`);
		expect(output).not.toContain('current-secret');
		expect(output).not.toContain('older-secret');
	});

	it('compares exact authenticated versions by key metadata without values', async () => {
		const lines: string[] = [];
		console.log = (...values: unknown[]) => lines.push(values.join(' '));
		const { deps } = dependencies();
		await historyCommand(
			{
				subcommand: 'compare',
				project: 'project',
				environment: 'dev',
				fromEventId: ids.older,
				toEventId: ids.current,
				json: true,
			},
			deps,
		);
		const output = lines.join('\n');
		expect(JSON.parse(output)).toMatchObject({
			fromEventId: ids.older,
			toEventId: ids.current,
			added: [],
			removed: ['OLD_ONLY'],
			changed: ['API_KEY'],
			unchanged: ['SHARED'],
		});
		expect(output).not.toContain('older-secret');
		expect(output).not.toContain('current-secret');
	});

	it('validates limits, cursors, event IDs, and restore consent before authentication', async () => {
		const requireCurrentAuth = mock(async () => ({
			pubkey: 'f'.repeat(64),
			npub: 'npub1test',
		}));
		const { deps } = dependencies({ requireCurrentAuth });
		await expect(
			historyCommand(
				{ subcommand: 'list', project: 'project', environment: 'dev', limit: 0 },
				deps,
			),
		).rejects.toThrow('between 1 and 100');
		await expect(
			historyCommand(
				{ subcommand: 'list', project: 'project', environment: 'dev', cursor: 'invalid' },
				deps,
			),
		).rejects.toThrow('cursor');
		await expect(
			historyCommand(
				{
					subcommand: 'compare',
					project: 'project',
					environment: 'dev',
					fromEventId: 'A'.repeat(64),
					toEventId: ids.current,
				},
				deps,
			),
		).rejects.toThrow('event ID');
		await expect(
			historyCommand(
				{
					subcommand: 'restore',
					project: 'project',
					environment: 'dev',
					eventId: ids.older,
				},
				deps,
			),
		).rejects.toThrow('--yes');
		expect(requireCurrentAuth).not.toHaveBeenCalled();
	});

	it('blocks restore when either authenticated observation reaches a safety cap', async () => {
		const initial = dependencies();
		initial.manager.fetchSecretHistory = async () => ({ ...observation(), truncated: true });
		await expect(
			historyCommand(
				{
					subcommand: 'restore',
					project: 'project',
					environment: 'dev',
					eventId: ids.older,
					yes: true,
				},
				initial.deps,
			),
		).rejects.toThrow('restore is blocked');
		expect(initial.publishSecrets).not.toHaveBeenCalled();

		const refreshed = dependencies();
		let fetches = 0;
		refreshed.manager.fetchSecretHistory = async () =>
			fetches++ === 0 ? observation() : { ...observation(), truncated: true };
		await expect(
			historyCommand(
				{
					subcommand: 'restore',
					project: 'project',
					environment: 'dev',
					eventId: ids.older,
					yes: true,
				},
				refreshed.deps,
			),
		).rejects.toThrow('restore is blocked');
		expect(refreshed.publishSecrets).not.toHaveBeenCalled();
	});

	it('treats restoring the current event as a confirmed no-op', async () => {
		const { deps, publishSecrets } = dependencies();
		await historyCommand(
			{
				subcommand: 'restore',
				project: 'project',
				environment: 'dev',
				eventId: ids.current,
				yes: true,
			},
			deps,
		);
		expect(publishSecrets).not.toHaveBeenCalled();
	});

	it('aborts when current changed, then allows an explicit complete-bundle overwrite', async () => {
		const concurrentHistory = (): SecretHistoryObservation => ({
			versions: [
				version(ids.concurrent, 200, { CONCURRENT: 'must-be-replaced' }, true),
				...observation().versions.map((item) => ({ ...item, current: false })),
			],
			observedEvents: 4,
			truncated: false,
		});
		const first = dependencies();
		let firstFetches = 0;
		first.manager.fetchSecretHistory = async () =>
			firstFetches++ === 0 ? observation() : concurrentHistory();
		await expect(
			historyCommand(
				{
					subcommand: 'restore',
					project: 'project',
					environment: 'dev',
					eventId: ids.older,
					yes: true,
				},
				first.deps,
			),
		).rejects.toThrow('current changed');
		expect(first.publishSecrets).not.toHaveBeenCalled();

		const second = dependencies();
		let secondFetches = 0;
		second.manager.fetchSecretHistory = async () =>
			secondFetches++ === 0 ? observation() : concurrentHistory();
		await historyCommand(
			{
				subcommand: 'restore',
				project: 'project',
				environment: 'dev',
				eventId: ids.older,
				yes: true,
				overwriteCurrent: true,
			},
			second.deps,
		);
		expect(second.publishSecrets).toHaveBeenCalledWith(
			'project',
			'dev',
			{ API_KEY: 'older-secret', OLD_ONLY: 'removed', SHARED: 'same' },
			{ createdAt: 201 },
		);
	});

	it('restores a tombstone as logical deletion and reports degraded exact-event recovery metadata', async () => {
		const logs: string[] = [];
		const errors: string[] = [];
		console.log = (...values: unknown[]) => logs.push(values.join(' '));
		console.error = (...values: unknown[]) => errors.push(values.join(' '));
		const { deps, publishSecrets } = dependencies();
		await historyCommand(
			{
				subcommand: 'restore',
				project: 'project',
				environment: 'dev',
				eventId: ids.tombstone,
				yes: true,
			},
			deps,
		);
		expect(publishSecrets).toHaveBeenCalledWith('project', 'dev', {}, { createdAt: 150 });
		expect(logs.join('\n')).toContain('logical tombstone');
		expect(errors.join('\n')).toContain(ids.published);
		expect(errors.join('\n')).toContain('recovery show');
		expect(logs.join('\n') + errors.join('\n')).not.toContain('current-secret');
	});
});
