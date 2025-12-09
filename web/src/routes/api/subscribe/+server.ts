/**
 * POST /api/subscribe
 *
 * Creates a BTCPay invoice for Cloud tier subscription.
 * Returns the invoice details including checkout URL.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BTCPayClient, createCloudSubscriptionRequest } from '@redshift/payments';
import {
	checkRateLimit,
	getClientIdentifier,
	getRateLimitHeaders,
	RATE_LIMITS,
} from '$lib/server/rate-limiter';

/**
 * Request body for creating a subscription
 */
interface SubscribeRequest {
	/** User's Nostr pubkey (hex, 64 chars) */
	pubkey: string;
	/** Optional redirect URL after payment */
	redirectUrl?: string;
}

/**
 * Response containing invoice details
 */
interface SubscribeResponse {
	/** BTCPay invoice ID */
	invoiceId: string;
	/** URL to BTCPay checkout page */
	checkoutUrl: string;
	/** Invoice amount in USD */
	amount: string;
	/** Invoice expiration timestamp (Unix ms) */
	expiresAt: number;
}

/**
 * Validate hex pubkey format
 */
function isValidPubkey(pubkey: string): boolean {
	return /^[a-f0-9]{64}$/i.test(pubkey);
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;

	// Rate limiting
	const clientId = getClientIdentifier(request);
	const rateLimit = await checkRateLimit(clientId, RATE_LIMITS.subscribe, env?.CACHE);

	if (!rateLimit.allowed) {
		return json(
			{ error: 'Too many requests. Please try again later.' },
			{
				status: 429,
				headers: getRateLimitHeaders(rateLimit),
			},
		);
	}

	// Validate environment
	if (!env?.BTCPAY_URL || !env?.BTCPAY_API_KEY || !env?.BTCPAY_STORE_ID) {
		console.error('Missing BTCPay configuration');
		throw error(500, 'Payment service not configured');
	}

	// Parse request body
	let body: SubscribeRequest;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	// Validate pubkey
	if (!body.pubkey || !isValidPubkey(body.pubkey)) {
		throw error(400, 'Invalid pubkey: must be 64 character hex string');
	}

	// Create BTCPay client
	const client = new BTCPayClient({
		url: env.BTCPAY_URL,
		apiKey: env.BTCPAY_API_KEY,
		storeId: env.BTCPAY_STORE_ID,
	});

	// Create subscription invoice request
	const invoiceRequest = createCloudSubscriptionRequest(body.pubkey);

	// Add redirect URL if provided
	if (body.redirectUrl) {
		invoiceRequest.checkout = {
			...invoiceRequest.checkout,
			redirectUrl: body.redirectUrl,
		};
	}

	try {
		const invoice = await client.createInvoice(invoiceRequest);

		const response: SubscribeResponse = {
			invoiceId: invoice.id,
			checkoutUrl: invoice.checkoutLink,
			amount: invoice.amount,
			expiresAt: invoice.expirationTime,
		};

		return json(response, {
			status: 201,
			headers: getRateLimitHeaders(rateLimit),
		});
	} catch (err) {
		console.error('Failed to create invoice:', err);
		throw error(502, 'Failed to create payment invoice');
	}
};
