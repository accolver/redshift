/**
 * Team secret service for @redshift/bunker
 *
 * Handles team key rotation and rotated key management.
 * Key rotation generates a new Nostr keypair for a team, preserving
 * the old key so clients can coordinate re-encryption of secrets.
 */

import type { Database } from 'bun:sqlite';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { encrypt } from './encryption.js';
import { AuthorizationError, NotFoundError } from './errors.js';
import { hasPermission } from './rbac.js';
import type { TeamService } from './team-service.js';
import type { RotatedKey } from './types.js';

/**
 * TeamSecretService handles team secret operations from the bunker's perspective.
 *
 * It manages key rotation and rotated key lifecycle, enforcing RBAC rules
 * and logging audit events for all mutations.
 */
export class TeamSecretService {
	private readonly db: Database;
	private readonly masterKey: string;
	private readonly teamService: TeamService;

	constructor(db: Database, masterKey: string, teamService: TeamService) {
		this.db = db;
		this.masterKey = masterKey;
		this.teamService = teamService;
	}

	// ─── Key Rotation ──────────────────────────────────────────────────

	/**
	 * Rotate the team's Nostr keypair.
	 *
	 * Generates a new keypair, encrypts the new nsec with the master key,
	 * updates the teams table, and preserves the old key in rotated_keys
	 * for client re-encryption coordination.
	 *
	 * @param teamId - The team to rotate keys for
	 * @param actorPubkey - The pubkey of the actor performing the rotation
	 * @returns The old and new pubkeys
	 * @throws {NotFoundError} if team doesn't exist
	 * @throws {AuthorizationError} if actor lacks permission (must be owner or admin)
	 */
	rotateTeamKey(teamId: string, actorPubkey: string) {
		const team = this.teamService.getTeam(teamId);
		if (!team) {
			throw new NotFoundError(`Team "${teamId}" not found`);
		}

		// Check RBAC: only owner or admin can rotate keys
		const member = this.teamService.getMember(teamId, actorPubkey);
		if (!member) {
			throw new AuthorizationError('Actor is not a member of this team');
		}

		if (!hasPermission(member.role, 'manageMembers')) {
			throw new AuthorizationError('Insufficient permissions to rotate team key');
		}

		// Preserve the old key
		const oldPubkey = team.pubkey;
		const oldEncryptedNsec = team.encrypted_nsec;

		// Generate a new Nostr keypair
		const newPrivateKey = generateSecretKey();
		const newPubkey = getPublicKey(newPrivateKey);

		// Encrypt the new private key
		const newPrivateKeyHex = Buffer.from(newPrivateKey).toString('hex');
		const newEncryptedNsec = encrypt(newPrivateKeyHex, this.masterKey);

		const now = Math.floor(Date.now() / 1000);

		// Store the old key in rotated_keys
		const rotatedKeyId = crypto.randomUUID();
		this.db
			.query(
				'INSERT INTO rotated_keys (id, team_id, old_pubkey, old_encrypted_nsec, new_pubkey, rotated_at, rotated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
			)
			.run(rotatedKeyId, teamId, oldPubkey, oldEncryptedNsec, newPubkey, now, actorPubkey);

		// Update the team with the new key
		this.db
			.query('UPDATE teams SET pubkey = ?, encrypted_nsec = ?, updated_at = ? WHERE id = ?')
			.run(newPubkey, newEncryptedNsec, now, teamId);

		// Log audit event
		this.logAudit(
			teamId,
			actorPubkey,
			'team_key_rotated',
			teamId,
			JSON.stringify({
				oldPubkey,
				newPubkey,
			}),
		);

		return { oldPubkey, newPubkey };
	}

	// ─── Rotated Key Management ────────────────────────────────────────

	/**
	 * Get all rotated keys for a team.
	 * Returns old keys so clients know they need to re-encrypt.
	 *
	 * @param teamId - The team to get rotated keys for
	 * @returns Array of rotated keys, most recent first
	 */
	getRotatedKeys(teamId: string) {
		return this.db
			.query<RotatedKey, [string]>(
				'SELECT * FROM rotated_keys WHERE team_id = ? ORDER BY rotated_at DESC',
			)
			.all(teamId);
	}

	/**
	 * Delete a rotated key entry after re-encryption is complete.
	 *
	 * @param teamId - The team the rotated key belongs to
	 * @param oldPubkey - The old pubkey to delete
	 * @throws {NotFoundError} if the rotated key doesn't exist
	 */
	deleteRotatedKey(teamId: string, oldPubkey: string) {
		const existing = this.db
			.query<{ id: string }, [string, string]>(
				'SELECT id FROM rotated_keys WHERE team_id = ? AND old_pubkey = ?',
			)
			.get(teamId, oldPubkey);

		if (!existing) {
			throw new NotFoundError(
				`Rotated key with old pubkey "${oldPubkey}" not found for team "${teamId}"`,
			);
		}

		this.db
			.query('DELETE FROM rotated_keys WHERE team_id = ? AND old_pubkey = ?')
			.run(teamId, oldPubkey);
	}

	/**
	 * Delete all rotated keys for a team.
	 * Used during team deletion cleanup.
	 *
	 * @param teamId - The team to clean up rotated keys for
	 */
	deleteRotatedKeysForTeam(teamId: string) {
		this.db.query('DELETE FROM rotated_keys WHERE team_id = ?').run(teamId);
	}

	// ─── Audit ──────────────────────────────────────────────────────────

	/**
	 * Log an audit event.
	 */
	private logAudit(
		teamId: string,
		actorPubkey: string,
		action: string,
		target: string | null,
		metadata?: string,
	) {
		this.db
			.query(
				'INSERT INTO audit_events (id, team_id, actor_pubkey, action, target, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
			)
			.run(
				crypto.randomUUID(),
				teamId,
				actorPubkey,
				action,
				target,
				metadata ?? null,
				Math.floor(Date.now() / 1000),
			);
	}
}
