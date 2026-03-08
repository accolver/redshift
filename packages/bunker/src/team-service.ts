/**
 * Team management service for @redshift/bunker
 *
 * Orchestrates team CRUD, member management, invitations, role changes,
 * and ownership transfer. All mutations log audit events.
 */

import type { Database } from 'bun:sqlite';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { encrypt } from './encryption.js';
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from './errors.js';
import { hasPermission } from './rbac.js';
import type { SessionManager } from './session-manager.js';
import type { Invitation, InviteParams, Member, MemberRole, Team } from './types.js';

/** Default invitation expiry: 7 days in seconds */
const INVITATION_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

/** Roles that can be assigned via invitation (owner is transferred, not invited) */
const INVITABLE_ROLES: ReadonlySet<string> = new Set(['admin', 'developer', 'readonly']);

/**
 * TeamService handles all team management operations.
 *
 * It enforces RBAC rules, logs audit events, and coordinates
 * with the SessionManager for session invalidation on member removal.
 */
export class TeamService {
	private readonly db: Database;
	private readonly masterKey: string;
	private readonly sessionManager: SessionManager | null;

	constructor(db: Database, masterKey: string, sessionManager?: SessionManager) {
		this.db = db;
		this.masterKey = masterKey;
		this.sessionManager = sessionManager ?? null;
	}

	// ─── Team CRUD ──────────────────────────────────────────────────────────

	/**
	 * Create a new team with a fresh Nostr keypair.
	 * The creator becomes the team owner.
	 *
	 * @param name - Human-readable team name
	 * @param slug - URL-safe unique identifier
	 * @param ownerPubkey - Nostr pubkey of the team creator
	 * @returns The created team
	 * @throws {ValidationError} if name or slug is empty
	 * @throws {ConflictError} if slug is already taken
	 */
	createTeam(name: string, slug: string, ownerPubkey: string) {
		if (!name.trim()) {
			throw new ValidationError('Team name cannot be empty');
		}
		if (!slug.trim()) {
			throw new ValidationError('Team slug cannot be empty');
		}
		if (!/^[a-z0-9-]+$/.test(slug)) {
			throw new ValidationError(
				'Team slug must contain only lowercase letters, numbers, and hyphens',
			);
		}

		// Check slug uniqueness
		const existing = this.db
			.query<{ id: string }, [string]>('SELECT id FROM teams WHERE slug = ?')
			.get(slug);
		if (existing) {
			throw new ConflictError(`Team slug "${slug}" is already taken`);
		}

		// Generate a fresh Nostr keypair for the team
		const privateKey = generateSecretKey();
		const pubkey = getPublicKey(privateKey);

		// Encrypt the private key for storage
		const privateKeyHex = Buffer.from(privateKey).toString('hex');
		const encryptedNsec = encrypt(privateKeyHex, this.masterKey);

		const teamId = crypto.randomUUID();
		const now = Math.floor(Date.now() / 1000);

		this.db
			.query(
				'INSERT INTO teams (id, name, slug, pubkey, encrypted_nsec, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
			)
			.run(teamId, name.trim(), slug, pubkey, encryptedNsec, now, now);

		// Add creator as owner
		const memberId = crypto.randomUUID();
		this.db
			.query('INSERT INTO members (id, team_id, pubkey, role, joined_at) VALUES (?, ?, ?, ?, ?)')
			.run(memberId, teamId, ownerPubkey, 'owner', now);

		// Log audit event
		this.logAudit(teamId, ownerPubkey, 'team_created', teamId);

		return this.getTeam(teamId) as Team;
	}

	/**
	 * Get a team by ID.
	 */
	getTeam(teamId: string) {
		return this.db.query<Team, [string]>('SELECT * FROM teams WHERE id = ?').get(teamId) ?? null;
	}

	/**
	 * Get a team by slug.
	 */
	getTeamBySlug(slug: string) {
		return this.db.query<Team, [string]>('SELECT * FROM teams WHERE slug = ?').get(slug) ?? null;
	}

	/**
	 * List all teams.
	 */
	listTeams() {
		return this.db.query<Team, []>('SELECT * FROM teams ORDER BY created_at DESC').all();
	}

	/**
	 * Delete a team. Only the owner can delete a team.
	 *
	 * @throws {NotFoundError} if team doesn't exist
	 * @throws {AuthorizationError} if actor is not the owner
	 */
	deleteTeam(teamId: string, actorPubkey: string) {
		const team = this.getTeam(teamId);
		if (!team) {
			throw new NotFoundError(`Team "${teamId}" not found`);
		}

		const actor = this.getMember(teamId, actorPubkey);
		if (!actor || actor.role !== 'owner') {
			throw new AuthorizationError('Only the team owner can delete the team');
		}

		// Log before deletion
		this.logAudit(teamId, actorPubkey, 'team_deleted', teamId);

		// Invalidate all sessions for this team
		if (this.sessionManager) {
			this.sessionManager.removeTeamSessions(teamId);
		}

		// Delete in dependency order
		this.db.query('DELETE FROM web_sessions WHERE team_id = ?').run(teamId);
		this.db.query('DELETE FROM sessions WHERE team_id = ?').run(teamId);
		this.db.query('DELETE FROM invitations WHERE team_id = ?').run(teamId);
		this.db
			.query(
				'DELETE FROM assignments WHERE member_id IN (SELECT id FROM members WHERE team_id = ?)',
			)
			.run(teamId);
		this.db
			.query(
				'DELETE FROM assignments WHERE identity_id IN (SELECT id FROM identities WHERE team_id = ?)',
			)
			.run(teamId);
		this.db.query('DELETE FROM identities WHERE team_id = ?').run(teamId);
		this.db.query('DELETE FROM members WHERE team_id = ?').run(teamId);
		// Audit events are kept for historical record but we delete them for the team
		this.db.query('DELETE FROM audit_events WHERE team_id = ?').run(teamId);
		this.db.query('DELETE FROM teams WHERE id = ?').run(teamId);
	}

	// ─── Members ────────────────────────────────────────────────────────────

	/**
	 * Get a member by pubkey in a specific team.
	 */
	getMember(teamId: string, pubkey: string) {
		return (
			this.db
				.query<Member, [string, string]>('SELECT * FROM members WHERE team_id = ? AND pubkey = ?')
				.get(teamId, pubkey) ?? null
		);
	}

	/**
	 * List all members of a team.
	 */
	listMembers(teamId: string) {
		return this.db
			.query<Member, [string]>('SELECT * FROM members WHERE team_id = ? ORDER BY joined_at ASC')
			.all(teamId);
	}

	/**
	 * Remove a member from a team.
	 * Requires manageMembers permission. Owners cannot be removed (use transferOwnership first).
	 *
	 * @throws {NotFoundError} if team or member doesn't exist
	 * @throws {AuthorizationError} if actor lacks permission or tries to remove owner
	 */
	removeMember(teamId: string, memberPubkey: string, actorPubkey: string) {
		const team = this.getTeam(teamId);
		if (!team) {
			throw new NotFoundError(`Team "${teamId}" not found`);
		}

		const actor = this.getMember(teamId, actorPubkey);
		if (!actor) {
			throw new AuthorizationError('Actor is not a member of this team');
		}

		if (!hasPermission(actor.role, 'manageMembers')) {
			throw new AuthorizationError('Insufficient permissions to manage members');
		}

		const target = this.getMember(teamId, memberPubkey);
		if (!target) {
			throw new NotFoundError(`Member with pubkey "${memberPubkey}" not found in team`);
		}

		// Cannot remove the owner
		if (target.role === 'owner') {
			throw new AuthorizationError('Cannot remove the team owner. Transfer ownership first.');
		}

		// Cannot remove self (use leave team instead, or transfer ownership)
		if (actorPubkey === memberPubkey) {
			throw new AuthorizationError('Cannot remove yourself from the team');
		}

		// Admins cannot remove other admins (only owner can)
		if (actor.role === 'admin' && target.role === 'admin') {
			throw new AuthorizationError('Admins cannot remove other admins');
		}

		// Invalidate NIP-46 sessions for this member
		if (this.sessionManager) {
			this.sessionManager.removeMemberSessions(target.id);
		}

		// Delete web sessions
		this.db.query('DELETE FROM web_sessions WHERE member_id = ?').run(target.id);

		// Delete assignments
		this.db.query('DELETE FROM assignments WHERE member_id = ?').run(target.id);

		// Delete the member
		this.db.query('DELETE FROM members WHERE id = ?').run(target.id);

		// Log audit event
		this.logAudit(teamId, actorPubkey, 'member_removed', memberPubkey);
	}

	// ─── Invitations ────────────────────────────────────────────────────────

	/**
	 * Create an invitation to join a team.
	 * Requires manageMembers permission.
	 *
	 * @throws {NotFoundError} if team doesn't exist
	 * @throws {AuthorizationError} if actor lacks permission
	 * @throws {ValidationError} if params are invalid
	 * @throws {ConflictError} if member already exists or pending invitation exists
	 */
	inviteMember(teamId: string, params: InviteParams, actorPubkey: string) {
		const team = this.getTeam(teamId);
		if (!team) {
			throw new NotFoundError(`Team "${teamId}" not found`);
		}

		const actor = this.getMember(teamId, actorPubkey);
		if (!actor) {
			throw new AuthorizationError('Actor is not a member of this team');
		}

		if (!hasPermission(actor.role, 'manageMembers')) {
			throw new AuthorizationError('Insufficient permissions to invite members');
		}

		// Validate role
		if (!INVITABLE_ROLES.has(params.role)) {
			throw new ValidationError(
				`Invalid invitation role: "${params.role}". Cannot invite as owner.`,
			);
		}

		// Admins cannot invite other admins (only owner can)
		if (actor.role === 'admin' && params.role === 'admin') {
			throw new AuthorizationError('Admins cannot invite other admins. Only the owner can.');
		}

		// Must provide either email or pubkey
		if (!params.email && !params.pubkey) {
			throw new ValidationError('Must provide either email or pubkey for invitation');
		}

		// Validate pubkey format if provided
		if (params.pubkey && !/^[0-9a-fA-F]{64}$/.test(params.pubkey)) {
			throw new ValidationError('Invalid pubkey format');
		}

		// Check if member already exists (by pubkey)
		if (params.pubkey) {
			const existing = this.getMember(teamId, params.pubkey);
			if (existing) {
				throw new ConflictError('This pubkey is already a member of the team');
			}
		}

		// Check for existing pending invitation
		if (params.pubkey) {
			const pendingByPubkey = this.db
				.query<{ id: string }, [string, string]>(
					"SELECT id FROM invitations WHERE team_id = ? AND pubkey = ? AND status = 'pending'",
				)
				.get(teamId, params.pubkey);
			if (pendingByPubkey) {
				throw new ConflictError('A pending invitation already exists for this pubkey');
			}
		}

		if (params.email) {
			const pendingByEmail = this.db
				.query<{ id: string }, [string, string]>(
					"SELECT id FROM invitations WHERE team_id = ? AND email = ? AND status = 'pending'",
				)
				.get(teamId, params.email);
			if (pendingByEmail) {
				throw new ConflictError('A pending invitation already exists for this email');
			}
		}

		const invitationId = crypto.randomUUID();
		const now = Math.floor(Date.now() / 1000);
		const expiresAt = now + INVITATION_EXPIRY_SECONDS;

		this.db
			.query(
				'INSERT INTO invitations (id, team_id, email, pubkey, role, invited_by, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
			)
			.run(
				invitationId,
				teamId,
				params.email ?? null,
				params.pubkey ?? null,
				params.role,
				actorPubkey,
				'pending',
				now,
				expiresAt,
			);

		this.logAudit(teamId, actorPubkey, 'member_invited', params.pubkey ?? params.email ?? null);

		return this.db
			.query<Invitation, [string]>('SELECT * FROM invitations WHERE id = ?')
			.get(invitationId) as Invitation;
	}

	/**
	 * Accept an invitation and become a team member.
	 *
	 * @param invitationId - The invitation ID
	 * @param memberPubkey - The Nostr pubkey of the accepting member
	 * @returns The created member
	 * @throws {NotFoundError} if invitation doesn't exist
	 * @throws {ValidationError} if invitation is expired or already accepted
	 * @throws {AuthorizationError} if pubkey doesn't match invitation
	 */
	acceptInvitation(invitationId: string, memberPubkey: string) {
		const invitation = this.db
			.query<Invitation, [string]>('SELECT * FROM invitations WHERE id = ?')
			.get(invitationId);

		if (!invitation) {
			throw new NotFoundError(`Invitation "${invitationId}" not found`);
		}

		if (invitation.status !== 'pending') {
			throw new ValidationError(`Invitation is already ${invitation.status}`);
		}

		const now = Math.floor(Date.now() / 1000);
		if (now >= invitation.expires_at) {
			// Mark as expired
			this.db.query("UPDATE invitations SET status = 'expired' WHERE id = ?").run(invitationId);
			throw new ValidationError('Invitation has expired');
		}

		// If invitation was for a specific pubkey, verify it matches
		if (invitation.pubkey && invitation.pubkey !== memberPubkey) {
			throw new AuthorizationError('This invitation is for a different pubkey');
		}

		// Check if already a member
		const existing = this.getMember(invitation.team_id, memberPubkey);
		if (existing) {
			throw new ConflictError('Already a member of this team');
		}

		// Create the member
		const memberId = crypto.randomUUID();
		this.db
			.query(
				'INSERT INTO members (id, team_id, pubkey, role, email, joined_at, invited_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
			)
			.run(
				memberId,
				invitation.team_id,
				memberPubkey,
				invitation.role,
				invitation.email,
				now,
				invitation.invited_by,
			);

		// Mark invitation as accepted
		this.db.query("UPDATE invitations SET status = 'accepted' WHERE id = ?").run(invitationId);

		this.logAudit(invitation.team_id, memberPubkey, 'invitation_accepted', invitationId);

		return this.db
			.query<Member, [string]>('SELECT * FROM members WHERE id = ?')
			.get(memberId) as Member;
	}

	/**
	 * List pending invitations for a team.
	 */
	listInvitations(teamId: string) {
		return this.db
			.query<Invitation, [string]>(
				"SELECT * FROM invitations WHERE team_id = ? AND status = 'pending' ORDER BY created_at DESC",
			)
			.all(teamId);
	}

	// ─── Roles ──────────────────────────────────────────────────────────────

	/**
	 * Change a member's role.
	 *
	 * Rules:
	 * - Requires manageMembers permission
	 * - Cannot change own role
	 * - Only owner can assign admin role
	 * - Nobody can assign owner role via this method (use transferOwnership)
	 * - Admins can only change developer/readonly roles
	 *
	 * @throws {NotFoundError} if team or member doesn't exist
	 * @throws {AuthorizationError} if actor lacks permission
	 * @throws {ValidationError} if new role is invalid
	 */
	changeRole(teamId: string, memberPubkey: string, newRole: MemberRole, actorPubkey: string) {
		const team = this.getTeam(teamId);
		if (!team) {
			throw new NotFoundError(`Team "${teamId}" not found`);
		}

		const actor = this.getMember(teamId, actorPubkey);
		if (!actor) {
			throw new AuthorizationError('Actor is not a member of this team');
		}

		if (!hasPermission(actor.role, 'manageMembers')) {
			throw new AuthorizationError('Insufficient permissions to change roles');
		}

		const target = this.getMember(teamId, memberPubkey);
		if (!target) {
			throw new NotFoundError(`Member with pubkey "${memberPubkey}" not found in team`);
		}

		// Cannot change own role
		if (actorPubkey === memberPubkey) {
			throw new AuthorizationError('Cannot change your own role');
		}

		// Cannot assign owner role (use transferOwnership)
		if (newRole === 'owner') {
			throw new AuthorizationError('Cannot assign owner role. Use ownership transfer instead.');
		}

		// Cannot change the owner's role
		if (target.role === 'owner') {
			throw new AuthorizationError("Cannot change the owner's role. Transfer ownership first.");
		}

		// Admins cannot assign admin role (only owner can)
		if (actor.role === 'admin' && newRole === 'admin') {
			throw new AuthorizationError('Admins cannot assign the admin role. Only the owner can.');
		}

		// Admins cannot change other admins' roles
		if (actor.role === 'admin' && target.role === 'admin') {
			throw new AuthorizationError("Admins cannot change other admins' roles");
		}

		// No-op if role is the same
		if (target.role === newRole) {
			return;
		}

		this.db.query('UPDATE members SET role = ? WHERE id = ?').run(newRole, target.id);

		this.logAudit(
			teamId,
			actorPubkey,
			'role_changed',
			memberPubkey,
			JSON.stringify({ from: target.role, to: newRole }),
		);

		// Invalidate sessions so the member reconnects with new permissions
		if (this.sessionManager) {
			this.sessionManager.removeMemberSessions(target.id);
		}
	}

	/**
	 * Transfer team ownership to another member.
	 * The current owner becomes an admin.
	 *
	 * @throws {NotFoundError} if team or new owner doesn't exist
	 * @throws {AuthorizationError} if actor is not the current owner
	 */
	transferOwnership(teamId: string, newOwnerPubkey: string, currentOwnerPubkey: string) {
		const team = this.getTeam(teamId);
		if (!team) {
			throw new NotFoundError(`Team "${teamId}" not found`);
		}

		const currentOwner = this.getMember(teamId, currentOwnerPubkey);
		if (!currentOwner || currentOwner.role !== 'owner') {
			throw new AuthorizationError('Only the current owner can transfer ownership');
		}

		if (currentOwnerPubkey === newOwnerPubkey) {
			throw new ValidationError('Cannot transfer ownership to yourself');
		}

		const newOwner = this.getMember(teamId, newOwnerPubkey);
		if (!newOwner) {
			throw new NotFoundError(`Member with pubkey "${newOwnerPubkey}" not found in team`);
		}

		// Perform the transfer atomically
		this.db.query('UPDATE members SET role = ? WHERE id = ?').run('admin', currentOwner.id);
		this.db.query('UPDATE members SET role = ? WHERE id = ?').run('owner', newOwner.id);

		this.logAudit(teamId, currentOwnerPubkey, 'ownership_transferred', newOwnerPubkey);

		// Invalidate sessions for both members so they reconnect with new roles
		if (this.sessionManager) {
			this.sessionManager.removeMemberSessions(currentOwner.id);
			this.sessionManager.removeMemberSessions(newOwner.id);
		}
	}

	// ─── Audit ──────────────────────────────────────────────────────────────

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
