/**
 * Type definitions for @redshift/bunker
 */

/** Member role within a team */
export type MemberRole = 'owner' | 'admin' | 'developer' | 'readonly';

/** OAuth provider identifiers */
export type OAuthProvider = 'google' | 'github';

/** Team record */
export interface Team {
	readonly id: string;
	readonly name: string;
	readonly slug: string;
	readonly pubkey: string;
	readonly encrypted_nsec: string;
	readonly created_at: number;
	readonly updated_at: number;
}

/** Member record */
export interface Member {
	readonly id: string;
	readonly team_id: string;
	readonly pubkey: string;
	readonly role: MemberRole;
	readonly email: string | null;
	readonly oauth_provider: string | null;
	readonly oauth_subject: string | null;
	readonly joined_at: number;
	readonly invited_by: string | null;
}

/** Identity record (derived Nostr keys for OAuth users) */
export interface Identity {
	readonly id: string;
	readonly team_id: string;
	readonly pubkey: string;
	readonly encrypted_nsec: string;
	readonly label: string | null;
	readonly created_at: number;
}

/** Assignment record (maps members to identities) */
export interface Assignment {
	readonly id: string;
	readonly identity_id: string;
	readonly member_id: string;
	readonly expires_at: number | null;
	readonly created_at: number;
}

/** Session record (active NIP-46 connections) */
export interface Session {
	readonly id: string;
	readonly client_pubkey: string;
	readonly member_id: string;
	readonly team_id: string;
	readonly connected_at: number;
	readonly expires_at: number;
	readonly last_activity: number;
}

/** Audit event record */
export interface AuditEvent {
	readonly id: string;
	readonly team_id: string;
	readonly actor_pubkey: string;
	readonly action: string;
	readonly target: string | null;
	readonly metadata: string | null;
	readonly created_at: number;
}

/** Bunker configuration */
export interface BunkerConfig {
	readonly masterKey: string;
	readonly nostrRelays: readonly string[];
	readonly host: string;
	readonly port: number;
	readonly databaseUrl: string;
	readonly googleClientId: string | null;
	readonly googleClientSecret: string | null;
	readonly githubClientId: string | null;
	readonly githubClientSecret: string | null;
	readonly adminPubkeys: readonly string[];
	readonly sessionTimeout: number;
	readonly publicUrl: string | null;
}

/** Web session record (OAuth HTTP sessions) */
export interface WebSession {
	readonly id: string;
	readonly member_id: string;
	readonly team_id: string;
	readonly created_at: number;
	readonly expires_at: number;
}

/** OAuth user info returned from provider */
export interface OAuthUserInfo {
	readonly provider: OAuthProvider;
	readonly subject: string;
	readonly email: string;
}

/** Identity with assignment info for the identity picker */
export interface IdentityInfo {
	readonly identityId: string;
	readonly teamId: string;
	readonly teamName: string;
	readonly pubkey: string;
	readonly label: string | null;
	readonly role: MemberRole;
}

/** Invitation status */
export type InvitationStatus = 'pending' | 'accepted' | 'expired';

/** Invitation role (owner cannot be invited, only transferred) */
export type InvitableRole = Exclude<MemberRole, 'owner'>;

/** Invitation record */
export interface Invitation {
	readonly id: string;
	readonly team_id: string;
	readonly email: string | null;
	readonly pubkey: string | null;
	readonly role: InvitableRole;
	readonly invited_by: string;
	readonly status: InvitationStatus;
	readonly created_at: number;
	readonly expires_at: number;
}

/** Parameters for creating an invitation */
export interface InviteParams {
	readonly email?: string | undefined;
	readonly pubkey?: string | undefined;
	readonly role: InvitableRole;
}

/** Rotated key record (old team keys preserved for re-encryption) */
export interface RotatedKey {
	readonly id: string;
	readonly team_id: string;
	readonly old_pubkey: string;
	readonly old_encrypted_nsec: string;
	readonly new_pubkey: string;
	readonly rotated_at: number;
	readonly rotated_by: string;
}

/** Encrypted payload format: base64(iv:ciphertext:authTag) */
export interface EncryptedPayload {
	readonly iv: Uint8Array;
	readonly ciphertext: Uint8Array;
	readonly authTag: Uint8Array;
}
