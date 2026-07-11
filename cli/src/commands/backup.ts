import {
	decryptBackup,
	encryptBackup,
	parseDTag,
	type BackupPayloadV1,
	type NostrEvent,
	type SecretBundle,
} from '../lib/crypto';
import { readBackupArchive, writeBackupArchive } from '../lib/backup';
import { getRelays } from '../lib/config';
import { BackupError, ValidationError } from '../lib/errors';
import {
	promptHidden,
	readPipedPassphrases,
	validatePassphraseInputMode,
} from '../lib/hidden-input';
import { PublishQuorumError } from '../lib/relay';
import {
	SecretManager,
	getNextSecretTimestamp,
	type SecretPublication,
	type SecretStateSnapshot,
} from '../lib/secret-manager';
import type { RequiredAuth } from './login';
import { requireAuth } from './login';

export type BackupSubcommand = 'create' | 'restore';

export interface BackupOptions {
	subcommand: BackupSubcommand;
	file: string;
	force?: boolean;
	overwrite?: boolean;
	allowIdentityChange?: boolean;
	passphraseStdin?: boolean;
}

export interface BackupManager {
	getPublicKey(): string;
	connect(relays: string[]): void;
	fetchAllSecretStates(): Promise<Map<string, SecretStateSnapshot>>;
	publishSecrets(
		project: string,
		environment: string,
		secrets: SecretBundle,
		options?: { createdAt?: number },
	): Promise<NostrEvent>;
	getLastPublication(): SecretPublication | null;
	close(): Promise<void>;
}

export interface BackupCommandDependencies {
	requireCurrentAuth: () => Promise<RequiredAuth>;
	getRelayUrls: () => Promise<string[]>;
	createManager: (auth: RequiredAuth) => BackupManager;
	getPassphrases: (subcommand: BackupSubcommand, stdin: boolean) => Promise<string[]>;
	encrypt: typeof encryptBackup;
	decrypt: typeof decryptBackup;
	readArchive: typeof readBackupArchive;
	writeArchive: typeof writeBackupArchive;
	now: () => number;
}

export async function backupCommand(
	options: BackupOptions,
	dependencies: Partial<BackupCommandDependencies> = {},
) {
	const deps = resolveDependencies(dependencies);
	if (options.subcommand === 'create') await createBackup(options, deps);
	else await restoreBackup(options, deps);
}

function resolveDependencies(
	dependencies: Partial<BackupCommandDependencies>,
): BackupCommandDependencies {
	return {
		requireCurrentAuth: dependencies.requireCurrentAuth ?? requireAuth,
		getRelayUrls: dependencies.getRelayUrls ?? getRelays,
		createManager:
			dependencies.createManager ??
			((auth) => {
				const credential = auth.privateKey ?? auth.signer;
				if (!credential)
					throw new BackupError('Authenticated backup signer is unavailable', 'create');
				return new SecretManager(credential);
			}),
		getPassphrases: dependencies.getPassphrases ?? getBackupPassphrases,
		encrypt: dependencies.encrypt ?? encryptBackup,
		decrypt: dependencies.decrypt ?? decryptBackup,
		readArchive: dependencies.readArchive ?? readBackupArchive,
		writeArchive: dependencies.writeArchive ?? writeBackupArchive,
		now: dependencies.now ?? (() => Math.floor(Date.now() / 1000)),
	};
}

async function createBackup(options: BackupOptions, deps: BackupCommandDependencies) {
	const passphrases = await deps.getPassphrases('create', Boolean(options.passphraseStdin));
	const [passphrase, confirmation] = passphrases;
	if (passphrase === undefined || confirmation === undefined || passphrase !== confirmation) {
		throw new ValidationError('Backup passphrases do not match');
	}
	const auth = await deps.requireCurrentAuth();
	const manager = deps.createManager(auth);
	try {
		manager.connect(await deps.getRelayUrls());
		const states = await manager.fetchAllSecretStates();
		const payload = buildBackupPayload(manager.getPublicKey(), states, deps.now());
		const archive = await deps.encrypt(payload, passphrase);
		try {
			await deps.writeArchive(options.file, archive, { force: Boolean(options.force) });
		} finally {
			archive.fill(0);
		}
		const secretCount = payload.entries.reduce((sum, entry) => sum + entry.secrets.length, 0);
		console.log(
			`Encrypted backup created: ${payload.entries.length} bundle(s), ${secretCount} secret(s).`,
		);
		console.log('Snapshot contains current state observed from responding configured relays.');
	} finally {
		await manager.close();
	}
}

async function restoreBackup(options: BackupOptions, deps: BackupCommandDependencies) {
	const [passphrase] = await deps.getPassphrases('restore', Boolean(options.passphraseStdin));
	if (passphrase === undefined) throw new ValidationError('Backup passphrase is required');
	let archive: Uint8Array | null = null;
	let manager: BackupManager | null = null;
	try {
		archive = await deps.readArchive(options.file);
		let payload: BackupPayloadV1;
		try {
			payload = await deps.decrypt(archive, passphrase);
		} catch (error) {
			throw new BackupError('Backup authentication or validation failed', 'decrypt', error);
		}
		const auth = await deps.requireCurrentAuth();
		manager = deps.createManager(auth);
		const targetPubkey = manager.getPublicKey();
		if (payload.sourcePubkey !== targetPubkey && !options.allowIdentityChange) {
			throw new BackupError(
				'Backup belongs to a different identity; use --allow-identity-change to authorize migration',
				'restore',
			);
		}
		manager.connect(await deps.getRelayUrls());
		const destination = await manager.fetchAllSecretStates();
		const plan = preflightRestore(
			payload,
			destination,
			Boolean(options.overwrite),
			payload.sourcePubkey === targetPubkey,
		);
		if (plan.conflicts.length > 0) {
			throw new BackupError(
				`Restore conflicts with existing state: ${plan.conflicts.join(', ')}; rerun with --overwrite`,
				'restore',
			);
		}
		let restored = 0;
		let degraded = 0;
		for (const item of plan.pending) {
			try {
				await manager.publishSecrets(item.entry.project, item.entry.environment, item.secrets, {
					createdAt: getNextSecretTimestamp(item.observedCreatedAt, deps.now()),
				});
				restored += 1;
				const publication = manager.getLastPublication();
				if (
					publication &&
					publication.report.accepted.length < publication.report.outcomes.length
				) {
					degraded += 1;
					console.error(
						`Restored ${item.entry.project}/${item.entry.environment} with degraded relay redundancy.`,
					);
				}
			} catch (error) {
				const eventId =
					error instanceof PublishQuorumError
						? error.event.id
						: manager.getLastPublication()?.event.id;
				throw new BackupError(
					`Restore stopped after ${restored} bundle(s); ${plan.pending.length - restored} remain pending${eventId ? `; recovery event ${eventId}` : ''}`,
					'restore',
					error,
				);
			}
		}
		console.log(
			`Backup restore complete: ${restored} restored, ${plan.noOpCount} unchanged, ${degraded} degraded.`,
		);
		if (payload.sourcePubkey !== targetPubkey) {
			console.log('State was migrated as new events under the authenticated target identity.');
		}
	} finally {
		archive?.fill(0);
		await manager?.close();
	}
}

export function buildBackupPayload(
	sourcePubkey: string,
	states: Map<string, SecretStateSnapshot>,
	createdAt: number,
): BackupPayloadV1 {
	const entries = [...states.entries()]
		.map(([dTag, state]) => {
			const parsed = parseDTag(dTag);
			if (!parsed) throw new BackupError(`Invalid authenticated secret d-tag: ${dTag}`, 'create');
			if (Object.keys(state.secrets).length === 0) return null;
			return {
				project: parsed.projectId,
				environment: parsed.environment,
				sourceCreatedAt: state.createdAt,
				sourceEventId: state.eventId,
				secrets: Object.entries(state.secrets).sort(([left], [right]) =>
					compareCanonical(left, right),
				),
			};
		})
		.filter((entry) => entry !== null)
		.sort((left, right) =>
			compareCanonical(
				`${left.project}|${left.environment}`,
				`${right.project}|${right.environment}`,
			),
		);
	return {
		schema: 'com.redshiftapp.backup',
		version: 1,
		createdAt,
		sourcePubkey,
		contents: {
			secretState: 'current-observed',
			projectMetadata: 'identifiers-only',
			relayConfiguration: 'excluded',
			signerCredentials: 'excluded',
			historyAndTombstones: 'excluded',
		},
		entries,
	};
}

function preflightRestore(
	payload: BackupPayloadV1,
	destination: Map<string, SecretStateSnapshot>,
	overwrite: boolean,
	sameIdentity: boolean,
) {
	const pending: Array<{
		entry: BackupPayloadV1['entries'][number];
		secrets: SecretBundle;
		observedCreatedAt?: number;
	}> = [];
	const conflicts: string[] = [];
	let noOpCount = 0;
	for (const entry of payload.entries) {
		const dTag = `${entry.project}|${entry.environment}`;
		const observed = destination.get(dTag);
		const secrets = Object.fromEntries(entry.secrets) as SecretBundle;
		if (observed && Object.keys(observed.secrets).length > 0) {
			if (secretBundlesEqual(observed.secrets, secrets)) {
				noOpCount += 1;
				continue;
			}
			if (!overwrite) {
				conflicts.push(`${entry.project}/${entry.environment}`);
				continue;
			}
		}
		const observedCreatedAt = sameIdentity
			? Math.max(observed?.createdAt ?? 0, entry.sourceCreatedAt)
			: observed?.createdAt;
		pending.push({
			entry,
			secrets,
			...(observedCreatedAt !== undefined ? { observedCreatedAt } : {}),
		});
	}
	return { pending, conflicts, noOpCount };
}

function secretBundlesEqual(left: SecretBundle, right: SecretBundle) {
	const leftEntries = Object.entries(left).sort(([a], [b]) => compareCanonical(a, b));
	const rightEntries = Object.entries(right).sort(([a], [b]) => compareCanonical(a, b));
	return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

function compareCanonical(left: string, right: string) {
	return left < right ? -1 : left > right ? 1 : 0;
}

async function getBackupPassphrases(subcommand: BackupSubcommand, stdin: boolean) {
	validatePassphraseInputMode(stdin, Boolean(process.stdin.isTTY));
	if (stdin) return readPipedPassphrases(subcommand === 'create' ? 2 : 1);
	if (subcommand === 'create') {
		return [
			await promptHidden('Backup passphrase: ', { trim: false, output: process.stderr }),
			await promptHidden('Confirm backup passphrase: ', { trim: false, output: process.stderr }),
		];
	}
	return [await promptHidden('Backup passphrase: ', { trim: false, output: process.stderr })];
}
