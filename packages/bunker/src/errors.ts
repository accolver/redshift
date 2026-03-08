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
