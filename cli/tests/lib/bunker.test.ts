/**
 * Bunker Module Tests
 *
 * L4: Integration-Contractor - NIP-46 protocol compliance
 */

import { describe, expect, it } from 'bun:test';
import type { EventTemplate, VerifiedEvent } from 'nostr-tools/core';
import type { BunkerPointer, BunkerSigner } from 'nostr-tools/nip46';
import {
	BunkerSecretManager,
	type BunkerConnection,
	bunkerAuthToPointer,
	createNostrConnectUri,
	decodeClientSecretKey,
	formatBunkerPointer,
	isValidBunkerUrl,
	withBunkerTimeout,
} from '../../src/lib/bunker';

describe('Bunker Module', () => {
	describe('withBunkerTimeout', () => {
		it('rejects when a bunker operation does not complete before the timeout', async () => {
			const never = new Promise<string>(() => {});

			expect(withBunkerTimeout(never, 5, 'bunker timeout')).rejects.toThrow('bunker timeout');
		});

		it('returns the operation result when it completes before the timeout', async () => {
			expect(await withBunkerTimeout(Promise.resolve('connected'), 100)).toBe('connected');
		});
	});

	describe('isValidBunkerUrl', () => {
		it('validates bunker:// URLs', () => {
			expect(isValidBunkerUrl(`bunker://${'a'.padEnd(64, '0')}?relay=wss://relay.test`)).toBe(true);
			expect(isValidBunkerUrl(`bunker://${'ab'.repeat(32)}`)).toBe(true);
		});

		it('rejects bunker:// URLs without valid hex pubkey', () => {
			expect(isValidBunkerUrl('bunker://abc123?relay=wss://relay.test')).toBe(false);
			expect(isValidBunkerUrl('bunker://pubkey')).toBe(false);
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

	describe('stored auth helpers', () => {
		it('converts stored bunker auth into a BunkerPointer without reusing pairing secrets', () => {
			const auth = {
				bunkerPubkey: 'ab'.repeat(32),
				relays: ['wss://relay.test'],
				secret: 'one-time-secret',
				clientSecretKey: 'cd'.repeat(32),
			};

			expect(bunkerAuthToPointer(auth)).toEqual({
				pubkey: 'ab'.repeat(32),
				relays: ['wss://relay.test'],
				secret: null,
			});
			expect(bunkerAuthToPointer(auth, true)).toEqual({
				pubkey: 'ab'.repeat(32),
				relays: ['wss://relay.test'],
				secret: 'one-time-secret',
			});
		});

		it('decodes a hex-encoded bunker client secret key', () => {
			const key = decodeClientSecretKey('0f'.repeat(32));

			expect(key).toBeInstanceOf(Uint8Array);
			expect(key.length).toBe(32);
			expect(Array.from(key)).toEqual(new Array(32).fill(15));
		});

		it('rejects malformed bunker client secret keys', () => {
			expect(() => decodeClientSecretKey('not-hex')).toThrow('Invalid bunker client secret key');
			expect(() => decodeClientSecretKey('aa')).toThrow('Invalid bunker client secret key');
		});
	});

	describe('Nostr Connect URI', () => {
		it('requests only Redshift runtime permissions without deletion signing by default', async () => {
			const { uri } = await createNostrConnectUri(['wss://relay.test'], 'Redshift CLI');
			const parsed = new URL(uri);
			const perms = parsed.searchParams.get('perms') ?? '';

			expect(perms).toContain('get_public_key');
			expect(perms).toContain('switch_relays');
			expect(perms).toContain('sign_event:13');
			expect(perms).toContain('nip44_encrypt');
			expect(perms).toContain('nip44_decrypt');
			expect(perms).not.toContain('sign_event:5');
		});
	});

	describe('BunkerSecretManager', () => {
		it('exposes signer-compatible NIP-44 methods for SecretManager', async () => {
			const calls: string[] = [];
			const signer = {
				signEvent: async (event: EventTemplate) => {
					calls.push(`sign:${event.kind}`);
					return { ...event, id: 'id', pubkey: 'pubkey', sig: 'sig' } as VerifiedEvent;
				},
				nip44Encrypt: async (pubkey: string, plaintext: string) => {
					calls.push(`encrypt:${pubkey}:${plaintext}`);
					return 'ciphertext';
				},
				nip44Decrypt: async (pubkey: string, ciphertext: string) => {
					calls.push(`decrypt:${pubkey}:${ciphertext}`);
					return 'plaintext';
				},
				close: async () => {
					calls.push('close');
				},
			} as unknown as BunkerSigner;
			const connection: BunkerConnection = {
				signer,
				userPubkey: 'user-pubkey',
				bunkerPointer: { pubkey: 'ab'.repeat(32), relays: ['wss://relay.test'], secret: null },
				clientSecretKey: new Uint8Array(32),
			};
			const manager = new BunkerSecretManager(connection, ['wss://relay.test']);

			expect(manager.getPublicKey()).toBe('user-pubkey');
			expect(await manager.nip44Encrypt('peer', 'hello')).toBe('ciphertext');
			expect(await manager.nip44Decrypt('peer', 'ciphertext')).toBe('plaintext');
			await manager.signEvent({ kind: 1059, content: '', tags: [], created_at: 1 });
			await manager.close();

			expect(calls).toEqual([
				'encrypt:peer:hello',
				'decrypt:peer:ciphertext',
				'sign:1059',
				'close',
			]);
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
