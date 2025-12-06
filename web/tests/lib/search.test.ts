/**
 * Fuzzy Search Utilities Tests
 *
 * L2: Function-Author - Search utilities for secret keys
 */

import { describe, expect, it } from 'vitest';
import { fuzzyMatch, matchScore, searchAndSort } from '$lib/utils/search';

describe('Search Utilities', () => {
	describe('fuzzyMatch', () => {
		it('returns true for empty query', () => {
			expect(fuzzyMatch('GOOGLE_CLIENT_ID', '')).toBe(true);
			expect(fuzzyMatch('GOOGLE_CLIENT_ID', '   ')).toBe(true);
		});

		it('matches exact text (case-insensitive)', () => {
			expect(fuzzyMatch('GOOGLE_CLIENT_ID', 'google_client_id')).toBe(true);
			expect(fuzzyMatch('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_ID')).toBe(true);
		});

		it('treats spaces in query as underscores', () => {
			expect(fuzzyMatch('GOOGLE_CLIENT_ID', 'client id')).toBe(true);
			expect(fuzzyMatch('GOOGLE_CLIENT_ID', 'google client')).toBe(true);
			expect(fuzzyMatch('GOOGLE_CLIENT_ID', 'google client id')).toBe(true);
		});

		it('matches partial text', () => {
			expect(fuzzyMatch('GOOGLE_CLIENT_ID', 'client')).toBe(true);
			expect(fuzzyMatch('GOOGLE_CLIENT_ID', 'google')).toBe(true);
			expect(fuzzyMatch('GOOGLE_CLIENT_ID', 'id')).toBe(true);
		});

		it('matches when all query parts exist in text', () => {
			expect(fuzzyMatch('GOOGLE_CLIENT_ID', 'google id')).toBe(true);
			expect(fuzzyMatch('DATABASE_URL', 'data url')).toBe(true);
			expect(fuzzyMatch('STRIPE_SECRET_KEY', 'stripe key')).toBe(true);
		});

		it('returns false when query parts are missing', () => {
			expect(fuzzyMatch('GOOGLE_CLIENT_ID', 'facebook')).toBe(false);
			expect(fuzzyMatch('GOOGLE_CLIENT_ID', 'client secret')).toBe(false);
			expect(fuzzyMatch('DATABASE_URL', 'database password')).toBe(false);
		});

		it('handles multiple spaces in query', () => {
			expect(fuzzyMatch('GOOGLE_CLIENT_ID', 'client    id')).toBe(true);
			expect(fuzzyMatch('GOOGLE_CLIENT_ID', '  client  ')).toBe(true);
		});

		it('handles mixed underscores and spaces in query', () => {
			expect(fuzzyMatch('GOOGLE_CLIENT_ID', 'client_id')).toBe(true);
			expect(fuzzyMatch('GOOGLE_CLIENT_ID', 'google_client id')).toBe(true);
		});
	});

	describe('matchScore', () => {
		it('returns 0 for empty query', () => {
			expect(matchScore('GOOGLE_CLIENT_ID', '')).toBe(0);
			expect(matchScore('GOOGLE_CLIENT_ID', '   ')).toBe(0);
		});

		it('returns 100 for exact match', () => {
			expect(matchScore('client_id', 'client_id')).toBe(100);
			expect(matchScore('CLIENT_ID', 'client id')).toBe(100);
		});

		it('returns 90 for starts-with match', () => {
			expect(matchScore('GOOGLE_CLIENT_ID', 'google')).toBe(90);
			expect(matchScore('GOOGLE_CLIENT_ID', 'google client')).toBe(90);
		});

		it('returns 80 for contains match', () => {
			expect(matchScore('GOOGLE_CLIENT_ID', 'client')).toBe(80);
			expect(matchScore('GOOGLE_CLIENT_ID', 'client id')).toBe(80);
		});

		it('returns 70 for all-parts-in-order match', () => {
			expect(matchScore('GOOGLE_CLIENT_ID', 'google id')).toBe(70);
			expect(matchScore('STRIPE_SECRET_KEY', 'stripe key')).toBe(70);
		});

		it('returns 60 for all-parts-exist match (not in order)', () => {
			expect(matchScore('GOOGLE_CLIENT_ID', 'id google')).toBe(60);
			expect(matchScore('STRIPE_SECRET_KEY', 'key stripe')).toBe(60);
		});

		it('returns -1 for no match', () => {
			expect(matchScore('GOOGLE_CLIENT_ID', 'facebook')).toBe(-1);
			expect(matchScore('GOOGLE_CLIENT_ID', 'xyz')).toBe(-1);
		});

		it('handles real-world secret key patterns', () => {
			// Common search patterns
			expect(matchScore('AWS_ACCESS_KEY_ID', 'aws key')).toBeGreaterThan(0);
			expect(matchScore('AWS_SECRET_ACCESS_KEY', 'aws secret')).toBeGreaterThan(0);
			expect(matchScore('DATABASE_URL', 'db url')).toBe(-1); // "db" is not in "database"
			expect(matchScore('DATABASE_URL', 'database')).toBe(90); // starts with
			expect(matchScore('NEXT_PUBLIC_API_URL', 'api url')).toBeGreaterThan(0);
		});
	});

	describe('searchAndSort', () => {
		const secrets = [
			{ key: 'GOOGLE_CLIENT_ID', value: 'abc' },
			{ key: 'GOOGLE_CLIENT_SECRET', value: 'def' },
			{ key: 'GITHUB_CLIENT_ID', value: 'ghi' },
			{ key: 'DATABASE_URL', value: 'jkl' },
			{ key: 'API_KEY', value: 'mno' },
		];

		it('returns all items for empty query', () => {
			const result = searchAndSort(secrets, '', (s) => s.key);
			expect(result).toHaveLength(5);
		});

		it('filters items that match query', () => {
			const result = searchAndSort(secrets, 'client', (s) => s.key);
			expect(result).toHaveLength(3);
			expect(result.map((s) => s.key)).toContain('GOOGLE_CLIENT_ID');
			expect(result.map((s) => s.key)).toContain('GOOGLE_CLIENT_SECRET');
			expect(result.map((s) => s.key)).toContain('GITHUB_CLIENT_ID');
		});

		it('sorts by match score (exact matches first)', () => {
			const result = searchAndSort(secrets, 'api key', (s) => s.key);
			expect(result[0].key).toBe('API_KEY'); // Exact match should be first
		});

		it('handles spaces as underscores in search', () => {
			const result = searchAndSort(secrets, 'client id', (s) => s.key);
			expect(result).toHaveLength(2);
			expect(result.map((s) => s.key)).toContain('GOOGLE_CLIENT_ID');
			expect(result.map((s) => s.key)).toContain('GITHUB_CLIENT_ID');
		});

		it('filters out non-matching items', () => {
			const result = searchAndSort(secrets, 'facebook', (s) => s.key);
			expect(result).toHaveLength(0);
		});

		it('works with custom getText function', () => {
			const items = [
				{ name: 'Production', slug: 'prod' },
				{ name: 'Staging', slug: 'stg' },
				{ name: 'Development', slug: 'dev' },
			];

			const result = searchAndSort(items, 'prod', (item) => item.name + ' ' + item.slug);
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('Production');
		});
	});

	describe('real-world search scenarios', () => {
		const secrets = [
			{ key: 'GOOGLE_CLIENT_ID', value: '' },
			{ key: 'GOOGLE_CLIENT_SECRET', value: '' },
			{ key: 'GOOGLE_OAUTH_CALLBACK_URL', value: '' },
			{ key: 'STRIPE_SECRET_KEY', value: '' },
			{ key: 'STRIPE_PUBLISHABLE_KEY', value: '' },
			{ key: 'DATABASE_URL', value: '' },
			{ key: 'REDIS_URL', value: '' },
			{ key: 'JWT_SECRET', value: '' },
			{ key: 'AWS_ACCESS_KEY_ID', value: '' },
			{ key: 'AWS_SECRET_ACCESS_KEY', value: '' },
		];

		it('finds secrets with space-separated search terms', () => {
			// User types "client id" expecting to find CLIENT_ID
			const result = searchAndSort(secrets, 'client id', (s) => s.key);
			expect(result.map((s) => s.key)).toContain('GOOGLE_CLIENT_ID');
		});

		it('finds secrets with partial matches', () => {
			// User types "stripe" to find all Stripe-related keys
			const result = searchAndSort(secrets, 'stripe', (s) => s.key);
			expect(result).toHaveLength(2);
		});

		it('finds secrets with multiple search terms', () => {
			// User types "aws key" to find AWS keys
			const result = searchAndSort(secrets, 'aws key', (s) => s.key);
			expect(result).toHaveLength(2);
			expect(result.map((s) => s.key)).toContain('AWS_ACCESS_KEY_ID');
			expect(result.map((s) => s.key)).toContain('AWS_SECRET_ACCESS_KEY');
		});

		it('ranks exact substring matches higher', () => {
			// "secret" should rank STRIPE_SECRET_KEY and JWT_SECRET higher
			const result = searchAndSort(secrets, 'secret', (s) => s.key);
			expect(result.length).toBeGreaterThan(0);
			// All results should contain "secret"
			result.forEach((s) => {
				expect(s.key.toLowerCase()).toContain('secret');
			});
		});
	});
});
