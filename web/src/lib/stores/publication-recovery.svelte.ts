import { validateGiftWrapEnvelope } from '$lib/crypto';
import {
	PUBLICATION_RECOVERY_LIMITS,
	isFullyAccepted,
	mergeQuorumReports,
	sanitizeRelayReason,
} from '$lib/rate-limiter';
import type { QuorumReport } from '$lib/rate-limiter';
import type { NostrEvent } from 'nostr-tools';
import { getEventHash, verifyEvent } from 'nostr-tools/pure';

export const PUBLICATION_RECOVERY_STORAGE_KEY = 'redshift_publication_recovery_v1';
const SCHEMA_VERSION = 1 as const;
const EVENT_ID_PATTERN = /^[0-9a-f]{64}$/;
const PUBKEY_PATTERN = /^[0-9a-f]{64}$/;

export interface PublicationContext {
	ownerPubkey: string;
	project?: string;
	environment?: string;
}

export interface BrowserRecoveryRecord {
	version: typeof SCHEMA_VERSION;
	event: NostrEvent;
	context: PublicationContext;
	report: QuorumReport<string>;
	createdAt: number;
	updatedAt: number;
}

interface PublicationRecoveryState {
	records: BrowserRecoveryRecord[];
	retryingEventIds: Set<string>;
	error: string | null;
	hydratedForPubkey: string | null;
}

let recoveryState = $state<PublicationRecoveryState>({
	records: [],
	retryingEventIds: new Set(),
	error: null,
	hydratedForPubkey: null,
});

export function getPublicationRecoveryState(): PublicationRecoveryState {
	return recoveryState;
}

export function getPublicationRecoveryRecord(eventId: string) {
	return recoveryState.records.find(({ event }) => event.id === eventId);
}

export function preparePublicationRecovery(
	event: NostrEvent,
	relays: string[],
	context: PublicationContext,
) {
	const normalizedRelays = normalizePublicationRelayUrls(relays);
	validateEventForOwner(event, context.ownerPubkey);
	const now = Date.now();
	const outcomes = normalizedRelays.map((target) => ({
		target,
		state: 'unavailable' as const,
		reason: 'Publication not yet attempted',
	}));
	const record = validateRecord({
		version: SCHEMA_VERSION,
		event: toPlainEvent(event),
		context,
		report: reportFromOutcomes(event.id, outcomes),
		createdAt: now,
		updatedAt: now,
	});
	const next = [
		...recoveryState.records.filter(({ event: existing }) => existing.id !== event.id),
		record,
	];
	persistRecords(next, 'Unable to preserve recovery state before relay publication');
	return record;
}

export function finalizePublicationRecovery(eventId: string, report: QuorumReport<string>) {
	const current = requireRecord(eventId);
	const validatedReport = validateReport(report, eventId);
	if (isFullyAccepted(validatedReport)) {
		removePublicationRecovery(eventId);
		return undefined;
	}
	const updated = validateRecord({ ...current, report: validatedReport, updatedAt: Date.now() });
	persistRecords(
		recoveryState.records.map((record) => (record.event.id === eventId ? updated : record)),
		`Remote publication may have succeeded, but browser recovery state could not be updated for event ${eventId}`,
	);
	return updated;
}

export function mergePublicationRecovery(eventId: string, retry: QuorumReport<string>) {
	const current = requireRecord(eventId);
	const merged = mergeQuorumReports(current.report, validateReport(retry, eventId));
	finalizePublicationRecovery(eventId, merged);
	return merged;
}

export function restorePublicationRecovery(ownerPubkey: string) {
	if (!PUBKEY_PATTERN.test(ownerPubkey)) {
		clearPublicationRecovery();
		return;
	}
	let storage: Storage | null = null;
	let raw: string | null = null;
	try {
		storage = getSessionStorage();
		raw = storage?.getItem(PUBLICATION_RECOVERY_STORAGE_KEY) ?? null;
	} catch {
		recoveryState = {
			records: [],
			retryingEventIds: new Set(),
			error: 'Stored relay recovery state could not be read and was ignored.',
			hydratedForPubkey: ownerPubkey,
		};
		return;
	}
	if (!storage) return;
	if (!raw) {
		recoveryState = { ...recoveryState, records: [], hydratedForPubkey: ownerPubkey, error: null };
		return;
	}
	try {
		if (new TextEncoder().encode(raw).byteLength > PUBLICATION_RECOVERY_LIMITS.maxRecordBytes) {
			throw new Error('Stored recovery state is too large');
		}
		const envelope = requireObject(JSON.parse(raw), 'Stored recovery state');
		assertAllowedKeys(envelope, ['version', 'records']);
		if (envelope.version !== SCHEMA_VERSION || !Array.isArray(envelope.records)) {
			throw new Error('Unsupported recovery state');
		}
		if (envelope.records.length > PUBLICATION_RECOVERY_LIMITS.maxRecords) {
			throw new Error('Too many recovery records');
		}
		const records = envelope.records
			.map(validateRecord)
			.filter((record) => record.context.ownerPubkey === ownerPubkey);
		recoveryState = {
			records,
			retryingEventIds: new Set(),
			error: null,
			hydratedForPubkey: ownerPubkey,
		};
		persistRecords(records, 'Unable to sanitize browser recovery state');
	} catch {
		try {
			storage.removeItem(PUBLICATION_RECOVERY_STORAGE_KEY);
		} catch {
			// Logout and in-memory cleanup must continue when storage is inaccessible.
		}
		recoveryState = {
			records: [],
			retryingEventIds: new Set(),
			error: 'Stored relay recovery state was invalid and was removed.',
			hydratedForPubkey: ownerPubkey,
		};
	}
}

export function removePublicationRecovery(eventId: string) {
	const next = recoveryState.records.filter(({ event }) => event.id !== eventId);
	persistRecords(next, `Unable to remove browser recovery state for event ${eventId}`);
}

export function clearPublicationRecovery() {
	try {
		getSessionStorage()?.removeItem(PUBLICATION_RECOVERY_STORAGE_KEY);
	} catch {
		// Authentication teardown must not be blocked by inaccessible session storage.
	} finally {
		recoveryState = {
			records: [],
			retryingEventIds: new Set(),
			error: null,
			hydratedForPubkey: null,
		};
	}
}

export function setPublicationRetrying(eventId: string, retrying: boolean) {
	const next = new Set(recoveryState.retryingEventIds);
	if (retrying) next.add(eventId);
	else next.delete(eventId);
	recoveryState = { ...recoveryState, retryingEventIds: next };
}

export function setPublicationRecoveryError(error: string | null) {
	recoveryState = { ...recoveryState, error };
}

function persistRecords(records: BrowserRecoveryRecord[], errorMessage: string) {
	if (records.length > PUBLICATION_RECOVERY_LIMITS.maxRecords)
		throw new Error('Too many recovery records');
	const storage = getSessionStorage();
	if (!storage) throw new Error(`${errorMessage}: session storage is unavailable`);
	try {
		if (records.length === 0) storage.removeItem(PUBLICATION_RECOVERY_STORAGE_KEY);
		else {
			const serialized = JSON.stringify({ version: SCHEMA_VERSION, records });
			if (
				new TextEncoder().encode(serialized).byteLength > PUBLICATION_RECOVERY_LIMITS.maxRecordBytes
			) {
				throw new Error('Recovery state exceeds the storage limit');
			}
			storage.setItem(PUBLICATION_RECOVERY_STORAGE_KEY, serialized);
		}
		recoveryState = { ...recoveryState, records, error: null };
	} catch (error) {
		throw new Error(`${errorMessage}: ${error instanceof Error ? error.message : String(error)}`);
	}
}

function validateRecord(value: unknown): BrowserRecoveryRecord {
	const record = requireObject(value, 'Recovery record');
	assertAllowedKeys(record, ['version', 'event', 'context', 'report', 'createdAt', 'updatedAt']);
	if (record.version !== SCHEMA_VERSION) throw new Error('Unsupported recovery record');
	const context = validateContext(record.context);
	const event = validateEvent(record.event, context.ownerPubkey);
	const report = validateReport(record.report, event.id);
	if (
		typeof record.createdAt !== 'number' ||
		typeof record.updatedAt !== 'number' ||
		!Number.isSafeInteger(record.createdAt) ||
		!Number.isSafeInteger(record.updatedAt) ||
		record.createdAt <= 0 ||
		record.updatedAt < record.createdAt ||
		record.createdAt > Date.now() + 60_000 ||
		record.updatedAt > Date.now() + 60_000 ||
		Date.now() - record.updatedAt > PUBLICATION_RECOVERY_LIMITS.maxAgeMs
	) {
		throw new Error('Invalid recovery timestamps');
	}
	return {
		version: SCHEMA_VERSION,
		event,
		context,
		report,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
	};
}

function validateContext(value: unknown): PublicationContext {
	const context = requireObject(value, 'Recovery context');
	assertAllowedKeys(context, ['ownerPubkey', 'project', 'environment']);
	if (typeof context.ownerPubkey !== 'string' || !PUBKEY_PATTERN.test(context.ownerPubkey)) {
		throw new Error('Invalid recovery owner');
	}
	if (
		context.project !== undefined &&
		(typeof context.project !== 'string' || context.project.length > 64)
	) {
		throw new Error('Invalid recovery project');
	}
	if (
		context.environment !== undefined &&
		(typeof context.environment !== 'string' || context.environment.length > 64)
	) {
		throw new Error('Invalid recovery environment');
	}
	return {
		ownerPubkey: context.ownerPubkey,
		...(typeof context.project === 'string' ? { project: context.project } : {}),
		...(typeof context.environment === 'string' ? { environment: context.environment } : {}),
	};
}

function validateEvent(value: unknown, ownerPubkey: string) {
	const object = requireObject(value, 'Recovery event');
	assertAllowedKeys(object, ['id', 'pubkey', 'created_at', 'kind', 'tags', 'content', 'sig']);
	const event = toPlainEvent(object as unknown as NostrEvent);
	validateEventForOwner(event, ownerPubkey);
	return event;
}

function validateEventForOwner(event: NostrEvent, ownerPubkey: string) {
	if (
		!EVENT_ID_PATTERN.test(event.id) ||
		event.id !== getEventHash(event) ||
		!verifyEvent(toPlainEvent(event))
	) {
		throw new Error('Invalid recovery event signature or ID');
	}
	if (event.kind !== 1059)
		throw new Error('Recovery events must be encrypted kind 1059 Gift Wraps');
	validateGiftWrapEnvelope(event, ownerPubkey);
}

function validateReport(value: unknown, eventId: string): QuorumReport<string> {
	const report = requireObject(value, 'Recovery report');
	assertAllowedKeys(report, ['operationId', 'required', 'accepted', 'failed', 'outcomes']);
	if (report.operationId !== eventId || !Array.isArray(report.outcomes)) {
		throw new Error('Recovery report event ID or outcomes are invalid');
	}
	if (
		report.outcomes.length === 0 ||
		report.outcomes.length > PUBLICATION_RECOVERY_LIMITS.maxRelays
	) {
		throw new Error('Recovery report relay count is invalid');
	}
	const outcomes: QuorumReport<string>['outcomes'] = report.outcomes.map((value) => {
		const outcome = requireObject(value, 'Recovery outcome');
		assertAllowedKeys(outcome, ['target', 'state', 'reason']);
		if (typeof outcome.target !== 'string') throw new Error('Invalid recovery relay');
		if (
			outcome.state !== 'accepted' &&
			outcome.state !== 'rejected' &&
			outcome.state !== 'unavailable'
		) {
			throw new Error('Invalid recovery outcome state');
		}
		if (
			outcome.reason !== undefined &&
			(typeof outcome.reason !== 'string' ||
				outcome.reason.length > PUBLICATION_RECOVERY_LIMITS.maxReasonLength ||
				sanitizeRelayReason(outcome.reason) !== outcome.reason)
		) {
			throw new Error('Invalid recovery outcome reason');
		}
		if (outcome.state !== 'accepted' && !outcome.reason)
			throw new Error('Failed outcome requires a reason');
		return {
			target: outcome.target,
			state: outcome.state,
			...(typeof outcome.reason === 'string' ? { reason: outcome.reason } : {}),
		};
	});
	const normalized = normalizePublicationRelayUrls(outcomes.map(({ target }) => target));
	if (normalized.some((target, index) => target !== outcomes[index]?.target)) {
		throw new Error('Recovery relays must be normalized');
	}
	const derived = reportFromOutcomes(eventId, outcomes);
	if (report.required !== derived.required) throw new Error('Invalid recovery quorum threshold');
	if (JSON.stringify(report.accepted) !== JSON.stringify(derived.accepted)) {
		throw new Error('Inconsistent recovery accepted relays');
	}
	if (JSON.stringify(report.failed) !== JSON.stringify(derived.failed)) {
		throw new Error('Inconsistent recovery failed relays');
	}
	return derived;
}

function reportFromOutcomes(
	operationId: string,
	outcomes: QuorumReport<string>['outcomes'],
): QuorumReport<string> {
	return {
		operationId,
		required: Math.floor(outcomes.length / 2) + 1,
		accepted: outcomes.filter(({ state }) => state === 'accepted').map(({ target }) => target),
		failed: outcomes
			.filter(({ state }) => state !== 'accepted')
			.map(({ target, reason }) => ({ target, reason: reason ?? 'Unknown failure' })),
		outcomes,
	};
}

export function normalizePublicationRelayUrls(relays: string[]) {
	if (relays.length === 0 || relays.length > PUBLICATION_RECOVERY_LIMITS.maxRelays) {
		throw new Error('Invalid recovery relay count');
	}
	const normalized = new Set<string>();
	for (const relay of relays) {
		const url = new URL(relay);
		const localPlaintext =
			url.protocol === 'ws:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
		if (url.username || url.password || (url.protocol !== 'wss:' && !localPlaintext)) {
			throw new Error('Invalid recovery relay URL');
		}
		normalized.add(url.href);
	}
	if (normalized.size !== relays.length) throw new Error('Duplicate recovery relay URL');
	return [...normalized];
}

export function isExactPublicationEvent(candidate: NostrEvent, expected: NostrEvent) {
	const plainCandidate = toPlainEvent(candidate);
	return (
		candidate.id === expected.id &&
		verifyEvent(plainCandidate) &&
		JSON.stringify(plainCandidate) === JSON.stringify(toPlainEvent(expected))
	);
}

function toPlainEvent(event: NostrEvent): NostrEvent {
	return {
		id: event.id,
		pubkey: event.pubkey,
		created_at: event.created_at,
		kind: event.kind,
		tags: event.tags.map((tag) => [...tag]),
		content: event.content,
		sig: event.sig,
	};
}

function requireRecord(eventId: string) {
	const record = getPublicationRecoveryRecord(eventId);
	if (!record) throw new Error(`Publication recovery record not found: ${eventId}`);
	return record;
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`${label} must be an object`);
	return value as Record<string, unknown>;
}

function assertAllowedKeys(value: Record<string, unknown>, allowed: string[]) {
	for (const key of Object.keys(value)) {
		if (!allowed.includes(key)) throw new Error(`Unexpected recovery field: ${key}`);
	}
}

function getSessionStorage() {
	return typeof sessionStorage === 'undefined' ? null : sessionStorage;
}
