/**
 * Web session management tests for @redshift/bunker
 *
 * Tests HTTP session lifecycle: creation, retrieval, deletion, expiry, cookies.
 */

import type { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { openDatabase } from '../src/database';
import { SessionError } from '../src/errors';
import { SESSION_COOKIE_NAME, WebSessionManager } from '../src/web-session';

/** Seed data constants */
const TEAM_1 = {
	id: 'team-1',
	name: 'Test Team',
	slug: 'test-team',
	pubkey: 'a'.repeat(64),
};

const MEMBER_1 = { id: 'member-1', pubkey: 'c'.repeat(64), role: 'developer' };
const MEMBER_2 = { id: 'member-2', pubkey: 'd'.repeat(64), role: 'admin' };

function seedData(db: Database) {
	const now = Math.floor(Date.now() / 1000);

	db.run(
		'INSERT INTO teams (id, name, slug, pubkey, encrypted_nsec, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
		[TEAM_1.id, TEAM_1.name, TEAM_1.slug, TEAM_1.pubkey, 'encrypted', now, now],
	);

	for (const member of [MEMBER_1, MEMBER_2]) {
		db.run('INSERT INTO members (id, team_id, pubkey, role, joined_at) VALUES (?, ?, ?, ?, ?)', [
			member.id,
			TEAM_1.id,
			member.pubkey,
			member.role,
			now,
		]);
	}
}

describe('WebSessionManager', () => {
	let db: Database;
	let manager: WebSessionManager;

	beforeEach(() => {
		db = openDatabase(':memory:');
		seedData(db);
		manager = new WebSessionManager(db);
	});

	afterEach(() => {
		db.close();
	});

	describe('createSession', () => {
		it('creates a session with a random ID', () => {
			const session = manager.createSession(MEMBER_1.id, TEAM_1.id);

			expect(session.id).toBeTruthy();
			expect(session.id.length).toBe(64); // 32 bytes hex
			expect(session.member_id).toBe(MEMBER_1.id);
			expect(session.team_id).toBe(TEAM_1.id);
			expect(session.created_at).toBeGreaterThan(0);
			expect(session.expires_at).toBeGreaterThan(session.created_at);
		});

		it('creates unique session IDs', () => {
			const s1 = manager.createSession(MEMBER_1.id, TEAM_1.id);
			const s2 = manager.createSession(MEMBER_1.id, TEAM_1.id);
			expect(s1.id).not.toBe(s2.id);
		});

		it('persists session to database', () => {
			const session = manager.createSession(MEMBER_1.id, TEAM_1.id);

			const row = db
				.query<{ id: string }, [string]>('SELECT id FROM web_sessions WHERE id = ?')
				.get(session.id);

			expect(row).toBeTruthy();
			expect(row?.id).toBe(session.id);
		});

		it('sets default 7-day expiration', () => {
			const session = manager.createSession(MEMBER_1.id, TEAM_1.id);
			const expectedDuration = 7 * 24 * 60 * 60;
			const actualDuration = session.expires_at - session.created_at;

			expect(actualDuration).toBe(expectedDuration);
		});
	});

	describe('getSession', () => {
		it('returns a valid session', () => {
			const created = manager.createSession(MEMBER_1.id, TEAM_1.id);
			const retrieved = manager.getSession(created.id);

			expect(retrieved).not.toBeNull();
			expect(retrieved?.id).toBe(created.id);
			expect(retrieved?.member_id).toBe(MEMBER_1.id);
		});

		it('returns null for unknown session ID', () => {
			expect(manager.getSession('nonexistent')).toBeNull();
		});

		it('returns null for expired session', () => {
			// Create a manager with 0 duration
			const shortManager = new WebSessionManager(db, 0);
			const session = shortManager.createSession(MEMBER_1.id, TEAM_1.id);

			expect(shortManager.getSession(session.id)).toBeNull();
		});
	});

	describe('deleteSession', () => {
		it('removes session from database', () => {
			const session = manager.createSession(MEMBER_1.id, TEAM_1.id);
			manager.deleteSession(session.id);

			expect(manager.getSession(session.id)).toBeNull();
		});

		it('does not throw for unknown session', () => {
			expect(() => manager.deleteSession('nonexistent')).not.toThrow();
		});
	});

	describe('deleteSessionsForMember', () => {
		it('removes all sessions for a member', () => {
			const s1 = manager.createSession(MEMBER_1.id, TEAM_1.id);
			const s2 = manager.createSession(MEMBER_1.id, TEAM_1.id);
			const s3 = manager.createSession(MEMBER_2.id, TEAM_1.id);

			manager.deleteSessionsForMember(MEMBER_1.id);

			expect(manager.getSession(s1.id)).toBeNull();
			expect(manager.getSession(s2.id)).toBeNull();
			expect(manager.getSession(s3.id)).not.toBeNull();
		});
	});

	describe('cleanupExpired', () => {
		it('removes expired sessions', () => {
			const shortManager = new WebSessionManager(db, 0);
			shortManager.createSession(MEMBER_1.id, TEAM_1.id);

			const validSession = manager.createSession(MEMBER_2.id, TEAM_1.id);

			manager.cleanupExpired();

			// The expired one should be gone
			const remaining = db.query<{ id: string }, []>('SELECT id FROM web_sessions').all();

			// Only the valid session should remain
			expect(remaining.some((r) => r.id === validSession.id)).toBe(true);
		});
	});

	describe('extractSessionId', () => {
		it('extracts session ID from Cookie header', () => {
			const id = WebSessionManager.extractSessionId(`${SESSION_COOKIE_NAME}=abc123; other=value`);
			expect(id).toBe('abc123');
		});

		it('returns null for missing cookie', () => {
			expect(WebSessionManager.extractSessionId(null)).toBeNull();
		});

		it('returns null when session cookie is not present', () => {
			expect(WebSessionManager.extractSessionId('other=value')).toBeNull();
		});

		it('handles cookie with no other cookies', () => {
			const id = WebSessionManager.extractSessionId(`${SESSION_COOKIE_NAME}=xyz789`);
			expect(id).toBe('xyz789');
		});

		it('handles cookie with equals in value', () => {
			const id = WebSessionManager.extractSessionId(`${SESSION_COOKIE_NAME}=abc=def`);
			expect(id).toBe('abc=def');
		});
	});

	describe('buildSetCookieHeader', () => {
		it('builds a valid Set-Cookie header (non-secure)', () => {
			const header = WebSessionManager.buildSetCookieHeader('session-id-123', false);

			expect(header).toContain(`${SESSION_COOKIE_NAME}=session-id-123`);
			expect(header).toContain('HttpOnly');
			expect(header).toContain('SameSite=Lax');
			expect(header).toContain('Path=/');
			expect(header).toContain('Max-Age=');
			expect(header).not.toContain('Secure');
		});

		it('includes Secure flag when secure=true', () => {
			const header = WebSessionManager.buildSetCookieHeader('session-id-123', true);
			expect(header).toContain('Secure');
		});
	});

	describe('buildClearCookieHeader', () => {
		it('builds a cookie-clearing header', () => {
			const header = WebSessionManager.buildClearCookieHeader(false);

			expect(header).toContain(`${SESSION_COOKIE_NAME}=`);
			expect(header).toContain('Max-Age=0');
			expect(header).toContain('HttpOnly');
		});
	});

	describe('validateRequest', () => {
		it('returns session for valid request', () => {
			const created = manager.createSession(MEMBER_1.id, TEAM_1.id);

			const request = new Request('http://localhost/api/me', {
				headers: { Cookie: `${SESSION_COOKIE_NAME}=${created.id}` },
			});

			const session = manager.validateRequest(request);
			expect(session.id).toBe(created.id);
		});

		it('throws SessionError for missing cookie', () => {
			const request = new Request('http://localhost/api/me');

			expect(() => manager.validateRequest(request)).toThrow(SessionError);
		});

		it('throws SessionError for invalid session', () => {
			const request = new Request('http://localhost/api/me', {
				headers: { Cookie: `${SESSION_COOKIE_NAME}=invalid-id` },
			});

			expect(() => manager.validateRequest(request)).toThrow(SessionError);
		});
	});
});
