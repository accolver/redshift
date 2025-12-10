/**
 * @redshift/cloud - Cloud tier access tokens and audit logging for Redshift
 *
 * This package provides:
 * - Access token generation and validation (NIP-78 + NIP-59)
 * - Audit event creation (NIP-78 + NIP-44)
 * - Cloud tier types and constants
 *
 * @example
 * ```typescript
 * import {
 *   createAccessToken,
 *   validateAccessToken,
 *   getAccessTokenFilter,
 *   CloudDTags,
 * } from '@redshift/cloud';
 *
 * // Generate an access token after payment
 * const { event, token } = createAccessToken(
 *   userPubkey,
 *   operatorNsec,
 *   invoiceId,
 * );
 *
 * // Publish event to relay
 * await relay.publish(event);
 *
 * // Query for user's access token
 * const filter = getAccessTokenFilter(userPubkey);
 * ```
 */

// Access token functions
export {
	createAccessToken,
	validateAccessToken,
	isTokenExpired,
	getDaysUntilExpiry,
	getAccessTokenFilter,
} from './access-token';

// Audit event functions
export {
	createAuditEvent,
	unwrapAuditEvent,
	getAuditEventFilter,
	getAuditActionLabel,
	type CreateAuditEventOptions,
	type CreateAuditEventResult,
} from './audit';

// Types and constants
export {
	CloudKinds,
	CloudDTags,
	CloudTypeTags,
	type CloudTier,
	type AccessToken,
	type AccessTokenContent,
	type AuditAction,
	type AuditDetails,
	type AuditEvent,
	type CreateTokenResult,
	type ValidateTokenResult,
	type SignedEvent,
	type UnsignedEvent,
} from './types';
