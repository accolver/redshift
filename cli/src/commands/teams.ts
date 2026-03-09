/**
 * Teams Command - Manage teams via bunker admin API
 *
 * L5: Journey-Validator - Team management workflow
 * L4: Integration-Contractor - Bunker admin API integration
 */

import { loadConfig } from '../lib/config';
import type { AuditEvent, Invitation, KeyRotationResult, Member, Team } from '../lib/teams-api';
import { TeamsApiClient } from '../lib/teams-api';
import { requireAuth } from './login';

export type TeamsSubcommand =
	| 'create'
	| 'list'
	| 'members'
	| 'invite'
	| 'remove'
	| 'rotate-key'
	| 'audit'
	| 'audit-summary';

export interface TeamsOptions {
	subcommand: TeamsSubcommand;
	/** Positional arguments (team-id, pubkey, name, etc.) */
	positionals: string[];
	/** Team slug for create */
	slug?: string | undefined;
	/** Email for invite */
	email?: string | undefined;
	/** Pubkey for invite */
	pubkey?: string | undefined;
	/** Role for invite */
	role?: string | undefined;
	/** JSON output */
	json?: boolean | undefined;
	/** Audit: filter by actor pubkey */
	actor?: string | undefined;
	/** Audit: filter by action type */
	action?: string | undefined;
	/** Audit: only events after this Unix timestamp */
	since?: number | undefined;
	/** Audit: only events before this Unix timestamp */
	until?: number | undefined;
	/** Audit: max results */
	limit?: number | undefined;
	/** Audit: pagination offset */
	offset?: number | undefined;
}

/**
 * Get the bunker URL from config or environment.
 * Exits with error if not configured.
 */
async function getBunkerUrl() {
	const envUrl = process.env.REDSHIFT_BUNKER_URL;
	if (envUrl) {
		return envUrl;
	}

	const config = await loadConfig();
	if (config.bunkerUrl) {
		return config.bunkerUrl;
	}

	console.error('Error: Bunker URL not configured.');
	console.error('Set it with: redshift configure set bunkerUrl=https://bunker.example.com');
	console.error('Or set REDSHIFT_BUNKER_URL environment variable.');
	process.exit(1);
}

/**
 * Execute the teams command.
 */
export async function teamsCommand(options: TeamsOptions) {
	const auth = await requireAuth();
	const bunkerUrl = await getBunkerUrl();
	const client = new TeamsApiClient(bunkerUrl, auth.signer);

	try {
		switch (options.subcommand) {
			case 'create':
				await createTeam(client, options);
				break;
			case 'list':
				await listTeams(client, options);
				break;
			case 'members':
				await listMembers(client, options);
				break;
			case 'invite':
				await inviteMember(client, options);
				break;
			case 'remove':
				await removeMember(client, options);
				break;
			case 'rotate-key':
				await rotateKey(client, options);
				break;
			case 'audit':
				await queryAuditLog(client, options);
				break;
			case 'audit-summary':
				await getAuditSummary(client, options);
				break;
			default:
				console.error(`Unknown subcommand: ${options.subcommand}`);
				console.error(
					'Available: create, list, members, invite, remove, rotate-key, audit, audit-summary',
				);
				process.exit(1);
		}
	} catch (error) {
		console.error('Error:', error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

/**
 * Create a new team.
 */
async function createTeam(client: TeamsApiClient, options: TeamsOptions) {
	const name = options.positionals[0];
	if (!name) {
		console.error('Error: Team name is required.');
		console.error('Usage: redshift teams create <name> --slug <slug>');
		process.exit(1);
	}

	if (!options.slug) {
		console.error('Error: --slug is required.');
		console.error('Usage: redshift teams create <name> --slug <slug>');
		process.exit(1);
	}

	const team = await client.createTeam(name, options.slug);

	if (options.json) {
		console.log(JSON.stringify(team, null, 2));
	} else {
		console.log('✓ Team created successfully!');
		console.log(`  Name:   ${team.name}`);
		console.log(`  Slug:   ${team.slug}`);
		console.log(`  Pubkey: ${team.pubkey}`);
	}
}

/**
 * List all teams.
 */
async function listTeams(client: TeamsApiClient, options: TeamsOptions) {
	const teams = await client.listTeams();

	if (options.json) {
		console.log(JSON.stringify(teams, null, 2));
		return;
	}

	if (teams.length === 0) {
		console.log('No teams found.');
		return;
	}

	printTeamsTable(teams);
}

/**
 * List members of a team.
 */
async function listMembers(client: TeamsApiClient, options: TeamsOptions) {
	const teamId = options.positionals[0];
	if (!teamId) {
		console.error('Error: Team ID is required.');
		console.error('Usage: redshift teams members <team-id>');
		process.exit(1);
	}

	const members = await client.listMembers(teamId);

	if (options.json) {
		console.log(JSON.stringify(members, null, 2));
		return;
	}

	if (members.length === 0) {
		console.log('No members found.');
		return;
	}

	printMembersTable(members);
}

/**
 * Invite a member to a team.
 */
async function inviteMember(client: TeamsApiClient, options: TeamsOptions) {
	const teamId = options.positionals[0];
	if (!teamId) {
		console.error('Error: Team ID is required.');
		console.error('Usage: redshift teams invite <team-id> --email <email> --role <role>');
		process.exit(1);
	}

	if (!options.email && !options.pubkey) {
		console.error('Error: Either --email or --pubkey is required.');
		process.exit(1);
	}

	if (!options.role) {
		console.error('Error: --role is required (admin, developer, readonly).');
		process.exit(1);
	}

	const validRoles = ['admin', 'developer', 'readonly'];
	if (!validRoles.includes(options.role)) {
		console.error(
			`Error: Invalid role '${options.role}'. Must be one of: ${validRoles.join(', ')}`,
		);
		process.exit(1);
	}

	const invitation = await client.inviteMember(teamId, {
		email: options.email,
		pubkey: options.pubkey,
		role: options.role,
	});

	if (options.json) {
		console.log(JSON.stringify(invitation, null, 2));
	} else {
		printInvitationResult(invitation);
	}
}

/**
 * Remove a member from a team.
 */
async function removeMember(client: TeamsApiClient, options: TeamsOptions) {
	const teamId = options.positionals[0];
	const pubkey = options.positionals[1];

	if (!teamId || !pubkey) {
		console.error('Error: Team ID and pubkey are required.');
		console.error('Usage: redshift teams remove <team-id> <pubkey>');
		process.exit(1);
	}

	await client.removeMember(teamId, pubkey);

	if (options.json) {
		console.log(JSON.stringify({ success: true, teamId, pubkey }));
	} else {
		console.log(`✓ Removed ${truncatePubkey(pubkey)} from team.`);
	}
}

/**
 * Rotate a team's signing key.
 */
async function rotateKey(client: TeamsApiClient, options: TeamsOptions) {
	const teamId = options.positionals[0];
	if (!teamId) {
		console.error('Error: Team ID is required.');
		console.error('Usage: redshift teams rotate-key <team-id>');
		process.exit(1);
	}

	const result = await client.rotateKey(teamId);

	if (options.json) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		printKeyRotationResult(result);
	}
}

/**
 * Query the audit log for a team.
 */
async function queryAuditLog(client: TeamsApiClient, options: TeamsOptions) {
	const teamId = options.positionals[0];
	if (!teamId) {
		console.error('Error: Team ID is required.');
		console.error('Usage: redshift teams audit <team-id>');
		process.exit(1);
	}

	const result = await client.queryAuditLog(teamId, {
		actor: options.actor,
		action: options.action,
		since: options.since,
		until: options.until,
		limit: options.limit,
		offset: options.offset,
	});

	if (options.json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}

	if (result.events.length === 0) {
		console.log('No audit events found.');
		return;
	}

	printAuditTable(result.events);

	if (result.hasMore) {
		console.log(
			`\nShowing ${result.events.length} of ${result.total} events. Use --offset to paginate.`,
		);
	}
}

/**
 * Get audit summary for a team.
 */
async function getAuditSummary(client: TeamsApiClient, options: TeamsOptions) {
	const teamId = options.positionals[0];
	if (!teamId) {
		console.error('Error: Team ID is required.');
		console.error('Usage: redshift teams audit-summary <team-id>');
		process.exit(1);
	}

	const result = await client.getAuditSummary(teamId);

	if (options.json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}

	const entries = Object.entries(result.counts);
	if (entries.length === 0) {
		console.log('No audit events found.');
		return;
	}

	printAuditSummaryTable(entries);
}

// ============================================================================
// Output Formatting
// ============================================================================

/**
 * Truncate a pubkey for display (first 8 + last 4 chars).
 */
function truncatePubkey(pubkey: string) {
	if (pubkey.length <= 16) {
		return pubkey;
	}
	return `${pubkey.substring(0, 8)}...${pubkey.substring(pubkey.length - 4)}`;
}

/**
 * Format a date string for table display.
 */
function formatDate(dateStr: string) {
	try {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	} catch {
		return dateStr;
	}
}

/**
 * Print teams in table format.
 */
function printTeamsTable(teams: Team[]) {
	const nameWidth = Math.max(4, ...teams.map((t) => t.name.length));
	const slugWidth = Math.max(4, ...teams.map((t) => t.slug.length));
	const pubkeyWidth = 15;
	const membersWidth = 7;
	const createdWidth = 12;

	// Header
	console.log(
		`${'NAME'.padEnd(nameWidth)}  ${'SLUG'.padEnd(slugWidth)}  ${'PUBKEY'.padEnd(pubkeyWidth)}  ${'MEMBERS'.padEnd(membersWidth)}  CREATED`,
	);
	console.log(
		`${'-'.repeat(nameWidth)}  ${'-'.repeat(slugWidth)}  ${'-'.repeat(pubkeyWidth)}  ${'-'.repeat(membersWidth)}  ${'-'.repeat(createdWidth)}`,
	);

	// Rows
	for (const team of teams) {
		console.log(
			`${team.name.padEnd(nameWidth)}  ${team.slug.padEnd(slugWidth)}  ${truncatePubkey(team.pubkey).padEnd(pubkeyWidth)}  ${String(team.memberCount).padEnd(membersWidth)}  ${formatDate(team.createdAt)}`,
		);
	}
}

/**
 * Print members in table format.
 */
function printMembersTable(members: Member[]) {
	const pubkeyWidth = 15;
	const roleWidth = Math.max(4, ...members.map((m) => m.role.length));
	const emailWidth = Math.max(5, ...members.map((m) => (m.email || '-').length));
	const joinedWidth = 12;

	// Header
	console.log(
		`${'PUBKEY'.padEnd(pubkeyWidth)}  ${'ROLE'.padEnd(roleWidth)}  ${'EMAIL'.padEnd(emailWidth)}  JOINED`,
	);
	console.log(
		`${'-'.repeat(pubkeyWidth)}  ${'-'.repeat(roleWidth)}  ${'-'.repeat(emailWidth)}  ${'-'.repeat(joinedWidth)}`,
	);

	// Rows
	for (const member of members) {
		console.log(
			`${truncatePubkey(member.pubkey).padEnd(pubkeyWidth)}  ${member.role.padEnd(roleWidth)}  ${(member.email || '-').padEnd(emailWidth)}  ${formatDate(member.joinedAt)}`,
		);
	}
}

/**
 * Print invitation result.
 */
function printInvitationResult(invitation: Invitation) {
	console.log('✓ Invitation sent!');
	if (invitation.email) {
		console.log(`  Email:  ${invitation.email}`);
	}
	if (invitation.pubkey) {
		console.log(`  Pubkey: ${truncatePubkey(invitation.pubkey)}`);
	}
	console.log(`  Role:   ${invitation.role}`);
	console.log(`  Status: ${invitation.status}`);
}

/**
 * Print key rotation result.
 */
function printKeyRotationResult(result: KeyRotationResult) {
	console.log('✓ Team key rotated successfully!');
	console.log(`  Old pubkey: ${truncatePubkey(result.oldPubkey)}`);
	console.log(`  New pubkey: ${truncatePubkey(result.newPubkey)}`);
}

/**
 * Format a Unix timestamp for audit table display.
 */
function formatTimestamp(unixTimestamp: number) {
	return new Date(unixTimestamp * 1000).toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Truncate a pubkey for audit display (first 12 chars + ..).
 */
function truncateAuditPubkey(pubkey: string) {
	if (pubkey.length <= 14) {
		return pubkey;
	}
	return `${pubkey.substring(0, 12)}..`;
}

/**
 * Print audit events in table format.
 */
function printAuditTable(events: AuditEvent[]) {
	const timeWidth = 19;
	const actorWidth = 14;
	const actionWidth = Math.max(6, ...events.map((e) => e.action.length));
	const targetWidth = Math.max(6, ...events.map((e) => (e.target || '-').length));

	// Header
	console.log(
		`${'TIME'.padEnd(timeWidth)}  ${'ACTOR'.padEnd(actorWidth)}  ${'ACTION'.padEnd(actionWidth)}  TARGET`,
	);
	console.log(
		`${'-'.repeat(timeWidth)}  ${'-'.repeat(actorWidth)}  ${'-'.repeat(actionWidth)}  ${'-'.repeat(targetWidth)}`,
	);

	// Rows
	for (const event of events) {
		console.log(
			`${formatTimestamp(event.created_at).padEnd(timeWidth)}  ${truncateAuditPubkey(event.actor_pubkey).padEnd(actorWidth)}  ${event.action.padEnd(actionWidth)}  ${event.target || '-'}`,
		);
	}
}

/**
 * Print audit summary in table format.
 */
function printAuditSummaryTable(entries: [string, number][]) {
	const actionWidth = Math.max(6, ...entries.map(([action]) => action.length));
	const countWidth = 5;

	// Header
	console.log(`${'ACTION'.padEnd(actionWidth)}  COUNT`);
	console.log(`${'-'.repeat(actionWidth)}  ${'-'.repeat(countWidth)}`);

	// Rows (sorted by count descending)
	const sorted = [...entries].sort((a, b) => b[1] - a[1]);
	for (const [action, count] of sorted) {
		console.log(`${action.padEnd(actionWidth)}  ${count}`);
	}
}
