/**
 * Subscription Store using Svelte 5 Runes
 *
 * Manages Cloud tier subscription state including:
 * - Fetching subscription status from API
 * - Creating new subscriptions (BTCPay invoices)
 * - Tracking pending payments
 * - Subscription expiry notifications
 */

import type { CloudTier } from '@redshift/cloud';
import { getAuthState } from './auth.svelte';

/**
 * Subscription status from API
 */
export interface SubscriptionStatus {
	/** Whether user has an active subscription */
	active: boolean;
	/** Subscription tier (if active) */
	tier?: CloudTier;
	/** Expiration timestamp (Unix seconds) */
	expiresAt?: number;
	/** Days until expiration */
	daysRemaining?: number;
	/** Managed relay URL (if subscribed) */
	relayUrl?: string;
	/** Recent invoice status (if any pending) */
	pendingInvoice?: {
		id: string;
		checkoutUrl: string;
		expiresAt: number;
	};
}

/**
 * Invoice creation response
 */
export interface CreateInvoiceResponse {
	invoiceId: string;
	checkoutUrl: string;
	amount: string;
	expiresAt: number;
}

/**
 * Subscription store state
 */
interface SubscriptionState {
	/** Current subscription status */
	status: SubscriptionStatus | null;
	/** Loading state */
	loading: boolean;
	/** Error message if any */
	error: string | null;
	/** Last fetch timestamp */
	lastFetched: number | null;
}

// Store state using $state rune
let subscriptionState = $state<SubscriptionState>({
	status: null,
	loading: false,
	error: null,
	lastFetched: null,
});

// Cache duration: 5 minutes
const CACHE_DURATION_MS = 5 * 60 * 1000;

/**
 * Get the current subscription state (reactive)
 */
export function getSubscriptionState(): SubscriptionState {
	return subscriptionState;
}

/**
 * Check if subscription data is stale and needs refresh
 */
function isStale(): boolean {
	if (!subscriptionState.lastFetched) return true;
	return Date.now() - subscriptionState.lastFetched > CACHE_DURATION_MS;
}

/**
 * Fetch subscription status from API
 *
 * @param forceRefresh - Force refresh even if cache is valid
 */
export async function fetchSubscriptionStatus(
	forceRefresh = false,
): Promise<SubscriptionStatus | null> {
	const auth = getAuthState();

	if (!auth.isConnected || !auth.pubkey) {
		subscriptionState.error = 'Not authenticated';
		return null;
	}

	// Return cached data if still valid
	if (!forceRefresh && !isStale() && subscriptionState.status) {
		return subscriptionState.status;
	}

	subscriptionState.loading = true;
	subscriptionState.error = null;

	try {
		const response = await fetch(`/api/subscription/${auth.pubkey}`);

		if (!response.ok) {
			if (response.status === 429) {
				throw new Error('Too many requests. Please try again later.');
			}
			throw new Error(`Failed to fetch subscription status: ${response.statusText}`);
		}

		const status = (await response.json()) as SubscriptionStatus;

		subscriptionState.status = status;
		subscriptionState.lastFetched = Date.now();

		return status;
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch subscription';
		subscriptionState.error = message;
		return null;
	} finally {
		subscriptionState.loading = false;
	}
}

/**
 * Create a new subscription invoice
 *
 * @param redirectUrl - Optional URL to redirect after payment
 * @returns Invoice details or null on error
 */
export async function createSubscription(
	redirectUrl?: string,
): Promise<CreateInvoiceResponse | null> {
	const auth = getAuthState();

	if (!auth.isConnected || !auth.pubkey) {
		subscriptionState.error = 'Not authenticated';
		return null;
	}

	subscriptionState.loading = true;
	subscriptionState.error = null;

	try {
		const response = await fetch('/api/subscribe', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				pubkey: auth.pubkey,
				redirectUrl,
			}),
		});

		if (!response.ok) {
			if (response.status === 429) {
				throw new Error('Too many requests. Please try again later.');
			}
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.error || `Failed to create invoice: ${response.statusText}`);
		}

		const invoice = (await response.json()) as CreateInvoiceResponse;

		// Update state with pending invoice
		if (subscriptionState.status) {
			subscriptionState.status = {
				...subscriptionState.status,
				pendingInvoice: {
					id: invoice.invoiceId,
					checkoutUrl: invoice.checkoutUrl,
					expiresAt: invoice.expiresAt,
				},
			};
		}

		return invoice;
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to create subscription';
		subscriptionState.error = message;
		return null;
	} finally {
		subscriptionState.loading = false;
	}
}

/**
 * Clear subscription error
 */
export function clearSubscriptionError(): void {
	subscriptionState.error = null;
}

/**
 * Reset subscription state (e.g., on logout)
 */
export function resetSubscriptionState(): void {
	subscriptionState = {
		status: null,
		loading: false,
		error: null,
		lastFetched: null,
	};
}

/**
 * Check if subscription is expiring soon (within 7 days)
 */
export function isExpiringSoon(): boolean {
	const status = subscriptionState.status;
	if (!status?.active || !status.daysRemaining) return false;
	return status.daysRemaining <= 7;
}

/**
 * Check if subscription is expired
 */
export function isExpired(): boolean {
	const status = subscriptionState.status;
	if (!status?.expiresAt) return false;
	return status.expiresAt < Math.floor(Date.now() / 1000);
}

/**
 * Get formatted expiration date
 */
export function getExpirationDate(): string | null {
	const status = subscriptionState.status;
	if (!status?.expiresAt) return null;

	return new Date(status.expiresAt * 1000).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
}

/**
 * Check if user has an active Cloud subscription
 */
export function hasActiveSubscription(): boolean {
	return subscriptionState.status?.active === true;
}

/**
 * Get the managed relay URL if subscribed
 */
export function getManagedRelayUrl(): string | null {
	return subscriptionState.status?.relayUrl ?? null;
}
