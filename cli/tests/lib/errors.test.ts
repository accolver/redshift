/**
 * Error Types Tests
 *
 * L2: Function-Author - Error handling utilities
 */

import { describe, expect, it } from 'bun:test';
import {
	RedshiftError,
	RelayError,
	DecryptionError,
	AuthError,
	ConfigError,
	NotConnectedError,
	formatError,
	isRetryableError,
	wrapError,
} from '../../src/lib/errors';

describe('Error Types', () => {
	describe('RedshiftError', () => {
		it('creates error with message and code', () => {
			const error = new RedshiftError('Something went wrong', 'TEST_ERROR');

			expect(error.message).toBe('Something went wrong');
			expect(error.code).toBe('TEST_ERROR');
			expect(error.name).toBe('RedshiftError');
			expect(error instanceof Error).toBe(true);
		});
	});

	describe('RelayError', () => {
		it('creates error with operation type', () => {
			const error = new RelayError('Connection failed', 'connect');

			expect(error.message).toBe('Connection failed');
			expect(error.code).toBe('RELAY_ERROR');
			expect(error.operation).toBe('connect');
			expect(error.name).toBe('RelayError');
		});

		it('includes original error when provided', () => {
			const originalError = new Error('Network timeout');
			const error = new RelayError('Query failed', 'query', originalError);

			expect(error.originalError).toBe(originalError);
		});

		it('supports all operation types', () => {
			const operations = ['connect', 'publish', 'query', 'subscribe'] as const;

			for (const op of operations) {
				const error = new RelayError('Test', op);
				expect(error.operation).toBe(op);
			}
		});
	});

	describe('DecryptionError', () => {
		it('creates error with event ID', () => {
			const error = new DecryptionError('Failed to decrypt', 'event123');

			expect(error.message).toBe('Failed to decrypt');
			expect(error.code).toBe('DECRYPTION_ERROR');
			expect(error.eventId).toBe('event123');
			expect(error.name).toBe('DecryptionError');
		});

		it('works without event ID', () => {
			const error = new DecryptionError('Failed to decrypt');

			expect(error.eventId).toBeUndefined();
		});

		it('includes original error when provided', () => {
			const originalError = new Error('Invalid MAC');
			const error = new DecryptionError('Failed', 'event123', originalError);

			expect(error.originalError).toBe(originalError);
		});
	});

	describe('AuthError', () => {
		it('creates error with auth method', () => {
			const error = new AuthError('Login failed', 'bunker');

			expect(error.message).toBe('Login failed');
			expect(error.code).toBe('AUTH_ERROR');
			expect(error.method).toBe('bunker');
			expect(error.name).toBe('AuthError');
		});

		it('supports all auth methods', () => {
			const methods = ['nsec', 'bunker', 'nip07'] as const;

			for (const method of methods) {
				const error = new AuthError('Test', method);
				expect(error.method).toBe(method);
			}
		});
	});

	describe('ConfigError', () => {
		it('creates error with config path', () => {
			const error = new ConfigError('Missing config', '/path/to/redshift.yaml');

			expect(error.message).toBe('Missing config');
			expect(error.code).toBe('CONFIG_ERROR');
			expect(error.configPath).toBe('/path/to/redshift.yaml');
			expect(error.name).toBe('ConfigError');
		});
	});

	describe('NotConnectedError', () => {
		it('creates error with default message', () => {
			const error = new NotConnectedError();

			expect(error.message).toBe('Not connected to relays. Call connect() first.');
			expect(error.code).toBe('NOT_CONNECTED');
			expect(error.name).toBe('NotConnectedError');
		});

		it('accepts custom message', () => {
			const error = new NotConnectedError('Custom message');

			expect(error.message).toBe('Custom message');
		});
	});
});

describe('formatError', () => {
	it('formats RedshiftError with code', () => {
		const error = new RelayError('Connection failed', 'connect');
		const formatted = formatError(error);

		expect(formatted).toBe('[RELAY_ERROR] Connection failed');
	});

	it('formats standard Error without code', () => {
		const error = new Error('Something went wrong');
		const formatted = formatError(error);

		expect(formatted).toBe('Something went wrong');
	});

	it('formats non-error values', () => {
		expect(formatError('string error')).toBe('string error');
		expect(formatError(123)).toBe('123');
		expect(formatError(null)).toBe('null');
	});
});

describe('isRetryableError', () => {
	it('considers RelayError with query operation retryable', () => {
		const error = new RelayError('Query failed', 'query');
		expect(isRetryableError(error)).toBe(true);
	});

	it('considers RelayError with publish operation retryable', () => {
		const error = new RelayError('Publish failed', 'publish');
		expect(isRetryableError(error)).toBe(true);
	});

	it('considers timeout errors retryable', () => {
		const error = new Error('Request timeout');
		expect(isRetryableError(error)).toBe(true);
	});

	it('considers network errors retryable', () => {
		const error = new Error('Network error');
		expect(isRetryableError(error)).toBe(true);
	});

	it('considers ECONNREFUSED retryable', () => {
		const error = new Error('ECONNREFUSED');
		expect(isRetryableError(error)).toBe(true);
	});

	it('considers rate limit errors retryable', () => {
		const error = new Error('Rate limit exceeded');
		expect(isRetryableError(error)).toBe(true);
	});

	it('does not consider DecryptionError retryable', () => {
		const error = new DecryptionError('Failed to decrypt');
		expect(isRetryableError(error)).toBe(false);
	});

	it('does not consider AuthError retryable', () => {
		const error = new AuthError('Invalid credentials');
		expect(isRetryableError(error)).toBe(false);
	});

	it('does not consider non-errors retryable', () => {
		expect(isRetryableError('string')).toBe(false);
		expect(isRetryableError(null)).toBe(false);
	});
});

describe('wrapError', () => {
	it('returns RedshiftError unchanged', () => {
		const original = new RelayError('Test', 'query');
		const wrapped = wrapError(original, 'Wrapper message');

		expect(wrapped).toBe(original);
	});

	it('wraps standard Error with message', () => {
		const original = new Error('Original error');
		const wrapped = wrapError(original, 'Operation failed');

		expect(wrapped.message).toBe('Operation failed: Original error');
		expect(wrapped.code).toBe('UNKNOWN_ERROR');
	});

	it('wraps non-error values', () => {
		const wrapped = wrapError('string error', 'Operation failed');

		expect(wrapped.message).toBe('Operation failed: string error');
		expect(wrapped.code).toBe('UNKNOWN_ERROR');
	});
});
