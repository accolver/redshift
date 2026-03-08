/**
 * SessionManager tests for @redshift/bunker
 */

import type { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { openDatabase } from '../src/database';
import { SessionManager } from '../src/session-manager';

/** Seed data constants */
const TEAM_1 = {
	id: 'team-1',
	pubkey: 'a'.repeat(64),
	name: 'Test Team',
	slug: 'test-team',
};

const TEAM_2 = {
	id: 'team-2',
	pubkey: 'b'.repeat(64),
	name: 'Team 2',
	slug: 'team-2',
};

const MEMBER_1 = { id: 'member-1', pubkey: 'c'.repeat(64), role: 'developer' };
const MEMBER_2 = { id: 'member-2', pubkey: 'd'.repeat(64), role: 'admin' };
const MEMBER_3 = { id: 'member-3', pubkey: 'e'.repeat(64), role: 'owner' };

/** Seed teams and members into the database */
function seedData(db: Database) {
	const now = Math.floor(Date.now() / 1000);

	// Insert teams
	for (const team of [TEAM_1, TEAM_2]) {
		db.run(
			'INSERT INTO teams (id, name, slug, pubkey, encrypted_nsec, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
			[team.id, team.name, team.slug, team.pubkey, 'encrypted', now, now],
		);
	}

	// Insert members (all in team-1 by default)
	for (const member of [MEMBER_1, MEMBER_2, MEMBER_3]) {
		db.run('INSERT INTO members (id, team_id, pubkey, role, joined_at) VALUES (?, ?, ?, ?, ?)', [
			member.id,
			TEAM_1.id,
			member.pubkey,
			member.role,
			now,
		]);
	}
}

describe('SessionManager', () => {
	let db: Database;
	let manager: SessionManager;

	beforeEach(() => {
		db = openDatabase(':memory:');
		seedData(db);
		manager = new SessionManager(db);
	});

	afterEach(() => {
		manager.stop();
		db.close();
	});

	describe('createSession', () => {
		it('creates a new session', () => {
			const active = manager.createSession({
				clientPubkey: MEMBER_1.pubkey,
				memberId: MEMBER_1.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'developer',
				timeoutSeconds: 3600,
			});

			expect(active.session.client_pubkey).toBe(MEMBER_1.pubkey);
			expect(active.session.member_id).toBe(MEMBER_1.id);
			expect(active.session.team_id).toBe(TEAM_1.id);
			expect(active.role).toBe('developer');
			expect(active.teamPubkey).toBe(TEAM_1.pubkey);
			expect(active.session.id).toBeTruthy();
		});

		it('sets correct expiration', () => {
			const before = Math.floor(Date.now() / 1000);
			const active = manager.createSession({
				clientPubkey: MEMBER_1.pubkey,
				memberId: MEMBER_1.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'developer',
				timeoutSeconds: 7200,
			});
			const after = Math.floor(Date.now() / 1000);

			expect(active.session.expires_at).toBeGreaterThanOrEqual(before + 7200);
			expect(active.session.expires_at).toBeLessThanOrEqual(after + 7200);
		});

		it('replaces existing session for same client pubkey', () => {
			const first = manager.createSession({
				clientPubkey: MEMBER_1.pubkey,
				memberId: MEMBER_1.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'developer',
				timeoutSeconds: 3600,
			});

			const second = manager.createSession({
				clientPubkey: MEMBER_1.pubkey,
				memberId: MEMBER_2.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'admin',
				timeoutSeconds: 3600,
			});

			expect(first.session.id).not.toBe(second.session.id);
			expect(manager.getSession(MEMBER_1.pubkey)?.session.id).toBe(second.session.id);
			expect(manager.getSession(MEMBER_1.pubkey)?.role).toBe('admin');
		});

		it('persists session to database', () => {
			const active = manager.createSession({
				clientPubkey: MEMBER_1.pubkey,
				memberId: MEMBER_1.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'developer',
				timeoutSeconds: 3600,
			});

			const row = db
				.query<{ id: string }, [string]>('SELECT id FROM sessions WHERE id = ?')
				.get(active.session.id);

			expect(row).toBeTruthy();
			expect(row?.id).toBe(active.session.id);
		});
	});

	describe('getSession', () => {
		it('returns active session', () => {
			manager.createSession({
				clientPubkey: MEMBER_1.pubkey,
				memberId: MEMBER_1.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'developer',
				timeoutSeconds: 3600,
			});

			const session = manager.getSession(MEMBER_1.pubkey);
			expect(session).not.toBeNull();
			expect(session?.session.client_pubkey).toBe(MEMBER_1.pubkey);
		});

		it('returns null for unknown client', () => {
			expect(manager.getSession('unknown')).toBeNull();
		});

		it('returns null for expired session', () => {
			// Create session with 0 timeout (already expired)
			manager.createSession({
				clientPubkey: MEMBER_1.pubkey,
				memberId: MEMBER_1.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'developer',
				timeoutSeconds: 0,
			});

			expect(manager.getSession(MEMBER_1.pubkey)).toBeNull();
		});
	});

	describe('touchSession', () => {
		it('updates last_activity timestamp', () => {
			const active = manager.createSession({
				clientPubkey: MEMBER_1.pubkey,
				memberId: MEMBER_1.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'developer',
				timeoutSeconds: 3600,
			});

			const originalActivity = active.session.last_activity;

			manager.touchSession(MEMBER_1.pubkey);

			const updated = manager.getSession(MEMBER_1.pubkey);
			expect(updated).not.toBeNull();
			if (updated) {
				expect(updated.session.last_activity).toBeGreaterThanOrEqual(originalActivity);
			}
		});

		it('does nothing for unknown client', () => {
			// Should not throw
			manager.touchSession('unknown');
		});
	});

	describe('removeSession', () => {
		it('removes session from memory and database', () => {
			const active = manager.createSession({
				clientPubkey: MEMBER_1.pubkey,
				memberId: MEMBER_1.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'developer',
				timeoutSeconds: 3600,
			});

			manager.removeSession(MEMBER_1.pubkey);

			expect(manager.getSession(MEMBER_1.pubkey)).toBeNull();

			const row = db
				.query<{ id: string }, [string]>('SELECT id FROM sessions WHERE id = ?')
				.get(active.session.id);
			expect(row).toBeNull();
		});

		it('does nothing for unknown client', () => {
			// Should not throw
			manager.removeSession('unknown');
		});
	});

	describe('removeTeamSessions', () => {
		it('removes all sessions for a team', () => {
			manager.createSession({
				clientPubkey: MEMBER_1.pubkey,
				memberId: MEMBER_1.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'developer',
				timeoutSeconds: 3600,
			});

			manager.createSession({
				clientPubkey: MEMBER_2.pubkey,
				memberId: MEMBER_2.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'admin',
				timeoutSeconds: 3600,
			});

			// Need a member in team-2 for this test
			const now = Math.floor(Date.now() / 1000);
			db.run('INSERT INTO members (id, team_id, pubkey, role, joined_at) VALUES (?, ?, ?, ?, ?)', [
				'member-t2',
				TEAM_2.id,
				MEMBER_3.pubkey,
				'owner',
				now,
			]);

			manager.createSession({
				clientPubkey: MEMBER_3.pubkey,
				memberId: 'member-t2',
				teamId: TEAM_2.id,
				teamPubkey: TEAM_2.pubkey,
				role: 'owner',
				timeoutSeconds: 3600,
			});

			manager.removeTeamSessions(TEAM_1.id);

			expect(manager.getSession(MEMBER_1.pubkey)).toBeNull();
			expect(manager.getSession(MEMBER_2.pubkey)).toBeNull();
			expect(manager.getSession(MEMBER_3.pubkey)).not.toBeNull();
		});
	});

	describe('getActiveSessions', () => {
		it('returns all non-expired sessions', () => {
			manager.createSession({
				clientPubkey: MEMBER_1.pubkey,
				memberId: MEMBER_1.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'developer',
				timeoutSeconds: 3600,
			});

			manager.createSession({
				clientPubkey: MEMBER_2.pubkey,
				memberId: MEMBER_2.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'admin',
				timeoutSeconds: 3600,
			});

			const sessions = manager.getActiveSessions();
			expect(sessions.length).toBe(2);
		});

		it('excludes expired sessions', () => {
			manager.createSession({
				clientPubkey: MEMBER_1.pubkey,
				memberId: MEMBER_1.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'developer',
				timeoutSeconds: 3600,
			});

			// Create expired session
			manager.createSession({
				clientPubkey: MEMBER_2.pubkey,
				memberId: MEMBER_2.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'admin',
				timeoutSeconds: 0,
			});

			const sessions = manager.getActiveSessions();
			expect(sessions.length).toBe(1);
		});
	});

	describe('hasSession', () => {
		it('returns true for active session', () => {
			manager.createSession({
				clientPubkey: MEMBER_1.pubkey,
				memberId: MEMBER_1.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'developer',
				timeoutSeconds: 3600,
			});

			expect(manager.hasSession(MEMBER_1.pubkey)).toBe(true);
		});

		it('returns false for unknown client', () => {
			expect(manager.hasSession('unknown')).toBe(false);
		});
	});

	describe('cleanupExpired', () => {
		it('removes expired sessions from memory and database', () => {
			// Create expired session
			manager.createSession({
				clientPubkey: MEMBER_1.pubkey,
				memberId: MEMBER_1.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'developer',
				timeoutSeconds: 0,
			});

			// Create active session
			manager.createSession({
				clientPubkey: MEMBER_2.pubkey,
				memberId: MEMBER_2.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'admin',
				timeoutSeconds: 3600,
			});

			manager.cleanupExpired();

			expect(manager.getActiveSessionCount()).toBe(1);
		});
	});

	describe('session persistence and recovery', () => {
		it('restores sessions from database on start', () => {
			manager.createSession({
				clientPubkey: MEMBER_1.pubkey,
				memberId: MEMBER_1.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'developer',
				timeoutSeconds: 3600,
			});

			// Create a new manager (simulating restart)
			const newManager = new SessionManager(db);
			newManager.start(60_000_000); // Long interval to avoid cleanup during test

			const restored = newManager.getSession(MEMBER_1.pubkey);
			expect(restored).not.toBeNull();
			expect(restored?.session.client_pubkey).toBe(MEMBER_1.pubkey);
			expect(restored?.role).toBe('developer');
			expect(restored?.teamPubkey).toBe(TEAM_1.pubkey);

			newManager.stop();
		});

		it('does not restore expired sessions', () => {
			// Create an expired session
			manager.createSession({
				clientPubkey: MEMBER_1.pubkey,
				memberId: MEMBER_1.id,
				teamId: TEAM_1.id,
				teamPubkey: TEAM_1.pubkey,
				role: 'developer',
				timeoutSeconds: 0,
			});

			// Create a new manager
			const newManager = new SessionManager(db);
			newManager.start(60_000_000);

			expect(newManager.getSession(MEMBER_1.pubkey)).toBeNull();

			newManager.stop();
		});
	});
});
