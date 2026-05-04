import { describe, expect, it } from 'bun:test';
import { verifyEvent, type EventTemplate } from 'nostr-tools';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import {
	createLocalBunkerPrototype,
	createLocalBunkerRequestEvent,
	decryptLocalBunkerResponse,
	handleLocalBunkerRequest,
} from '../../src/lib/local-bunker';

describe('Local bunker prototype', () => {
	it('creates a bunker pointer without exposing nsec material', () => {
		const signerSecretKey = generateSecretKey();
		const prototype = createLocalBunkerPrototype({
			signerSecretKey,
			relays: ['wss://relay.example'],
			secret: 'pairing-secret',
		});

		expect(prototype.pubkey).toBe(getPublicKey(signerSecretKey));
		expect(prototype.url).toContain(`bunker://${prototype.pubkey}`);
		expect(prototype.url).toContain('relay=wss%3A%2F%2Frelay.example');
		expect(prototype.url).toContain('secret=pairing-secret');
		expect(prototype.url).not.toContain(Buffer.from(signerSecretKey).toString('hex'));
	});

	it('handles get_public_key requests using NIP-44 encrypted NIP-46 events', async () => {
		const signerSecretKey = generateSecretKey();
		const clientSecretKey = generateSecretKey();
		const bunkerPubkey = getPublicKey(signerSecretKey);
		const request = createLocalBunkerRequestEvent(
			{ id: '1', method: 'get_public_key', params: [] },
			clientSecretKey,
			bunkerPubkey,
		);

		const responseEvent = await handleLocalBunkerRequest(request, signerSecretKey);
		const response = decryptLocalBunkerResponse(responseEvent, clientSecretKey, bunkerPubkey);

		expect(response).toEqual({ id: '1', result: bunkerPubkey, error: '' });
		expect(responseEvent.tags).toContainEqual(['p', getPublicKey(clientSecretKey)]);
		expect(verifyEvent(responseEvent)).toBe(true);
	});

	it('signs allowed Redshift event kinds', async () => {
		const signerSecretKey = generateSecretKey();
		const clientSecretKey = generateSecretKey();
		const bunkerPubkey = getPublicKey(signerSecretKey);
		const template: EventTemplate = {
			kind: 30078,
			created_at: 123,
			tags: [['d', 'project|development']],
			content: 'encrypted-secret-bundle',
		};
		const request = createLocalBunkerRequestEvent(
			{ id: 'sign-1', method: 'sign_event', params: [JSON.stringify(template)] },
			clientSecretKey,
			bunkerPubkey,
		);

		const responseEvent = await handleLocalBunkerRequest(request, signerSecretKey);
		const response = decryptLocalBunkerResponse(responseEvent, clientSecretKey, bunkerPubkey);
		const signed: unknown = JSON.parse(response.result);

		expect(response.error).toBe('');
		expect(typeof signed).toBe('object');
		if (typeof signed !== 'object' || signed === null || !('kind' in signed) || !('pubkey' in signed)) {
			throw new Error('signed response was not a Nostr event');
		}
		expect(signed.kind).toBe(30078);
		expect(signed.pubkey).toBe(bunkerPubkey);
	});

	it('rejects event kinds outside local policy', async () => {
		const signerSecretKey = generateSecretKey();
		const clientSecretKey = generateSecretKey();
		const bunkerPubkey = getPublicKey(signerSecretKey);
		const request = createLocalBunkerRequestEvent(
			{
				id: 'sign-2',
				method: 'sign_event',
				params: [JSON.stringify({ kind: 1, created_at: 123, tags: [], content: 'hello' })],
			},
			clientSecretKey,
			bunkerPubkey,
		);

		const responseEvent = await handleLocalBunkerRequest(request, signerSecretKey);
		const response = decryptLocalBunkerResponse(responseEvent, clientSecretKey, bunkerPubkey);

		expect(response.result).toBe('');
		expect(response.error).toBe('event kind not allowed: 1');
	});
});
