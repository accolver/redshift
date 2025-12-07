/**
 * Rate Limiter Tests - TDD
 *
 * L4: Integration-Contractor - Rate limiting for relay operations
 */

import { describe, expect, it, beforeEach } from 'bun:test';
import {
	RateLimiter,
	isPermanentError,
	withBackoff,
	withPublishBackoff,
	withQueryBackoff,
	withRateLimit,
	createResilientOperation,
	DEFAULT_BACKOFF_OPTIONS,
	PUBLISH_BACKOFF_OPTIONS,
	QUERY_BACKOFF_OPTIONS,
} from '../../src/lib/rate-limiter';

describe('Rate Limiter Module', () => {
	describe('isPermanentError', () => {
		it('returns true for invalid signature errors', () => {
			const error = new Error('invalid signature: verification failed');
			expect(isPermanentError(error)).toBe(true);
		});

		it('returns true for blocked/banned errors', () => {
			expect(isPermanentError(new Error('User is blocked'))).toBe(true);
			expect(isPermanentError(new Error('banned from relay'))).toBe(true);
		});

		it('returns true for authorization errors', () => {
			expect(isPermanentError(new Error('unauthorized'))).toBe(true);
			expect(isPermanentError(new Error('403 forbidden'))).toBe(true);
			expect(isPermanentError(new Error('401 unauthorized'))).toBe(true);
		});

		it('returns true for not found errors', () => {
			expect(isPermanentError(new Error('resource not found'))).toBe(true);
			expect(isPermanentError(new Error('404'))).toBe(true);
		});

		it('returns false for transient errors', () => {
			expect(isPermanentError(new Error('connection timeout'))).toBe(false);
			expect(isPermanentError(new Error('network error'))).toBe(false);
			expect(isPermanentError(new Error('ECONNREFUSED'))).toBe(false);
			expect(isPermanentError(new Error('500 internal server error'))).toBe(false);
		});

		it('handles case-insensitive matching', () => {
			expect(isPermanentError(new Error('INVALID SIGNATURE'))).toBe(true);
			expect(isPermanentError(new Error('Forbidden'))).toBe(true);
		});
	});

	describe('RateLimiter', () => {
		let limiter: RateLimiter;

		beforeEach(() => {
			// Create limiter with 3 requests per 100ms window, 10ms min delay
			limiter = new RateLimiter(3, 100, 10);
		});

		it('allows requests within rate limit', async () => {
			const start = Date.now();

			// Should allow 3 quick requests with only min delay between them
			await limiter.waitForSlot();
			await limiter.waitForSlot();
			await limiter.waitForSlot();

			const elapsed = Date.now() - start;
			// At least 2 * minDelay (10ms) between 3 requests = 20ms minimum
			expect(elapsed).toBeGreaterThanOrEqual(20);
			// Should be quick (under 100ms, the window size)
			expect(elapsed).toBeLessThan(150);
		});

		it('delays requests when rate limit exceeded', async () => {
			const start = Date.now();

			// Make 4 requests (exceeds limit of 3)
			await limiter.waitForSlot();
			await limiter.waitForSlot();
			await limiter.waitForSlot();
			await limiter.waitForSlot(); // This one should wait for window reset

			const elapsed = Date.now() - start;
			// Should have waited for window reset (100ms)
			expect(elapsed).toBeGreaterThanOrEqual(100);
		});

		it('enforces minimum delay between requests', async () => {
			// Create limiter with high limit but 50ms min delay
			const slowLimiter = new RateLimiter(100, 1000, 50);

			const start = Date.now();
			await slowLimiter.waitForSlot();
			await slowLimiter.waitForSlot();
			const elapsed = Date.now() - start;

			// Should have waited at least 50ms (allow 5ms tolerance for timing variance)
			expect(elapsed).toBeGreaterThanOrEqual(45);
		});

		it('reset clears state', async () => {
			// Fill up the rate limit
			await limiter.waitForSlot();
			await limiter.waitForSlot();
			await limiter.waitForSlot();

			// Reset the limiter
			limiter.reset();

			// Should be able to make requests immediately again
			const start = Date.now();
			await limiter.waitForSlot();
			await limiter.waitForSlot();
			const elapsed = Date.now() - start;

			// Should be quick (just min delay)
			expect(elapsed).toBeLessThan(50);
		});
	});

	describe('withBackoff', () => {
		it('returns result on successful operation', async () => {
			const operation = async () => 'success';
			const result = await withBackoff(operation);
			expect(result).toBe('success');
		});

		it('retries on transient failure and succeeds', async () => {
			let attempts = 0;
			const operation = async () => {
				attempts++;
				if (attempts < 3) {
					throw new Error('temporary failure');
				}
				return 'success after retry';
			};

			const result = await withBackoff(operation, { numOfAttempts: 5, startingDelay: 10 });
			expect(result).toBe('success after retry');
			expect(attempts).toBe(3);
		});

		it('throws after max retries exhausted', async () => {
			const operation = async () => {
				throw new Error('persistent failure');
			};

			await expect(
				withBackoff(operation, {
					numOfAttempts: 2,
					startingDelay: 10,
					retry: () => true, // Always retry (override default)
				}),
			).rejects.toThrow('persistent failure');
		});

		it('stops retrying on permanent error', async () => {
			let attempts = 0;
			const operation = async () => {
				attempts++;
				throw new Error('invalid signature: bad sig');
			};

			await expect(withBackoff(operation, { numOfAttempts: 5, startingDelay: 10 })).rejects.toThrow(
				'invalid signature',
			);

			// Should only attempt once since it's a permanent error
			expect(attempts).toBe(1);
		});
	});

	describe('withPublishBackoff', () => {
		it('uses publish-specific settings', async () => {
			let attempts = 0;
			const operation = async () => {
				attempts++;
				if (attempts < 2) {
					throw new Error('timeout');
				}
				return 'published';
			};

			const result = await withPublishBackoff(operation);
			expect(result).toBe('published');
		});
	});

	describe('withQueryBackoff', () => {
		it('uses query-specific settings', async () => {
			let attempts = 0;
			const operation = async () => {
				attempts++;
				if (attempts < 2) {
					throw new Error('timeout');
				}
				return ['event1', 'event2'];
			};

			const result = await withQueryBackoff(operation);
			expect(result).toEqual(['event1', 'event2']);
		});
	});

	describe('withRateLimit', () => {
		it('wraps function with rate limiting and preserves return value', async () => {
			const limiter = new RateLimiter(100, 1000, 10);
			const fn = async (x: number) => x * 2;
			const limited = withRateLimit(fn, limiter);

			// Verify the wrapped function works correctly
			expect(await limited(5)).toBe(10);
			expect(await limited(10)).toBe(20);
			expect(await limited(15)).toBe(30);
		});

		it('enforces minimum delay between wrapped calls', async () => {
			// Use a larger delay to make timing more reliable in CI
			const limiter = new RateLimiter(100, 1000, 100);
			const fn = async (x: number) => x * 2;
			const limited = withRateLimit(fn, limiter);

			const start = Date.now();
			await limited(1);
			await limited(2);
			await limited(3);
			const elapsed = Date.now() - start;

			// 3 calls with 100ms min delay = at least 200ms between them
			// Allow 20% tolerance for CI timing variance
			expect(elapsed).toBeGreaterThanOrEqual(160);
		});
	});

	describe('createResilientOperation', () => {
		it('combines rate limiting and backoff', async () => {
			const limiter = new RateLimiter(100, 1000, 10);
			let attempts = 0;

			const fn = async (x: number) => {
				attempts++;
				if (attempts === 1) {
					throw new Error('first failure');
				}
				return x * 2;
			};

			const resilient = createResilientOperation(fn, limiter, {
				numOfAttempts: 3,
				startingDelay: 10,
			});

			const result = await resilient(5);
			expect(result).toBe(10);
			expect(attempts).toBe(2);
		});
	});

	describe('Backoff Options', () => {
		it('DEFAULT_BACKOFF_OPTIONS has sensible defaults', () => {
			expect(DEFAULT_BACKOFF_OPTIONS.numOfAttempts).toBe(5);
			expect(DEFAULT_BACKOFF_OPTIONS.startingDelay).toBe(1000);
			expect(DEFAULT_BACKOFF_OPTIONS.maxDelay).toBe(30000);
			expect(DEFAULT_BACKOFF_OPTIONS.jitter).toBe('full');
		});

		it('PUBLISH_BACKOFF_OPTIONS is faster than default', () => {
			expect(PUBLISH_BACKOFF_OPTIONS.numOfAttempts).toBeLessThanOrEqual(
				DEFAULT_BACKOFF_OPTIONS.numOfAttempts!,
			);
			expect(PUBLISH_BACKOFF_OPTIONS.maxDelay).toBeLessThan(DEFAULT_BACKOFF_OPTIONS.maxDelay!);
		});

		it('QUERY_BACKOFF_OPTIONS allows more time', () => {
			expect(QUERY_BACKOFF_OPTIONS.maxDelay).toBeGreaterThanOrEqual(
				DEFAULT_BACKOFF_OPTIONS.maxDelay!,
			);
		});
	});
});
