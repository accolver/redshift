import { describe, it, expect, beforeEach } from 'vitest';
import { nip19, generateSecretKey, getPublicKey } from 'nostr-tools';

// Mock sessionStorage
const sessionStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: (key: string) => store[key] || null,
		setItem: (key: string, value: string) => {
			store[key] = value;
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		},
	};
})();

Object.defineProperty(global, 'sessionStorage', {
	value: sessionStorageMock,
});

describe('Auth Store - nsec validation', () => {
	beforeEach(() => {
		sessionStorageMock.clear();
	});

	describe('nsec format validation', () => {
		it('valid nsec decodes successfully', () => {
			// Generate a valid test nsec
			const sk = generateSecretKey();
			const nsec = nip19.nsecEncode(sk);

			// Verify it starts with nsec1
			expect(nsec.startsWith('nsec1')).toBe(true);

			// Verify it decodes back
			const decoded = nip19.decode(nsec);
			expect(decoded.type).toBe('nsec');
			expect(decoded.data).toEqual(sk);
		});

		it('invalid nsec throws on decode', () => {
			expect(() => nip19.decode('nsec1invalid')).toThrow();
		});

		it('empty string throws on decode', () => {
			expect(() => nip19.decode('')).toThrow();
		});

		it('random string throws on decode', () => {
			expect(() => nip19.decode('not-a-valid-key')).toThrow();
		});

		it('npub is not a valid nsec', () => {
			const sk = generateSecretKey();
			const pubkey = getPublicKey(sk);
			const npub = nip19.npubEncode(pubkey);

			const decoded = nip19.decode(npub);
			expect(decoded.type).toBe('npub');
			expect(decoded.type).not.toBe('nsec');
		});
	});

	describe('key derivation', () => {
		it('derives pubkey from secret key', () => {
			const sk = generateSecretKey();
			const pubkey = getPublicKey(sk);

			// Pubkey should be 64 hex chars
			expect(pubkey).toMatch(/^[0-9a-f]{64}$/);
		});

		it('same secret key always produces same pubkey', () => {
			const sk = generateSecretKey();
			const pubkey1 = getPublicKey(sk);
			const pubkey2 = getPublicKey(sk);

			expect(pubkey1).toBe(pubkey2);
		});

		it('different secret keys produce different pubkeys', () => {
			const sk1 = generateSecretKey();
			const sk2 = generateSecretKey();
			const pubkey1 = getPublicKey(sk1);
			const pubkey2 = getPublicKey(sk2);

			expect(pubkey1).not.toBe(pubkey2);
		});
	});

	describe('sessionStorage mock', () => {
		it('stores and retrieves values', () => {
			sessionStorageMock.setItem('test_key', 'test_value');
			expect(sessionStorageMock.getItem('test_key')).toBe('test_value');
		});

		it('returns null for non-existent keys', () => {
			expect(sessionStorageMock.getItem('non_existent')).toBeNull();
		});

		it('removes values', () => {
			sessionStorageMock.setItem('to_remove', 'value');
			sessionStorageMock.removeItem('to_remove');
			expect(sessionStorageMock.getItem('to_remove')).toBeNull();
		});

		it('clears all values', () => {
			sessionStorageMock.setItem('key1', 'value1');
			sessionStorageMock.setItem('key2', 'value2');
			sessionStorageMock.clear();
			expect(sessionStorageMock.getItem('key1')).toBeNull();
			expect(sessionStorageMock.getItem('key2')).toBeNull();
		});
	});
});

describe('Auth Store - NIP-19 encoding', () => {
	it('encodes and decodes nsec correctly', () => {
		const sk = generateSecretKey();
		const nsec = nip19.nsecEncode(sk);
		const decoded = nip19.decode(nsec);

		expect(decoded.type).toBe('nsec');
		expect(decoded.data).toEqual(sk);
	});

	it('encodes and decodes npub correctly', () => {
		const sk = generateSecretKey();
		const pubkey = getPublicKey(sk);
		const npub = nip19.npubEncode(pubkey);
		const decoded = nip19.decode(npub);

		expect(decoded.type).toBe('npub');
		expect(decoded.data).toBe(pubkey);
	});

	it('npub and nsec have different prefixes', () => {
		const sk = generateSecretKey();
		const pubkey = getPublicKey(sk);
		const nsec = nip19.nsecEncode(sk);
		const npub = nip19.npubEncode(pubkey);

		expect(nsec.startsWith('nsec1')).toBe(true);
		expect(npub.startsWith('npub1')).toBe(true);
	});
});
