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

// Errors
export { EncryptionError, ConfigError, DatabaseError } from './errors.js';

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
} from './types.js';
