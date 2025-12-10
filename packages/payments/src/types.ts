/**
 * Types for BTCPay Server Greenfield API integration
 */

/**
 * BTCPay invoice status
 */
export type InvoiceStatus =
	| 'New'
	| 'Processing'
	| 'Expired'
	| 'Invalid'
	| 'Settled'
	| 'PartiallyPaid';

/**
 * BTCPay invoice creation request
 */
export interface CreateInvoiceRequest {
	/** Amount in the specified currency */
	amount: string;
	/** Currency code (e.g., 'USD', 'BTC') */
	currency: string;
	/** Metadata to attach to the invoice */
	metadata?: InvoiceMetadata;
	/** Checkout options */
	checkout?: {
		/** Expiration time in minutes */
		expirationMinutes?: number;
		/** Redirect URL after payment */
		redirectUrl?: string;
		/** Require customer email */
		requiresRefundEmail?: boolean;
	};
}

/**
 * Metadata attached to invoices for tracking
 */
export interface InvoiceMetadata {
	/** User's Nostr pubkey (hex) */
	pubkey: string;
	/** Subscription tier */
	tier: 'cloud' | 'teams' | 'enterprise';
	/** Subscription period */
	period: 'monthly' | 'yearly';
	/** Order reference for tracking */
	orderId?: string;
}

/**
 * BTCPay invoice response
 */
export interface Invoice {
	/** Unique invoice ID */
	id: string;
	/** Store ID */
	storeId: string;
	/** Invoice amount */
	amount: string;
	/** Currency code */
	currency: string;
	/** Invoice status */
	status: InvoiceStatus;
	/** Checkout link URL */
	checkoutLink: string;
	/** Creation timestamp */
	createdTime: number;
	/** Expiration timestamp */
	expirationTime: number;
	/** Metadata */
	metadata?: InvoiceMetadata;
	/** Payment methods available */
	availablePaymentMethods?: string[];
}

/**
 * BTCPay webhook event types
 */
export type WebhookEventType =
	| 'InvoiceCreated'
	| 'InvoiceReceivedPayment'
	| 'InvoiceProcessing'
	| 'InvoiceExpired'
	| 'InvoiceSettled'
	| 'InvoiceInvalid'
	| 'InvoicePaymentSettled';

/**
 * BTCPay webhook payload
 */
export interface WebhookPayload {
	/** Delivery ID for idempotency */
	deliveryId: string;
	/** Webhook ID */
	webhookId: string;
	/** Original delivery ID (for redeliveries) */
	originalDeliveryId?: string;
	/** Whether this is a redelivery */
	isRedelivery: boolean;
	/** Event type */
	type: WebhookEventType;
	/** Event timestamp */
	timestamp: number;
	/** Store ID */
	storeId: string;
	/** Invoice ID */
	invoiceId: string;
	/** Additional event-specific data */
	metadata?: InvoiceMetadata;
	/** Manual delivery flag */
	manuallyMarked?: boolean;
	/** Over-payment flag */
	overPaid?: boolean;
	/** Partial payment flag */
	partiallyPaid?: boolean;
}

/**
 * BTCPay client configuration
 */
export interface BTCPayConfig {
	/** BTCPay Server URL */
	url: string;
	/** API key with invoice permissions */
	apiKey: string;
	/** Store ID */
	storeId: string;
	/** Webhook secret for HMAC validation */
	webhookSecret?: string;
}

/**
 * Subscription status response
 */
export interface SubscriptionStatus {
	/** Subscription state */
	status: 'none' | 'active' | 'expired' | 'pending';
	/** Subscription tier */
	tier?: 'cloud' | 'teams' | 'enterprise';
	/** Expiration timestamp (Unix seconds) */
	expiresAt?: number;
	/** Last invoice ID */
	lastInvoiceId?: string;
	/** Managed relay URL (for active Cloud subscribers) */
	relayUrl?: string;
}
