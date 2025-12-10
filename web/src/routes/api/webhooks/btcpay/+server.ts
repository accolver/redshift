/**
 * POST /api/webhooks/btcpay
 *
 * Handles BTCPay webhook events for payment processing.
 * On InvoiceSettled, generates an access token and publishes to relay.
 */

import { error, text } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BTCPayClient } from '@redshift/payments';
import type { WebhookPayload } from '@redshift/payments';
import { createAccessToken } from '@redshift/cloud';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '$lib/server/rate-limiter';

/**
 * Relay configuration
 */
const RELAY_URL = 'wss://relay.redshiftapp.com';

/**
 * Publish an event to a Nostr relay
 */
async function publishToRelay(
	relayUrl: string,
	event: {
		id: string;
		pubkey: string;
		created_at: number;
		kind: number;
		tags: string[][];
		content: string;
		sig: string;
	},
): Promise<boolean> {
	return new Promise((resolve) => {
		try {
			const ws = new WebSocket(relayUrl);
			let resolved = false;

			const timeout = setTimeout(() => {
				if (!resolved) {
					resolved = true;
					ws.close();
					resolve(false);
				}
			}, 10000); // 10 second timeout

			ws.onopen = () => {
				// Send the event
				ws.send(JSON.stringify(['EVENT', event]));
			};

			ws.onmessage = (msg) => {
				try {
					const data = JSON.parse(msg.data as string);
					// Check for OK response: ["OK", event_id, success, message]
					if (data[0] === 'OK' && data[1] === event.id) {
						clearTimeout(timeout);
						resolved = true;
						ws.close();
						resolve(data[2] === true);
					}
				} catch {
					// Ignore parse errors
				}
			};

			ws.onerror = () => {
				if (!resolved) {
					clearTimeout(timeout);
					resolved = true;
					ws.close();
					resolve(false);
				}
			};
		} catch {
			resolve(false);
		}
	});
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const env = platform?.env;

	// Rate limiting (lenient for webhooks, but still protect against abuse)
	const clientId = getClientIdentifier(request);
	const rateLimit = await checkRateLimit(clientId, RATE_LIMITS.webhook, env?.CACHE);

	if (!rateLimit.allowed) {
		return text('Rate limited', { status: 429 });
	}

	// Validate environment
	if (!env?.BTCPAY_URL || !env?.BTCPAY_API_KEY || !env?.BTCPAY_STORE_ID) {
		console.error('Missing BTCPay configuration');
		throw error(500, 'Payment service not configured');
	}

	if (!env?.BTCPAY_WEBHOOK_SECRET) {
		console.error('Missing webhook secret');
		throw error(500, 'Webhook not configured');
	}

	if (!env?.RELAY_OPERATOR_NSEC) {
		console.error('Missing relay operator key');
		throw error(500, 'Token signing not configured');
	}

	// Get raw body for signature verification
	const rawBody = await request.text();

	// Get signature from header
	const signature = request.headers.get('BTCPay-Sig');
	if (!signature) {
		throw error(401, 'Missing webhook signature');
	}

	// Create BTCPay client for signature verification
	const client = new BTCPayClient({
		url: env.BTCPAY_URL,
		apiKey: env.BTCPAY_API_KEY,
		storeId: env.BTCPAY_STORE_ID,
		webhookSecret: env.BTCPAY_WEBHOOK_SECRET,
	});

	// Verify signature
	const isValid = await client.verifyWebhookSignature(rawBody, signature);
	if (!isValid) {
		console.error('Invalid webhook signature');
		throw error(401, 'Invalid signature');
	}

	// Parse webhook payload
	let payload: WebhookPayload;
	try {
		payload = client.parseWebhookPayload(rawBody);
	} catch {
		throw error(400, 'Invalid webhook payload');
	}

	console.log(`Received webhook: ${payload.type} for invoice ${payload.invoiceId}`);

	// Handle different event types
	switch (payload.type) {
		case 'InvoiceSettled': {
			// Get full invoice details
			const invoice = await client.getInvoice(payload.invoiceId);

			// Extract pubkey from metadata
			const pubkey = invoice.metadata?.pubkey;
			if (!pubkey || typeof pubkey !== 'string') {
				console.error('Invoice missing pubkey in metadata');
				return text('OK', { status: 200 }); // Acknowledge but don't process
			}

			const tier = (invoice.metadata?.tier as 'cloud' | 'teams' | 'enterprise') ?? 'cloud';

			console.log(`Generating access token for pubkey: ${pubkey.slice(0, 8)}...`);

			// Generate access token
			const { event: tokenEvent, token } = createAccessToken(
				pubkey,
				env.RELAY_OPERATOR_NSEC,
				invoice.id,
				tier,
				RELAY_URL,
			);

			// Publish to relay (fire and forget with waitUntil)
			if (platform?.context?.waitUntil) {
				platform.context.waitUntil(
					publishToRelay(RELAY_URL, tokenEvent).then((success) => {
						if (success) {
							console.log(
								`Access token published for ${pubkey.slice(0, 8)}..., expires: ${new Date(token.expiresAt * 1000).toISOString()}`,
							);
						} else {
							console.error(`Failed to publish access token for ${pubkey.slice(0, 8)}...`);
						}
					}),
				);
			} else {
				// Fallback: await the publish
				const success = await publishToRelay(RELAY_URL, tokenEvent);
				if (success) {
					console.log(`Access token published for ${pubkey.slice(0, 8)}...`);
				} else {
					console.error(`Failed to publish access token for ${pubkey.slice(0, 8)}...`);
				}
			}

			return text('OK', { status: 200 });
		}

		case 'InvoiceExpired': {
			console.log(`Invoice ${payload.invoiceId} expired`);
			// No action needed - invoice cleanup handled by BTCPay
			return text('OK', { status: 200 });
		}

		case 'InvoiceInvalid': {
			console.log(`Invoice ${payload.invoiceId} marked invalid`);
			// Could log for monitoring purposes
			return text('OK', { status: 200 });
		}

		default: {
			// Acknowledge unknown events
			console.log(`Unhandled webhook type: ${payload.type}`);
			return text('OK', { status: 200 });
		}
	}
};
