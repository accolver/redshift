/**
 * SQLite database module for @redshift/bunker
 *
 * Uses bun:sqlite for embedded database operations.
 * Manages schema creation and provides the database instance.
 */

import { Database } from 'bun:sqlite';
import { DatabaseError } from './errors.js';

/** SQL statements to create the bunker schema */
const SCHEMA_SQL = `
-- Teams
CREATE TABLE IF NOT EXISTS teams (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	slug TEXT NOT NULL UNIQUE,
	pubkey TEXT NOT NULL,
	encrypted_nsec TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

-- Members
CREATE TABLE IF NOT EXISTS members (
	id TEXT PRIMARY KEY,
	team_id TEXT NOT NULL REFERENCES teams(id),
	pubkey TEXT NOT NULL,
	role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'developer', 'readonly')),
	email TEXT,
	oauth_provider TEXT,
	oauth_subject TEXT,
	joined_at INTEGER NOT NULL,
	invited_by TEXT,
	UNIQUE(team_id, pubkey)
);

-- Identities (derived Nostr keys for OAuth users)
CREATE TABLE IF NOT EXISTS identities (
	id TEXT PRIMARY KEY,
	team_id TEXT NOT NULL REFERENCES teams(id),
	pubkey TEXT NOT NULL,
	encrypted_nsec TEXT NOT NULL,
	label TEXT,
	created_at INTEGER NOT NULL
);

-- Assignments (maps members to identities)
CREATE TABLE IF NOT EXISTS assignments (
	id TEXT PRIMARY KEY,
	identity_id TEXT NOT NULL REFERENCES identities(id),
	member_id TEXT NOT NULL REFERENCES members(id),
	expires_at INTEGER,
	created_at INTEGER NOT NULL
);

-- Sessions (active NIP-46 connections)
CREATE TABLE IF NOT EXISTS sessions (
	id TEXT PRIMARY KEY,
	client_pubkey TEXT NOT NULL,
	member_id TEXT NOT NULL REFERENCES members(id),
	team_id TEXT NOT NULL REFERENCES teams(id),
	connected_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL,
	last_activity INTEGER NOT NULL
);

-- Audit Events
CREATE TABLE IF NOT EXISTS audit_events (
	id TEXT PRIMARY KEY,
	team_id TEXT NOT NULL REFERENCES teams(id),
	actor_pubkey TEXT NOT NULL,
	action TEXT NOT NULL,
	target TEXT,
	metadata TEXT,
	created_at INTEGER NOT NULL
);

-- Web Sessions (OAuth HTTP sessions, distinct from NIP-46 sessions)
CREATE TABLE IF NOT EXISTS web_sessions (
	id TEXT PRIMARY KEY,
	member_id TEXT NOT NULL REFERENCES members(id),
	team_id TEXT NOT NULL REFERENCES teams(id),
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL
);
`;

/** Index creation statements for query performance */
const INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_members_team_id ON members(team_id);
CREATE INDEX IF NOT EXISTS idx_members_pubkey ON members(pubkey);
CREATE INDEX IF NOT EXISTS idx_identities_team_id ON identities(team_id);
CREATE INDEX IF NOT EXISTS idx_identities_pubkey ON identities(pubkey);
CREATE INDEX IF NOT EXISTS idx_assignments_identity_id ON assignments(identity_id);
CREATE INDEX IF NOT EXISTS idx_assignments_member_id ON assignments(member_id);
CREATE INDEX IF NOT EXISTS idx_sessions_team_id ON sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_sessions_member_id ON sessions(member_id);
CREATE INDEX IF NOT EXISTS idx_sessions_client_pubkey ON sessions(client_pubkey);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_team_id ON audit_events(team_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_pubkey ON audit_events(actor_pubkey);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_web_sessions_member_id ON web_sessions(member_id);
CREATE INDEX IF NOT EXISTS idx_web_sessions_expires_at ON web_sessions(expires_at);
`;

/** Expected table names in the bunker schema */
export const EXPECTED_TABLES = [
	'teams',
	'members',
	'identities',
	'assignments',
	'sessions',
	'audit_events',
	'web_sessions',
] as const;

/**
 * Open (or create) the bunker SQLite database and initialize the schema.
 *
 * @param path - File path for the database, or ':memory:' for in-memory
 * @returns The initialized Database instance
 * @throws {DatabaseError} if schema creation fails
 */
export function openDatabase(path: string) {
	try {
		const db = new Database(path);

		// Enable WAL mode for better concurrent read performance
		db.exec('PRAGMA journal_mode = WAL');
		// Enable foreign key enforcement
		db.exec('PRAGMA foreign_keys = ON');

		// Create tables
		db.exec(SCHEMA_SQL);
		// Create indexes
		db.exec(INDEXES_SQL);

		return db;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new DatabaseError(`Failed to initialize database: ${message}`);
	}
}

/**
 * List all user-created tables in the database.
 * Useful for verifying schema was created correctly.
 */
export function listTables(db: Database) {
	const rows = db
		.query<{ name: string }, []>(
			"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
		)
		.all();
	return rows.map((row) => row.name);
}

/**
 * Check whether the database has all expected bunker tables.
 */
export function hasAllTables(db: Database) {
	const tables = new Set(listTables(db));
	return EXPECTED_TABLES.every((t) => tables.has(t));
}

/**
 * Get column info for a specific table.
 */
export function getTableColumns(db: Database, tableName: string) {
	const rows = db
		.query<{ name: string; type: string; notnull: number; pk: number }, [string]>(
			'SELECT name, type, "notnull", pk FROM pragma_table_info(?)',
		)
		.all(tableName);
	return rows;
}
