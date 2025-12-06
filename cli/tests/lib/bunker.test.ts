/**
 * Bunker Module Tests
 *
 * L4: Integration-Contractor - NIP-46 protocol compliance
 */

import { describe, expect, it } from 'bun:test';
import { isValidBunkerUrl, formatBunkerPointer } from '../../src/lib/bunker';
import type { BunkerPointer } from 'nostr-tools/nip46';

describe('Bunker Module', () => {
	describe('isValidBunkerUrl', () => {
		it('validates bunker:// URLs', () => {
			expect(isValidBunkerUrl('bunker://abc123?relay=wss://relay.test')).toBe(true);
			expect(isValidBunkerUrl('bunker://pubkey')).toBe(true);
		});

		it('validates NIP-05 identifiers', () => {
			expect(isValidBunkerUrl('user@domain.com')).toBe(true);
			expect(isValidBunkerUrl('alice@nostr.example')).toBe(true);
		});

		it('rejects invalid formats', () => {
			expect(isValidBunkerUrl('')).toBe(false);
			expect(isValidBunkerUrl('http://example.com')).toBe(false);
			expect(isValidBunkerUrl('wss://relay.test')).toBe(false);
			expect(isValidBunkerUrl('just-a-string')).toBe(false);
		});

		it('rejects nsec (should not be used as bunker URL)', () => {
			expect(
				isValidBunkerUrl('nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5'),
			).toBe(false);
		});
	});

	describe('formatBunkerPointer', () => {
		it('formats bunker pointer for display', () => {
			const bp: BunkerPointer = {
				pubkey: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
				relays: ['wss://relay.damus.io', 'wss://nos.lol'],
				secret: null,
			};

			const formatted = formatBunkerPointer(bp);

			expect(formatted).toContain('abcdef12');
			expect(formatted).toContain('34567890');
			expect(formatted).toContain('wss://relay.damus.io');
		});

		it('handles empty relays array', () => {
			const bp: BunkerPointer = {
				pubkey: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
				relays: [],
				secret: null,
			};

			const formatted = formatBunkerPointer(bp);

			expect(formatted).toContain('unknown relay');
		});

		it('shows first relay when multiple exist', () => {
			const bp: BunkerPointer = {
				pubkey: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
				relays: ['wss://first.relay', 'wss://second.relay'],
				secret: 'some-secret',
			};

			const formatted = formatBunkerPointer(bp);

			expect(formatted).toContain('wss://first.relay');
			expect(formatted).not.toContain('wss://second.relay');
		});
	});
});
