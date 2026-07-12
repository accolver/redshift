import type { NostrEvent, NostrFilter } from './types';

export const REDSHIFT_GIFT_WRAP_KIND = 1059;
export const REDSHIFT_SECRET_KIND = 30078;
export const REDSHIFT_TYPE_TAG = 'redshift-secrets';
const PUBKEY = /^[0-9a-f]{64}$/;

export type PolicyDecision =
	| { allowed: true; principal: string }
	| { allowed: false; reason: string };

export function getRedshiftRecipient(event: NostrEvent): string | null {
	if (event.kind !== REDSHIFT_GIFT_WRAP_KIND) return null;
	const recipientTags = event.tags.filter((tag) => tag[0] === 'p');
	const typeTags = event.tags.filter((tag) => tag[0] === 't' && tag[1] === REDSHIFT_TYPE_TAG);
	const recipient = recipientTags[0]?.[1];
	if (recipientTags.length !== 1 || !recipient || !PUBKEY.test(recipient)) return null;
	if (typeTags.length !== 1) return null;
	return recipient;
}

export function authorizeEventWrite(
	event: NostrEvent,
	authenticatedPrincipal: string | undefined,
): PolicyDecision {
	if (!authenticatedPrincipal) return { allowed: false, reason: 'authentication required' };
	if (event.kind === REDSHIFT_SECRET_KIND) {
		return { allowed: false, reason: 'plaintext secret events are not allowed' };
	}
	if (event.kind === REDSHIFT_GIFT_WRAP_KIND) {
		const recipient = getRedshiftRecipient(event);
		if (!recipient) return { allowed: false, reason: 'invalid Redshift recipient/type tags' };
		return recipient === authenticatedPrincipal
			? { allowed: true, principal: recipient }
			: { allowed: false, reason: 'Gift Wrap recipient does not match authenticated principal' };
	}
	return event.pubkey === authenticatedPrincipal
		? { allowed: true, principal: event.pubkey }
		: { allowed: false, reason: 'event author does not match authenticated principal' };
}

export function authorizeReadFilters(
	filters: NostrFilter[],
	authenticatedPrincipal: string | undefined,
): PolicyDecision {
	if (!authenticatedPrincipal) return { allowed: false, reason: 'authentication required' };
	if (filters.length === 0) return { allowed: false, reason: 'at least one filter is required' };
	for (const filter of filters) {
		if (
			filter.kinds?.length !== 1 ||
			filter.kinds[0] !== REDSHIFT_GIFT_WRAP_KIND ||
			filter['#p']?.length !== 1 ||
			filter['#p'][0] !== authenticatedPrincipal ||
			filter['#t']?.length !== 1 ||
			filter['#t'][0] !== REDSHIFT_TYPE_TAG
		) {
			return {
				allowed: false,
				reason: 'filters must target kind 1059, the authenticated #p, and #t redshift-secrets',
			};
		}
	}
	return { allowed: true, principal: authenticatedPrincipal };
}

export function normalizeAuthRelayUrl(value: string): string | null {
	try {
		const url = new URL(value);
		if (url.protocol !== 'wss:' && url.protocol !== 'ws:') return null;
		if (url.username || url.password || url.hash || url.search) return null;
		return url.href;
	} catch {
		return null;
	}
}
