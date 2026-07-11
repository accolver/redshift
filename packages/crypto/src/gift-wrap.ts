/**
 * NIP-59 Gift Wrap implementation for Redshift.
 *
 * Secret state is accepted only when the authenticated recipient, verified
 * seal author, and decrypted rumor author are the same Redshift owner.
 */

import { nip44 } from 'nostr-tools';
import type { Event as NostrToolsEvent } from 'nostr-tools/core';
import { createRumor, createSeal } from 'nostr-tools/nip59';
import {
	finalizeEvent,
	generateSecretKey,
	getEventHash,
	getPublicKey,
	verifyEvent,
} from 'nostr-tools/pure';
import type {
	GiftWrapResult,
	NostrEvent,
	SecretBundle,
	SecretVersion,
	UnwrapResult,
} from './types.js';
import { NostrKinds, REDSHIFT_TYPE_TAG } from './types.js';
import { parseDTag } from './utils.js';

const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60;
export const MAX_RUMOR_FUTURE_SKEW_SECONDS = 300;
const CANONICAL_PUBKEY = /^[0-9a-f]{64}$/;

/** Keys that must not appear in parsed secret bundles. */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export interface WrapOptions {
	/** Explicit inner timestamp for monotonic replacement/tombstone writes. */
	createdAt?: number;
}

export interface UnwrapOptions {
	/** Injectable current Unix time for deterministic validation tests. */
	now?: number;
}

interface RumorRecord {
	pubkey: string;
	created_at: number;
	kind: number;
	tags: string[][];
	content: string;
}

const randomNow = () => {
	const randomBytes = generateSecretKey();
	try {
		const view = new DataView(randomBytes.buffer, randomBytes.byteOffset, randomBytes.byteLength);
		const offset = view.getUint32(0);
		return Math.round(Date.now() / 1000 - (offset % TWO_DAYS_SECONDS));
	} finally {
		randomBytes.fill(0);
	}
};

function validatePrivateKey(key: Uint8Array): void {
	if (!(key instanceof Uint8Array) || key.length !== 32) {
		throw new Error('Private key must be a 32-byte Uint8Array');
	}
}

function assertCanonicalPubkey(value: unknown, label: string): asserts value is string {
	if (typeof value !== 'string' || !CANONICAL_PUBKEY.test(value)) {
		throw new Error(`Invalid ${label}: expected a lowercase 64-character hex pubkey`);
	}
}

function assertTimestamp(value: unknown, label: string): asserts value is number {
	if (!Number.isSafeInteger(value) || (value as number) < 0) {
		throw new Error(`Invalid ${label}: expected a non-negative safe integer`);
	}
}

function assertTags(value: unknown, label: string): asserts value is string[][] {
	if (
		!Array.isArray(value) ||
		value.some(
			(tag) => !Array.isArray(tag) || tag.some((part: unknown) => typeof part !== 'string'),
		)
	) {
		throw new Error(`Invalid ${label}: expected string-array tags`);
	}
}

function parseJsonObject(value: string, errorMessage: string): Record<string, unknown> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw new Error(errorMessage);
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error(errorMessage);
	}
	return parsed as Record<string, unknown>;
}

function validateSecretBundle(value: unknown): SecretBundle {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Invalid secret bundle: expected an object');
	}

	for (const [key, secret] of Object.entries(value as Record<string, unknown>)) {
		if (DANGEROUS_KEYS.has(key)) {
			throw new Error(`Invalid secret bundle: forbidden key "${key}"`);
		}
		if (typeof secret !== 'string') {
			throw new Error('Invalid secret bundle: all values must be strings');
		}
	}

	return value as SecretBundle;
}

function resolveCreatedAt(options?: WrapOptions) {
	const createdAt = options?.createdAt ?? Math.floor(Date.now() / 1000);
	assertTimestamp(createdAt, 'rumor timestamp');
	return createdAt;
}

function resolveNow(options?: UnwrapOptions) {
	const now = options?.now ?? Math.floor(Date.now() / 1000);
	assertTimestamp(now, 'current timestamp');
	return now;
}

export function validateGiftWrapEnvelope(giftWrap: NostrEvent, expectedAuthor: string): void {
	assertCanonicalPubkey(expectedAuthor, 'expected author');
	if (giftWrap.kind !== NostrKinds.GIFT_WRAP) {
		throw new Error(`Invalid gift wrap event: expected kind ${NostrKinds.GIFT_WRAP}`);
	}
	if (!giftWrap.id || !giftWrap.pubkey || !giftWrap.sig) {
		throw new Error('Invalid gift wrap event: missing id, pubkey, or sig');
	}
	assertTags(giftWrap.tags, 'gift wrap tags');

	const recipientTags = giftWrap.tags.filter((tag) => tag[0] === 'p');
	if (recipientTags.length !== 1) {
		throw new Error('Invalid gift wrap recipient: expected exactly one p tag');
	}
	const recipient = recipientTags[0]?.[1];
	assertCanonicalPubkey(recipient, 'gift wrap recipient');
	if (recipient !== expectedAuthor) {
		throw new Error('Invalid gift wrap recipient: does not match authenticated owner');
	}

	const redshiftTypeTags = giftWrap.tags.filter(
		(tag) => tag[0] === 't' && tag[1] === REDSHIFT_TYPE_TAG,
	);
	if (redshiftTypeTags.length !== 1) {
		throw new Error('Invalid gift wrap event: expected exactly one redshift-secrets type tag');
	}

	const uncachedEvent: NostrToolsEvent = {
		id: giftWrap.id,
		pubkey: giftWrap.pubkey,
		created_at: giftWrap.created_at,
		kind: giftWrap.kind,
		tags: giftWrap.tags,
		content: giftWrap.content,
		sig: giftWrap.sig,
	};
	if (giftWrap.id !== getEventHash(uncachedEvent) || !verifyEvent(uncachedEvent)) {
		throw new Error('Invalid gift wrap event: signature verification failed');
	}
}

function parseAndValidateSeal(sealJson: string, expectedAuthor: string): NostrEvent {
	const seal = parseJsonObject(sealJson, 'Failed to decrypt seal: invalid JSON content');
	if (
		typeof seal.id !== 'string' ||
		typeof seal.pubkey !== 'string' ||
		typeof seal.sig !== 'string' ||
		typeof seal.kind !== 'number' ||
		typeof seal.created_at !== 'number' ||
		typeof seal.content !== 'string'
	) {
		throw new Error('Invalid seal event: missing id, pubkey, sig, kind, timestamp, or content');
	}
	assertTags(seal.tags, 'seal tags');
	if (seal.kind !== NostrKinds.SEAL) {
		throw new Error(`Invalid seal event: expected kind ${NostrKinds.SEAL}`);
	}
	assertCanonicalPubkey(seal.pubkey, 'seal author');
	assertTimestamp(seal.created_at, 'seal timestamp');
	if (!verifyEvent(seal as unknown as NostrToolsEvent)) {
		throw new Error('Invalid seal event: signature verification failed');
	}
	if (seal.pubkey !== expectedAuthor) {
		throw new Error('Invalid seal author: does not match authenticated owner');
	}
	return seal as unknown as NostrEvent;
}

function parseAndValidateRumor(
	rumorJson: string,
	expectedAuthor: string,
	sealAuthor: string,
	options?: UnwrapOptions,
): { rumor: RumorRecord; secrets: SecretBundle; dTag: string } {
	const value = parseJsonObject(rumorJson, 'Failed to decrypt rumor: invalid JSON content');
	if (
		typeof value.pubkey !== 'string' ||
		typeof value.created_at !== 'number' ||
		typeof value.kind !== 'number' ||
		typeof value.content !== 'string'
	) {
		throw new Error('Invalid rumor: missing pubkey, timestamp, kind, tags, or content');
	}
	assertTags(value.tags, 'rumor tags');
	assertCanonicalPubkey(value.pubkey, 'rumor author');
	assertTimestamp(value.created_at, 'rumor timestamp');

	if (value.pubkey !== sealAuthor || value.pubkey !== expectedAuthor) {
		throw new Error('Invalid rumor author: does not match seal and authenticated owner');
	}
	if (value.kind !== NostrKinds.SECRET_BUNDLE) {
		throw new Error(
			`Unexpected rumor kind: expected ${NostrKinds.SECRET_BUNDLE}, got ${value.kind}`,
		);
	}
	if (value.created_at > resolveNow(options) + MAX_RUMOR_FUTURE_SKEW_SECONDS) {
		throw new Error(
			`Invalid rumor timestamp: exceeds ${MAX_RUMOR_FUTURE_SKEW_SECONDS}-second future tolerance`,
		);
	}

	const dTags = value.tags.filter((tag) => tag[0] === 'd');
	const dTag = dTags[0]?.[1];
	if (dTags.length !== 1 || typeof dTag !== 'string' || !parseDTag(dTag)) {
		throw new Error('Invalid rumor d-tag: expected exactly one project|environment identifier');
	}

	let parsedSecrets: unknown;
	try {
		parsedSecrets = JSON.parse(value.content);
	} catch {
		throw new Error('Failed to parse secret bundle: invalid JSON content');
	}

	return {
		rumor: value as unknown as RumorRecord,
		secrets: validateSecretBundle(parsedSecrets),
		dTag,
	};
}

function toUnwrapResult(
	giftWrap: NostrEvent,
	rumor: RumorRecord,
	secrets: SecretBundle,
	dTag: string,
): UnwrapResult {
	return {
		secrets,
		dTag,
		createdAt: rumor.created_at,
		pubkey: rumor.pubkey,
		eventId: giftWrap.id,
	};
}

/** Convert a nostr-tools Event to the shared Redshift event type. */
export function toNostrEvent(event: NostrToolsEvent): NostrEvent {
	return {
		id: event.id,
		pubkey: event.pubkey,
		created_at: event.created_at,
		kind: event.kind,
		tags: event.tags,
		content: event.content,
		sig: event.sig,
	};
}

/**
 * Compare logical secret versions. A positive result means `candidate`
 * supersedes `current`. Equal timestamps use the lexicographically lowest
 * outer event ID, matching deterministic replaceable-event tie semantics.
 */
export function compareSecretVersions(candidate: SecretVersion, current: SecretVersion): number {
	if (candidate.createdAt !== current.createdAt) {
		return candidate.createdAt - current.createdAt;
	}
	if (candidate.eventId === current.eventId) return 0;
	return candidate.eventId < current.eventId ? 1 : -1;
}

/** Wrap secrets in a NIP-59 Gift Wrap addressed to the owner. */
export function wrapSecrets(
	secrets: SecretBundle,
	privateKey: Uint8Array,
	dTag: string,
	options?: WrapOptions,
): GiftWrapResult {
	validatePrivateKey(privateKey);
	validateSecretBundle(secrets);
	if (!dTag || !parseDTag(dTag)) {
		throw new Error('Invalid d-tag: must be in format "projectId|environment"');
	}

	const publicKey = getPublicKey(privateKey);
	const rumor = createRumor(
		{
			kind: NostrKinds.SECRET_BUNDLE,
			content: JSON.stringify(secrets),
			tags: [['d', dTag]],
			created_at: resolveCreatedAt(options),
		},
		privateKey,
	);
	const seal = createSeal(rumor, privateKey, publicKey);
	const ephemeralKey = generateSecretKey();
	try {
		const conversationKey = nip44.v2.utils.getConversationKey(ephemeralKey, publicKey);
		const encryptedSeal = nip44.v2.encrypt(JSON.stringify(seal), conversationKey);
		const giftWrap = finalizeEvent(
			{
				kind: NostrKinds.GIFT_WRAP,
				content: encryptedSeal,
				created_at: randomNow(),
				tags: [
					['p', publicKey],
					['t', REDSHIFT_TYPE_TAG],
				],
			},
			ephemeralKey,
		);
		return {
			event: toNostrEvent(giftWrap),
			rumor: {
				pubkey: rumor.pubkey,
				created_at: rumor.created_at,
				kind: rumor.kind,
				tags: rumor.tags,
				content: rumor.content,
			},
		};
	} finally {
		ephemeralKey.fill(0);
	}
}

/** Unwrap a Gift Wrap and return only the secret bundle. */
export function unwrapSecrets(
	giftWrap: NostrEvent,
	privateKey: Uint8Array,
	options?: UnwrapOptions,
): SecretBundle {
	return unwrapGiftWrap(giftWrap, privateKey, options).secrets;
}

/** Unwrap a Gift Wrap with authenticated owner and version metadata. */
export function unwrapGiftWrap(
	giftWrap: NostrEvent,
	privateKey: Uint8Array,
	options?: UnwrapOptions,
): UnwrapResult {
	validatePrivateKey(privateKey);
	const expectedAuthor = getPublicKey(privateKey);
	validateGiftWrapEnvelope(giftWrap, expectedAuthor);

	const outerConversationKey = nip44.v2.utils.getConversationKey(privateKey, giftWrap.pubkey);
	const sealJson = nip44.v2.decrypt(giftWrap.content, outerConversationKey);
	const seal = parseAndValidateSeal(sealJson, expectedAuthor);
	const innerConversationKey = nip44.v2.utils.getConversationKey(privateKey, seal.pubkey);
	const rumorJson = nip44.v2.decrypt(seal.content, innerConversationKey);
	const { rumor, secrets, dTag } = parseAndValidateRumor(
		rumorJson,
		expectedAuthor,
		seal.pubkey,
		options,
	);
	return toUnwrapResult(giftWrap, rumor, secrets, dTag);
}

/** Create a logical deletion tombstone. */
export function createTombstone(
	privateKey: Uint8Array,
	dTag: string,
	options?: WrapOptions,
): GiftWrapResult {
	validatePrivateKey(privateKey);
	return wrapSecrets({}, privateKey, dTag, options);
}

export type EncryptFn = (pubkey: string, plaintext: string) => Promise<string>;

export type SignFn = (event: {
	kind: number;
	created_at: number;
	tags: string[][];
	content: string;
}) => Promise<NostrEvent>;

export interface AsyncGiftWrapResult {
	event: NostrEvent;
	rumor: {
		pubkey: string;
		created_at: number;
		kind: number;
		tags: string[][];
		content: string;
	};
}

/** Wrap secrets through a NIP-07/NIP-46 signer. */
export async function wrapSecretsWithSigner(
	secrets: SecretBundle,
	pubkey: string,
	dTag: string,
	encryptFn: EncryptFn,
	signFn: SignFn,
	options?: WrapOptions,
): Promise<AsyncGiftWrapResult> {
	assertCanonicalPubkey(pubkey, 'signer public key');
	validateSecretBundle(secrets);
	if (!dTag || !parseDTag(dTag)) {
		throw new Error('Invalid d-tag: must be in format "projectId|environment"');
	}

	const rumor = {
		pubkey,
		created_at: resolveCreatedAt(options),
		kind: NostrKinds.SECRET_BUNDLE,
		tags: [['d', dTag]],
		content: JSON.stringify(secrets),
	};
	const sealContent = await encryptFn(pubkey, JSON.stringify(rumor));
	const seal = await signFn({
		created_at: randomNow(),
		kind: NostrKinds.SEAL,
		tags: [],
		content: sealContent,
	});
	parseAndValidateSeal(JSON.stringify(seal), pubkey);

	const ephemeralKey = generateSecretKey();
	try {
		const conversationKey = nip44.v2.utils.getConversationKey(ephemeralKey, pubkey);
		const encryptedSeal = nip44.v2.encrypt(JSON.stringify(seal), conversationKey);
		const giftWrap = finalizeEvent(
			{
				kind: NostrKinds.GIFT_WRAP,
				content: encryptedSeal,
				created_at: randomNow(),
				tags: [
					['p', pubkey],
					['t', REDSHIFT_TYPE_TAG],
				],
			},
			ephemeralKey,
		);
		return {
			event: toNostrEvent(giftWrap),
			rumor,
		};
	} finally {
		ephemeralKey.fill(0);
	}
}

export type DecryptFn = (pubkey: string, ciphertext: string) => Promise<string>;

/** Unwrap a Gift Wrap through a signer for an explicit authenticated owner. */
export async function unwrapGiftWrapWithSigner(
	giftWrap: NostrEvent,
	expectedAuthor: string,
	decryptFn: DecryptFn,
	options?: UnwrapOptions,
): Promise<UnwrapResult> {
	validateGiftWrapEnvelope(giftWrap, expectedAuthor);
	const sealJson = await decryptFn(giftWrap.pubkey, giftWrap.content);
	const seal = parseAndValidateSeal(sealJson, expectedAuthor);
	const rumorJson = await decryptFn(seal.pubkey, seal.content);
	const { rumor, secrets, dTag } = parseAndValidateRumor(
		rumorJson,
		expectedAuthor,
		seal.pubkey,
		options,
	);
	return toUnwrapResult(giftWrap, rumor, secrets, dTag);
}

/** Check whether an event advertises the Redshift Gift Wrap type. */
export function isRedshiftSecretsEvent(event: NostrEvent): boolean {
	return (
		event.kind === NostrKinds.GIFT_WRAP &&
		event.tags.some((tag) => tag[0] === 't' && tag[1] === REDSHIFT_TYPE_TAG)
	);
}

/** Return the owner-scoped filter used to query Redshift Gift Wraps. */
export function getRedshiftSecretsFilter(pubkey: string): {
	kinds: number[];
	'#p': string[];
	'#t': string[];
} {
	assertCanonicalPubkey(pubkey, 'filter owner');
	return {
		kinds: [NostrKinds.GIFT_WRAP],
		'#p': [pubkey],
		'#t': [REDSHIFT_TYPE_TAG],
	};
}
