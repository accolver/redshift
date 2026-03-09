/**
 * Audit event builder tests for @redshift/bunker
 *
 * Tests Kind 30079 audit event creation for relay publishing.
 */

import { describe, expect, it } from 'bun:test';
import { AUDIT_EVENT_KIND, createAuditEventTemplate } from '../src/audit-event-builder';
import type { AuditEvent } from '../src/types';

// ─── Test Helpers ───────────────────────────────────────────────────────────

/** Create a mock audit event */
function createMockAuditEvent(overrides?: Partial<AuditEvent>): AuditEvent {
	return {
		id: 'event-123',
		team_id: 'team-456',
		actor_pubkey: 'a'.repeat(64),
		action: 'member_invited',
		target: 'b'.repeat(64),
		metadata: null,
		created_at: 1700000000,
		...overrides,
	};
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AUDIT_EVENT_KIND', () => {
	it('is 30079', () => {
		expect(AUDIT_EVENT_KIND).toBe(30079);
	});
});

describe('createAuditEventTemplate', () => {
	it('creates a Kind 30079 event template', () => {
		const auditEvent = createMockAuditEvent();
		const event = createAuditEventTemplate(auditEvent, 'my-team');

		expect(event.kind).toBe(30079);
	});

	it('uses teamSlug:eventId as d-tag', () => {
		const auditEvent = createMockAuditEvent({ id: 'evt-abc' });
		const event = createAuditEventTemplate(auditEvent, 'my-team');

		const dTag = event.tags.find((t) => t[0] === 'd');
		expect(dTag).toBeTruthy();
		expect(dTag?.[1]).toBe('my-team:evt-abc');
	});

	it('includes redshift-audit t-tag', () => {
		const auditEvent = createMockAuditEvent();
		const event = createAuditEventTemplate(auditEvent, 'my-team');

		const tTag = event.tags.find((t) => t[0] === 't');
		expect(tTag).toBeTruthy();
		expect(tTag?.[1]).toBe('redshift-audit');
	});

	it('includes actor pubkey as p-tag', () => {
		const actorPubkey = 'c'.repeat(64);
		const auditEvent = createMockAuditEvent({ actor_pubkey: actorPubkey });
		const event = createAuditEventTemplate(auditEvent, 'my-team');

		const pTag = event.tags.find((t) => t[0] === 'p');
		expect(pTag).toBeTruthy();
		expect(pTag?.[1]).toBe(actorPubkey);
	});

	it('includes action as a-tag', () => {
		const auditEvent = createMockAuditEvent({ action: 'team_created' });
		const event = createAuditEventTemplate(auditEvent, 'my-team');

		const aTag = event.tags.find((t) => t[0] === 'a');
		expect(aTag).toBeTruthy();
		expect(aTag?.[1]).toBe('team_created');
	});

	it('includes audit data in content as JSON', () => {
		const actorPubkey = 'd'.repeat(64);
		const auditEvent = createMockAuditEvent({
			action: 'member_removed',
			target: 'e'.repeat(64),
			actor_pubkey: actorPubkey,
			created_at: 1700000000,
		});

		const event = createAuditEventTemplate(auditEvent, 'my-team');
		const content = JSON.parse(event.content) as {
			action: string;
			target: string;
			metadata: unknown;
			actorPubkey: string;
			timestamp: number;
		};

		expect(content.action).toBe('member_removed');
		expect(content.target).toBe('e'.repeat(64));
		expect(content.metadata).toBeNull();
		expect(content.actorPubkey).toBe(actorPubkey);
		expect(content.timestamp).toBe(1700000000);
	});

	it('parses metadata JSON in content', () => {
		const metadata = JSON.stringify({ from: 'developer', to: 'admin' });
		const auditEvent = createMockAuditEvent({ metadata });

		const event = createAuditEventTemplate(auditEvent, 'my-team');
		const content = JSON.parse(event.content) as {
			metadata: { from: string; to: string };
		};

		expect(content.metadata.from).toBe('developer');
		expect(content.metadata.to).toBe('admin');
	});

	it('sets null metadata when audit event has no metadata', () => {
		const auditEvent = createMockAuditEvent({ metadata: null });

		const event = createAuditEventTemplate(auditEvent, 'my-team');
		const content = JSON.parse(event.content) as { metadata: unknown };

		expect(content.metadata).toBeNull();
	});

	it('sets created_at to current time', () => {
		const auditEvent = createMockAuditEvent();

		const before = Math.floor(Date.now() / 1000);
		const event = createAuditEventTemplate(auditEvent, 'my-team');
		const after = Math.floor(Date.now() / 1000);

		expect(event.created_at).toBeGreaterThanOrEqual(before);
		expect(event.created_at).toBeLessThanOrEqual(after);
	});

	it('returns an unsigned event template (no id, sig, or pubkey)', () => {
		const auditEvent = createMockAuditEvent();
		const event = createAuditEventTemplate(auditEvent, 'my-team');

		// EventTemplate should not have id, sig, or pubkey
		expect('id' in event).toBe(false);
		expect('sig' in event).toBe(false);
		expect('pubkey' in event).toBe(false);
	});

	it('has exactly 4 tags', () => {
		const auditEvent = createMockAuditEvent();
		const event = createAuditEventTemplate(auditEvent, 'my-team');

		expect(event.tags.length).toBe(4);
	});

	it('handles different team slugs', () => {
		const auditEvent = createMockAuditEvent({ id: 'evt-1' });

		const event1 = createAuditEventTemplate(auditEvent, 'alpha-team');
		const event2 = createAuditEventTemplate(auditEvent, 'beta-team');

		const dTag1 = event1.tags.find((t) => t[0] === 'd');
		const dTag2 = event2.tags.find((t) => t[0] === 'd');

		expect(dTag1?.[1]).toBe('alpha-team:evt-1');
		expect(dTag2?.[1]).toBe('beta-team:evt-1');
	});
});
