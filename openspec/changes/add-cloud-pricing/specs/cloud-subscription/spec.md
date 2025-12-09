# Cloud Subscription

## Overview

This spec defines the Cloud subscription tier which provides users with access
to a managed **Nosflare relay** (Nostr relay on Cloudflare Workers) for
reliable, low-latency secret storage. The relay is hosted at
`wss://relay.redshiftapp.com`.

## ADDED Requirements

### Requirement: Subscription Status Display

The system SHALL display the user's current subscription status in both web
admin and CLI interfaces.

#### Scenario: Active Cloud subscription shown in web admin

- **WHEN** a user with an active Cloud subscription visits `/admin/subscribe`
- **THEN** the page displays:
  - Current plan: "Cloud"
  - Status: "Active"
  - Expiration date
  - Managed relay URL
  - Option to cancel or manage subscription

#### Scenario: No subscription shown for free user

- **WHEN** a user without a subscription visits `/admin/subscribe`
- **THEN** the page displays:
  - Current plan: "Free"
  - Pricing and feature comparison
  - "Subscribe" call-to-action button

#### Scenario: CLI subscription status command

- **WHEN** a user runs `redshift subscription status`
- **THEN** the CLI outputs subscription details including plan, status, expiry
  date, and relay URL

### Requirement: Subscription Purchase Flow

The system SHALL allow users to subscribe to the Cloud tier via BTCPay Server
payment.

#### Scenario: User initiates subscription

- **WHEN** a free user clicks "Subscribe" on `/admin/subscribe`
- **THEN** the system creates a BTCPay invoice for $5 USD
- **AND** displays a payment modal with:
  - Lightning invoice QR code
  - On-chain BTC address (fallback)
  - Invoice expiration countdown

#### Scenario: Payment completed successfully

- **WHEN** BTCPay Server sends `InvoiceSettled` webhook
- **THEN** the system generates a CloudAccessToken
- **AND** publishes the token to the managed relay (NIP-59 wrapped)
- **AND** the user's subscription status updates to "Active"

#### Scenario: Payment expires without completion

- **WHEN** BTCPay invoice expires without payment
- **THEN** the payment modal shows "Payment expired"
- **AND** offers option to create a new invoice

### Requirement: Subscription Expiration Handling

The system SHALL handle subscription expiration gracefully without data loss.

#### Scenario: Subscription expiring soon

- **WHEN** a user's subscription expires within 7 days
- **THEN** the web admin displays a renewal reminder banner
- **AND** the CLI shows a warning on startup

#### Scenario: Subscription expired

- **WHEN** a user's subscription expires
- **THEN** the managed relay rejects new write operations
- **AND** existing secrets remain readable on free relays
- **AND** user is prompted to renew or configure alternative relay

### Requirement: CLI Subscription Upgrade

The system SHALL provide a CLI command to initiate subscription from the command
line.

#### Scenario: User runs upgrade command

- **WHEN** a user runs `redshift subscription upgrade`
- **THEN** the CLI opens the default browser to `/admin/subscribe`
- **AND** displays a message: "Opening subscription page in browser..."

### Requirement: Managed Relay Auto-Configuration

The system SHALL automatically configure the managed relay for Cloud
subscribers.

#### Scenario: New subscriber relay configuration

- **WHEN** a user completes Cloud subscription payment
- **THEN** the system automatically adds `wss://relay.redshiftapp.com` (Nosflare
  managed relay) to their relay list
- **AND** sets it as the primary relay for secret storage
- **AND** the Nosflare relay validates their CloudAccessToken for write access

#### Scenario: Subscription lapse relay fallback

- **WHEN** a subscriber's access token expires
- **THEN** the system falls back to user-configured free relays
- **AND** displays a notification about limited relay access

## Implementation Notes

### Relay Infrastructure

The managed relay uses **Nosflare** deployed on Cloudflare Workers:

- **URL**: `wss://relay.redshiftapp.com`
- **Storage**: Cloudflare R2 for event persistence
- **Auth**: CloudAccessToken validation via NIP-42
- **Fallback**: Users can always use community relays (nos.lol, relay.damus.io)

### Sovereignty Preservation

- Secrets are encrypted client-side before transmission (NIP-59 Gift Wrap)
- Users can export secrets and migrate to self-hosted relays at any time
- Subscription expiration does not delete data; it only restricts new writes
