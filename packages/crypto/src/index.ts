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
	// Signer-based functions (for NIP-07/NIP-46)
	wrapSecretsWithSigner,
	unwrapGiftWrapWithSigner,
} from './gift-wrap.js';

// Signer-based types
export type { EncryptFn, DecryptFn, AsyncGiftWrapResult } from './gift-wrap.js';

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
	UnwrapResult,
} from './types.js';

// Constants
export { NostrKinds, REDSHIFT_TYPE_TAG } from './types.js';
