/**
 * Minimal NIP-46 bunker request handler for the Redshift prototype.
 *
 * This module is intentionally protocol-focused and transport-agnostic so it can
 * be tested without relays. Relay subscription/publishing is a thin shell around
 * this handler.
 *
 * L4: Integration-Contractor - NIP-46 request/response contract
 */

import { nip44 } from 'nostr-tools';
import type { Event, EventTemplate } from 'nostr-tools/core';
import { SimplePool } from 'nostr-tools/pool';
import { finalizeEvent, getPublicKey, verifyEvent } from 'nostr-tools/pure';

export const NIP46_KIND = 24133;

export type Nip46Method =
	| 'connect'
	| 'get_public_key'
	| 'sign_event'
	| 'nip44_encrypt'
	| 'nip44_decrypt'
	| 'ping'
	| 'switch_relays';

export interface Nip46Request {
	id: string;
	method: string;
	params: string[];
}

export interface Nip46Response {
	id: string;
	result?: string;
	error?: string;
}

export interface Nip46BunkerService {
	close(): void;
}

export interface Nip46RelayPool {
	subscribeMany(
		relays: string[],
		filter: { kinds: number[]; '#p': string[] },
		handlers: { onevent: (event: Event) => void | Promise<void> },
	): { close(): void };
	publish(relays: string[], event: Event): Promise<unknown>[];
	close(relays: string[]): void;
}

export interface Nip46BunkerHandlerOptions {
	/** Transport key used to encrypt/decrypt NIP-46 request events. */
	signerSecretKey: Uint8Array;
	/** Identity key used for Redshift signing/NIP-44 operations. */
	userSecretKey: Uint8Array;
	/** Relays the signer wants clients to use after connection. */
	relays: string[];
	/** Optional single-use-ish connection secret for prototype authorization. */
	secret?: string;
	/** Event kinds the prototype is allowed to sign. Defaults to Redshift secret kinds. */
	allowedSignEventKinds?: number[];
	/** Injectable relay pool for tests. Defaults to nostr-tools SimplePool. */
	relayPool?: Nip46RelayPool;
}

export interface Nip46BunkerHandler {
	getSignerPublicKey(): string;
	getUserPublicKey(): string;
	handleRequest(clientPubkey: string, request: Nip46Request): Promise<Nip46Response>;
}

const SUPPORTED_METHODS = new Set<Nip46Method>([
	'connect',
	'get_public_key',
	'sign_event',
	'nip44_encrypt',
	'nip44_decrypt',
	'ping',
	'switch_relays',
]);

function isSupportedMethod(method: string): method is Nip46Method {
	return SUPPORTED_METHODS.has(method as Nip46Method);
}

function validateSecretKey(key: Uint8Array, name: string): void {
	if (!(key instanceof Uint8Array) || key.length !== 32) {
		throw new Error(`${name} must be a 32-byte Uint8Array`);
	}
}

export function encryptNip46Message(
	secretKey: Uint8Array,
	recipientPubkey: string,
	message: Nip46Request | Nip46Response,
): string {
	validateSecretKey(secretKey, 'secretKey');
	const conversationKey = nip44.v2.utils.getConversationKey(secretKey, recipientPubkey);
	return nip44.v2.encrypt(JSON.stringify(message), conversationKey);
}

export function decryptNip46Message(
	secretKey: Uint8Array,
	senderPubkey: string,
	content: string,
): Nip46Request | Nip46Response {
	validateSecretKey(secretKey, 'secretKey');
	const conversationKey = nip44.v2.utils.getConversationKey(secretKey, senderPubkey);
	const plaintext = nip44.v2.decrypt(content, conversationKey);
	const parsed: unknown = JSON.parse(plaintext);
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('NIP-46 message must be a JSON object');
	}
	return parsed as Nip46Request | Nip46Response;
}

function isStringTagArray(value: unknown): value is string[][] {
	return Array.isArray(value) && value.every((tag) => Array.isArray(tag) && tag.every((item) => typeof item === 'string'));
}

function asEventTemplate(value: string): EventTemplate {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw new Error('sign_event parameter must be valid JSON');
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('sign_event parameter must be an event object');
	}
	const event = parsed as Record<string, unknown>;
	if (typeof event.kind !== 'number') {
		throw new Error('sign_event event.kind must be a number');
	}
	if (typeof event.content !== 'string') {
		throw new Error('sign_event event.content must be a string');
	}
	if (!isStringTagArray(event.tags)) {
		throw new Error('sign_event event.tags must be an array of string arrays');
	}
	return {
		kind: event.kind,
		content: event.content,
		tags: event.tags,
		created_at:
			typeof event.created_at === 'number' ? event.created_at : Math.floor(Date.now() / 1000),
	};
}

function isNip46Request(message: Nip46Request | Nip46Response): message is Nip46Request {
	return typeof (message as Nip46Request).method === 'string' && Array.isArray((message as Nip46Request).params);
}

interface SessionPermissions {
	methods: Set<Nip46Method>;
	signEventKinds: Set<number>;
}

function parsePermissions(value: string | undefined, allowedSignEventKinds: Set<number>): SessionPermissions {
	const methods = new Set<Nip46Method>(['get_public_key', 'nip44_encrypt', 'nip44_decrypt', 'switch_relays']);
	const signEventKinds = new Set(allowedSignEventKinds);
	if (!value) return { methods, signEventKinds };
	methods.clear();
	signEventKinds.clear();
	for (const rawPermission of value.split(',')) {
		const permission = rawPermission.trim();
		if (!permission) continue;
		if (permission.startsWith('sign_event:')) {
			const kind = Number(permission.slice('sign_event:'.length));
			if (Number.isInteger(kind) && allowedSignEventKinds.has(kind)) {
				signEventKinds.add(kind);
			}
			continue;
		}
		if (isSupportedMethod(permission) && permission !== 'connect' && permission !== 'sign_event' && permission !== 'ping') {
			methods.add(permission);
		}
	}
	return { methods, signEventKinds };
}

function isPermittedDeletionTemplate(template: EventTemplate): boolean {
	const hasGiftWrapKindTag = template.tags.some((tag) => tag[0] === 'k' && tag[1] === '1059');
	return template.kind === 5 && hasGiftWrapKindTag && template.tags.every((tag) => {
		if (tag[0] === 'e') return /^[0-9a-f]{64}$/i.test(tag[1] ?? '');
		if (tag[0] === 'k') return tag[1] === '1059';
		return false;
	});
}

export function createNip46BunkerHandler(
	options: Nip46BunkerHandlerOptions,
): Nip46BunkerHandler {
	validateSecretKey(options.signerSecretKey, 'signerSecretKey');
	validateSecretKey(options.userSecretKey, 'userSecretKey');

	const signerPubkey = getPublicKey(options.signerSecretKey);
	const userPubkey = getPublicKey(options.userSecretKey);
	const allowedSignEventKinds = new Set(options.allowedSignEventKinds ?? [13, 5]);
	const sessions = new Set<string>();
	const permissionsByClient = new Map<string, SessionPermissions>();
	let secretConsumedBy: string | null = null;

	function requireSession(clientPubkey: string): Nip46Response | null {
		if (!sessions.has(clientPubkey)) {
			return { id: '', error: 'not connected' };
		}
		return null;
	}

	function requirePermission(clientPubkey: string, method: Nip46Method, kind?: number): void {
		if (method === 'ping') return;
		const permissions = permissionsByClient.get(clientPubkey);
		if (!permissions) throw new Error('not connected');
		if (method === 'sign_event') {
			if (kind === undefined || !permissions.signEventKinds.has(kind)) {
				throw new Error(`sign_event kind ${kind ?? 'unknown'} is not permitted`);
			}
			return;
		}
		if (!permissions.methods.has(method)) {
			throw new Error(`${method} is not permitted`);
		}
	}

	async function handleConnectedRequest(
		clientPubkey: string,
		request: Nip46Request,
	): Promise<Nip46Response> {
		switch (request.method) {
			case 'ping':
				return { id: request.id, result: 'pong' };
			case 'get_public_key':
				requirePermission(clientPubkey, 'get_public_key');
				return { id: request.id, result: userPubkey };
			case 'switch_relays':
				requirePermission(clientPubkey, 'switch_relays');
				return { id: request.id, result: JSON.stringify(options.relays) };
			case 'sign_event': {
				const eventJson = request.params[0];
				if (!eventJson) throw new Error('sign_event requires an event parameter');
				const template = asEventTemplate(eventJson);
				requirePermission(clientPubkey, 'sign_event', template.kind);
				if (template.kind === 5 && !isPermittedDeletionTemplate(template)) {
					throw new Error('sign_event kind 5 is only permitted for NIP-09 e-tag deletion requests');
				}
				const signed = finalizeEvent(template, options.userSecretKey);
				return { id: request.id, result: JSON.stringify(signed) };
			}
			case 'nip44_encrypt': {
				requirePermission(clientPubkey, 'nip44_encrypt');
				const [pubkey, plaintext] = request.params;
				if (!pubkey || plaintext === undefined) {
					throw new Error('nip44_encrypt requires pubkey and plaintext');
				}
				const conversationKey = nip44.v2.utils.getConversationKey(options.userSecretKey, pubkey);
				return { id: request.id, result: nip44.v2.encrypt(plaintext, conversationKey) };
			}
			case 'nip44_decrypt': {
				requirePermission(clientPubkey, 'nip44_decrypt');
				const [pubkey, ciphertext] = request.params;
				if (!pubkey || !ciphertext) {
					throw new Error('nip44_decrypt requires pubkey and ciphertext');
				}
				const conversationKey = nip44.v2.utils.getConversationKey(options.userSecretKey, pubkey);
				return { id: request.id, result: nip44.v2.decrypt(ciphertext, conversationKey) };
			}
			default:
				return { id: request.id, error: `unsupported method: ${request.method}` };
		}
	}

	return {
		getSignerPublicKey: () => signerPubkey,
		getUserPublicKey: () => userPubkey,
		async handleRequest(clientPubkey, request) {
			if (!request.id) {
				return { id: '', error: 'request id is required' };
			}
			if (!isSupportedMethod(request.method)) {
				return { id: request.id, error: `unsupported method: ${request.method}` };
			}
			try {
				if (request.method === 'connect') {
					const requestedSignerPubkey = request.params[0];
					const providedSecret = request.params[1];
					const requestedPermissions = request.params[2];
					if (requestedSignerPubkey && requestedSignerPubkey !== signerPubkey) {
						return { id: request.id, error: 'connect requested the wrong signer pubkey' };
					}
					if (sessions.has(clientPubkey)) {
						return { id: request.id, result: 'ack' };
					}
					if (options.secret) {
						if (providedSecret !== options.secret) {
							return { id: request.id, error: 'invalid bunker secret' };
						}
						if (secretConsumedBy && secretConsumedBy !== clientPubkey) {
							return { id: request.id, error: 'bunker secret has already been used' };
						}
						secretConsumedBy = clientPubkey;
					}
					sessions.add(clientPubkey);
					permissionsByClient.set(clientPubkey, parsePermissions(requestedPermissions, allowedSignEventKinds));
					return { id: request.id, result: 'ack' };
				}

				const sessionError = requireSession(clientPubkey);
				if (sessionError) {
					return { ...sessionError, id: request.id };
				}
				return await handleConnectedRequest(clientPubkey, request);
			} catch (error) {
				return { id: request.id, error: error instanceof Error ? error.message : String(error) };
			}
		},
	};
}

/**
 * Start a relay-backed NIP-46 bunker service around the pure request handler.
 */
export function startNip46BunkerService(options: Nip46BunkerHandlerOptions): Nip46BunkerService {
	const handler = createNip46BunkerHandler(options);
	const pool = options.relayPool ?? (new SimplePool() as Nip46RelayPool);
	const signerPubkey = handler.getSignerPublicKey();

	const sub = pool.subscribeMany(
		options.relays,
		{
			kinds: [NIP46_KIND],
			'#p': [signerPubkey],
		},
		{
			onevent: async (event) => {
				try {
					if (!verifyEvent(event)) return;
					const decrypted = decryptNip46Message(
						options.signerSecretKey,
						event.pubkey,
						event.content,
					);
					if (!isNip46Request(decrypted)) return;

					const response = await handler.handleRequest(event.pubkey, decrypted);
					const encryptedResponse = encryptNip46Message(
						options.signerSecretKey,
						event.pubkey,
						response,
					);
					const responseEvent = finalizeEvent(
						{
							kind: NIP46_KIND,
							content: encryptedResponse,
							tags: [['p', event.pubkey]],
							created_at: Math.floor(Date.now() / 1000),
						},
						options.signerSecretKey,
					);
					await Promise.all(pool.publish(options.relays, responseEvent));
				} catch {
					// Ignore malformed or unrelated NIP-46 events on shared relays.
				}
			},
		},
	);

	return {
		close() {
			sub.close();
			pool.close(options.relays);
		},
	};
}
