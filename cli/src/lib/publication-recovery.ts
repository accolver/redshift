import { constants } from 'node:fs';
import { link, lstat, mkdir, open, readdir, rename, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { PUBLICATION_RECOVERY_LIMITS, sanitizeRelayReason } from '@redshift/rate-limiter';
import { getConfigDir, normalizeRelayUrls } from './config';
import { validateGiftWrapEnvelope } from './crypto';
import { RecoveryError } from './errors';
import type { PublishReport, RelayPublishOutcome } from './relay';
import { acquireSqliteStorageLock } from './storage-lock';
import type { NostrEvent } from './types';
import { validateEnvironment, validateProjectId } from './validation';

export const RECOVERY_SCHEMA_VERSION = 1 as const;
const EVENT_ID_PATTERN = /^[0-9a-f]{64}$/;
const PUBKEY_PATTERN = /^[0-9a-f]{64}$/;
const RECORD_SUFFIX = '.json';

export interface RecoveryRecord {
	version: typeof RECOVERY_SCHEMA_VERSION;
	ownerPubkey: string;
	project: string;
	environment: string;
	event: NostrEvent;
	report: PublishReport;
	revision: string;
	createdAt: number;
	updatedAt: number;
}

export interface ProvisionalRecoveryInput {
	ownerPubkey: string;
	project: string;
	environment: string;
	event: NostrEvent;
	relays: string[];
	now?: number;
}

export function getRecoveryDir() {
	return join(getConfigDir(), 'recovery');
}

export function createProvisionalRecoveryRecord(input: ProvisionalRecoveryInput): RecoveryRecord {
	const relays = normalizeRelayUrls(input.relays, 'recovery relay');
	const now = input.now ?? Date.now();
	const outcomes: RelayPublishOutcome[] = relays.map((relay) => ({
		relay,
		state: 'unavailable',
		reason: 'Publication not yet attempted',
	}));
	return validateRecoveryRecord({
		version: RECOVERY_SCHEMA_VERSION,
		ownerPubkey: input.ownerPubkey,
		project: input.project,
		environment: input.environment,
		event: input.event,
		report: reportFromOutcomes(input.event.id, outcomes),
		revision: crypto.randomUUID(),
		createdAt: now,
		updatedAt: now,
	});
}

export function updateRecoveryRecord(
	record: RecoveryRecord,
	report: PublishReport,
	now = Date.now(),
): RecoveryRecord {
	return validateRecoveryRecord({
		...record,
		report,
		revision: crypto.randomUUID(),
		updatedAt: now,
	});
}

export function validateRecoveryRecord(value: unknown): RecoveryRecord {
	const record = requireObject(value, 'Recovery record');
	assertExactKeys(record, [
		'version',
		'ownerPubkey',
		'project',
		'environment',
		'event',
		'report',
		'revision',
		'createdAt',
		'updatedAt',
	]);
	if (record.version !== RECOVERY_SCHEMA_VERSION)
		throw new RecoveryError('Unsupported recovery schema');
	if (typeof record.ownerPubkey !== 'string' || !PUBKEY_PATTERN.test(record.ownerPubkey)) {
		throw new RecoveryError('Invalid recovery owner pubkey');
	}
	if (typeof record.project !== 'string' || !validateProjectId(record.project).valid) {
		throw new RecoveryError('Invalid recovery project');
	}
	if (typeof record.environment !== 'string' || !validateEnvironment(record.environment).valid) {
		throw new RecoveryError('Invalid recovery environment');
	}
	const createdAt = record.createdAt;
	const updatedAt = record.updatedAt;
	if (
		typeof createdAt !== 'number' ||
		typeof updatedAt !== 'number' ||
		!Number.isSafeInteger(createdAt) ||
		!Number.isSafeInteger(updatedAt)
	) {
		throw new RecoveryError('Invalid recovery timestamps');
	}
	if (createdAt <= 0 || updatedAt < createdAt) {
		throw new RecoveryError('Invalid recovery timestamp ordering');
	}
	if (createdAt > Date.now() + 60_000 || updatedAt > Date.now() + 60_000) {
		throw new RecoveryError('Recovery timestamp is in the future');
	}
	if (Date.now() - updatedAt > PUBLICATION_RECOVERY_LIMITS.maxAgeMs) {
		throw new RecoveryError('Recovery record is expired');
	}

	if (
		typeof record.revision !== 'string' ||
		!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(record.revision)
	) {
		throw new RecoveryError('Invalid recovery revision');
	}
	const event = validateEvent(record.event, record.ownerPubkey);
	const report = validateReport(record.report, event.id);
	return {
		version: RECOVERY_SCHEMA_VERSION,
		ownerPubkey: record.ownerPubkey,
		project: record.project,
		environment: record.environment,
		event,
		report,
		revision: record.revision,
		createdAt,
		updatedAt,
	};
}

export async function saveRecoveryRecord(
	record: RecoveryRecord,
	expectedRevision?: string,
	options: { maxRecords?: number; syncDirectory?: () => Promise<void> } = {},
): Promise<void> {
	const validated = validateRecoveryRecord(record);
	await ensureRecoveryDir();
	const serialized = `${JSON.stringify(validated, null, 2)}\n`;
	if (Buffer.byteLength(serialized) > PUBLICATION_RECOVERY_LIMITS.maxRecordBytes) {
		throw new RecoveryError('Recovery record is too large');
	}
	const releaseLock = await acquireStorageLock();
	try {
		const maxRecords = Math.max(
			1,
			Math.min(
				options.maxRecords ?? PUBLICATION_RECOVERY_LIMITS.maxRecords,
				PUBLICATION_RECOVERY_LIMITS.maxRecords,
			),
		);
		await enforceRecordCapacity(validated.event.id, maxRecords);
		let previous: RecoveryRecord | null = null;
		if (expectedRevision !== undefined) {
			previous = await loadRecoveryRecordFile(validated.event.id);
			if (previous.revision !== expectedRevision) {
				throw new RecoveryError('Recovery record changed concurrently; reload before retrying');
			}
			if (validated.revision === expectedRevision) {
				throw new RecoveryError('Recovery record updates require a new revision');
			}
		} else {
			const existing = await lstat(recordPath(validated.event.id)).catch((error: unknown) => {
				if (isNotFound(error)) return null;
				throw error;
			});
			if (existing)
				throw new RecoveryError('Existing recovery records require an expected revision');
		}
		const finalPath = recordPath(validated.event.id);
		const operationId = `${process.pid}.${crypto.randomUUID()}`;
		const tempPath = join(getRecoveryDir(), `.${validated.event.id}.${operationId}.tmp`);
		const backupPath = recoveryBackupPath(validated.event.id);
		const syncRecoveryDirectory = options.syncDirectory ?? syncDirectory;
		let handle: Awaited<ReturnType<typeof open>> | null = null;
		let backupCreated = false;
		let finalReplaced = false;
		try {
			handle = await open(
				tempPath,
				constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
				0o600,
			);
			await handle.writeFile(serialized, 'utf8');
			await handle.sync();
			await handle.close();
			handle = null;
			if (previous) {
				await link(finalPath, backupPath);
				backupCreated = true;
				await syncRecoveryDirectory();
			}
			await rename(tempPath, finalPath);
			finalReplaced = true;
			await syncRecoveryDirectory();
			if (backupCreated) {
				await unlink(backupPath);
				backupCreated = false;
			}
		} catch (error) {
			if (finalReplaced && backupCreated) {
				try {
					await rename(backupPath, finalPath);
					backupCreated = false;
					await syncRecoveryDirectory();
				} catch (restoreError) {
					throw new RecoveryError(
						`Failed to persist recovery event ${validated.event.id}; previous recovery state could not be restored`,
						restoreError,
					);
				}
			}
			if (error instanceof RecoveryError) throw error;
			throw new RecoveryError(`Failed to persist recovery event ${validated.event.id}`, error);
		} finally {
			if (handle) await handle.close().catch(() => {});
			await unlink(tempPath).catch(() => {});
			if (backupCreated) await unlink(backupPath).catch(() => {});
		}
	} finally {
		await releaseLock();
	}
}

export async function loadRecoveryRecord(eventId: string): Promise<RecoveryRecord> {
	assertEventId(eventId);
	await ensureRecoveryDir();
	const releaseLock = await acquireStorageLock();
	try {
		return await loadRecoveryRecordFile(eventId);
	} finally {
		await releaseLock();
	}
}

async function loadRecoveryRecordFile(eventId: string): Promise<RecoveryRecord> {
	const path = recordPath(eventId);
	let handle: Awaited<ReturnType<typeof open>>;
	try {
		handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
	} catch (error) {
		if (hasErrorCode(error, 'ELOOP'))
			throw new RecoveryError('Recovery record must be a regular file', error);
		throw new RecoveryError(`Recovery record not found: ${eventId}`, error);
	}
	try {
		const entry = await handle.stat();
		if (!entry.isFile()) throw new RecoveryError('Recovery record must be a regular file');
		if ((entry.mode & 0o077) !== 0) {
			throw new RecoveryError('Recovery record must use owner-only permissions');
		}
		if (entry.size > PUBLICATION_RECOVERY_LIMITS.maxRecordBytes) {
			throw new RecoveryError('Recovery record is too large');
		}
		const text = await handle.readFile('utf8');
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch (error) {
			throw new RecoveryError('Recovery record is not valid JSON', error);
		}
		const record = validateRecoveryRecord(parsed);
		if (record.event.id !== eventId || record.report.eventId !== eventId) {
			throw new RecoveryError('Recovery filename and event ID do not match');
		}
		return record;
	} finally {
		await handle.close();
	}
}

export async function listRecoveryRecords(): Promise<RecoveryRecord[]> {
	await ensureRecoveryDir();
	const releaseLock = await acquireStorageLock();
	try {
		const entries = await readdir(getRecoveryDir());
		const recordNames = entries.filter((name) => name.endsWith(RECORD_SUFFIX));
		if (recordNames.length > PUBLICATION_RECOVERY_LIMITS.maxRecords) {
			throw new RecoveryError('Recovery directory exceeds the record limit');
		}
		const records: RecoveryRecord[] = [];
		for (const name of recordNames.sort()) {
			const eventId = basename(name, RECORD_SUFFIX);
			records.push(await loadRecoveryRecordFile(eventId));
		}
		return records.sort(
			(a, b) => a.createdAt - b.createdAt || a.event.id.localeCompare(b.event.id),
		);
	} finally {
		await releaseLock();
	}
}

export async function removeRecoveryRecord(eventId: string): Promise<void> {
	assertEventId(eventId);
	await ensureRecoveryDir();
	const releaseLock = await acquireStorageLock();
	try {
		const path = recordPath(eventId);
		const entry = await lstat(path).catch((error: unknown) => {
			if (isNotFound(error)) return null;
			throw new RecoveryError(`Failed to inspect recovery record ${eventId}`, error);
		});
		if (!entry) return;
		if (!entry.isFile() || entry.isSymbolicLink()) {
			throw new RecoveryError('Recovery record must be a regular file');
		}
		await unlink(path);
		await syncDirectory();
	} finally {
		await releaseLock();
	}
}

function validateEvent(value: unknown, ownerPubkey: string): NostrEvent {
	const object = requireObject(value, 'Recovery event');
	assertExactKeys(object, ['id', 'pubkey', 'created_at', 'kind', 'tags', 'content', 'sig']);
	for (const field of ['id', 'pubkey', 'content', 'sig']) {
		if (typeof object[field] !== 'string')
			throw new RecoveryError(`Invalid recovery event ${field}`);
	}
	if (!Number.isSafeInteger(object.created_at) || !Number.isSafeInteger(object.kind)) {
		throw new RecoveryError('Invalid recovery event timestamp or kind');
	}
	if (!Array.isArray(object.tags)) throw new RecoveryError('Invalid recovery event tags');
	const event = object as unknown as NostrEvent;
	try {
		validateGiftWrapEnvelope(event, ownerPubkey);
	} catch (error) {
		throw new RecoveryError(
			error instanceof Error ? error.message : 'Invalid gift wrap recovery event',
			error,
		);
	}
	return event;
}

function validateReport(value: unknown, eventId: string): PublishReport {
	const report = requireObject(value, 'Recovery report');
	assertExactKeys(report, ['eventId', 'required', 'accepted', 'failed', 'outcomes']);
	if (report.eventId !== eventId)
		throw new RecoveryError('Recovery report event ID does not match event');
	if (!Array.isArray(report.outcomes) || report.outcomes.length === 0) {
		throw new RecoveryError('Recovery report must contain relay outcomes');
	}
	if (report.outcomes.length > PUBLICATION_RECOVERY_LIMITS.maxRelays) {
		throw new RecoveryError('Recovery report has too many relay outcomes');
	}
	const outcomes = report.outcomes.map(validateOutcome);
	const normalized = normalizeRelayUrls(
		outcomes.map(({ relay }) => relay),
		'recovery relay',
	);
	if (
		normalized.length !== outcomes.length ||
		normalized.some((relay, index) => relay !== outcomes[index]?.relay)
	) {
		throw new RecoveryError('Recovery relay outcomes must be unique and normalized');
	}
	const derived = reportFromOutcomes(eventId, outcomes);
	if (report.required !== derived.required)
		throw new RecoveryError('Recovery report quorum threshold is invalid');
	if (JSON.stringify(report.accepted) !== JSON.stringify(derived.accepted)) {
		throw new RecoveryError('Recovery report accepted relays are inconsistent');
	}
	if (JSON.stringify(report.failed) !== JSON.stringify(derived.failed)) {
		throw new RecoveryError('Recovery report failed relays are inconsistent');
	}
	return derived;
}

function validateOutcome(value: unknown): RelayPublishOutcome {
	const outcome = requireObject(value, 'Recovery relay outcome');
	const allowed = outcome.reason === undefined ? ['relay', 'state'] : ['relay', 'state', 'reason'];
	assertExactKeys(outcome, allowed);
	if (typeof outcome.relay !== 'string') throw new RecoveryError('Invalid recovery relay');
	if (
		outcome.state !== 'accepted' &&
		outcome.state !== 'rejected' &&
		outcome.state !== 'unavailable'
	) {
		throw new RecoveryError('Invalid recovery relay outcome state');
	}
	if (outcome.reason !== undefined) {
		if (
			typeof outcome.reason !== 'string' ||
			outcome.reason.length > PUBLICATION_RECOVERY_LIMITS.maxReasonLength ||
			sanitizeRelayReason(outcome.reason) !== outcome.reason
		) {
			throw new RecoveryError('Invalid recovery relay outcome reason');
		}
	}
	if (outcome.state !== 'accepted' && !outcome.reason) {
		throw new RecoveryError('Failed recovery relay outcomes require a reason');
	}
	return {
		relay: outcome.relay,
		state: outcome.state,
		...(typeof outcome.reason === 'string' ? { reason: outcome.reason } : {}),
	};
}

function reportFromOutcomes(eventId: string, outcomes: RelayPublishOutcome[]): PublishReport {
	const required = Math.floor(outcomes.length / 2) + 1;
	return {
		eventId,
		required,
		accepted: outcomes.filter(({ state }) => state === 'accepted').map(({ relay }) => relay),
		failed: outcomes
			.filter(({ state }) => state !== 'accepted')
			.map(({ relay, reason }) => ({ relay, reason: reason ?? 'Unknown failure' })),
		outcomes,
	};
}

async function acquireStorageLock(): Promise<() => Promise<void>> {
	const releaseLock = await acquireSqliteStorageLock(
		join(getRecoveryDir(), '.recovery-lock.sqlite'),
		(message, error) => new RecoveryError(`Recovery ${message.toLowerCase()}`, error),
	);
	try {
		await reconcileRecoveryBackups();
		return releaseLock;
	} catch (error) {
		await releaseLock();
		throw error;
	}
}

async function reconcileRecoveryBackups() {
	const backupPattern = /^\.([0-9a-f]{64})\.backup$/;
	const backupNames = (await readdir(getRecoveryDir())).filter((name) => backupPattern.test(name));
	if (backupNames.length > PUBLICATION_RECOVERY_LIMITS.maxRecords) {
		throw new RecoveryError('Recovery directory exceeds the backup limit');
	}
	for (const name of backupNames.sort()) {
		const eventId = backupPattern.exec(name)?.[1];
		if (!eventId) continue;
		const backupPath = recoveryBackupPath(eventId);
		const entry = await lstat(backupPath);
		if (!entry.isFile() || entry.isSymbolicLink() || (entry.mode & 0o077) !== 0) {
			throw new RecoveryError('Recovery backup must be a regular owner-only file');
		}
		await rename(backupPath, recordPath(eventId));
		await syncDirectory();
	}
}

async function ensureRecoveryDir() {
	await mkdir(getRecoveryDir(), { recursive: true, mode: 0o700 });
	let handle: Awaited<ReturnType<typeof open>>;
	try {
		handle = await open(
			getRecoveryDir(),
			constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
		);
	} catch (error) {
		throw new RecoveryError('Recovery path must be a regular directory', error);
	}
	try {
		const entry = await handle.stat();
		if (!entry.isDirectory()) throw new RecoveryError('Recovery path must be a regular directory');
		await handle.chmod(0o700);
		await handle.sync();
	} finally {
		await handle.close();
	}
}

async function enforceRecordCapacity(eventId: string, maxRecords: number) {
	const entries = (await readdir(getRecoveryDir())).filter((name) => name.endsWith(RECORD_SUFFIX));
	if (!entries.includes(`${eventId}${RECORD_SUFFIX}`) && entries.length >= maxRecords) {
		throw new RecoveryError(`Recovery storage is full (${maxRecords} records)`);
	}
}

async function syncDirectory() {
	const handle = await open(
		getRecoveryDir(),
		constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
	);
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}

function recordPath(eventId: string) {
	assertEventId(eventId);
	return join(getRecoveryDir(), `${eventId}${RECORD_SUFFIX}`);
}

function recoveryBackupPath(eventId: string) {
	assertEventId(eventId);
	return join(getRecoveryDir(), `.${eventId}.backup`);
}

function assertEventId(eventId: string) {
	if (!EVENT_ID_PATTERN.test(eventId)) throw new RecoveryError('Invalid recovery event ID');
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new RecoveryError(`${label} must be an object`);
	}
	return value as Record<string, unknown>;
}

function assertExactKeys(value: Record<string, unknown>, expected: string[]) {
	const keys = Object.keys(value).sort();
	const allowed = [...expected].sort();
	if (JSON.stringify(keys) !== JSON.stringify(allowed)) {
		throw new RecoveryError('Recovery record contains unexpected or missing fields');
	}
}

function hasErrorCode(error: unknown, code: string) {
	return Boolean(error && typeof error === 'object' && 'code' in error && error.code === code);
}

function isNotFound(error: unknown) {
	return hasErrorCode(error, 'ENOENT');
}
