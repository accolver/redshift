/**
 * Utility functions for Redshift cryptographic operations
 */

import { decode as nip19Decode } from 'nostr-tools/nip19';

/**
 * Validate that a string is a valid nsec (bech32 encoded private key).
 * Uses nip19.decode() for checksum validation, not just format matching.
 *
 * @param nsec - The string to validate
 * @returns True if valid nsec with correct checksum
 */
export function validateNsec(nsec: string): boolean {
	try {
		const decoded = nip19Decode(nsec);
		return decoded.type === 'nsec';
	} catch {
		return false;
	}
}

/**
 * Validate that a string is a valid npub (bech32 encoded public key).
 * Uses nip19.decode() for checksum validation, not just format matching.
 *
 * @param npub - The string to validate
 * @returns True if valid npub with correct checksum
 */
export function validateNpub(npub: string): boolean {
	try {
		const decoded = nip19Decode(npub);
		return decoded.type === 'npub';
	} catch {
		return false;
	}
}

/**
 * Decode an nsec string to raw private key bytes.
 *
 * @param nsec - The nsec string to decode
 * @returns The raw private key bytes
 * @throws Error if nsec is invalid
 */
export function decodeNsec(nsec: string): Uint8Array {
	const decoded = nip19Decode(nsec);
	if (decoded.type !== 'nsec') {
		throw new Error(`Expected nsec, got ${decoded.type}`);
	}
	return decoded.data;
}

/**
 * Decode an npub string to raw public key hex.
 *
 * @param npub - The npub string to decode
 * @returns The raw public key as hex string
 * @throws Error if npub is invalid
 */
export function decodeNpub(npub: string): string {
	const decoded = nip19Decode(npub);
	if (decoded.type !== 'npub') {
		throw new Error(`Expected npub, got ${decoded.type}`);
	}
	return decoded.data;
}

/**
 * Create a d-tag from project ID and environment.
 *
 * @param projectId - The project identifier
 * @param environment - The environment slug
 * @returns Formatted d-tag string
 */
export function createDTag(projectId: string, environment: string): string {
	return `${projectId}|${environment}`;
}

/**
 * Parse a d-tag into project ID and environment.
 *
 * @param dTag - The d-tag string to parse
 * @returns Object with projectId and environment, or null if invalid
 */
export function parseDTag(dTag: string): { projectId: string; environment: string } | null {
	const parts = dTag.split('|');
	if (parts.length !== 2 || !parts[0] || !parts[1]) {
		return null;
	}
	return {
		projectId: parts[0],
		environment: parts[1],
	};
}
