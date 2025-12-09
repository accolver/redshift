/**
 * BTCPay Server Greenfield API Client
 *
 * Handles invoice creation and status checks for Redshift Cloud subscriptions.
 * Uses the Greenfield API v1: https://docs.btcpayserver.org/API/Greenfield/v1/
 */

import type {
	BTCPayConfig,
	CreateInvoiceRequest,
	Invoice,
	InvoiceMetadata,
	WebhookPayload,
} from './types';

/**
 * Error thrown by BTCPay operations
 */
export class BTCPayError extends Error {
	constructor(
		message: string,
		public readonly statusCode?: number,
		public readonly details?: unknown,
	) {
		super(message);
		this.name = 'BTCPayError';
	}
}

/**
 * BTCPay Server API client
 */
export class BTCPayClient {
	private readonly baseUrl: string;
	private readonly apiKey: string;
	private readonly storeId: string;
	private readonly webhookSecret?: string;

	constructor(config: BTCPayConfig) {
		// Normalize URL (remove trailing slash)
		this.baseUrl = config.url.replace(/\/$/, '');
		this.apiKey = config.apiKey;
		this.storeId = config.storeId;
		this.webhookSecret = config.webhookSecret;
	}

	/**
	 * Create a new invoice for a subscription payment
	 */
	async createInvoice(request: CreateInvoiceRequest): Promise<Invoice> {
		const response = await this.fetch(`/api/v1/stores/${this.storeId}/invoices`, {
			method: 'POST',
			body: JSON.stringify({
				amount: request.amount,
				currency: request.currency,
				metadata: request.metadata,
				checkout: {
					expirationMinutes: request.checkout?.expirationMinutes ?? 30,
					redirectUrl: request.checkout?.redirectUrl,
					requiresRefundEmail: request.checkout?.requiresRefundEmail ?? false,
					// Default payment methods: Lightning + On-chain
					paymentMethods: ['BTC', 'BTC-LightningNetwork'],
				},
			}),
		});

		return this.parseInvoice(response);
	}

	/**
	 * Get an invoice by ID
	 */
	async getInvoice(invoiceId: string): Promise<Invoice> {
		const response = await this.fetch(`/api/v1/stores/${this.storeId}/invoices/${invoiceId}`);
		return this.parseInvoice(response);
	}

	/**
	 * Get all invoices for a specific pubkey
	 */
	async getInvoicesByPubkey(pubkey: string): Promise<Invoice[]> {
		// BTCPay doesn't support filtering by metadata directly,
		// so we fetch recent invoices and filter client-side
		const response = await this.fetch(`/api/v1/stores/${this.storeId}/invoices?take=100`);

		const invoices = (response as unknown[]).map((inv) => this.parseInvoice(inv));
		return invoices.filter((inv) => inv.metadata?.pubkey === pubkey);
	}

	/**
	 * Verify webhook signature using HMAC-SHA256
	 *
	 * BTCPay signs webhooks with HMAC-SHA256 using the webhook secret.
	 * The signature is in the `BTCPay-Sig` header as `sha256=<hex>`.
	 */
	async verifyWebhookSignature(payload: string, signature: string): Promise<boolean> {
		if (!this.webhookSecret) {
			throw new BTCPayError('Webhook secret not configured');
		}

		// Extract the signature from "sha256=<hex>" format
		const sigMatch = signature.match(/^sha256=([a-f0-9]+)$/i);
		if (!sigMatch) {
			return false;
		}

		const expectedSig = sigMatch[1];

		// Compute HMAC-SHA256
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			'raw',
			encoder.encode(this.webhookSecret),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign'],
		);

		const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));

		// Convert to hex
		const computedSig = Array.from(new Uint8Array(signatureBuffer))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');

		// Constant-time comparison
		return this.timingSafeEqual(computedSig, expectedSig);
	}

	/**
	 * Parse webhook payload
	 */
	parseWebhookPayload(payload: string): WebhookPayload {
		try {
			return JSON.parse(payload) as WebhookPayload;
		} catch {
			throw new BTCPayError('Invalid webhook payload');
		}
	}

	/**
	 * Make an authenticated request to BTCPay Server
	 */
	private async fetch(path: string, options: RequestInit = {}): Promise<unknown> {
		const url = `${this.baseUrl}${path}`;

		const response = await fetch(url, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `token ${this.apiKey}`,
				...options.headers,
			},
		});

		if (!response.ok) {
			let details: unknown;
			try {
				details = await response.json();
			} catch {
				details = await response.text();
			}

			throw new BTCPayError(`BTCPay API error: ${response.statusText}`, response.status, details);
		}

		return response.json();
	}

	/**
	 * Parse raw invoice response to typed Invoice
	 */
	private parseInvoice(data: unknown): Invoice {
		const inv = data as Record<string, unknown>;
		return {
			id: inv.id as string,
			storeId: inv.storeId as string,
			amount: inv.amount as string,
			currency: inv.currency as string,
			status: inv.status as Invoice['status'],
			checkoutLink: inv.checkoutLink as string,
			createdTime: inv.createdTime as number,
			expirationTime: inv.expirationTime as number,
			metadata: inv.metadata as InvoiceMetadata | undefined,
			availablePaymentMethods: inv.availablePaymentMethods as string[] | undefined,
		};
	}

	/**
	 * Timing-safe string comparison to prevent timing attacks
	 */
	private timingSafeEqual(a: string, b: string): boolean {
		if (a.length !== b.length) {
			return false;
		}

		let result = 0;
		for (let i = 0; i < a.length; i++) {
			result |= a.charCodeAt(i) ^ b.charCodeAt(i);
		}

		return result === 0;
	}
}

/**
 * Create a subscription invoice for $5/month Cloud tier
 */
export function createCloudSubscriptionRequest(
	pubkey: string,
	orderId?: string,
): CreateInvoiceRequest {
	return {
		amount: '5.00',
		currency: 'USD',
		metadata: {
			pubkey,
			tier: 'cloud',
			period: 'monthly',
			orderId,
		},
		checkout: {
			expirationMinutes: 30,
		},
	};
}
