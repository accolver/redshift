/**
 * Validation Function Tests for @redshift/crypto
 */

import { describe, it, expect } from 'bun:test';
import { validateSlug, normalizeSlug } from '../src/validation';

describe('validateSlug', () => {
	it('accepts valid slugs', () => {
		expect(validateSlug('my-project').valid).toBe(true);
		expect(validateSlug('api').valid).toBe(true);
		expect(validateSlug('dev').valid).toBe(true);
		expect(validateSlug('a1').valid).toBe(true);
	});

	it('rejects empty', () => {
		expect(validateSlug('').valid).toBe(false);
	});

	it('rejects uppercase', () => {
		expect(validateSlug('MyProject').valid).toBe(false);
	});

	it('rejects consecutive hyphens', () => {
		expect(validateSlug('my--project').valid).toBe(false);
	});

	it('enforces max 64 characters', () => {
		expect(validateSlug('a'.repeat(64)).valid).toBe(true);
		expect(validateSlug('a'.repeat(65)).valid).toBe(false);
	});

	it('rejects starting/ending with hyphen', () => {
		expect(validateSlug('-foo').valid).toBe(false);
		expect(validateSlug('foo-').valid).toBe(false);
	});

	it('accepts single character slugs', () => {
		expect(validateSlug('a').valid).toBe(true);
		expect(validateSlug('1').valid).toBe(true);
	});

	it('rejects special characters', () => {
		expect(validateSlug('my_project').valid).toBe(false);
		expect(validateSlug('my project').valid).toBe(false);
		expect(validateSlug('my.project').valid).toBe(false);
	});

	it('returns descriptive error messages', () => {
		const empty = validateSlug('');
		expect(empty.error).toBeDefined();
		expect(empty.error).toContain('empty');

		const tooLong = validateSlug('a'.repeat(65));
		expect(tooLong.error).toBeDefined();
		expect(tooLong.error).toContain('64');

		const badChars = validateSlug('MyProject');
		expect(badChars.error).toBeDefined();
	});
});

describe('normalizeSlug', () => {
	it('lowercases input', () => {
		expect(normalizeSlug('MyProject')).toBe('myproject');
	});

	it('replaces invalid chars with hyphens', () => {
		expect(normalizeSlug('my project!')).toBe('my-project-');
	});

	it('collapses multiple hyphens', () => {
		expect(normalizeSlug('a---b')).toBe('a-b');
	});

	it('preserves valid slugs', () => {
		expect(normalizeSlug('my-project')).toBe('my-project');
	});

	it('handles empty string', () => {
		expect(normalizeSlug('')).toBe('');
	});
});
