# Redshift Roadmap

## Current Status: MVP Complete

Redshift has achieved core functionality as a decentralized,
censorship-resistant secret management platform. The CLI and web admin are
functional, with comprehensive test coverage.

---

## Implementation Status

### Fully Implemented

| Category      | Features                                                                           |
| ------------- | ---------------------------------------------------------------------------------- |
| **CLI**       | `login`, `logout`, `setup`, `run`, `serve`, `secrets set/get/list/delete/download` |
| **Auth**      | NIP-07 browser extension, local NSEC, NIP-46 Bunker                                |
| **Protocol**  | NIP-59 Gift Wrap encryption, Kind 30078 events, NIP-09 deletion                    |
| **Web Admin** | Project list, secret editor, import/export, global search                          |
| **Pages**     | Landing page (`/`), docs (`/docs/*`), tutorial (`/tutorial`), admin (`/admin/*`)   |
| **Tests**     | 273 web tests, 311 CLI tests, crypto tests, relay integration tests (580+ total)   |
| **CI/CD**     | GitHub Actions: test, build, multi-platform release (Linux/macOS x64/arm64)        |

---

## Outstanding Work

### High Priority

| Feature                         | Description                                                                  | Status   |
| ------------------------------- | ---------------------------------------------------------------------------- | -------- |
| **Binary embeds SvelteKit app** | `redshift serve` serves the actual SvelteKit admin UI embedded in the binary | Complete |
| **`secrets upload` command**    | Import secrets from .env file via CLI: `redshift secrets upload [file]`      | Complete |

### Medium Priority

| Feature                          | Description                                                                                 | Status                       |
| -------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------- |
| **Interactive project fetching** | `setup` command should fetch existing projects from relays instead of manual input          | Partial (manual input works) |
| **Keychain storage**             | Store nsec in system keychain (macOS Keychain, Windows Credential Manager, Linux libsecret) | Complete                     |
| **Rate limiting for relays**     | Add rate limiting to relay queries to prevent abuse                                         | Complete                     |
| **Input validation**             | Validate secret keys, project IDs, environments, values, and relay URLs                     | Complete                     |
| **Improved error handling**      | Better error handling in relay operations (avoid swallowing errors)                         | Complete                     |

### Low Priority

| Feature                       | Description                                                          | Status                        |
| ----------------------------- | -------------------------------------------------------------------- | ----------------------------- |
| **svelte-motion animations**  | Enhanced animations for page transitions, lists, and UI feedback     | Partial (dashboard, projects) |
| **Binary integration test**   | TDD Phase 4: spawn binary and test HTTP response                     | Not started                   |
| **Remove duplicate code**     | Remove duplicate `injectSecrets` from parser.ts (use secret-manager) | Complete                      |
| **CLI command tests: run.ts** | Add unit tests for `run` command                                     | Complete                      |
| **CLI command tests: serve**  | Add unit tests for `serve` command                                   | Complete                      |
| **CLI command tests: setup**  | Add unit tests for `setup` command                                   | Complete                      |
| **TypeScript strict types**   | Fix exactOptionalPropertyTypes errors in types.ts and related files  | Complete                      |

---

## Implementation Plans

### Keychain Storage (Complete)

**Goal:** Store nsec securely in OS keychain instead of plaintext config file.

**Technology Choice:** `Bun.secrets` (native Bun API)

- Zero dependencies, works with `bun build --compile`
- Cross-platform: macOS Keychain, Windows Credential Manager, Linux libsecret
- Memory-safe: zeros out password memory after use
- Actively maintained by Bun team

**Service Configuration:**

- Service: `com.redshiftapp.cli`
- Name: `nsec`

**Behavior:**

1. `login` command stores nsec to keychain when available
2. `logout` command clears nsec from keychain
3. On keychain failure, falls back to file-based config (`~/.redshift/config`)
4. Warning shown when using file fallback (less secure)

**Platform Support:**

- macOS: Keychain Services
- Windows: Windows Credential Manager
- Linux: libsecret (GNOME Keyring, KWallet, etc.)

**Implementation:**

- `cli/src/lib/keychain.ts` - Abstraction over `Bun.secrets`
- `cli/tests/lib/keychain.test.ts` - 8 tests for keychain operations
- Updated `login.ts`, `config.ts` for keychain-first credential storage

---

## Monetization Strategy

### Philosophy: Sovereignty First, Convenience Second

Redshift's monetization aligns with its core mission of **user sovereignty**.
The principle is simple:

> **Core functionality is always free. We monetize convenience and
> collaboration, never access to your own secrets.**

This approach ensures:

1. **No lock-in**: Users can always self-host and use any Nostr relay
2. **No feature gating**: CLI and web admin remain fully functional at $0
3. **Sustainable development**: Paid tiers fund ongoing development
4. **Aligned incentives**: We succeed when users succeed, not when they're
   trapped

### Tier Structure

#### Tier 0: Free Forever (Individuals)

**Cost: $0**

Everything an individual developer needs:

- Unlimited projects and secrets
- Unlimited environments
- Full CLI and web admin
- All authentication methods (NIP-07, NSEC, Bunker)
- Use any Nostr relay (public or self-hosted)
- Export/import in any format

**Why free?** Sovereignty means owning your secrets. We can't charge for what's
already yours. This tier uses the decentralized Nostr network—we have no
infrastructure costs to pass on.

#### Tier 1: Redshift Cloud ($5/month)

**Value: Reliability without maintenance**

- Managed high-availability relay optimized for secret storage
- Automatic nightly encrypted backups (S3/R2)
- 99.9% uptime SLA
- Geographic redundancy

**Why paid?** Running reliable infrastructure costs money. Users pay for
convenience, not capability. Free users can achieve the same reliability by
self-hosting—we just make it effortless.

**Sovereignty preserved:** Backups remain encrypted with your keys. We cannot
read your secrets. You can export and leave anytime.

#### Tier 2: Teams ($20/user/month)

**Value: Secure collaboration**

- Multi-user access with cryptographic sharing (NIP-04 group encryption)
- Role-based access control (Admin, Developer, Read-only)
- Automatic key rotation when team members leave
- Audit logging
- Shared project management

**Why paid?** Team coordination requires additional infrastructure: invitation
flows, permission management, key rotation services. These features don't exist
in base Nostr.

**Sovereignty preserved:** Team secrets are encrypted to team members' keys. No
central authority can access them. If you leave Redshift Teams, export your
secrets and continue using the free tier.

#### Tier 3: Enterprise (Custom Pricing)

**Value: Compliance and integration**

- SSO bridge: OIDC-to-Nostr (Okta, AzureAD, etc.)
- On-premise relay deployment
- Custom SLA and dedicated support
- Compliance documentation (SOC 2, etc.)

**Why paid?** Enterprise features require significant development and support
resources. SSO integration bridges the gap between corporate identity systems
and Nostr's key-based identity.

**Sovereignty preserved:** SSO bridge runs in customer's enclave. The bridge
unlocks session-specific keys; corporate IdP never touches secrets. On-premise
deployment means secrets never leave your infrastructure.

### Monetization Principles

These principles are enforced by the Telos Guardian (L9) and cannot be violated:

1. **CLI remains fully free** - No premium commands or paywalled features
2. **Self-hosting always works** - Paid tiers add convenience, not capability
3. **No telemetry or analytics** - We never track usage patterns
4. **Export always available** - Users can leave with their data anytime
5. **Client-side encryption only** - We never have access to decrypt secrets

### Revenue Sustainability

| Tier       | Target Segment         | Est. Users | Monthly Revenue |
| ---------- | ---------------------- | ---------- | --------------- |
| Free       | Individual devs        | 10,000     | $0              |
| Cloud      | Solo professionals     | 500        | $2,500          |
| Teams      | Startups (avg 5 users) | 50 teams   | $5,000          |
| Enterprise | Companies              | 5          | $10,000+        |

**Break-even estimate**: ~$5,000/month covers infrastructure and part-time
development.

### What We Will Never Do

Per the Telos Guardian's ethical constraints:

- **Never paywall secret access** - Your secrets are yours
- **Never implement backdoors** - Not even for "enterprise" features
- **Never collect telemetry** - Usage data could identify users
- **Never require our relay** - Free tier works with any Nostr relay
- **Never prevent export** - Data portability is non-negotiable

---

## Telos Validation

This roadmap has been validated against the Telos hierarchy:

### L9 (Telos-Guardian): Purpose Alignment

> "Does this serve user sovereignty?"

- **Free tier**: Users control their secrets with zero dependencies
- **Paid tiers**: Add convenience without compromising control
- **No lock-in**: Export works at every tier

### L8 (Market-Analyst): Business Sustainability

> "Does this create sustainable value?"

- Free tier drives adoption through Doppler-compatible DX
- Paid tiers monetize infrastructure and collaboration needs
- Competitive positioning: "Doppler features, sovereign by default"

### Convergence

Both validation flows agree:

- **Top-down**: Monetization serves sovereignty (convenience, not access)
- **Bottom-up**: Technical architecture supports all tiers without compromise

---

## Next Steps

1. **Q1**: Complete high-priority items (binary embedding, secrets upload)
2. **Q2**: Launch Redshift Cloud (Tier 1) with managed relay
3. **Q3**: Teams features (Tier 2) - multi-user, RBAC
4. **Q4**: Enterprise SSO bridge (Tier 3)

---

## Contributing

Redshift is open source. Core functionality will always remain free and
auditable. Contributions welcome at
[github.com/accolver/redshift](https://github.com/accolver/redshift).

The monetization tiers fund development while preserving the project's
sovereignty-first mission. If you benefit from Redshift, consider the paid tiers
not as a requirement, but as a way to support continued development.
