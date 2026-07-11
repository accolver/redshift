import { createDTag } from '../lib/crypto';
import { RecoveryError } from '../lib/errors';
import {
	listRecoveryRecords,
	loadRecoveryRecord,
	removeRecoveryRecord,
	saveRecoveryRecord,
	updateRecoveryRecord,
} from '../lib/publication-recovery';
import type { RecoveryRecord } from '../lib/publication-recovery';
import { PublishQuorumError, getUnavailableRelays, mergePublishReports } from '../lib/relay';
import type { PublishReport } from '../lib/relay';
import { SecretManager } from '../lib/secret-manager';
import type { RequiredAuth } from './login';
import { requireAuth } from './login';

export type RecoverySubcommand = 'list' | 'show' | 'retry' | 'remove';

export interface RecoveryOptions {
	subcommand: RecoverySubcommand;
	eventId?: string;
	json?: boolean;
}

interface RecoveryManager {
	getPublicKey(): string;
	unwrapWithMetadata(event: RecoveryRecord['event']): Promise<{ dTag: string }>;
	connect(relays: string[]): void;
	retryPublication(event: RecoveryRecord['event'], relays: string[]): Promise<PublishReport>;
	close(): Promise<void>;
}

export interface RecoveryCommandDependencies {
	listRecords?: () => Promise<RecoveryRecord[]>;
	loadRecord?: (eventId: string) => Promise<RecoveryRecord>;
	saveRecord?: (record: RecoveryRecord, expectedRevision?: string) => Promise<void>;
	removeRecord?: (eventId: string) => Promise<void>;
	requireCurrentAuth?: () => Promise<Pick<RequiredAuth, 'pubkey'> & Partial<RequiredAuth>>;
	createManager?: (auth: Pick<RequiredAuth, 'pubkey'> & Partial<RequiredAuth>) => RecoveryManager;
}

export async function recoveryCommand(
	options: RecoveryOptions,
	dependencies: RecoveryCommandDependencies = {},
): Promise<void> {
	const deps = resolveDependencies(dependencies);
	if (options.subcommand === 'list') {
		const records = await deps.listRecords();
		printRecords(records, options.json === true);
		return;
	}

	const eventId = requireEventId(options.eventId);
	if (options.subcommand === 'remove') {
		await deps.removeRecord(eventId);
		if (options.json) console.log(JSON.stringify({ eventId, removed: true }));
		else console.log(`Removed local recovery record ${eventId}. No relay data was deleted.`);
		return;
	}

	const record = await deps.loadRecord(eventId);
	if (options.subcommand === 'show') {
		printRecord(record, options.json === true);
		return;
	}

	await retryRecord(record, deps, options.json === true);
}

function resolveDependencies(dependencies: RecoveryCommandDependencies) {
	return {
		listRecords: dependencies.listRecords ?? listRecoveryRecords,
		loadRecord: dependencies.loadRecord ?? loadRecoveryRecord,
		saveRecord: dependencies.saveRecord ?? saveRecoveryRecord,
		removeRecord: dependencies.removeRecord ?? removeRecoveryRecord,
		requireCurrentAuth: dependencies.requireCurrentAuth ?? requireAuth,
		createManager:
			dependencies.createManager ??
			((auth) => {
				const credential = auth.privateKey ?? auth.signer;
				if (!credential) throw new RecoveryError('Authenticated recovery signer is unavailable');
				return new SecretManager(credential);
			}),
	};
}

type ResolvedDependencies = ReturnType<typeof resolveDependencies>;

async function retryRecord(
	record: RecoveryRecord,
	deps: ResolvedDependencies,
	json: boolean,
): Promise<void> {
	const auth = await deps.requireCurrentAuth();
	if (auth.pubkey !== record.ownerPubkey) {
		throw new RecoveryError('Recovery record belongs to a different identity');
	}
	const manager = deps.createManager(auth);
	try {
		if (manager.getPublicKey() !== record.ownerPubkey) {
			throw new RecoveryError('Authenticated recovery signer does not match the record owner');
		}
		const unwrapped = await manager.unwrapWithMetadata(record.event);
		if (unwrapped.dTag !== createDTag(record.project, record.environment)) {
			throw new RecoveryError('Recovery event project/environment metadata does not match');
		}

		const unavailable = getUnavailableRelays(record.report);
		if (unavailable.length === 0) {
			printRecord(record, json);
			if (record.report.accepted.length < record.report.required) process.exitCode = 1;
			return;
		}
		manager.connect(record.report.outcomes.map(({ relay }) => relay));
		let retryReport: PublishReport;
		try {
			retryReport = await manager.retryPublication(record.event, unavailable);
		} catch (error) {
			if (!(error instanceof PublishQuorumError)) throw error;
			retryReport = error.report;
		}
		const merged = mergePublishReports(record.report, retryReport);
		const updated = updateRecoveryRecord(record, merged);
		await deps.saveRecord(updated, record.revision);
		if (merged.outcomes.every(({ state }) => state === 'accepted')) {
			await deps.removeRecord(record.event.id);
		}
		printRecord(updated, json);
		if (merged.accepted.length < merged.required || getUnavailableRelays(merged).length > 0) {
			process.exitCode = 1;
		}
	} finally {
		await manager.close();
	}
}

function printRecords(records: RecoveryRecord[], json: boolean) {
	if (json) {
		console.log(JSON.stringify(records.map(toDisplayRecord), null, 2));
		return;
	}
	if (records.length === 0) {
		console.log('No incomplete relay publications.');
		return;
	}
	for (const record of records) {
		const accepted = record.report.accepted.length;
		console.log(
			`${record.event.id}  ${record.project}/${record.environment}  ${accepted}/${record.report.outcomes.length} relays accepted`,
		);
	}
}

function printRecord(record: RecoveryRecord, json: boolean) {
	if (json) {
		console.log(JSON.stringify(toDisplayRecord(record), null, 2));
		return;
	}
	const accepted = record.report.accepted.length;
	const total = record.report.outcomes.length;
	console.log(`Event: ${record.event.id}`);
	console.log(`Project: ${record.project}/${record.environment}`);
	console.log(`Relay redundancy: ${accepted}/${total} accepted (quorum ${record.report.required})`);
	for (const outcome of record.report.outcomes) {
		console.log(
			`- ${outcome.relay}  ${outcome.state}${outcome.reason ? `  ${outcome.reason}` : ''}`,
		);
	}
	if (getUnavailableRelays(record.report).length > 0) {
		console.log('Retry republishes this existing encrypted event only to unavailable relays.');
	} else if (record.report.outcomes.some(({ state }) => state === 'rejected')) {
		console.log(
			'Permanent relay rejection remains for inspection until this local notice is removed.',
		);
	}
}

function toDisplayRecord(record: RecoveryRecord) {
	return {
		eventId: record.event.id,
		ownerPubkey: record.ownerPubkey,
		project: record.project,
		environment: record.environment,
		required: record.report.required,
		outcomes: record.report.outcomes,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
	};
}

function requireEventId(eventId: string | undefined) {
	if (!eventId) throw new RecoveryError('Recovery event ID is required');
	return eventId;
}
