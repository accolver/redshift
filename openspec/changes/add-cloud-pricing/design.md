# Design: Cloud Tier Architecture

## Status

**Unapproved design hypothesis.** Every provider, price, retention duration, availability target, backup behavior, schedule, and architecture below is a candidate for review—not an implementation decision or launch commitment. No task may begin until this change and the separate managed-production evidence gates are explicitly approved.

## Context

Redshift needs a sustainable revenue model that doesn't compromise user
sovereignty. The Cloud tier monetizes infrastructure convenience (managed
relays, backups) rather than feature access.

**Stakeholders**:

- Individual developers (primary customers)
- Redshift maintainers (infrastructure operators)
- BTCPay Server + Voltage (payment infrastructure)

**Constraints**:

- No traditional database - all state on Nostr
- Bitcoin-only payments (Lightning primary, on-chain fallback)
- Client-side encryption only - we never see plaintext secrets
- Must work with existing NIP-59 Gift Wrap flow
- Use Cloudflare R2 for backup storage (not S3)
- No self-hosted Lightning node (use Voltage Cloud)

## Goals / Non-Goals

### Goals

- Evaluate the unapproved $5/month subscription hypothesis with a reviewed payment design
- Define a candidate managed-relay offer without selecting or promising an SLA
- Evaluate an access-token design for relay authentication
- Derive any audit-record retention duration from approved privacy, operational, and recovery evidence
- Specify web and CLI subscription flows only after commercial and managed-production approval

### Non-Goals

- Cashu token support (Phase 2 - tracked for future)
- Teams/RBAC features (separate tier)
- Self-hosted Lightning node (use Voltage Cloud)
- Fiat payment methods (Bitcoin-only)

## Decisions

### Decision 1: Lightning via Voltage Cloud (No Self-Hosted Node)

**Choice**: Use Voltage Cloud's hosted LND node connected to BTCPay Server.

**Rationale**:

- No Lightning node maintenance burden
- Professional-grade uptime and liquidity management
- BTCPay Server has official Voltage Cloud integration
- Cost: ~$10-27/month for Lightning node vs self-hosted complexity
- Focus engineering effort on Redshift, not Lightning infrastructure

**Voltage Cloud Pricing**:

- Neutrino Lightning Node: $9.99/month (lightweight, sufficient for payments)
- Standard Lightning Node: $26.99/month (full node, more features)

**Integration**: BTCPay Server connects to Voltage LND via standard LND API.
Voltage handles channel management, liquidity, and uptime.

**Alternatives Considered**:

- Self-hosted CLN/LND: High maintenance, requires 24/7 monitoring
- Alby Cloud: Good for wallets, less BTCPay integration
- Phoenixd: Still requires self-hosting

### Decision 2: Nosflare for Serverless Relay (Cloudflare-Native)

**Choice**: Deploy relay using Nosflare on Cloudflare Workers + Durable
Objects + R2.

**Rationale**:

- **Cloudflare-native**: Runs entirely on Cloudflare infrastructure
- **Serverless**: No servers to manage, automatic scaling
- **Active development**: Latest commit Dec 6, 2025 (v8.9.25)
- **Feature-rich**: Supports NIP-78 (arbitrary app data), NIP-42 AUTH,
  pay-to-relay
- **R2 integration**: Native R2 support for event archival/backup
- **Global edge**: Deployed to 300+ Cloudflare locations
- **Cost-effective**: Cloudflare Workers Paid plan ($5/month base)

**Nosflare supports**:

- NIP-01, NIP-02, NIP-04, NIP-05, NIP-09, NIP-11, NIP-12, NIP-15, NIP-16
- NIP-17, NIP-20, NIP-22, NIP-23, NIP-33, NIP-40, NIP-42, NIP-50, NIP-51
- NIP-58, NIP-65, NIP-71, **NIP-78** (our Kind 30078 secrets), NIP-89, NIP-94

**Architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│                  Nosflare on Cloudflare                          │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Cloudflare Workers (Edge)                     │  │
│  │  - WebSocket handling                                      │  │
│  │  - Event validation                                        │  │
│  │  - Subscription matching                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┼───────────────────────────────┐  │
│  │              Durable Objects (State)                       │  │
│  │  - ConnectionDO: WebSocket sessions                        │  │
│  │  - EventShardDO: Event storage (24hr shards)              │  │
│  │  - SessionManagerDO: Subscription tracking                 │  │
│  │  - PaymentDO: Access token validation                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │              Cloudflare R2 (Archive)                       │  │
│  │  - Event archival                                          │  │
│  │  - Encrypted backups                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Alternatives Considered**:

- **strfry**: Excellent performance, LMDB storage, but last commit Jan 2025 (11
  months ago). Requires VPS hosting. Still a viable fallback option.
- **nostr-rs-relay**: Rust, SQLite, but less active development
- **nostream**: Node.js/PostgreSQL, heavier infrastructure
- **Self-hosted strfry on mynymbox.net**: Good sovereignty option but adds VPS
  management

### Decision 3: Access Tokens as NIP-78 Events (Kind 30078)

**Choice**: Store access tokens as NIP-59 wrapped Kind 30078 events (not custom
30081).

**Rationale**:

- **NIP-78** is the official "Arbitrary custom app data" kind
- Already supported by all major relays including Nosflare
- Addressable events (parameterized replaceable) - one per d-tag
- No need to propose new NIPs - use existing infrastructure
- Compatible with any Nostr client that supports NIP-78

**NIP-78 Spec** (from official NIPs repo):

> "The goal of this NIP is to enable remoteStorage-like capabilities for custom
> applications that do not care about interoperability... specifies the use of
> event kind `30078` (an _addressable_ event) with a `d` tag containing some
> reference to the app name and context"

**d-tag Naming Convention**: NIP-78 recommends using reverse-DNS notation for
global uniqueness (e.g., `com.example.myapp.user-settings`). We use the
`com.redshiftapp` prefix for all d-tags.

**Token Schema**:

```typescript
// NIP-59 Gift Wrap containing:
{
  kind: 30078,  // NIP-78 arbitrary app data
  pubkey: userPubkey,
  created_at: timestamp,
  tags: [
    ["d", "com.redshiftapp.access-token"],  // Reverse-DNS for global uniqueness
    ["t", "redshift-cloud"],                 // Type tag for filtering
    ["tier", "cloud"],
    ["expires", expiryTimestamp],
    ["invoice", btcpayInvoiceId],
  ],
  content: JSON.stringify({
    issuedAt: timestamp,
    relayUrl: "wss://relay.redshiftapp.com",
    signature: relayOperatorSignature,  // Verify token authenticity
  }),
}
```

### Decision 4: Audit Logs as NIP-78 Events (Kind 30078)

**Choice**: Store audit logs as NIP-59 wrapped Kind 30078 events with NIP-44
encrypted content.

**Rationale**:

- Same reasoning as access tokens - use existing NIP-78 infrastructure
- User owns their audit data
- Encrypted content means we can't read it
- Any retention duration remains unapproved and must be enforced by tested relay cleanup only after privacy and operational review

**Audit Event Schema**:

```typescript
// NIP-59 Gift Wrap containing:
{
  kind: 30078,  // NIP-78 arbitrary app data
  pubkey: userPubkey,
  created_at: timestamp,
  tags: [
    ["d", `com.redshiftapp.audit.${timestamp}`],  // Reverse-DNS + unique timestamp
    ["t", "redshift-audit"],                      // Type tag for filtering
    ["action", "secret:create"],
    ["target", projectId],
    ["expiration", approvedExpirationTimestamp],  // Duration is an evidence-gated open decision
  ],
  content: encryptedDetails,  // NIP-44 encrypted to user's key
}
```

### Decision 5: Cloudflare R2 for Backup Storage

**Choice**: Use Cloudflare R2 for encrypted backup storage.

**Rationale**:

- Native integration with Nosflare/Cloudflare Workers
- S3-compatible API (easy migration if needed)
- No egress fees (major cost savings)
- Same infrastructure as relay (operational simplicity)
- Geographic replication available

**Cost**: R2 free tier: 10GB storage, 1M class A ops, 10M class B ops/month.
Paid: $0.015/GB/month storage.

### Decision 6: BTCPay Server for Payment Processing

**Choice**: Self-hosted BTCPay Server connected to Voltage Cloud Lightning node.

**Rationale**:

- Industry standard for Bitcoin payments
- Greenfield API for programmatic access
- Webhook system for payment notifications
- No third-party custody of funds
- Supports both Lightning (via Voltage) and on-chain BTC

**Architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Payment Infrastructure                        │
│                                                                  │
│  ┌───────────────┐     ┌───────────────┐     ┌───────────────┐  │
│  │   BTCPay      │────▶│   Voltage     │────▶│   Lightning   │  │
│  │   Server      │     │   Cloud LND   │     │   Network     │  │
│  │ (self-hosted) │     │ (hosted node) │     │               │  │
│  └───────────────┘     └───────────────┘     └───────────────┘  │
│         │                                                        │
│         │ Greenfield API                                         │
│         ▼                                                        │
│  ┌───────────────┐                                               │
│  │   Redshift    │                                               │
│  │   Backend     │                                               │
│  │ (webhook recv)│                                               │
│  └───────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Telos Alignment Verification

### L9 (Telos-Guardian): User Sovereignty

> "Does this serve user sovereignty?"

**Yes - Verified**:

- All secrets remain client-side encrypted (NIP-59 Gift Wrap)
- We only store encrypted blobs - cannot read user data
- Free tier remains fully functional - no paywalling core features
- Users can export data and leave anytime
- No lock-in: standard Nostr events, any compatible relay works

### L8 (Market-Analyst): Business Value

> "Does this create sustainable value?"

**Yes - Verified**:

- $5/month is an unvalidated pricing hypothesis whose costs and demand require evidence
- Reliability without self-hosting is a proposed value, not a current guarantee
- The individual product remains complete without the proposed convenience layer
- Any payment design requires separate security, legal, and operational approval

### L7 (Insight-Synthesizer): Product Strategy

> "Does this fit free-tier-first strategy?"

**Yes - Verified**:

- Free users get full functionality with public relays
- A future approved tier may add a managed relay and evidence-bounded retention/recovery features; no SLA is selected
- No features may be removed from the individual product
- Redshift's documented command contract remains consistent across any approved tier

### L4 (Integration-Contractor): Protocol Compatibility

> "Do contracts remain stable?"

**Yes - Verified**:

- Uses existing NIP-78 (Kind 30078) for tokens and audit logs
- NIP-78 is `draft` `optional` but widely supported
- No new NIPs required - uses existing infrastructure
- Nosflare supports all NIPs we need (including NIP-78)
- Backwards compatible with existing secrets (Kind 30078)

### L1 (Syntax-Linter): Technical Feasibility

> "Is this implementable?"

**Yes - Verified**:

- Nosflare: Active development, MIT license, TypeScript
- BTCPay Server: Mature, well-documented Greenfield API
- Voltage Cloud: Official BTCPay integration documented
- Cloudflare R2: Standard S3 API, native Workers integration

**Convergence**: Both validation flows agree. Proceed with implementation.

## File Structure (Updated)

```
packages/
├── cloud/                    # @redshift/cloud
│   ├── src/
│   │   ├── access-token.ts   # Token generation/validation (Kind 30078)
│   │   ├── audit.ts          # Audit event creation (Kind 30078)
│   │   └── types.ts          # Cloud-specific types
│   └── tests/
│
├── payments/                 # @redshift/payments
│   ├── src/
│   │   ├── btcpay-client.ts  # BTCPay Greenfield API
│   │   └── types.ts          # Payment types
│   └── tests/

infrastructure/               # New: Infrastructure configs
├── nosflare/
│   ├── wrangler.toml         # Cloudflare Workers config
│   └── src/config.ts         # Nosflare relay configuration
├── btcpay/
│   └── docker-compose.yml    # BTCPay Server deployment
```

## Data Flow

### Subscription Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Subscription Flow                            │
│                                                                  │
│  ┌──────────┐    ┌───────────┐    ┌───────────┐    ┌──────────┐ │
│  │   User   │───▶│ Web Admin │───▶│  Backend  │───▶│ BTCPay   │ │
│  │          │    │ /subscribe│    │ /api/...  │    │ + Voltage│ │
│  └──────────┘    └───────────┘    └───────────┘    └──────────┘ │
│       │                                                  │       │
│       │         ┌─────────────────────────────────┐      │       │
│       │         │        Payment Complete         │      │       │
│       │         └─────────────────────────────────┘      │       │
│       │                        │                         │       │
│       │                        ▼                         │       │
│       │              ┌───────────────────┐               │       │
│       │              │  Webhook Handler  │◀──────────────┘       │
│       │              │  (InvoiceSettled) │                       │
│       │              └─────────┬─────────┘                       │
│       │                        │                                 │
│       │                        ▼                                 │
│       │              ┌───────────────────┐                       │
│       │              │ Generate Token    │                       │
│       │              │ (Kind 30078)      │                       │
│       │              └─────────┬─────────┘                       │
│       │                        │                                 │
│       │                        ▼                                 │
│       │              ┌───────────────────┐                       │
│       │              │ Publish to Relay  │                       │
│       │              │ (Nosflare on CF)  │                       │
│       │              └─────────┬─────────┘                       │
│       │                        │                                 │
│       ▼                        ▼                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           Client Fetches Token, Connects to Relay         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Event Schemas (Updated for NIP-78)

All d-tags use reverse-DNS notation (`com.redshiftapp.*`) for global uniqueness
as recommended by NIP-78.

### Access Token (Kind 30078, NIP-78)

```typescript
// Outer: NIP-59 Gift Wrap to user's pubkey
// Inner rumor:
{
  kind: 30078,  // NIP-78 Arbitrary custom app data
  pubkey: userPubkey,
  created_at: timestamp,
  tags: [
    ["d", "com.redshiftapp.access-token"],  // Reverse-DNS identifier
    ["t", "redshift-cloud"],                 // Type tag for filtering
    ["tier", "cloud"],
    ["expires", expiryTimestamp],
    ["invoice", btcpayInvoiceId],
  ],
  content: JSON.stringify({
    issuedAt: timestamp,
    relayUrl: "wss://relay.redshiftapp.com",
    signature: relayOperatorSignature,
  }),
}
```

### Audit Event (Kind 30078, NIP-78)

```typescript
// Outer: NIP-59 Gift Wrap to user's pubkey
// Inner rumor:
{
  kind: 30078,  // NIP-78 Arbitrary custom app data
  pubkey: userPubkey,
  created_at: timestamp,
  tags: [
    ["d", `com.redshiftapp.audit.${Date.now()}`],  // Reverse-DNS + unique timestamp
    ["t", "redshift-audit"],                        // Type tag for filtering
    ["action", "secret:create"],
    ["target", projectId],
    ["expiration", approvedExpirationTimestamp],    // Duration is an evidence-gated open decision
  ],
  content: encryptedDetails,  // NIP-44 encrypted JSON
}
```

## Risks / Trade-offs

### Risk: Lightning Payment Failures (via Voltage)

**Mitigation**: Voltage manages liquidity and channels professionally. On-chain
BTC always available as fallback via BTCPay.

### Risk: Nosflare Stability

**Mitigation**: Active development (last commit 3 days ago). If issues arise,
can migrate to strfry on VPS as fallback. Both use same Nostr protocol.

### Risk: Token Key Compromise

**Mitigation**: Short token lifetimes (30 days). Key rotation procedure
documented. Revocation via new token with earlier expiry.

### Risk: Cloudflare Dependency

**Mitigation**:

- All data is standard Nostr events - portable to any relay
- R2 is S3-compatible - can migrate backups
- Nosflare is open source - can self-host strfry if needed
- Free tier works with any Nostr relay

### Trade-off: Cloudflare vs Fully Sovereign Hosting

**Pro**: Global edge network, managed infrastructure, automatic scaling, low
cost.

**Con**: Dependency on Cloudflare. Some users may prefer fully self-hosted.

**Alignment with Telos**: Cloudflare dependency is for infrastructure
convenience only. User data sovereignty is preserved:

- All secrets client-side encrypted
- User can export and use any relay
- No lock-in to Redshift or Cloudflare

Alternative for sovereignty purists: Document how to use free tier with
self-hosted relay (mynymbox.net or own strfry).

### Trade-off: No Database (Nostr-Native)

**Pro**: Simpler architecture, user owns data, no database ops.

**Con**: Complex queries require event fetching. Retention requires relay
config.

## Infrastructure Costs (Estimated)

| Component         | Provider      | Cost/month  |
| ----------------- | ------------- | ----------- |
| Nosflare (Relay)  | Cloudflare    | $5-25       |
| R2 Storage        | Cloudflare    | ~$5         |
| BTCPay Server     | VPS (Hetzner) | ~$5         |
| Voltage Lightning | Voltage Cloud | $10-27      |
| Domain + SSL      | Cloudflare    | Free        |
| **Total**         |               | **~$25-62** |

The historical model estimated break-even at roughly 5-12 subscribers at the unapproved $5/month hypothesis; current provider costs, demand, taxes, support, and risk remain unvalidated.

## Migration Plan

This is a new feature, no migration required. Existing free users are
unaffected.

### Rollout Strategy

1. **Approval gate**: approve Cloud pricing plus managed-production, security, privacy/legal, and FinOps evidence plans.
2. **Credential-free planning**: review exact provider resources, source/plan digests, budgets, data classes, and rollback without mutation.
3. **Synthetic preproduction**: test billing and relay behavior with non-user data only after authorized mutation approval.
4. **Operational evidence**: complete monitoring, incident, rotation, rollback, retention, and restore drills and the approved measurement window.
5. **Explicit launch decision**: approve or reject bounded pricing/service claims; no public onboarding or announcement follows automatically.

### Rollback

If critical issues arise:

1. Disable subscription page (feature flag)
2. Continue honoring existing tokens until expiry
3. Free tier remains fully functional throughout
4. Can fall back to strfry if Nosflare issues

## Resolved Questions

| Question          | Decision            | Rationale                                     |
| ----------------- | ------------------- | --------------------------------------------- |
| Lightning hosting | Voltage Cloud       | No self-hosted node, BTCPay integration       |
| Relay software    | Nosflare            | Cloudflare-native, active dev, NIP-78 support |
| Hosting           | Cloudflare          | Global edge, serverless, R2 integration       |
| Storage           | Cloudflare R2       | Native integration, no egress fees            |
| Event kinds       | Kind 30078 (NIP-78) | Existing standard, widely supported           |
| Cashu             | Deferred to Phase 2 | Tracked for future implementation             |

## Future Considerations (Phase 2)

- **Cashu token support**: Anonymous payments, tracked for future
- **strfry fallback**: Document self-hosted option for sovereignty purists
- **Multi-region R2**: Geographic redundancy for backups
- **Teams tier integration**: Shared infrastructure with Cloud tier
