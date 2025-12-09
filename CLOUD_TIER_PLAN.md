# Redshift Cloud Tier Implementation Plan

## Overview

The Cloud tier ($5/month) provides managed high-availability relays with
automatic backups for individual developers who want reliability without
self-hosting.

**Target Launch**: Q2 2025

---

## Value Proposition

| What Users Get          | What We Provide                                    |
| ----------------------- | -------------------------------------------------- |
| Reliability             | Managed Nosflare relay on Cloudflare Workers       |
| Data safety             | Automatic encrypted backups to Cloudflare R2       |
| Visibility              | 7-day audit logs (NIP-78 Kind 30078)               |
| Uptime guarantee        | 99.5% SLA                                          |
| Bitcoin-native payments | BTCPay Server + Voltage Cloud LND (Lightning, BTC) |

**Security Model**: We only store NIP-59 Gift Wrapped events (encrypted blobs).
We cannot access secret names, values, or metadata.

## Infrastructure Decisions (Dec 2025)

| Component       | Choice                | Rationale                                      |
| --------------- | --------------------- | ---------------------------------------------- |
| **Relay**       | Nosflare (CF Workers) | Serverless, active development, NIP-78 support |
| **Lightning**   | Voltage Cloud LND     | No self-hosting, BTCPay integration            |
| **Storage**     | Cloudflare R2         | No egress fees, native CF integration          |
| **Event Kinds** | NIP-78 Kind 30078     | Ecosystem-compatible, no custom kinds          |

**Fallback**: Self-hosted strfry relay documented for sovereignty purists.

---

## Implementation Phases

### Phase 1: Infrastructure Setup

**Priority**: HIGH | **Effort**: 2-3 weeks

#### 1.1 BTCPay Server + Voltage Cloud LND

- [ ] Deploy BTCPay Server instance (self-hosted or BTCPay Cloud)
- [ ] Set up Voltage Cloud LND node (~$10-27/month)
- [ ] Connect BTCPay to Voltage via connection string + macaroon
- [ ] Set up store with USD pricing, BTC/Lightning payment methods
- [ ] Configure webhooks for payment events (Cloudflare Workers endpoint)
- [ ] Create API keys for backend integration

**Technical Details**:

```typescript
// packages/payments/src/btcpay.ts
interface BTCPayConfig {
  serverUrl: string; // https://btcpay.redshiftapp.com
  storeId: string;
  apiKey: string; // Greenfield API key
  webhookSecret: string; // HMAC validation
}

// Voltage Cloud connection (configured in BTCPay UI)
// - Connection string from Voltage dashboard
// - Admin macaroon for invoice creation
// - TLS certificates managed by Voltage
```

#### 1.2 Managed Nosflare Relay

- [ ] Fork and customize Nosflare for Redshift
- [ ] Deploy to Cloudflare Workers (wss://relay.redshiftapp.com)
- [ ] Configure R2 bucket for event persistence
- [ ] Implement CloudAccessToken validation (NIP-42 AUTH)
- [ ] Configure relay to filter by `["t", "redshift-secrets"]` tag

**Architecture** (Serverless):

```
┌─────────────────────────────────────────────────────┐
│              Cloudflare Edge Network                │
│              (Global, auto-scaling)                 │
└─────────────────────────┬───────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │   Nosflare Worker     │
              │   (WebSocket relay)   │
              │   - NIP-42 AUTH       │
              │   - Token validation  │
              └───────────┬───────────┘
                          │
    ┌─────────────────────┼─────────────────────┐
    │                     │                     │
┌───▼───────┐    ┌────────▼────────┐    ┌──────▼──────┐
│ Durable   │    │  Cloudflare R2  │    │   KV Store  │
│ Objects   │    │  (Event blobs)  │    │  (Indexes)  │
│ (State)   │    │  (No egress $)  │    │             │
└───────────┘    └─────────────────┘    └─────────────┘
```

**Fallback**: Self-hosted strfry relay documented in
`/docs/self-hosted-relay.md`

#### 1.3 Backup System (Cloudflare R2)

- [ ] Configure R2 bucket with encryption at rest
- [ ] Set up scheduled Worker for nightly backup snapshots
- [ ] Implement multi-region R2 replication for DR
- [ ] Create backup verification/restore scripts
- [ ] Set up monitoring and alerts for backup failures

---

### Phase 2: Access Token System

**Priority**: HIGH | **Effort**: 1-2 weeks

#### 2.1 Token Design

```typescript
// packages/cloud/src/types.ts
interface CloudAccessToken {
  pubkey: string; // User's Nostr pubkey
  tier: "cloud";
  issuedAt: number; // Unix timestamp
  expiresAt: number; // issuedAt + 30 days
  invoiceId: string; // BTCPay invoice reference
  signature: string; // Signed by relay operator key
}
```

#### 2.2 Token Issuance Flow

- [ ] Create webhook handler for BTCPay `InvoiceSettled` events (CF Worker)
- [ ] Implement token generation with relay operator signature
- [ ] Store token as NIP-59 wrapped event (Kind 30078 with
      `["t", "access-token"]`)
- [ ] Return token to user via API response

#### 2.3 Token Validation

- [ ] Implement relay middleware to check access tokens
- [ ] Verify signature against relay operator pubkey
- [ ] Check expiration timestamp
- [ ] Rate limit validation checks to prevent abuse

---

### Phase 3: Web Integration

**Priority**: HIGH | **Effort**: 2-3 weeks

#### 3.1 Subscription Page

**Location**: `/web/src/routes/admin/subscribe/+page.svelte`

- [ ] Create subscription landing page
- [ ] Show current subscription status (if any)
- [ ] Display pricing and features
- [ ] Integrate BTCPay checkout flow

**UI Components Needed**:

- `SubscriptionStatus.svelte` - Shows current plan, expiry, etc.
- `PaymentModal.svelte` - BTCPay invoice display
- `UpgradePrompt.svelte` - Upsell banner for free users

#### 3.2 Payment Flow

```
┌────────────────────────────────────────────────────────────┐
│                    Subscription Flow                        │
│                                                             │
│  1. User clicks "Subscribe" on /admin/subscribe             │
│  2. Frontend calls POST /api/subscribe with pubkey          │
│  3. Backend creates BTCPay invoice ($5 USD)                 │
│  4. BTCPay returns invoice ID + Lightning/on-chain addresses│
│  5. Frontend shows PaymentModal with QR code                │
│  6. User pays via wallet (Phoenix, Zeus, Alby, etc.)        │
│  7. BTCPay webhook fires InvoiceSettled                     │
│  8. Backend generates CloudAccessToken                       │
│  9. Token published as NIP-59 event to managed relay        │
│  10. Frontend polls for token, shows success                │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

#### 3.3 Relay Selection

- [ ] Add relay configuration in web admin settings
- [ ] Show "Redshift Cloud" as a relay option for subscribers
- [ ] Auto-configure managed relay for Cloud subscribers
- [ ] Allow fallback to free relays if subscription lapses

---

### Phase 4: CLI Integration

**Priority**: MEDIUM | **Effort**: 1-2 weeks

#### 4.1 Subscription Commands

```bash
# Check subscription status
redshift subscription status
# Output:
#   Plan: Cloud
#   Status: Active
#   Expires: 2025-03-15
#   Relay: wss://relay.redshiftapp.com

# Subscribe (opens browser to payment page)
redshift subscription upgrade
# Output: Opening https://redshiftapp.com/admin/subscribe...

# Use managed relay
redshift config set relay wss://relay.redshiftapp.com
```

#### 4.2 Token Management

- [ ] Implement token fetch from managed relay
- [ ] Store token in local config for offline validation
- [ ] Auto-refresh token on CLI startup
- [ ] Show subscription status in `redshift --version`

---

### Phase 5: Audit Logging

**Priority**: MEDIUM | **Effort**: 1 week

#### 5.1 Event Types

```typescript
// packages/cloud/src/audit.ts
type CloudAuditAction =
  | "secret:create"
  | "secret:update"
  | "secret:delete"
  | "secret:read"
  | "project:create"
  | "project:delete"
  | "subscription:start"
  | "subscription:renew"
  | "subscription:cancel";

// Uses NIP-78 Kind 30078 (Arbitrary Custom App Data)
interface CloudAuditEvent {
  kind: 30078; // NIP-78 for ecosystem compatibility
  pubkey: string; // User's pubkey
  created_at: number;
  tags: [
    ["d", string], // pubkey (one log stream per user)
    ["t", "redshift-audit"], // Type tag for filtering
    ["action", CloudAuditAction],
    ["target", string], // What was affected (project ID, etc.)
  ];
  content: string; // Encrypted details (NIP-44)
}
```

#### 5.2 Implementation

- [ ] Create audit event generation in web app
- [ ] Create audit event generation in CLI
- [ ] Implement 7-day retention policy on managed relay
- [ ] Build audit log viewer in web admin

**UI Location**: `/admin/settings/audit-logs`

---

### Phase 6: Monitoring & SLA

**Priority**: MEDIUM | **Effort**: 1 week

#### 6.1 Uptime Monitoring

- [ ] Set up external uptime monitoring (e.g., BetterStack)
- [ ] Configure alerts for relay downtime
- [ ] Create public status page at status.redshiftapp.com
- [ ] Implement 99.5% SLA tracking

#### 6.2 Metrics Dashboard

- [ ] Track active subscriptions
- [ ] Monitor relay latency and throughput
- [ ] Track backup success/failure rates
- [ ] Set up payment success rate monitoring

---

## API Endpoints

### Backend API (new service or serverless functions)

```
POST /api/subscribe
  Body: { pubkey: string }
  Returns: { invoiceId: string, paymentUrl: string, lightningInvoice: string }

GET /api/subscription/:pubkey
  Returns: { status: 'active' | 'expired' | 'none', expiresAt?: number }

POST /api/webhooks/btcpay
  Body: BTCPay webhook payload
  Returns: 200 OK (issues access token)

GET /api/audit-logs/:pubkey
  Query: { from?: number, to?: number, limit?: number }
  Returns: { events: CloudAuditEvent[] }
```

---

## File Structure (New)

```
packages/
├── cloud/                    # @redshift/cloud - Cloud tier logic
│   ├── src/
│   │   ├── access-token.ts   # Token generation/validation
│   │   ├── audit.ts          # Audit event creation
│   │   ├── btcpay.ts         # BTCPay API client
│   │   └── types.ts          # Cloud-specific types
│   └── tests/
│       ├── access-token.test.ts
│       └── btcpay.test.ts
│
├── payments/                 # @redshift/payments - Payment abstractions
│   ├── src/
│   │   ├── btcpay-client.ts  # BTCPay Greenfield API
│   │   ├── cashu.ts          # Cashu token redemption (future)
│   │   └── types.ts
│   └── tests/

web/src/
├── routes/
│   └── admin/
│       └── subscribe/
│           └── +page.svelte  # Subscription management page
│
├── lib/
│   ├── components/
│   │   ├── PaymentModal.svelte
│   │   ├── SubscriptionStatus.svelte
│   │   └── UpgradePrompt.svelte
│   │
│   └── stores/
│       └── subscription.svelte.ts  # Subscription state

cli/src/
├── commands/
│   └── subscription.ts       # subscription status/upgrade commands
```

---

## Database/Storage

**No traditional database required** - all state stored on Nostr using NIP-78:

| Data                | Storage Location                   | Event Kind | Type Tag           |
| ------------------- | ---------------------------------- | ---------- | ------------------ |
| Secrets             | User's configured relays + managed | 30078      | `redshift-secrets` |
| Access tokens       | Managed relay (NIP-59 wrapped)     | 30078      | `access-token`     |
| Audit logs          | Managed relay (encrypted)          | 30078      | `redshift-audit`   |
| Subscription status | Derived from valid access token    | -          | -                  |

**BTCPay Server** handles payment state (invoices, subscriptions).

**Why Kind 30078**: NIP-78 "Arbitrary Custom App Data" is ecosystem-compatible
and supported by all relays. Using `["t", "..."]` type tags allows filtering
without custom event kinds.

---

## Environment Variables

### Backend Service

```bash
# BTCPay Server
BTCPAY_SERVER_URL=https://btcpay.redshiftapp.com
BTCPAY_STORE_ID=xxx
BTCPAY_API_KEY=xxx
BTCPAY_WEBHOOK_SECRET=xxx

# Relay Operator
RELAY_OPERATOR_NSEC=nsec1...  # For signing access tokens
RELAY_OPERATOR_NPUB=npub1...

# Managed Relay
MANAGED_RELAY_URL=wss://relay.redshiftapp.com

# Backup (Cloudflare R2)
R2_BUCKET_NAME=redshift-backups
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
```

### Web App

```bash
# Public config
PUBLIC_MANAGED_RELAY_URL=wss://relay.redshiftapp.com
PUBLIC_SUBSCRIPTION_API_URL=https://api.redshiftapp.com
```

---

## Testing Strategy

### Unit Tests

- [ ] Access token generation and validation
- [ ] BTCPay webhook signature verification
- [ ] Audit event creation and encryption
- [ ] Token expiration logic

### Integration Tests

- [ ] Full payment flow with BTCPay testnet
- [ ] Token issuance and relay authentication
- [ ] Backup and restore process
- [ ] Subscription renewal flow

### E2E Tests

- [ ] User subscribes via web UI
- [ ] Paid user can use managed relay
- [ ] Free user is rejected by managed relay
- [ ] Subscription expiry blocks access

---

## Security Checklist

- [ ] BTCPay webhook HMAC validation
- [ ] Access token signature verification
- [ ] Rate limiting on subscription API
- [ ] CORS configuration for payment endpoints
- [ ] Relay operator key stored in secure vault
- [ ] Backup encryption key management
- [ ] Audit log encryption (NIP-44)

---

## Success Metrics

| Metric                     | Target      |
| -------------------------- | ----------- |
| Relay uptime               | 99.5%       |
| Payment success rate       | > 95%       |
| Backup success rate        | 100%        |
| Time to first subscription | < 5 minutes |
| MRR (Month 3)              | $500        |
| MRR (Month 6)              | $2,000      |

---

## Dependencies & Prerequisites

### External Services

1. **BTCPay Server** - Self-hosted or BTCPay Cloud
2. **Voltage Cloud** - Hosted LND node (~$10-27/month)
3. **Cloudflare** - Workers (Nosflare relay), R2 (storage), KV (indexes)
4. **BetterStack/Uptime Robot** - Monitoring

### Internal Prerequisites

1. Stable NIP-59 Gift Wrap implementation (`@redshift/crypto`)
2. Relay connection handling (`nostr-tools/pool`)
3. Web admin authentication (NIP-07)
4. CLI configuration system

---

## Risks & Mitigations

| Risk                       | Mitigation                                    |
| -------------------------- | --------------------------------------------- |
| Lightning payment failures | Fallback to on-chain BTC                      |
| Relay downtime             | 3-node cluster with automatic failover        |
| Backup corruption          | Verification checks, geographic replication   |
| Token key compromise       | Key rotation procedure, short token lifetimes |
| Low initial adoption       | Free tier as funnel, focus on reliability     |

---

## Timeline

| Week | Milestone                                 |
| ---- | ----------------------------------------- |
| 1-2  | BTCPay Server + Lightning node deployment |
| 3-4  | Managed relay cluster setup               |
| 5    | Access token system implementation        |
| 6-7  | Web subscription page + payment flow      |
| 8    | CLI integration                           |
| 9    | Audit logging                             |
| 10   | Monitoring, SLA tracking, status page     |
| 11   | Testing, bug fixes, documentation         |
| 12   | Beta launch to select users               |

**Total**: ~12 weeks to production-ready Cloud tier

---

## Resolved Decisions

| Question                 | Decision           | Rationale                                      |
| ------------------------ | ------------------ | ---------------------------------------------- |
| Relay software           | **Nosflare**       | Serverless, active dev (Dec 2025), NIP-78      |
| Hosting provider         | **Cloudflare**     | Workers + R2 + KV, global edge, no egress fees |
| Lightning implementation | **Voltage Cloud**  | Managed LND, BTCPay integration, no self-host  |
| Cashu support            | **Phase 2**        | Defer to focus on core; track for future       |
| Event kinds              | **NIP-78 (30078)** | Ecosystem-compatible, no custom kinds needed   |

## Open Questions

1. **Pricing localization**: USD-only or BTC-denominated option?
2. **Sovereignty fallback docs**: How detailed should self-hosted guide be?

---

## Next Steps

1. [ ] Review and approve this plan
2. [ ] Set up BTCPay Server testnet instance
3. [ ] Deploy single relay node for development
4. [ ] Implement access token package (`@redshift/cloud`)
5. [ ] Create subscription page wireframes
6. [ ] Write detailed technical specs for each component

---

## Telos Validation

### L9 (Telos-Guardian): Purpose Alignment

> "Does this serve user sovereignty?"

**Yes** - Users control encryption keys; we only store encrypted blobs. No
backdoors, no access to plaintext secrets.

### L8 (Market-Analyst): Business Value

> "Does this create sustainable value?"

**Yes** - $5/month covers relay infrastructure costs. Provides clear upgrade
path from free tier.

### L4 (Integration-Contractor): Protocol Compatibility

> "Do contracts remain stable?"

**Yes** - Uses existing NIP-59 for secrets. Uses NIP-78 Kind 30078 with type
tags for all data (secrets, tokens, audit logs) - no custom event kinds needed.

### L1 (Syntax-Linter): Technical Feasibility

> "Is this implementable?"

**Yes** - BTCPay has REST API, relay software is mature, all components are
standard TypeScript/Bun.

**Decision**: Plan approved. Proceed with Phase 1.
