/**
 * @redshift/crypto - NIP-59 Gift Wrap cryptographic operations
 *
 * This package provides encrypted secret storage for Redshift using:
 * - NIP-44: Versioned encryption (XChaCha20-Poly1305)
 * - NIP-59: Gift Wrap (rumor -> seal -> gift wrap)
 *
 * Key feature: Adds ["t", "redshift-secrets"] tag to outer events
 * for efficient relay filtering while keeping content encrypted.
 *
 * @example
 * ```typescript
 * import {
 *   wrapSecrets,
 *   unwrapGiftWrap,
 *   getRedshiftSecretsFilter,
 *   createDTag,
 * } from '@redshift/crypto';
 *
 * // Wrap secrets
 * const dTag = createDTag('my-project', 'production');
 * const { event } = wrapSecrets({ API_KEY: 'secret' }, privateKey, dTag);
 *
 * // Query relays
 * const filter = getRedshiftSecretsFilter(pubkey);
 * // { kinds: [1059], "#p": [pubkey], "#t": ["redshift-secrets"] }
 *
 * // Unwrap secrets
 * const result = unwrapGiftWrap(event, privateKey);
 * console.log(result.secrets); // { API_KEY: 'secret' }
 * ```
 */

// Encrypted backup format
export {
	BACKUP_LIMITS,
	BACKUP_V1_HEADER_BYTES,
	encodeBackupPayload,
	decodeBackupPayload,
	encryptBackup,
	decryptBackup,
	validateBackupPayload,
	type BackupEntryV1,
	type BackupPayloadV1,
	type BackupEncryptionOptions,
	type BackupDecryptionOptions,
} from './backup.js';

// Authenticated secret history
export {
	HISTORY_LIMITS,
	createSecretHistoryObservation,
	compareSecretHistoryVersions,
	createHistoryCursor,
	decodeHistoryCursor,
	paginateSecretHistory,
	type SecretHistoryVersion,
	type SecretHistoryObservation,
	type SecretHistoryDiff,
	type SecretHistoryPage,
	type HistoryCursor,
} from './history.js';

// Gift Wrap functions
export {
	wrapSecrets,
	unwrapSecrets,
	unwrapGiftWrap,
	validateGiftWrapEnvelope,
	createTombstone,
	isRedshiftSecretsEvent,
	getRedshiftSecretsFilter,
	toNostrEvent,
	// Signer-based functions (for NIP-07/NIP-46)
	wrapSecretsWithSigner,
	unwrapGiftWrapWithSigner,
	compareSecretVersions,
	validateNip44CiphertextStructure,
	MAX_NIP44_CIPHERTEXT_LENGTH,
	MAX_RUMOR_FUTURE_SKEW_SECONDS,
} from './gift-wrap.js';

// Signer-based and validation types
export type {
	EncryptFn,
	DecryptFn,
	SignFn,
	AsyncGiftWrapResult,
	WrapOptions,
	UnwrapOptions,
} from './gift-wrap.js';

// Utility functions
export {
	validateNsec,
	validateNpub,
	decodeNsec,
	decodeNpub,
	createDTag,
	parseDTag,
} from './utils.js';

// Types
export type {
	NostrEvent,
	UnsignedEvent,
	SecretBundle,
	GiftWrapResult,
	SecretVersion,
	UnwrapResult,
} from './types.js';

// Validation
export { validateSlug, normalizeSlug, type ValidationResult } from './validation.js';

// Constants
export { NostrKinds, REDSHIFT_TYPE_TAG, DEFAULT_RELAYS } from './types.js';

// .env parsing and formatting
export {
	parseEnvFile,
	parseEnvFileDetailed,
	parseEnvValue,
	formatEnvLine,
	type EnvParseIssue,
	type EnvParseResult,
} from './env-parser.js';
