/**
 * Audit event Nostr event builder for @redshift/bunker
 *
 * Creates Kind 30079 (addressable/parameterized replaceable) event templates
 * from audit records for publishing to Nostr relays. The event template is
 * unsigned — signing is delegated to the NIP-46 server.
 */

import type { EventTemplate } from 'nostr-tools/core';
import type { AuditEvent } from './types.js';

/** Kind 30079: Audit log event (addressable/parameterized replaceable) */
export const AUDIT_EVENT_KIND = 30079;

/**
 * Create a Kind 30079 Nostr event template from an audit record.
 *
 * The event is unsigned — the caller is responsible for signing it
 * via the NIP-46 server's sign_event method using the team's key.
 *
 * @param auditEvent - The audit event record from the database
 * @param teamSlug - The team's URL-safe slug for the d-tag
 * @returns An unsigned EventTemplate ready for signing
 */
export function createAuditEventTemplate(auditEvent: AuditEvent, teamSlug: string): EventTemplate {
	const content = JSON.stringify({
		action: auditEvent.action,
		target: auditEvent.target,
		metadata: auditEvent.metadata ? JSON.parse(auditEvent.metadata) : null,
		actorPubkey: auditEvent.actor_pubkey,
		timestamp: auditEvent.created_at,
	});

	return {
		kind: AUDIT_EVENT_KIND,
		content,
		created_at: Math.floor(Date.now() / 1000),
		tags: [
			['d', `${teamSlug}:${auditEvent.id}`],
			['t', 'redshift-audit'],
			['p', auditEvent.actor_pubkey],
			['a', auditEvent.action],
		],
	};
}
