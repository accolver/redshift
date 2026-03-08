/**
 * Session management for @redshift/bunker NIP-46 server
 *
 * Manages active NIP-46 sessions in-memory with SQLite persistence
 * for restart recovery. Handles session creation, validation,
 * activity tracking, timeout, and invalidation.
 */

import type { Database } from 'bun:sqlite';
import type { MemberRole, Session } from './types.js';

/** In-memory session with role for fast RBAC checks */
export interface ActiveSession {
	readonly session: Session;
	readonly role: MemberRole;
	readonly teamPubkey: string;
}

/** Options for creating a new session */
export interface CreateSessionOptions {
	readonly clientPubkey: string;
	readonly memberId: string;
	readonly teamId: string;
	readonly teamPubkey: string;
	readonly role: MemberRole;
	readonly timeoutSeconds: number;
}

/**
 * SessionManager handles the lifecycle of NIP-46 sessions.
 *
 * Sessions are stored both in-memory (for fast lookup) and in SQLite
 * (for persistence across restarts). The in-memory map is the primary
 * source of truth during runtime; SQLite is used for recovery.
 */
export class SessionManager {
	/** In-memory sessions indexed by client pubkey */
	private readonly sessions = new Map<string, ActiveSession>();

	/** SQLite database for persistence */
	private readonly db: Database;

	/** Interval handle for cleanup timer */
	private cleanupInterval: ReturnType<typeof setInterval> | null = null;

	constructor(db: Database) {
		this.db = db;
	}

	/**
	 * Start the session manager and restore sessions from database.
	 * Also starts a periodic cleanup timer for expired sessions.
	 *
	 * @param cleanupIntervalMs - How often to run cleanup (default: 60s)
	 */
	start(cleanupIntervalMs = 60_000) {
		this.restoreFromDatabase();
		this.cleanupInterval = setInterval(() => {
			this.cleanupExpired();
		}, cleanupIntervalMs);
	}

	/**
	 * Stop the session manager and clear the cleanup timer.
	 */
	stop() {
		if (this.cleanupInterval !== null) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
	}

	/**
	 * Create a new session for a client.
	 * Replaces any existing session for the same client pubkey.
	 *
	 * @returns The created session
	 */
	createSession(options: CreateSessionOptions) {
		const now = Math.floor(Date.now() / 1000);
		const id = crypto.randomUUID();

		const session: Session = {
			id,
			client_pubkey: options.clientPubkey,
			member_id: options.memberId,
			team_id: options.teamId,
			connected_at: now,
			expires_at: now + options.timeoutSeconds,
			last_activity: now,
		};

		const activeSession: ActiveSession = {
			session,
			role: options.role,
			teamPubkey: options.teamPubkey,
		};

		// Remove existing session for this client if any
		this.removeSession(options.clientPubkey);

		// Store in memory
		this.sessions.set(options.clientPubkey, activeSession);

		// Persist to database
		this.persistSession(activeSession);

		return activeSession;
	}

	/**
	 * Get an active session by client pubkey.
	 * Returns null if no session exists or if the session has expired.
	 */
	getSession(clientPubkey: string) {
		const active = this.sessions.get(clientPubkey);
		if (!active) {
			return null;
		}

		const now = Math.floor(Date.now() / 1000);
		if (now >= active.session.expires_at) {
			// Session expired — clean it up
			this.removeSession(clientPubkey);
			return null;
		}

		return active;
	}

	/**
	 * Update the last_activity timestamp for a session.
	 * Called on every successful request to keep the session alive.
	 */
	touchSession(clientPubkey: string) {
		const active = this.sessions.get(clientPubkey);
		if (!active) {
			return;
		}

		const now = Math.floor(Date.now() / 1000);

		// Create updated session with new last_activity
		const updated: ActiveSession = {
			...active,
			session: {
				...active.session,
				last_activity: now,
			},
		};

		this.sessions.set(clientPubkey, updated);

		// Update in database
		this.db.query('UPDATE sessions SET last_activity = ? WHERE id = ?').run(now, active.session.id);
	}

	/**
	 * Remove a session by client pubkey.
	 */
	removeSession(clientPubkey: string) {
		const active = this.sessions.get(clientPubkey);
		if (active) {
			this.sessions.delete(clientPubkey);
			this.db.query('DELETE FROM sessions WHERE id = ?').run(active.session.id);
		}
	}

	/**
	 * Remove all sessions for a specific team.
	 * Used when a team is deleted or its key is rotated.
	 */
	removeTeamSessions(teamId: string) {
		for (const [pubkey, active] of this.sessions) {
			if (active.session.team_id === teamId) {
				this.sessions.delete(pubkey);
			}
		}
		this.db.query('DELETE FROM sessions WHERE team_id = ?').run(teamId);
	}

	/**
	 * Remove all sessions for a specific member.
	 * Used when a member is removed from a team.
	 */
	removeMemberSessions(memberId: string) {
		for (const [pubkey, active] of this.sessions) {
			if (active.session.member_id === memberId) {
				this.sessions.delete(pubkey);
			}
		}
		this.db.query('DELETE FROM sessions WHERE member_id = ?').run(memberId);
	}

	/**
	 * Get all active (non-expired) sessions.
	 */
	getActiveSessions() {
		const now = Math.floor(Date.now() / 1000);
		const result: ActiveSession[] = [];

		for (const [_pubkey, active] of this.sessions) {
			if (now < active.session.expires_at) {
				result.push(active);
			}
		}

		return result;
	}

	/**
	 * Get the count of active sessions.
	 */
	getActiveSessionCount() {
		return this.getActiveSessions().length;
	}

	/**
	 * Check if a client has an active session.
	 */
	hasSession(clientPubkey: string) {
		return this.getSession(clientPubkey) !== null;
	}

	/**
	 * Clean up expired sessions from memory and database.
	 */
	cleanupExpired() {
		const now = Math.floor(Date.now() / 1000);
		const expired: string[] = [];

		for (const [pubkey, active] of this.sessions) {
			if (now >= active.session.expires_at) {
				expired.push(pubkey);
			}
		}

		for (const pubkey of expired) {
			this.sessions.delete(pubkey);
		}

		// Also clean database
		this.db.query('DELETE FROM sessions WHERE expires_at <= ?').run(now);
	}

	/**
	 * Restore sessions from the database after a restart.
	 * Only restores sessions that haven't expired.
	 * Requires member data to reconstruct role and team pubkey.
	 */
	private restoreFromDatabase() {
		const now = Math.floor(Date.now() / 1000);

		// Clean expired sessions first
		this.db.query('DELETE FROM sessions WHERE expires_at <= ?').run(now);

		// Load remaining sessions with member role and team pubkey
		const rows = this.db
			.query<
				{
					id: string;
					client_pubkey: string;
					member_id: string;
					team_id: string;
					connected_at: number;
					expires_at: number;
					last_activity: number;
					role: string;
					team_pubkey: string;
				},
				[]
			>(
				`SELECT s.*, m.role, t.pubkey as team_pubkey
			 FROM sessions s
			 JOIN members m ON s.member_id = m.id
			 JOIN teams t ON s.team_id = t.id
			 WHERE s.expires_at > ?`,
			)
			.all(now);

		for (const row of rows) {
			const session: Session = {
				id: row.id,
				client_pubkey: row.client_pubkey,
				member_id: row.member_id,
				team_id: row.team_id,
				connected_at: row.connected_at,
				expires_at: row.expires_at,
				last_activity: row.last_activity,
			};

			this.sessions.set(row.client_pubkey, {
				session,
				role: row.role as MemberRole,
				teamPubkey: row.team_pubkey,
			});
		}
	}

	/**
	 * Persist a session to the database.
	 */
	private persistSession(active: ActiveSession) {
		const s = active.session;
		this.db
			.query(
				`INSERT OR REPLACE INTO sessions (id, client_pubkey, member_id, team_id, connected_at, expires_at, last_activity)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				s.id,
				s.client_pubkey,
				s.member_id,
				s.team_id,
				s.connected_at,
				s.expires_at,
				s.last_activity,
			);
	}
}
