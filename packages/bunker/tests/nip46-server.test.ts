/**
 * NIP-46 Server tests for @redshift/bunker
 *
 * Tests the BunkerServer class and all NIP-46 request handlers.
 * Uses real NIP-44 encryption but mocks relay interactions by
 * calling handleEvent directly with crafted events.
 */

import type { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { nip44 } from 'nostr-tools';
import type { Event as NostrEvent } from 'nostr-tools/core';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { openDatabase } from '../src/database';
import { BunkerServer, parseNip46Request } from '../src/nip46-server';
import { NIP46_KIND } from '../src/nip46-types';
import type { Nip46Response, TeamKeyInfo } from '../src/nip46-types';

// ─── Test Helpers ───────────────────────────────────────────────────────────

/** Generate a team key pair */
function createTeamKey(teamId = 'team-1'): TeamKeyInfo {
	const privateKey = generateSecretKey();
	const pubkey = getPublicKey(privateKey);
	return { teamId, pubkey, privateKey };
}

/** Seed a team and member in the database */
function seedTeamAndMember(
	db: Database,
	teamKey: TeamKeyInfo,
	memberPubkey: string,
	role = 'developer',
	memberId = 'member-1',
) {
	const now = Math.floor(Date.now() / 1000);

	db.run(
		'INSERT INTO teams (id, name, slug, pubkey, encrypted_nsec, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
		[teamKey.teamId, 'Test Team', 'test-team', teamKey.pubkey, 'encrypted', now, now],
	);

	db.run('INSERT INTO members (id, team_id, pubkey, role, joined_at) VALUES (?, ?, ?, ?, ?)', [
		memberId,
		teamKey.teamId,
		memberPubkey,
		role,
		now,
	]);

	return { memberId };
}

/**
 * Create a NIP-46 request event from a client to the bunker.
 * Encrypts the request JSON with NIP-44 using the client's private key
 * and the team's public key.
 */
function createNip46RequestEvent(
	clientSecretKey: Uint8Array,
	teamPubkey: string,
	request: { id: string; method: string; params: string[] },
): NostrEvent {
	const conversationKey = nip44.v2.utils.getConversationKey(clientSecretKey, teamPubkey);
	const encrypted = nip44.v2.encrypt(JSON.stringify(request), conversationKey);

	return finalizeEvent(
		{
			kind: NIP46_KIND,
			content: encrypted,
			created_at: Math.floor(Date.now() / 1000),
			tags: [['p', teamPubkey]],
		},
		clientSecretKey,
	);
}

/**
 * Decrypt a NIP-46 response event sent by the bunker.
 */
function decryptNip46Response(
	event: NostrEvent,
	clientSecretKey: Uint8Array,
	teamPubkey: string,
): Nip46Response {
	const conversationKey = nip44.v2.utils.getConversationKey(clientSecretKey, teamPubkey);
	const decrypted = nip44.v2.decrypt(event.content, conversationKey);
	return JSON.parse(decrypted) as Nip46Response;
}

/**
 * Helper to run a full NIP-46 request/response cycle.
 * Creates the request event, calls handleEvent, captures the published response,
 * and decrypts it.
 */
async function executeNip46Request(
	server: BunkerServer,
	clientSecretKey: Uint8Array,
	teamKey: TeamKeyInfo,
	request: { id: string; method: string; params: string[] },
) {
	const event = createNip46RequestEvent(clientSecretKey, teamKey.pubkey, request);

	let publishedEvent: NostrEvent | null = null;
	const publish = async (evt: NostrEvent) => {
		publishedEvent = evt;
	};

	await server.handleEvent(event, publish);

	if (!publishedEvent) {
		throw new Error('No response event was published');
	}

	return decryptNip46Response(publishedEvent, clientSecretKey, teamKey.pubkey);
}

/**
 * Helper to connect a client to the bunker (creates session).
 */
async function connectClient(
	server: BunkerServer,
	clientSecretKey: Uint8Array,
	teamKey: TeamKeyInfo,
) {
	const clientPubkey = getPublicKey(clientSecretKey);
	return executeNip46Request(server, clientSecretKey, teamKey, {
		id: 'connect-1',
		method: 'connect',
		params: [clientPubkey],
	});
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('BunkerServer', () => {
	let db: Database;
	let server: BunkerServer;
	let teamKey: TeamKeyInfo;
	let clientSecretKey: Uint8Array;
	let clientPubkey: string;

	beforeEach(() => {
		db = openDatabase(':memory:');
		server = new BunkerServer(db, {
			relays: ['wss://relay.example.com'],
			sessionTimeoutSeconds: 86400,
		});
		server.start();

		teamKey = createTeamKey();
		server.registerTeamKey(teamKey);

		clientSecretKey = generateSecretKey();
		clientPubkey = getPublicKey(clientSecretKey);
	});

	afterEach(() => {
		server.stop();
		db.close();
	});

	describe('team key management', () => {
		it('registers and retrieves team pubkeys', () => {
			const pubkeys = server.getTeamPubkeys();
			expect(pubkeys).toContain(teamKey.pubkey);
		});

		it('unregisters team keys', () => {
			server.unregisterTeamKey(teamKey.pubkey);
			expect(server.getTeamPubkeys()).not.toContain(teamKey.pubkey);
		});

		it('supports multiple team keys', () => {
			const teamKey2 = createTeamKey('team-2');
			server.registerTeamKey(teamKey2);

			const pubkeys = server.getTeamPubkeys();
			expect(pubkeys).toContain(teamKey.pubkey);
			expect(pubkeys).toContain(teamKey2.pubkey);
		});
	});

	describe('handleEvent', () => {
		it('ignores events with wrong kind', async () => {
			let published = false;
			const event = finalizeEvent(
				{
					kind: 1, // Not NIP46_KIND
					content: 'test',
					created_at: Math.floor(Date.now() / 1000),
					tags: [['p', teamKey.pubkey]],
				},
				clientSecretKey,
			);

			await server.handleEvent(event, async () => {
				published = true;
			});

			expect(published).toBe(false);
		});

		it('ignores events without p-tag', async () => {
			let published = false;
			const event = finalizeEvent(
				{
					kind: NIP46_KIND,
					content: 'test',
					created_at: Math.floor(Date.now() / 1000),
					tags: [],
				},
				clientSecretKey,
			);

			await server.handleEvent(event, async () => {
				published = true;
			});

			expect(published).toBe(false);
		});

		it('ignores events addressed to unknown team', async () => {
			let published = false;
			const unknownPubkey = 'f'.repeat(64);
			const event = finalizeEvent(
				{
					kind: NIP46_KIND,
					content: 'test',
					created_at: Math.floor(Date.now() / 1000),
					tags: [['p', unknownPubkey]],
				},
				clientSecretKey,
			);

			await server.handleEvent(event, async () => {
				published = true;
			});

			expect(published).toBe(false);
		});

		it('ignores events that cannot be decrypted', async () => {
			let published = false;
			// Use a different key to encrypt, so bunker can't decrypt
			const wrongKey = generateSecretKey();
			const conversationKey = nip44.v2.utils.getConversationKey(wrongKey, teamKey.pubkey);
			const encrypted = nip44.v2.encrypt(
				'{"id":"1","method":"connect","params":[]}',
				conversationKey,
			);

			const event = finalizeEvent(
				{
					kind: NIP46_KIND,
					content: encrypted,
					created_at: Math.floor(Date.now() / 1000),
					tags: [['p', teamKey.pubkey]],
				},
				clientSecretKey,
			);

			await server.handleEvent(event, async () => {
				published = true;
			});

			// The event was encrypted with a key the bunker doesn't know about,
			// but NIP-44 decryption uses the sender's pubkey + team's private key.
			// Since clientSecretKey was used to sign the event, the bunker will
			// derive the conversation key from (teamPrivateKey, clientPubkey).
			// The content was encrypted with (wrongKey, teamPubkey) which is different.
			// So decryption should fail silently.
			expect(published).toBe(false);
		});
	});

	describe('connect', () => {
		it('accepts authorized member', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');

			const response = await connectClient(server, clientSecretKey, teamKey);

			expect(response.id).toBe('connect-1');
			expect(response.result).toBe('ack');
			expect(response.error).toBeUndefined();
		});

		it('rejects unauthorized pubkey', async () => {
			// Don't seed any member — client is not authorized
			const response = await connectClient(server, clientSecretKey, teamKey);

			expect(response.id).toBe('connect-1');
			expect(response.result).toBe('');
			expect(response.error).toBe('unauthorized');
		});

		it('creates a session on successful connect', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');

			await connectClient(server, clientSecretKey, teamKey);

			expect(server.sessions.hasSession(clientPubkey)).toBe(true);
		});

		it('uses sender pubkey when no client pubkey in params', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'connect-2',
				method: 'connect',
				params: [], // No client pubkey specified
			});

			// Should still work — falls back to sender pubkey
			// But the member lookup uses the sender pubkey, which may or may not match
			// In this case, the sender IS the member, so it should work
			expect(response.result).toBe('ack');
		});

		it('logs audit event on connect', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');

			await connectClient(server, clientSecretKey, teamKey);

			const audit = db
				.query<{ action: string }, [string]>('SELECT action FROM audit_events WHERE team_id = ?')
				.get(teamKey.teamId);

			expect(audit?.action).toBe('nip46_connect');
		});
	});

	describe('get_public_key', () => {
		it('returns team pubkey for authenticated session', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');
			await connectClient(server, clientSecretKey, teamKey);

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'gpk-1',
				method: 'get_public_key',
				params: [],
			});

			expect(response.id).toBe('gpk-1');
			expect(response.result).toBe(teamKey.pubkey);
			expect(response.error).toBeUndefined();
		});

		it('rejects without active session', async () => {
			// No connect — no session
			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'gpk-2',
				method: 'get_public_key',
				params: [],
			});

			expect(response.error).toBe('session_expired');
		});

		it('readonly role can get public key', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'readonly');
			await connectClient(server, clientSecretKey, teamKey);

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'gpk-3',
				method: 'get_public_key',
				params: [],
			});

			expect(response.result).toBe(teamKey.pubkey);
		});
	});

	describe('sign_event', () => {
		it('signs event for developer role', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');
			await connectClient(server, clientSecretKey, teamKey);

			const unsignedEvent = {
				kind: 1,
				created_at: Math.floor(Date.now() / 1000),
				tags: [],
				content: 'Hello, world!',
			};

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'sign-1',
				method: 'sign_event',
				params: [JSON.stringify(unsignedEvent)],
			});

			expect(response.error).toBeUndefined();
			expect(response.result).toBeTruthy();

			const signedEvent = JSON.parse(response.result) as NostrEvent;
			expect(signedEvent.pubkey).toBe(teamKey.pubkey);
			expect(signedEvent.kind).toBe(1);
			expect(signedEvent.content).toBe('Hello, world!');
			expect(signedEvent.id).toBeTruthy();
			expect(signedEvent.sig).toBeTruthy();
		});

		it('signs event for owner role', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'owner');
			await connectClient(server, clientSecretKey, teamKey);

			const unsignedEvent = {
				kind: 30078,
				created_at: Math.floor(Date.now() / 1000),
				tags: [['d', 'test']],
				content: '{}',
			};

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'sign-2',
				method: 'sign_event',
				params: [JSON.stringify(unsignedEvent)],
			});

			expect(response.error).toBeUndefined();
			const signedEvent = JSON.parse(response.result) as NostrEvent;
			expect(signedEvent.kind).toBe(30078);
		});

		it('rejects sign_event for readonly role', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'readonly');
			await connectClient(server, clientSecretKey, teamKey);

			const unsignedEvent = {
				kind: 1,
				created_at: Math.floor(Date.now() / 1000),
				tags: [],
				content: 'test',
			};

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'sign-3',
				method: 'sign_event',
				params: [JSON.stringify(unsignedEvent)],
			});

			expect(response.error).toBe('forbidden');
		});

		it('rejects without session', async () => {
			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'sign-4',
				method: 'sign_event',
				params: ['{}'],
			});

			expect(response.error).toBe('session_expired');
		});

		it('rejects invalid event JSON', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');
			await connectClient(server, clientSecretKey, teamKey);

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'sign-5',
				method: 'sign_event',
				params: ['not valid json'],
			});

			expect(response.error).toBe('invalid_request');
		});

		it('rejects event template missing required fields', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');
			await connectClient(server, clientSecretKey, teamKey);

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'sign-6',
				method: 'sign_event',
				params: [JSON.stringify({ kind: 1 })], // Missing created_at, content, tags
			});

			expect(response.error).toBe('invalid_request');
		});

		it('rejects when no params provided', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');
			await connectClient(server, clientSecretKey, teamKey);

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'sign-7',
				method: 'sign_event',
				params: [],
			});

			expect(response.error).toBe('invalid_request');
		});

		it('logs audit event on sign', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');
			await connectClient(server, clientSecretKey, teamKey);

			const unsignedEvent = {
				kind: 1059,
				created_at: Math.floor(Date.now() / 1000),
				tags: [],
				content: 'encrypted',
			};

			await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'sign-8',
				method: 'sign_event',
				params: [JSON.stringify(unsignedEvent)],
			});

			const audits = db
				.query<{ action: string; target: string | null }, [string, string]>(
					'SELECT action, target FROM audit_events WHERE team_id = ? AND action = ?',
				)
				.all(teamKey.teamId, 'nip46_sign_event');

			expect(audits.length).toBeGreaterThan(0);
			const signAudit = audits.find(
				(a: { action: string; target: string | null }) => a.action === 'nip46_sign_event',
			);
			expect(signAudit?.target).toBe('kind:1059');
		});
	});

	describe('nip44_encrypt', () => {
		it('encrypts plaintext for developer role', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');
			await connectClient(server, clientSecretKey, teamKey);

			const thirdPartyKey = generateSecretKey();
			const thirdPartyPubkey = getPublicKey(thirdPartyKey);
			const plaintext = 'secret message';

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'enc-1',
				method: 'nip44_encrypt',
				params: [thirdPartyPubkey, plaintext],
			});

			expect(response.error).toBeUndefined();
			expect(response.result).toBeTruthy();

			// Verify the ciphertext can be decrypted by the third party
			const conversationKey = nip44.v2.utils.getConversationKey(thirdPartyKey, teamKey.pubkey);
			const decrypted = nip44.v2.decrypt(response.result, conversationKey);
			expect(decrypted).toBe(plaintext);
		});

		it('rejects for readonly role', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'readonly');
			await connectClient(server, clientSecretKey, teamKey);

			const thirdPartyPubkey = getPublicKey(generateSecretKey());

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'enc-2',
				method: 'nip44_encrypt',
				params: [thirdPartyPubkey, 'secret'],
			});

			expect(response.error).toBe('forbidden');
		});

		it('rejects without session', async () => {
			const thirdPartyPubkey = getPublicKey(generateSecretKey());

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'enc-3',
				method: 'nip44_encrypt',
				params: [thirdPartyPubkey, 'secret'],
			});

			expect(response.error).toBe('session_expired');
		});

		it('rejects with missing params', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');
			await connectClient(server, clientSecretKey, teamKey);

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'enc-4',
				method: 'nip44_encrypt',
				params: [], // Missing both params
			});

			expect(response.error).toBe('invalid_request');
		});

		it('rejects with only pubkey param (missing plaintext)', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');
			await connectClient(server, clientSecretKey, teamKey);

			const thirdPartyPubkey = getPublicKey(generateSecretKey());

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'enc-5',
				method: 'nip44_encrypt',
				params: [thirdPartyPubkey], // Missing plaintext
			});

			expect(response.error).toBe('invalid_request');
		});
	});

	describe('nip44_decrypt', () => {
		it('decrypts ciphertext for developer role', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');
			await connectClient(server, clientSecretKey, teamKey);

			const thirdPartyKey = generateSecretKey();
			const thirdPartyPubkey = getPublicKey(thirdPartyKey);
			const plaintext = 'secret message';

			// Encrypt with third party's key to team's pubkey
			const conversationKey = nip44.v2.utils.getConversationKey(thirdPartyKey, teamKey.pubkey);
			const ciphertext = nip44.v2.encrypt(plaintext, conversationKey);

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'dec-1',
				method: 'nip44_decrypt',
				params: [thirdPartyPubkey, ciphertext],
			});

			expect(response.error).toBeUndefined();
			expect(response.result).toBe(plaintext);
		});

		it('readonly role can decrypt (readSecrets)', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'readonly');
			await connectClient(server, clientSecretKey, teamKey);

			const thirdPartyKey = generateSecretKey();
			const thirdPartyPubkey = getPublicKey(thirdPartyKey);
			const plaintext = 'readonly can read this';

			const conversationKey = nip44.v2.utils.getConversationKey(thirdPartyKey, teamKey.pubkey);
			const ciphertext = nip44.v2.encrypt(plaintext, conversationKey);

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'dec-2',
				method: 'nip44_decrypt',
				params: [thirdPartyPubkey, ciphertext],
			});

			expect(response.error).toBeUndefined();
			expect(response.result).toBe(plaintext);
		});

		it('rejects without session', async () => {
			const thirdPartyPubkey = getPublicKey(generateSecretKey());

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'dec-3',
				method: 'nip44_decrypt',
				params: [thirdPartyPubkey, 'ciphertext'],
			});

			expect(response.error).toBe('session_expired');
		});

		it('rejects with missing params', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');
			await connectClient(server, clientSecretKey, teamKey);

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'dec-4',
				method: 'nip44_decrypt',
				params: [],
			});

			expect(response.error).toBe('invalid_request');
		});

		it('returns error for invalid ciphertext', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');
			await connectClient(server, clientSecretKey, teamKey);

			const thirdPartyPubkey = getPublicKey(generateSecretKey());

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'dec-5',
				method: 'nip44_decrypt',
				params: [thirdPartyPubkey, 'not-valid-ciphertext'],
			});

			expect(response.error).toBe('internal_error');
		});
	});

	describe('unknown method', () => {
		it('returns unknown_method error', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');
			await connectClient(server, clientSecretKey, teamKey);

			const response = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'unk-1',
				method: 'ping',
				params: [],
			});

			expect(response.error).toBe('unknown_method');
		});
	});

	describe('session expiration', () => {
		it('rejects requests after session expires', async () => {
			// Create server with very short timeout
			const shortServer = new BunkerServer(db, {
				relays: ['wss://relay.example.com'],
				sessionTimeoutSeconds: 0, // Expires immediately
			});
			shortServer.start();
			shortServer.registerTeamKey(teamKey);

			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');

			// Connect (creates session that expires immediately)
			await connectClient(shortServer, clientSecretKey, teamKey);

			// Try to use the expired session
			const response = await executeNip46Request(shortServer, clientSecretKey, teamKey, {
				id: 'exp-1',
				method: 'get_public_key',
				params: [],
			});

			expect(response.error).toBe('session_expired');

			shortServer.stop();
		});
	});

	describe('RBAC permission matrix', () => {
		const roles = ['owner', 'admin', 'developer', 'readonly'] as const;

		for (const role of roles) {
			it(`${role} role permissions are correctly enforced`, async () => {
				// Need a fresh db for each role to avoid unique constraint violations
				const roleDb = openDatabase(':memory:');
				const roleServer = new BunkerServer(roleDb, {
					relays: ['wss://relay.example.com'],
					sessionTimeoutSeconds: 86400,
				});
				roleServer.start();

				const roleTeamKey = createTeamKey('role-team');
				roleServer.registerTeamKey(roleTeamKey);

				const roleClientKey = generateSecretKey();
				const roleClientPubkey = getPublicKey(roleClientKey);

				seedTeamAndMember(roleDb, roleTeamKey, roleClientPubkey, role);
				await connectClient(roleServer, roleClientKey, roleTeamKey);

				// Test get_public_key (requires readSecrets)
				const gpkResponse = await executeNip46Request(roleServer, roleClientKey, roleTeamKey, {
					id: `${role}-gpk`,
					method: 'get_public_key',
					params: [],
				});
				// All roles have readSecrets
				expect(gpkResponse.result).toBe(roleTeamKey.pubkey);

				// Test sign_event (requires writeSecrets)
				const signResponse = await executeNip46Request(roleServer, roleClientKey, roleTeamKey, {
					id: `${role}-sign`,
					method: 'sign_event',
					params: [
						JSON.stringify({
							kind: 1,
							created_at: Math.floor(Date.now() / 1000),
							tags: [],
							content: 'test',
						}),
					],
				});

				if (role === 'readonly') {
					expect(signResponse.error).toBe('forbidden');
				} else {
					expect(signResponse.error).toBeUndefined();
				}

				roleServer.stop();
				roleDb.close();
			});
		}
	});

	describe('multiple teams', () => {
		it('routes requests to correct team', async () => {
			const teamKey2 = createTeamKey('team-2');
			server.registerTeamKey(teamKey2);

			const now = Math.floor(Date.now() / 1000);

			// Seed team 2
			db.run(
				'INSERT INTO teams (id, name, slug, pubkey, encrypted_nsec, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
				['team-2', 'Team 2', 'team-2', teamKey2.pubkey, 'encrypted', now, now],
			);
			db.run('INSERT INTO members (id, team_id, pubkey, role, joined_at) VALUES (?, ?, ?, ?, ?)', [
				'member-t2',
				'team-2',
				clientPubkey,
				'admin',
				now,
			]);

			// Connect to team 2
			const connectResponse = await executeNip46Request(server, clientSecretKey, teamKey2, {
				id: 'mt-connect',
				method: 'connect',
				params: [clientPubkey],
			});
			expect(connectResponse.result).toBe('ack');

			// Get public key from team 2
			const gpkResponse = await executeNip46Request(server, clientSecretKey, teamKey2, {
				id: 'mt-gpk',
				method: 'get_public_key',
				params: [],
			});
			expect(gpkResponse.result).toBe(teamKey2.pubkey);
		});
	});

	describe('encrypt/decrypt round-trip', () => {
		it('data encrypted via bunker can be decrypted via bunker', async () => {
			seedTeamAndMember(db, teamKey, clientPubkey, 'developer');
			await connectClient(server, clientSecretKey, teamKey);

			const thirdPartyKey = generateSecretKey();
			const thirdPartyPubkey = getPublicKey(thirdPartyKey);
			const originalText = 'round-trip test data';

			// Encrypt
			const encResponse = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'rt-enc',
				method: 'nip44_encrypt',
				params: [thirdPartyPubkey, originalText],
			});
			expect(encResponse.error).toBeUndefined();

			// Decrypt
			const decResponse = await executeNip46Request(server, clientSecretKey, teamKey, {
				id: 'rt-dec',
				method: 'nip44_decrypt',
				params: [thirdPartyPubkey, encResponse.result],
			});
			expect(decResponse.error).toBeUndefined();
			expect(decResponse.result).toBe(originalText);
		});
	});
});

describe('parseNip46Request', () => {
	it('parses valid request', () => {
		const json = JSON.stringify({
			id: 'req-1',
			method: 'connect',
			params: ['pubkey123'],
		});

		const request = parseNip46Request(json);
		expect(request.id).toBe('req-1');
		expect(request.method).toBe('connect');
		expect(request.params).toEqual(['pubkey123']);
	});

	it('handles missing params as empty array', () => {
		const json = JSON.stringify({
			id: 'req-2',
			method: 'get_public_key',
		});

		const request = parseNip46Request(json);
		expect(request.params).toEqual([]);
	});

	it('throws on non-object JSON', () => {
		expect(() => parseNip46Request('"string"')).toThrow();
		expect(() => parseNip46Request('42')).toThrow();
		expect(() => parseNip46Request('null')).toThrow();
		expect(() => parseNip46Request('[]')).toThrow();
	});

	it('throws on missing id', () => {
		expect(() => parseNip46Request(JSON.stringify({ method: 'connect', params: [] }))).toThrow();
	});

	it('throws on missing method', () => {
		expect(() => parseNip46Request(JSON.stringify({ id: '1', params: [] }))).toThrow();
	});

	it('throws on empty id', () => {
		expect(() =>
			parseNip46Request(JSON.stringify({ id: '', method: 'connect', params: [] })),
		).toThrow();
	});

	it('throws on empty method', () => {
		expect(() => parseNip46Request(JSON.stringify({ id: '1', method: '', params: [] }))).toThrow();
	});

	it('throws on non-string params', () => {
		expect(() =>
			parseNip46Request(JSON.stringify({ id: '1', method: 'connect', params: [42] })),
		).toThrow();
	});

	it('throws on non-array params', () => {
		expect(() =>
			parseNip46Request(JSON.stringify({ id: '1', method: 'connect', params: 'not-array' })),
		).toThrow();
	});

	it('throws on invalid JSON', () => {
		expect(() => parseNip46Request('not json')).toThrow();
	});
});
