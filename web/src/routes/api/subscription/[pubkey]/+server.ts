/**
 * GET /api/subscription/:pubkey
 *
 * Returns the subscription status for a given pubkey.
 * Checks for valid access tokens and recent invoices.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BTCPayClient, type Invoice } from '@redshift/payments';
import {
	checkRateLimit,
	getClientIdentifier,
	getRateLimitHeaders,
	RATE_LIMITS,
} from '$lib/server/rate-limiter';

/**
 * Subscription status response
 */
interface SubscriptionStatus {
	/** Whether user has an active subscription */
	active: boolean;
	/** Subscription tier (if active) */
	tier?: 'cloud' | 'teams' | 'enterprise';
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
 * Validate hex pubkey format
 */
function isValidPubkey(pubkey: string): boolean {
	return /^[a-f0-9]{64}$/i.test(pubkey);
}

export const GET: RequestHandler = async ({ params, platform, request }) => {
	const { pubkey } = params;
	const env = platform?.env;

	// Rate limiting
	const clientId = getClientIdentifier(request);
	const rateLimit = await checkRateLimit(clientId, RATE_LIMITS.standard, env?.CACHE);

	if (!rateLimit.allowed) {
		return json(
			{ error: 'Too many requests. Please try again later.' },
			{
				status: 429,
				headers: getRateLimitHeaders(rateLimit),
			},
		);
	}

	// Validate pubkey format
	if (!pubkey || !isValidPubkey(pubkey)) {
		throw error(400, 'Invalid pubkey: must be 64 character hex string');
	}

	// Validate environment
	if (!env?.BTCPAY_URL || !env?.BTCPAY_API_KEY || !env?.BTCPAY_STORE_ID) {
		console.error('Missing BTCPay configuration');
		throw error(500, 'Payment service not configured');
	}

	// Create BTCPay client
	const client = new BTCPayClient({
		url: env.BTCPAY_URL,
		apiKey: env.BTCPAY_API_KEY,
		storeId: env.BTCPAY_STORE_ID,
	});

	try {
		// Get recent invoices for this pubkey
		const invoices = await client.getInvoicesByPubkey(pubkey);

		// Find settled invoices (indicates active subscription)
		const settledInvoices = invoices.filter((inv: Invoice) => inv.status === 'Settled');

		// Find the most recent settled invoice
		const latestSettled = settledInvoices.sort(
			(a: Invoice, b: Invoice) => b.createdTime - a.createdTime,
		)[0];

		// Check for pending invoices
		const pendingInvoice = invoices.find(
			(inv: Invoice) => inv.status === 'New' || inv.status === 'Processing',
		);

		// Calculate subscription status
		const status: SubscriptionStatus = {
			active: false,
		};

		if (latestSettled) {
			// Subscription is 30 days from payment
			const expiresAt = latestSettled.createdTime + 30 * 24 * 60 * 60;
			const now = Math.floor(Date.now() / 1000);
			const daysRemaining = Math.max(0, Math.floor((expiresAt - now) / (24 * 60 * 60)));

			if (expiresAt > now) {
				status.active = true;
				status.tier = (latestSettled.metadata?.tier as SubscriptionStatus['tier']) ?? 'cloud';
				status.expiresAt = expiresAt;
				status.daysRemaining = daysRemaining;
				status.relayUrl = 'wss://relay.redshiftapp.com';
			}
		}

		// Include pending invoice if exists
		if (pendingInvoice) {
			status.pendingInvoice = {
				id: pendingInvoice.id,
				checkoutUrl: pendingInvoice.checkoutLink,
				expiresAt: pendingInvoice.expirationTime,
			};
		}

		return json(status, {
			headers: getRateLimitHeaders(rateLimit),
		});
	} catch (err) {
		console.error('Failed to get subscription status:', err);
		throw error(502, 'Failed to retrieve subscription status');
	}
};
