import type { SecretBundle, UnwrapResult } from './types.js';
import { parseDTag } from './utils.js';

const EVENT_ID_PATTERN = /^[0-9a-f]{64}$/;
const DANGEROUS_SECRET_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const UTF8_ENCODER = new TextEncoder();
const CURSOR_PATTERN = /^v1\.(0|[1-9][0-9]*)\.([0-9a-f]{64})$/;

export const HISTORY_LIMITS = {
	maxObservedEvents: 1_000,
	maxVersionsPerDTag: 200,
	maxSecretsPerVersion: 4_096,
	maxTotalSecrets: 65_536,
	maxSecretKeyLength: 256,
	maxSecretValueBytes: 64 * 1024,
	maxTotalSecretBytes: 16 * 1024 * 1024,
	maxCiphertextBytes: 16 * 1024 * 1024,
	defaultPageSize: 20,
	maxPageSize: 100,
	maxCursorLength: 90,
} as const;

export interface SecretHistoryVersion {
	eventId: string;
	dTag: string;
	createdAt: number;
	secrets: SecretBundle;
	tombstone: boolean;
	current: boolean;
}

export interface SecretHistoryObservation {
	versions: SecretHistoryVersion[];
	observedEvents: number;
	truncated: boolean;
}

export interface SecretHistoryDiff {
	added: string[];
	removed: string[];
	changed: string[];
	unchanged: string[];
}

export interface SecretHistoryPage {
	items: SecretHistoryVersion[];
	nextCursor: string | null;
	truncated: boolean;
	observedEvents: number;
}

export interface HistoryCursor {
	createdAt: number;
	eventId: string;
}

export function createSecretHistoryObservation(
	input: UnwrapResult[],
	observedEvents: number,
	outerTruncated: boolean,
): SecretHistoryObservation {
	if (!Number.isSafeInteger(observedEvents) || observedEvents < 0) {
		throw new Error('Invalid observed history event count');
	}
	if (typeof outerTruncated !== 'boolean') throw new Error('Invalid history truncation marker');
	if (input.length > HISTORY_LIMITS.maxObservedEvents) {
		throw new Error('Secret history input exceeds the fixed observation bound');
	}

	const deduplicated = new Map<string, UnwrapResult>();
	let expectedDTag: string | null = null;
	let expectedPubkey: string | null = null;
	let totalSecrets = 0;
	let totalSecretBytes = 0;
	for (const candidate of input) {
		const metrics = validateHistoryInput(candidate);
		totalSecrets += metrics.secretCount;
		totalSecretBytes += metrics.secretBytes;
		if (
			totalSecrets > HISTORY_LIMITS.maxTotalSecrets ||
			totalSecretBytes > HISTORY_LIMITS.maxTotalSecretBytes
		) {
			throw new Error('Secret history aggregate exceeds the fixed resource bound');
		}
		if (expectedDTag === null) expectedDTag = candidate.dTag;
		if (expectedPubkey === null) expectedPubkey = candidate.pubkey;
		if (candidate.dTag !== expectedDTag) {
			throw new Error('Secret history observation must contain one d-tag');
		}
		if (candidate.pubkey !== expectedPubkey) {
			throw new Error('Secret history observation must contain one authenticated owner');
		}
		const existing = deduplicated.get(candidate.eventId);
		if (existing) {
			if (!sameUnwrapResult(existing, candidate)) {
				throw new Error('Duplicate history event ID has inconsistent authenticated state');
			}
			continue;
		}
		deduplicated.set(candidate.eventId, candidate);
	}

	const sorted = [...deduplicated.values()].sort(compareHistoryOrder);
	const versionCapReached = sorted.length > HISTORY_LIMITS.maxVersionsPerDTag;
	const retained = sorted.slice(0, HISTORY_LIMITS.maxVersionsPerDTag);
	const versions = retained.map((candidate, index) => ({
		eventId: candidate.eventId,
		dTag: candidate.dTag,
		createdAt: candidate.createdAt,
		secrets: { ...candidate.secrets },
		tombstone: Object.keys(candidate.secrets).length === 0,
		current: index === 0,
	}));

	return {
		versions,
		observedEvents,
		truncated:
			outerTruncated || observedEvents >= HISTORY_LIMITS.maxObservedEvents || versionCapReached,
	};
}

export function compareSecretHistoryVersions(
	from: Pick<SecretHistoryVersion, 'dTag' | 'secrets'> | Pick<UnwrapResult, 'dTag' | 'secrets'>,
	to: Pick<SecretHistoryVersion, 'dTag' | 'secrets'> | Pick<UnwrapResult, 'dTag' | 'secrets'>,
): SecretHistoryDiff {
	if (from.dTag !== to.dTag) throw new Error('History comparison requires the same d-tag');
	validateSecretMap(from.secrets);
	validateSecretMap(to.secrets);

	const added: string[] = [];
	const removed: string[] = [];
	const changed: string[] = [];
	const unchanged: string[] = [];
	const keys = [...new Set([...Object.keys(from.secrets), ...Object.keys(to.secrets)])].sort(
		compareCanonical,
	);
	for (const key of keys) {
		const inFrom = Object.hasOwn(from.secrets, key);
		const inTo = Object.hasOwn(to.secrets, key);
		if (!inFrom && inTo) added.push(key);
		else if (inFrom && !inTo) removed.push(key);
		else if (from.secrets[key] === to.secrets[key]) unchanged.push(key);
		else changed.push(key);
	}
	return { added, removed, changed, unchanged };
}

export function createHistoryCursor(version: Pick<SecretHistoryVersion, 'createdAt' | 'eventId'>) {
	validateHistoryIdentity(version.createdAt, version.eventId);
	return `v1.${version.createdAt}.${version.eventId}`;
}

export function decodeHistoryCursor(cursor: string): HistoryCursor {
	if (
		typeof cursor !== 'string' ||
		cursor.length === 0 ||
		cursor.length > HISTORY_LIMITS.maxCursorLength
	) {
		throw new Error('Invalid history cursor');
	}
	const match = CURSOR_PATTERN.exec(cursor);
	if (!match) throw new Error('Invalid history cursor');
	const createdAt = Number(match[1]);
	const eventId = match[2];
	if (!eventId) throw new Error('Invalid history cursor');
	validateHistoryIdentity(createdAt, eventId);
	return { createdAt, eventId };
}

export function paginateSecretHistory(
	observation: SecretHistoryObservation,
	options: { limit?: number; cursor?: string } = {},
): SecretHistoryPage {
	const limit = options.limit ?? HISTORY_LIMITS.defaultPageSize;
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > HISTORY_LIMITS.maxPageSize) {
		throw new Error(`History page limit must be between 1 and ${HISTORY_LIMITS.maxPageSize}`);
	}
	let start = 0;
	if (options.cursor !== undefined) {
		const cursor = decodeHistoryCursor(options.cursor);
		const index = observation.versions.findIndex(
			(version) => version.createdAt === cursor.createdAt && version.eventId === cursor.eventId,
		);
		if (index < 0) throw new Error('History cursor is stale or outside the observed result');
		start = index + 1;
	}
	const items = observation.versions.slice(start, start + limit).map(cloneVersion);
	const hasMore = start + items.length < observation.versions.length;
	return {
		items,
		nextCursor: hasMore && items.length > 0 ? createHistoryCursor(items[items.length - 1]!) : null,
		truncated: observation.truncated,
		observedEvents: observation.observedEvents,
	};
}

function compareHistoryOrder(left: UnwrapResult, right: UnwrapResult) {
	if (left.createdAt !== right.createdAt) return right.createdAt - left.createdAt;
	return compareCanonical(left.eventId, right.eventId);
}

function compareCanonical(left: string, right: string) {
	return left < right ? -1 : left > right ? 1 : 0;
}

function validateHistoryInput(candidate: UnwrapResult) {
	if (!candidate || typeof candidate !== 'object')
		throw new Error('Invalid secret history version');
	if (!parseDTag(candidate.dTag)) throw new Error('Invalid secret history d-tag');
	if (!EVENT_ID_PATTERN.test(candidate.pubkey)) throw new Error('Invalid secret history owner');
	validateHistoryIdentity(candidate.createdAt, candidate.eventId);
	return validateSecretMap(candidate.secrets);
}

function validateHistoryIdentity(createdAt: number, eventId: string) {
	if (!Number.isSafeInteger(createdAt) || createdAt < 0) {
		throw new Error('Invalid secret history timestamp');
	}
	if (typeof eventId !== 'string' || !EVENT_ID_PATTERN.test(eventId)) {
		throw new Error('Invalid secret history event ID');
	}
}

function validateSecretMap(secrets: SecretBundle) {
	if (!secrets || typeof secrets !== 'object' || Array.isArray(secrets)) {
		throw new Error('Invalid secret history bundle');
	}
	const entries = Object.entries(secrets);
	if (entries.length > HISTORY_LIMITS.maxSecretsPerVersion) {
		throw new Error('Secret history bundle exceeds the key-count bound');
	}
	let secretBytes = 0;
	for (const [key, value] of entries) {
		const keyBytes = UTF8_ENCODER.encode(key).length;
		if (
			typeof value !== 'string' ||
			keyBytes === 0 ||
			keyBytes > HISTORY_LIMITS.maxSecretKeyLength ||
			DANGEROUS_SECRET_KEYS.has(key)
		) {
			throw new Error('Invalid secret history bundle');
		}
		const valueBytes = UTF8_ENCODER.encode(value).length;
		if (valueBytes > HISTORY_LIMITS.maxSecretValueBytes) {
			throw new Error('Secret history value exceeds the byte bound');
		}
		secretBytes += keyBytes + valueBytes;
	}
	return { secretCount: entries.length, secretBytes };
}

function sameUnwrapResult(left: UnwrapResult, right: UnwrapResult) {
	if (
		left.dTag !== right.dTag ||
		left.pubkey !== right.pubkey ||
		left.createdAt !== right.createdAt
	) {
		return false;
	}
	const leftEntries = Object.entries(left.secrets).sort(([a], [b]) => compareCanonical(a, b));
	const rightEntries = Object.entries(right.secrets).sort(([a], [b]) => compareCanonical(a, b));
	return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

function cloneVersion(version: SecretHistoryVersion): SecretHistoryVersion {
	return { ...version, secrets: { ...version.secrets } };
}
