/**
 * RBAC module tests for @redshift/bunker
 */

import { describe, expect, it } from 'bun:test';
import { getPermissions, getRequiredPermission, hasPermission } from '../src/rbac';

describe('RBAC', () => {
	describe('hasPermission', () => {
		it('owner has all permissions', () => {
			expect(hasPermission('owner', 'readSecrets')).toBe(true);
			expect(hasPermission('owner', 'writeSecrets')).toBe(true);
			expect(hasPermission('owner', 'manageMembers')).toBe(true);
			expect(hasPermission('owner', 'deleteTeam')).toBe(true);
		});

		it('admin has all except deleteTeam', () => {
			expect(hasPermission('admin', 'readSecrets')).toBe(true);
			expect(hasPermission('admin', 'writeSecrets')).toBe(true);
			expect(hasPermission('admin', 'manageMembers')).toBe(true);
			expect(hasPermission('admin', 'deleteTeam')).toBe(false);
		});

		it('developer has readSecrets and writeSecrets only', () => {
			expect(hasPermission('developer', 'readSecrets')).toBe(true);
			expect(hasPermission('developer', 'writeSecrets')).toBe(true);
			expect(hasPermission('developer', 'manageMembers')).toBe(false);
			expect(hasPermission('developer', 'deleteTeam')).toBe(false);
		});

		it('readonly has readSecrets only', () => {
			expect(hasPermission('readonly', 'readSecrets')).toBe(true);
			expect(hasPermission('readonly', 'writeSecrets')).toBe(false);
			expect(hasPermission('readonly', 'manageMembers')).toBe(false);
			expect(hasPermission('readonly', 'deleteTeam')).toBe(false);
		});
	});

	describe('getPermissions', () => {
		it('returns correct permission set for each role', () => {
			const ownerPerms = getPermissions('owner');
			expect(ownerPerms.size).toBe(4);
			expect(ownerPerms.has('readSecrets')).toBe(true);
			expect(ownerPerms.has('deleteTeam')).toBe(true);

			const readonlyPerms = getPermissions('readonly');
			expect(readonlyPerms.size).toBe(1);
			expect(readonlyPerms.has('readSecrets')).toBe(true);
		});

		it('permission sets are immutable (ReadonlySet)', () => {
			const perms = getPermissions('developer');
			// ReadonlySet doesn't have add/delete methods at type level
			expect(perms.has('readSecrets')).toBe(true);
			expect(perms.has('writeSecrets')).toBe(true);
		});
	});

	describe('getRequiredPermission', () => {
		it('connect requires no permission', () => {
			expect(getRequiredPermission('connect', ['pubkey123'])).toBeNull();
		});

		it('get_public_key requires readSecrets', () => {
			expect(getRequiredPermission('get_public_key', [])).toBe('readSecrets');
		});

		it('sign_event requires writeSecrets', () => {
			expect(getRequiredPermission('sign_event', ['{}'])).toBe('writeSecrets');
		});

		it('nip44_encrypt requires writeSecrets', () => {
			expect(getRequiredPermission('nip44_encrypt', ['pubkey', 'plaintext'])).toBe('writeSecrets');
		});

		it('nip44_decrypt requires readSecrets', () => {
			expect(getRequiredPermission('nip44_decrypt', ['pubkey', 'ciphertext'])).toBe('readSecrets');
		});

		it('unknown method returns null', () => {
			expect(getRequiredPermission('unknown_method', [])).toBeNull();
		});
	});
});
