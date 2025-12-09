# Teams, Cloud & Enterprise Architecture

## Overview

This document details the security architecture, cryptographic protocols, and
payment systems for Redshift's paid tiers. All designs prioritize:

1. **Security First**: Resilient to key leaks with forward secrecy
2. **Sovereignty Preserved**: Client-side encryption, no backdoors
3. **Bitcoin-Only Payments**: BTC on-chain, Lightning, and Cashu tokens

---

## Key Decisions (December 2024)

These decisions were made based on enterprise market research and guide all
implementation work.

### Decision Summary

| # | Decision                | Rationale                                                  | Status              |
| - | ----------------------- | ---------------------------------------------------------- | ------------------- |
| 1 | **Bunker Orchestrator** | Build orchestration around `nak bunker`, not custom NIP-46 | Approved            |
| 2 | **SSO Bridge Priority** | OIDC→Nostr is table stakes for Enterprise sales            | Approved            |
| 3 | **SOC2 Type II**        | Required for enterprise vendor approval                    | Approved (Q4 2025+) |
| 4 | **NIP-EE for Teams**    | MLS provides forward secrecy; accept draft NIP risk        | Approved            |

### 1. Bunker Strategy: Orchestrator, Not Engine

**Decision**: Build a thin orchestration layer around `nak bunker` instead of
reimplementing NIP-46 in TypeScript.

**What Redshift Builds**:

- Process lifecycle management (spawn, monitor, restart)
- Authorized pubkey management (team onboarding/offboarding)
- Health monitoring and alerts
- Audit log integration
- systemd/Docker deployment configs

**What Redshift Does NOT Build**:

- NIP-46 protocol implementation (use `nak bunker`)
- Cryptographic signing (use `nak bunker`)
- MPC/threshold signatures (future: consider partnering with Cubist or similar)

### 2. SSO Bridge is Priority

**Decision**: The OIDC→Nostr SSO Bridge is the highest priority Enterprise
feature.

**Rationale**:

- Without SSO, enterprises cannot adopt Redshift (security policy requirement)
- Competitors (Doppler, HashiCorp Vault) all offer SSO at enterprise tier
- SSO enables: automated user provisioning, compliance, audit trails

### 3. SOC2 Type II Required

**Decision**: SOC2 Type II certification is required for Enterprise tier.

**Timeline**: Begin preparation Q4 2025, after Teams tier is validated.

**Budget**: $75k-$150k+ annually (audit fees, tooling, personnel)

**Note**: Focus on Teams tier first to validate product-market fit before
significant compliance investment.

### 4. NIP-EE for Group Encryption

**Decision**: Use NIP-EE (MLS protocol, RFC 9420) for Teams tier group
encryption.

**Benefits**:

- Forward secrecy (past messages protected if key leaks)
- Post-compromise security (future messages protected after key rotation)
- Efficient O(log n) complexity for member changes

**Risk**: NIP-EE is still a draft NIP and may change before finalization.

**Mitigation**: Design abstraction layer to allow protocol swap if needed.

### Pricing Summary

| Tier           | Price                             | Target Audience                         |
| -------------- | --------------------------------- | --------------------------------------- |
| **Cloud**      | $5/month                          | Individual developers, small projects   |
| **Teams**      | $20/user/month                    | Startups, small teams (5-50 people)     |
| **Enterprise** | Custom (~$500/mo base + per-seat) | Large organizations, compliance-focused |

---

## Tier 1: Redshift Cloud ($5/month)

### Value Proposition

Managed high-availability relay with automatic backups. Users pay for
convenience and reliability, not capability.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Device                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   CLI       │  │  Web Admin  │  │  Browser Extension      │  │
│  │  (NIP-59)   │  │  (NIP-59)   │  │  (NIP-07)               │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                │
│         └────────────────┼──────────────────────┘                │
│                          │ Encrypted events only                 │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Redshift Cloud Infrastructure                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   Load Balancer (Cloudflare)                │  │
│  └───────────────────────────┬────────────────────────────────┘  │
│                              │                                    │
│  ┌───────────────────────────┼────────────────────────────────┐  │
│  │                    Managed Relay Cluster                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │  │
│  │  │   Relay 1    │  │   Relay 2    │  │   Relay 3    │      │  │
│  │  │  (Primary)   │  │  (Secondary) │  │  (Secondary) │      │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │  │
│  │         │                 │                 │               │  │
│  │         └─────────────────┼─────────────────┘               │  │
│  │                           ▼                                 │  │
│  │              ┌─────────────────────────┐                    │  │
│  │              │   Event Storage (LMDB)  │                    │  │
│  │              │   Encrypted blobs only  │                    │  │
│  │              └─────────────────────────┘                    │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│  ┌───────────────────────────┼────────────────────────────────┐  │
│  │                    Backup System                            │  │
│  │         ┌─────────────────┴─────────────────┐               │  │
│  │         ▼                                   ▼               │  │
│  │  ┌──────────────┐                   ┌──────────────┐        │  │
│  │  │  S3/R2       │                   │  Geographic  │        │  │
│  │  │  (Primary)   │                   │  Replica     │        │  │
│  │  │  Encrypted   │                   │  (DR)        │        │  │
│  │  └──────────────┘                   └──────────────┘        │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│  ┌───────────────────────────┼────────────────────────────────┐  │
│  │                   Payment Gateway                           │  │
│  │  ┌────────────────────────────────────────────────────────┐ │  │
│  │  │              BTCPay Server (Self-Hosted)               │ │  │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │ │  │
│  │  │  │   On-Chain   │  │   Lightning  │  │    Cashu     │  │ │  │
│  │  │  │   BTC        │  │   Network    │  │   Tokens     │  │ │  │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘  │ │  │
│  │  └────────────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Security Model

**What we store**: NIP-59 Gift Wrapped events (encrypted blobs)

**What we cannot access**:

- Secret names, values, or metadata
- User identities beyond pubkeys
- Project structures or relationships

**Backup encryption**: Events are already encrypted client-side. Backups are
encrypted-at-rest using infrastructure keys, but even without this layer,
secrets remain protected by NIP-59.

### Payment Flow (Lightning Subscription)

```
┌──────────────────────────────────────────────────────────────────┐
│                     Subscription Flow                             │
│                                                                   │
│  1. User visits cloud.redshiftapp.com/subscribe                     │
│  2. BTCPay generates Lightning invoice ($5 equivalent)           │
│  3. User pays via wallet (Phoenix, Zeus, etc.)                   │
│  4. BTCPay webhook notifies backend                              │
│  5. Backend issues access token (signed by relay privkey)        │
│  6. Token stored in user's Nostr profile (Kind 30078)            │
│  7. Relay validates token on each connection                     │
│                                                                   │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐       │
│  │    User     │─────▶│  BTCPay     │─────▶│   Backend   │       │
│  │   Wallet    │ pay  │  Server     │ hook │   Service   │       │
│  └─────────────┘      └─────────────┘      └──────┬──────┘       │
│                                                    │              │
│                                             issue token           │
│                                                    │              │
│                                                    ▼              │
│                                            ┌─────────────┐        │
│                                            │   Nostr     │        │
│                                            │   Event     │        │
│                                            │ (Kind 30078)│        │
│                                            └─────────────┘        │
└──────────────────────────────────────────────────────────────────┘
```

### BTCPay Server Integration

```typescript
// BTCPay Greenfield API integration
interface BTCPayConfig {
  serverUrl: string; // https://btcpay.redshiftapp.com
  storeId: string; // Store identifier
  apiKey: string; // Greenfield API key (server-side only)
  webhookSecret: string; // HMAC secret for webhook validation
}

interface CreateInvoiceRequest {
  amount: string; // "5" (USD equivalent)
  currency: "USD";
  metadata: {
    pubkey: string; // User's Nostr pubkey
    tier: "cloud";
    period: "monthly";
  };
  checkout: {
    paymentMethods: ["BTC", "BTC-LN"]; // On-chain and Lightning
    expirationMinutes: 30;
    redirectUrl: string;
  };
}

interface WebhookPayload {
  deliveryId: string;
  webhookId: string;
  type: "InvoiceSettled" | "InvoiceExpired" | "InvoiceInvalid";
  invoiceId: string;
  storeId: string;
  metadata: {
    pubkey: string;
    tier: string;
    period: string;
  };
}
```

### Access Token Design

```typescript
// Relay access token - stored as NIP-59 wrapped event
interface CloudAccessToken {
  pubkey: string; // User's pubkey
  tier: "cloud";
  issuedAt: number; // Unix timestamp
  expiresAt: number; // Unix timestamp (issued + 30 days)
  invoiceId: string; // BTCPay invoice reference
  signature: string; // Signed by relay operator
}

// Token validation on relay connection
function validateCloudAccess(
  token: CloudAccessToken,
  relayPubkey: string,
): boolean {
  // 1. Verify signature
  const valid = schnorr.verify(token.signature, hashToken(token), relayPubkey);
  // 2. Check expiration
  const notExpired = token.expiresAt > Date.now() / 1000;
  // 3. Check tier
  const correctTier = token.tier === "cloud";

  return valid && notExpired && correctTier;
}
```

---

## Tier 2: Teams ($20/user/month)

### Value Proposition

Secure multi-user collaboration with cryptographic access control, automatic key
rotation, and audit logging. Includes managed bunker deployment for team key
custody.

### Key Decision: Bunker Orchestrator Architecture

**Decision (December 2024)**: Build an orchestration layer around `nak bunker`,
not a custom NIP-46 implementation.

**Rationale**:

- `nak bunker` is battle-tested, maintained by fiatjaf (core Nostr developer)
- Avoids reimplementing cryptographic signing in TypeScript (security risk)
- Focuses Redshift engineering on secrets management (our core value prop)
- Provides enterprise-ready deployment without reinventing the wheel

```
┌──────────────────────────────────────────────────────────────────┐
│                    Bunker Orchestrator Architecture               │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Redshift Bunker Orchestrator                    │ │
│  │              (TypeScript - lifecycle management)             │ │
│  │                                                              │ │
│  │  ┌────────────────────────────────────────────────────────┐ │ │
│  │  │                   Core Functions                        │ │ │
│  │  │                                                         │ │ │
│  │  │  • Process Management                                   │ │ │
│  │  │    - Spawn nak bunker subprocess                        │ │ │
│  │  │    - Monitor health, restart on failure                 │ │ │
│  │  │    - Graceful shutdown handling                         │ │ │
│  │  │                                                         │ │ │
│  │  │  • Access Control                                       │ │ │
│  │  │    - Manage authorized client pubkeys                   │ │ │
│  │  │    - Team member onboarding/offboarding                 │ │ │
│  │  │    - SSO integration for authorization                  │ │ │
│  │  │                                                         │ │ │
│  │  │  • Compliance                                           │ │ │
│  │  │    - Audit log generation                               │ │ │
│  │  │    - Uptime tracking for SLA                            │ │ │
│  │  │    - Key backup/recovery workflows                      │ │ │
│  │  └────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              │ spawn/manage                       │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    nak bunker (Go binary)                    │ │
│  │                    (NIP-46 Remote Signer)                    │ │
│  │                                                              │ │
│  │  Flags used:                                                 │ │
│  │  --persist         Persistent configuration                  │ │
│  │  -k <pubkey>       Authorized client pubkeys                 │ │
│  │  --relay <url>     Relay for NIP-46 communication            │ │
│  │                                                              │ │
│  │  Responsibilities:                                           │ │
│  │  • All cryptographic signing operations                      │ │
│  │  • nsec storage and protection                               │ │
│  │  • NIP-46 protocol handling                                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Bunker Orchestrator Implementation

```typescript
// cli/src/lib/bunker-orchestrator.ts

interface BunkerConfig {
  nsec?: string; // Optional: orchestrator can generate
  relays: string[]; // Relays for NIP-46 communication
  authorizedPubkeys: string[]; // Team members allowed to connect
  persistPath: string; // ~/.redshift/bunker/
  healthCheckInterval: number; // ms
}

interface BunkerStatus {
  running: boolean;
  pid?: number;
  uptime: number; // seconds
  connectedClients: number;
  lastHealthCheck: number;
  connectionUri?: string; // bunker://... for clients
}

class BunkerOrchestrator {
  private process: ChildProcess | null = null;
  private config: BunkerConfig;

  async start(): Promise<BunkerStatus> {
    // 1. Check nak binary exists (or download)
    await this.ensureNakBinary();

    // 2. Build command with flags
    const args = [
      "bunker",
      "--persist",
      ...this.config.relays.flatMap((r) => ["--relay", r]),
      ...this.config.authorizedPubkeys.flatMap((p) => ["-k", p]),
    ];

    // 3. Spawn subprocess
    this.process = spawn("nak", args, {
      cwd: this.config.persistPath,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // 4. Parse connection URI from stdout
    const uri = await this.parseConnectionUri();

    // 5. Start health monitoring
    this.startHealthMonitor();

    // 6. Log audit event
    await this.logAuditEvent("bunker:start", { uri });

    return this.getStatus();
  }

  async authorize(pubkey: string): Promise<void> {
    // Add pubkey to authorized list
    this.config.authorizedPubkeys.push(pubkey);

    // Restart bunker with updated config
    await this.restart();

    // Log audit event
    await this.logAuditEvent("bunker:authorize", { pubkey });
  }

  async revoke(pubkey: string): Promise<void> {
    // Remove pubkey from authorized list
    this.config.authorizedPubkeys = this.config.authorizedPubkeys.filter(
      (p) => p !== pubkey,
    );

    // Restart bunker (immediately invalidates sessions)
    await this.restart();

    // Log audit event
    await this.logAuditEvent("bunker:revoke", { pubkey });
  }

  async backup(): Promise<{ encryptedBackup: string; timestamp: number }> {
    // Create encrypted backup of nsec
    // Uses team's encryption key (MLS group key)
    // ...
  }
}
```

### CLI Commands (Teams Tier)

```bash
# Start bunker for team
redshift bunker start
# Output: Bunker started. Connection URI: bunker://abc123...

# Check bunker status
redshift bunker status
# Output:
#   Status: Running
#   Uptime: 3d 14h 22m
#   Connected clients: 3
#   Authorized pubkeys: 5

# Authorize team member
redshift bunker authorize npub1abc...
# Output: Authorized npub1abc... to connect to bunker

# Revoke access (e.g., when team member leaves)
redshift bunker revoke npub1abc...
# Output: Revoked npub1abc... - bunker restarted

# Create encrypted backup
redshift bunker backup
# Output: Backup saved to ~/.redshift/bunker/backup-2024-12-09.enc

# Generate systemd service file for production
redshift bunker systemd > /etc/systemd/system/redshift-bunker.service
```

### Deployment Configurations

```yaml
# docker-compose.yml for Teams bunker deployment
version: "3.9"

services:
  bunker-orchestrator:
    image: ghcr.io/redshift/bunker-orchestrator:latest
    environment:
      - REDSHIFT_TEAM_ID=${TEAM_ID}
      - REDSHIFT_RELAYS=wss://relay.redshiftapp.com
      - REDSHIFT_AUTHORIZED_PUBKEYS=${AUTHORIZED_PUBKEYS}
    volumes:
      - bunker-data:/data
      - ./nak:/usr/local/bin/nak:ro # Mount nak binary
    ports:
      - "3333:3333" # Health check API
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3333/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  bunker-data:
```

```ini
# systemd service file (generated by `redshift bunker systemd`)
[Unit]
Description=Redshift Bunker Orchestrator
After=network.target

[Service]
Type=simple
User=redshift
WorkingDirectory=/var/lib/redshift/bunker
ExecStart=/usr/local/bin/redshift bunker start --daemon
ExecStop=/usr/local/bin/redshift bunker stop
Restart=always
RestartSec=10

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/redshift/bunker

[Install]
WantedBy=multi-user.target
```

### Core Security: MLS Protocol (NIP-EE)

Teams tier uses **Messaging Layer Security (MLS)** via the proposed NIP-EE for
group encryption. This provides:

1. **Forward Secrecy**: Past messages can't be decrypted if keys leak
2. **Post-Compromise Security**: Future messages protected after key rotation
3. **Efficient Group Operations**: O(log n) complexity for member changes
4. **Automatic Key Rotation**: New epoch on any membership change

```
┌──────────────────────────────────────────────────────────────────┐
│                     MLS Group Architecture                        │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    MLS Ratchet Tree                          │ │
│  │                                                               │ │
│  │                         [Root Key]                            │ │
│  │                        /          \                           │ │
│  │                  [Node]            [Node]                     │ │
│  │                  /    \            /    \                     │ │
│  │              [Leaf]  [Leaf]    [Leaf]  [Leaf]                │ │
│  │               Alice   Bob      Carol    Dave                  │ │
│  │                                                               │ │
│  │  Each member holds their leaf secret + path to root          │ │
│  │  Group secret derived from root - all members can compute    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Key Properties:                                                  │
│  • Member removal: Update path, new root secret                  │
│  • Leaked key: Only that epoch's messages at risk                │
│  • New member: Can only decrypt from join point forward          │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Role-Based Access Control (RBAC)

```typescript
// Team roles and permissions
type TeamRole = "owner" | "admin" | "developer" | "readonly";

interface TeamMember {
  pubkey: string;
  role: TeamRole;
  joinedAt: number;
  invitedBy: string; // Pubkey of inviter
  mlsLeafIndex: number; // Position in ratchet tree
}

interface RolePermissions {
  owner: {
    manageMembers: true;
    manageRoles: true;
    manageProjects: true;
    readSecrets: true;
    writeSecrets: true;
    deleteTeam: true;
  };
  admin: {
    manageMembers: true;
    manageRoles: true; // Can't change owner
    manageProjects: true;
    readSecrets: true;
    writeSecrets: true;
    deleteTeam: false;
  };
  developer: {
    manageMembers: false;
    manageRoles: false;
    manageProjects: false;
    readSecrets: true;
    writeSecrets: true;
    deleteTeam: false;
  };
  readonly: {
    manageMembers: false;
    manageRoles: false;
    manageProjects: false;
    readSecrets: true;
    writeSecrets: false;
    deleteTeam: false;
  };
}
```

### Team Secret Storage

Secrets are encrypted to the MLS group key, not individual member keys:

```typescript
// Team secret encryption (NIP-EE + NIP-44)
interface TeamSecret {
  // Outer envelope: NIP-59 Gift Wrap to team pubkey
  // Inner encryption: MLS group key (current epoch)

  teamId: string; // Derived team identifier
  projectId: string;
  environment: string;
  secrets: Record<string, string>; // Encrypted with MLS group key
  epoch: number; // MLS epoch when encrypted
  author: string; // Pubkey of member who wrote
  timestamp: number;
}

// On member removal:
// 1. MLS tree updated, new root derived
// 2. All active secrets re-encrypted to new epoch key
// 3. Removed member's leaf secret deleted from tree
// 4. Past epochs become unrecoverable for removed member
```

### Member Removal Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                   Member Removal: Key Rotation                    │
│                                                                   │
│  Before (Epoch N):                                               │
│      [Root_N]                                                    │
│      /      \                                                    │
│  [Alice]  [Bob]  [Carol]                                        │
│                    ↑                                             │
│                  (leaving)                                       │
│                                                                   │
│  Step 1: Remove Carol's leaf from tree                           │
│  Step 2: Compute new path secrets (Bob updates his path)        │
│  Step 3: Derive new Root_N+1                                    │
│  Step 4: Re-encrypt all secrets to Epoch N+1                    │
│                                                                   │
│  After (Epoch N+1):                                              │
│      [Root_N+1]                                                  │
│      /      \                                                    │
│  [Alice]  [Bob]                                                 │
│                                                                   │
│  Carol's state:                                                  │
│  • Has: Epoch N key (historical)                                 │
│  • Cannot derive: Epoch N+1 key                                  │
│  • Cannot decrypt: Any secrets after removal                     │
│                                                                   │
│  Security properties:                                            │
│  • Forward secrecy: Past secrets at Epoch N still safe          │
│  • Post-compromise: Future secrets (N+1+) protected             │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Audit Logging

```typescript
// Audit events stored as signed Nostr events
interface AuditEvent {
  kind: 30079; // Custom kind for audit logs
  pubkey: string; // Actor's pubkey
  created_at: number;
  tags: [
    ["d", "<team_id>"], // Team identifier
    ["action", AuditAction],
    ["target", string], // What was affected
    ["epoch", string], // MLS epoch
  ];
  content: string; // JSON details (encrypted to team)
  sig: string;
}

type AuditAction =
  | "secret:create"
  | "secret:update"
  | "secret:delete"
  | "secret:read"
  | "member:invite"
  | "member:remove"
  | "member:role_change"
  | "project:create"
  | "project:delete"
  | "key:rotate"; // MLS epoch change
```

### Team Payment: Per-Seat Billing

```typescript
// Team billing via BTCPay
interface TeamBilling {
  teamId: string;
  ownerPubkey: string;
  seats: number; // Current member count
  pricePerSeat: 20; // USD
  billingCycle: "monthly";

  // BTCPay subscription
  subscriptionId: string;
  nextInvoiceAt: number;
}

// Webhook handler for seat changes
async function handleSeatChange(teamId: string, newSeatCount: number) {
  const billing = await getTeamBilling(teamId);
  const prorated = calculateProration(billing.seats, newSeatCount);

  if (prorated > 0) {
    // Additional seats: generate invoice for prorated amount
    await btcpay.createInvoice({
      amount: prorated.toString(),
      currency: "USD",
      metadata: { teamId, type: "seat_increase" },
    });
  }
  // Seat reduction: credit applied to next invoice
}
```

---

## Tier 3: Enterprise (Custom Pricing)

### Value Proposition

SSO integration, on-premise deployment, compliance documentation, and dedicated
support for organizations with strict security requirements.

**Pricing**: Custom, starting ~$500/mo base + per-seat fees. Annual contracts.

### Key Decisions (December 2024)

| Decision                   | Rationale                                                                  |
| -------------------------- | -------------------------------------------------------------------------- |
| **SSO Bridge is Priority** | Table stakes for enterprise sales; without OIDC, enterprises cannot adopt  |
| **SOC2 Type II Required**  | Required for vendor approval at most enterprises; budget $75-150k annually |
| **Focus Teams First**      | Teams tier provides foundation; Enterprise builds on top                   |

### Enterprise Feature Matrix

| Feature                   | Teams | Enterprise |
| ------------------------- | ----- | ---------- |
| Bunker Orchestrator       | ✓     | ✓          |
| RBAC (4 built-in roles)   | ✓     | ✓          |
| 90-day audit logs         | ✓     | Unlimited  |
| SAML SSO                  | ✓     | ✓          |
| Custom roles              | -     | ✓          |
| SCIM provisioning         | -     | ✓          |
| SIEM log forwarding       | -     | ✓          |
| SSO Bridge (OIDC→Nostr)   | -     | ✓          |
| On-premise deployment     | -     | ✓          |
| SOC2 Type II              | -     | ✓          |
| 99.95% SLA                | -     | ✓          |
| 24/7 support              | -     | ✓          |
| Dedicated account manager | -     | ✓          |

### SSO Bridge: OIDC to Nostr (Priority Feature)

The SSO bridge allows enterprise users to authenticate via corporate identity
providers (Okta, AzureAD, Google Workspace) while maintaining Nostr's
cryptographic model.

```
┌──────────────────────────────────────────────────────────────────┐
│                    SSO Bridge Architecture                        │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 Customer's Infrastructure                     │ │
│  │                                                               │ │
│  │  ┌───────────────┐       ┌───────────────────────────────┐   │ │
│  │  │  Corporate    │       │     SSO Bridge (Enclave)      │   │ │
│  │  │  IdP          │◄─────▶│                               │   │ │
│  │  │  (Okta/Azure) │ OIDC  │  ┌─────────────────────────┐  │   │ │
│  │  └───────────────┘       │  │  HSM / Secure Enclave   │  │   │ │
│  │                          │  │                         │  │   │ │
│  │                          │  │  • Master seed storage  │  │   │ │
│  │                          │  │  • Key derivation       │  │   │ │
│  │                          │  │  • Session signing      │  │   │ │
│  │                          │  └─────────────────────────┘  │   │ │
│  │                          │              │                │   │ │
│  │                          │              ▼                │   │ │
│  │                          │  ┌─────────────────────────┐  │   │ │
│  │                          │  │  Derived User Keys      │  │   │ │
│  │                          │  │  master + HKDF(email)   │  │   │ │
│  │                          │  └─────────────────────────┘  │   │ │
│  │                          └───────────────────────────────┘   │ │
│  │                                         │                     │ │
│  │                                         ▼                     │ │
│  │                          ┌───────────────────────────────┐   │ │
│  │                          │   On-Premise Relay Cluster    │   │ │
│  │                          │   (Customer-controlled)       │   │ │
│  │                          └───────────────────────────────┘   │ │
│  │                                                               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Key Properties:                                                  │
│  • Corporate IdP validates identity                              │
│  • SSO Bridge derives deterministic Nostr keys                   │
│  • Master seed never leaves HSM/enclave                          │
│  • Users don't manage nsec directly                              │
│  • Revocation: HSM stops deriving key for revoked users          │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### SSO Key Derivation

```typescript
// Deterministic key derivation from corporate identity
interface SSOKeyDerivation {
  // Master seed stored in HSM (generated on setup)
  masterSeed: Uint8Array;   // 32 bytes, HSM-protected
  
  // User key derived from email/subject
  deriveUserKey(email: string): NostrKeypair {
    // HKDF with master seed and email as info
    const userSeed = hkdf(
      "sha256",
      this.masterSeed,
      email.toLowerCase(),    // Normalize email
      "redshift-sso-v1",      // Context
      32
    );
    
    // Convert to Nostr keypair
    const privateKey = secp256k1.utils.hashToPrivateKey(userSeed);
    const publicKey = schnorr.getPublicKey(privateKey);
    
    return { privateKey, publicKey };
  }
}

// Session token for web/CLI usage
interface SSOSession {
  pubkey: string;           // Derived Nostr pubkey
  email: string;            // Corporate email
  groups: string[];         // OIDC groups (for RBAC)
  issuedAt: number;
  expiresAt: number;        // Short-lived: 1-8 hours
  signature: string;        // Signed by bridge's Nostr key
}
```

### On-Premise Deployment

```yaml
# docker-compose.yml for Enterprise on-premise
version: "3.9"

services:
  relay:
    image: ghcr.io/redshift/relay:latest
    environment:
      - RELAY_MODE=enterprise
      - SSO_BRIDGE_URL=http://sso-bridge:8080
      - STORAGE_PATH=/data
    volumes:
      - relay-data:/data
    ports:
      - "443:443"

  sso-bridge:
    image: ghcr.io/redshift/sso-bridge:latest
    environment:
      - OIDC_ISSUER=https://company.okta.com
      - OIDC_CLIENT_ID=${OIDC_CLIENT_ID}
      - OIDC_CLIENT_SECRET=${OIDC_CLIENT_SECRET}
      - HSM_SLOT=0
    volumes:
      - ./hsm-config:/etc/pkcs11

  backup:
    image: ghcr.io/redshift/backup:latest
    environment:
      - BACKUP_SCHEDULE=0 2 * * * # 2 AM daily
      - BACKUP_DESTINATION=s3://company-bucket/redshift
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
    volumes:
      - relay-data:/data:ro

volumes:
  relay-data:
```

### Enterprise RBAC: OIDC Groups to Nostr Roles

```typescript
// Map OIDC groups to Redshift roles
interface EnterpriseRBACConfig {
  groupMappings: {
    // OIDC group -> Redshift role
    "engineering-leads": "owner";
    "platform-team": "admin";
    "developers": "developer";
    "contractors": "readonly";
  };

  // Project-level overrides
  projectOverrides: {
    "production-secrets": {
      allowedGroups: ["platform-team", "engineering-leads"];
      minRole: "admin";
    };
    "dev-secrets": {
      allowedGroups: ["developers", "contractors"];
      minRole: "readonly";
    };
  };
}

// Validate access based on OIDC session
function validateEnterpriseAccess(
  session: SSOSession,
  project: string,
  requiredRole: TeamRole,
): boolean {
  const config = getEnterpriseRBACConfig();
  const projectConfig = config.projectOverrides[project];

  // Check project-level restrictions
  if (projectConfig) {
    const hasAllowedGroup = session.groups.some(
      (g) => projectConfig.allowedGroups.includes(g),
    );
    if (!hasAllowedGroup) return false;
  }

  // Derive role from groups
  const userRole = deriveRoleFromGroups(session.groups, config.groupMappings);

  return roleHasPermission(userRole, requiredRole);
}
```

### Enterprise Payment: Annual Contracts

```typescript
// Enterprise billing structure
interface EnterpriseBilling {
  contractId: string;
  companyName: string;
  startDate: number;
  endDate: number;

  pricing: {
    baseFee: number; // Annual base (e.g., $10,000)
    perSeat: number; // Per user/year (e.g., $100)
    seatCount: number;
    support: "standard" | "premium" | "dedicated";
  };

  // Payment options
  payment: {
    method: "btc-onchain" | "lightning" | "invoice";
    terms: "annual-prepaid" | "quarterly";

    // For BTC: multi-sig escrow for annual contracts
    escrow?: {
      escrowPubkeys: string[]; // 2-of-3: customer, redshift, arbitrator
      releaseSchedule: "quarterly" | "milestone";
    };
  };
}
```

---

## Payment System: Bitcoin-Only

### Supported Payment Methods

| Method       | Use Case                  | Settlement   | Privacy  |
| ------------ | ------------------------- | ------------ | -------- |
| Lightning    | Cloud/Teams subscriptions | Instant      | Moderate |
| On-chain BTC | Enterprise contracts      | 1-6 confirms | Public   |
| Cashu tokens | Anonymous access, tips    | Instant      | High     |

### BTCPay Server Configuration

```typescript
// BTCPay store configuration
interface BTCPayStoreConfig {
  name: "Redshift Payments";
  defaultCurrency: "USD";

  paymentMethods: {
    "BTC-CHAIN": {
      enabled: true;
      confirmations: 1; // Cloud/Teams
      enterpriseConfirmations: 6;
    };
    "BTC-LN": {
      enabled: true;
      lnurlEnabled: true; // For recurring payments
    };
  };

  webhooks: [
    {
      url: "https://api.redshiftapp.com/webhooks/btcpay";
      events: [
        "InvoiceSettled",
        "InvoiceExpired",
        "InvoiceInvalid",
        "InvoicePaymentSettled",
      ];
      secret: string; // HMAC validation
    },
  ];

  checkoutAppearance: {
    brand: "Redshift";
    logo: "https://redshiftapp.com/logo.svg";
    customCSS: string;
  };
}
```

### Cashu Integration for Anonymous Access

Cashu tokens enable privacy-preserving payments without requiring identity:

```typescript
// Cashu mint configuration
interface CashuMintConfig {
  mintUrl: "https://mint.redshiftapp.com";

  // Tokens for anonymous cloud access
  denominations: [
    { value: 5; unit: "USD"; description: "1 month Cloud access" },
    { value: 50; unit: "USD"; description: "12 month Cloud access" },
  ];

  // Redeem flow
  redeemEndpoint: "https://api.redshiftapp.com/cashu/redeem";
}

// Cashu redemption for anonymous access
interface CashuRedemption {
  // User sends Cashu token
  token: string; // Base64 encoded Cashu token
  pubkey: string; // Nostr pubkey for access

  // Server validates token, issues access
  response: {
    accessToken: CloudAccessToken;
    expiresAt: number;
  };
}

// NUT-11 P2PK: Lock tokens to recipient pubkey
interface LockedCashuToken {
  mint: string;
  proofs: Proof[];
  p2pkPubkey: string; // Only this pubkey can redeem
}
```

### Subscription Management

```typescript
// LNURL-pay for recurring subscriptions
interface LNURLSubscription {
  // User's wallet stores this
  callback: "https://api.redshiftapp.com/lnurl/subscribe";

  metadata: {
    pubkey: string;
    tier: "cloud" | "teams";
    teamId?: string;
  };

  // Monthly renewal
  schedule: {
    interval: "monthly";
    amount: number; // Sats (converted from USD)
    nextPayment: number; // Unix timestamp
  };
}

// Subscription status check
interface SubscriptionStatus {
  pubkey: string;
  tier: "cloud" | "teams";
  status: "active" | "past_due" | "cancelled";
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;

  payments: {
    invoiceId: string;
    amount: number;
    currency: "BTC" | "sats";
    paidAt: number;
  }[];
}
```

---

## Security Considerations

### Key Leak Resilience

| Scenario                  | Protection                          | Recovery                                 |
| ------------------------- | ----------------------------------- | ---------------------------------------- |
| Individual nsec leaked    | NIP-59 limits exposure to that user | Rotate nsec, re-encrypt personal secrets |
| Team member key leaked    | MLS forward secrecy protects past   | Rotate epoch, re-encrypt team secrets    |
| MLS epoch key leaked      | Only that epoch's data at risk      | Automatic rotation on next operation     |
| Relay operator key leaked | Cannot decrypt user secrets         | Rotate relay signing key                 |
| SSO master seed leaked    | All enterprise users compromised    | Regenerate seed, rotate all derived keys |

### Defense in Depth

```
┌──────────────────────────────────────────────────────────────────┐
│                     Security Layers                               │
│                                                                   │
│  Layer 1: Transport (TLS 1.3)                                    │
│  └─ All relay connections encrypted in transit                  │
│                                                                   │
│  Layer 2: Protocol (NIP-59 Gift Wrap)                            │
│  └─ All secrets wrapped with ephemeral keys                     │
│  └─ Metadata (sender/time) hidden                               │
│                                                                   │
│  Layer 3: Content (NIP-44 Encryption)                            │
│  └─ ChaCha20-Poly1305 authenticated encryption                  │
│  └─ HKDF key derivation                                         │
│                                                                   │
│  Layer 4: Group (MLS/NIP-EE) [Teams]                             │
│  └─ Forward secrecy per epoch                                   │
│  └─ Post-compromise security                                    │
│  └─ Automatic rotation on membership change                     │
│                                                                   │
│  Layer 5: Storage (Encrypted at rest)                            │
│  └─ Relay storage encrypted with infrastructure keys            │
│  └─ Backups encrypted before upload                             │
│                                                                   │
│  Layer 6: Access Control (RBAC)                                  │
│  └─ Role-based permissions enforced cryptographically           │
│  └─ Audit log of all access                                     │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Cryptographic Primitives

| Primitive         | Usage                    | Standard        |
| ----------------- | ------------------------ | --------------- |
| secp256k1         | Nostr keys, signatures   | BIP-340 Schnorr |
| ChaCha20-Poly1305 | NIP-44 encryption        | RFC 8439        |
| HKDF-SHA256       | Key derivation           | RFC 5869        |
| X25519            | NIP-44 key exchange      | RFC 7748        |
| MLS               | Team group encryption    | RFC 9420        |
| HMAC-SHA256       | Token/webhook validation | RFC 2104        |

---

## Implementation Roadmap

### Phase 1: Cloud Tier (Q2 2025)

1. **BTCPay Server Setup**
   - Self-hosted BTCPay instance
   - Lightning node (LND/CLN)
   - Webhook integration

2. **Managed Relay**
   - Deploy relay cluster (3 nodes)
   - Implement access token validation
   - Set up backup pipeline

3. **Subscription Flow**
   - Payment page in web admin
   - Token issuance on payment
   - Renewal reminders

### Phase 2: Teams Tier (Q3 2025)

**Priority: Bunker Orchestrator + RBAC + MLS**

1. **Bunker Orchestrator** (HIGH PRIORITY)
   - Implement `BunkerOrchestrator` class
   - `nak` binary detection/download
   - Process lifecycle management
   - Health monitoring and alerts
   - CLI commands: `bunker start/stop/status/authorize/revoke`
   - systemd/Docker deployment configs

2. **MLS Implementation (NIP-EE)**
   - Integrate OpenMLS via WASM bindings
   - Implement NIP-EE event format
   - Build key rotation service
   - Design abstraction layer for potential protocol swap

3. **RBAC System**
   - 4 built-in roles: owner, admin, developer, readonly
   - Permission checking
   - Invitation flow
   - Team member onboarding/offboarding

4. **Audit Logging**
   - 90-day retention
   - Event generation
   - Encrypted storage
   - Query interface

5. **SAML SSO**
   - Okta integration
   - AzureAD integration
   - Google Workspace integration

### Phase 3: Enterprise Tier (Q4 2025)

**Priority: SSO Bridge (OIDC→Nostr) is critical path**

1. **SSO Bridge** (HIGHEST PRIORITY)
   - OIDC integration with major IdPs
   - Deterministic key derivation (HKDF)
   - HSM support for master seed storage
   - Session management
   - User provisioning/deprovisioning

2. **Advanced RBAC**
   - Custom roles
   - SCIM provisioning for user sync
   - OIDC group → Redshift role mapping

3. **Compliance Infrastructure**
   - SIEM log forwarding (Splunk, Datadog)
   - Unlimited audit log retention
   - 99.95% SLA monitoring

4. **On-Premise Package**
   - Docker Compose setup
   - Kubernetes Helm charts
   - Air-gapped deployment docs

5. **SOC2 Type II Preparation** (Q4 2025 - Q1 2026)
   - Security documentation
   - Penetration testing
   - Auditor engagement
   - Estimated cost: $75k-$150k+
   - **Note**: This is a significant investment; begin after Teams tier
     validated

---

## Telos Validation

### L9 (Telos-Guardian): Purpose Alignment

> "Does this serve user sovereignty?"

- **Cloud**: Users control encryption keys; we only store encrypted blobs
- **Teams**: MLS ensures no central authority can decrypt team secrets
- **Enterprise**: SSO bridge runs in customer enclave; we never touch their keys
- **Payments**: Bitcoin-only preserves financial sovereignty

**Verdict**: All tiers preserve user sovereignty.

### L8 (Market-Analyst): Business Sustainability

> "Does this create sustainable value?"

- **Cloud $5/mo**: Covers relay infrastructure at scale
- **Teams $20/seat**: Justifies MLS complexity and support
- **Enterprise custom**: High-touch sales covers development costs
- **Bitcoin payments**: Lower fees than card processors

**Verdict**: Revenue model is sustainable.

### L4 (Integration-Contractor): Protocol Compatibility

> "Do contracts remain stable?"

- **NIP-59**: Used unchanged for Cloud tier
- **NIP-EE**: New protocol for Teams - additive, not breaking
- **SSO Bridge**: Separate system, doesn't affect core protocols
- **BTCPay**: Industry-standard API

**Verdict**: No breaking changes to existing protocols.

### L1 (Syntax-Linter): Technical Feasibility

> "Is this implementable in Bun/TypeScript?"

- **MLS**: OpenMLS has WASM bindings
- **BTCPay**: REST API, straightforward integration
- **Cashu**: TypeScript libraries available
- **HSM**: PKCS#11 bindings exist

**Verdict**: All components implementable.

### Convergence

- **Top-down**: All features serve sovereignty while enabling monetization
- **Bottom-up**: Technical stack supports all requirements

**Decision**: Architecture approved. Proceed with implementation.

---

## Appendix: Nostr Event Kinds

| Kind  | Purpose                      | Tier                   |
| ----- | ---------------------------- | ---------------------- |
| 30078 | Encrypted secrets (existing) | All                    |
| 30079 | Audit logs                   | Teams/Enterprise       |
| 30080 | Team membership              | Teams/Enterprise       |
| 30081 | Access tokens                | Cloud/Teams/Enterprise |
| 30082 | MLS group state              | Teams                  |
| 30083 | MLS proposals/commits        | Teams                  |

## Appendix: API Endpoints

```
# Cloud
POST /api/subscribe          Create BTCPay invoice
POST /api/webhooks/btcpay    Handle payment events
GET  /api/subscription       Check subscription status

# Teams
POST /api/teams              Create team
POST /api/teams/:id/invite   Invite member
POST /api/teams/:id/remove   Remove member (triggers rotation)
GET  /api/teams/:id/audit    Query audit logs

# Enterprise
POST /api/sso/authorize      OIDC authorization
POST /api/sso/token          Exchange code for session
GET  /api/sso/keys/:email    Derive Nostr key (bridge only)

# Cashu
POST /api/cashu/redeem       Redeem token for access
GET  /api/cashu/mint         Get mint info
```
