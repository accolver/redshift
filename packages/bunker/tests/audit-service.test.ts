/**
 * AuditService tests for @redshift/bunker
 *
 * Tests audit event querying, filtering, pagination, pruning,
 * and summary operations.
 */

import type { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { AuditService } from '../src/audit-service';
import { openDatabase } from '../src/database';
import { generateMasterKey } from '../src/encryption';
import { ValidationError } from '../src/errors';
import { TeamService } from '../src/team-service';

// ─── Test Helpers ───────────────────────────────────────────────────────────

/** Generate a random hex pubkey */
function randomPubkey() {
	return getPublicKey(generateSecretKey());
}

/** Insert an audit event directly into the database */
function insertAuditEvent(
	db: Database,
	teamId: string,
	actorPubkey: string,
	action: string,
	target: string | null = null,
	metadata: string | null = null,
	createdAt?: number,
) {
	const id = crypto.randomUUID();
	const timestamp = createdAt ?? Math.floor(Date.now() / 1000);

	db.query(
		'INSERT INTO audit_events (id, team_id, actor_pubkey, action, target, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
	).run(id, teamId, actorPubkey, action, target, metadata, timestamp);

	return id;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AuditService', () => {
	let db: Database;
	let masterKey: string;
	let teamService: TeamService;
	let auditService: AuditService;
	let teamId: string;
	let ownerPubkey: string;

	beforeEach(() => {
		db = openDatabase(':memory:');
		masterKey = generateMasterKey();
		teamService = new TeamService(db, masterKey);
		auditService = new AuditService(db);

		ownerPubkey = randomPubkey();
		const team = teamService.createTeam('Test Team', 'test-team', ownerPubkey);
		teamId = team.id;
	});

	afterEach(() => {
		db.close();
	});

	// ─── queryEvents ────────────────────────────────────────────────────

	describe('queryEvents', () => {
		it('returns events for a team', () => {
			// team_created is already logged by TeamService
			const result = auditService.queryEvents({ teamId });

			expect(result.events.length).toBe(1);
			expect(result.total).toBe(1);
			expect(result.hasMore).toBe(false);
			expect(result.events[0]?.action).toBe('team_created');
		});

		it('returns empty result for team with no events', () => {
			const otherTeamId = 'nonexistent-team-id';
			const result = auditService.queryEvents({ teamId: otherTeamId });

			expect(result.events.length).toBe(0);
			expect(result.total).toBe(0);
			expect(result.hasMore).toBe(false);
		});

		it('filters by actorPubkey', () => {
			const otherPubkey = randomPubkey();
			insertAuditEvent(db, teamId, otherPubkey, 'member_invited');

			const result = auditService.queryEvents({
				teamId,
				actorPubkey: otherPubkey,
			});

			expect(result.events.length).toBe(1);
			expect(result.events[0]?.actor_pubkey).toBe(otherPubkey);
		});

		it('filters by action', () => {
			insertAuditEvent(db, teamId, ownerPubkey, 'member_invited');
			insertAuditEvent(db, teamId, ownerPubkey, 'member_removed');

			const result = auditService.queryEvents({
				teamId,
				action: 'member_invited',
			});

			expect(result.events.length).toBe(1);
			expect(result.events[0]?.action).toBe('member_invited');
		});

		it('filters by since timestamp', () => {
			const now = Math.floor(Date.now() / 1000);
			insertAuditEvent(db, teamId, ownerPubkey, 'old_event', null, null, now - 1000);
			insertAuditEvent(db, teamId, ownerPubkey, 'new_event', null, null, now + 10);

			const result = auditService.queryEvents({
				teamId,
				since: now,
			});

			// Should include team_created (at ~now) and new_event (at now+10)
			// but not old_event (at now-1000)
			const actions = result.events.map((e) => e.action);
			expect(actions).toContain('new_event');
			expect(actions).not.toContain('old_event');
		});

		it('filters by until timestamp', () => {
			const now = Math.floor(Date.now() / 1000);
			insertAuditEvent(db, teamId, ownerPubkey, 'old_event', null, null, now - 1000);
			insertAuditEvent(db, teamId, ownerPubkey, 'future_event', null, null, now + 1000);

			const result = auditService.queryEvents({
				teamId,
				until: now - 500,
			});

			const actions = result.events.map((e) => e.action);
			expect(actions).toContain('old_event');
			expect(actions).not.toContain('future_event');
		});

		it('combines multiple filters', () => {
			const now = Math.floor(Date.now() / 1000);
			const actor1 = randomPubkey();
			const actor2 = randomPubkey();

			insertAuditEvent(db, teamId, actor1, 'member_invited', null, null, now + 10);
			insertAuditEvent(db, teamId, actor2, 'member_invited', null, null, now + 20);
			insertAuditEvent(db, teamId, actor1, 'member_removed', null, null, now + 30);

			const result = auditService.queryEvents({
				teamId,
				actorPubkey: actor1,
				action: 'member_invited',
				since: now,
			});

			expect(result.events.length).toBe(1);
			expect(result.events[0]?.actor_pubkey).toBe(actor1);
			expect(result.events[0]?.action).toBe('member_invited');
		});

		it('paginates with limit and offset', () => {
			// Insert 5 more events (1 already exists from team creation)
			for (let i = 0; i < 5; i++) {
				insertAuditEvent(
					db,
					teamId,
					ownerPubkey,
					`action_${i}`,
					null,
					null,
					Math.floor(Date.now() / 1000) + i + 1,
				);
			}

			const page1 = auditService.queryEvents({ teamId, limit: 2, offset: 0 });
			expect(page1.events.length).toBe(2);
			expect(page1.total).toBe(6);
			expect(page1.hasMore).toBe(true);

			const page2 = auditService.queryEvents({ teamId, limit: 2, offset: 2 });
			expect(page2.events.length).toBe(2);
			expect(page2.total).toBe(6);
			expect(page2.hasMore).toBe(true);

			const page3 = auditService.queryEvents({ teamId, limit: 2, offset: 4 });
			expect(page3.events.length).toBe(2);
			expect(page3.total).toBe(6);
			expect(page3.hasMore).toBe(false);
		});

		it('returns events ordered by created_at descending', () => {
			const now = Math.floor(Date.now() / 1000);
			insertAuditEvent(db, teamId, ownerPubkey, 'first', null, null, now + 100);
			insertAuditEvent(db, teamId, ownerPubkey, 'second', null, null, now + 200);
			insertAuditEvent(db, teamId, ownerPubkey, 'third', null, null, now + 300);

			const result = auditService.queryEvents({ teamId });

			expect(result.events[0]?.action).toBe('third');
			expect(result.events[1]?.action).toBe('second');
			expect(result.events[2]?.action).toBe('first');
		});

		it('uses default limit of 50', () => {
			// Insert 60 events
			for (let i = 0; i < 60; i++) {
				insertAuditEvent(
					db,
					teamId,
					ownerPubkey,
					`action_${i}`,
					null,
					null,
					Math.floor(Date.now() / 1000) + i + 1,
				);
			}

			const result = auditService.queryEvents({ teamId });
			expect(result.events.length).toBe(50);
			expect(result.total).toBe(61); // 60 + 1 from team creation
			expect(result.hasMore).toBe(true);
		});

		it('throws ValidationError when limit exceeds 500', () => {
			expect(() => auditService.queryEvents({ teamId, limit: 501 })).toThrow(ValidationError);
		});

		it('throws ValidationError when limit is less than 1', () => {
			expect(() => auditService.queryEvents({ teamId, limit: 0 })).toThrow(ValidationError);
		});

		it('throws ValidationError when offset is negative', () => {
			expect(() => auditService.queryEvents({ teamId, offset: -1 })).toThrow(ValidationError);
		});

		it('caps limit at 500', () => {
			const result = auditService.queryEvents({ teamId, limit: 500 });
			expect(result.events.length).toBeLessThanOrEqual(500);
		});

		it('hasMore is false when all events fit in one page', () => {
			const result = auditService.queryEvents({ teamId, limit: 100 });
			expect(result.hasMore).toBe(false);
		});
	});

	// ─── getEvent ───────────────────────────────────────────────────────

	describe('getEvent', () => {
		it('returns an event by ID', () => {
			const eventId = insertAuditEvent(db, teamId, ownerPubkey, 'test_action', 'target-1');

			const event = auditService.getEvent(eventId);

			expect(event).not.toBeNull();
			expect(event?.id).toBe(eventId);
			expect(event?.action).toBe('test_action');
			expect(event?.target).toBe('target-1');
			expect(event?.team_id).toBe(teamId);
		});

		it('returns null for non-existent event', () => {
			const event = auditService.getEvent('nonexistent-id');
			expect(event).toBeNull();
		});

		it('returns event with metadata', () => {
			const metadata = JSON.stringify({ from: 'developer', to: 'admin' });
			const eventId = insertAuditEvent(
				db,
				teamId,
				ownerPubkey,
				'role_changed',
				'target-pubkey',
				metadata,
			);

			const event = auditService.getEvent(eventId);

			expect(event).not.toBeNull();
			expect(event?.metadata).toBe(metadata);
		});
	});

	// ─── pruneOldEvents ─────────────────────────────────────────────────

	describe('pruneOldEvents', () => {
		it('deletes events older than retention period', () => {
			const now = Math.floor(Date.now() / 1000);
			const ninetyOneDaysAgo = now - 91 * 24 * 60 * 60;

			insertAuditEvent(db, teamId, ownerPubkey, 'old_event', null, null, ninetyOneDaysAgo);

			const deleted = auditService.pruneOldEvents();

			expect(deleted).toBe(1);
		});

		it('keeps events within retention period', () => {
			const now = Math.floor(Date.now() / 1000);
			const recentEvent = insertAuditEvent(
				db,
				teamId,
				ownerPubkey,
				'recent_event',
				null,
				null,
				now - 10,
			);

			const deleted = auditService.pruneOldEvents();

			expect(deleted).toBe(0);
			expect(auditService.getEvent(recentEvent)).not.toBeNull();
		});

		it('uses custom retention days', () => {
			const now = Math.floor(Date.now() / 1000);
			const threeDaysAgo = now - 3 * 24 * 60 * 60;

			insertAuditEvent(db, teamId, ownerPubkey, 'old_event', null, null, threeDaysAgo);

			// With 2-day retention, the 3-day-old event should be deleted
			const deleted = auditService.pruneOldEvents(2);
			expect(deleted).toBe(1);
		});

		it('returns count of deleted events', () => {
			const now = Math.floor(Date.now() / 1000);
			const oldTimestamp = now - 100 * 24 * 60 * 60;

			insertAuditEvent(db, teamId, ownerPubkey, 'old_1', null, null, oldTimestamp);
			insertAuditEvent(db, teamId, ownerPubkey, 'old_2', null, null, oldTimestamp);
			insertAuditEvent(db, teamId, ownerPubkey, 'old_3', null, null, oldTimestamp);

			const deleted = auditService.pruneOldEvents();
			expect(deleted).toBe(3);
		});

		it('returns 0 when no events to prune', () => {
			const deleted = auditService.pruneOldEvents();
			expect(deleted).toBe(0);
		});

		it('throws ValidationError for retention days less than 1', () => {
			expect(() => auditService.pruneOldEvents(0)).toThrow(ValidationError);
			expect(() => auditService.pruneOldEvents(-1)).toThrow(ValidationError);
		});

		it('prunes across all teams', () => {
			const now = Math.floor(Date.now() / 1000);
			const oldTimestamp = now - 100 * 24 * 60 * 60;

			// Create another team
			const otherOwner = randomPubkey();
			const otherTeam = teamService.createTeam('Other Team', 'other-team', otherOwner);

			insertAuditEvent(db, teamId, ownerPubkey, 'old_1', null, null, oldTimestamp);
			insertAuditEvent(db, otherTeam.id, otherOwner, 'old_2', null, null, oldTimestamp);

			const deleted = auditService.pruneOldEvents();
			expect(deleted).toBe(2);
		});
	});

	// ─── getEventCounts ─────────────────────────────────────────────────

	describe('getEventCounts', () => {
		it('returns counts grouped by action', () => {
			insertAuditEvent(db, teamId, ownerPubkey, 'member_invited');
			insertAuditEvent(db, teamId, ownerPubkey, 'member_invited');
			insertAuditEvent(db, teamId, ownerPubkey, 'member_removed');

			const counts = auditService.getEventCounts(teamId);

			expect(counts.team_created).toBe(1); // From team creation
			expect(counts.member_invited).toBe(2);
			expect(counts.member_removed).toBe(1);
		});

		it('returns empty object for team with no events', () => {
			const counts = auditService.getEventCounts('nonexistent-team');
			expect(Object.keys(counts).length).toBe(0);
		});

		it('only counts events for the specified team', () => {
			const otherOwner = randomPubkey();
			const otherTeam = teamService.createTeam('Other Team', 'other-team', otherOwner);

			insertAuditEvent(db, teamId, ownerPubkey, 'member_invited');
			insertAuditEvent(db, otherTeam.id, otherOwner, 'member_invited');
			insertAuditEvent(db, otherTeam.id, otherOwner, 'member_invited');

			const counts = auditService.getEventCounts(teamId);
			expect(counts.member_invited).toBe(1);

			const otherCounts = auditService.getEventCounts(otherTeam.id);
			expect(otherCounts.member_invited).toBe(2);
		});
	});
});
