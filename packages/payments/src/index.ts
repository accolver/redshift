/**
 * @redshift/payments - BTCPay Server integration for Redshift Cloud subscriptions
 *
 * This package provides:
 * - BTCPay Greenfield API client for invoice management
 * - Webhook signature verification
 * - Subscription payment helpers
 *
 * @example
 * ```typescript
 * import { BTCPayClient, createCloudSubscriptionRequest } from '@redshift/payments';
 *
 * const client = new BTCPayClient({
 *   url: 'https://btcpay.example.com',
 *   apiKey: 'your-api-key',
 *   storeId: 'your-store-id',
 *   webhookSecret: 'your-webhook-secret',
 * });
 *
 * // Create a subscription invoice
 * const request = createCloudSubscriptionRequest(userPubkey);
 * const invoice = await client.createInvoice(request);
 * console.log(invoice.checkoutLink);
 *
 * // Verify webhook
 * const isValid = await client.verifyWebhookSignature(payload, signature);
 * ```
 */

export { BTCPayClient, BTCPayError, createCloudSubscriptionRequest } from './btcpay-client';

export type {
	BTCPayConfig,
	CreateInvoiceRequest,
	Invoice,
	InvoiceMetadata,
	InvoiceStatus,
	SubscriptionStatus,
	WebhookEventType,
	WebhookPayload,
} from './types';
