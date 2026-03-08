/**
 * HTTP server for @redshift/bunker OAuth bridge
 *
 * Provides OAuth authentication endpoints (Google, GitHub), session management,
 * API endpoints for identity management, and direct Nostr pubkey authorization.
 *
 * Built with Bun.serve — no external HTTP framework dependencies.
 *
 * Routes:
 *   GET  /auth/google           → Redirect to Google OAuth consent
 *   GET  /auth/google/callback  → Process Google OAuth callback
 *   GET  /auth/github           → Redirect to GitHub OAuth authorization
 *   GET  /auth/github/callback  → Process GitHub OAuth callback
 *   GET  /api/me                → Return current authenticated user info
 *   POST /api/logout            → Clear session cookie
 *   GET  /api/identities        → List available team identities for current user
 *   POST /api/select-identity   → Select identity for NIP-46 connection
 *   POST /api/authorize-pubkey  → Directly authorize a Nostr pubkey (no OAuth)
 */

import type { Database } from 'bun:sqlite';
import { encrypt } from './encryption.js';
import {
	AuthorizationError,
	ConflictError,
	NotFoundError,
	OAuthError,
	SessionError,
	ValidationError,
} from './errors.js';
import { deriveNostrKey } from './key-derivation.js';
import { verifyAdminAuth } from './nip98.js';
import {
	buildGithubAuthUrl,
	buildGoogleAuthUrl,
	consumePendingState,
	exchangeGithubCode,
	exchangeGoogleCode,
} from './oauth.js';
import { TeamSecretService } from './team-secret-service.js';
import { TeamService } from './team-service.js';
import type { BunkerConfig, InvitableRole, Member, MemberRole, OAuthUserInfo } from './types.js';
import { WebSessionManager } from './web-session.js';

/** Configuration for the HTTP server */
export interface HttpServerConfig {
	readonly config: BunkerConfig;
	readonly db: Database;
}

/**
 * Create and start the OAuth bridge HTTP server.
 *
 * @param options - Server configuration
 * @returns The Bun Server instance
 */
export function createHttpServer(options: HttpServerConfig) {
	const { config, db } = options;
	const sessionManager = new WebSessionManager(db);
	const isSecure = config.publicUrl?.startsWith('https') ?? false;
	const publicUrl = config.publicUrl ?? `http://${config.host}:${config.port}`;

	const teamService = new TeamService(db, config.masterKey);
	const teamSecretService = new TeamSecretService(db, config.masterKey, teamService);

	const server = Bun.serve({
		hostname: config.host,
		port: config.port,
		fetch(request: Request) {
			return handleRequest(request, {
				config,
				db,
				sessionManager,
				teamService,
				teamSecretService,
				isSecure,
				publicUrl,
			});
		},
	});

	return server;
}

/** Internal context passed to route handlers */
interface RequestContext {
	readonly config: BunkerConfig;
	readonly db: Database;
	readonly sessionManager: WebSessionManager;
	readonly teamService: TeamService;
	readonly teamSecretService: TeamSecretService;
	readonly isSecure: boolean;
	readonly publicUrl: string;
}

/**
 * Main request router. Dispatches to the appropriate handler based on URL path.
 */
async function handleRequest(request: Request, ctx: RequestContext) {
	const url = new URL(request.url);
	const path = url.pathname;

	try {
		// --- OAuth Routes ---
		if (path === '/auth/google' && request.method === 'GET') {
			return handleGoogleAuth(url, ctx);
		}
		if (path === '/auth/google/callback' && request.method === 'GET') {
			return await handleGoogleCallback(url, ctx);
		}
		if (path === '/auth/github' && request.method === 'GET') {
			return handleGithubAuth(url, ctx);
		}
		if (path === '/auth/github/callback' && request.method === 'GET') {
			return await handleGithubCallback(url, ctx);
		}

		// --- API Routes ---
		if (path === '/api/me' && request.method === 'GET') {
			return handleMe(request, ctx);
		}
		if (path === '/api/logout' && request.method === 'POST') {
			return handleLogout(request, ctx);
		}
		if (path === '/api/identities' && request.method === 'GET') {
			return handleIdentities(request, ctx);
		}
		if (path === '/api/select-identity' && request.method === 'POST') {
			return await handleSelectIdentity(request, ctx);
		}
		if (path === '/api/authorize-pubkey' && request.method === 'POST') {
			return await handleAuthorizePubkey(request, ctx);
		}

		// --- Admin API Routes (NIP-98 auth) ---
		if (path === '/api/admin/teams' && request.method === 'POST') {
			return await handleAdminCreateTeam(request, ctx);
		}
		if (path === '/api/admin/teams' && request.method === 'GET') {
			return handleAdminListTeams(request, ctx);
		}

		// Admin routes with team ID parameter
		const teamMatch = path.match(/^\/api\/admin\/teams\/([^/]+)$/);
		if (teamMatch) {
			const teamId = teamMatch[1] as string;
			if (request.method === 'GET') {
				return handleAdminGetTeam(request, ctx, teamId);
			}
			if (request.method === 'DELETE') {
				return handleAdminDeleteTeam(request, ctx, teamId);
			}
		}

		// Admin invite route
		const inviteMatch = path.match(/^\/api\/admin\/teams\/([^/]+)\/invite$/);
		if (inviteMatch && request.method === 'POST') {
			return await handleAdminInviteMember(request, ctx, inviteMatch[1] as string);
		}

		// Admin members list route
		const membersMatch = path.match(/^\/api\/admin\/teams\/([^/]+)\/members$/);
		if (membersMatch && request.method === 'GET') {
			return handleAdminListMembers(request, ctx, membersMatch[1] as string);
		}

		// Admin member removal route
		const memberMatch = path.match(/^\/api\/admin\/teams\/([^/]+)\/members\/([^/]+)$/);
		if (memberMatch && request.method === 'DELETE') {
			return handleAdminRemoveMember(
				request,
				ctx,
				memberMatch[1] as string,
				memberMatch[2] as string,
			);
		}

		// Admin role change route
		const roleMatch = path.match(/^\/api\/admin\/teams\/([^/]+)\/members\/([^/]+)\/role$/);
		if (roleMatch && request.method === 'PUT') {
			return await handleAdminChangeRole(
				request,
				ctx,
				roleMatch[1] as string,
				roleMatch[2] as string,
			);
		}

		// Admin key rotation route
		const rotateKeyMatch = path.match(/^\/api\/admin\/teams\/([^/]+)\/rotate-key$/);
		if (rotateKeyMatch && request.method === 'POST') {
			return handleAdminRotateKey(request, ctx, rotateKeyMatch[1] as string);
		}

		// Admin rotated keys routes
		const rotatedKeysMatch = path.match(/^\/api\/admin\/teams\/([^/]+)\/rotated-keys$/);
		if (rotatedKeysMatch && request.method === 'GET') {
			return handleAdminListRotatedKeys(request, ctx, rotatedKeysMatch[1] as string);
		}

		const rotatedKeyDeleteMatch = path.match(
			/^\/api\/admin\/teams\/([^/]+)\/rotated-keys\/([^/]+)$/,
		);
		if (rotatedKeyDeleteMatch && request.method === 'DELETE') {
			return handleAdminDeleteRotatedKey(
				request,
				ctx,
				rotatedKeyDeleteMatch[1] as string,
				rotatedKeyDeleteMatch[2] as string,
			);
		}

		// --- Health Check ---
		if (path === '/health') {
			return jsonResponse({ status: 'ok' });
		}

		return jsonResponse({ error: 'Not found' }, 404);
	} catch (error) {
		if (error instanceof SessionError) {
			return jsonResponse({ error: error.message }, 401);
		}
		if (error instanceof OAuthError) {
			return jsonResponse({ error: error.message }, 400);
		}
		if (error instanceof AuthorizationError) {
			return jsonResponse({ error: error.message }, 403);
		}
		if (error instanceof NotFoundError) {
			return jsonResponse({ error: error.message }, 404);
		}
		if (error instanceof ConflictError) {
			return jsonResponse({ error: error.message }, 409);
		}
		if (error instanceof ValidationError) {
			return jsonResponse({ error: error.message }, 400);
		}

		const message = error instanceof Error ? error.message : 'Internal server error';
		return jsonResponse({ error: message }, 500);
	}
}

// --- OAuth Handlers ---

/**
 * GET /auth/google — Redirect to Google OAuth consent screen.
 * Query params: team (required) — team ID to associate with this flow.
 */
function handleGoogleAuth(url: URL, ctx: RequestContext) {
	const teamId = url.searchParams.get('team');
	if (!teamId) {
		return jsonResponse({ error: 'Missing team parameter' }, 400);
	}

	if (!ctx.config.googleClientId || !ctx.config.googleClientSecret) {
		return jsonResponse({ error: 'Google OAuth not configured' }, 400);
	}

	// Verify team exists
	const team = ctx.db
		.query<{ id: string }, [string]>('SELECT id FROM teams WHERE id = ?')
		.get(teamId);
	if (!team) {
		return jsonResponse({ error: 'Team not found' }, 404);
	}

	const redirectUri = `${ctx.publicUrl}/auth/google/callback`;
	const { authUrl } = buildGoogleAuthUrl(ctx.config.googleClientId, redirectUri, teamId);

	return Response.redirect(authUrl, 302);
}

/**
 * GET /auth/google/callback — Process Google OAuth callback.
 * Query params: code, state (from Google redirect).
 */
async function handleGoogleCallback(url: URL, ctx: RequestContext) {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	if (!code || !state) {
		return jsonResponse({ error: 'Missing code or state parameter' }, 400);
	}

	// Validate state and retrieve pending OAuth data
	const pendingState = consumePendingState(state);
	if (!pendingState) {
		return jsonResponse({ error: 'Invalid or expired OAuth state' }, 400);
	}

	if (pendingState.provider !== 'google' || !pendingState.codeVerifier) {
		return jsonResponse({ error: 'Invalid OAuth state for Google' }, 400);
	}

	if (!ctx.config.googleClientId || !ctx.config.googleClientSecret) {
		return jsonResponse({ error: 'Google OAuth not configured' }, 400);
	}

	const redirectUri = `${ctx.publicUrl}/auth/google/callback`;

	const userInfo = await exchangeGoogleCode(
		code,
		ctx.config.googleClientId,
		ctx.config.googleClientSecret,
		redirectUri,
		pendingState.codeVerifier,
	);

	return completeOAuthLogin(userInfo, pendingState.teamId, ctx);
}

/**
 * GET /auth/github — Redirect to GitHub OAuth authorization.
 * Query params: team (required) — team ID to associate with this flow.
 */
function handleGithubAuth(url: URL, ctx: RequestContext) {
	const teamId = url.searchParams.get('team');
	if (!teamId) {
		return jsonResponse({ error: 'Missing team parameter' }, 400);
	}

	if (!ctx.config.githubClientId || !ctx.config.githubClientSecret) {
		return jsonResponse({ error: 'GitHub OAuth not configured' }, 400);
	}

	// Verify team exists
	const team = ctx.db
		.query<{ id: string }, [string]>('SELECT id FROM teams WHERE id = ?')
		.get(teamId);
	if (!team) {
		return jsonResponse({ error: 'Team not found' }, 404);
	}

	const redirectUri = `${ctx.publicUrl}/auth/github/callback`;
	const { authUrl } = buildGithubAuthUrl(ctx.config.githubClientId, redirectUri, teamId);

	return Response.redirect(authUrl, 302);
}

/**
 * GET /auth/github/callback — Process GitHub OAuth callback.
 * Query params: code, state (from GitHub redirect).
 */
async function handleGithubCallback(url: URL, ctx: RequestContext) {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	if (!code || !state) {
		return jsonResponse({ error: 'Missing code or state parameter' }, 400);
	}

	const pendingState = consumePendingState(state);
	if (!pendingState) {
		return jsonResponse({ error: 'Invalid or expired OAuth state' }, 400);
	}

	if (pendingState.provider !== 'github') {
		return jsonResponse({ error: 'Invalid OAuth state for GitHub' }, 400);
	}

	if (!ctx.config.githubClientId || !ctx.config.githubClientSecret) {
		return jsonResponse({ error: 'GitHub OAuth not configured' }, 400);
	}

	const redirectUri = `${ctx.publicUrl}/auth/github/callback`;

	const userInfo = await exchangeGithubCode(
		code,
		ctx.config.githubClientId,
		ctx.config.githubClientSecret,
		redirectUri,
	);

	return completeOAuthLogin(userInfo, pendingState.teamId, ctx);
}

/**
 * Complete the OAuth login flow after provider authentication.
 *
 * 1. Look up or create the member in the database
 * 2. Derive a Nostr keypair for the member (if not already done)
 * 3. Create a web session
 * 4. Set the session cookie
 * 5. Redirect to the identity picker or return JSON
 */
function completeOAuthLogin(userInfo: OAuthUserInfo, teamId: string, ctx: RequestContext) {
	// Look up existing member by OAuth provider + subject in this team
	let member = ctx.db
		.query<Member, [string, string, string]>(
			'SELECT * FROM members WHERE team_id = ? AND oauth_provider = ? AND oauth_subject = ?',
		)
		.get(teamId, userInfo.provider, userInfo.subject);

	if (!member) {
		// Derive a Nostr keypair for this OAuth user
		const masterSeed = Buffer.from(ctx.config.masterKey, 'hex');
		const { privateKey, pubkey } = deriveNostrKey(
			masterSeed,
			teamId,
			`${userInfo.provider}:${userInfo.subject}`,
		);

		// Create the member
		const memberId = crypto.randomUUID();
		const now = Math.floor(Date.now() / 1000);

		ctx.db
			.query(
				'INSERT INTO members (id, team_id, pubkey, role, email, oauth_provider, oauth_subject, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			)
			.run(
				memberId,
				teamId,
				pubkey,
				'developer',
				userInfo.email,
				userInfo.provider,
				userInfo.subject,
				now,
			);

		// Create an identity for this member
		const identityId = crypto.randomUUID();
		const encryptedNsec = encrypt(Buffer.from(privateKey).toString('hex'), ctx.config.masterKey);

		ctx.db
			.query(
				'INSERT INTO identities (id, team_id, pubkey, encrypted_nsec, label, created_at) VALUES (?, ?, ?, ?, ?, ?)',
			)
			.run(
				identityId,
				teamId,
				pubkey,
				encryptedNsec,
				`${userInfo.provider}:${userInfo.email}`,
				now,
			);

		// Create assignment
		const assignmentId = crypto.randomUUID();
		ctx.db
			.query('INSERT INTO assignments (id, identity_id, member_id, created_at) VALUES (?, ?, ?, ?)')
			.run(assignmentId, identityId, memberId, now);

		// Re-fetch the member
		member = ctx.db.query<Member, [string]>('SELECT * FROM members WHERE id = ?').get(memberId);

		if (!member) {
			return jsonResponse({ error: 'Failed to create member' }, 500);
		}
	}

	// Create web session
	const session = ctx.sessionManager.createSession(member.id, teamId);

	// Set session cookie and redirect
	const setCookie = WebSessionManager.buildSetCookieHeader(session.id, ctx.isSecure);

	return new Response(null, {
		status: 302,
		headers: {
			Location: `${ctx.publicUrl}/api/me`,
			'Set-Cookie': setCookie,
		},
	});
}

// --- API Handlers ---

/**
 * GET /api/me — Return current authenticated user info.
 */
function handleMe(request: Request, ctx: RequestContext) {
	const session = ctx.sessionManager.validateRequest(request);

	const member = ctx.db
		.query<Member, [string]>('SELECT * FROM members WHERE id = ?')
		.get(session.member_id);

	if (!member) {
		return jsonResponse({ error: 'Member not found' }, 404);
	}

	const team = ctx.db
		.query<{ id: string; name: string; slug: string }, [string]>(
			'SELECT id, name, slug FROM teams WHERE id = ?',
		)
		.get(session.team_id);

	return jsonResponse({
		member: {
			id: member.id,
			pubkey: member.pubkey,
			role: member.role,
			email: member.email,
			oauthProvider: member.oauth_provider,
		},
		team: team ? { id: team.id, name: team.name, slug: team.slug } : null,
	});
}

/**
 * POST /api/logout — Clear session cookie and delete session.
 */
function handleLogout(request: Request, ctx: RequestContext) {
	const cookieHeader = request.headers.get('Cookie');
	const sessionId = WebSessionManager.extractSessionId(cookieHeader);

	if (sessionId) {
		ctx.sessionManager.deleteSession(sessionId);
	}

	const clearCookie = WebSessionManager.buildClearCookieHeader(ctx.isSecure);

	return new Response(JSON.stringify({ success: true }), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			'Set-Cookie': clearCookie,
		},
	});
}

/**
 * GET /api/identities — List available team identities for the current user.
 */
function handleIdentities(request: Request, ctx: RequestContext) {
	const session = ctx.sessionManager.validateRequest(request);

	const now = Math.floor(Date.now() / 1000);
	const identities = ctx.db
		.query<
			{
				identityId: string;
				teamId: string;
				teamName: string;
				pubkey: string;
				label: string | null;
				role: string;
			},
			[string, number]
		>(
			`SELECT
				i.id as identityId,
				i.team_id as teamId,
				t.name as teamName,
				i.pubkey,
				i.label,
				m.role
			FROM assignments a
			JOIN identities i ON a.identity_id = i.id
			JOIN members m ON a.member_id = m.id
			JOIN teams t ON i.team_id = t.id
			WHERE a.member_id = ?
			AND (a.expires_at IS NULL OR a.expires_at > ?)`,
		)
		.all(session.member_id, now);

	return jsonResponse({ identities });
}

/**
 * POST /api/select-identity — Select an identity for NIP-46 connection.
 * Body: { identityId: string }
 */
async function handleSelectIdentity(request: Request, ctx: RequestContext) {
	const session = ctx.sessionManager.validateRequest(request);

	const body = (await request.json()) as { identityId?: string };
	const identityId = body.identityId;

	if (!identityId) {
		return jsonResponse({ error: 'Missing identityId' }, 400);
	}

	// Verify the member has an assignment to this identity
	const now = Math.floor(Date.now() / 1000);
	const assignment = ctx.db
		.query<{ id: string }, [string, string, number]>(
			`SELECT a.id FROM assignments a
			WHERE a.identity_id = ? AND a.member_id = ?
			AND (a.expires_at IS NULL OR a.expires_at > ?)`,
		)
		.get(identityId, session.member_id, now);

	if (!assignment) {
		return jsonResponse({ error: 'Identity not assigned to you' }, 403);
	}

	// Get the identity details
	const identity = ctx.db
		.query<{ id: string; pubkey: string; team_id: string }, [string]>(
			'SELECT id, pubkey, team_id FROM identities WHERE id = ?',
		)
		.get(identityId);

	if (!identity) {
		return jsonResponse({ error: 'Identity not found' }, 404);
	}

	return jsonResponse({
		selected: {
			identityId: identity.id,
			pubkey: identity.pubkey,
			teamId: identity.team_id,
		},
	});
}

/**
 * POST /api/authorize-pubkey — Directly authorize a Nostr pubkey without OAuth.
 * Body: { pubkey: string, teamId: string, role?: MemberRole }
 *
 * This allows users with existing Nostr keys to join a team without going
 * through OAuth. The caller must be an admin or owner of the team.
 */
async function handleAuthorizePubkey(request: Request, ctx: RequestContext) {
	const session = ctx.sessionManager.validateRequest(request);

	const body = (await request.json()) as {
		pubkey?: string;
		teamId?: string;
		role?: string;
	};

	if (!body.pubkey || !body.teamId) {
		return jsonResponse({ error: 'Missing pubkey or teamId' }, 400);
	}

	// Validate pubkey format (64 hex chars)
	if (!/^[0-9a-fA-F]{64}$/.test(body.pubkey)) {
		return jsonResponse({ error: 'Invalid pubkey format' }, 400);
	}

	// Check that the requesting user is admin or owner of the target team
	const requestingMember = ctx.db
		.query<{ role: string }, [string, string]>(
			'SELECT role FROM members WHERE id = ? AND team_id = ?',
		)
		.get(session.member_id, body.teamId);

	if (!requestingMember) {
		return jsonResponse({ error: 'You are not a member of this team' }, 403);
	}

	if (requestingMember.role !== 'owner' && requestingMember.role !== 'admin') {
		return jsonResponse({ error: 'Only owners and admins can authorize pubkeys' }, 403);
	}

	// Check if member already exists
	const existing = ctx.db
		.query<{ id: string }, [string, string]>(
			'SELECT id FROM members WHERE team_id = ? AND pubkey = ?',
		)
		.get(body.teamId, body.pubkey);

	if (existing) {
		return jsonResponse({ error: 'Pubkey already authorized for this team' }, 409);
	}

	// Validate role
	const validRoles = ['owner', 'admin', 'developer', 'readonly'];
	const role = body.role ?? 'developer';
	if (!validRoles.includes(role)) {
		return jsonResponse({ error: 'Invalid role' }, 400);
	}

	// Create the member
	const memberId = crypto.randomUUID();
	const now = Math.floor(Date.now() / 1000);

	ctx.db
		.query(
			'INSERT INTO members (id, team_id, pubkey, role, joined_at, invited_by) VALUES (?, ?, ?, ?, ?, ?)',
		)
		.run(memberId, body.teamId, body.pubkey, role, now, session.member_id);

	return jsonResponse(
		{
			member: {
				id: memberId,
				pubkey: body.pubkey,
				teamId: body.teamId,
				role,
			},
		},
		201,
	);
}

// --- Admin API Handlers (NIP-98 auth) ---

/**
 * Verify NIP-98 admin auth for a request.
 * Returns the authenticated admin's pubkey.
 */
function requireAdminAuth(request: Request, ctx: RequestContext) {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader) {
		throw new AuthorizationError('Missing Authorization header');
	}

	const result = verifyAdminAuth(authHeader, request.url, request.method, ctx.config.adminPubkeys);

	return result.pubkey;
}

/**
 * POST /api/admin/teams — Create a new team.
 * Body: { name: string, slug: string }
 */
async function handleAdminCreateTeam(request: Request, ctx: RequestContext) {
	const adminPubkey = requireAdminAuth(request, ctx);

	const body = (await request.json()) as {
		name?: string;
		slug?: string;
	};

	if (!body.name || !body.slug) {
		return jsonResponse({ error: 'Missing name or slug' }, 400);
	}

	const team = ctx.teamService.createTeam(body.name, body.slug, adminPubkey);
	return jsonResponse({ team }, 201);
}

/**
 * GET /api/admin/teams — List all teams.
 */
function handleAdminListTeams(request: Request, ctx: RequestContext) {
	requireAdminAuth(request, ctx);

	const teams = ctx.teamService.listTeams();
	return jsonResponse({ teams });
}

/**
 * GET /api/admin/teams/:id — Get team details.
 */
function handleAdminGetTeam(request: Request, ctx: RequestContext, teamId: string) {
	requireAdminAuth(request, ctx);

	const team = ctx.teamService.getTeam(teamId);
	if (!team) {
		return jsonResponse({ error: 'Team not found' }, 404);
	}

	const members = ctx.teamService.listMembers(teamId);
	return jsonResponse({ team, members });
}

/**
 * DELETE /api/admin/teams/:id — Delete a team (owner only).
 */
function handleAdminDeleteTeam(request: Request, ctx: RequestContext, teamId: string) {
	const adminPubkey = requireAdminAuth(request, ctx);

	ctx.teamService.deleteTeam(teamId, adminPubkey);
	return jsonResponse({ success: true });
}

/**
 * POST /api/admin/teams/:id/invite — Invite a member.
 * Body: { email?: string, pubkey?: string, role: InvitableRole }
 */
async function handleAdminInviteMember(request: Request, ctx: RequestContext, teamId: string) {
	const adminPubkey = requireAdminAuth(request, ctx);

	const body = (await request.json()) as {
		email?: string;
		pubkey?: string;
		role?: string;
	};

	if (!body.role) {
		return jsonResponse({ error: 'Missing role' }, 400);
	}

	const invitation = ctx.teamService.inviteMember(
		teamId,
		{
			email: body.email,
			pubkey: body.pubkey,
			role: body.role as InvitableRole,
		},
		adminPubkey,
	);

	return jsonResponse({ invitation }, 201);
}

/**
 * GET /api/admin/teams/:id/members — List team members.
 */
function handleAdminListMembers(request: Request, ctx: RequestContext, teamId: string) {
	requireAdminAuth(request, ctx);

	const members = ctx.teamService.listMembers(teamId);
	return jsonResponse({ members });
}

/**
 * DELETE /api/admin/teams/:id/members/:pubkey — Remove a member.
 */
function handleAdminRemoveMember(
	request: Request,
	ctx: RequestContext,
	teamId: string,
	memberPubkey: string,
) {
	const adminPubkey = requireAdminAuth(request, ctx);

	ctx.teamService.removeMember(teamId, memberPubkey, adminPubkey);
	return jsonResponse({ success: true });
}

/**
 * PUT /api/admin/teams/:id/members/:pubkey/role — Change a member's role.
 * Body: { role: MemberRole }
 */
async function handleAdminChangeRole(
	request: Request,
	ctx: RequestContext,
	teamId: string,
	memberPubkey: string,
) {
	const adminPubkey = requireAdminAuth(request, ctx);

	const body = (await request.json()) as { role?: string };

	if (!body.role) {
		return jsonResponse({ error: 'Missing role' }, 400);
	}

	ctx.teamService.changeRole(teamId, memberPubkey, body.role as MemberRole, adminPubkey);
	return jsonResponse({ success: true });
}

// --- Admin Key Rotation Handlers ---

/**
 * POST /api/admin/teams/:id/rotate-key — Rotate a team's Nostr keypair.
 */
function handleAdminRotateKey(request: Request, ctx: RequestContext, teamId: string) {
	const adminPubkey = requireAdminAuth(request, ctx);

	const result = ctx.teamSecretService.rotateTeamKey(teamId, adminPubkey);
	return jsonResponse({ oldPubkey: result.oldPubkey, newPubkey: result.newPubkey });
}

/**
 * GET /api/admin/teams/:id/rotated-keys — List rotated keys for a team.
 */
function handleAdminListRotatedKeys(request: Request, ctx: RequestContext, teamId: string) {
	requireAdminAuth(request, ctx);

	const rotatedKeys = ctx.teamSecretService.getRotatedKeys(teamId);
	return jsonResponse({ rotatedKeys });
}

/**
 * DELETE /api/admin/teams/:id/rotated-keys/:oldPubkey — Delete a rotated key entry.
 */
function handleAdminDeleteRotatedKey(
	request: Request,
	ctx: RequestContext,
	teamId: string,
	oldPubkey: string,
) {
	requireAdminAuth(request, ctx);

	ctx.teamSecretService.deleteRotatedKey(teamId, oldPubkey);
	return jsonResponse({ success: true });
}

// --- Utility Functions ---

/**
 * Create a JSON response with proper headers.
 */
function jsonResponse(data: Record<string, unknown>, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}
