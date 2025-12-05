import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	secureStore,
	secureRetrieve,
	secureRemove,
	secureClearAll,
	isSecureStorageAvailable,
} from '$lib/stores/secure-storage';

describe('Secure Storage', () => {
	beforeEach(async () => {
		// Clear all storage before each test
		await secureClearAll();
	});

	afterEach(async () => {
		// Clean up after each test
		await secureClearAll();
	});

	describe('isSecureStorageAvailable', () => {
		it('returns true when crypto.subtle and indexedDB are available', () => {
			expect(isSecureStorageAvailable()).toBe(true);
		});
	});

	describe('secureStore and secureRetrieve', () => {
		it('stores and retrieves a value correctly', async () => {
			const testValue = 'nsec1abc123xyz';

			await secureStore('test-key', testValue);
			const retrieved = await secureRetrieve('test-key');

			expect(retrieved).toBe(testValue);
		});

		it('stores and retrieves multiple values independently', async () => {
			await secureStore('key1', 'value1');
			await secureStore('key2', 'value2');

			expect(await secureRetrieve('key1')).toBe('value1');
			expect(await secureRetrieve('key2')).toBe('value2');
		});

		it('overwrites existing value with same key', async () => {
			await secureStore('key', 'original');
			await secureStore('key', 'updated');

			expect(await secureRetrieve('key')).toBe('updated');
		});

		it('handles empty string value', async () => {
			await secureStore('empty', '');
			expect(await secureRetrieve('empty')).toBe('');
		});

		it('handles long values', async () => {
			const longValue = 'x'.repeat(10000);
			await secureStore('long', longValue);
			expect(await secureRetrieve('long')).toBe(longValue);
		});

		it('handles unicode values', async () => {
			const unicodeValue = '日本語テスト🔑🔐';
			await secureStore('unicode', unicodeValue);
			expect(await secureRetrieve('unicode')).toBe(unicodeValue);
		});

		it('handles special characters in value', async () => {
			const specialValue = '!@#$%^&*(){}[]|\\:";\'<>,.?/~`';
			await secureStore('special', specialValue);
			expect(await secureRetrieve('special')).toBe(specialValue);
		});
	});

	describe('secureRetrieve - edge cases', () => {
		it('returns null for non-existent key', async () => {
			const result = await secureRetrieve('non-existent');
			expect(result).toBeNull();
		});

		it('returns null after key is removed', async () => {
			await secureStore('to-remove', 'value');
			secureRemove('to-remove');

			expect(await secureRetrieve('to-remove')).toBeNull();
		});
	});

	describe('secureRemove', () => {
		it('removes a stored value', async () => {
			await secureStore('key', 'value');
			expect(await secureRetrieve('key')).toBe('value');

			secureRemove('key');
			expect(await secureRetrieve('key')).toBeNull();
		});

		it('does not throw when removing non-existent key', () => {
			expect(() => secureRemove('non-existent')).not.toThrow();
		});

		it('only removes specified key, not others', async () => {
			await secureStore('keep', 'keep-value');
			await secureStore('remove', 'remove-value');

			secureRemove('remove');

			expect(await secureRetrieve('keep')).toBe('keep-value');
			expect(await secureRetrieve('remove')).toBeNull();
		});
	});

	describe('secureClearAll', () => {
		it('removes all stored values', async () => {
			await secureStore('key1', 'value1');
			await secureStore('key2', 'value2');
			await secureStore('key3', 'value3');

			await secureClearAll();

			expect(await secureRetrieve('key1')).toBeNull();
			expect(await secureRetrieve('key2')).toBeNull();
			expect(await secureRetrieve('key3')).toBeNull();
		});

		it('does not throw on empty storage', async () => {
			await expect(secureClearAll()).resolves.not.toThrow();
		});
	});

	describe('encryption verification', () => {
		it('stored value in sessionStorage is encrypted (not plaintext)', async () => {
			const plaintext = 'nsec1secretkey123';
			await secureStore('encrypted-test', plaintext);

			// Check what's actually in sessionStorage
			const storedValue = sessionStorage.getItem('redshift_encrypted_encrypted-test');

			expect(storedValue).not.toBeNull();
			expect(storedValue).not.toBe(plaintext);
			expect(storedValue).not.toContain('nsec1');

			// Verify it's base64 encoded (encrypted data)
			expect(() => atob(storedValue!)).not.toThrow();
		});

		it('same plaintext produces different ciphertext (due to random IV)', async () => {
			const plaintext = 'same-value';

			await secureStore('key1', plaintext);
			const ciphertext1 = sessionStorage.getItem('redshift_encrypted_key1');

			// Clear and re-create key to get new IV
			await secureClearAll();

			await secureStore('key2', plaintext);
			const ciphertext2 = sessionStorage.getItem('redshift_encrypted_key2');

			// Due to random IV, ciphertexts should differ
			expect(ciphertext1).not.toBe(ciphertext2);
		});

		it('tampered ciphertext fails to decrypt', async () => {
			await secureStore('tamper-test', 'secret');

			// Tamper with the stored value
			const stored = sessionStorage.getItem('redshift_encrypted_tamper-test')!;
			const tampered = stored.slice(0, -5) + 'XXXXX';
			sessionStorage.setItem('redshift_encrypted_tamper-test', tampered);

			// Should return null (decryption failure)
			const result = await secureRetrieve('tamper-test');
			expect(result).toBeNull();
		});

		it('invalid base64 in storage returns null', async () => {
			sessionStorage.setItem('redshift_encrypted_invalid', 'not-valid-base64!!!');

			const result = await secureRetrieve('invalid');
			expect(result).toBeNull();
		});
	});

	describe('key persistence', () => {
		it('encryption key persists across multiple operations', async () => {
			// Store first value
			await secureStore('first', 'value1');

			// Store second value (should use same key)
			await secureStore('second', 'value2');

			// Both should be retrievable
			expect(await secureRetrieve('first')).toBe('value1');
			expect(await secureRetrieve('second')).toBe('value2');
		});

		it('after clearAll, new key is generated and old data cannot be decrypted', async () => {
			await secureStore('key', 'value');
			const encrypted1 = sessionStorage.getItem('redshift_encrypted_key')!;

			// Clear all (including the encryption key)
			await secureClearAll();

			// Manually restore the old encrypted data
			sessionStorage.setItem('redshift_encrypted_key', encrypted1);

			// Try to retrieve - should fail because key was deleted
			const result = await secureRetrieve('key');
			expect(result).toBeNull();
		});
	});

	describe('realistic nsec scenarios', () => {
		it('handles valid nsec format', async () => {
			const nsec = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';

			await secureStore('sk', nsec);
			const retrieved = await secureRetrieve('sk');

			expect(retrieved).toBe(nsec);
		});

		it('handles hex format private key', async () => {
			const hexKey = 'a'.repeat(64);

			await secureStore('sk', hexKey);
			const retrieved = await secureRetrieve('sk');

			expect(retrieved).toBe(hexKey);
		});

		it('survives store -> remove -> store cycle', async () => {
			await secureStore('sk', 'nsec1first');
			expect(await secureRetrieve('sk')).toBe('nsec1first');

			secureRemove('sk');
			expect(await secureRetrieve('sk')).toBeNull();

			await secureStore('sk', 'nsec1second');
			expect(await secureRetrieve('sk')).toBe('nsec1second');
		});
	});
});
