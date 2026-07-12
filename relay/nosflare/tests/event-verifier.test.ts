import { describe, expect, it } from 'bun:test';
import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import { verifyEventSignature } from '../src/event-verifier';
import type { NostrEvent } from '../src/types';

function validEvent() {
	return finalizeEvent(
		{ kind: 1059, created_at: 1_700_000_000, tags: [['p', 'a'.repeat(64)]], content: 'x' },
		generateSecretKey(),
	) as NostrEvent;
}

describe('strict event verifier', () => {
	it('accepts a canonical event', async () => {
		expect(await verifyEventSignature(validEvent())).toBe(true);
	});

	it('rejects an arbitrary supplied ID even when the signature is otherwise valid', async () => {
		const event = { ...validEvent(), id: 'f'.repeat(64) };
		expect(await verifyEventSignature(event)).toBe(false);
	});

	it('rejects uppercase and malformed identity fields', async () => {
		const event = validEvent();
		for (const candidate of [
			{ ...event, id: event.id.toUpperCase() },
			{ ...event, pubkey: event.pubkey.slice(2) },
			{ ...event, sig: 'z'.repeat(128) },
			{ ...event, created_at: -1 },
			{ ...event, created_at: 1.5 },
		]) {
			expect(await verifyEventSignature(candidate)).toBe(false);
		}
	});

	it('rejects a signature after canonical content changes', async () => {
		const event = validEvent();
		expect(await verifyEventSignature({ ...event, content: 'changed' })).toBe(false);
	});
});
