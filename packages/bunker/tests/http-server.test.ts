/**
 * HTTP server integration tests for @redshift/bunker
 *
 * Tests the OAuth bridge HTTP endpoints with mocked OAuth providers.
 * Uses Bun.serve for real HTTP requests against the server.
 */

import type { Database } from 'bun:sqlite';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { Server } from 'bun';
import { openDatabase } from '../src/database';
import { encrypt } from '../src/encryption';
import { createHttpServer } from '../src/http-server';
import {
	clearPendingStates,
	resetOAuthFetch,
	setOAuthFetch,
	storePendingState,
} from '../src/oauth';
import type { BunkerConfig, Member } from '../src/types';
import { SESSION_COOKIE_NAME, WebSessionManager } from '../src/web-session';

/** Test master key (64 hex chars = 32 bytes) */
const MASTER_KEY = 'ab'.repeat(32);

/** Test config */
function createTestConfig(port: number): BunkerConfig {
	return {
		masterKey: MASTER_KEY,
		nostrRelays: ['wss://relay.test'],
		host: '127.0.0.1',
		port,
		databaseUrl: ':memory:',
		googleClientId: 'google-test-client-id',
		googleClientSecret: 'google-test-client-secret',
		githubClientId: 'github-test-client-id',
		githubClientSecret: 'github-test-client-secret',
		adminPubkeys: [],
		sessionTimeout: 86400,
		publicUrl: null,
	};
}

/** Seed a team and optionally members */
function seedTeam(db: Database) {
	const now = Math.floor(Date.now() / 1000);

	db.run(
		'INSERT INTO teams (id, name, slug, pubkey, encrypted_nsec, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
		['team-1', 'Test Team', 'test-team', 'a'.repeat(64), 'encrypted-nsec', now, now],
	);

	return 'team-1';
}

/** Seed a member with OAuth credentials and identity */
function seedOAuthMember(db: Database, teamId: string) {
	const now = Math.floor(Date.now() / 1000);
	const memberId = 'member-oauth-1';
	const pubkey = 'b'.repeat(64);

	db.run(
		'INSERT INTO members (id, team_id, pubkey, role, email, oauth_provider, oauth_subject, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
		[memberId, teamId, pubkey, 'admin', 'admin@test.com', 'google', 'google-sub-1', now],
	);

	// Create identity and assignment
	const identityId = 'identity-1';
	db.run(
		'INSERT INTO identities (id, team_id, pubkey, encrypted_nsec, label, created_at) VALUES (?, ?, ?, ?, ?, ?)',
		[
			identityId,
			teamId,
			pubkey,
			encrypt('deadbeef'.repeat(8), MASTER_KEY),
			'google:admin@test.com',
			now,
		],
	);

	db.run('INSERT INTO assignments (id, identity_id, member_id, created_at) VALUES (?, ?, ?, ?)', [
		'assignment-1',
		identityId,
		memberId,
		now,
	]);

	return { memberId, pubkey, identityId };
}

/** Create a web session and return the cookie header */
function createSessionCookie(db: Database, memberId: string, teamId: string) {
	const sessionManager = new WebSessionManager(db);
	const session = sessionManager.createSession(memberId, teamId);
	return `${SESSION_COOKIE_NAME}=${session.id}`;
}

/** Create a mock JWT */
function createMockJwt(payload: Record<string, unknown>) {
	const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
	const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
	return `${header}.${body}.mock-sig`;
}

// Use a random port to avoid conflicts
let testPort: number;
let server: Server;
let db: Database;
let baseUrl: string;

beforeAll(() => {
	// Find a free port
	testPort = 30000 + Math.floor(Math.random() * 10000);
	baseUrl = `http://127.0.0.1:${testPort}`;
});

beforeEach(() => {
	db = openDatabase(':memory:');
	const config = createTestConfig(testPort);
	// Override publicUrl to match our test server
	const configWithUrl = { ...config, publicUrl: baseUrl };
	server = createHttpServer({ config: configWithUrl, db });
});

afterEach(() => {
	server.stop(true);
	clearPendingStates();
	resetOAuthFetch();
	db.close();
});

describe('HTTP Server', () => {
	describe('GET /health', () => {
		it('returns 200 with status ok', async () => {
			const res = await fetch(`${baseUrl}/health`);
			expect(res.status).toBe(200);

			const body = (await res.json()) as { status: string };
			expect(body.status).toBe('ok');
		});
	});

	describe('404 handling', () => {
		it('returns 404 for unknown routes', async () => {
			const res = await fetch(`${baseUrl}/unknown`);
			expect(res.status).toBe(404);
		});
	});

	describe('GET /auth/google', () => {
		it('redirects to Google OAuth with PKCE params', async () => {
			const teamId = seedTeam(db);

			const res = await fetch(`${baseUrl}/auth/google?team=${teamId}`, {
				redirect: 'manual',
			});

			expect(res.status).toBe(302);
			const location = res.headers.get('Location');
			expect(location).toBeTruthy();

			const url = new URL(location!);
			expect(url.hostname).toBe('accounts.google.com');
			expect(url.searchParams.get('client_id')).toBe('google-test-client-id');
			expect(url.searchParams.get('code_challenge_method')).toBe('S256');
			expect(url.searchParams.get('code_challenge')).toBeTruthy();
			expect(url.searchParams.get('state')).toBeTruthy();
		});

		it('returns 400 when team parameter is missing', async () => {
			const res = await fetch(`${baseUrl}/auth/google`);
			expect(res.status).toBe(400);
		});

		it('returns 404 when team does not exist', async () => {
			const res = await fetch(`${baseUrl}/auth/google?team=nonexistent`);
			expect(res.status).toBe(404);
		});
	});

	describe('GET /auth/github', () => {
		it('redirects to GitHub OAuth without PKCE', async () => {
			const teamId = seedTeam(db);

			const res = await fetch(`${baseUrl}/auth/github?team=${teamId}`, {
				redirect: 'manual',
			});

			expect(res.status).toBe(302);
			const location = res.headers.get('Location');
			expect(location).toBeTruthy();

			const url = new URL(location!);
			expect(url.hostname).toBe('github.com');
			expect(url.searchParams.get('client_id')).toBe('github-test-client-id');
			expect(url.searchParams.get('state')).toBeTruthy();
			// GitHub should NOT have PKCE params
			expect(url.searchParams.get('code_challenge')).toBeNull();
		});

		it('returns 400 when team parameter is missing', async () => {
			const res = await fetch(`${baseUrl}/auth/github`);
			expect(res.status).toBe(400);
		});
	});

	describe('GET /auth/google/callback', () => {
		it('returns 400 when code or state is missing', async () => {
			const res = await fetch(`${baseUrl}/auth/google/callback`);
			expect(res.status).toBe(400);
		});

		it('returns 400 for invalid state', async () => {
			const res = await fetch(`${baseUrl}/auth/google/callback?code=test-code&state=invalid-state`);
			expect(res.status).toBe(400);
		});

		it('creates member and session on successful callback', async () => {
			const teamId = seedTeam(db);

			// Set up pending state
			const state = 'test-google-state';
			storePendingState(state, {
				provider: 'google',
				teamId,
				codeVerifier: 'test-verifier',
				createdAt: Math.floor(Date.now() / 1000),
			});

			// Mock Google token endpoint
			const idToken = createMockJwt({
				sub: 'google-user-new',
				email: 'newuser@google.com',
				email_verified: true,
				iss: 'https://accounts.google.com',
				aud: 'google-test-client-id',
			});

			setOAuthFetch(async () => {
				return new Response(
					JSON.stringify({
						access_token: 'mock-access',
						id_token: idToken,
						token_type: 'Bearer',
						expires_in: 3600,
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				);
			});

			const res = await fetch(`${baseUrl}/auth/google/callback?code=auth-code&state=${state}`, {
				redirect: 'manual',
			});

			expect(res.status).toBe(302);

			// Should have a Set-Cookie header
			const setCookie = res.headers.get('Set-Cookie');
			expect(setCookie).toBeTruthy();
			expect(setCookie).toContain(SESSION_COOKIE_NAME);
			expect(setCookie).toContain('HttpOnly');

			// Verify member was created in database
			const member = db
				.query<Member, [string, string]>(
					'SELECT * FROM members WHERE team_id = ? AND oauth_subject = ?',
				)
				.get(teamId, 'google-user-new');

			expect(member).toBeTruthy();
			expect(member?.email).toBe('newuser@google.com');
			expect(member?.oauth_provider).toBe('google');
		});
	});

	describe('GET /auth/github/callback', () => {
		it('creates member and session on successful callback', async () => {
			const teamId = seedTeam(db);

			const state = 'test-github-state';
			storePendingState(state, {
				provider: 'github',
				teamId,
				codeVerifier: null,
				createdAt: Math.floor(Date.now() / 1000),
			});

			setOAuthFetch(async (url: string | URL | Request) => {
				const urlStr =
					typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

				if (urlStr.includes('github.com/login/oauth/access_token')) {
					return new Response(
						JSON.stringify({
							access_token: 'gho_mock',
							token_type: 'bearer',
							scope: 'read:user,user:email',
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } },
					);
				}

				if (urlStr === 'https://api.github.com/user') {
					return new Response(
						JSON.stringify({
							id: 777,
							login: 'ghuser',
							email: 'ghuser@github.com',
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } },
					);
				}

				return new Response('Not found', { status: 404 });
			});

			const res = await fetch(`${baseUrl}/auth/github/callback?code=gh-code&state=${state}`, {
				redirect: 'manual',
			});

			expect(res.status).toBe(302);

			const setCookie = res.headers.get('Set-Cookie');
			expect(setCookie).toContain(SESSION_COOKIE_NAME);

			// Verify member was created
			const member = db
				.query<Member, [string, string]>(
					'SELECT * FROM members WHERE team_id = ? AND oauth_subject = ?',
				)
				.get(teamId, '777');

			expect(member).toBeTruthy();
			expect(member?.email).toBe('ghuser@github.com');
			expect(member?.oauth_provider).toBe('github');
		});
	});

	describe('GET /api/me', () => {
		it('returns 401 without session cookie', async () => {
			const res = await fetch(`${baseUrl}/api/me`);
			expect(res.status).toBe(401);
		});

		it('returns member info with valid session', async () => {
			const teamId = seedTeam(db);
			const { memberId } = seedOAuthMember(db, teamId);
			const cookie = createSessionCookie(db, memberId, teamId);

			const res = await fetch(`${baseUrl}/api/me`, {
				headers: { Cookie: cookie },
			});

			expect(res.status).toBe(200);
			const body = (await res.json()) as {
				member: { id: string; email: string; role: string };
				team: { id: string; name: string };
			};

			expect(body.member.id).toBe(memberId);
			expect(body.member.email).toBe('admin@test.com');
			expect(body.member.role).toBe('admin');
			expect(body.team.id).toBe(teamId);
			expect(body.team.name).toBe('Test Team');
		});
	});

	describe('POST /api/logout', () => {
		it('clears session cookie', async () => {
			const teamId = seedTeam(db);
			const { memberId } = seedOAuthMember(db, teamId);
			const cookie = createSessionCookie(db, memberId, teamId);

			const res = await fetch(`${baseUrl}/api/logout`, {
				method: 'POST',
				headers: { Cookie: cookie },
			});

			expect(res.status).toBe(200);

			const setCookie = res.headers.get('Set-Cookie');
			expect(setCookie).toContain('Max-Age=0');

			const body = (await res.json()) as { success: boolean };
			expect(body.success).toBe(true);
		});

		it('succeeds even without a session cookie', async () => {
			const res = await fetch(`${baseUrl}/api/logout`, { method: 'POST' });
			expect(res.status).toBe(200);
		});
	});

	describe('GET /api/identities', () => {
		it('returns 401 without session', async () => {
			const res = await fetch(`${baseUrl}/api/identities`);
			expect(res.status).toBe(401);
		});

		it('returns identities for authenticated member', async () => {
			const teamId = seedTeam(db);
			const { memberId } = seedOAuthMember(db, teamId);
			const cookie = createSessionCookie(db, memberId, teamId);

			const res = await fetch(`${baseUrl}/api/identities`, {
				headers: { Cookie: cookie },
			});

			expect(res.status).toBe(200);
			const body = (await res.json()) as {
				identities: Array<{
					identityId: string;
					teamId: string;
					teamName: string;
					pubkey: string;
					role: string;
				}>;
			};

			expect(body.identities.length).toBe(1);
			expect(body.identities[0]?.teamId).toBe(teamId);
			expect(body.identities[0]?.teamName).toBe('Test Team');
		});
	});

	describe('POST /api/select-identity', () => {
		it('returns 401 without session', async () => {
			const res = await fetch(`${baseUrl}/api/select-identity`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ identityId: 'test' }),
			});
			expect(res.status).toBe(401);
		});

		it('returns selected identity for valid assignment', async () => {
			const teamId = seedTeam(db);
			const { memberId, identityId, pubkey } = seedOAuthMember(db, teamId);
			const cookie = createSessionCookie(db, memberId, teamId);

			const res = await fetch(`${baseUrl}/api/select-identity`, {
				method: 'POST',
				headers: {
					Cookie: cookie,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ identityId }),
			});

			expect(res.status).toBe(200);
			const body = (await res.json()) as {
				selected: { identityId: string; pubkey: string; teamId: string };
			};

			expect(body.selected.identityId).toBe(identityId);
			expect(body.selected.pubkey).toBe(pubkey);
		});

		it('returns 403 for unassigned identity', async () => {
			const teamId = seedTeam(db);
			const { memberId } = seedOAuthMember(db, teamId);
			const cookie = createSessionCookie(db, memberId, teamId);

			const res = await fetch(`${baseUrl}/api/select-identity`, {
				method: 'POST',
				headers: {
					Cookie: cookie,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ identityId: 'nonexistent-identity' }),
			});

			expect(res.status).toBe(403);
		});
	});

	describe('POST /api/authorize-pubkey', () => {
		it('returns 401 without session', async () => {
			const res = await fetch(`${baseUrl}/api/authorize-pubkey`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pubkey: 'f'.repeat(64), teamId: 'team-1' }),
			});
			expect(res.status).toBe(401);
		});

		it('authorizes a new pubkey when caller is admin', async () => {
			const teamId = seedTeam(db);
			const { memberId } = seedOAuthMember(db, teamId); // admin role
			const cookie = createSessionCookie(db, memberId, teamId);

			const newPubkey = 'f'.repeat(64);

			const res = await fetch(`${baseUrl}/api/authorize-pubkey`, {
				method: 'POST',
				headers: {
					Cookie: cookie,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					pubkey: newPubkey,
					teamId,
					role: 'developer',
				}),
			});

			expect(res.status).toBe(201);
			const body = (await res.json()) as {
				member: { id: string; pubkey: string; teamId: string; role: string };
			};

			expect(body.member.pubkey).toBe(newPubkey);
			expect(body.member.role).toBe('developer');

			// Verify in database
			const dbMember = db
				.query<{ pubkey: string }, [string, string]>(
					'SELECT pubkey FROM members WHERE team_id = ? AND pubkey = ?',
				)
				.get(teamId, newPubkey);

			expect(dbMember).toBeTruthy();
		});

		it('returns 403 when caller is not admin/owner', async () => {
			const teamId = seedTeam(db);
			const now = Math.floor(Date.now() / 1000);

			// Create a developer member
			db.run('INSERT INTO members (id, team_id, pubkey, role, joined_at) VALUES (?, ?, ?, ?, ?)', [
				'dev-member',
				teamId,
				'e'.repeat(64),
				'developer',
				now,
			]);

			const cookie = createSessionCookie(db, 'dev-member', teamId);

			const res = await fetch(`${baseUrl}/api/authorize-pubkey`, {
				method: 'POST',
				headers: {
					Cookie: cookie,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					pubkey: 'f'.repeat(64),
					teamId,
				}),
			});

			expect(res.status).toBe(403);
		});

		it('returns 400 for invalid pubkey format', async () => {
			const teamId = seedTeam(db);
			const { memberId } = seedOAuthMember(db, teamId);
			const cookie = createSessionCookie(db, memberId, teamId);

			const res = await fetch(`${baseUrl}/api/authorize-pubkey`, {
				method: 'POST',
				headers: {
					Cookie: cookie,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					pubkey: 'invalid-pubkey',
					teamId,
				}),
			});

			expect(res.status).toBe(400);
		});

		it('returns 409 when pubkey already authorized', async () => {
			const teamId = seedTeam(db);
			const { memberId, pubkey } = seedOAuthMember(db, teamId);
			const cookie = createSessionCookie(db, memberId, teamId);

			const res = await fetch(`${baseUrl}/api/authorize-pubkey`, {
				method: 'POST',
				headers: {
					Cookie: cookie,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					pubkey, // Already exists
					teamId,
				}),
			});

			expect(res.status).toBe(409);
		});
	});
});
