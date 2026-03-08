/**
 * Role-Based Access Control (RBAC) for @redshift/bunker
 *
 * Defines the permission matrix for team member roles and provides
 * permission checking utilities for NIP-46 request authorization.
 *
 * Permission matrix:
 *   owner:     readSecrets, writeSecrets, manageMembers, deleteTeam
 *   admin:     readSecrets, writeSecrets, manageMembers
 *   developer: readSecrets, writeSecrets
 *   readonly:  readSecrets
 */

import type { Permission } from './nip46-types.js';
import type { MemberRole } from './types.js';

/** Permission sets for each role, ordered from most to least privileged */
const ROLE_PERMISSIONS: Record<MemberRole, ReadonlySet<Permission>> = {
	owner: new Set<Permission>(['readSecrets', 'writeSecrets', 'manageMembers', 'deleteTeam']),
	admin: new Set<Permission>(['readSecrets', 'writeSecrets', 'manageMembers']),
	developer: new Set<Permission>(['readSecrets', 'writeSecrets']),
	readonly: new Set<Permission>(['readSecrets']),
};

/**
 * Check whether a role has a specific permission.
 *
 * @param role - The member's role
 * @param permission - The permission to check
 * @returns true if the role grants the permission
 */
export function hasPermission(role: MemberRole, permission: Permission) {
	const permissions = ROLE_PERMISSIONS[role];
	return permissions.has(permission);
}

/**
 * Get all permissions granted to a role.
 *
 * @param role - The member's role
 * @returns Read-only set of permissions
 */
export function getPermissions(role: MemberRole) {
	return ROLE_PERMISSIONS[role];
}

/**
 * Determine the required permission for a NIP-46 method and its parameters.
 *
 * Permission mapping:
 *   - sign_event (Kind 1059/30078) → writeSecrets (publishing encrypted secrets)
 *   - sign_event (other kinds) → writeSecrets (general signing)
 *   - nip44_decrypt → readSecrets (reading existing encrypted data)
 *   - nip44_encrypt → writeSecrets (creating new encrypted data)
 *   - get_public_key → readSecrets (basic team info)
 *   - connect → null (no permission needed, handled by session creation)
 *
 * @param method - The NIP-46 method name
 * @param _params - The method parameters (used for future kind-specific checks)
 * @returns The required permission, or null if no permission check is needed
 */
export function getRequiredPermission(
	method: string,
	_params: readonly string[],
): Permission | null {
	switch (method) {
		case 'connect':
			return null; // Handled by session creation / authorized list check
		case 'get_public_key':
			return 'readSecrets';
		case 'sign_event':
			return 'writeSecrets';
		case 'nip44_encrypt':
			return 'writeSecrets';
		case 'nip44_decrypt':
			return 'readSecrets';
		default:
			return null;
	}
}
