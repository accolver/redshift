/**
 * OAuth provider implementations for @redshift/bunker
 *
 * Implements Google OAuth (with PKCE) and GitHub OAuth (with state parameter)
 * authorization code flows using manual fetch() calls — no external OAuth libraries.
 *
 * Google: Authorization Code + PKCE (code_verifier/code_challenge)
 * GitHub: Authorization Code + state (CSRF protection only, no PKCE support)
 */

import { createHash, randomBytes } from 'node:crypto';
import { OAuthError } from './errors.js';
import type { OAuthProvider, OAuthUserInfo } from './types.js';

// --- Google OAuth Constants ---
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// --- GitHub OAuth Constants ---
const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

/** Pending OAuth state stored between redirect and callback */
export interface OAuthState {
	readonly provider: OAuthProvider;
	readonly teamId: string;
	readonly codeVerifier: string | null; // Only for Google (PKCE)
	readonly createdAt: number;
}

/** In-memory store for pending OAuth states, keyed by state parameter */
const pendingStates = new Map<string, OAuthState>();

/** Type for the fetch function */
type FetchFn = (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** Configurable fetch function for testing */
let fetchFn: FetchFn = fetch;

/**
 * Override the fetch function used for OAuth HTTP calls.
 * Used in tests to mock external provider responses.
 */
export function setOAuthFetch(fn: FetchFn) {
	fetchFn = fn;
}

/**
 * Reset the fetch function to the global default.
 */
export function resetOAuthFetch() {
	fetchFn = fetch;
}

// --- PKCE Utilities ---

/**
 * Generate a cryptographically random code verifier for PKCE.
 * Returns a URL-safe base64 string of 32 random bytes.
 */
export function generateCodeVerifier() {
	return randomBytes(32).toString('base64url');
}

/**
 * Compute the S256 code challenge from a code verifier.
 * SHA-256 hash of the verifier, base64url-encoded.
 */
export function computeCodeChallenge(verifier: string) {
	return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Generate a random state parameter for CSRF protection.
 */
export function generateState() {
	return randomBytes(16).toString('hex');
}

// --- State Management ---

/**
 * Store a pending OAuth state for later validation in the callback.
 */
export function storePendingState(state: string, data: OAuthState) {
	pendingStates.set(state, data);
}

/**
 * Retrieve and remove a pending OAuth state.
 * Returns null if the state is not found or has expired (10 minutes).
 */
export function consumePendingState(state: string) {
	const data = pendingStates.get(state);
	if (!data) {
		return null;
	}

	pendingStates.delete(state);

	// Expire after 10 minutes
	const now = Math.floor(Date.now() / 1000);
	if (now - data.createdAt > 600) {
		return null;
	}

	return data;
}

/**
 * Clear all pending states. Used in tests.
 */
export function clearPendingStates() {
	pendingStates.clear();
}

// --- Google OAuth ---

/**
 * Build the Google OAuth authorization URL with PKCE.
 *
 * @param clientId - Google OAuth client ID
 * @param redirectUri - Callback URL (e.g., https://bunker.example.com/auth/google/callback)
 * @param teamId - Team ID to associate with this OAuth flow
 * @returns Object with authUrl and state for redirect
 */
export function buildGoogleAuthUrl(clientId: string, redirectUri: string, teamId: string) {
	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const codeChallenge = computeCodeChallenge(codeVerifier);

	storePendingState(state, {
		provider: 'google',
		teamId,
		codeVerifier,
		createdAt: Math.floor(Date.now() / 1000),
	});

	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'openid email',
		state,
		code_challenge: codeChallenge,
		code_challenge_method: 'S256',
	});

	return {
		authUrl: `${GOOGLE_AUTH_URL}?${params.toString()}`,
		state,
	};
}

/** Shape of Google's token response */
interface GoogleTokenResponse {
	readonly access_token: string;
	readonly id_token: string;
	readonly token_type: string;
	readonly expires_in: number;
}

/** Shape of a decoded Google ID token payload (JWT claims) */
interface GoogleIdTokenPayload {
	readonly sub: string;
	readonly email: string;
	readonly email_verified: boolean;
	readonly iss: string;
	readonly aud: string;
}

/**
 * Exchange a Google authorization code for user info.
 *
 * 1. Exchange code for tokens (with PKCE code_verifier)
 * 2. Decode the ID token (JWT) to extract sub + email
 *
 * @param code - Authorization code from Google callback
 * @param clientId - Google OAuth client ID
 * @param clientSecret - Google OAuth client secret
 * @param redirectUri - Must match the redirect_uri used in the auth URL
 * @param codeVerifier - PKCE code verifier from the initial request
 * @returns OAuthUserInfo with provider, subject, and email
 * @throws {OAuthError} if token exchange or ID token parsing fails
 */
export async function exchangeGoogleCode(
	code: string,
	clientId: string,
	clientSecret: string,
	redirectUri: string,
	codeVerifier: string,
) {
	// Exchange code for tokens
	const tokenResponse = await fetchFn(GOOGLE_TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code',
			code_verifier: codeVerifier,
		}).toString(),
	});

	if (!tokenResponse.ok) {
		const errorText = await tokenResponse.text();
		throw new OAuthError(`Google token exchange failed: ${errorText}`);
	}

	const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;

	if (!tokenData.id_token) {
		throw new OAuthError('Google token response missing id_token');
	}

	// Decode the ID token (JWT) — we don't verify the signature here
	// because we just received it directly from Google over HTTPS
	const payload = decodeJwtPayload(tokenData.id_token);

	if (!payload.sub || !payload.email) {
		throw new OAuthError('Google ID token missing sub or email');
	}

	const userInfo: OAuthUserInfo = {
		provider: 'google',
		subject: payload.sub,
		email: payload.email,
	};

	return userInfo;
}

/**
 * Decode the payload section of a JWT without signature verification.
 * Safe when the JWT was received directly from the provider over HTTPS.
 */
function decodeJwtPayload(jwt: string) {
	const parts = jwt.split('.');
	const payloadPart = parts[1];
	if (!payloadPart) {
		throw new OAuthError('Invalid JWT format');
	}

	try {
		const decoded = Buffer.from(payloadPart, 'base64url').toString('utf8');
		return JSON.parse(decoded) as GoogleIdTokenPayload;
	} catch {
		throw new OAuthError('Failed to decode JWT payload');
	}
}

// --- GitHub OAuth ---

/**
 * Build the GitHub OAuth authorization URL.
 * GitHub does NOT support PKCE — uses state parameter for CSRF protection only.
 *
 * @param clientId - GitHub OAuth client ID
 * @param redirectUri - Callback URL
 * @param teamId - Team ID to associate with this OAuth flow
 * @returns Object with authUrl and state for redirect
 */
export function buildGithubAuthUrl(clientId: string, redirectUri: string, teamId: string) {
	const state = generateState();

	storePendingState(state, {
		provider: 'github',
		teamId,
		codeVerifier: null, // GitHub doesn't support PKCE
		createdAt: Math.floor(Date.now() / 1000),
	});

	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		scope: 'read:user user:email',
		state,
	});

	return {
		authUrl: `${GITHUB_AUTH_URL}?${params.toString()}`,
		state,
	};
}

/** Shape of GitHub's token response */
interface GithubTokenResponse {
	readonly access_token: string;
	readonly token_type: string;
	readonly scope: string;
}

/** Shape of GitHub's user API response */
interface GithubUserResponse {
	readonly id: number;
	readonly login: string;
	readonly email: string | null;
}

/** Shape of GitHub's user emails API response */
interface GithubEmailResponse {
	readonly email: string;
	readonly primary: boolean;
	readonly verified: boolean;
}

/**
 * Exchange a GitHub authorization code for user info.
 *
 * 1. Exchange code for access token
 * 2. Fetch user profile from GitHub API
 * 3. If email is null, fetch from /user/emails endpoint
 *
 * @param code - Authorization code from GitHub callback
 * @param clientId - GitHub OAuth client ID
 * @param clientSecret - GitHub OAuth client secret
 * @param redirectUri - Must match the redirect_uri used in the auth URL
 * @returns OAuthUserInfo with provider, subject (GitHub user ID), and email
 * @throws {OAuthError} if token exchange or user fetch fails
 */
export async function exchangeGithubCode(
	code: string,
	clientId: string,
	clientSecret: string,
	redirectUri: string,
) {
	// Exchange code for access token
	const tokenResponse = await fetchFn(GITHUB_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/json',
		},
		body: new URLSearchParams({
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: redirectUri,
		}).toString(),
	});

	if (!tokenResponse.ok) {
		const errorText = await tokenResponse.text();
		throw new OAuthError(`GitHub token exchange failed: ${errorText}`);
	}

	const tokenData = (await tokenResponse.json()) as GithubTokenResponse;

	if (!tokenData.access_token) {
		throw new OAuthError('GitHub token response missing access_token');
	}

	// Fetch user profile
	const userResponse = await fetchFn(GITHUB_USER_URL, {
		headers: {
			Authorization: `Bearer ${tokenData.access_token}`,
			Accept: 'application/json',
		},
	});

	if (!userResponse.ok) {
		const errorText = await userResponse.text();
		throw new OAuthError(`GitHub user fetch failed: ${errorText}`);
	}

	const userData = (await userResponse.json()) as GithubUserResponse;

	let email = userData.email;

	// If email is null, try the emails endpoint
	if (!email) {
		const emailsResponse = await fetchFn('https://api.github.com/user/emails', {
			headers: {
				Authorization: `Bearer ${tokenData.access_token}`,
				Accept: 'application/json',
			},
		});

		if (emailsResponse.ok) {
			const emails = (await emailsResponse.json()) as GithubEmailResponse[];
			const primary = emails.find((e) => e.primary && e.verified);
			email = primary?.email ?? emails[0]?.email ?? null;
		}
	}

	if (!email) {
		throw new OAuthError('Could not retrieve email from GitHub');
	}

	const userInfo: OAuthUserInfo = {
		provider: 'github',
		subject: String(userData.id),
		email,
	};

	return userInfo;
}
