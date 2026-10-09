import { HISTORY_LIMITS } from './history.js';
import type { NostrEvent } from './types.js';

export const MAX_RELAY_CONTENT_LENGTH = 2 * 1024 * 1024;
const MAX_TAG_BYTES = 64 * 1024;
const encoder = new TextEncoder();

export class RelayObservationLimitError extends Error {
	constructor() {
		super('Relay observation exceeds the fixed safety bound; current selection is blocked');
		this.name = 'RelayObservationLimitError';
	}
}

/** Cheap bounds before hashing, storing, or decrypting untrusted relay events. */
export function measureRelayEvent(event: NostrEvent) {
	if (typeof event.content !== 'string' || event.content.length > MAX_RELAY_CONTENT_LENGTH) {
		throw new RelayObservationLimitError();
	}
	if (!Array.isArray(event.tags) || event.tags.length > 256) {
		throw new RelayObservationLimitError();
	}
	let tagBytes = 0;
	for (const tag of event.tags) {
		if (!Array.isArray(tag) || tag.length > 16) throw new RelayObservationLimitError();
		for (const part of tag) {
			if (typeof part !== 'string' || part.length > MAX_TAG_BYTES) {
				throw new RelayObservationLimitError();
			}
			tagBytes += encoder.encode(part).length;
			if (tagBytes > MAX_TAG_BYTES) throw new RelayObservationLimitError();
		}
	}
	return encoder.encode(event.content).length + tagBytes;
}

/** Local aggregate limit: a relay's REQ limit is only a hint, not enforcement. */
export class RelayObservationBudget {
	private readonly seen = new Set<string>();
	private bytes = 0;
	private exhausted = false;

	accept(event: NostrEvent) {
		if (this.exhausted) throw new RelayObservationLimitError();
		try {
			const bytes = measureRelayEvent(event);
			if (this.seen.has(event.id)) return false;
			// Reaching the count cap cannot establish complete current state.
			if (
				this.seen.size + 1 >= HISTORY_LIMITS.maxObservedEvents ||
				this.bytes + bytes > HISTORY_LIMITS.maxCiphertextBytes
			)
				throw new RelayObservationLimitError();
			this.seen.add(event.id);
			this.bytes += bytes;
			return true;
		} catch (error) {
			this.exhausted = true;
			throw error;
		}
	}
}
