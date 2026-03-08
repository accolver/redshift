/**
 * NsecSigner - Local key implementation of NostrSigner
 *
 * Wraps a Uint8Array private key to provide the unified NostrSigner interface.
 * All operations are performed locally (no network calls).
 *
 * L2: Function-Author - Local signing implementation
 * L4: Integration-Contractor - NostrSigner contract compliance
 */

import { nip44 } from 'nostr-tools';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import type { NostrSigner } from './types';

/**
 * Local key signer that implements NostrSigner using a Uint8Array private key.
 *
 * This is the nsec auth path — all crypto operations happen locally.
 */
export class NsecSigner implements NostrSigner {
	readonly pubkey: string;
	private readonly privateKey: Uint8Array;

	constructor(privateKey: Uint8Array) {
		if (!(privateKey instanceof Uint8Array) || privateKey.length !== 32) {
			throw new Error('Private key must be a 32-byte Uint8Array');
		}
		this.privateKey = privateKey;
		this.pubkey = getPublicKey(privateKey);
	}

	async signEvent(event: {
		kind: number;
		created_at: number;
		tags: string[][];
		content: string;
	}) {
		const signed = finalizeEvent(event, this.privateKey);
		return {
			id: signed.id,
			pubkey: signed.pubkey,
			created_at: signed.created_at,
			kind: signed.kind,
			tags: signed.tags,
			content: signed.content,
			sig: signed.sig,
		};
	}

	async encrypt(pubkey: string, plaintext: string) {
		const conversationKey = nip44.v2.utils.getConversationKey(this.privateKey, pubkey);
		return nip44.v2.encrypt(plaintext, conversationKey);
	}

	async decrypt(pubkey: string, ciphertext: string) {
		const conversationKey = nip44.v2.utils.getConversationKey(this.privateKey, pubkey);
		return nip44.v2.decrypt(ciphertext, conversationKey);
	}

	/**
	 * Get the raw private key bytes.
	 * Only available on NsecSigner (not on bunker signers).
	 * Used for backward compatibility with code that needs the raw key.
	 */
	getPrivateKey(): Uint8Array {
		return this.privateKey;
	}
}
