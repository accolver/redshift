# BTCPay Integration

## Overview

This spec defines the integration with BTCPay Server for subscription payments.
BTCPay Server is configured with a **Voltage Cloud** hosted LND node for
Lightning payments, eliminating the need for self-hosted Lightning
infrastructure.

## Infrastructure

- **BTCPay Server**: Self-hosted or BTCPay Cloud instance
- **Lightning Node**: Voltage Cloud LND (~$10-27/month, managed)
- **On-chain**: BTCPay's built-in hot wallet
- **Webhooks**: Cloudflare Workers endpoint for event processing

## ADDED Requirements

### Requirement: Invoice Creation

The system SHALL create BTCPay invoices for subscription payments using the
Greenfield API.

#### Scenario: Create subscription invoice

- **WHEN** the backend receives `POST /api/subscribe` with a valid pubkey
- **THEN** the system calls BTCPay Greenfield API to create an invoice
- **AND** returns the invoice ID, payment URL, and Lightning invoice string

#### Scenario: Invoice includes user metadata

- **WHEN** a BTCPay invoice is created
- **THEN** the invoice metadata includes:
  - User's Nostr pubkey
  - Tier: "cloud"
  - Period: "monthly"

### Requirement: Webhook Processing

The system SHALL process BTCPay webhook events to handle payment lifecycle.

#### Scenario: Webhook signature validation

- **WHEN** the backend receives a BTCPay webhook
- **THEN** the system validates the HMAC signature using the webhook secret
- **AND** rejects requests with invalid signatures (HTTP 401)

#### Scenario: InvoiceSettled event handling

- **WHEN** the backend receives an `InvoiceSettled` webhook event
- **THEN** the system extracts the user pubkey from invoice metadata
- **AND** triggers access token generation

#### Scenario: InvoiceExpired event handling

- **WHEN** the backend receives an `InvoiceExpired` webhook event
- **THEN** the system logs the expiration
- **AND** no access token is generated

#### Scenario: InvoiceInvalid event handling

- **WHEN** the backend receives an `InvoiceInvalid` webhook event
- **THEN** the system logs the invalid payment
- **AND** no access token is generated

### Requirement: Payment Status Query

The system SHALL provide an API to check subscription status by pubkey.

#### Scenario: Active subscription status

- **WHEN** the backend receives `GET /api/subscription/:pubkey` for a subscriber
- **THEN** the system returns status "active" with expiration timestamp

#### Scenario: Expired subscription status

- **WHEN** the backend receives `GET /api/subscription/:pubkey` for an expired
  subscriber
- **THEN** the system returns status "expired" with last expiration timestamp

#### Scenario: No subscription status

- **WHEN** the backend receives `GET /api/subscription/:pubkey` for a non-
  subscriber
- **THEN** the system returns status "none"

### Requirement: Payment Method Support

The system SHALL support both Lightning and on-chain Bitcoin payments.

#### Scenario: Lightning payment accepted

- **WHEN** a user pays a subscription invoice via Lightning
- **THEN** the payment settles instantly
- **AND** webhook fires within seconds

#### Scenario: On-chain payment accepted

- **WHEN** a user pays a subscription invoice via on-chain BTC
- **THEN** the payment settles after 1 confirmation
- **AND** webhook fires when confirmed

### Requirement: API Rate Limiting

The system SHALL rate limit subscription API endpoints to prevent abuse.

#### Scenario: Rate limit exceeded

- **WHEN** a client exceeds 10 requests per minute to `/api/subscribe`
- **THEN** the system returns HTTP 429 Too Many Requests
- **AND** includes Retry-After header

## Implementation Notes

### Voltage Cloud Integration

BTCPay Server connects to a Voltage Cloud LND node via:

- **Connection String**: Provided by Voltage dashboard
- **Macaroon**: Admin macaroon for invoice creation
- **TLS**: Voltage-managed certificates

Benefits of Voltage Cloud over self-hosted:

- No node maintenance or channel management required
- Automatic backups and high availability
- ~$10-27/month depending on capacity needs
- Official BTCPay integration documentation available

### Webhook Security

- All webhooks are validated via HMAC signature
- Webhook endpoint deployed on Cloudflare Workers
- Failed webhook deliveries are retried by BTCPay with exponential backoff

### Currency Handling

- Prices displayed in USD for user clarity
- BTCPay converts to BTC/sats at invoice creation time
- Payment amounts locked for invoice duration (15-30 minutes)
