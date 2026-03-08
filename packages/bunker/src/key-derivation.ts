/**
 * HKDF-SHA256 key derivation for @redshift/bunker
 *
 * Derives deterministic Nostr keypairs from a master seed, team ID,
 * and OAuth subject identifier. This allows OAuth-authenticated users
 * to receive a stable Nostr identity without managing their own keys.
 *
 * Derivation path: masterSeed + teamId (salt) + "redshift-oauth-v1:{oauthSubject}" (info)
 */

import { hkdfSync } from 'node:crypto';
import { getPublicKey } from 'nostr-tools/pure';

/** Prefix for the HKDF info parameter to namespace derived keys */
const INFO_PREFIX = 'redshift-oauth-v1';

/**
 * Derive a Nostr keypair from a master seed, team ID, and OAuth subject.
 *
 * Uses HKDF-SHA256 to produce a deterministic 32-byte private key.
 * The same inputs always produce the same keypair.
 *
 * @param masterSeed - 32-byte master seed (from hex MASTER_KEY config)
 * @param teamId - Team identifier used as HKDF salt
 * @param oauthSubject - OAuth provider's unique user identifier used in HKDF info
 * @returns Object with privateKey (Uint8Array) and pubkey (hex string)
 */
export function deriveNostrKey(masterSeed: Uint8Array, teamId: string, oauthSubject: string) {
	const info = `${INFO_PREFIX}:${oauthSubject}`;

	const derivedKey = hkdfSync('sha256', masterSeed, teamId, info, 32);

	const privateKey = new Uint8Array(derivedKey);
	const pubkey = getPublicKey(privateKey);

	return { privateKey, pubkey };
}
