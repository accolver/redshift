/**
 * NIP-98 admin authentication tests for @redshift/bunker
 *
 * Tests the NIP-98 HTTP Auth verification module.
 */

import { describe, expect, it } from 'bun:test';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { AuthorizationError, ValidationError } from '../src/errors';
import { isAdminPubkey, verifyAdminAuth, verifyNip98Auth } from '../src/nip98';

// ─── Test Helpers ───────────────────────────────────────────────────────────

/** Create a valid NIP-98 auth header */
function createNip98AuthHeader(
	secretKey: Uint8Array,
	url: string,
	method: string,
	overrides?: {
		kind?: number;
		createdAt?: number;
		tags?: string[][];
	},
) {
	const now = Math.floor(Date.now() / 1000);
	const tags = overrides?.tags ?? [
		['u', url],
		['method', method],
	];

	const event = finalizeEvent(
		{
			kind: overrides?.kind ?? 27235,
			content: '',
			created_at: overrides?.createdAt ?? now,
			tags,
		},
		secretKey,
	);

	const token = btoa(JSON.stringify(event));
	return `Nostr ${token}`;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('NIP-98 Auth', () => {
	describe('verifyNip98Auth', () => {
		it('verifies a valid NIP-98 auth header', () => {
			const secretKey = generateSecretKey();
			const pubkey = getPublicKey(secretKey);
			const url = 'http://localhost:3333/api/admin/teams';
			const method = 'POST';

			const authHeader = createNip98AuthHeader(secretKey, url, method);
			const result = verifyNip98Auth(authHeader, url, method);

			expect(result.pubkey).toBe(pubkey);
			expect(result.event.kind).toBe(27235);
		});

		it('rejects missing Nostr scheme', () => {
			expect(() => verifyNip98Auth('Bearer token', 'http://localhost/api', 'GET')).toThrow(
				ValidationError,
			);
		});

		it('rejects empty token', () => {
			expect(() => verifyNip98Auth('Nostr ', 'http://localhost/api', 'GET')).toThrow(
				ValidationError,
			);
		});

		it('rejects invalid base64', () => {
			expect(() =>
				verifyNip98Auth('Nostr not-valid-base64!!!', 'http://localhost/api', 'GET'),
			).toThrow(ValidationError);
		});

		it('rejects wrong event kind', () => {
			const secretKey = generateSecretKey();
			const url = 'http://localhost:3333/api/admin/teams';

			const authHeader = createNip98AuthHeader(secretKey, url, 'GET', { kind: 1 });

			expect(() => verifyNip98Auth(authHeader, url, 'GET')).toThrow(AuthorizationError);
		});

		it('rejects URL mismatch', () => {
			const secretKey = generateSecretKey();
			const url = 'http://localhost:3333/api/admin/teams';

			const authHeader = createNip98AuthHeader(secretKey, url, 'GET');

			expect(() =>
				verifyNip98Auth(authHeader, 'http://localhost:3333/api/admin/other', 'GET'),
			).toThrow(AuthorizationError);
		});

		it('rejects method mismatch', () => {
			const secretKey = generateSecretKey();
			const url = 'http://localhost:3333/api/admin/teams';

			const authHeader = createNip98AuthHeader(secretKey, url, 'GET');

			expect(() => verifyNip98Auth(authHeader, url, 'POST')).toThrow(AuthorizationError);
		});

		it('rejects expired timestamp (too old)', () => {
			const secretKey = generateSecretKey();
			const url = 'http://localhost:3333/api/admin/teams';
			const twoMinutesAgo = Math.floor(Date.now() / 1000) - 120;

			const authHeader = createNip98AuthHeader(secretKey, url, 'GET', {
				createdAt: twoMinutesAgo,
			});

			expect(() => verifyNip98Auth(authHeader, url, 'GET')).toThrow(AuthorizationError);
		});

		it('rejects future timestamp (too far ahead)', () => {
			const secretKey = generateSecretKey();
			const url = 'http://localhost:3333/api/admin/teams';
			const twoMinutesAhead = Math.floor(Date.now() / 1000) + 120;

			const authHeader = createNip98AuthHeader(secretKey, url, 'GET', {
				createdAt: twoMinutesAhead,
			});

			expect(() => verifyNip98Auth(authHeader, url, 'GET')).toThrow(AuthorizationError);
		});

		it('accepts timestamp within ±60s window', () => {
			const secretKey = generateSecretKey();
			const pubkey = getPublicKey(secretKey);
			const url = 'http://localhost:3333/api/admin/teams';
			const thirtySecondsAgo = Math.floor(Date.now() / 1000) - 30;

			const authHeader = createNip98AuthHeader(secretKey, url, 'GET', {
				createdAt: thirtySecondsAgo,
			});

			const result = verifyNip98Auth(authHeader, url, 'GET');
			expect(result.pubkey).toBe(pubkey);
		});

		it('rejects missing URL tag', () => {
			const secretKey = generateSecretKey();
			const url = 'http://localhost:3333/api/admin/teams';

			const authHeader = createNip98AuthHeader(secretKey, url, 'GET', {
				tags: [['method', 'GET']],
			});

			expect(() => verifyNip98Auth(authHeader, url, 'GET')).toThrow(AuthorizationError);
		});

		it('rejects missing method tag', () => {
			const secretKey = generateSecretKey();
			const url = 'http://localhost:3333/api/admin/teams';

			const authHeader = createNip98AuthHeader(secretKey, url, 'GET', {
				tags: [['u', url]],
			});

			expect(() => verifyNip98Auth(authHeader, url, 'GET')).toThrow(AuthorizationError);
		});

		it('method comparison is case-insensitive', () => {
			const secretKey = generateSecretKey();
			const pubkey = getPublicKey(secretKey);
			const url = 'http://localhost:3333/api/admin/teams';

			const authHeader = createNip98AuthHeader(secretKey, url, 'get');

			const result = verifyNip98Auth(authHeader, url, 'GET');
			expect(result.pubkey).toBe(pubkey);
		});
	});

	describe('isAdminPubkey', () => {
		it('returns true for admin pubkey', () => {
			const pubkey = getPublicKey(generateSecretKey());
			expect(isAdminPubkey(pubkey, [pubkey])).toBe(true);
		});

		it('returns false for non-admin pubkey', () => {
			const pubkey = getPublicKey(generateSecretKey());
			const otherPubkey = getPublicKey(generateSecretKey());
			expect(isAdminPubkey(pubkey, [otherPubkey])).toBe(false);
		});

		it('returns false for empty admin list', () => {
			const pubkey = getPublicKey(generateSecretKey());
			expect(isAdminPubkey(pubkey, [])).toBe(false);
		});

		it('works with multiple admin pubkeys', () => {
			const pubkey1 = getPublicKey(generateSecretKey());
			const pubkey2 = getPublicKey(generateSecretKey());
			const pubkey3 = getPublicKey(generateSecretKey());

			expect(isAdminPubkey(pubkey2, [pubkey1, pubkey2, pubkey3])).toBe(true);
		});
	});

	describe('verifyAdminAuth', () => {
		it('verifies admin auth successfully', () => {
			const secretKey = generateSecretKey();
			const pubkey = getPublicKey(secretKey);
			const url = 'http://localhost:3333/api/admin/teams';
			const method = 'POST';

			const authHeader = createNip98AuthHeader(secretKey, url, method);
			const result = verifyAdminAuth(authHeader, url, method, [pubkey]);

			expect(result.pubkey).toBe(pubkey);
		});

		it('rejects non-admin pubkey', () => {
			const secretKey = generateSecretKey();
			const otherPubkey = getPublicKey(generateSecretKey());
			const url = 'http://localhost:3333/api/admin/teams';
			const method = 'POST';

			const authHeader = createNip98AuthHeader(secretKey, url, method);

			expect(() => verifyAdminAuth(authHeader, url, method, [otherPubkey])).toThrow(
				AuthorizationError,
			);
		});

		it('rejects with empty admin list', () => {
			const secretKey = generateSecretKey();
			const url = 'http://localhost:3333/api/admin/teams';
			const method = 'POST';

			const authHeader = createNip98AuthHeader(secretKey, url, method);

			expect(() => verifyAdminAuth(authHeader, url, method, [])).toThrow(AuthorizationError);
		});
	});
});
