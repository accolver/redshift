import { scryptAsync } from '@noble/hashes/scrypt.js';
import { validateSlug } from './validation.js';

export const BACKUP_V1_HEADER_BYTES = 64;
const BACKUP_MAGIC = new TextEncoder().encode('REDSHIFT');
const BACKUP_VERSION = 1;
const BACKUP_SUITE = 1;
const SCRYPT_N = 131_072;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAX_MEMORY = 256 * 1024 * 1024;
const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const GCM_TAG_BYTES = 16;
const PUBKEY_PATTERN = /^[0-9a-f]{64}$/;
const EVENT_ID_PATTERN = /^[0-9a-f]{64}$/;
const SECRET_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const DANGEROUS_SECRET_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const BACKUP_LIMITS = {
	maxPlaintextBytes: 16 * 1024 * 1024,
	maxArchiveBytes: 16 * 1024 * 1024 + BACKUP_V1_HEADER_BYTES + GCM_TAG_BYTES,
	maxPassphraseBytes: 1024,
	minCreatePassphraseBytes: 12,
	maxEntries: 4096,
	maxSecretsPerEntry: 4096,
	maxTotalSecrets: 65_536,
	maxSecretKeyLength: 256,
	maxSecretValueBytes: 64 * 1024,
} as const;

export interface BackupEntryV1 {
	project: string;
	environment: string;
	sourceCreatedAt: number;
	sourceEventId: string;
	secrets: Array<[string, string]>;
}

export interface BackupPayloadV1 {
	schema: 'com.redshiftapp.backup';
	version: 1;
	createdAt: number;
	sourcePubkey: string;
	contents: {
		secretState: 'current-observed';
		projectMetadata: 'identifiers-only';
		relayConfiguration: 'excluded';
		signerCredentials: 'excluded';
		historyAndTombstones: 'excluded';
	};
	entries: BackupEntryV1[];
}

type DeriveKey = (passphrase: Uint8Array, salt: Uint8Array) => Promise<Uint8Array>;

export interface BackupEncryptionOptions {
	salt?: Uint8Array;
	nonce?: Uint8Array;
	deriveKey?: DeriveKey;
}

export interface BackupDecryptionOptions {
	deriveKey?: DeriveKey;
}

export function encodeBackupPayload(payload: BackupPayloadV1): Uint8Array {
	const validated = validateBackupPayload(payload);
	const encoded = new TextEncoder().encode(JSON.stringify(validated));
	if (encoded.byteLength > BACKUP_LIMITS.maxPlaintextBytes) {
		encoded.fill(0);
		throw new Error('Backup payload is too large');
	}
	return encoded;
}

export function decodeBackupPayload(encoded: Uint8Array): BackupPayloadV1 {
	if (encoded.byteLength > BACKUP_LIMITS.maxPlaintextBytes) {
		throw new Error('Backup payload is too large');
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(encoded));
	} catch (error) {
		throw new Error('Backup payload is not valid UTF-8 JSON', { cause: error });
	}
	const validated = validateBackupPayload(parsed);
	const canonical = new TextEncoder().encode(JSON.stringify(validated));
	try {
		if (!bytesEqual(canonical, encoded)) throw new Error('Backup payload is not canonical');
	} finally {
		canonical.fill(0);
	}
	return validated;
}

export async function encryptBackup(
	payload: BackupPayloadV1,
	passphrase: string,
	options: BackupEncryptionOptions = {},
): Promise<Uint8Array> {
	let passphraseBytes: Uint8Array | null = null;
	let plaintext: Uint8Array | null = null;
	let salt: Uint8Array | null = null;
	let nonce: Uint8Array | null = null;
	let derivedKey: Uint8Array | null = null;
	try {
		passphraseBytes = encodePassphrase(passphrase, true);
		plaintext = encodeBackupPayload(payload);
		salt = copyFixedBytes(options.salt ?? randomBytes(SALT_BYTES), SALT_BYTES, 'salt');
		nonce = copyFixedBytes(options.nonce ?? randomBytes(NONCE_BYTES), NONCE_BYTES, 'nonce');
		const ciphertextLength = plaintext.byteLength + GCM_TAG_BYTES;
		const header = createHeader(plaintext.byteLength, ciphertextLength, salt, nonce);
		derivedKey = await (options.deriveKey ?? deriveBackupKey)(passphraseBytes, salt);
		assertDerivedKey(derivedKey);
		const webKeyBytes = copyBytes(derivedKey);
		const webNonce = copyBytes(nonce);
		const webHeader = copyBytes(header);
		const webPlaintext = copyBytes(plaintext);
		let encrypted: Uint8Array;
		try {
			const key = await crypto.subtle.importKey('raw', webKeyBytes.buffer, 'AES-GCM', false, [
				'encrypt',
			]);
			encrypted = new Uint8Array(
				await crypto.subtle.encrypt(
					{
						name: 'AES-GCM',
						iv: webNonce.buffer,
						additionalData: webHeader.buffer,
						tagLength: 128,
					},
					key,
					webPlaintext.buffer,
				),
			);
		} finally {
			webKeyBytes.fill(0);
			webNonce.fill(0);
			webHeader.fill(0);
			webPlaintext.fill(0);
		}
		if (encrypted.byteLength !== ciphertextLength)
			throw new Error('Unexpected backup ciphertext size');
		const archive = new Uint8Array(header.byteLength + encrypted.byteLength);
		archive.set(header);
		archive.set(encrypted, header.byteLength);
		encrypted.fill(0);
		return archive;
	} finally {
		passphraseBytes?.fill(0);
		plaintext?.fill(0);
		salt?.fill(0);
		nonce?.fill(0);
		derivedKey?.fill(0);
	}
}

export async function decryptBackup(
	archive: Uint8Array,
	passphrase: string,
	options: BackupDecryptionOptions = {},
): Promise<BackupPayloadV1> {
	const parsed = parseHeader(archive);
	let passphraseBytes: Uint8Array | null = null;
	let derivedKey: Uint8Array | null = null;
	let plaintext: Uint8Array | null = null;
	try {
		passphraseBytes = encodePassphrase(passphrase, false);
		derivedKey = await (options.deriveKey ?? deriveBackupKey)(passphraseBytes, parsed.salt);
		assertDerivedKey(derivedKey);
		const webKeyBytes = copyBytes(derivedKey);
		const webNonce = copyBytes(parsed.nonce);
		const webHeader = copyBytes(parsed.header);
		const webCiphertext = copyBytes(archive.subarray(BACKUP_V1_HEADER_BYTES));
		try {
			const key = await crypto.subtle.importKey('raw', webKeyBytes.buffer, 'AES-GCM', false, [
				'decrypt',
			]);
			plaintext = new Uint8Array(
				await crypto.subtle.decrypt(
					{
						name: 'AES-GCM',
						iv: webNonce.buffer,
						additionalData: webHeader.buffer,
						tagLength: 128,
					},
					key,
					webCiphertext.buffer,
				),
			);
		} catch (error) {
			throw new Error('Backup authentication failed', { cause: error });
		} finally {
			webKeyBytes.fill(0);
			webNonce.fill(0);
			webHeader.fill(0);
			webCiphertext.fill(0);
		}
		if (plaintext.byteLength !== parsed.plaintextLength) {
			throw new Error('Backup authentication failed');
		}
		return decodeBackupPayload(plaintext);
	} finally {
		passphraseBytes?.fill(0);
		derivedKey?.fill(0);
		plaintext?.fill(0);
		parsed.salt.fill(0);
		parsed.nonce.fill(0);
	}
}

export function validateBackupPayload(value: unknown): BackupPayloadV1 {
	const root = requireRecord(value, 'Backup payload');
	assertExactKeys(root, ['schema', 'version', 'createdAt', 'sourcePubkey', 'contents', 'entries']);
	if (root.schema !== 'com.redshiftapp.backup' || root.version !== 1) {
		throw new Error('Unsupported backup payload schema');
	}
	assertSafeTimestamp(root.createdAt, 'backup creation time');
	if (typeof root.sourcePubkey !== 'string' || !PUBKEY_PATTERN.test(root.sourcePubkey)) {
		throw new Error('Invalid backup source public key');
	}
	const contents = requireRecord(root.contents, 'Backup contents');
	assertExactKeys(contents, [
		'secretState',
		'projectMetadata',
		'relayConfiguration',
		'signerCredentials',
		'historyAndTombstones',
	]);
	if (
		contents.secretState !== 'current-observed' ||
		contents.projectMetadata !== 'identifiers-only' ||
		contents.relayConfiguration !== 'excluded' ||
		contents.signerCredentials !== 'excluded' ||
		contents.historyAndTombstones !== 'excluded'
	) {
		throw new Error('Invalid backup content declaration');
	}
	if (!Array.isArray(root.entries) || root.entries.length > BACKUP_LIMITS.maxEntries) {
		throw new Error('Invalid backup entry count');
	}
	let previousDTag = '';
	let totalSecrets = 0;
	const entries = root.entries.map((entry, index) => {
		const object = requireRecord(entry, `Backup entry ${index}`);
		assertExactKeys(object, [
			'project',
			'environment',
			'sourceCreatedAt',
			'sourceEventId',
			'secrets',
		]);
		if (typeof object.project !== 'string' || !validateSlug(object.project).valid) {
			throw new Error(`Invalid backup project at entry ${index}`);
		}
		if (typeof object.environment !== 'string' || !validateSlug(object.environment).valid) {
			throw new Error(`Invalid backup environment at entry ${index}`);
		}
		const dTag = `${object.project}|${object.environment}`;
		if (dTag <= previousDTag) throw new Error('Backup entries must be unique and sorted');
		previousDTag = dTag;
		assertSafeTimestamp(object.sourceCreatedAt, `source timestamp at entry ${index}`);
		if (typeof object.sourceEventId !== 'string' || !EVENT_ID_PATTERN.test(object.sourceEventId)) {
			throw new Error(`Invalid backup source event ID at entry ${index}`);
		}
		if (
			!Array.isArray(object.secrets) ||
			object.secrets.length === 0 ||
			object.secrets.length > BACKUP_LIMITS.maxSecretsPerEntry
		) {
			throw new Error(`Invalid secret count at entry ${index}`);
		}
		totalSecrets += object.secrets.length;
		if (totalSecrets > BACKUP_LIMITS.maxTotalSecrets) throw new Error('Too many backup secrets');
		let previousKey = '';
		const secrets = object.secrets.map((secret, secretIndex) => {
			if (!Array.isArray(secret) || secret.length !== 2) {
				throw new Error(`Invalid secret pair at entry ${index}`);
			}
			const [key, secretValue] = secret;
			if (
				typeof key !== 'string' ||
				DANGEROUS_SECRET_KEYS.has(key) ||
				!SECRET_KEY_PATTERN.test(key) ||
				key.length > BACKUP_LIMITS.maxSecretKeyLength
			) {
				throw new Error(`Invalid secret key at entry ${index}:${secretIndex}`);
			}
			if (key <= previousKey) throw new Error('Backup secret keys must be unique and sorted');
			previousKey = key;
			if (typeof secretValue !== 'string' || secretValue.includes('\0')) {
				throw new Error(`Invalid secret value at entry ${index}:${secretIndex}`);
			}
			if (new TextEncoder().encode(secretValue).byteLength > BACKUP_LIMITS.maxSecretValueBytes) {
				throw new Error(`Secret value is too large at entry ${index}:${secretIndex}`);
			}
			return [key, secretValue] as [string, string];
		});
		return {
			project: object.project,
			environment: object.environment,
			sourceCreatedAt: object.sourceCreatedAt as number,
			sourceEventId: object.sourceEventId,
			secrets,
		};
	});
	return {
		schema: 'com.redshiftapp.backup',
		version: 1,
		createdAt: root.createdAt as number,
		sourcePubkey: root.sourcePubkey,
		contents: {
			secretState: 'current-observed',
			projectMetadata: 'identifiers-only',
			relayConfiguration: 'excluded',
			signerCredentials: 'excluded',
			historyAndTombstones: 'excluded',
		},
		entries,
	};
}

async function deriveBackupKey(passphrase: Uint8Array, salt: Uint8Array) {
	return scryptAsync(passphrase, salt, {
		N: SCRYPT_N,
		r: SCRYPT_R,
		p: SCRYPT_P,
		dkLen: 32,
		maxmem: SCRYPT_MAX_MEMORY,
		asyncTick: 10,
	});
}

function createHeader(
	plaintextLength: number,
	ciphertextLength: number,
	salt: Uint8Array,
	nonce: Uint8Array,
) {
	const header = new Uint8Array(BACKUP_V1_HEADER_BYTES);
	header.set(BACKUP_MAGIC, 0);
	const view = new DataView(header.buffer);
	view.setUint16(8, BACKUP_VERSION, false);
	view.setUint8(10, BACKUP_SUITE);
	view.setUint8(11, 0);
	view.setUint32(12, BACKUP_V1_HEADER_BYTES, false);
	view.setUint32(16, SCRYPT_N, false);
	view.setUint32(20, SCRYPT_R, false);
	view.setUint32(24, SCRYPT_P, false);
	view.setUint32(28, plaintextLength, false);
	view.setUint32(32, ciphertextLength, false);
	header.set(salt, 36);
	header.set(nonce, 52);
	return header;
}

function parseHeader(archive: Uint8Array) {
	if (!(archive instanceof Uint8Array)) throw new Error('Backup archive must be bytes');
	if (archive.byteLength < BACKUP_V1_HEADER_BYTES + GCM_TAG_BYTES) {
		throw new Error('Backup archive is truncated');
	}
	if (archive.byteLength > BACKUP_LIMITS.maxArchiveBytes)
		throw new Error('Backup archive is too large');
	const header = archive.slice(0, BACKUP_V1_HEADER_BYTES);
	if (!bytesEqual(header.subarray(0, 8), BACKUP_MAGIC)) throw new Error('Invalid backup magic');
	const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
	if (
		view.getUint16(8, false) !== BACKUP_VERSION ||
		view.getUint8(10) !== BACKUP_SUITE ||
		view.getUint8(11) !== 0 ||
		view.getUint32(12, false) !== BACKUP_V1_HEADER_BYTES ||
		view.getUint32(16, false) !== SCRYPT_N ||
		view.getUint32(20, false) !== SCRYPT_R ||
		view.getUint32(24, false) !== SCRYPT_P
	) {
		throw new Error('Unsupported or malformed backup header');
	}
	const plaintextLength = view.getUint32(28, false);
	const ciphertextLength = view.getUint32(32, false);
	if (
		plaintextLength > BACKUP_LIMITS.maxPlaintextBytes ||
		ciphertextLength !== plaintextLength + GCM_TAG_BYTES ||
		archive.byteLength !== BACKUP_V1_HEADER_BYTES + ciphertextLength
	) {
		throw new Error('Invalid backup archive length');
	}
	return {
		header,
		plaintextLength,
		salt: header.slice(36, 52),
		nonce: header.slice(52, 64),
	};
}

function encodePassphrase(passphrase: string, creating: boolean) {
	if (typeof passphrase !== 'string') throw new Error('Backup passphrase must be a string');
	assertNoUnpairedSurrogates(passphrase);
	const encoded = new TextEncoder().encode(passphrase);
	const minimum = creating ? BACKUP_LIMITS.minCreatePassphraseBytes : 1;
	if (encoded.byteLength < minimum) {
		encoded.fill(0);
		throw new Error(
			creating
				? `Backup passphrase must be at least ${BACKUP_LIMITS.minCreatePassphraseBytes} UTF-8 bytes`
				: 'Backup authentication failed',
		);
	}
	if (encoded.byteLength > BACKUP_LIMITS.maxPassphraseBytes) {
		encoded.fill(0);
		throw new Error('Backup passphrase is too long');
	}
	return encoded;
}

function assertNoUnpairedSurrogates(value: string) {
	for (let index = 0; index < value.length; index++) {
		const code = value.charCodeAt(index);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = value.charCodeAt(index + 1);
			if (!(next >= 0xdc00 && next <= 0xdfff)) {
				throw new Error('Backup passphrase contains an unpaired surrogate');
			}
			index += 1;
		} else if (code >= 0xdc00 && code <= 0xdfff) {
			throw new Error('Backup passphrase contains an unpaired surrogate');
		}
	}
}

function copyBytes(value: Uint8Array) {
	const copy = new Uint8Array(value.byteLength);
	copy.set(value);
	return copy;
}

function copyFixedBytes(value: Uint8Array, length: number, label: string) {
	if (!(value instanceof Uint8Array) || value.byteLength !== length) {
		throw new Error(`Backup ${label} must be ${length} bytes`);
	}
	return value.slice();
}

function randomBytes(length: number) {
	return crypto.getRandomValues(new Uint8Array(length));
}

function assertDerivedKey(value: Uint8Array) {
	if (!(value instanceof Uint8Array) || value.byteLength !== 32) {
		throw new Error('Backup key derivation returned an invalid key');
	}
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`${label} must be an object`);
	}
	return value as Record<string, unknown>;
}

function assertExactKeys(value: Record<string, unknown>, expected: string[]) {
	const actual = Object.keys(value).sort();
	const sortedExpected = [...expected].sort();
	if (
		actual.length !== sortedExpected.length ||
		actual.some((key, index) => key !== sortedExpected[index])
	) {
		throw new Error('Backup payload contains unexpected or missing fields');
	}
}

function assertSafeTimestamp(value: unknown, label: string): asserts value is number {
	if (!Number.isSafeInteger(value) || (value as number) < 0) {
		throw new Error(`Invalid ${label}`);
	}
}

function bytesEqual(left: Uint8Array, right: Uint8Array) {
	if (left.byteLength !== right.byteLength) return false;
	let difference = 0;
	for (let index = 0; index < left.byteLength; index++) {
		difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
	}
	return difference === 0;
}
