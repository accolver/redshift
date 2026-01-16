# Redshift Relay

Managed Nostr relay for Redshift Cloud subscribers (`wss://relay.redshiftapp.com`).

This is a **specialized relay** for storing encrypted secrets (NIP-59 Gift Wrapped
NIP-78 Kind 30078 events). It is not a general-purpose social relay.

**Upstream:** [Spl0itable/nosflare](https://github.com/Spl0itable/nosflare) (included as git subtree)

---

## Quick Deploy

### Prerequisites

1. [Node.js](https://nodejs.org/) v18+
2. Cloudflare account (free tier works)
3. API token from [cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) with:
   - **Account**: Workers Scripts: Edit, D1: Edit
   - **Zone**: Workers Routes: Edit, DNS Settings: Edit

### Deploy

```bash
cd relay
./deploy.sh YOUR_CLOUDFLARE_API_TOKEN
```

The script will:
- Install dependencies and Wrangler CLI
- Create D1 database (if not exists)
- Configure `wrangler.toml` and `src/config.ts` for Redshift
- Build and deploy the worker

### Post-Deploy

1. Visit your relay URL to initialize the database
2. Add custom domain in Cloudflare Dashboard:
   - Workers & Pages → redshift-relay → Settings → Domains & Routes
   - Add: `relay.redshiftapp.com`

---

## Updating Nosflare

To pull upstream changes:

```bash
git subtree pull --prefix=relay/nosflare https://github.com/Spl0itable/nosflare.git main --squash
```

After updating, re-run `./deploy.sh` to apply Redshift configuration and redeploy.

---

## Troubleshooting

### "new_sqlite_classes migration" Error

If you see:
```
Failed to create worker: In order to use Durable Objects with a free plan,
you must create a namespace using a `new_sqlite_classes` migration.
```

Ensure your `wrangler.toml` has:
```toml
[[migrations]]
tag = "v4"
new_sqlite_classes = ["RelayWebSocket"]
```

**Not** `new_classes` (old syntax).

### Database Not Found

If the worker can't find the database, verify:
1. `database_id` in `wrangler.toml` matches the ID from `wrangler d1 create`
2. `database_name` matches what you created

### Authentication Issues

Verify your API token is set correctly:

```bash
# Check if token is set
echo $CLOUDFLARE_API_TOKEN

# Test authentication
wrangler whoami
```

If `wrangler whoami` fails, ensure your token has all required permissions:
- **Account**: Workers Scripts: Edit, D1: Edit
- **Zone**: Workers Routes: Edit, DNS Settings: Edit

Generate a new token at [cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) if needed.

---

## Relay Information

| Field | Value |
|-------|-------|
| **Name** | Redshift Cloud Relay |
| **Description** | Managed relay for Redshift Cloud subscribers. Encrypted secrets storage only. |
| **Contact** | support@redshiftapp.com |
| **Software** | Nosflare |
| **Privacy Policy** | https://redshiftapp.com/relay/privacy-policy |
| **Terms of Service** | https://redshiftapp.com/relay/terms-of-service |

---

## Rate Limiting

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Events per Minute per Pubkey** | 50 | Secrets management has low throughput needs |
| **REQ Messages per Minute** | 500 | Sufficient for syncing secrets |
| **Excluded Event Kinds** | 3, 10002 | Contact lists and relay lists bypass rate limits |

---

## Relay Limitations

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Max Message Length** | 524288 (512KB) | Standard, sufficient for encrypted secrets |
| **Max Subscriptions per Connection** | 100 | Secrets clients need few subscriptions |
| **Max Events per Query** | 1000 | Users won't have thousands of secrets |
| **Max Tags per Event** | 100 | Gift-wrapped events use minimal tags |
| **Max Content Length** | 70000 | Encrypted secrets can be large |
| **Minimum PoW Difficulty** | 0 | Disabled - using paid access instead |

---

## Supported NIPs

```
1, 9, 11, 33, 40, 42, 59, 78
```

| NIP | Name | Purpose |
|-----|------|---------|
| **1** | Basic Protocol | Core Nostr event structure and WebSocket communication |
| **9** | Event Deletion | Allows users to delete secrets |
| **11** | Relay Information | Exposes relay metadata, policies, supported NIPs |
| **33** | Parameterized Replaceable | Required for Kind 30078 addressable events |
| **40** | Expiration Timestamp | Used for 7-day audit log auto-deletion |
| **42** | Authentication | **Critical** - NIP-42 AUTH for paid relay access |
| **59** | Gift Wrap | The encryption wrapper (Kind 1059 outer events) |
| **78** | App Data | **Critical** - Kind 30078 stores secrets, tokens, audit logs |

> **Note**: If Nosflare requires additional NIPs internally (e.g., 12, 15, 16, 20),
> keep them. The above are the minimum Redshift-specific requirements.

---

## Payment Settings

| Setting | Value | Notes |
|---------|-------|-------|
| **Enable Pay-to-Relay** | Enabled | Uses Nosflare's built-in nostr-zap payments |
| **Access Price** | 12,121 sats | One-time Lightning payment for lifetime access |

> **Payment Flow**: Users visit the relay landing page, pay via nostr-zap (Lightning),
> and once confirmed, the relay URL is revealed and their pubkey is recorded for access.

---

## Spam Protection

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Enable Anti-Spam** | Yes | Hash event content to prevent duplicates |
| **Global Duplicate Check** | No | Each user's secrets are unique |
| **Require Valid NIP-05** | No | Not needed for paid authenticated relay |
| **Anti-Spam Event Kinds** | 30078, 1059 | Only check our event kinds |

---

## Access Control

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Require NIP-42 Authentication** | **Yes** | Essential for paid relay |
| **Blocked Pubkeys** | (empty) | Handle via access token validation |
| **Allowed Pubkeys** | (empty) | NIP-42 + token handles authorization |
| **Blocked NIP-05 Domains** | (empty) | Not using NIP-05 validation |
| **Allowed NIP-05 Domains** | (empty) | Not using NIP-05 validation |
| **Blocked Event Kinds** | (empty) | Use Allowed Event Kinds instead |
| **Allowed Event Kinds** | 30078, 1059 | Secrets (30078) + Gift Wrap outer (1059) |
| **Blocked Words/Phrases** | (empty) | Content is encrypted, filtering is useless |
| **Blocked Tags** | (empty) | Allow all tags |
| **Allowed Tags** | d, t, p, e, expiration | Required for NIP-78 addressable events |

### Allowed Event Kinds Explained

| Kind | NIP | Description |
|------|-----|-------------|
| **1059** | NIP-59 | Gift Wrap outer envelope (encrypted) |
| **30078** | NIP-78 | Arbitrary app data (secrets, tokens, audit logs) |

---

## Tag Configuration

### Required Tags

| Tag | Purpose |
|-----|---------|
| `d` | Addressable event identifier (NIP-33) |
| `t` | Type tag for filtering (`redshift-secrets`, `redshift-audit`, etc.) |
| `p` | Recipient pubkey reference |
| `e` | Event reference |
| `expiration` | NIP-40 expiration timestamp for audit logs |

### Redshift Type Tags

| Type Tag Value | Purpose |
|----------------|---------|
| `redshift-secrets` | Secret bundles |
| `redshift-cloud` | Access tokens |
| `redshift-audit` | Audit log entries |

---

## Environment Variables

These should be set in your Cloudflare Workers environment:

```bash
# Relay Identity
RELAY_NAME="Redshift Cloud Relay"
RELAY_DESCRIPTION="Managed relay for Redshift Cloud subscribers"
RELAY_CONTACT="support@redshiftapp.com"

# Policy URLs
PRIVACY_POLICY_URL="https://redshiftapp.com/relay/privacy-policy"
TERMS_OF_SERVICE_URL="https://redshiftapp.com/relay/terms-of-service"

# Access Control
REQUIRE_AUTH=true
ALLOWED_EVENT_KINDS="30078,1059"

# Rate Limiting
EVENTS_PER_MINUTE=50
REQ_PER_MINUTE=500

# Storage (Cloudflare R2)
R2_BUCKET_NAME="redshift-relay-events"
```

---

## Cloudflare Bindings

Configure these in `wrangler.toml`:

```toml
[vars]
RELAY_NAME = "Redshift Cloud Relay"

[[r2_buckets]]
binding = "EVENTS_BUCKET"
bucket_name = "redshift-relay-events"

[[durable_objects.bindings]]
name = "RELAY_STATE"
class_name = "RelayState"

[[kv_namespaces]]
binding = "ACCESS_TOKENS"
id = "xxx"
```

---

## Security Checklist

- [ ] NIP-42 authentication enabled
- [ ] Allowed Event Kinds restricted to 30078, 1059
- [x] Built-in pay-to-relay enabled (12,121 sats via Lightning)
- [ ] Rate limiting configured
- [ ] R2 bucket encryption at rest enabled
- [ ] Privacy Policy URL set
- [ ] Terms of Service URL set
- [ ] Relay operator keys stored securely (not in code)

---

## Related Documentation

- [CLOUD_TIER_PLAN.md](/CLOUD_TIER_PLAN.md) - Full Cloud tier implementation plan
- [design.md](/openspec/changes/add-cloud-pricing/design.md) - Architecture decisions
- [Privacy Policy](/web/src/routes/relay/privacy-policy/+page.svelte) - User-facing policy
- [Terms of Service](/web/src/routes/relay/terms-of-service/+page.svelte) - User-facing terms
