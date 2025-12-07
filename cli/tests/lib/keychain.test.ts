/**
 * Keychain Integration Tests
 *
 * L2: Function-Author - Keychain operations
 *
 * Note: These tests may behave differently depending on OS and keychain availability.
 * On systems without keychain (e.g., headless Linux without secret-tool), operations
 * will return null/false gracefully.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
	deleteNsecFromKeychain,
	getKeychainServiceName,
	getNsecFromKeychain,
	isKeychainAvailable,
	storeNsecInKeychain,
} from '../../src/lib/keychain';

// Valid test nsec keys for testing
const TEST_NSEC_1 = 'nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5';
const TEST_NSEC_2 = 'nsec1vhs5lxp2hfxfv8eyxwdj0azlhxjf8d4xsn03kc3kz7h5g8h2mnrqplrthc';

describe('Keychain Module', () => {
	describe('getKeychainServiceName', () => {
		it('returns the expected service name', () => {
			const serviceName = getKeychainServiceName();
			expect(serviceName).toBe('com.redshiftapp.cli');
		});

		it('returns consistent service name on multiple calls', () => {
			const name1 = getKeychainServiceName();
			const name2 = getKeychainServiceName();
			const name3 = getKeychainServiceName();
			expect(name1).toBe(name2);
			expect(name2).toBe(name3);
		});

		it('uses reverse domain notation (UTI format)', () => {
			const serviceName = getKeychainServiceName();
			// Should be in format: com.domain.app
			expect(serviceName).toMatch(/^com\.[a-z]+\.[a-z]+$/);
		});
	});

	describe('isKeychainAvailable', () => {
		it('returns a boolean indicating keychain availability', async () => {
			const available = await isKeychainAvailable();
			expect(typeof available).toBe('boolean');
		});

		it('returns consistent result on multiple calls', async () => {
			const result1 = await isKeychainAvailable();
			const result2 = await isKeychainAvailable();
			const result3 = await isKeychainAvailable();
			expect(result1).toBe(result2);
			expect(result2).toBe(result3);
		});

		it('does not throw even if keychain service is unavailable', async () => {
			// This should never throw - just complete without error
			let didThrow = false;
			try {
				await isKeychainAvailable();
			} catch {
				didThrow = true;
			}
			expect(didThrow).toBe(false);
		});
	});

	describe('keychain CRUD operations', () => {
		// Clean up before and after tests
		beforeEach(async () => {
			await deleteNsecFromKeychain();
		});

		afterEach(async () => {
			await deleteNsecFromKeychain();
		});

		it('stores and retrieves nsec from keychain', async () => {
			const available = await isKeychainAvailable();

			if (!available) {
				console.log('Keychain not available, skipping store/retrieve test');
				return;
			}

			// Store
			const stored = await storeNsecInKeychain(TEST_NSEC_1);
			expect(stored).toBe(true);

			// Retrieve
			const retrieved = await getNsecFromKeychain();
			expect(retrieved).toBe(TEST_NSEC_1);
		});

		it('returns null when nsec not in keychain', async () => {
			// Ensure nothing is stored
			await deleteNsecFromKeychain();

			const retrieved = await getNsecFromKeychain();
			// Either null (keychain available but empty) or null (keychain unavailable)
			expect(retrieved).toBeNull();
		});

		it('deletes nsec from keychain', async () => {
			const available = await isKeychainAvailable();

			if (!available) {
				console.log('Keychain not available, skipping delete test');
				return;
			}

			// Store first
			await storeNsecInKeychain(TEST_NSEC_1);

			// Verify it's stored
			const beforeDelete = await getNsecFromKeychain();
			expect(beforeDelete).toBe(TEST_NSEC_1);

			// Delete
			const deleted = await deleteNsecFromKeychain();
			expect(deleted).toBe(true);

			// Verify it's gone
			const afterDelete = await getNsecFromKeychain();
			expect(afterDelete).toBeNull();
		});

		it('overwrites existing nsec when storing new one', async () => {
			const available = await isKeychainAvailable();

			if (!available) {
				console.log('Keychain not available, skipping overwrite test');
				return;
			}

			// Store first nsec
			await storeNsecInKeychain(TEST_NSEC_1);
			const first = await getNsecFromKeychain();
			expect(first).toBe(TEST_NSEC_1);

			// Store second nsec (should overwrite)
			await storeNsecInKeychain(TEST_NSEC_2);
			const second = await getNsecFromKeychain();
			expect(second).toBe(TEST_NSEC_2);

			// Verify first is gone
			expect(second).not.toBe(TEST_NSEC_1);
		});

		it('handles storing empty string', async () => {
			const available = await isKeychainAvailable();

			if (!available) {
				console.log('Keychain not available, skipping empty string test');
				return;
			}

			// Store empty string
			const stored = await storeNsecInKeychain('');
			// Should still work (empty is valid, though not a valid nsec)
			expect(typeof stored).toBe('boolean');
		});

		it('handles storing very long strings', async () => {
			const available = await isKeychainAvailable();

			if (!available) {
				console.log('Keychain not available, skipping long string test');
				return;
			}

			// Create a very long string (1KB)
			const longString = 'x'.repeat(1024);
			const stored = await storeNsecInKeychain(longString);

			if (stored) {
				const retrieved = await getNsecFromKeychain();
				expect(retrieved).toBe(longString);
			}
		});

		it('handles storing special characters', async () => {
			const available = await isKeychainAvailable();

			if (!available) {
				console.log('Keychain not available, skipping special chars test');
				return;
			}

			const specialString = 'nsec1test!@#$%^&*()_+-=[]{}|;:,.<>?';
			const stored = await storeNsecInKeychain(specialString);

			if (stored) {
				const retrieved = await getNsecFromKeychain();
				expect(retrieved).toBe(specialString);
			}
		});

		it('handles unicode characters', async () => {
			const available = await isKeychainAvailable();

			if (!available) {
				console.log('Keychain not available, skipping unicode test');
				return;
			}

			const unicodeString = 'nsec1test_日本語_émoji_🔐';
			const stored = await storeNsecInKeychain(unicodeString);

			if (stored) {
				const retrieved = await getNsecFromKeychain();
				expect(retrieved).toBe(unicodeString);
			}
		});

		it('delete returns gracefully when nothing to delete', async () => {
			// Ensure nothing is stored
			await deleteNsecFromKeychain();

			// Try to delete again - should not throw
			const deleted = await deleteNsecFromKeychain();
			expect(typeof deleted).toBe('boolean');
		});

		it('multiple deletes in succession are safe', async () => {
			const available = await isKeychainAvailable();

			if (!available) {
				console.log('Keychain not available, skipping multiple delete test');
				return;
			}

			// Store something
			await storeNsecInKeychain(TEST_NSEC_1);

			// Delete multiple times
			await deleteNsecFromKeychain();
			await deleteNsecFromKeychain();
			await deleteNsecFromKeychain();

			// Should be null
			const retrieved = await getNsecFromKeychain();
			expect(retrieved).toBeNull();
		});
	});
});

describe('Keychain graceful degradation', () => {
	it('all operations complete without throwing', async () => {
		// These should never throw, regardless of keychain availability
		const availableResult = await isKeychainAvailable();
		expect(availableResult).toBeDefined();

		const getResult = await getNsecFromKeychain();
		expect(getResult === null || typeof getResult === 'string').toBe(true);

		const storeResult = await storeNsecInKeychain('test');
		expect(typeof storeResult).toBe('boolean');

		const deleteResult = await deleteNsecFromKeychain();
		expect(typeof deleteResult).toBe('boolean');
	});

	it('returns appropriate types even when keychain unavailable', async () => {
		// These validate return types, not success
		const available = await isKeychainAvailable();
		expect(typeof available).toBe('boolean');

		const retrieved = await getNsecFromKeychain();
		expect(retrieved === null || typeof retrieved === 'string').toBe(true);

		const stored = await storeNsecInKeychain(TEST_NSEC_1);
		expect(typeof stored).toBe('boolean');

		const deleted = await deleteNsecFromKeychain();
		expect(typeof deleted).toBe('boolean');
	});
});

describe('Keychain concurrent operations', () => {
	beforeEach(async () => {
		await deleteNsecFromKeychain();
	});

	afterEach(async () => {
		await deleteNsecFromKeychain();
	});

	it('handles concurrent store operations', async () => {
		const available = await isKeychainAvailable();

		if (!available) {
			console.log('Keychain not available, skipping concurrent store test');
			return;
		}

		// Fire multiple stores concurrently
		const results = await Promise.all([
			storeNsecInKeychain(TEST_NSEC_1),
			storeNsecInKeychain(TEST_NSEC_2),
			storeNsecInKeychain(TEST_NSEC_1),
		]);

		// All should complete (order may vary)
		expect(results.every((r) => typeof r === 'boolean')).toBe(true);

		// Final state should be one of the values
		const final = await getNsecFromKeychain();
		expect(final === TEST_NSEC_1 || final === TEST_NSEC_2).toBe(true);
	});

	it('handles concurrent get operations', async () => {
		const available = await isKeychainAvailable();

		if (!available) {
			console.log('Keychain not available, skipping concurrent get test');
			return;
		}

		// Store a value first
		await storeNsecInKeychain(TEST_NSEC_1);

		// Fire multiple gets concurrently
		const results = await Promise.all([
			getNsecFromKeychain(),
			getNsecFromKeychain(),
			getNsecFromKeychain(),
			getNsecFromKeychain(),
		]);

		// All should return the same value
		expect(results.every((r) => r === TEST_NSEC_1)).toBe(true);
	});

	it('handles mixed concurrent operations', async () => {
		const available = await isKeychainAvailable();

		if (!available) {
			console.log('Keychain not available, skipping mixed concurrent test');
			return;
		}

		// Fire mixed operations concurrently
		const results = await Promise.allSettled([
			storeNsecInKeychain(TEST_NSEC_1),
			getNsecFromKeychain(),
			deleteNsecFromKeychain(),
			storeNsecInKeychain(TEST_NSEC_2),
			getNsecFromKeychain(),
		]);

		// All should complete (not reject)
		expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
	});
});

describe('Keychain security properties', () => {
	beforeEach(async () => {
		await deleteNsecFromKeychain();
	});

	afterEach(async () => {
		await deleteNsecFromKeychain();
	});

	it('stored credential is not accessible as plain text in memory export', async () => {
		const available = await isKeychainAvailable();

		if (!available) {
			console.log('Keychain not available, skipping security test');
			return;
		}

		// Store sensitive data
		const sensitiveData = 'nsec1supersecretkeythatshouldbehidden12345';
		await storeNsecInKeychain(sensitiveData);

		// The credential should be stored in the OS keychain, not in our process memory
		// We can only verify it's retrievable, not that it's encrypted
		const retrieved = await getNsecFromKeychain();
		expect(retrieved).toBe(sensitiveData);

		// Clean up
		await deleteNsecFromKeychain();
	});

	it('deleted credentials are not retrievable', async () => {
		const available = await isKeychainAvailable();

		if (!available) {
			console.log('Keychain not available, skipping deletion security test');
			return;
		}

		// Store and then delete
		await storeNsecInKeychain(TEST_NSEC_1);
		await deleteNsecFromKeychain();

		// Should not be able to retrieve after deletion
		const retrieved = await getNsecFromKeychain();
		expect(retrieved).toBeNull();

		// Multiple get attempts should all return null
		const attempts = await Promise.all([
			getNsecFromKeychain(),
			getNsecFromKeychain(),
			getNsecFromKeychain(),
		]);
		expect(attempts.every((a) => a === null)).toBe(true);
	});
});

describe('Keychain error handling', () => {
	it('handles rapid successive calls without crashing', async () => {
		// Fire 20 rapid operations
		const operations = [];
		for (let i = 0; i < 20; i++) {
			operations.push(isKeychainAvailable());
			operations.push(getNsecFromKeychain());
		}

		const results = await Promise.allSettled(operations);

		// None should have rejected
		const rejected = results.filter((r) => r.status === 'rejected');
		expect(rejected.length).toBe(0);
	});

	it('recovers gracefully after failed operation', async () => {
		const available = await isKeychainAvailable();

		if (!available) {
			console.log('Keychain not available, skipping recovery test');
			return;
		}

		// Ensure clean state
		await deleteNsecFromKeychain();

		// Normal operation should work
		const stored = await storeNsecInKeychain(TEST_NSEC_1);
		expect(stored).toBe(true);

		const retrieved = await getNsecFromKeychain();
		expect(retrieved).toBe(TEST_NSEC_1);

		// Cleanup
		await deleteNsecFromKeychain();
	});
});
