/**
 * Types for Redshift Cloud tier
 *
 * Access tokens and audit logs are stored as NIP-78 events (Kind 30078)
 * wrapped in NIP-59 Gift Wrap for privacy.
 */

/**
 * Nostr event kinds used by Redshift Cloud
 */
export const CloudKinds = {
	/** NIP-78: Arbitrary custom app data (addressable) */
	APP_DATA: 30078,
	/** NIP-59: Gift Wrap */
	GIFT_WRAP: 1059,
	/** NIP-59: Seal */
	SEAL: 13,
} as const;

/**
 * D-tag prefixes for Redshift Cloud events (reverse-DNS notation)
 */
export const CloudDTags = {
	/** Access token d-tag */
	ACCESS_TOKEN: 'com.redshiftapp.access-token',
	/** Audit log d-tag prefix (append timestamp) */
	AUDIT_PREFIX: 'com.redshiftapp.audit',
} as const;

/**
 * Type tags for filtering Redshift events
 */
export const CloudTypeTags = {
	/** Cloud subscription access token */
	CLOUD: 'redshift-cloud',
	/** Audit log event */
	AUDIT: 'redshift-audit',
} as const;

/**
 * Cloud subscription tiers
 */
export type CloudTier = 'cloud' | 'teams' | 'enterprise';

/**
 * Access token content stored in NIP-78 event
 */
export interface AccessTokenContent {
	/** Token issue timestamp (Unix seconds) */
	issuedAt: number;
	/** Managed relay URL */
	relayUrl: string;
	/** Relay operator signature for verification */
	signature: string;
}

/**
 * Access token event schema (inner rumor before NIP-59 wrapping)
 *
 * Kind: 30078 (NIP-78)
 * Tags:
 *   - d: "com.redshiftapp.access-token"
 *   - t: "redshift-cloud"
 *   - tier: "cloud" | "teams" | "enterprise"
 *   - expires: Unix timestamp (seconds)
 *   - invoice: BTCPay invoice ID
 */
export interface AccessToken {
	/** Subscription tier */
	tier: CloudTier;
	/** Expiration timestamp (Unix seconds) */
	expiresAt: number;
	/** BTCPay invoice ID that created this token */
	invoiceId: string;
	/** Token content */
	content: AccessTokenContent;
	/** User's Nostr pubkey (hex) */
	pubkey: string;
	/** Token creation timestamp */
	createdAt: number;
}

/**
 * Audit action types
 */
export type AuditAction =
	| 'secret:create'
	| 'secret:update'
	| 'secret:delete'
	| 'secret:read'
	| 'subscription:start'
	| 'subscription:renew'
	| 'subscription:cancel';

/**
 * Audit event details (encrypted in content)
 */
export interface AuditDetails {
	/** Human-readable description */
	description?: string;
	/** IP address (hashed for privacy) */
	ipHash?: string;
	/** User agent */
	userAgent?: string;
	/** Additional context */
	context?: Record<string, unknown>;
}

/**
 * Audit event schema (inner rumor before NIP-59 wrapping)
 *
 * Kind: 30078 (NIP-78)
 * Tags:
 *   - d: "com.redshiftapp.audit.{timestamp}"
 *   - t: "redshift-audit"
 *   - action: AuditAction
 *   - target: project ID or resource identifier
 *   - expiration: Unix timestamp (7 days from creation, per NIP-40)
 */
export interface AuditEvent {
	/** Action performed */
	action: AuditAction;
	/** Target resource (project ID, etc.) */
	target: string;
	/** Event timestamp */
	timestamp: number;
	/** Encrypted details */
	details?: AuditDetails;
	/** User's pubkey */
	pubkey: string;
}

/**
 * Unsigned Nostr event (rumor)
 */
export interface UnsignedEvent {
	kind: number;
	pubkey: string;
	created_at: number;
	tags: string[][];
	content: string;
}

/**
 * Signed Nostr event
 */
export interface SignedEvent extends UnsignedEvent {
	id: string;
	sig: string;
}

/**
 * Result of creating an access token
 */
export interface CreateTokenResult {
	/** The wrapped Gift Wrap event to publish */
	event: SignedEvent;
	/** The inner access token data */
	token: AccessToken;
}

/**
 * Result of validating an access token
 */
export interface ValidateTokenResult {
	/** Whether the token is valid */
	valid: boolean;
	/** Reason if invalid */
	reason?: string;
	/** The token if valid */
	token?: AccessToken;
}
