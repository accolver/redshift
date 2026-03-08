/**
 * @redshift/bunker - NIP-46 bunker service for Redshift Teams
 *
 * This package provides the core infrastructure for the Teams tier:
 * - SQLite database schema for teams, members, identities, sessions
 * - AES-256-GCM encryption for NSEC storage at rest
 * - Configuration loading and validation from environment variables
 *
 * @example
 * ```typescript
 * import {
 *   openDatabase,
 *   encrypt,
 *   decrypt,
 *   loadConfig,
 * } from '@redshift/bunker';
 *
 * // Load config from environment
 * const config = loadConfig();
 *
 * // Open database with schema initialization
 * const db = openDatabase(config.databaseUrl);
 *
 * // Encrypt a team's private key
 * const encrypted = encrypt(nsec, config.masterKey);
 *
 * // Decrypt when needed for signing
 * const nsec = decrypt(encrypted, config.masterKey);
 * ```
 */

// Database
export {
	openDatabase,
	listTables,
	hasAllTables,
	getTableColumns,
	EXPECTED_TABLES,
} from './database.js';

// Encryption
export {
	encrypt,
	decrypt,
	generateMasterKey,
	parseMasterKey,
} from './encryption.js';

// Configuration
export { loadConfig, parseDuration } from './config.js';

// NIP-46 Server
export { BunkerServer, parseNip46Request } from './nip46-server.js';
export type { PublishFn } from './nip46-server.js';

// Session Management
export { SessionManager } from './session-manager.js';
export type { ActiveSession, CreateSessionOptions } from './session-manager.js';

// RBAC
export { hasPermission, getPermissions, getRequiredPermission } from './rbac.js';

// Team Service
export { TeamService } from './team-service.js';

// Team Secret Service
export { TeamSecretService } from './team-secret-service.js';

// Team Metadata
export { createTeamMetadataEvent } from './team-metadata.js';

// NIP-98 Admin Auth
export { verifyNip98Auth, verifyAdminAuth, isAdminPubkey } from './nip98.js';
export type { Nip98AuthResult } from './nip98.js';

// Errors
export {
	EncryptionError,
	ConfigError,
	DatabaseError,
	OAuthError,
	SessionError,
	AuthorizationError,
	NotFoundError,
	ConflictError,
	ValidationError,
} from './errors.js';

// NIP-46 Types
export { NIP46_KIND } from './nip46-types.js';
export type {
	Nip46Method,
	Nip46Request,
	Nip46Response,
	Nip46ErrorResponse,
	Nip46ServerConfig,
	TeamKeyInfo,
	Nip46RequestContext,
	Permission,
} from './nip46-types.js';

// Key Derivation
export { deriveNostrKey } from './key-derivation.js';

// OAuth
export {
	buildGoogleAuthUrl,
	buildGithubAuthUrl,
	exchangeGoogleCode,
	exchangeGithubCode,
	generateCodeVerifier,
	computeCodeChallenge,
	generateState,
	consumePendingState,
	clearPendingStates,
	setOAuthFetch,
	resetOAuthFetch,
} from './oauth.js';
export type { OAuthState } from './oauth.js';

// Web Session Management
export { WebSessionManager, SESSION_COOKIE_NAME } from './web-session.js';

// HTTP Server
export { createHttpServer } from './http-server.js';
export type { HttpServerConfig } from './http-server.js';

// Types
export type {
	Team,
	Member,
	Identity,
	Assignment,
	Session,
	AuditEvent,
	BunkerConfig,
	EncryptedPayload,
	MemberRole,
	OAuthProvider,
	WebSession,
	OAuthUserInfo,
	IdentityInfo,
	Invitation,
	InvitationStatus,
	InvitableRole,
	InviteParams,
	RotatedKey,
} from './types.js';
