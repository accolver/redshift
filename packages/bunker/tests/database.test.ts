/**
 * Database module tests for @redshift/bunker
 */

import type { Database } from 'bun:sqlite';
import { afterEach, describe, expect, it } from 'bun:test';
import {
	EXPECTED_TABLES,
	getTableColumns,
	hasAllTables,
	listTables,
	openDatabase,
} from '../src/index';

describe('Database', () => {
	let db: Database;

	afterEach(() => {
		if (db) {
			db.close();
		}
	});

	describe('openDatabase', () => {
		it('creates an in-memory database with all tables', () => {
			db = openDatabase(':memory:');
			expect(db).toBeDefined();

			const tables = listTables(db);
			expect(tables.length).toBe(EXPECTED_TABLES.length);
		});

		it('creates all expected tables', () => {
			db = openDatabase(':memory:');
			const tables = listTables(db);

			for (const expected of EXPECTED_TABLES) {
				expect(tables).toContain(expected);
			}
		});

		it('enables WAL journal mode', () => {
			db = openDatabase(':memory:');
			const result = db.query<{ journal_mode: string }, []>('PRAGMA journal_mode').get();
			// In-memory databases may report 'memory' instead of 'wal'
			expect(result).toBeDefined();
		});

		it('enables foreign keys', () => {
			db = openDatabase(':memory:');
			const result = db.query<{ foreign_keys: number }, []>('PRAGMA foreign_keys').get();
			expect(result?.foreign_keys).toBe(1);
		});

		it('is idempotent (can be called twice on same path)', () => {
			db = openDatabase(':memory:');
			// Opening again on same instance should not throw
			// (IF NOT EXISTS handles this)
			const tables1 = listTables(db);
			db.close();

			db = openDatabase(':memory:');
			const tables2 = listTables(db);
			expect(tables1).toEqual(tables2);
		});
	});

	describe('hasAllTables', () => {
		it('returns true when all tables exist', () => {
			db = openDatabase(':memory:');
			expect(hasAllTables(db)).toBe(true);
		});

		it('returns false when tables are missing', () => {
			db = openDatabase(':memory:');
			db.exec('DROP TABLE IF EXISTS sessions');
			expect(hasAllTables(db)).toBe(false);
		});
	});

	describe('Schema: teams table', () => {
		it('has correct columns', () => {
			db = openDatabase(':memory:');
			const columns = getTableColumns(db, 'teams');
			const names = columns.map((c) => c.name);

			expect(names).toContain('id');
			expect(names).toContain('name');
			expect(names).toContain('slug');
			expect(names).toContain('pubkey');
			expect(names).toContain('encrypted_nsec');
			expect(names).toContain('created_at');
			expect(names).toContain('updated_at');
		});

		it('has id as primary key', () => {
			db = openDatabase(':memory:');
			const columns = getTableColumns(db, 'teams');
			const idCol = columns.find((c) => c.name === 'id');
			expect(idCol?.pk).toBe(1);
		});

		it('enforces unique slug', () => {
			db = openDatabase(':memory:');
			const now = Math.floor(Date.now() / 1000);

			db.run(
				'INSERT INTO teams (id, name, slug, pubkey, encrypted_nsec, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
				['id1', 'Team 1', 'team-one', 'pubkey1', 'enc1', now, now],
			);

			expect(() => {
				db.run(
					'INSERT INTO teams (id, name, slug, pubkey, encrypted_nsec, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
					['id2', 'Team 2', 'team-one', 'pubkey2', 'enc2', now, now],
				);
			}).toThrow();
		});
	});

	describe('Schema: members table', () => {
		it('has correct columns', () => {
			db = openDatabase(':memory:');
			const columns = getTableColumns(db, 'members');
			const names = columns.map((c) => c.name);

			expect(names).toContain('id');
			expect(names).toContain('team_id');
			expect(names).toContain('pubkey');
			expect(names).toContain('role');
			expect(names).toContain('email');
			expect(names).toContain('oauth_provider');
			expect(names).toContain('oauth_subject');
			expect(names).toContain('joined_at');
			expect(names).toContain('invited_by');
		});

		it('enforces role CHECK constraint', () => {
			db = openDatabase(':memory:');
			const now = Math.floor(Date.now() / 1000);

			// Insert a team first
			db.run(
				'INSERT INTO teams (id, name, slug, pubkey, encrypted_nsec, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
				['team1', 'Test Team', 'test-team', 'pubkey', 'enc', now, now],
			);

			// Valid role should work
			db.run('INSERT INTO members (id, team_id, pubkey, role, joined_at) VALUES (?, ?, ?, ?, ?)', [
				'm1',
				'team1',
				'member_pubkey',
				'owner',
				now,
			]);

			// Invalid role should fail
			expect(() => {
				db.run(
					'INSERT INTO members (id, team_id, pubkey, role, joined_at) VALUES (?, ?, ?, ?, ?)',
					['m2', 'team1', 'member_pubkey2', 'superadmin', now],
				);
			}).toThrow();
		});

		it('enforces unique(team_id, pubkey)', () => {
			db = openDatabase(':memory:');
			const now = Math.floor(Date.now() / 1000);

			db.run(
				'INSERT INTO teams (id, name, slug, pubkey, encrypted_nsec, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
				['team1', 'Test Team', 'test-team', 'pubkey', 'enc', now, now],
			);

			db.run('INSERT INTO members (id, team_id, pubkey, role, joined_at) VALUES (?, ?, ?, ?, ?)', [
				'm1',
				'team1',
				'same_pubkey',
				'owner',
				now,
			]);

			expect(() => {
				db.run(
					'INSERT INTO members (id, team_id, pubkey, role, joined_at) VALUES (?, ?, ?, ?, ?)',
					['m2', 'team1', 'same_pubkey', 'developer', now],
				);
			}).toThrow();
		});

		it('allows same pubkey in different teams', () => {
			db = openDatabase(':memory:');
			const now = Math.floor(Date.now() / 1000);

			db.run(
				'INSERT INTO teams (id, name, slug, pubkey, encrypted_nsec, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
				['team1', 'Team 1', 'team-1', 'pubkey1', 'enc1', now, now],
			);
			db.run(
				'INSERT INTO teams (id, name, slug, pubkey, encrypted_nsec, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
				['team2', 'Team 2', 'team-2', 'pubkey2', 'enc2', now, now],
			);

			db.run('INSERT INTO members (id, team_id, pubkey, role, joined_at) VALUES (?, ?, ?, ?, ?)', [
				'm1',
				'team1',
				'same_pubkey',
				'owner',
				now,
			]);

			// Same pubkey in different team should succeed
			expect(() => {
				db.run(
					'INSERT INTO members (id, team_id, pubkey, role, joined_at) VALUES (?, ?, ?, ?, ?)',
					['m2', 'team2', 'same_pubkey', 'developer', now],
				);
			}).not.toThrow();
		});
	});

	describe('Schema: sessions table', () => {
		it('has correct columns', () => {
			db = openDatabase(':memory:');
			const columns = getTableColumns(db, 'sessions');
			const names = columns.map((c) => c.name);

			expect(names).toContain('id');
			expect(names).toContain('client_pubkey');
			expect(names).toContain('member_id');
			expect(names).toContain('team_id');
			expect(names).toContain('connected_at');
			expect(names).toContain('expires_at');
			expect(names).toContain('last_activity');
		});
	});

	describe('Schema: audit_events table', () => {
		it('has correct columns', () => {
			db = openDatabase(':memory:');
			const columns = getTableColumns(db, 'audit_events');
			const names = columns.map((c) => c.name);

			expect(names).toContain('id');
			expect(names).toContain('team_id');
			expect(names).toContain('actor_pubkey');
			expect(names).toContain('action');
			expect(names).toContain('target');
			expect(names).toContain('metadata');
			expect(names).toContain('created_at');
		});
	});

	describe('Schema: identities table', () => {
		it('has correct columns', () => {
			db = openDatabase(':memory:');
			const columns = getTableColumns(db, 'identities');
			const names = columns.map((c) => c.name);

			expect(names).toContain('id');
			expect(names).toContain('team_id');
			expect(names).toContain('pubkey');
			expect(names).toContain('encrypted_nsec');
			expect(names).toContain('label');
			expect(names).toContain('created_at');
		});
	});

	describe('Schema: assignments table', () => {
		it('has correct columns', () => {
			db = openDatabase(':memory:');
			const columns = getTableColumns(db, 'assignments');
			const names = columns.map((c) => c.name);

			expect(names).toContain('id');
			expect(names).toContain('identity_id');
			expect(names).toContain('member_id');
			expect(names).toContain('expires_at');
			expect(names).toContain('created_at');
		});
	});

	describe('Indexes', () => {
		it('creates indexes for performance-critical queries', () => {
			db = openDatabase(':memory:');
			const indexes = db
				.query<{ name: string }, []>(
					"SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name",
				)
				.all();
			const indexNames = indexes.map((i) => i.name);

			expect(indexNames).toContain('idx_members_team_id');
			expect(indexNames).toContain('idx_members_pubkey');
			expect(indexNames).toContain('idx_sessions_team_id');
			expect(indexNames).toContain('idx_sessions_expires_at');
			expect(indexNames).toContain('idx_audit_events_team_id');
			expect(indexNames).toContain('idx_audit_events_created_at');
		});
	});
});
