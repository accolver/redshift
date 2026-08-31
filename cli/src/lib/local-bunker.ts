/**
 * Local NIP-46 bunker prototype helpers.
 *
 * This module intentionally contains the signer/request core only. Relay
 * subscription, interactive approvals, and persistent grant storage remain
 * documented follow-up work for the preview bunker.
 */

import type { Event, EventTemplate, VerifiedEvent } from 'nostr-tools/core';
import { nip44 } from 'nostr-tools';
import { getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import { toBunkerURL, type BunkerPointer } from 'nostr-tools/nip46';

export const NIP46_EVENT_KIND = 24133;

export type LocalBunkerPermission =
	| 'connect'
	| 'get_public_key'
	| 'ping'
	| 'sign_event'
	| 'nip44_encrypt'
	| 'nip44_decrypt';

export interface LocalBunkerPolicy {
	allowedMethods: LocalBunkerPermission[];
	allowedEventKinds: number[];
}

export interface LocalBunkerConfig {
	signerSecretKey: Uint8Array;
	relays: string[];
	secret?: string;
	policy?: Partial<LocalBunkerPolicy>;
}

export interface LocalBunkerPrototype {
	pubkey: string;
	pointer: BunkerPointer;
	url: string;
	policy: LocalBunkerPolicy;
}

interface Nip46Request {
	id: string;
	method: LocalBunkerPermission;
	params: string[];
}

interface Nip46Response {
	id: string;
	result: string;
	error: string;
}

const DEFAULT_ALLOWED_METHODS: LocalBunkerPermission[] = [
	'connect',
	'get_public_key',
	'ping',
	'sign_event',
	'nip44_encrypt',
	'nip44_decrypt',
];

const DEFAULT_ALLOWED_EVENT_KINDS = [5, 1059, 30078];

export function createLocalBunkerPrototype(config: LocalBunkerConfig): LocalBunkerPrototype {
	const pubkey = getPublicKey(config.signerSecretKey);
	const pointer: BunkerPointer = {
		pubkey,
		relays: config.relays,
		secret: config.secret ?? null,
	};

	return {
		pubkey,
		pointer,
		url: toBunkerURL(pointer),
		policy: normalizePolicy(config.policy),
	};
}

export async function handleLocalBunkerRequest(
	requestEvent: Event,
	signerSecretKey: Uint8Array,
	policy: Partial<LocalBunkerPolicy> = {},
): Promise<VerifiedEvent> {
	if (requestEvent.kind !== NIP46_EVENT_KIND) {
		throw new Error(`Expected NIP-46 kind ${NIP46_EVENT_KIND}, got ${requestEvent.kind}`);
	}

	const request = decryptRequest(requestEvent, signerSecretKey);
	const normalizedPolicy = normalizePolicy(policy);
	const response = await executeRequest(request, requestEvent.pubkey, signerSecretKey, normalizedPolicy);
	const content = encryptResponse(response, requestEvent.pubkey, signerSecretKey);

	const template: EventTemplate = {
		kind: NIP46_EVENT_KIND,
		created_at: nowSeconds(),
		tags: [['p', requestEvent.pubkey]],
		content,
	};

	return finalizeEvent(template, signerSecretKey);
}

export function createLocalBunkerRequestEvent(
	request: Nip46Request,
	clientSecretKey: Uint8Array,
	bunkerPubkey: string,
): VerifiedEvent {
	const conversationKey = nip44.getConversationKey(clientSecretKey, bunkerPubkey);
	const content = nip44.encrypt(JSON.stringify(request), conversationKey);
	return finalizeEvent(
		{
			kind: NIP46_EVENT_KIND,
			created_at: nowSeconds(),
			tags: [['p', bunkerPubkey]],
			content,
		},
		clientSecretKey,
	);
}

export function decryptLocalBunkerResponse(
	responseEvent: Event,
	clientSecretKey: Uint8Array,
	bunkerPubkey: string,
): Nip46Response {
	const conversationKey = nip44.getConversationKey(clientSecretKey, bunkerPubkey);
	return parseResponse(nip44.decrypt(responseEvent.content, conversationKey));
}

function normalizePolicy(policy: Partial<LocalBunkerPolicy> = {}): LocalBunkerPolicy {
	return {
		allowedMethods: policy.allowedMethods ?? DEFAULT_ALLOWED_METHODS,
		allowedEventKinds: policy.allowedEventKinds ?? DEFAULT_ALLOWED_EVENT_KINDS,
	};
}

async function executeRequest(
	request: Nip46Request,
	clientPubkey: string,
	signerSecretKey: Uint8Array,
	policy: LocalBunkerPolicy,
): Promise<Nip46Response> {
	if (!policy.allowedMethods.includes(request.method)) {
		return errorResponse(request.id, `method not allowed: ${request.method}`);
	}

	switch (request.method) {
		case 'connect':
			return { id: request.id, result: 'ack', error: '' };
		case 'ping':
			return { id: request.id, result: 'pong', error: '' };
		case 'get_public_key':
			return { id: request.id, result: getPublicKey(signerSecretKey), error: '' };
		case 'sign_event':
			return signEventResponse(request, signerSecretKey, policy);
		case 'nip44_encrypt':
			return cryptResponse(request, signerSecretKey, true);
		case 'nip44_decrypt':
			return cryptResponse(request, signerSecretKey, false);
		default:
			return errorResponse(request.id, `unsupported method for ${clientPubkey}`);
	}
}

function signEventResponse(
	request: Nip46Request,
	signerSecretKey: Uint8Array,
	policy: LocalBunkerPolicy,
): Nip46Response {
	const event = parseEventTemplate(request.params[0] ?? '');
	if (!policy.allowedEventKinds.includes(event.kind)) {
		return errorResponse(request.id, `event kind not allowed: ${event.kind}`);
	}

	const signed = finalizeEvent(event, signerSecretKey);
	return { id: request.id, result: JSON.stringify(signed), error: '' };
}

function cryptResponse(request: Nip46Request, signerSecretKey: Uint8Array, encrypt: boolean): Nip46Response {
	const thirdPartyPubkey = request.params[0];
	const payload = request.params[1];
	if (!thirdPartyPubkey || !payload) {
		return errorResponse(request.id, 'missing pubkey or payload');
	}

	const conversationKey = nip44.getConversationKey(signerSecretKey, thirdPartyPubkey);
	const result = encrypt ? nip44.encrypt(payload, conversationKey) : nip44.decrypt(payload, conversationKey);
	return { id: request.id, result, error: '' };
}

function decryptRequest(requestEvent: Event, signerSecretKey: Uint8Array): Nip46Request {
	const conversationKey = nip44.getConversationKey(signerSecretKey, requestEvent.pubkey);
	return parseRequest(nip44.decrypt(requestEvent.content, conversationKey));
}

function encryptResponse(
	response: Nip46Response,
	clientPubkey: string,
	signerSecretKey: Uint8Array,
): string {
	const conversationKey = nip44.getConversationKey(signerSecretKey, clientPubkey);
	return nip44.encrypt(JSON.stringify(response), conversationKey);
}

function parseRequest(json: string): Nip46Request {
	const parsed: unknown = JSON.parse(json);
	if (!isRecord(parsed) || typeof parsed.id !== 'string' || typeof parsed.method !== 'string') {
		throw new Error('Invalid NIP-46 request');
	}
	if (!isLocalBunkerPermission(parsed.method)) {
		throw new Error(`Unsupported NIP-46 method: ${parsed.method}`);
	}
	if (!Array.isArray(parsed.params) || !parsed.params.every((param) => typeof param === 'string')) {
		throw new Error('Invalid NIP-46 params');
	}
	return { id: parsed.id, method: parsed.method, params: parsed.params };
}

function parseResponse(json: string): Nip46Response {
	const parsed: unknown = JSON.parse(json);
	if (
		!isRecord(parsed) ||
		typeof parsed.id !== 'string' ||
		typeof parsed.result !== 'string' ||
		typeof parsed.error !== 'string'
	) {
		throw new Error('Invalid NIP-46 response');
	}
	return { id: parsed.id, result: parsed.result, error: parsed.error };
}

function parseEventTemplate(json: string): EventTemplate {
	const parsed: unknown = JSON.parse(json);
	if (
		!isRecord(parsed) ||
		typeof parsed.kind !== 'number' ||
		typeof parsed.content !== 'string' ||
		typeof parsed.created_at !== 'number' ||
		!Array.isArray(parsed.tags)
	) {
		throw new Error('Invalid event template');
	}
	if (!parsed.tags.every(isTag)) {
		throw new Error('Invalid event tags');
	}
	return {
		kind: parsed.kind,
		content: parsed.content,
		created_at: parsed.created_at,
		tags: parsed.tags,
	};
}

function isTag(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isLocalBunkerPermission(value: string): value is LocalBunkerPermission {
	return DEFAULT_ALLOWED_METHODS.includes(value as LocalBunkerPermission);
}

function errorResponse(id: string, error: string): Nip46Response {
	return { id, result: '', error };
}

function nowSeconds() {
	return Math.floor(Date.now() / 1000);
}
