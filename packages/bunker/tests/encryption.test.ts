/**
 * Encryption module tests for @redshift/bunker
 */

import { describe, expect, it } from 'bun:test';
import { EncryptionError, decrypt, encrypt, generateMasterKey, parseMasterKey } from '../src/index';

// A valid 32-byte hex key for testing
const TEST_KEY = 'a'.repeat(64);
// Another valid key for wrong-key tests
const WRONG_KEY = 'b'.repeat(64);

describe('Encryption', () => {
	describe('parseMasterKey', () => {
		it('parses a valid 64-char hex string', () => {
			const key = parseMasterKey(TEST_KEY);
			expect(key.length).toBe(32);
		});

		it('rejects a short hex string', () => {
			expect(() => parseMasterKey('aabb')).toThrow(EncryptionError);
		});

		it('rejects a non-hex string', () => {
			expect(() => parseMasterKey('g'.repeat(64))).toThrow(EncryptionError);
		});

		it('rejects an empty string', () => {
			expect(() => parseMasterKey('')).toThrow(EncryptionError);
		});

		it('accepts mixed-case hex', () => {
			const mixedKey = `${'aAbBcCdDeEfF'.repeat(5)}aAbB`;
			expect(() => parseMasterKey(mixedKey)).not.toThrow();
		});
	});

	describe('encrypt / decrypt roundtrip', () => {
		it('encrypts and decrypts a simple string', () => {
			const plaintext = 'nsec1abc123';
			const encrypted = encrypt(plaintext, TEST_KEY);
			const decrypted = decrypt(encrypted, TEST_KEY);
			expect(decrypted).toBe(plaintext);
		});

		it('encrypts and decrypts an empty string', () => {
			const plaintext = '';
			const encrypted = encrypt(plaintext, TEST_KEY);
			const decrypted = decrypt(encrypted, TEST_KEY);
			expect(decrypted).toBe(plaintext);
		});

		it('encrypts and decrypts a long string', () => {
			const plaintext = 'x'.repeat(10000);
			const encrypted = encrypt(plaintext, TEST_KEY);
			const decrypted = decrypt(encrypted, TEST_KEY);
			expect(decrypted).toBe(plaintext);
		});

		it('encrypts and decrypts unicode content', () => {
			const plaintext = '🔑 secret key 日本語 émojis';
			const encrypted = encrypt(plaintext, TEST_KEY);
			const decrypted = decrypt(encrypted, TEST_KEY);
			expect(decrypted).toBe(plaintext);
		});

		it('produces different ciphertexts for same plaintext (random IV)', () => {
			const plaintext = 'same-secret';
			const encrypted1 = encrypt(plaintext, TEST_KEY);
			const encrypted2 = encrypt(plaintext, TEST_KEY);
			expect(encrypted1).not.toBe(encrypted2);
		});

		it('produces base64-encoded output', () => {
			const encrypted = encrypt('test', TEST_KEY);
			// Should be valid base64
			expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
			// Should not contain raw binary
			expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/);
		});
	});

	describe('decrypt error handling', () => {
		it('fails with wrong key', () => {
			const encrypted = encrypt('secret', TEST_KEY);
			expect(() => decrypt(encrypted, WRONG_KEY)).toThrow(EncryptionError);
		});

		it('fails with tampered ciphertext', () => {
			const encrypted = encrypt('secret', TEST_KEY);
			const bytes = Buffer.from(encrypted, 'base64');
			// Flip a byte in the middle (ciphertext area)
			const midpoint = Math.floor(bytes.length / 2);
			bytes[midpoint] = (bytes[midpoint] ?? 0) ^ 0xff;
			const tampered = bytes.toString('base64');
			expect(() => decrypt(tampered, TEST_KEY)).toThrow(EncryptionError);
		});

		it('fails with truncated data', () => {
			const encrypted = encrypt('secret', TEST_KEY);
			const truncated = encrypted.slice(0, 10);
			expect(() => decrypt(truncated, TEST_KEY)).toThrow(EncryptionError);
		});

		it('fails with invalid base64', () => {
			// Even invalid base64 should be handled gracefully
			// Buffer.from with 'base64' is lenient, so this tests the length check
			expect(() => decrypt('!!!', TEST_KEY)).toThrow(EncryptionError);
		});

		it('fails with invalid key format', () => {
			const encrypted = encrypt('secret', TEST_KEY);
			expect(() => decrypt(encrypted, 'not-a-hex-key')).toThrow(EncryptionError);
		});
	});

	describe('generateMasterKey', () => {
		it('generates a 64-character hex string', () => {
			const key = generateMasterKey();
			expect(key.length).toBe(64);
			expect(key).toMatch(/^[0-9a-f]{64}$/);
		});

		it('generates unique keys', () => {
			const key1 = generateMasterKey();
			const key2 = generateMasterKey();
			expect(key1).not.toBe(key2);
		});

		it('generates keys that work with encrypt/decrypt', () => {
			const key = generateMasterKey();
			const plaintext = 'test-with-generated-key';
			const encrypted = encrypt(plaintext, key);
			const decrypted = decrypt(encrypted, key);
			expect(decrypted).toBe(plaintext);
		});
	});
});
