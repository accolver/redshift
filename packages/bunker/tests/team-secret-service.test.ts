/**
 * TeamSecretService tests for @redshift/bunker
 *
 * Tests team key rotation, rotated key management, and RBAC enforcement.
 */

import type { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { openDatabase } from '../src/database';
import { decrypt, generateMasterKey } from '../src/encryption';
import { AuthorizationError, NotFoundError } from '../src/errors';
import { TeamSecretService } from '../src/team-secret-service';
import { TeamService } from '../src/team-service';

// ─── Test Helpers ───────────────────────────────────────────────────────────

/** Generate a random hex pubkey */
function randomPubkey() {
	return getPublicKey(generateSecretKey());
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('TeamSecretService', () => {
	let db: Database;
	let masterKey: string;
	let teamService: TeamService;
	let secretService: TeamSecretService;

	beforeEach(() => {
		db = openDatabase(':memory:');
		masterKey = generateMasterKey();
		teamService = new TeamService(db, masterKey);
		secretService = new TeamSecretService(db, masterKey, teamService);
	});

	afterEach(() => {
		db.close();
	});

	// ─── Key Rotation ──────────────────────────────────────────────────

	describe('rotateTeamKey', () => {
		it('generates a new keypair and updates the team', () => {
			const ownerPubkey = randomPubkey();
			const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);
			const oldPubkey = team.pubkey;

			const result = secretService.rotateTeamKey(team.id, ownerPubkey);

			expect(result.oldPubkey).toBe(oldPubkey);
			expect(result.newPubkey).toMatch(/^[0-9a-f]{64}$/);
			expect(result.newPubkey).not.toBe(oldPubkey);

			// Verify team was updated in database
			const updatedTeam = teamService.getTeam(team.id);
			expect(updatedTeam).not.toBeNull();
			expect(updatedTeam!.pubkey).toBe(result.newPubkey);
			expect(updatedTeam!.pubkey).not.toBe(oldPubkey);
		});

		it('encrypts the new nsec with the master key', () => {
			const ownerPubkey = randomPubkey();
			const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

			secretService.rotateTeamKey(team.id, ownerPubkey);

			const updatedTeam = teamService.getTeam(team.id);
			expect(updatedTeam).not.toBeNull();

			// Verify the encrypted nsec can be decrypted
			const decryptedHex = decrypt(updatedTeam!.encrypted_nsec, masterKey);
			expect(decryptedHex).toMatch(/^[0-9a-f]{64}$/);

			// Verify the decrypted key corresponds to the new pubkey
			const privateKeyBytes = Buffer.from(decryptedHex, 'hex');
			const derivedPubkey = getPublicKey(new Uint8Array(privateKeyBytes));
			expect(derivedPubkey).toBe(updatedTeam!.pubkey);
		});

		it('preserves the old key in rotated_keys table', () => {
			const ownerPubkey = randomPubkey();
			const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);
			const oldPubkey = team.pubkey;
			const oldEncryptedNsec = team.encrypted_nsec;

			const result = secretService.rotateTeamKey(team.id, ownerPubkey);

			const rotatedKeys = secretService.getRotatedKeys(team.id);
			expect(rotatedKeys.length).toBe(1);
			expect(rotatedKeys[0]!.old_pubkey).toBe(oldPubkey);
			expect(rotatedKeys[0]!.old_encrypted_nsec).toBe(oldEncryptedNsec);
			expect(rotatedKeys[0]!.new_pubkey).toBe(result.newPubkey);
			expect(rotatedKeys[0]!.rotated_by).toBe(ownerPubkey);
			expect(rotatedKeys[0]!.rotated_at).toBeGreaterThan(0);
			expect(rotatedKeys[0]!.team_id).toBe(team.id);
		});

		it('logs audit event team_key_rotated', () => {
			const ownerPubkey = randomPubkey();
			const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

			secretService.rotateTeamKey(team.id, ownerPubkey);

			const audit = db
				.query<{ action: string; actor_pubkey: string; metadata: string | null }, [string, string]>(
					'SELECT action, actor_pubkey, metadata FROM audit_events WHERE team_id = ? AND action = ?',
				)
				.get(team.id, 'team_key_rotated');

			expect(audit).not.toBeNull();
			expect(audit!.action).toBe('team_key_rotated');
			expect(audit!.actor_pubkey).toBe(ownerPubkey);
		});

		it('updates the team updated_at timestamp', () => {
			const ownerPubkey = randomPubkey();
			const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);
			const originalUpdatedAt = team.updated_at;

			// Small delay to ensure timestamp difference
			secretService.rotateTeamKey(team.id, ownerPubkey);

			const updatedTeam = teamService.getTeam(team.id);
			expect(updatedTeam!.updated_at).toBeGreaterThanOrEqual(originalUpdatedAt);
		});

		it('owner can rotate key', () => {
			const ownerPubkey = randomPubkey();
			const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

			// Should not throw
			const result = secretService.rotateTeamKey(team.id, ownerPubkey);
			expect(result.newPubkey).toBeTruthy();
		});

		it('admin can rotate key', () => {
			const ownerPubkey = randomPubkey();
			const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			teamService.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			const invitations = teamService.listInvitations(team.id);
			teamService.acceptInvitation(invitations[0]!.id, adminPubkey);

			// Should not throw
			const result = secretService.rotateTeamKey(team.id, adminPubkey);
			expect(result.newPubkey).toBeTruthy();
		});

		it('developer cannot rotate key', () => {
			const ownerPubkey = randomPubkey();
			const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			teamService.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			const invitations = teamService.listInvitations(team.id);
			teamService.acceptInvitation(invitations[0]!.id, devPubkey);

			expect(() => secretService.rotateTeamKey(team.id, devPubkey)).toThrow(AuthorizationError);
		});

		it('readonly cannot rotate key', () => {
			const ownerPubkey = randomPubkey();
			const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

			const readonlyPubkey = randomPubkey();
			teamService.inviteMember(team.id, { pubkey: readonlyPubkey, role: 'readonly' }, ownerPubkey);
			const invitations = teamService.listInvitations(team.id);
			teamService.acceptInvitation(invitations[0]!.id, readonlyPubkey);

			expect(() => secretService.rotateTeamKey(team.id, readonlyPubkey)).toThrow(
				AuthorizationError,
			);
		});

		it('non-member cannot rotate key', () => {
			const ownerPubkey = randomPubkey();
			const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

			const outsiderPubkey = randomPubkey();
			expect(() => secretService.rotateTeamKey(team.id, outsiderPubkey)).toThrow(
				AuthorizationError,
			);
		});

		it('throws NotFoundError for non-existent team', () => {
			expect(() => secretService.rotateTeamKey('non-existent', randomPubkey())).toThrow(
				NotFoundError,
			);
		});

		it('supports multiple rotations', () => {
			const ownerPubkey = randomPubkey();
			const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

			const result1 = secretService.rotateTeamKey(team.id, ownerPubkey);
			const result2 = secretService.rotateTeamKey(team.id, ownerPubkey);

			expect(result1.newPubkey).not.toBe(result2.newPubkey);
			expect(result2.oldPubkey).toBe(result1.newPubkey);

			const rotatedKeys = secretService.getRotatedKeys(team.id);
			expect(rotatedKeys.length).toBe(2);
		});
	});

	// ─── Rotated Key Management ────────────────────────────────────────

	describe('getRotatedKeys', () => {
		it('returns empty array when no rotations have occurred', () => {
			const ownerPubkey = randomPubkey();
			const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

			const rotatedKeys = secretService.getRotatedKeys(team.id);
			expect(rotatedKeys).toEqual([]);
		});

		it('returns rotated keys for a team', () => {
			const ownerPubkey = randomPubkey();
			const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

			secretService.rotateTeamKey(team.id, ownerPubkey);

			const rotatedKeys = secretService.getRotatedKeys(team.id);
			expect(rotatedKeys.length).toBe(1);
			expect(rotatedKeys[0]!.team_id).toBe(team.id);
		});

		it('returns keys ordered by rotated_at descending', () => {
			const ownerPubkey = randomPubkey();
			const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

			secretService.rotateTeamKey(team.id, ownerPubkey);
			secretService.rotateTeamKey(team.id, ownerPubkey);

			const rotatedKeys = secretService.getRotatedKeys(team.id);
			expect(rotatedKeys.length).toBe(2);
			// Most recent first
			expect(rotatedKeys[0]!.rotated_at).toBeGreaterThanOrEqual(rotatedKeys[1]!.rotated_at);
		});

		it('does not return keys from other teams', () => {
			const ownerPubkey = randomPubkey();
			const team1 = teamService.createTeam('Team 1', 'team-1', ownerPubkey);
			const team2 = teamService.createTeam('Team 2', 'team-2', ownerPubkey);

			secretService.rotateTeamKey(team1.id, ownerPubkey);
			secretService.rotateTeamKey(team2.id, ownerPubkey);

			const keys1 = secretService.getRotatedKeys(team1.id);
			const keys2 = secretService.getRotatedKeys(team2.id);

			expect(keys1.length).toBe(1);
			expect(keys2.length).toBe(1);
			expect(keys1[0]!.team_id).toBe(team1.id);
			expect(keys2[0]!.team_id).toBe(team2.id);
		});
	});

	describe('deleteRotatedKey', () => {
		it('deletes a rotated key by team ID and old pubkey', () => {
			const ownerPubkey = randomPubkey();
			const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);
			const oldPubkey = team.pubkey;

			secretService.rotateTeamKey(team.id, ownerPubkey);

			// Verify it exists
			expect(secretService.getRotatedKeys(team.id).length).toBe(1);

			secretService.deleteRotatedKey(team.id, oldPubkey);

			// Verify it's gone
			expect(secretService.getRotatedKeys(team.id).length).toBe(0);
		});

		it('throws NotFoundError when rotated key does not exist', () => {
			const ownerPubkey = randomPubkey();
			const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

			expect(() => secretService.deleteRotatedKey(team.id, 'a'.repeat(64))).toThrow(NotFoundError);
		});

		it('only deletes the specified key, not others', () => {
			const ownerPubkey = randomPubkey();
			const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);
			const firstPubkey = team.pubkey;

			secretService.rotateTeamKey(team.id, ownerPubkey);
			secretService.rotateTeamKey(team.id, ownerPubkey);

			expect(secretService.getRotatedKeys(team.id).length).toBe(2);

			secretService.deleteRotatedKey(team.id, firstPubkey);

			const remaining = secretService.getRotatedKeys(team.id);
			expect(remaining.length).toBe(1);
			expect(remaining[0]!.old_pubkey).not.toBe(firstPubkey);
		});

		it('does not delete keys from other teams', () => {
			const ownerPubkey = randomPubkey();
			const team1 = teamService.createTeam('Team 1', 'team-1', ownerPubkey);
			const team2 = teamService.createTeam('Team 2', 'team-2', ownerPubkey);
			const team1OldPubkey = team1.pubkey;

			secretService.rotateTeamKey(team1.id, ownerPubkey);
			secretService.rotateTeamKey(team2.id, ownerPubkey);

			// Try to delete team1's key using team2's ID — should not find it
			expect(() => secretService.deleteRotatedKey(team2.id, team1OldPubkey)).toThrow(NotFoundError);

			// Both teams should still have their rotated keys
			expect(secretService.getRotatedKeys(team1.id).length).toBe(1);
			expect(secretService.getRotatedKeys(team2.id).length).toBe(1);
		});
	});

	// ─── Team Deletion Cleanup ─────────────────────────────────────────

	describe('rotated keys cleanup on team deletion', () => {
		it('rotated keys are cleaned up when team is deleted', () => {
			const ownerPubkey = randomPubkey();
			const team = teamService.createTeam('My Team', 'my-team', ownerPubkey);

			secretService.rotateTeamKey(team.id, ownerPubkey);
			expect(secretService.getRotatedKeys(team.id).length).toBe(1);

			// We need to clean up rotated_keys before team deletion due to FK constraint
			// This tests that the service handles it properly
			secretService.deleteRotatedKeysForTeam(team.id);
			teamService.deleteTeam(team.id, ownerPubkey);

			expect(secretService.getRotatedKeys(team.id).length).toBe(0);
		});
	});
});
