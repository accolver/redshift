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

// Gift Wrap functions
export {
	wrapSecrets,
	unwrapSecrets,
	unwrapGiftWrap,
	createTombstone,
	isRedshiftSecretsEvent,
	getRedshiftSecretsFilter,
	toNostrEvent,
	// Signer-based functions (for NIP-07/NIP-46)
	wrapSecretsWithSigner,
	unwrapGiftWrapWithSigner,
	compareSecretVersions,
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
