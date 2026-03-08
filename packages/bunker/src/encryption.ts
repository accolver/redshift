/**
 * AES-256-GCM encryption utilities for @redshift/bunker
 *
 * Used to encrypt team private keys (NSECs) at rest with a master key.
 * Format: base64(iv + ciphertext + authTag)
 *   - IV: 12 bytes (random per encryption)
 *   - Auth tag: 16 bytes
 *   - Key: 32 bytes derived from hex MASTER_KEY
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { EncryptionError } from './errors.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Validate and parse a hex-encoded master key into a Buffer.
 * @throws {EncryptionError} if the key is not a valid 32-byte hex string
 */
export function parseMasterKey(hexKey: string) {
	if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
		throw new EncryptionError('Master key must be a 64-character hex string (32 bytes)');
	}
	return Buffer.from(hexKey, 'hex');
}

/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt (e.g., an nsec)
 * @param masterKeyHex - 32-byte master key as a 64-char hex string
 * @returns Base64-encoded string containing iv + ciphertext + authTag
 * @throws {EncryptionError} if encryption fails or key is invalid
 */
export function encrypt(plaintext: string, masterKeyHex: string) {
	const key = parseMasterKey(masterKeyHex);

	if (key.length !== KEY_LENGTH) {
		throw new EncryptionError(`Key must be ${KEY_LENGTH} bytes`);
	}

	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

	const authTag = cipher.getAuthTag();

	// Concatenate: iv (12) + ciphertext (variable) + authTag (16)
	const combined = Buffer.concat([iv, encrypted, authTag]);
	return combined.toString('base64');
}

/**
 * Decrypt a base64-encoded AES-256-GCM ciphertext.
 *
 * @param encryptedBase64 - Base64-encoded string from encrypt()
 * @param masterKeyHex - 32-byte master key as a 64-char hex string
 * @returns The original plaintext string
 * @throws {EncryptionError} if decryption fails, key is wrong, or data is tampered
 */
export function decrypt(encryptedBase64: string, masterKeyHex: string) {
	const key = parseMasterKey(masterKeyHex);

	let combined: Buffer;
	try {
		combined = Buffer.from(encryptedBase64, 'base64');
	} catch {
		throw new EncryptionError('Invalid base64 input');
	}

	const minLength = IV_LENGTH + AUTH_TAG_LENGTH;
	if (combined.length < minLength) {
		throw new EncryptionError(
			`Encrypted data too short: expected at least ${minLength} bytes, got ${combined.length}`,
		);
	}

	const iv = combined.subarray(0, IV_LENGTH);
	const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
	const ciphertext = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

	try {
		const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
		decipher.setAuthTag(authTag);

		const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

		return decrypted.toString('utf8');
	} catch (error) {
		if (error instanceof EncryptionError) {
			throw error;
		}
		throw new EncryptionError('Decryption failed: invalid key or tampered data');
	}
}

/**
 * Generate a random 32-byte master key as a hex string.
 * Useful for initial setup / key generation.
 */
export function generateMasterKey() {
	return randomBytes(KEY_LENGTH).toString('hex');
}
