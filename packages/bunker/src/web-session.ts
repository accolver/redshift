/**
 * Web session management for @redshift/bunker OAuth bridge
 *
 * Manages HTTP sessions backed by SQLite. Sessions are identified by
 * random IDs stored in HTTP-only cookies. Distinct from NIP-46 sessions
 * which are managed by SessionManager.
 */

import type { Database } from 'bun:sqlite';
import { randomBytes } from 'node:crypto';
import { SessionError } from './errors.js';
import type { WebSession } from './types.js';

/** Default session duration: 7 days in seconds */
const DEFAULT_SESSION_DURATION = 7 * 24 * 60 * 60;

/** Cookie name for web sessions */
export const SESSION_COOKIE_NAME = 'redshift_session';

/**
 * WebSessionManager handles the lifecycle of OAuth HTTP sessions.
 *
 * Sessions are stored in SQLite's web_sessions table and identified
 * by random session IDs stored in HTTP-only cookies.
 */
export class WebSessionManager {
	private readonly db: Database;
	private readonly sessionDuration: number;

	constructor(db: Database, sessionDuration = DEFAULT_SESSION_DURATION) {
		this.db = db;
		this.sessionDuration = sessionDuration;
	}

	/**
	 * Create a new web session for a member.
	 *
	 * @param memberId - The member's database ID
	 * @param teamId - The team's database ID
	 * @returns The created WebSession with a random ID for the cookie
	 */
	createSession(memberId: string, teamId: string) {
		const id = randomBytes(32).toString('hex');
		const now = Math.floor(Date.now() / 1000);
		const expiresAt = now + this.sessionDuration;

		this.db
			.query(
				'INSERT INTO web_sessions (id, member_id, team_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
			)
			.run(id, memberId, teamId, now, expiresAt);

		const session: WebSession = {
			id,
			member_id: memberId,
			team_id: teamId,
			created_at: now,
			expires_at: expiresAt,
		};

		return session;
	}

	/**
	 * Get a valid (non-expired) session by ID.
	 *
	 * @param sessionId - The session ID from the cookie
	 * @returns The WebSession or null if not found/expired
	 */
	getSession(sessionId: string) {
		const now = Math.floor(Date.now() / 1000);

		const row = this.db
			.query<WebSession, [string, number]>(
				'SELECT * FROM web_sessions WHERE id = ? AND expires_at > ?',
			)
			.get(sessionId, now);

		return row ?? null;
	}

	/**
	 * Delete a session (logout).
	 *
	 * @param sessionId - The session ID to delete
	 */
	deleteSession(sessionId: string) {
		this.db.query('DELETE FROM web_sessions WHERE id = ?').run(sessionId);
	}

	/**
	 * Delete all sessions for a member.
	 *
	 * @param memberId - The member's database ID
	 */
	deleteSessionsForMember(memberId: string) {
		this.db.query('DELETE FROM web_sessions WHERE member_id = ?').run(memberId);
	}

	/**
	 * Clean up expired sessions from the database.
	 */
	cleanupExpired() {
		const now = Math.floor(Date.now() / 1000);
		this.db.query('DELETE FROM web_sessions WHERE expires_at <= ?').run(now);
	}

	/**
	 * Extract the session ID from a Cookie header string.
	 *
	 * @param cookieHeader - The raw Cookie header value
	 * @returns The session ID or null if not found
	 */
	static extractSessionId(cookieHeader: string | null) {
		if (!cookieHeader) {
			return null;
		}

		const cookies = cookieHeader.split(';');
		for (const cookie of cookies) {
			const [name, ...valueParts] = cookie.trim().split('=');
			if (name === SESSION_COOKIE_NAME) {
				return valueParts.join('=') || null;
			}
		}

		return null;
	}

	/**
	 * Build a Set-Cookie header value for a session.
	 *
	 * @param sessionId - The session ID to set
	 * @param secure - Whether to set the Secure flag (true in production)
	 * @returns The Set-Cookie header value
	 */
	static buildSetCookieHeader(sessionId: string, secure: boolean) {
		const maxAge = DEFAULT_SESSION_DURATION;
		const parts = [
			`${SESSION_COOKIE_NAME}=${sessionId}`,
			'HttpOnly',
			'SameSite=Lax',
			`Max-Age=${maxAge}`,
			'Path=/',
		];

		if (secure) {
			parts.push('Secure');
		}

		return parts.join('; ');
	}

	/**
	 * Build a Set-Cookie header that clears the session cookie.
	 *
	 * @param secure - Whether to set the Secure flag
	 * @returns The Set-Cookie header value that expires the cookie
	 */
	static buildClearCookieHeader(secure: boolean) {
		const parts = [`${SESSION_COOKIE_NAME}=`, 'HttpOnly', 'SameSite=Lax', 'Max-Age=0', 'Path=/'];

		if (secure) {
			parts.push('Secure');
		}

		return parts.join('; ');
	}

	/**
	 * Validate a request's session cookie and return the session.
	 *
	 * @param request - The incoming HTTP request
	 * @returns The WebSession
	 * @throws {SessionError} if no valid session is found
	 */
	validateRequest(request: Request) {
		const cookieHeader = request.headers.get('Cookie');
		const sessionId = WebSessionManager.extractSessionId(cookieHeader);

		if (!sessionId) {
			throw new SessionError('No session cookie found');
		}

		const session = this.getSession(sessionId);
		if (!session) {
			throw new SessionError('Invalid or expired session');
		}

		return session;
	}
}
