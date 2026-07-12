import { afterEach, describe, expect, it, mock } from 'bun:test';
import type { BackupPayloadV1 } from '@redshift/crypto';
import { backupCommand, buildBackupPayload } from '../../src/commands/backup';
import type { BackupCommandDependencies, BackupManager } from '../../src/commands/backup';
import { BackupError } from '../../src/lib/errors';
import type { SecretStateSnapshot } from '../../src/lib/secret-manager';

const sourcePubkey = 'a'.repeat(64);
const targetPubkey = 'b'.repeat(64);
const archive = new Uint8Array([1, 2, 3]);
const originalLog = console.log;
const originalError = console.error;

afterEach(() => {
	console.log = originalLog;
	console.error = originalError;
	process.exitCode = 0;
});

function payload(): BackupPayloadV1 {
	return {
		schema: 'com.redshiftapp.backup',
		version: 1,
		createdAt: 100,
		sourcePubkey,
		contents: {
			secretState: 'current-observed',
			projectMetadata: 'identifiers-only',
			relayConfiguration: 'excluded',
			signerCredentials: 'excluded',
			historyAndTombstones: 'excluded',
		},
		entries: [
			{
				project: 'alpha',
				environment: 'dev',
				sourceCreatedAt: 90,
				sourceEventId: 'c'.repeat(64),
				secrets: [['API_KEY', 'secret-value']],
			},
			{
				project: 'beta',
				environment: 'prod',
				sourceCreatedAt: 91,
				sourceEventId: 'd'.repeat(64),
				secrets: [['TOKEN', 'other-secret']],
			},
		],
	};
}

function state(dTag: string, secrets: Record<string, string>, createdAt = 95): SecretStateSnapshot {
	return { dTag, secrets, createdAt, eventId: 'e'.repeat(64) };
}

function manager(overrides: Partial<BackupManager> = {}): BackupManager {
	return {
		getPublicKey: () => sourcePubkey,
		connect: () => {},
		fetchAllSecretStates: async () => new Map(),
		publishSecrets: async () => ({ id: 'f'.repeat(64) }) as never,
		getLastPublication: () => null,
		close: async () => {},
		...overrides,
	};
}

function dependencies(
	managerInstance: BackupManager,
	overrides: Partial<BackupCommandDependencies> = {},
): BackupCommandDependencies {
	return {
		requireCurrentAuth: async () => ({ pubkey: managerInstance.getPublicKey(), npub: 'npub1test' }),
		getRelayUrls: async () => ['wss://relay.test/'],
		createManager: () => managerInstance,
		getPassphrases: async () => ['correct horse battery staple', 'correct horse battery staple'],
		encrypt: async () => archive,
		decrypt: async () => payload(),
		readArchive: async () => archive,
		writeArchive: async () => {},
		now: () => 100,
		...overrides,
	};
}

describe('backup command', () => {
	it('creates a canonical allowlisted payload from live observed state only', async () => {
		let captured: BackupPayloadV1 | null = null;
		const writeArchive = mock(async () => {});
		const close = mock(async () => {});
		const instance = manager({
			fetchAllSecretStates: async () =>
				new Map([
					['beta|prod', state('beta|prod', { TOKEN: 'other-secret' }, 91)],
					['deleted|dev', state('deleted|dev', {}, 92)],
					[
						'alpha|dev',
						state(
							'alpha|dev',
							{ ZED: 'last', API_KEY: 'secret-value', _X: 'underscore', a: 'lowercase' },
							90,
						),
					],
				]),
			close,
		});
		await backupCommand(
			{ subcommand: 'create', file: '/tmp/backup', force: false, passphraseStdin: false },
			dependencies(instance, {
				encrypt: async (value) => {
					captured = value;
					return archive;
				},
				writeArchive,
			}),
		);
		expect((captured as BackupPayloadV1 | null)?.entries).toEqual([
			{
				project: 'alpha',
				environment: 'dev',
				sourceCreatedAt: 90,
				sourceEventId: 'e'.repeat(64),
				secrets: [
					['API_KEY', 'secret-value'],
					['ZED', 'last'],
					['_X', 'underscore'],
					['a', 'lowercase'],
				],
			},
			{
				project: 'beta',
				environment: 'prod',
				sourceCreatedAt: 91,
				sourceEventId: 'e'.repeat(64),
				secrets: [['TOKEN', 'other-secret']],
			},
		]);
		expect(writeArchive).toHaveBeenCalledWith('/tmp/backup', archive, { force: false });
		expect(close).toHaveBeenCalled();
	});

	it('rejects malformed authenticated d-tags even when the state is tombstoned', () => {
		expect(() =>
			buildBackupPayload(sourcePubkey, new Map([['malformed', state('malformed', {}, 92)]]), 100),
		).toThrow('Invalid authenticated secret d-tag');
	});

	it('rejects passphrase confirmation mismatch before authentication or relay access', async () => {
		const requireCurrentAuth = mock(async () => ({ pubkey: sourcePubkey, npub: 'npub1test' }));
		const instance = manager();
		await expect(
			backupCommand(
				{ subcommand: 'create', file: '/tmp/backup', force: false, passphraseStdin: true },
				dependencies(instance, {
					getPassphrases: async () => ['one password value', 'different password'],
					requireCurrentAuth,
				}),
			),
		).rejects.toThrow('do not match');
		expect(requireCurrentAuth).not.toHaveBeenCalled();
	});

	it('authenticates the archive before contacting the target signer or relays', async () => {
		const requireCurrentAuth = mock(async () => ({ pubkey: sourcePubkey, npub: 'npub1test' }));
		const connect = mock(() => {});
		const instance = manager({ connect });
		await expect(
			backupCommand(
				{ subcommand: 'restore', file: '/tmp/backup', passphraseStdin: true },
				dependencies(instance, {
					getPassphrases: async () => ['wrong passphrase value'],
					readArchive: async () => new Uint8Array([1, 2, 3]),
					decrypt: async () => {
						throw new Error('authentication failed');
					},
					requireCurrentAuth,
				}),
			),
		).rejects.toThrow('authentication or validation failed');
		expect(requireCurrentAuth).not.toHaveBeenCalled();
		expect(connect).not.toHaveBeenCalled();
	});

	it('preflights every conflict and publishes nothing by default', async () => {
		const publishSecrets = mock(async () => ({ id: 'f'.repeat(64) }) as never);
		const instance = manager({
			fetchAllSecretStates: async () =>
				new Map([['alpha|dev', state('alpha|dev', { API_KEY: 'different' })]]),
			publishSecrets,
		});
		await expect(
			backupCommand(
				{
					subcommand: 'restore',
					file: '/tmp/backup',
					overwrite: false,
					allowIdentityChange: false,
					passphraseStdin: false,
				},
				dependencies(instance, { getPassphrases: async () => ['correct horse battery staple'] }),
			),
		).rejects.toThrow('alpha/dev');
		expect(publishSecrets).not.toHaveBeenCalled();
	});

	it('requires explicit identity migration before publication', async () => {
		const publishSecrets = mock(async () => ({ id: 'f'.repeat(64) }) as never);
		const instance = manager({ getPublicKey: () => targetPubkey, publishSecrets });
		await expect(
			backupCommand(
				{
					subcommand: 'restore',
					file: '/tmp/backup',
					overwrite: false,
					allowIdentityChange: false,
					passphraseStdin: false,
				},
				dependencies(instance, { getPassphrases: async () => ['correct horse battery staple'] }),
			),
		).rejects.toThrow('different identity');
		expect(publishSecrets).not.toHaveBeenCalled();
	});

	it('publishes identity migration bundles in canonical archive order', async () => {
		const publishSecrets = mock(async () => ({ id: 'f'.repeat(64) }) as never);
		const instance = manager({ getPublicKey: () => targetPubkey, publishSecrets });
		await backupCommand(
			{
				subcommand: 'restore',
				file: '/tmp/backup',
				allowIdentityChange: true,
				passphraseStdin: true,
			},
			dependencies(instance),
		);
		const publicationCalls = publishSecrets.mock.calls as unknown as Array<
			Parameters<BackupManager['publishSecrets']>
		>;
		expect(publicationCalls.map((call) => call.slice(0, 2))).toEqual([
			['alpha', 'dev'],
			['beta', 'prod'],
		]);
	});

	it('skips identical state and overwrites conflicts with strictly newer timestamps', async () => {
		const publishSecrets = mock(async () => ({ id: 'f'.repeat(64) }) as never);
		const instance = manager({
			fetchAllSecretStates: async () =>
				new Map([
					['alpha|dev', state('alpha|dev', { API_KEY: 'secret-value' }, 100)],
					['beta|prod', state('beta|prod', { TOKEN: 'different' }, 101)],
				]),
			publishSecrets,
		});
		await backupCommand(
			{
				subcommand: 'restore',
				file: '/tmp/backup',
				overwrite: true,
				allowIdentityChange: false,
				passphraseStdin: false,
			},
			dependencies(instance, { getPassphrases: async () => ['correct horse battery staple'] }),
		);
		expect(publishSecrets).toHaveBeenCalledTimes(1);
		expect(publishSecrets).toHaveBeenCalledWith(
			'beta',
			'prod',
			{ TOKEN: 'other-secret' },
			{ createdAt: 102 },
		);
	});

	it('publishes same-identity restores newer than archived source versions', async () => {
		const archived = payload();
		archived.entries = [{ ...archived.entries[0]!, sourceCreatedAt: 150 }];
		const publishSecrets = mock(async () => ({ id: 'f'.repeat(64) }) as never);
		const instance = manager({ publishSecrets });
		await backupCommand(
			{ subcommand: 'restore', file: '/tmp/backup', passphraseStdin: true },
			dependencies(instance, { decrypt: async () => archived, now: () => 100 }),
		);
		expect(publishSecrets).toHaveBeenCalledTimes(1);
		const publicationCalls = publishSecrets.mock.calls as unknown as Array<
			Parameters<BackupManager['publishSecrets']>
		>;
		expect(publicationCalls[0]?.[3]).toEqual({ createdAt: 151 });
	});

	it('includes the current recovery event after persistence uncertainty', async () => {
		const eventId = '9'.repeat(64);
		const instance = manager({
			publishSecrets: async () => {
				throw new BackupError('recovery persistence uncertain', 'restore');
			},
			getLastPublication: () => ({ event: { id: eventId }, report: {} }) as never,
		});
		await expect(
			backupCommand(
				{ subcommand: 'restore', file: '/tmp/backup', passphraseStdin: true },
				dependencies(instance),
			),
		).rejects.toThrow(`recovery event ${eventId}`);
	});

	it('stops after a failed publication and reports only non-secret progress', async () => {
		const lines: string[] = [];
		console.log = (...values: unknown[]) => lines.push(values.join(' '));
		console.error = (...values: unknown[]) => lines.push(values.join(' '));
		let calls = 0;
		const instance = manager({
			publishSecrets: async () => {
				calls += 1;
				if (calls === 1) throw new BackupError('simulated relay failure', 'restore');
				return { id: 'f'.repeat(64) } as never;
			},
		});
		await expect(
			backupCommand(
				{
					subcommand: 'restore',
					file: '/tmp/backup',
					overwrite: false,
					allowIdentityChange: false,
					passphraseStdin: false,
				},
				dependencies(instance, { getPassphrases: async () => ['correct horse battery staple'] }),
			),
		).rejects.toThrow('stopped after 0');
		const output = lines.join('\n');
		expect(output).not.toContain('secret-value');
		expect(output).not.toContain('other-secret');
	});
});
