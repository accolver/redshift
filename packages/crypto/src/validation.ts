/**
 * Shared Validation for Redshift Slugs
 *
 * Provides unified slug validation and normalization used by both
 * CLI and Web packages. Project IDs, environment names, and other
 * identifiers all follow slug conventions.
 *
 * Rules:
 * - Lowercase letters, numbers, and hyphens only
 * - Cannot start or end with a hyphen
 * - No consecutive hyphens
 * - 1-64 characters
 */

/**
 * Result of a validation check
 */
export interface ValidationResult {
	valid: boolean;
	error?: string;
}

/**
 * Validate a slug identifier.
 *
 * @param slug - The slug string to validate
 * @returns ValidationResult with valid flag and optional error message
 */
export function validateSlug(slug: string): ValidationResult {
	if (!slug) {
		return { valid: false, error: 'Slug cannot be empty' };
	}

	if (slug.length > 64) {
		return { valid: false, error: 'Slug cannot exceed 64 characters' };
	}

	if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
		return {
			valid: false,
			error:
				'Must contain only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen',
		};
	}

	if (/--/.test(slug)) {
		return { valid: false, error: 'Cannot contain consecutive hyphens' };
	}

	return { valid: true };
}

/**
 * Normalize an arbitrary string into a slug-like format.
 *
 * Lowercases, replaces invalid characters with hyphens, and
 * collapses consecutive hyphens. Does NOT strip leading/trailing
 * hyphens so callers can decide how to handle them.
 *
 * @param input - The raw string to normalize
 * @returns A normalized slug string
 */
export function normalizeSlug(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-+/g, '-');
}
