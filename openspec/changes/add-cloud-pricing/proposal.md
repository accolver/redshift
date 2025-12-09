# Change: Add Cloud Tier Pricing ($5/month)

## Why

Redshift currently has no monetization path. The Cloud tier provides sustainable
revenue while preserving user sovereignty by offering managed relay
infrastructure as a convenience layer. Users pay for reliability, not access to
their own secrets.

**Business Context**:

- Target: Individual developers who want reliability without self-hosting
- Price: $5/month (covers infrastructure costs)
- Value: 99.5% SLA, automatic backups, 7-day audit logs
- Launch: Q2 2025

## What Changes

### New Packages

- `@redshift/cloud` - Access token generation/validation, audit logging
- `@redshift/payments` - BTCPay Server integration, payment abstractions

### Infrastructure (Cloudflare-Native)

- **Nosflare relay** on Cloudflare Workers + Durable Objects
- **Cloudflare R2** for encrypted backup storage (not S3)
- **BTCPay Server** with Voltage Cloud Lightning (no self-hosted node)
- Monitoring and status page

### Web Admin

- New `/admin/subscribe` route for subscription management
- `PaymentModal.svelte` - BTCPay checkout flow with QR codes
- `SubscriptionStatus.svelte` - Shows current plan, expiry
- `UpgradePrompt.svelte` - Upsell banner for free users
- `subscription.svelte.ts` - Subscription state store

### CLI

- New `redshift subscription status` command
- New `redshift subscription upgrade` command (opens browser)
- Managed relay auto-configuration for subscribers

### Nostr Protocol (NIP-78 Compatible)

- Access tokens: Kind 30078 (NIP-78 arbitrary app data)
- Audit logs: Kind 30078 with NIP-44 encrypted content
- Both wrapped in NIP-59 Gift Wrap for privacy
- **No custom event kinds** - uses existing NIP-78 standard

## Impact

- Affected specs: None (all new capabilities)
- New capabilities: `cloud-subscription`, `btcpay-integration`, `access-tokens`,
  `audit-logging`
- Affected code:
  - `packages/` (2 new packages)
  - `infrastructure/` (new: Nosflare + BTCPay configs)
  - `web/src/routes/admin/subscribe/`
  - `web/src/lib/components/` (3 new components)
  - `web/src/lib/stores/subscription.svelte.ts`
  - `cli/src/commands/subscription.ts`

## Key Decisions

### Lightning: Voltage Cloud (No Self-Hosted Node)

**Decision**: Use Voltage Cloud's hosted LND node instead of self-hosting.

**Rationale**:

- No Lightning node maintenance burden
- Professional-grade uptime and liquidity
- Official BTCPay Server integration
- Cost: ~$10-27/month vs significant self-hosted complexity
- Focus engineering on Redshift, not Lightning infrastructure

### Relay: Nosflare on Cloudflare

**Decision**: Deploy relay using Nosflare on Cloudflare Workers.

**Rationale**:

- Active development (last commit Dec 6, 2025)
- Cloudflare-native: Workers, Durable Objects, R2
- Supports all required NIPs including NIP-78
- Serverless: automatic scaling, global edge
- Alternative: strfry on VPS (documented as fallback)

### Storage: Cloudflare R2 (Not S3)

**Decision**: Use Cloudflare R2 for backup storage.

**Rationale**:

- Native Nosflare/Cloudflare Workers integration
- S3-compatible API (easy migration if needed)
- No egress fees (significant cost savings)
- Same infrastructure as relay

### Event Kinds: NIP-78 (Kind 30078)

**Decision**: Use existing NIP-78 for tokens and audit logs instead of custom
kinds.

**Rationale**:

- NIP-78 is official "Arbitrary custom app data" standard
- Already supported by all major relays
- No need to propose new NIPs
- Ecosystem-compatible approach

**Research confirms**:

- NIP-78 specifies Kind 30078 as addressable event
- Used for "remoteStorage-like capabilities"
- Nosflare explicitly supports NIP-78

### Hosting: Cloudflare (Sovereignty Analysis)

**Decision**: Use Cloudflare infrastructure with sovereignty preserved.

**Rationale**:

- Global edge network, managed infrastructure
- User sovereignty maintained:
  - All secrets remain client-side encrypted
  - User can export and use any Nostr relay
  - No lock-in to Redshift or Cloudflare
- For sovereignty purists: Document self-hosted options (strfry, mynymbox.net)

## Telos Validation

### L9 (Telos-Guardian): Purpose Alignment

> "Does this serve user sovereignty?"

**Yes** - Verified against `.telos/TELOS.md`:

- All secrets remain client-side encrypted (NIP-59 Gift Wrap)
- We only store encrypted blobs - cannot access plaintext
- Free tier remains fully functional - no paywalling
- Users can export data and leave anytime
- No vendor lock-in: standard Nostr events work with any relay

### L8 (Market-Analyst): Business Value

> "Does this create sustainable value?"

**Yes** - Aligns with Telos L8:

- $5/month covers infrastructure (~$25-62/month costs)
- Break-even at ~5-12 subscribers
- Clear upgrade path from free tier without paywalling core functionality
- Bitcoin-only payments align with sovereignty values

### L4 (Integration-Contractor): Protocol Compatibility

> "Do contracts remain stable?"

**Yes** - Uses existing NIPs:

- NIP-78 (Kind 30078) for tokens and audit logs
- NIP-59 for privacy wrapping
- NIP-44 for content encryption
- No new NIPs required - uses existing infrastructure

### L1 (Syntax-Linter): Technical Feasibility

> "Is this implementable?"

**Yes** - All components verified:

- Nosflare: TypeScript, MIT license, active development
- BTCPay Server: Mature REST API, Voltage integration documented
- Cloudflare R2: Standard S3 API
- All TypeScript/Bun compatible

**Decision**: Both validation flows converge. Proceed with implementation.

## Resolved Questions

| Question               | Decision                   | Rationale                               |
| ---------------------- | -------------------------- | --------------------------------------- |
| Self-hosted Lightning? | **No** - Use Voltage Cloud | No maintenance, BTCPay integration      |
| Relay software?        | **Nosflare**               | Cloudflare-native, active dev, NIP-78   |
| Hosting provider?      | **Cloudflare**             | Global edge, R2 integration, serverless |
| Storage?               | **Cloudflare R2**          | Native integration, no egress fees      |
| Event kinds?           | **Kind 30078** (NIP-78)    | Existing standard, widely supported     |
| Cashu support?         | **Deferred to Phase 2**    | Tracked for future implementation       |

## Future Work (Phase 2)

- Cashu token support for anonymous payments
- strfry self-hosted option documentation
- Multi-region R2 geographic redundancy
- Teams tier shared infrastructure

## References

- `CLOUD_TIER_PLAN.md` - Detailed implementation plan
- `TEAMS_CLOUD_ENTERPRISE.md` - Full tier architecture
- `spec.md` Section 6 - Monetization roadmap
- `.telos/TELOS.md` - Purpose hierarchy validation
- [NIP-78](https://github.com/nostr-protocol/nips/blob/master/78.md) - Arbitrary
  custom app data
- [Nosflare](https://github.com/Spl0itable/nosflare) - Cloudflare Workers relay
- [Voltage Cloud](https://docs.btcpayserver.org/Deployment/voltagecloud/) -
  BTCPay integration
