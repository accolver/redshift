/**
 * NIP-98 HTTP Auth verification for @redshift/bunker
 *
 * Implements server-side verification of NIP-98 HTTP authentication.
 * Clients send `Authorization: Nostr <base64-encoded-kind-27235-event>`
 * and the server verifies the event signature, kind, URL, method, and timestamp.
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/98.md
 */

import type { Event as NostrEvent } from 'nostr-tools/core';
import { verifyEvent } from 'nostr-tools/pure';
import { AuthorizationError, ValidationError } from './errors.js';

/** NIP-98 HTTP Auth event kind */
const HTTP_AUTH_KIND = 27235;

/** Maximum allowed time drift for NIP-98 events (±60 seconds) */
const MAX_TIME_DRIFT_SECONDS = 60;

/** NIP-98 authorization scheme prefix */
const AUTH_SCHEME = 'Nostr ';

/**
 * Result of a successful NIP-98 verification.
 */
export interface Nip98AuthResult {
	/** The pubkey of the authenticated user */
	readonly pubkey: string;
	/** The verified event */
	readonly event: NostrEvent;
}

/**
 * Verify a NIP-98 Authorization header.
 *
 * Checks:
 * 1. Authorization header is present and uses "Nostr" scheme
 * 2. Base64-decoded content is a valid Nostr event
 * 3. Event kind is 27235 (HTTP Auth)
 * 4. Event signature is valid
 * 5. URL tag matches the request URL
 * 6. Method tag matches the HTTP method
 * 7. created_at is within ±60 seconds of current time
 *
 * @param authHeader - The Authorization header value
 * @param requestUrl - The full request URL
 * @param requestMethod - The HTTP method (GET, POST, etc.)
 * @returns The verified auth result with pubkey
 * @throws {ValidationError} if the header format is invalid
 * @throws {AuthorizationError} if verification fails
 */
export function verifyNip98Auth(
	authHeader: string,
	requestUrl: string,
	requestMethod: string,
): Nip98AuthResult {
	// Extract the base64 token
	if (!authHeader.startsWith(AUTH_SCHEME)) {
		throw new ValidationError('Authorization header must use "Nostr" scheme');
	}

	const token = authHeader.slice(AUTH_SCHEME.length);
	if (!token) {
		throw new ValidationError('Missing NIP-98 token');
	}

	// Decode the event
	let event: NostrEvent;
	try {
		const decoded = atob(token);
		const parsed: unknown = JSON.parse(decoded);
		event = parsed as NostrEvent;
	} catch {
		throw new ValidationError('Invalid NIP-98 token: failed to decode');
	}

	// Verify event kind
	if (event.kind !== HTTP_AUTH_KIND) {
		throw new AuthorizationError(
			`Invalid event kind: expected ${HTTP_AUTH_KIND}, got ${event.kind}`,
		);
	}

	// Verify event signature
	if (!verifyEvent(event)) {
		throw new AuthorizationError('Invalid event signature');
	}

	// Verify timestamp (±60 seconds)
	const now = Math.floor(Date.now() / 1000);
	const drift = Math.abs(now - event.created_at);
	if (drift > MAX_TIME_DRIFT_SECONDS) {
		throw new AuthorizationError(
			`Event timestamp too far from current time (drift: ${drift}s, max: ${MAX_TIME_DRIFT_SECONDS}s)`,
		);
	}

	// Verify URL tag
	const urlTag = event.tags.find((t) => t[0] === 'u');
	if (!urlTag || urlTag[1] !== requestUrl) {
		throw new AuthorizationError('URL tag does not match request URL');
	}

	// Verify method tag
	const methodTag = event.tags.find((t) => t[0] === 'method');
	if (!methodTag || methodTag[1]?.toUpperCase() !== requestMethod.toUpperCase()) {
		throw new AuthorizationError('Method tag does not match request method');
	}

	return {
		pubkey: event.pubkey,
		event,
	};
}

/**
 * Check if a pubkey is in the admin pubkeys list.
 *
 * @param pubkey - The pubkey to check
 * @param adminPubkeys - List of authorized admin pubkeys
 * @returns true if the pubkey is an admin
 */
export function isAdminPubkey(pubkey: string, adminPubkeys: readonly string[]) {
	return adminPubkeys.includes(pubkey);
}

/**
 * Verify NIP-98 auth and check admin authorization in one step.
 *
 * @param authHeader - The Authorization header value
 * @param requestUrl - The full request URL
 * @param requestMethod - The HTTP method
 * @param adminPubkeys - List of authorized admin pubkeys
 * @returns The verified auth result
 * @throws {ValidationError} if header format is invalid
 * @throws {AuthorizationError} if verification fails or pubkey is not admin
 */
export function verifyAdminAuth(
	authHeader: string,
	requestUrl: string,
	requestMethod: string,
	adminPubkeys: readonly string[],
): Nip98AuthResult {
	const result = verifyNip98Auth(authHeader, requestUrl, requestMethod);

	if (!isAdminPubkey(result.pubkey, adminPubkeys)) {
		throw new AuthorizationError('Pubkey is not authorized as admin');
	}

	return result;
}
