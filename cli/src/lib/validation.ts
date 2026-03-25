/**
 * Input Validation for CLI Commands
 *
 * L1: Syntax-Linter - Input sanitization and validation
 *
 * Validates user inputs for secrets, projects, and environments
 * to prevent invalid data from reaching the relay or causing errors.
 */

import { ValidationError } from './errors';
import { validateSlug as sharedValidateSlug, type ValidationResult } from '@redshift/crypto';

export type { ValidationResult };

/**
 * Secret key validation rules:
 * - Must start with a letter or underscore
 * - Can contain letters, numbers, and underscores
 * - Cannot be empty
 * - Maximum 256 characters (reasonable limit)
 * - Cannot be a reserved shell variable
 */
const RESERVED_KEYS = new Set([
	// POSIX shell reserved
	'PATH',
	'HOME',
	'USER',
	'SHELL',
	'PWD',
	'OLDPWD',
	'IFS',
	'PS1',
	'PS2',
	'PS4',
	// Common system variables that could cause issues
	'LD_LIBRARY_PATH',
	'LD_PRELOAD',
	'DYLD_LIBRARY_PATH',
	'DYLD_INSERT_LIBRARIES',
]);

/**
 * Validate a secret key.
 *
 * Rules:
 * - Must match pattern: ^[A-Za-z_][A-Za-z0-9_]*$
 * - Cannot be empty
 * - Maximum 256 characters
 * - Cannot be a reserved system variable
 *
 * @param key - The secret key to validate
 * @returns ValidationResult with valid flag and optional error
 */
export function validateSecretKey(key: string): ValidationResult {
	if (!key) {
		return { valid: false, error: 'Secret key cannot be empty' };
	}

	if (key.length > 256) {
		return { valid: false, error: 'Secret key cannot exceed 256 characters' };
	}

	// Must match environment variable naming convention
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
		return {
			valid: false,
			error:
				'Secret key must start with a letter or underscore and contain only letters, numbers, and underscores',
		};
	}

	// Check reserved keys (warning, not error - allow override)
	if (RESERVED_KEYS.has(key)) {
		return {
			valid: false,
			error: `'${key}' is a reserved system variable. Using it may cause unexpected behavior.`,
		};
	}

	return { valid: true };
}

/**
 * Validate a project identifier.
 *
 * Delegates to shared slug validation from @redshift/crypto.
 *
 * @param projectId - The project identifier to validate
 * @returns ValidationResult with valid flag and optional error
 */
export function validateProjectId(projectId: string): ValidationResult {
	return sharedValidateSlug(projectId);
}

/**
 * Validate an environment name.
 *
 * Delegates to shared slug validation from @redshift/crypto,
 * with an additional 32-character limit for environments.
 *
 * @param environment - The environment name to validate
 * @returns ValidationResult with valid flag and optional error
 */
export function validateEnvironment(environment: string): ValidationResult {
	const result = sharedValidateSlug(environment);
	if (result.valid && environment.length > 32) {
		return { valid: false, error: 'Environment cannot exceed 32 characters' };
	}
	return result;
}

/**
 * Validate a secret value.
 *
 * Rules:
 * - Can be empty (empty string is valid)
 * - Maximum 64KB (65536 characters)
 * - No null bytes allowed
 *
 * @param value - The secret value to validate
 * @returns ValidationResult with valid flag and optional error
 */
export function validateSecretValue(value: string): ValidationResult {
	if (value.length > 65536) {
		return { valid: false, error: 'Secret value cannot exceed 64KB' };
	}

	if (value.includes('\0')) {
		return { valid: false, error: 'Secret value cannot contain null bytes' };
	}

	return { valid: true };
}

/**
 * Validate relay URL.
 *
 * Rules:
 * - Must be a valid URL
 * - Must use wss:// or ws:// protocol
 * - ws:// only allowed for localhost
 *
 * @param url - The relay URL to validate
 * @returns ValidationResult with valid flag and optional error
 */
export function validateRelayUrl(url: string): ValidationResult {
	if (!url) {
		return { valid: false, error: 'Relay URL cannot be empty' };
	}

	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return { valid: false, error: 'Invalid URL format' };
	}

	if (parsed.protocol !== 'wss:' && parsed.protocol !== 'ws:') {
		return { valid: false, error: 'Relay URL must use wss:// or ws:// protocol' };
	}

	// ws:// only allowed for localhost
	if (parsed.protocol === 'ws:') {
		const host = parsed.hostname.toLowerCase();
		// Handle IPv6 localhost (brackets are stripped by URL parser)
		const isLocalhost =
			host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
		if (!isLocalhost) {
			return {
				valid: false,
				error: 'Unencrypted ws:// connections are only allowed for localhost',
			};
		}
	}

	return { valid: true };
}

/**
 * Normalize a secret key to uppercase (environment variable convention).
 * Call this at command boundaries to match web behavior.
 *
 * @param key - The secret key to normalize
 * @returns Trimmed, uppercased key
 */
export function normalizeSecretKey(key: string): string {
	return key.trim().toUpperCase();
}

/**
 * Redact a secret value for safe display.
 * Always returns a consistent 4-asterisk mask regardless of input.
 *
 * @param _value - The secret value to redact (unused, mask is constant)
 * @returns Redacted string '****'
 */
export function redactValue(_value: string): string {
	return '****';
}

/**
 * Format validation errors for display.
 *
 * @param field - The field name that failed validation
 * @param result - The validation result
 * @returns Formatted error message
 */
export function formatValidationError(field: string, result: ValidationResult): string {
	return `Invalid ${field}: ${result.error}`;
}

/**
 * Validate all inputs and throw on first error.
 *
 * @param validations - Array of [field, value, validator] tuples
 * @throws Error if any validation fails
 */
export function validateAll(
	validations: Array<[string, string, (v: string) => ValidationResult]>,
): void {
	for (const [field, value, validator] of validations) {
		const result = validator(value);
		if (!result.valid) {
			throw new ValidationError(formatValidationError(field, result));
		}
	}
}
