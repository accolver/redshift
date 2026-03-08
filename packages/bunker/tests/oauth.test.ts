/**
 * OAuth module tests for @redshift/bunker
 *
 * Tests OAuth flows with mocked external provider endpoints.
 * Covers Google (PKCE) and GitHub (state) authorization code flows.
 */

import { afterEach, describe, expect, it } from 'bun:test';
import {
	buildGithubAuthUrl,
	buildGoogleAuthUrl,
	clearPendingStates,
	computeCodeChallenge,
	consumePendingState,
	exchangeGithubCode,
	exchangeGoogleCode,
	generateCodeVerifier,
	generateState,
	resetOAuthFetch,
	setOAuthFetch,
	storePendingState,
} from '../src/oauth';

afterEach(() => {
	clearPendingStates();
	resetOAuthFetch();
});

describe('OAuth', () => {
	describe('PKCE utilities', () => {
		it('generateCodeVerifier returns a base64url string', () => {
			const verifier = generateCodeVerifier();
			expect(verifier.length).toBeGreaterThan(0);
			// base64url: only alphanumeric, -, _
			expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
		});

		it('generateCodeVerifier produces unique values', () => {
			const v1 = generateCodeVerifier();
			const v2 = generateCodeVerifier();
			expect(v1).not.toBe(v2);
		});

		it('computeCodeChallenge returns a base64url SHA-256 hash', () => {
			const verifier = 'test-verifier-value';
			const challenge = computeCodeChallenge(verifier);
			expect(challenge.length).toBeGreaterThan(0);
			expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
		});

		it('computeCodeChallenge is deterministic', () => {
			const verifier = 'deterministic-test';
			const c1 = computeCodeChallenge(verifier);
			const c2 = computeCodeChallenge(verifier);
			expect(c1).toBe(c2);
		});

		it('computeCodeChallenge produces different outputs for different inputs', () => {
			const c1 = computeCodeChallenge('verifier-1');
			const c2 = computeCodeChallenge('verifier-2');
			expect(c1).not.toBe(c2);
		});
	});

	describe('State management', () => {
		it('generateState returns a hex string', () => {
			const state = generateState();
			expect(state).toMatch(/^[0-9a-f]+$/);
			expect(state.length).toBe(32); // 16 bytes = 32 hex chars
		});

		it('generateState produces unique values', () => {
			const s1 = generateState();
			const s2 = generateState();
			expect(s1).not.toBe(s2);
		});

		it('storePendingState and consumePendingState round-trip', () => {
			const state = 'test-state-123';
			storePendingState(state, {
				provider: 'google',
				teamId: 'team-1',
				codeVerifier: 'verifier-abc',
				createdAt: Math.floor(Date.now() / 1000),
			});

			const result = consumePendingState(state);
			expect(result).not.toBeNull();
			expect(result?.provider).toBe('google');
			expect(result?.teamId).toBe('team-1');
			expect(result?.codeVerifier).toBe('verifier-abc');
		});

		it('consumePendingState removes the state (single use)', () => {
			const state = 'single-use-state';
			storePendingState(state, {
				provider: 'github',
				teamId: 'team-1',
				codeVerifier: null,
				createdAt: Math.floor(Date.now() / 1000),
			});

			const first = consumePendingState(state);
			expect(first).not.toBeNull();

			const second = consumePendingState(state);
			expect(second).toBeNull();
		});

		it('consumePendingState returns null for unknown state', () => {
			expect(consumePendingState('nonexistent')).toBeNull();
		});

		it('consumePendingState returns null for expired state', () => {
			const state = 'expired-state';
			storePendingState(state, {
				provider: 'google',
				teamId: 'team-1',
				codeVerifier: 'verifier',
				createdAt: Math.floor(Date.now() / 1000) - 700, // 11+ minutes ago
			});

			expect(consumePendingState(state)).toBeNull();
		});

		it('clearPendingStates removes all states', () => {
			storePendingState('s1', {
				provider: 'google',
				teamId: 'team-1',
				codeVerifier: 'v1',
				createdAt: Math.floor(Date.now() / 1000),
			});
			storePendingState('s2', {
				provider: 'github',
				teamId: 'team-2',
				codeVerifier: null,
				createdAt: Math.floor(Date.now() / 1000),
			});

			clearPendingStates();

			expect(consumePendingState('s1')).toBeNull();
			expect(consumePendingState('s2')).toBeNull();
		});
	});

	describe('buildGoogleAuthUrl', () => {
		it('returns a valid Google OAuth URL with PKCE params', () => {
			const { authUrl, state } = buildGoogleAuthUrl(
				'google-client-id',
				'http://localhost:3333/auth/google/callback',
				'team-1',
			);

			const url = new URL(authUrl);
			expect(url.hostname).toBe('accounts.google.com');
			expect(url.searchParams.get('client_id')).toBe('google-client-id');
			expect(url.searchParams.get('redirect_uri')).toBe(
				'http://localhost:3333/auth/google/callback',
			);
			expect(url.searchParams.get('response_type')).toBe('code');
			expect(url.searchParams.get('scope')).toBe('openid email');
			expect(url.searchParams.get('state')).toBe(state);
			expect(url.searchParams.get('code_challenge')).toBeTruthy();
			expect(url.searchParams.get('code_challenge_method')).toBe('S256');
		});

		it('stores pending state for the callback', () => {
			const { state } = buildGoogleAuthUrl(
				'google-client-id',
				'http://localhost:3333/auth/google/callback',
				'team-1',
			);

			const pending = consumePendingState(state);
			expect(pending).not.toBeNull();
			expect(pending?.provider).toBe('google');
			expect(pending?.teamId).toBe('team-1');
			expect(pending?.codeVerifier).toBeTruthy();
		});
	});

	describe('buildGithubAuthUrl', () => {
		it('returns a valid GitHub OAuth URL without PKCE', () => {
			const { authUrl, state } = buildGithubAuthUrl(
				'github-client-id',
				'http://localhost:3333/auth/github/callback',
				'team-1',
			);

			const url = new URL(authUrl);
			expect(url.hostname).toBe('github.com');
			expect(url.searchParams.get('client_id')).toBe('github-client-id');
			expect(url.searchParams.get('redirect_uri')).toBe(
				'http://localhost:3333/auth/github/callback',
			);
			expect(url.searchParams.get('scope')).toBe('read:user user:email');
			expect(url.searchParams.get('state')).toBe(state);
			// GitHub does NOT have PKCE params
			expect(url.searchParams.get('code_challenge')).toBeNull();
		});

		it('stores pending state with null codeVerifier', () => {
			const { state } = buildGithubAuthUrl(
				'github-client-id',
				'http://localhost:3333/auth/github/callback',
				'team-1',
			);

			const pending = consumePendingState(state);
			expect(pending).not.toBeNull();
			expect(pending?.provider).toBe('github');
			expect(pending?.codeVerifier).toBeNull();
		});
	});

	describe('exchangeGoogleCode', () => {
		it('exchanges code for user info via mocked endpoints', async () => {
			// Create a mock JWT ID token
			const idTokenPayload = {
				sub: 'google-user-123',
				email: 'user@example.com',
				email_verified: true,
				iss: 'https://accounts.google.com',
				aud: 'google-client-id',
			};
			const idToken = createMockJwt(idTokenPayload);

			setOAuthFetch(async (url: string | URL | Request) => {
				const urlStr =
					typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

				if (urlStr.includes('oauth2.googleapis.com/token')) {
					return new Response(
						JSON.stringify({
							access_token: 'mock-access-token',
							id_token: idToken,
							token_type: 'Bearer',
							expires_in: 3600,
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } },
					);
				}

				return new Response('Not found', { status: 404 });
			});

			const userInfo = await exchangeGoogleCode(
				'auth-code-123',
				'google-client-id',
				'google-client-secret',
				'http://localhost:3333/auth/google/callback',
				'code-verifier-abc',
			);

			expect(userInfo.provider).toBe('google');
			expect(userInfo.subject).toBe('google-user-123');
			expect(userInfo.email).toBe('user@example.com');
		});

		it('throws OAuthError when token exchange fails', async () => {
			setOAuthFetch(async () => {
				return new Response('Bad Request', { status: 400 });
			});

			await expect(
				exchangeGoogleCode(
					'bad-code',
					'client-id',
					'client-secret',
					'http://localhost/callback',
					'verifier',
				),
			).rejects.toThrow('Google token exchange failed');
		});

		it('throws OAuthError when id_token is missing', async () => {
			setOAuthFetch(async () => {
				return new Response(
					JSON.stringify({
						access_token: 'token',
						token_type: 'Bearer',
						expires_in: 3600,
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } },
				);
			});

			await expect(
				exchangeGoogleCode(
					'code',
					'client-id',
					'client-secret',
					'http://localhost/callback',
					'verifier',
				),
			).rejects.toThrow('missing id_token');
		});
	});

	describe('exchangeGithubCode', () => {
		it('exchanges code for user info via mocked endpoints', async () => {
			setOAuthFetch(async (url: string | URL | Request) => {
				const urlStr =
					typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

				if (urlStr.includes('github.com/login/oauth/access_token')) {
					return new Response(
						JSON.stringify({
							access_token: 'gho_mock_token',
							token_type: 'bearer',
							scope: 'read:user,user:email',
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } },
					);
				}

				if (urlStr === 'https://api.github.com/user') {
					return new Response(
						JSON.stringify({
							id: 42,
							login: 'testuser',
							email: 'testuser@github.com',
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } },
					);
				}

				return new Response('Not found', { status: 404 });
			});

			const userInfo = await exchangeGithubCode(
				'auth-code-456',
				'github-client-id',
				'github-client-secret',
				'http://localhost:3333/auth/github/callback',
			);

			expect(userInfo.provider).toBe('github');
			expect(userInfo.subject).toBe('42');
			expect(userInfo.email).toBe('testuser@github.com');
		});

		it('fetches email from /user/emails when user.email is null', async () => {
			setOAuthFetch(async (url: string | URL | Request) => {
				const urlStr =
					typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

				if (urlStr.includes('github.com/login/oauth/access_token')) {
					return new Response(
						JSON.stringify({
							access_token: 'gho_mock_token',
							token_type: 'bearer',
							scope: 'read:user,user:email',
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } },
					);
				}

				if (urlStr === 'https://api.github.com/user') {
					return new Response(
						JSON.stringify({
							id: 99,
							login: 'privateuser',
							email: null,
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } },
					);
				}

				if (urlStr === 'https://api.github.com/user/emails') {
					return new Response(
						JSON.stringify([
							{ email: 'secondary@example.com', primary: false, verified: true },
							{ email: 'primary@example.com', primary: true, verified: true },
						]),
						{ status: 200, headers: { 'Content-Type': 'application/json' } },
					);
				}

				return new Response('Not found', { status: 404 });
			});

			const userInfo = await exchangeGithubCode(
				'code',
				'client-id',
				'client-secret',
				'http://localhost/callback',
			);

			expect(userInfo.email).toBe('primary@example.com');
		});

		it('throws OAuthError when token exchange fails', async () => {
			setOAuthFetch(async () => {
				return new Response('Unauthorized', { status: 401 });
			});

			await expect(
				exchangeGithubCode('bad-code', 'client-id', 'client-secret', 'http://localhost/callback'),
			).rejects.toThrow('GitHub token exchange failed');
		});

		it('throws OAuthError when access_token is missing', async () => {
			setOAuthFetch(async () => {
				return new Response(JSON.stringify({ error: 'bad_verification_code' }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			});

			await expect(
				exchangeGithubCode('code', 'client-id', 'client-secret', 'http://localhost/callback'),
			).rejects.toThrow('missing access_token');
		});

		it('throws OAuthError when email cannot be retrieved', async () => {
			setOAuthFetch(async (url: string | URL | Request) => {
				const urlStr =
					typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

				if (urlStr.includes('github.com/login/oauth/access_token')) {
					return new Response(
						JSON.stringify({
							access_token: 'token',
							token_type: 'bearer',
							scope: 'read:user',
						}),
						{ status: 200, headers: { 'Content-Type': 'application/json' } },
					);
				}

				if (urlStr === 'https://api.github.com/user') {
					return new Response(JSON.stringify({ id: 1, login: 'user', email: null }), {
						status: 200,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				if (urlStr === 'https://api.github.com/user/emails') {
					return new Response(JSON.stringify([]), {
						status: 200,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				return new Response('Not found', { status: 404 });
			});

			await expect(
				exchangeGithubCode('code', 'client-id', 'client-secret', 'http://localhost/callback'),
			).rejects.toThrow('Could not retrieve email');
		});
	});
});

// --- Test Helpers ---

/**
 * Create a mock JWT with the given payload (no signature verification needed).
 */
function createMockJwt(payload: Record<string, unknown>) {
	const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
	const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
	const signature = 'mock-signature';
	return `${header}.${body}.${signature}`;
}
