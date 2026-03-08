/**
 * Team metadata event tests for @redshift/bunker
 *
 * Tests Kind 30080 team metadata event creation for relay publishing.
 */

import type { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { openDatabase } from '../src/database';
import { generateMasterKey } from '../src/encryption';
import { NotFoundError } from '../src/errors';
import { createTeamMetadataEvent } from '../src/team-metadata';
import { TeamService } from '../src/team-service';

// ─── Test Helpers ───────────────────────────────────────────────────────────

/** Generate a random hex pubkey */
function randomPubkey() {
	return getPublicKey(generateSecretKey());
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('createTeamMetadataEvent', () => {
	let db: Database;
	let masterKey: string;
	let teamService: TeamService;

	beforeEach(() => {
		db = openDatabase(':memory:');
		masterKey = generateMasterKey();
		teamService = new TeamService(db, masterKey);
	});

	afterEach(() => {
		db.close();
	});

	it('creates a Kind 30080 event template', () => {
		const ownerPubkey = randomPubkey();
		const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

		const event = createTeamMetadataEvent(team.id, db);

		expect(event.kind).toBe(30080);
	});

	it('uses team slug as d-tag', () => {
		const ownerPubkey = randomPubkey();
		const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

		const event = createTeamMetadataEvent(team.id, db);

		const dTag = event.tags.find((t) => t[0] === 'd');
		expect(dTag).toBeTruthy();
		expect(dTag![1]).toBe('my-team');
	});

	it('includes team pubkey as p-tag', () => {
		const ownerPubkey = randomPubkey();
		const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

		const event = createTeamMetadataEvent(team.id, db);

		const pTag = event.tags.find((t) => t[0] === 'p');
		expect(pTag).toBeTruthy();
		expect(pTag![1]).toBe(team.pubkey);
	});

	it('includes redshift-team t-tag', () => {
		const ownerPubkey = randomPubkey();
		const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

		const event = createTeamMetadataEvent(team.id, db);

		const tTag = event.tags.find((t) => t[0] === 't');
		expect(tTag).toBeTruthy();
		expect(tTag![1]).toBe('redshift-team');
	});

	it('includes team metadata in content as JSON', () => {
		const ownerPubkey = randomPubkey();
		const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

		const event = createTeamMetadataEvent(team.id, db);

		const content = JSON.parse(event.content) as {
			name: string;
			memberCount: number;
			createdAt: number;
		};

		expect(content.name).toBe('My Team');
		expect(content.memberCount).toBe(1); // Just the owner
		expect(content.createdAt).toBe(team.created_at);
	});

	it('counts all members correctly', () => {
		const ownerPubkey = randomPubkey();
		const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

		// Add members
		const dev1 = randomPubkey();
		teamService.inviteMember(team.id, { pubkey: dev1, role: 'developer' }, ownerPubkey);
		const invitations1 = teamService.listInvitations(team.id);
		teamService.acceptInvitation(invitations1[0]!.id, dev1);

		const dev2 = randomPubkey();
		teamService.inviteMember(team.id, { pubkey: dev2, role: 'developer' }, ownerPubkey);
		const invitations2 = teamService.listInvitations(team.id);
		teamService.acceptInvitation(invitations2[0]!.id, dev2);

		const event = createTeamMetadataEvent(team.id, db);
		const content = JSON.parse(event.content) as { memberCount: number };

		expect(content.memberCount).toBe(3); // owner + 2 developers
	});

	it('sets created_at to current time', () => {
		const ownerPubkey = randomPubkey();
		const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

		const before = Math.floor(Date.now() / 1000);
		const event = createTeamMetadataEvent(team.id, db);
		const after = Math.floor(Date.now() / 1000);

		expect(event.created_at).toBeGreaterThanOrEqual(before);
		expect(event.created_at).toBeLessThanOrEqual(after);
	});

	it('throws NotFoundError for non-existent team', () => {
		expect(() => createTeamMetadataEvent('non-existent', db)).toThrow(NotFoundError);
	});

	it('returns an unsigned event template (no id, sig, or pubkey)', () => {
		const ownerPubkey = randomPubkey();
		const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

		const event = createTeamMetadataEvent(team.id, db);

		// EventTemplate should not have id, sig, or pubkey
		expect('id' in event).toBe(false);
		expect('sig' in event).toBe(false);
		expect('pubkey' in event).toBe(false);
	});
});
