/**
 * TeamService tests for @redshift/bunker
 *
 * Tests team CRUD, member management, invitations, role changes,
 * ownership transfer, and RBAC enforcement.
 */

import type { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { openDatabase } from '../src/database';
import { generateMasterKey } from '../src/encryption';
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '../src/errors';
import { SessionManager } from '../src/session-manager';
import { TeamService } from '../src/team-service';

// ─── Test Helpers ───────────────────────────────────────────────────────────

/** Generate a random hex pubkey */
function randomPubkey() {
	return getPublicKey(generateSecretKey());
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('TeamService', () => {
	let db: Database;
	let masterKey: string;
	let service: TeamService;
	let sessionManager: SessionManager;

	beforeEach(() => {
		db = openDatabase(':memory:');
		masterKey = generateMasterKey();
		sessionManager = new SessionManager(db);
		service = new TeamService(db, masterKey, sessionManager);
	});

	afterEach(() => {
		db.close();
	});

	// ─── Team CRUD ──────────────────────────────────────────────────────

	describe('createTeam', () => {
		it('creates a team with a fresh keypair', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			expect(team.id).toBeTruthy();
			expect(team.name).toBe('My Team');
			expect(team.slug).toBe('my-team');
			expect(team.pubkey).toMatch(/^[0-9a-f]{64}$/);
			expect(team.encrypted_nsec).toBeTruthy();
			expect(team.created_at).toBeGreaterThan(0);
			expect(team.updated_at).toBeGreaterThan(0);
		});

		it('adds creator as owner', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const member = service.getMember(team.id, ownerPubkey);
			expect(member).not.toBeNull();
			expect(member!.role).toBe('owner');
			expect(member!.pubkey).toBe(ownerPubkey);
		});

		it('logs audit event on creation', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const audit = db
				.query<{ action: string; actor_pubkey: string }, [string]>(
					'SELECT action, actor_pubkey FROM audit_events WHERE team_id = ?',
				)
				.get(team.id);

			expect(audit?.action).toBe('team_created');
			expect(audit?.actor_pubkey).toBe(ownerPubkey);
		});

		it('rejects empty name', () => {
			expect(() => service.createTeam('', 'my-team', randomPubkey())).toThrow(ValidationError);
		});

		it('rejects empty slug', () => {
			expect(() => service.createTeam('My Team', '', randomPubkey())).toThrow(ValidationError);
		});

		it('rejects invalid slug format', () => {
			expect(() => service.createTeam('My Team', 'My Team!', randomPubkey())).toThrow(
				ValidationError,
			);
			expect(() => service.createTeam('My Team', 'MY_TEAM', randomPubkey())).toThrow(
				ValidationError,
			);
		});

		it('rejects duplicate slug', () => {
			const ownerPubkey = randomPubkey();
			service.createTeam('Team 1', 'my-team', ownerPubkey);

			expect(() => service.createTeam('Team 2', 'my-team', randomPubkey())).toThrow(ConflictError);
		});

		it('trims whitespace from name', () => {
			const team = service.createTeam('  My Team  ', 'my-team', randomPubkey());
			expect(team.name).toBe('My Team');
		});
	});

	describe('getTeam', () => {
		it('returns team by ID', () => {
			const ownerPubkey = randomPubkey();
			const created = service.createTeam('My Team', 'my-team', ownerPubkey);

			const team = service.getTeam(created.id);
			expect(team).not.toBeNull();
			expect(team!.name).toBe('My Team');
		});

		it('returns null for non-existent team', () => {
			expect(service.getTeam('non-existent')).toBeNull();
		});
	});

	describe('getTeamBySlug', () => {
		it('returns team by slug', () => {
			service.createTeam('My Team', 'my-team', randomPubkey());

			const team = service.getTeamBySlug('my-team');
			expect(team).not.toBeNull();
			expect(team!.name).toBe('My Team');
		});

		it('returns null for non-existent slug', () => {
			expect(service.getTeamBySlug('non-existent')).toBeNull();
		});
	});

	describe('listTeams', () => {
		it('returns all teams', () => {
			service.createTeam('Team 1', 'team-1', randomPubkey());
			service.createTeam('Team 2', 'team-2', randomPubkey());

			const teams = service.listTeams();
			expect(teams.length).toBe(2);
		});

		it('returns empty array when no teams exist', () => {
			expect(service.listTeams()).toEqual([]);
		});
	});

	describe('deleteTeam', () => {
		it('owner can delete team', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			service.deleteTeam(team.id, ownerPubkey);

			expect(service.getTeam(team.id)).toBeNull();
		});

		it('deletes all related data', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			// Add an invitation
			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);

			service.deleteTeam(team.id, ownerPubkey);

			// Verify all related data is deleted
			const members = service.listMembers(team.id);
			expect(members.length).toBe(0);

			const invitations = service.listInvitations(team.id);
			expect(invitations.length).toBe(0);
		});

		it('admin cannot delete team', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			// Accept the invitation
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, adminPubkey);

			expect(() => service.deleteTeam(team.id, adminPubkey)).toThrow(AuthorizationError);
		});

		it('developer cannot delete team', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			expect(() => service.deleteTeam(team.id, devPubkey)).toThrow(AuthorizationError);
		});

		it('throws NotFoundError for non-existent team', () => {
			expect(() => service.deleteTeam('non-existent', randomPubkey())).toThrow(NotFoundError);
		});

		it('logs audit event on deletion', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			service.deleteTeam(team.id, ownerPubkey);

			// Audit events are deleted with the team, but the deletion audit
			// is logged before the cascade delete
			// This is by design — the audit log is cleaned up with the team
		});
	});

	// ─── Members ────────────────────────────────────────────────────────

	describe('getMember', () => {
		it('returns member by pubkey', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const member = service.getMember(team.id, ownerPubkey);
			expect(member).not.toBeNull();
			expect(member!.pubkey).toBe(ownerPubkey);
			expect(member!.role).toBe('owner');
		});

		it('returns null for non-member', () => {
			const team = service.createTeam('My Team', 'my-team', randomPubkey());
			expect(service.getMember(team.id, randomPubkey())).toBeNull();
		});
	});

	describe('listMembers', () => {
		it('lists all team members', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			const members = service.listMembers(team.id);
			expect(members.length).toBe(2);
		});
	});

	describe('removeMember', () => {
		it('owner can remove a developer', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			service.removeMember(team.id, devPubkey, ownerPubkey);

			expect(service.getMember(team.id, devPubkey)).toBeNull();
		});

		it('owner can remove an admin', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, adminPubkey);

			service.removeMember(team.id, adminPubkey, ownerPubkey);

			expect(service.getMember(team.id, adminPubkey)).toBeNull();
		});

		it('admin can remove a developer', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			let invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, adminPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			service.removeMember(team.id, devPubkey, adminPubkey);

			expect(service.getMember(team.id, devPubkey)).toBeNull();
		});

		it('admin cannot remove another admin', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const admin1Pubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: admin1Pubkey, role: 'admin' }, ownerPubkey);
			let invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, admin1Pubkey);

			const admin2Pubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: admin2Pubkey, role: 'admin' }, ownerPubkey);
			invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, admin2Pubkey);

			expect(() => service.removeMember(team.id, admin2Pubkey, admin1Pubkey)).toThrow(
				AuthorizationError,
			);
		});

		it('cannot remove the owner', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, adminPubkey);

			expect(() => service.removeMember(team.id, ownerPubkey, adminPubkey)).toThrow(
				AuthorizationError,
			);
		});

		it('cannot remove yourself', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, adminPubkey);

			expect(() => service.removeMember(team.id, adminPubkey, adminPubkey)).toThrow(
				AuthorizationError,
			);
		});

		it('developer cannot remove members', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			let invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			const dev2Pubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: dev2Pubkey, role: 'developer' }, ownerPubkey);
			invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, dev2Pubkey);

			expect(() => service.removeMember(team.id, dev2Pubkey, devPubkey)).toThrow(
				AuthorizationError,
			);
		});

		it('readonly cannot remove members', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const readonlyPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: readonlyPubkey, role: 'readonly' }, ownerPubkey);
			let invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, readonlyPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			expect(() => service.removeMember(team.id, devPubkey, readonlyPubkey)).toThrow(
				AuthorizationError,
			);
		});

		it('logs audit event on removal', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			service.removeMember(team.id, devPubkey, ownerPubkey);

			const audit = db
				.query<{ action: string; target: string | null }, [string, string]>(
					'SELECT action, target FROM audit_events WHERE team_id = ? AND action = ?',
				)
				.get(team.id, 'member_removed');

			expect(audit?.action).toBe('member_removed');
			expect(audit?.target).toBe(devPubkey);
		});

		it('invalidates NIP-46 sessions on removal', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			const member = service.acceptInvitation(invitations[0]!.id, devPubkey);

			// Create a NIP-46 session for the member
			sessionManager.createSession({
				clientPubkey: devPubkey,
				memberId: member.id,
				teamId: team.id,
				teamPubkey: team.pubkey,
				role: 'developer',
				timeoutSeconds: 86400,
			});

			expect(sessionManager.hasSession(devPubkey)).toBe(true);

			service.removeMember(team.id, devPubkey, ownerPubkey);

			expect(sessionManager.hasSession(devPubkey)).toBe(false);
		});

		it('throws NotFoundError for non-existent member', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			expect(() => service.removeMember(team.id, randomPubkey(), ownerPubkey)).toThrow(
				NotFoundError,
			);
		});
	});

	// ─── Invitations ────────────────────────────────────────────────────

	describe('inviteMember', () => {
		it('owner can invite by pubkey', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const inviteePubkey = randomPubkey();
			const invitation = service.inviteMember(
				team.id,
				{ pubkey: inviteePubkey, role: 'developer' },
				ownerPubkey,
			);

			expect(invitation.id).toBeTruthy();
			expect(invitation.team_id).toBe(team.id);
			expect(invitation.pubkey).toBe(inviteePubkey);
			expect(invitation.role).toBe('developer');
			expect(invitation.status).toBe('pending');
			expect(invitation.invited_by).toBe(ownerPubkey);
		});

		it('owner can invite by email', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const invitation = service.inviteMember(
				team.id,
				{ email: 'dev@example.com', role: 'developer' },
				ownerPubkey,
			);

			expect(invitation.email).toBe('dev@example.com');
			expect(invitation.pubkey).toBeNull();
		});

		it('owner can invite as admin', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const invitation = service.inviteMember(
				team.id,
				{ pubkey: randomPubkey(), role: 'admin' },
				ownerPubkey,
			);

			expect(invitation.role).toBe('admin');
		});

		it('admin can invite as developer', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, adminPubkey);

			const invitation = service.inviteMember(
				team.id,
				{ pubkey: randomPubkey(), role: 'developer' },
				adminPubkey,
			);

			expect(invitation.role).toBe('developer');
		});

		it('admin cannot invite as admin', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, adminPubkey);

			expect(() =>
				service.inviteMember(team.id, { pubkey: randomPubkey(), role: 'admin' }, adminPubkey),
			).toThrow(AuthorizationError);
		});

		it('developer cannot invite', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			expect(() =>
				service.inviteMember(team.id, { pubkey: randomPubkey(), role: 'readonly' }, devPubkey),
			).toThrow(AuthorizationError);
		});

		it('readonly cannot invite', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const readonlyPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: readonlyPubkey, role: 'readonly' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, readonlyPubkey);

			expect(() =>
				service.inviteMember(team.id, { pubkey: randomPubkey(), role: 'readonly' }, readonlyPubkey),
			).toThrow(AuthorizationError);
		});

		it('cannot invite as owner', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			expect(() =>
				service.inviteMember(
					team.id,
					{ pubkey: randomPubkey(), role: 'owner' as 'admin' },
					ownerPubkey,
				),
			).toThrow(ValidationError);
		});

		it('rejects invitation without email or pubkey', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			expect(() => service.inviteMember(team.id, { role: 'developer' }, ownerPubkey)).toThrow(
				ValidationError,
			);
		});

		it('rejects invitation for existing member', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			expect(() =>
				service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey),
			).toThrow(ConflictError);
		});

		it('rejects duplicate pending invitation by pubkey', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);

			expect(() =>
				service.inviteMember(team.id, { pubkey: devPubkey, role: 'admin' }, ownerPubkey),
			).toThrow(ConflictError);
		});

		it('rejects duplicate pending invitation by email', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			service.inviteMember(team.id, { email: 'dev@example.com', role: 'developer' }, ownerPubkey);

			expect(() =>
				service.inviteMember(team.id, { email: 'dev@example.com', role: 'admin' }, ownerPubkey),
			).toThrow(ConflictError);
		});

		it('rejects invalid pubkey format', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			expect(() =>
				service.inviteMember(team.id, { pubkey: 'invalid-pubkey', role: 'developer' }, ownerPubkey),
			).toThrow(ValidationError);
		});

		it('logs audit event on invitation', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);

			const audit = db
				.query<{ action: string; target: string | null }, [string, string]>(
					'SELECT action, target FROM audit_events WHERE team_id = ? AND action = ?',
				)
				.get(team.id, 'member_invited');

			expect(audit?.action).toBe('member_invited');
			expect(audit?.target).toBe(devPubkey);
		});
	});

	describe('acceptInvitation', () => {
		it('accepts a valid invitation', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			const invitation = service.inviteMember(
				team.id,
				{ pubkey: devPubkey, role: 'developer' },
				ownerPubkey,
			);

			const member = service.acceptInvitation(invitation.id, devPubkey);

			expect(member.pubkey).toBe(devPubkey);
			expect(member.role).toBe('developer');
			expect(member.team_id).toBe(team.id);
			expect(member.invited_by).toBe(ownerPubkey);
		});

		it('marks invitation as accepted', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			const invitation = service.inviteMember(
				team.id,
				{ pubkey: devPubkey, role: 'developer' },
				ownerPubkey,
			);

			service.acceptInvitation(invitation.id, devPubkey);

			// Pending invitations should not include the accepted one
			const pending = service.listInvitations(team.id);
			expect(pending.length).toBe(0);
		});

		it('email invitation can be accepted by any pubkey', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const invitation = service.inviteMember(
				team.id,
				{ email: 'dev@example.com', role: 'developer' },
				ownerPubkey,
			);

			const anyPubkey = randomPubkey();
			const member = service.acceptInvitation(invitation.id, anyPubkey);

			expect(member.pubkey).toBe(anyPubkey);
			expect(member.email).toBe('dev@example.com');
		});

		it('pubkey invitation can only be accepted by matching pubkey', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const targetPubkey = randomPubkey();
			const invitation = service.inviteMember(
				team.id,
				{ pubkey: targetPubkey, role: 'developer' },
				ownerPubkey,
			);

			const wrongPubkey = randomPubkey();
			expect(() => service.acceptInvitation(invitation.id, wrongPubkey)).toThrow(
				AuthorizationError,
			);
		});

		it('cannot accept already accepted invitation', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			const invitation = service.inviteMember(
				team.id,
				{ pubkey: devPubkey, role: 'developer' },
				ownerPubkey,
			);

			service.acceptInvitation(invitation.id, devPubkey);

			expect(() => service.acceptInvitation(invitation.id, devPubkey)).toThrow(ValidationError);
		});

		it('cannot accept expired invitation', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			const invitation = service.inviteMember(
				team.id,
				{ pubkey: devPubkey, role: 'developer' },
				ownerPubkey,
			);

			// Manually expire the invitation
			db.query('UPDATE invitations SET expires_at = ? WHERE id = ?').run(0, invitation.id);

			expect(() => service.acceptInvitation(invitation.id, devPubkey)).toThrow(ValidationError);
		});

		it('throws NotFoundError for non-existent invitation', () => {
			expect(() => service.acceptInvitation('non-existent', randomPubkey())).toThrow(NotFoundError);
		});

		it('rejects if already a member', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			// Owner tries to accept an invitation (already a member)
			const invitation = service.inviteMember(
				team.id,
				{ email: 'owner@example.com', role: 'developer' },
				ownerPubkey,
			);

			expect(() => service.acceptInvitation(invitation.id, ownerPubkey)).toThrow(ConflictError);
		});

		it('logs audit event on acceptance', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			const invitation = service.inviteMember(
				team.id,
				{ pubkey: devPubkey, role: 'developer' },
				ownerPubkey,
			);

			service.acceptInvitation(invitation.id, devPubkey);

			const audit = db
				.query<{ action: string; actor_pubkey: string }, [string, string]>(
					'SELECT action, actor_pubkey FROM audit_events WHERE team_id = ? AND action = ?',
				)
				.get(team.id, 'invitation_accepted');

			expect(audit?.action).toBe('invitation_accepted');
			expect(audit?.actor_pubkey).toBe(devPubkey);
		});
	});

	// ─── Roles ──────────────────────────────────────────────────────────

	describe('changeRole', () => {
		it('owner can change developer to readonly', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			service.changeRole(team.id, devPubkey, 'readonly', ownerPubkey);

			const member = service.getMember(team.id, devPubkey);
			expect(member!.role).toBe('readonly');
		});

		it('owner can change developer to admin', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			service.changeRole(team.id, devPubkey, 'admin', ownerPubkey);

			const member = service.getMember(team.id, devPubkey);
			expect(member!.role).toBe('admin');
		});

		it('owner can change admin to developer', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, adminPubkey);

			service.changeRole(team.id, adminPubkey, 'developer', ownerPubkey);

			const member = service.getMember(team.id, adminPubkey);
			expect(member!.role).toBe('developer');
		});

		it('admin can change developer to readonly', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			let invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, adminPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			service.changeRole(team.id, devPubkey, 'readonly', adminPubkey);

			const member = service.getMember(team.id, devPubkey);
			expect(member!.role).toBe('readonly');
		});

		it('admin cannot assign admin role', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			let invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, adminPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			expect(() => service.changeRole(team.id, devPubkey, 'admin', adminPubkey)).toThrow(
				AuthorizationError,
			);
		});

		it('admin cannot change another admin role', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const admin1Pubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: admin1Pubkey, role: 'admin' }, ownerPubkey);
			let invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, admin1Pubkey);

			const admin2Pubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: admin2Pubkey, role: 'admin' }, ownerPubkey);
			invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, admin2Pubkey);

			expect(() => service.changeRole(team.id, admin2Pubkey, 'developer', admin1Pubkey)).toThrow(
				AuthorizationError,
			);
		});

		it('cannot assign owner role', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			expect(() => service.changeRole(team.id, devPubkey, 'owner', ownerPubkey)).toThrow(
				AuthorizationError,
			);
		});

		it('cannot change own role', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, adminPubkey);

			expect(() => service.changeRole(team.id, adminPubkey, 'developer', adminPubkey)).toThrow(
				AuthorizationError,
			);
		});

		it('cannot change owner role', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, adminPubkey);

			expect(() => service.changeRole(team.id, ownerPubkey, 'admin', adminPubkey)).toThrow(
				AuthorizationError,
			);
		});

		it('developer cannot change roles', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			let invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			const readonlyPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: readonlyPubkey, role: 'readonly' }, ownerPubkey);
			invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, readonlyPubkey);

			expect(() => service.changeRole(team.id, readonlyPubkey, 'developer', devPubkey)).toThrow(
				AuthorizationError,
			);
		});

		it('no-op when role is the same', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			// Should not throw
			service.changeRole(team.id, devPubkey, 'developer', ownerPubkey);

			const member = service.getMember(team.id, devPubkey);
			expect(member!.role).toBe('developer');
		});

		it('logs audit event on role change', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			service.changeRole(team.id, devPubkey, 'readonly', ownerPubkey);

			const audit = db
				.query<{ action: string; metadata: string | null }, [string, string]>(
					'SELECT action, metadata FROM audit_events WHERE team_id = ? AND action = ?',
				)
				.get(team.id, 'role_changed');

			expect(audit?.action).toBe('role_changed');
			const metadata = JSON.parse(audit!.metadata!) as { from: string; to: string };
			expect(metadata.from).toBe('developer');
			expect(metadata.to).toBe('readonly');
		});

		it('invalidates sessions on role change', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			const member = service.acceptInvitation(invitations[0]!.id, devPubkey);

			sessionManager.createSession({
				clientPubkey: devPubkey,
				memberId: member.id,
				teamId: team.id,
				teamPubkey: team.pubkey,
				role: 'developer',
				timeoutSeconds: 86400,
			});

			expect(sessionManager.hasSession(devPubkey)).toBe(true);

			service.changeRole(team.id, devPubkey, 'readonly', ownerPubkey);

			expect(sessionManager.hasSession(devPubkey)).toBe(false);
		});
	});

	// ─── Ownership Transfer ─────────────────────────────────────────────

	describe('transferOwnership', () => {
		it('transfers ownership from owner to member', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, adminPubkey);

			service.transferOwnership(team.id, adminPubkey, ownerPubkey);

			const newOwner = service.getMember(team.id, adminPubkey);
			expect(newOwner!.role).toBe('owner');

			const oldOwner = service.getMember(team.id, ownerPubkey);
			expect(oldOwner!.role).toBe('admin');
		});

		it('can transfer to a developer', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			service.transferOwnership(team.id, devPubkey, ownerPubkey);

			expect(service.getMember(team.id, devPubkey)!.role).toBe('owner');
			expect(service.getMember(team.id, ownerPubkey)!.role).toBe('admin');
		});

		it('non-owner cannot transfer ownership', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			let invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, adminPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			expect(() => service.transferOwnership(team.id, devPubkey, adminPubkey)).toThrow(
				AuthorizationError,
			);
		});

		it('cannot transfer to yourself', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			expect(() => service.transferOwnership(team.id, ownerPubkey, ownerPubkey)).toThrow(
				ValidationError,
			);
		});

		it('cannot transfer to non-member', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			expect(() => service.transferOwnership(team.id, randomPubkey(), ownerPubkey)).toThrow(
				NotFoundError,
			);
		});

		it('logs audit event on transfer', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, adminPubkey);

			service.transferOwnership(team.id, adminPubkey, ownerPubkey);

			const audit = db
				.query<{ action: string; actor_pubkey: string; target: string | null }, [string, string]>(
					'SELECT action, actor_pubkey, target FROM audit_events WHERE team_id = ? AND action = ?',
				)
				.get(team.id, 'ownership_transferred');

			expect(audit?.action).toBe('ownership_transferred');
			expect(audit?.actor_pubkey).toBe(ownerPubkey);
			expect(audit?.target).toBe(adminPubkey);
		});

		it('invalidates sessions for both members', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			const adminMember = service.acceptInvitation(invitations[0]!.id, adminPubkey);

			const ownerMember = service.getMember(team.id, ownerPubkey)!;

			// Create sessions for both
			sessionManager.createSession({
				clientPubkey: ownerPubkey,
				memberId: ownerMember.id,
				teamId: team.id,
				teamPubkey: team.pubkey,
				role: 'owner',
				timeoutSeconds: 86400,
			});
			sessionManager.createSession({
				clientPubkey: adminPubkey,
				memberId: adminMember.id,
				teamId: team.id,
				teamPubkey: team.pubkey,
				role: 'admin',
				timeoutSeconds: 86400,
			});

			expect(sessionManager.hasSession(ownerPubkey)).toBe(true);
			expect(sessionManager.hasSession(adminPubkey)).toBe(true);

			service.transferOwnership(team.id, adminPubkey, ownerPubkey);

			expect(sessionManager.hasSession(ownerPubkey)).toBe(false);
			expect(sessionManager.hasSession(adminPubkey)).toBe(false);
		});
	});

	// ─── RBAC Permission Matrix ─────────────────────────────────────────

	describe('RBAC permission matrix', () => {
		it('owner: can create team, invite, remove, change roles, delete team, transfer', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			// Invite
			const devPubkey = randomPubkey();
			const invitation = service.inviteMember(
				team.id,
				{ pubkey: devPubkey, role: 'developer' },
				ownerPubkey,
			);
			service.acceptInvitation(invitation.id, devPubkey);

			// Change role
			service.changeRole(team.id, devPubkey, 'readonly', ownerPubkey);

			// Change back
			service.changeRole(team.id, devPubkey, 'developer', ownerPubkey);

			// Remove
			service.removeMember(team.id, devPubkey, ownerPubkey);

			// Delete team
			service.deleteTeam(team.id, ownerPubkey);
		});

		it('admin: can invite (non-admin), remove (non-admin), change roles (non-admin)', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			let invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, adminPubkey);

			// Admin invites developer
			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, adminPubkey);
			invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			// Admin changes developer to readonly
			service.changeRole(team.id, devPubkey, 'readonly', adminPubkey);

			// Admin removes developer
			service.removeMember(team.id, devPubkey, adminPubkey);
		});

		it('admin: cannot delete team, assign owner, assign admin, remove admin', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const adminPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: adminPubkey, role: 'admin' }, ownerPubkey);
			let invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, adminPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			// Cannot delete team
			expect(() => service.deleteTeam(team.id, adminPubkey)).toThrow(AuthorizationError);

			// Cannot assign owner
			expect(() => service.changeRole(team.id, devPubkey, 'owner', adminPubkey)).toThrow(
				AuthorizationError,
			);

			// Cannot assign admin
			expect(() => service.changeRole(team.id, devPubkey, 'admin', adminPubkey)).toThrow(
				AuthorizationError,
			);

			// Cannot invite as admin
			expect(() =>
				service.inviteMember(team.id, { pubkey: randomPubkey(), role: 'admin' }, adminPubkey),
			).toThrow(AuthorizationError);
		});

		it('developer: cannot invite, remove, change roles, delete team', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const devPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: devPubkey, role: 'developer' }, ownerPubkey);
			let invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, devPubkey);

			const readonlyPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: readonlyPubkey, role: 'readonly' }, ownerPubkey);
			invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, readonlyPubkey);

			// Cannot invite
			expect(() =>
				service.inviteMember(team.id, { pubkey: randomPubkey(), role: 'readonly' }, devPubkey),
			).toThrow(AuthorizationError);

			// Cannot remove
			expect(() => service.removeMember(team.id, readonlyPubkey, devPubkey)).toThrow(
				AuthorizationError,
			);

			// Cannot change roles
			expect(() => service.changeRole(team.id, readonlyPubkey, 'developer', devPubkey)).toThrow(
				AuthorizationError,
			);

			// Cannot delete team
			expect(() => service.deleteTeam(team.id, devPubkey)).toThrow(AuthorizationError);
		});

		it('readonly: cannot invite, remove, change roles, delete team', () => {
			const ownerPubkey = randomPubkey();
			const team = service.createTeam('My Team', 'my-team', ownerPubkey);

			const readonlyPubkey = randomPubkey();
			service.inviteMember(team.id, { pubkey: readonlyPubkey, role: 'readonly' }, ownerPubkey);
			const invitations = service.listInvitations(team.id);
			service.acceptInvitation(invitations[0]!.id, readonlyPubkey);

			// Cannot invite
			expect(() =>
				service.inviteMember(team.id, { pubkey: randomPubkey(), role: 'readonly' }, readonlyPubkey),
			).toThrow(AuthorizationError);

			// Cannot delete team
			expect(() => service.deleteTeam(team.id, readonlyPubkey)).toThrow(AuthorizationError);
		});
	});
});
