# Tasks: Cloud Tier Implementation

## Phase 1: Infrastructure Setup (2-3 weeks)

### 1.1 BTCPay Server + Voltage Cloud Setup

- [ ] 1.1.1 Create Voltage Cloud account and deploy Neutrino Lightning node
- [ ] 1.1.2 Deploy BTCPay Server (Docker on Hetzner VPS)
- [ ] 1.1.3 Connect BTCPay Server to Voltage Cloud LND node
- [ ] 1.1.4 Create store with USD pricing ($5/month)
- [ ] 1.1.5 Enable BTC + Lightning payment methods
- [ ] 1.1.6 Configure webhook endpoint for payment events
- [ ] 1.1.7 Generate API keys for backend integration
- [ ] 1.1.8 Test payment flow on testnet/regtest

### 1.2 Nosflare Relay Deployment

- [ ] 1.2.1 Fork Nosflare repository
- [ ] 1.2.2 Configure `src/config.ts` for Redshift relay
- [ ] 1.2.3 Set up Cloudflare Workers account (Paid plan)
- [ ] 1.2.4 Create Cloudflare R2 bucket for event archival
- [ ] 1.2.5 Create required Cloudflare Queues (broadcast, indexing)
- [ ] 1.2.6 Configure relay to filter by `["t", "redshift-secrets"]` tag
- [ ] 1.2.7 Deploy Nosflare to Cloudflare Workers
- [ ] 1.2.8 Configure custom domain (wss://relay.redshiftapp.com)
- [ ] 1.2.9 Test relay connection and NIP-78 event storage

### 1.3 R2 Backup Configuration

- [ ] 1.3.1 Configure Nosflare R2 archive queue
- [ ] 1.3.2 Set up lifecycle rules for backup retention
- [ ] 1.3.3 Configure geographic replication (optional)
- [ ] 1.3.4 Create backup verification script
- [ ] 1.3.5 Set up monitoring alerts for backup failures

## Phase 2: Shared Packages (1-2 weeks)

### 2.1 @redshift/payments Package

- [ ] 2.1.1 Create `packages/payments/` directory structure
- [ ] 2.1.2 Implement BTCPay Greenfield API client
- [ ] 2.1.3 Add `createInvoice()` function
- [ ] 2.1.4 Add `verifyWebhook()` HMAC validation
- [ ] 2.1.5 Add `getInvoiceStatus()` function
- [ ] 2.1.6 Write unit tests for BTCPay client
- [ ] 2.1.7 Add package to workspace

### 2.2 @redshift/cloud Package

- [ ] 2.2.1 Create `packages/cloud/` directory structure
- [ ] 2.2.2 Define `CloudAccessToken` type (Kind 30078 schema)
- [ ] 2.2.3 Implement `generateAccessToken()` with NIP-78 format
- [ ] 2.2.4 Implement `validateAccessToken()` signature verification
- [ ] 2.2.5 Implement `isTokenExpired()` check
- [ ] 2.2.6 Define `CloudAuditEvent` type (Kind 30078 schema)
- [ ] 2.2.7 Implement `createAuditEvent()` with NIP-44 encryption
- [ ] 2.2.8 Write unit tests for access token functions
- [ ] 2.2.9 Write unit tests for audit functions
- [ ] 2.2.10 Add package to workspace

## Phase 3: Backend API (1 week)

### 3.1 API Endpoints

- [ ] 3.1.1 Create backend service structure (Cloudflare Workers or Bun server)
- [ ] 3.1.2 Implement `POST /api/subscribe` - creates BTCPay invoice
- [ ] 3.1.3 Implement `GET /api/subscription/:pubkey` - returns status
- [ ] 3.1.4 Implement `POST /api/webhooks/btcpay` - handles payment events
- [ ] 3.1.5 Implement `GET /api/audit-logs/:pubkey` - returns audit events
- [ ] 3.1.6 Add rate limiting to all endpoints
- [ ] 3.1.7 Configure CORS for web app

### 3.2 Webhook Handler

- [ ] 3.2.1 Validate BTCPay webhook HMAC signature
- [ ] 3.2.2 Handle `InvoiceSettled` event - generate token (Kind 30078)
- [ ] 3.2.3 Handle `InvoiceExpired` event - cleanup
- [ ] 3.2.4 Publish access token to Nosflare relay (NIP-59 wrapped)
- [ ] 3.2.5 Write integration tests with BTCPay testnet

## Phase 4: Web Integration (2-3 weeks)

### 4.1 Subscription Store

- [ ] 4.1.1 Create `web/src/lib/stores/subscription.svelte.ts`
- [ ] 4.1.2 Implement subscription status fetching
- [ ] 4.1.3 Implement token refresh logic
- [ ] 4.1.4 Add subscription expiry notifications
- [ ] 4.1.5 Write store tests

### 4.2 UI Components

- [ ] 4.2.1 Create `SubscriptionStatus.svelte` - shows plan, expiry, relay
- [ ] 4.2.2 Create `PaymentModal.svelte` - BTCPay checkout with QR
- [ ] 4.2.3 Create `UpgradePrompt.svelte` - upsell banner for free users
- [ ] 4.2.4 Add loading states and error handling
- [ ] 4.2.5 Write component tests

### 4.3 Subscription Page

- [ ] 4.3.1 Create `/admin/subscribe/+page.svelte` route
- [ ] 4.3.2 Show current subscription status (if any)
- [ ] 4.3.3 Display pricing and feature comparison
- [ ] 4.3.4 Integrate BTCPay checkout flow
- [ ] 4.3.5 Handle payment success/failure states
- [ ] 4.3.6 Add subscription to admin navigation
- [ ] 4.3.7 Write E2E tests for subscription flow

### 4.4 Relay Configuration

- [ ] 4.4.1 Add relay settings in admin settings page
- [ ] 4.4.2 Show "Redshift Cloud" as relay option for subscribers
- [ ] 4.4.3 Auto-configure Nosflare relay for Cloud subscribers
- [ ] 4.4.4 Allow fallback to free relays if subscription lapses

## Phase 5: CLI Integration (1-2 weeks)

### 5.1 Subscription Commands

- [ ] 5.1.1 Create `cli/src/commands/subscription.ts`
- [ ] 5.1.2 Implement `redshift subscription status` command
- [ ] 5.1.3 Implement `redshift subscription upgrade` command (opens browser)
- [ ] 5.1.4 Add subscription status to `redshift --version` output
- [ ] 5.1.5 Write command tests

### 5.2 Token Management

- [ ] 5.2.1 Implement token fetch from Nosflare relay (Kind 30078 query)
- [ ] 5.2.2 Store token in local config for offline validation
- [ ] 5.2.3 Auto-refresh token on CLI startup
- [ ] 5.2.4 Handle expired token gracefully (prompt upgrade)

### 5.3 Relay Configuration

- [ ] 5.3.1 Implement `redshift config set relay <url>` command
- [ ] 5.3.2 Auto-detect and use Nosflare relay for subscribers
- [ ] 5.3.3 Add relay URL to `redshift config show` output

## Phase 6: Audit Logging (1 week)

### 6.1 Event Generation

- [ ] 6.1.1 Add audit event creation to web app secret operations
- [ ] 6.1.2 Add audit event creation to CLI secret operations
- [ ] 6.1.3 Define audit action types (create, update, delete, read)
- [ ] 6.1.4 Encrypt audit content with NIP-44

### 6.2 Audit Log Viewer

- [ ] 6.2.1 Create `/admin/settings/audit-logs` route
- [ ] 6.2.2 Fetch and decrypt audit events for current user
- [ ] 6.2.3 Display audit log with filtering by action/date
- [ ] 6.2.4 Implement 7-day retention display note

### 6.3 Retention Policy

- [ ] 6.3.1 Configure Nosflare to use NIP-40 expiration for audit events
- [ ] 6.3.2 Document retention policy for users

## Phase 7: Monitoring & SLA (1 week)

### 7.1 Uptime Monitoring

- [ ] 7.1.1 Set up external uptime monitoring (BetterStack/UptimeRobot)
- [ ] 7.1.2 Configure alerts for relay downtime
- [ ] 7.1.3 Create public status page at status.redshiftapp.com
- [ ] 7.1.4 Implement 99.5% SLA tracking dashboard

### 7.2 Metrics

- [ ] 7.2.1 Track active subscriptions count
- [ ] 7.2.2 Monitor Nosflare relay latency and throughput
- [ ] 7.2.3 Track R2 backup success/failure rates
- [ ] 7.2.4 Track payment success rate (via BTCPay)

## Phase 8: Documentation & Launch (1 week)

### 8.1 Documentation

- [ ] 8.1.1 Add Cloud tier to `/docs/pricing` page
- [ ] 8.1.2 Document subscription CLI commands
- [ ] 8.1.3 Document self-hosted relay option (strfry fallback)
- [ ] 8.1.4 Update README with Cloud tier information

### 8.2 Launch Preparation

- [ ] 8.2.1 Security review of payment flow
- [ ] 8.2.2 Load testing on Nosflare relay
- [ ] 8.2.3 Beta user testing (invite-only)
- [ ] 8.2.4 Prepare launch announcement

## Dependencies

- **Phase 2** depends on **Phase 1** (infrastructure must exist)
- **Phase 3** depends on **Phase 2** (needs packages)
- **Phase 4** depends on **Phase 3** (needs API)
- **Phase 5** depends on **Phase 2** and **Phase 3**
- **Phase 6** depends on **Phase 4** (audit UI needs subscription context)
- **Phase 7** depends on **Phase 1** (monitoring needs infrastructure)
- **Phase 8** depends on all other phases

## Parallelizable Work

These can proceed independently:

- **1.1** (BTCPay + Voltage) and **1.2** (Nosflare) can run in parallel
- **4.1-4.3** (Web) and **5.1-5.3** (CLI) can run in parallel after Phase 3
- **6.1** (Event generation) and **7.1** (Monitoring) can run in parallel

## Future Work (Phase 2 - Tracked)

- [ ] Cashu token support for anonymous payments
- [ ] strfry self-hosted option documentation
- [ ] Multi-region R2 geographic redundancy
