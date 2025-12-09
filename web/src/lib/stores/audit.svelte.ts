/**
 * Audit Store using Svelte 5 Runes
 *
 * Manages audit log state including:
 * - Fetching encrypted audit events from relays
 * - Decrypting audit events client-side
 * - Filtering and displaying audit history
 *
 * Audit events are NIP-59 Gift Wrapped and can only be decrypted by the user
 * who created them (self-encrypted with NIP-44).
 */

import type { AuditEvent, AuditAction } from '@redshift/cloud';
import { unwrapAuditEvent, getAuditEventFilter, getAuditActionLabel } from '@redshift/cloud';
import { getAuthState, getPrivateKey } from './auth.svelte';
import { hasActiveSubscription } from './subscription.svelte';
import { relayPool } from './nostr.svelte';
import { getEffectiveRelays } from './relay-settings.svelte';
import { onlyEvents } from 'applesauce-relay';
import type { NostrEvent } from 'nostr-tools';

/**
 * Audit store state
 */
interface AuditState {
	/** Decrypted audit events, newest first */
	events: AuditEvent[];
	/** Loading state */
	loading: boolean;
	/** Error message if any */
	error: string | null;
	/** Last fetch timestamp */
	lastFetched: number | null;
	/** Whether more events might be available */
	hasMore: boolean;
}

// Store state using $state rune
let auditState = $state<AuditState>({
	events: [],
	loading: false,
	error: null,
	lastFetched: null,
	hasMore: false,
});

// Track active subscription
let activeSubscription: { unsubscribe: () => void } | null = null;

/**
 * Get the current audit state (reactive)
 */
export function getAuditState(): AuditState {
	return auditState;
}

/**
 * Fetch audit events from relays
 *
 * Events are fetched as NIP-59 Gift Wrap events and decrypted client-side.
 * Only Cloud subscribers can view audit logs.
 */
export async function fetchAuditEvents(): Promise<void> {
	// Only available for Cloud subscribers
	if (!hasActiveSubscription()) {
		auditState.error = 'Audit logs require a Cloud subscription';
		return;
	}

	const auth = getAuthState();
	if (!auth.isConnected || !auth.pubkey) {
		auditState.error = 'Not authenticated';
		return;
	}

	// Get private key for decryption
	const privateKey = await getPrivateKey();
	if (!privateKey) {
		auditState.error = 'Audit logs require nsec login for decryption';
		return;
	}

	// Clean up existing subscription
	if (activeSubscription) {
		activeSubscription.unsubscribe();
		activeSubscription = null;
	}

	auditState.loading = true;
	auditState.error = null;

	try {
		const relays = getEffectiveRelays();
		const filter = getAuditEventFilter(auth.pubkey);

		// Collect events
		const events: AuditEvent[] = [];

		// Create subscription with properly typed filter
		// The filter has kinds, #p, and #t arrays
		activeSubscription = relayPool
			.subscription(relays, [filter] as Parameters<typeof relayPool.subscription>[1])
			.pipe(onlyEvents())
			.subscribe({
				next: (event: NostrEvent) => {
					// Try to decrypt and unwrap the audit event
					const audit = unwrapAuditEvent(
						event as {
							id: string;
							pubkey: string;
							created_at: number;
							kind: number;
							tags: string[][];
							content: string;
							sig: string;
						},
						privateKey,
					);

					if (audit) {
						// Add to events list, avoiding duplicates
						const exists = events.some(
							(e) => e.timestamp === audit.timestamp && e.action === audit.action,
						);
						if (!exists) {
							events.push(audit);
							// Sort by timestamp descending (newest first)
							events.sort((a, b) => b.timestamp - a.timestamp);
							// Update state
							auditState.events = [...events];
						}
					}
				},
				error: (err) => {
					console.error('Audit subscription error:', err);
					auditState.error = 'Failed to fetch audit logs';
					auditState.loading = false;
				},
			});

		// Set a timeout to mark loading complete
		setTimeout(() => {
			auditState.loading = false;
			auditState.lastFetched = Date.now();
		}, 3000);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch audit logs';
		auditState.error = message;
		auditState.loading = false;
	}
}

/**
 * Unsubscribe from audit events
 */
export function unsubscribeFromAudit(): void {
	if (activeSubscription) {
		activeSubscription.unsubscribe();
		activeSubscription = null;
	}
}

/**
 * Clear audit state
 */
export function clearAuditState(): void {
	unsubscribeFromAudit();
	auditState = {
		events: [],
		loading: false,
		error: null,
		lastFetched: null,
		hasMore: false,
	};
}

/**
 * Filter audit events by action type
 */
export function filterByAction(action: AuditAction | 'all'): AuditEvent[] {
	if (action === 'all') {
		return auditState.events;
	}
	return auditState.events.filter((e) => e.action === action);
}

/**
 * Filter audit events by target (project/environment)
 */
export function filterByTarget(target: string): AuditEvent[] {
	return auditState.events.filter((e) => e.target.includes(target));
}

/**
 * Get human-readable action label
 */
export { getAuditActionLabel };

/**
 * Format audit timestamp for display
 */
export function formatAuditTime(timestamp: number): string {
	const date = new Date(timestamp * 1000);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) {
		return 'Just now';
	} else if (diffMins < 60) {
		return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
	} else if (diffHours < 24) {
		return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
	} else if (diffDays < 7) {
		return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
	} else {
		return date.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}
}

/**
 * Get action icon name based on action type
 */
export function getActionIcon(action: AuditAction): string {
	switch (action) {
		case 'secret:create':
			return 'plus';
		case 'secret:update':
			return 'pencil';
		case 'secret:delete':
			return 'trash';
		case 'secret:read':
			return 'eye';
		case 'subscription:start':
		case 'subscription:renew':
			return 'credit-card';
		case 'subscription:cancel':
			return 'x-circle';
		default:
			return 'activity';
	}
}

/**
 * Get action color based on action type
 */
export function getActionColor(action: AuditAction): string {
	switch (action) {
		case 'secret:create':
		case 'subscription:start':
		case 'subscription:renew':
			return 'text-tokyo-green';
		case 'secret:update':
			return 'text-tokyo-blue';
		case 'secret:delete':
		case 'subscription:cancel':
			return 'text-tokyo-red';
		case 'secret:read':
			return 'text-tokyo-purple';
		default:
			return 'text-muted-foreground';
	}
}
