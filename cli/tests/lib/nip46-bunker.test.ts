/**
 * Minimal NIP-46 bunker handler tests.
 *
 * L4: Integration-Contractor - NIP-46 request/response contract
 */

import { describe, expect, it } from 'bun:test';
import { nip44 } from 'nostr-tools';
import type { Event } from 'nostr-tools/core';
import { finalizeEvent, getPublicKey, verifyEvent } from 'nostr-tools/pure';
import {
	NIP46_KIND,
	createNip46BunkerHandler,
	decryptNip46Message,
	encryptNip46Message,
	startNip46BunkerService,
	type Nip46RelayPool,
} from '../../src/lib/nip46-bunker';

describe('NIP-46 message encryption', () => {
	it('roundtrips request content with NIP-44 between client and bunker keys', () => {
		const bunkerSecretKey = new Uint8Array(32).fill(1);
		const clientSecretKey = new Uint8Array(32).fill(3);
		const request = { id: 'request-1', method: 'ping', params: [] };

		const encrypted = encryptNip46Message(clientSecretKey, getPublicKey(bunkerSecretKey), request);
		const decrypted = decryptNip46Message(bunkerSecretKey, getPublicKey(clientSecretKey), encrypted);

		expect(decrypted).toEqual(request);
	});
});

describe('NIP-46 relay service', () => {
	it('subscribes to kind 24133 requests and publishes encrypted responses', async () => {
		const signerSecretKey = new Uint8Array(32).fill(1);
		const userSecretKey = new Uint8Array(32).fill(2);
		const clientSecretKey = new Uint8Array(32).fill(3);
		const signerPubkey = getPublicKey(signerSecretKey);
		const clientPubkey = getPublicKey(clientSecretKey);
		let onevent: ((event: Event) => void | Promise<void>) | null = null;
		const published: Event[] = [];
		const relayPool: Nip46RelayPool = {
			subscribeMany(relays, filter, handlers) {
				expect(relays).toEqual(['wss://relay.test']);
				expect(filter).toEqual({ kinds: [NIP46_KIND], '#p': [signerPubkey] });
				onevent = handlers.onevent;
				return { close() {} };
			},
			publish(relays, event) {
				expect(relays).toEqual(['wss://relay.test']);
				published.push(event);
				return [Promise.resolve()];
			},
			close() {},
		};
		startNip46BunkerService({
			signerSecretKey,
			userSecretKey,
			relays: ['wss://relay.test'],
			secret: 'connect-secret',
			relayPool,
		});
		const requestContent = encryptNip46Message(clientSecretKey, signerPubkey, {
			id: 'connect-1',
			method: 'connect',
			params: [signerPubkey, 'connect-secret'],
		});
		const requestEvent = finalizeEvent(
			{
				kind: NIP46_KIND,
				content: requestContent,
				tags: [['p', signerPubkey]],
				created_at: 1,
			},
			clientSecretKey,
		);

		await onevent!(requestEvent);

		expect(published.length).toBe(1);
		expect(published[0].kind).toBe(NIP46_KIND);
		expect(published[0].pubkey).toBe(signerPubkey);
		expect(published[0].tags).toEqual([['p', clientPubkey]]);
		expect(verifyEvent(published[0])).toBe(true);
		expect(decryptNip46Message(clientSecretKey, signerPubkey, published[0].content)).toEqual({
			id: 'connect-1',
			result: 'ack',
		});
	});

	it('ignores invalid, undecryptable, and response-shaped relay events', async () => {
		const signerSecretKey = new Uint8Array(32).fill(1);
		const userSecretKey = new Uint8Array(32).fill(2);
		const clientSecretKey = new Uint8Array(32).fill(3);
		const signerPubkey = getPublicKey(signerSecretKey);
		let onevent: ((event: Event) => void | Promise<void>) | null = null;
		const published: Event[] = [];
		const relayPool: Nip46RelayPool = {
			subscribeMany(_relays, _filter, handlers) {
				onevent = handlers.onevent;
				return { close() {} };
			},
			publish(_relays, event) {
				published.push(event);
				return [Promise.resolve()];
			},
			close() {},
		};
		startNip46BunkerService({
			signerSecretKey,
			userSecretKey,
			relays: ['wss://relay.test'],
			secret: 'connect-secret',
			relayPool,
		});
		const validRequest = finalizeEvent(
			{
				kind: NIP46_KIND,
				content: encryptNip46Message(clientSecretKey, signerPubkey, {
					id: 'connect-1',
					method: 'connect',
					params: [signerPubkey, 'connect-secret'],
				}),
				tags: [['p', signerPubkey]],
				created_at: 1,
			},
			clientSecretKey,
		);

		await onevent!({ ...JSON.parse(JSON.stringify(validRequest)), sig: '00'.repeat(64) });
		await onevent!(finalizeEvent({ kind: NIP46_KIND, content: 'not-ciphertext', tags: [['p', signerPubkey]], created_at: 1 }, clientSecretKey));
		await onevent!(finalizeEvent({
			kind: NIP46_KIND,
			content: encryptNip46Message(clientSecretKey, signerPubkey, { id: 'response-1', result: 'ack' }),
			tags: [['p', signerPubkey]],
			created_at: 1,
		}, clientSecretKey));

		expect(published).toHaveLength(0);
	});
});

describe('NIP-46 bunker handler', () => {
	it('rejects requests before a client connects', async () => {
		const handler = createNip46BunkerHandler({
			signerSecretKey: new Uint8Array(32).fill(1),
			userSecretKey: new Uint8Array(32).fill(2),
			relays: ['wss://relay.test'],
			secret: 'connect-secret',
		});
		const clientPubkey = getPublicKey(new Uint8Array(32).fill(3));

		const response = await handler.handleRequest(clientPubkey, {
			id: 'before-connect',
			method: 'get_public_key',
			params: [],
		});

		expect(response.id).toBe('before-connect');
		expect(response.error).toContain('not connected');
	});

	it('connects with a valid secret and returns the user public key', async () => {
		const userSecretKey = new Uint8Array(32).fill(2);
		const handler = createNip46BunkerHandler({
			signerSecretKey: new Uint8Array(32).fill(1),
			userSecretKey,
			relays: ['wss://relay.test'],
			secret: 'connect-secret',
		});
		const clientPubkey = getPublicKey(new Uint8Array(32).fill(3));

		const connect = await handler.handleRequest(clientPubkey, {
			id: 'connect-1',
			method: 'connect',
			params: [handler.getSignerPublicKey(), 'connect-secret'],
		});
		const pubkey = await handler.handleRequest(clientPubkey, {
			id: 'pubkey-1',
			method: 'get_public_key',
			params: [],
		});

		expect(connect.result).toBe('ack');
		expect(pubkey.result).toBe(getPublicKey(userSecretKey));
	});

	it('signs events, performs NIP-44 crypto, and returns relay switches for connected clients', async () => {
		const userSecretKey = new Uint8Array(32).fill(2);
		const clientSecretKey = new Uint8Array(32).fill(3);
		const clientPubkey = getPublicKey(clientSecretKey);
		const handler = createNip46BunkerHandler({
			signerSecretKey: new Uint8Array(32).fill(1),
			userSecretKey,
			relays: ['wss://relay.test', 'wss://relay2.test'],
			secret: 'connect-secret',
		});

		await handler.handleRequest(clientPubkey, {
			id: 'connect-1',
			method: 'connect',
			params: [handler.getSignerPublicKey(), 'connect-secret'],
		});

		const signed = await handler.handleRequest(clientPubkey, {
			id: 'sign-1',
			method: 'sign_event',
			params: [JSON.stringify({ kind: 13, content: 'hello', tags: [], created_at: 1 })],
		});
		const event = JSON.parse(signed.result ?? '{}');
		expect(event.pubkey).toBe(getPublicKey(userSecretKey));
		expect(verifyEvent(event)).toBe(true);

		const encrypted = await handler.handleRequest(clientPubkey, {
			id: 'encrypt-1',
			method: 'nip44_encrypt',
			params: [clientPubkey, 'secret text'],
		});
		const conversationKey = nip44.v2.utils.getConversationKey(clientSecretKey, getPublicKey(userSecretKey));
		expect(nip44.v2.decrypt(encrypted.result!, conversationKey)).toBe('secret text');

		const decrypted = await handler.handleRequest(clientPubkey, {
			id: 'decrypt-1',
			method: 'nip44_decrypt',
			params: [clientPubkey, encrypted.result!],
		});
		expect(decrypted.result).toBe('secret text');

		const switched = await handler.handleRequest(clientPubkey, {
			id: 'switch-1',
			method: 'switch_relays',
			params: [],
		});
		expect(switched.result).toBe(JSON.stringify(['wss://relay.test', 'wss://relay2.test']));
	});

	it('allows constrained NIP-09 deletion signing for Redshift delete workflows', async () => {
		const clientPubkey = getPublicKey(new Uint8Array(32).fill(3));
		const handler = createNip46BunkerHandler({
			signerSecretKey: new Uint8Array(32).fill(1),
			userSecretKey: new Uint8Array(32).fill(2),
			relays: ['wss://relay.test'],
			secret: 'connect-secret',
		});
		await handler.handleRequest(clientPubkey, {
			id: 'connect-1',
			method: 'connect',
			params: [handler.getSignerPublicKey(), 'connect-secret'],
		});

		const signed = await handler.handleRequest(clientPubkey, {
			id: 'delete-1',
			method: 'sign_event',
			params: [JSON.stringify({ kind: 5, content: 'delete old secret', tags: [['e', 'ab'.repeat(32)], ['k', '1059']], created_at: 1 })],
		});
		const unsafe = await handler.handleRequest(clientPubkey, {
			id: 'delete-2',
			method: 'sign_event',
			params: [JSON.stringify({ kind: 5, content: 'unsafe', tags: [['p', 'ab'.repeat(32)]], created_at: 1 })],
		});

		expect(verifyEvent(JSON.parse(signed.result ?? '{}'))).toBe(true);
		expect(unsafe.error).toContain('NIP-09 e-tag deletion');
	});

	it('enforces requested NIP-46 permissions per client', async () => {
		const clientPubkey = getPublicKey(new Uint8Array(32).fill(3));
		const handler = createNip46BunkerHandler({
			signerSecretKey: new Uint8Array(32).fill(1),
			userSecretKey: new Uint8Array(32).fill(2),
			relays: ['wss://relay.test'],
			secret: 'connect-secret',
		});
		await handler.handleRequest(clientPubkey, {
			id: 'connect-1',
			method: 'connect',
			params: [handler.getSignerPublicKey(), 'connect-secret', 'sign_event:13'],
		});

		expect((await handler.handleRequest(clientPubkey, { id: 'pubkey-1', method: 'get_public_key', params: [] })).error).toContain('not permitted');
		expect((await handler.handleRequest(clientPubkey, { id: 'encrypt-1', method: 'nip44_encrypt', params: [clientPubkey, 'secret'] })).error).toContain('not permitted');
		expect((await handler.handleRequest(clientPubkey, {
			id: 'sign-13',
			method: 'sign_event',
			params: [JSON.stringify({ kind: 13, content: 'hello', tags: [], created_at: 1 })],
		})).result).toBeDefined();
		expect((await handler.handleRequest(clientPubkey, {
			id: 'sign-5',
			method: 'sign_event',
			params: [JSON.stringify({ kind: 5, content: 'delete', tags: [['e', 'ab'.repeat(32)], ['k', '1059']], created_at: 1 })],
		})).error).toContain('not permitted');
	});

	it('rejects signing event kinds outside the Redshift prototype permission set', async () => {
		const clientPubkey = getPublicKey(new Uint8Array(32).fill(3));
		const handler = createNip46BunkerHandler({
			signerSecretKey: new Uint8Array(32).fill(1),
			userSecretKey: new Uint8Array(32).fill(2),
			relays: ['wss://relay.test'],
			secret: 'connect-secret',
		});
		await handler.handleRequest(clientPubkey, {
			id: 'connect-1',
			method: 'connect',
			params: [handler.getSignerPublicKey(), 'connect-secret'],
		});

		const signed = await handler.handleRequest(clientPubkey, {
			id: 'sign-1',
			method: 'sign_event',
			params: [JSON.stringify({ kind: 1, content: 'not redshift', tags: [], created_at: 1 })],
		});

		expect(signed.error).toContain('not permitted');
	});

	it('returns protocol errors for unsupported methods and malformed requests', async () => {
		const clientPubkey = getPublicKey(new Uint8Array(32).fill(3));
		const handler = createNip46BunkerHandler({
			signerSecretKey: new Uint8Array(32).fill(1),
			userSecretKey: new Uint8Array(32).fill(2),
			relays: ['wss://relay.test'],
			secret: 'connect-secret',
		});

		expect(
			await handler.handleRequest(clientPubkey, { id: '', method: 'ping', params: [] }),
		).toEqual({ id: '', error: 'request id is required' });
		expect(
			(await handler.handleRequest(clientPubkey, { id: 'bad', method: 'unknown', params: [] })).error,
		).toContain('unsupported method');
		await handler.handleRequest(clientPubkey, {
			id: 'connect-1',
			method: 'connect',
			params: [handler.getSignerPublicKey(), 'connect-secret'],
		});
		expect((await handler.handleRequest(clientPubkey, { id: 'ping-1', method: 'ping', params: [] })).result).toBe('pong');
		expect(
			(
				await handler.handleRequest(clientPubkey, {
					id: 'sign-bad',
					method: 'sign_event',
					params: ['not json'],
				})
			).error,
		).toContain('valid JSON');
		expect(
			(
				await handler.handleRequest(clientPubkey, {
					id: 'enc-bad',
					method: 'nip44_encrypt',
					params: ['peer-only'],
				})
			).error,
		).toContain('requires pubkey and plaintext');
	});

	it('rejects invalid connect attempts and second clients reusing the pairing secret', async () => {
		const handler = createNip46BunkerHandler({
			signerSecretKey: new Uint8Array(32).fill(1),
			userSecretKey: new Uint8Array(32).fill(2),
			relays: ['wss://relay.test'],
			secret: 'connect-secret',
		});
		const firstClient = getPublicKey(new Uint8Array(32).fill(3));
		const secondClient = getPublicKey(new Uint8Array(32).fill(4));

		expect(
			(
				await handler.handleRequest(firstClient, {
					id: 'wrong-signer',
					method: 'connect',
					params: ['ff'.repeat(32), 'connect-secret'],
				})
			).error,
		).toContain('wrong signer');
		expect(
			(
				await handler.handleRequest(firstClient, {
					id: 'wrong-secret',
					method: 'connect',
					params: [handler.getSignerPublicKey(), 'wrong'],
				})
			).error,
		).toContain('invalid bunker secret');
		expect(
			(
				await handler.handleRequest(firstClient, {
					id: 'connect-1',
					method: 'connect',
					params: [handler.getSignerPublicKey(), 'connect-secret'],
				})
			).result,
		).toBe('ack');
		expect(
			(
				await handler.handleRequest(secondClient, {
					id: 'connect-2',
					method: 'connect',
					params: [handler.getSignerPublicKey(), 'connect-secret'],
				})
			).error,
		).toContain('already been used');
	});

	it('allows the same connected client to reconnect without reusing the pairing secret or escalating permissions', async () => {
		const clientPubkey = getPublicKey(new Uint8Array(32).fill(3));
		const handler = createNip46BunkerHandler({
			signerSecretKey: new Uint8Array(32).fill(1),
			userSecretKey: new Uint8Array(32).fill(2),
			relays: ['wss://relay.test'],
			secret: 'connect-secret',
		});
		await handler.handleRequest(clientPubkey, {
			id: 'connect-1',
			method: 'connect',
			params: [handler.getSignerPublicKey(), 'connect-secret', 'sign_event:13'],
		});

		const reconnect = await handler.handleRequest(clientPubkey, {
			id: 'connect-2',
			method: 'connect',
			params: [handler.getSignerPublicKey()],
		});
		const encrypt = await handler.handleRequest(clientPubkey, {
			id: 'encrypt-after-reconnect',
			method: 'nip44_encrypt',
			params: [clientPubkey, 'secret'],
		});

		expect(reconnect.result).toBe('ack');
		expect(encrypt.error).toContain('not permitted');
	});
});
