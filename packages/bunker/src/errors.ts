/**
 * Custom error types for @redshift/bunker
 */

/** Error thrown when encryption or decryption fails */
export class EncryptionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'EncryptionError';
	}
}

/** Error thrown when configuration is invalid or missing */
export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigError';
	}
}

/** Error thrown when database operations fail */
export class DatabaseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DatabaseError';
	}
}

/** Error thrown when OAuth authentication fails */
export class OAuthError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'OAuthError';
	}
}

/** Error thrown when session validation fails */
export class SessionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SessionError';
	}
}

/** Error thrown when a team operation is not authorized */
export class AuthorizationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AuthorizationError';
	}
}

/** Error thrown when a requested resource is not found */
export class NotFoundError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'NotFoundError';
	}
}

/** Error thrown when an operation conflicts with existing state */
export class ConflictError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConflictError';
	}
}

/** Error thrown when input validation fails */
export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ValidationError';
	}
}
