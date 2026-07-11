/**
 * Cryptographic operations for Redshift CLI
 *
 * Re-exports from @redshift/crypto shared package with CLI-specific additions.
 *
 * L2: Function-Author - Core cryptographic functions
 * L4: Integration-Contractor - NIP-59 protocol compliance
 */

// Re-export everything from shared crypto package
export {
	BACKUP_LIMITS,
	BACKUP_V1_HEADER_BYTES,
	encodeBackupPayload,
	decodeBackupPayload,
	encryptBackup,
	decryptBackup,
	validateBackupPayload,
	wrapSecrets,
	unwrapSecrets,
	unwrapGiftWrap,
	validateGiftWrapEnvelope,
	createTombstone,
	wrapSecretsWithSigner,
	unwrapGiftWrapWithSigner,
	compareSecretVersions,
	MAX_RUMOR_FUTURE_SKEW_SECONDS,
	isRedshiftSecretsEvent,
	getRedshiftSecretsFilter,
	toNostrEvent,
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
	BackupEntryV1,
	BackupPayloadV1,
	BackupEncryptionOptions,
	BackupDecryptionOptions,
	NostrEvent,
	UnsignedEvent,
	SecretBundle,
	GiftWrapResult,
	SecretVersion,
	UnwrapResult,
	AsyncGiftWrapResult,
	WrapOptions,
	UnwrapOptions,
} from '@redshift/crypto';
