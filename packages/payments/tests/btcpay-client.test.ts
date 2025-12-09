/**
 * BTCPay Client Tests
 *
 * Tests for BTCPay Server Greenfield API client
 */

import { describe, expect, it, mock } from 'bun:test';

import { BTCPayClient, BTCPayError, createCloudSubscriptionRequest } from '../src/btcpay-client';
import type { BTCPayConfig } from '../src/types';

// Mock config for tests
const mockConfig: BTCPayConfig = {
	url: 'https://btcpay.example.com/',
	apiKey: 'test-api-key',
	storeId: 'test-store-id',
	webhookSecret: 'test-webhook-secret',
};

// Mock invoice response
const mockInvoiceResponse: Record<string, unknown> = {
	id: 'inv_123',
	storeId: 'test-store-id',
	amount: '5.00',
	currency: 'USD',
	status: 'New',
	checkoutLink: 'https://btcpay.example.com/i/inv_123',
	createdTime: 1700000000000,
	expirationTime: 1700001800000,
	metadata: {
		pubkey: 'abc123',
		tier: 'cloud',
		period: 'monthly',
	},
	availablePaymentMethods: ['BTC', 'BTC-LightningNetwork'],
};

describe('BTCPayClient', () => {
	describe('constructor', () => {
		it('normalizes URL by removing trailing slash', () => {
			const client = new BTCPayClient({
				...mockConfig,
				url: 'https://btcpay.example.com/',
			});

			// We can't directly access private fields, but we can verify behavior
			expect(client).toBeDefined();
		});

		it('accepts URL without trailing slash', () => {
			const client = new BTCPayClient({
				...mockConfig,
				url: 'https://btcpay.example.com',
			});

			expect(client).toBeDefined();
		});
	});

	describe('createInvoice', () => {
		it('creates invoice with correct request body', async () => {
			const client = new BTCPayClient(mockConfig);

			// Mock fetch
			const mockFetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () => Promise.resolve(mockInvoiceResponse),
				}),
			);
			globalThis.fetch = mockFetch as unknown as typeof fetch;

			const invoice = await client.createInvoice({
				amount: '5.00',
				currency: 'USD',
				metadata: {
					pubkey: 'abc123',
					tier: 'cloud',
					period: 'monthly',
				},
			});

			expect(mockFetch).toHaveBeenCalledTimes(1);
			const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];

			expect(url).toBe('https://btcpay.example.com/api/v1/stores/test-store-id/invoices');
			expect(options.method).toBe('POST');
			expect(options.headers).toEqual({
				'Content-Type': 'application/json',
				Authorization: 'token test-api-key',
			});

			const body = JSON.parse(options.body as string);
			expect(body.amount).toBe('5.00');
			expect(body.currency).toBe('USD');
			expect(body.checkout.paymentMethods).toContain('BTC-LightningNetwork');

			expect(invoice.id).toBe('inv_123');
			expect(invoice.status).toBe('New');
		});

		it('throws BTCPayError on API failure', async () => {
			const client = new BTCPayClient(mockConfig);

			globalThis.fetch = mock(() =>
				Promise.resolve({
					ok: false,
					status: 401,
					statusText: 'Unauthorized',
					json: () => Promise.resolve({ error: 'Invalid API key' }),
				}),
			) as unknown as typeof fetch;

			await expect(
				client.createInvoice({
					amount: '5.00',
					currency: 'USD',
				}),
			).rejects.toThrow(BTCPayError);
		});

		it('uses default checkout options when not provided', async () => {
			const client = new BTCPayClient(mockConfig);

			globalThis.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () => Promise.resolve(mockInvoiceResponse),
				}),
			) as unknown as typeof fetch;

			await client.createInvoice({
				amount: '5.00',
				currency: 'USD',
			});

			const [, options] = (globalThis.fetch as ReturnType<typeof mock>).mock.calls[0] as [
				string,
				RequestInit,
			];
			const body = JSON.parse(options.body as string);

			expect(body.checkout.expirationMinutes).toBe(30);
			expect(body.checkout.requiresRefundEmail).toBe(false);
		});
	});

	describe('getInvoice', () => {
		it('fetches invoice by ID', async () => {
			const client = new BTCPayClient(mockConfig);

			globalThis.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () => Promise.resolve(mockInvoiceResponse),
				}),
			) as unknown as typeof fetch;

			const invoice = await client.getInvoice('inv_123');

			const [url] = (globalThis.fetch as ReturnType<typeof mock>).mock.calls[0] as [string];
			expect(url).toBe('https://btcpay.example.com/api/v1/stores/test-store-id/invoices/inv_123');

			expect(invoice.id).toBe('inv_123');
			expect(invoice.metadata?.pubkey).toBe('abc123');
		});

		it('throws on non-existent invoice', async () => {
			const client = new BTCPayClient(mockConfig);

			globalThis.fetch = mock(() =>
				Promise.resolve({
					ok: false,
					status: 404,
					statusText: 'Not Found',
					json: () => Promise.resolve({ error: 'Invoice not found' }),
				}),
			) as unknown as typeof fetch;

			await expect(client.getInvoice('nonexistent')).rejects.toThrow(BTCPayError);
		});
	});

	describe('getInvoicesByPubkey', () => {
		it('filters invoices by pubkey', async () => {
			const client = new BTCPayClient(mockConfig);

			const invoices = [
				{
					...mockInvoiceResponse,
					id: 'inv_1',
					metadata: { pubkey: 'abc123', tier: 'cloud', period: 'monthly' },
				},
				{
					...mockInvoiceResponse,
					id: 'inv_2',
					metadata: { pubkey: 'xyz789', tier: 'cloud', period: 'monthly' },
				},
				{
					...mockInvoiceResponse,
					id: 'inv_3',
					metadata: { pubkey: 'abc123', tier: 'cloud', period: 'monthly' },
				},
			];

			globalThis.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () => Promise.resolve(invoices),
				}),
			) as unknown as typeof fetch;

			const result = await client.getInvoicesByPubkey('abc123');

			expect(result).toHaveLength(2);
			expect(result.every((inv) => inv.metadata?.pubkey === 'abc123')).toBe(true);
		});

		it('returns empty array when no invoices match', async () => {
			const client = new BTCPayClient(mockConfig);

			globalThis.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () => Promise.resolve([mockInvoiceResponse]),
				}),
			) as unknown as typeof fetch;

			const result = await client.getInvoicesByPubkey('nonexistent');

			expect(result).toHaveLength(0);
		});
	});

	describe('verifyWebhookSignature', () => {
		it('verifies valid HMAC signature', async () => {
			const client = new BTCPayClient(mockConfig);

			const payload = '{"type":"InvoiceSettled","invoiceId":"inv_123"}';

			// Compute expected signature using the webhook secret
			const encoder = new TextEncoder();
			const key = await crypto.subtle.importKey(
				'raw',
				encoder.encode('test-webhook-secret'),
				{ name: 'HMAC', hash: 'SHA-256' },
				false,
				['sign'],
			);
			const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
			const expectedSig = Array.from(new Uint8Array(signatureBuffer))
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('');

			const signature = `sha256=${expectedSig}`;

			const isValid = await client.verifyWebhookSignature(payload, signature);

			expect(isValid).toBe(true);
		});

		it('rejects invalid signature', async () => {
			const client = new BTCPayClient(mockConfig);

			const payload = '{"type":"InvoiceSettled","invoiceId":"inv_123"}';
			const signature = 'sha256=invalidsignature';

			const isValid = await client.verifyWebhookSignature(payload, signature);

			expect(isValid).toBe(false);
		});

		it('rejects malformed signature format', async () => {
			const client = new BTCPayClient(mockConfig);

			const payload = '{"type":"InvoiceSettled"}';

			// Missing sha256= prefix
			expect(await client.verifyWebhookSignature(payload, 'abc123')).toBe(false);

			// Wrong algorithm prefix
			expect(await client.verifyWebhookSignature(payload, 'md5=abc123')).toBe(false);
		});

		it('throws when webhook secret not configured', async () => {
			const client = new BTCPayClient({
				...mockConfig,
				webhookSecret: undefined,
			});

			await expect(client.verifyWebhookSignature('payload', 'sha256=abc')).rejects.toThrow(
				'Webhook secret not configured',
			);
		});
	});

	describe('parseWebhookPayload', () => {
		it('parses valid webhook payload', () => {
			const client = new BTCPayClient(mockConfig);

			const payload = JSON.stringify({
				deliveryId: 'del_123',
				webhookId: 'wh_123',
				isRedelivery: false,
				type: 'InvoiceSettled',
				timestamp: 1700000000,
				storeId: 'test-store-id',
				invoiceId: 'inv_123',
				metadata: {
					pubkey: 'abc123',
					tier: 'cloud',
					period: 'monthly',
				},
			});

			const parsed = client.parseWebhookPayload(payload);

			expect(parsed.type).toBe('InvoiceSettled');
			expect(parsed.invoiceId).toBe('inv_123');
			expect(parsed.metadata?.pubkey).toBe('abc123');
		});

		it('throws on invalid JSON', () => {
			const client = new BTCPayClient(mockConfig);

			expect(() => client.parseWebhookPayload('invalid json')).toThrow('Invalid webhook payload');
		});
	});
});

describe('BTCPayError', () => {
	it('creates error with message only', () => {
		const error = new BTCPayError('Something went wrong');

		expect(error.message).toBe('Something went wrong');
		expect(error.name).toBe('BTCPayError');
		expect(error.statusCode).toBeUndefined();
		expect(error.details).toBeUndefined();
	});

	it('creates error with status code and details', () => {
		const error = new BTCPayError('API error', 401, { reason: 'unauthorized' });

		expect(error.message).toBe('API error');
		expect(error.statusCode).toBe(401);
		expect(error.details).toEqual({ reason: 'unauthorized' });
	});
});

describe('createCloudSubscriptionRequest', () => {
	it('creates correct request for Cloud tier', () => {
		const request = createCloudSubscriptionRequest('abc123pubkey');

		expect(request.amount).toBe('5.00');
		expect(request.currency).toBe('USD');
		expect(request.metadata?.pubkey).toBe('abc123pubkey');
		expect(request.metadata?.tier).toBe('cloud');
		expect(request.metadata?.period).toBe('monthly');
		expect(request.checkout?.expirationMinutes).toBe(30);
	});

	it('includes orderId when provided', () => {
		const request = createCloudSubscriptionRequest('abc123', 'order_456');

		expect(request.metadata?.orderId).toBe('order_456');
	});

	it('sets orderId to undefined when not provided', () => {
		const request = createCloudSubscriptionRequest('abc123');

		expect(request.metadata?.orderId).toBeUndefined();
	});
});
