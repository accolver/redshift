/**
 * Custom Error Types for Redshift CLI
 *
 * L2: Function-Author - Error handling utilities
 *
 * Provides specific error types to distinguish between different
 * failure modes and enable appropriate error recovery.
 */

/**
 * Base class for all Redshift errors
 */
export class RedshiftError extends Error {
	readonly code: string;

	constructor(message: string, code: string) {
		super(message);
		this.name = 'RedshiftError';
		this.code = code;
	}
}

/**
 * Relay communication errors (connection, publish, query failures)
 */
export class RelayError extends RedshiftError {
	readonly operation: 'connect' | 'publish' | 'query' | 'subscribe';
	readonly originalError: Error | undefined;

	constructor(
		message: string,
		operation: 'connect' | 'publish' | 'query' | 'subscribe',
		originalError?: Error,
	) {
		super(message, 'RELAY_ERROR');
		this.name = 'RelayError';
		this.operation = operation;
		this.originalError = originalError;
	}
}

/**
 * Decryption/unwrapping errors (NIP-59 Gift Wrap failures)
 */
export class DecryptionError extends RedshiftError {
	readonly eventId: string | undefined;
	readonly originalError: Error | undefined;

	constructor(message: string, eventId?: string, originalError?: Error) {
		super(message, 'DECRYPTION_ERROR');
		this.name = 'DecryptionError';
		this.eventId = eventId;
		this.originalError = originalError;
	}
}

/**
 * Authentication errors (login, key management)
 */
export class AuthError extends RedshiftError {
	readonly method: 'nsec' | 'bunker' | 'nip07' | undefined;
	readonly originalError: Error | undefined;

	constructor(message: string, method?: 'nsec' | 'bunker' | 'nip07', originalError?: Error) {
		super(message, 'AUTH_ERROR');
		this.name = 'AuthError';
		this.method = method;
		this.originalError = originalError;
	}
}

/**
 * Configuration errors (missing config, invalid config)
 */
export class ConfigError extends RedshiftError {
	readonly configPath: string | undefined;

	constructor(message: string, configPath?: string) {
		super(message, 'CONFIG_ERROR');
		this.name = 'ConfigError';
		this.configPath = configPath;
	}
}

/**
 * Connection state error (operation requires connection)
 */
export class NotConnectedError extends RedshiftError {
	constructor(message = 'Not connected to relays. Call connect() first.') {
		super(message, 'NOT_CONNECTED');
		this.name = 'NotConnectedError';
	}
}

/**
 * Format user-friendly error message from any error
 */
export function formatError(error: unknown): string {
	if (error instanceof RedshiftError) {
		return `[${error.code}] ${error.message}`;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

/**
 * Check if an error is retryable (transient network issues)
 */
export function isRetryableError(error: unknown): boolean {
	if (error instanceof RelayError) {
		// Network errors are generally retryable
		return error.operation === 'query' || error.operation === 'publish';
	}
	if (error instanceof Error) {
		const msg = error.message.toLowerCase();
		return (
			msg.includes('timeout') ||
			msg.includes('network') ||
			msg.includes('econnrefused') ||
			msg.includes('enotfound') ||
			msg.includes('rate limit')
		);
	}
	return false;
}

/**
 * Wrap an unknown error as a RedshiftError if needed
 */
export function wrapError(error: unknown, defaultMessage: string): RedshiftError {
	if (error instanceof RedshiftError) {
		return error;
	}
	if (error instanceof Error) {
		return new RedshiftError(`${defaultMessage}: ${error.message}`, 'UNKNOWN_ERROR');
	}
	return new RedshiftError(`${defaultMessage}: ${String(error)}`, 'UNKNOWN_ERROR');
}
