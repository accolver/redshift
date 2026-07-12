import { schnorr } from '@noble/curves/secp256k1';
import type { NostrEvent } from './types';

const EVENT_ID = /^[0-9a-f]{64}$/;
const PUBKEY = /^[0-9a-f]{64}$/;
const SIGNATURE = /^[0-9a-f]{128}$/;

function hexToBytes(hex: string) {
	const bytes = new Uint8Array(hex.length / 2);
	for (let index = 0; index < bytes.length; index++) {
		bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
	}
	return bytes;
}

function bytesToHex(bytes: Uint8Array) {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isNostrEvent(event: unknown): event is NostrEvent {
	if (!event || typeof event !== 'object') return false;
	const candidate = event as Partial<NostrEvent>;
	return (
		typeof candidate.id === 'string' &&
		EVENT_ID.test(candidate.id) &&
		typeof candidate.pubkey === 'string' &&
		PUBKEY.test(candidate.pubkey) &&
		typeof candidate.sig === 'string' &&
		SIGNATURE.test(candidate.sig) &&
		Number.isSafeInteger(candidate.created_at) &&
		(candidate.created_at ?? -1) >= 0 &&
		Number.isSafeInteger(candidate.kind) &&
		(candidate.kind ?? -1) >= 0 &&
		typeof candidate.content === 'string' &&
		Array.isArray(candidate.tags) &&
		candidate.tags.every(
			(tag) => Array.isArray(tag) && tag.every((part) => typeof part === 'string'),
		)
	);
}

export function serializeEventForSigning(event: NostrEvent) {
	return JSON.stringify([0, event.pubkey, event.created_at, event.kind, event.tags, event.content]);
}

/** Verify canonical NIP-01 identity and signature as one inseparable check. */
export async function verifyEventSignature(event: NostrEvent): Promise<boolean> {
	if (!isNostrEvent(event)) return false;
	try {
		const digest = new Uint8Array(
			await crypto.subtle.digest(
				'SHA-256',
				new TextEncoder().encode(serializeEventForSigning(event)),
			),
		);
		if (bytesToHex(digest) !== event.id) return false;
		return schnorr.verify(hexToBytes(event.sig), digest, hexToBytes(event.pubkey));
	} catch {
		return false;
	}
}
