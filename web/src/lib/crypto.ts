/**
 * Cryptographic operations for Redshift Web
 *
 * Re-exports from @redshift/crypto shared package.
 *
 * This module provides end-to-end encryption for secrets using:
 * - NIP-44: Versioned encryption (XChaCha20-Poly1305)
 * - NIP-59: Gift Wrap (rumor -> seal -> gift wrap)
 */

// Re-export everything from shared crypto package
export {
	wrapSecrets,
	unwrapSecrets,
	unwrapGiftWrap,
	createTombstone,
	isRedshiftSecretsEvent,
	getRedshiftSecretsFilter,
	validateNsec,
	validateNpub,
	decodeNsec,
	decodeNpub,
	createDTag,
	parseDTag,
	NostrKinds,
	REDSHIFT_TYPE_TAG,
} from '@redshift/crypto';

export type {
	NostrEvent,
	UnsignedEvent,
	SecretBundle,
	GiftWrapResult,
	UnwrapResult,
} from '@redshift/crypto';
