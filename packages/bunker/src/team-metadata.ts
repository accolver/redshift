/**
 * Team metadata event creation for @redshift/bunker
 *
 * Creates Kind 30080 (addressable/parameterized replaceable) event templates
 * for team discovery on Nostr relays. The event template is unsigned —
 * signing is delegated to the NIP-46 server via the sign_event method.
 */

import type { Database } from 'bun:sqlite';
import type { EventTemplate } from 'nostr-tools/core';
import { NotFoundError } from './errors.js';
import type { Team } from './types.js';

/** Kind 30080: Team metadata (addressable/parameterized replaceable) */
const TEAM_METADATA_KIND = 30080;

/**
 * Create a team metadata event template for relay publishing.
 *
 * The event is unsigned — the caller is responsible for signing it
 * via the NIP-46 server's sign_event method using the team's key.
 *
 * @param teamId - The team to create metadata for
 * @param db - Database instance
 * @returns An unsigned EventTemplate ready for signing
 * @throws {NotFoundError} if team doesn't exist
 */
export function createTeamMetadataEvent(teamId: string, db: Database): EventTemplate {
	const team = db.query<Team, [string]>('SELECT * FROM teams WHERE id = ?').get(teamId);

	if (!team) {
		throw new NotFoundError(`Team "${teamId}" not found`);
	}

	// Count members
	const memberCount = db
		.query<{ count: number }, [string]>('SELECT COUNT(*) as count FROM members WHERE team_id = ?')
		.get(teamId);

	const content = JSON.stringify({
		name: team.name,
		memberCount: memberCount?.count ?? 0,
		createdAt: team.created_at,
	});

	return {
		kind: TEAM_METADATA_KIND,
		content,
		created_at: Math.floor(Date.now() / 1000),
		tags: [
			['d', team.slug],
			['p', team.pubkey],
			['t', 'redshift-team'],
		],
	};
}
