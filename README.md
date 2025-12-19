# Redshift

Decentralized, censorship-resistant secret management built on
[Nostr](https://nostr.com).

## Features

- **Client-side encryption** - Secrets never leave your device unencrypted
  (NIP-59 Gift Wrap)
- **Nostr-based** - Your keys, your data. No vendor lock-in
- **Doppler-compatible CLI** - Familiar commands like `redshift run`
- **Censorship-resistant** - Distributed across Nostr relays
- **Free & Open Source** - MIT licensed, self-host everything

## Quick Start

```bash
# Install CLI
curl -fsSL https://redshiftapp.com/install | sh

# Login with your Nostr identity
redshift login

# Set up a project (creates redshift.yaml)
redshift setup

# Add secrets
redshift secrets set API_KEY sk-xxx

# Run with secrets injected
redshift run -- npm start
```

### Project Setup

The `redshift setup` command creates a `redshift.yaml` file in your project
directory:

```yaml
project: my-project # Project slug (immutable, lowercase with hyphens)
environment: development # Environment slug
relays:
  - wss://relay.damus.io
```

You can also specify options directly:

```bash
redshift setup --project my-project --environment production
```

## Web Dashboard

Visit [redshiftapp.com/admin](https://redshiftapp.com/admin) to manage secrets
visually.

When creating a project in the web UI, you'll set:

- **Display Name** - Human-readable name (can be changed later)
- **Slug** - Immutable identifier used by the CLI (lowercase, hyphens only)

## Pricing

Redshift is **free and open source** for individual developers.

| Tier       | Price       | Features                                           |
| ---------- | ----------- | -------------------------------------------------- |
| Free       | $0          | Unlimited projects, CLI, web admin, any relay      |
| Cloud      | $5/month    | Managed relay, automatic backups, 7-day audit logs |
| Teams      | Coming soon | Team sharing, RBAC, SAML SSO                       |
| Enterprise | Coming soon | SSO Bridge, SCIM, SOC2 compliance                  |

Cloud subscriptions are paid with **Bitcoin** (on-chain or Lightning) via BTCPay
Server - no credit card or personal info required.

```bash
# Check your subscription status
redshift subscription status

# Upgrade to Cloud
redshift subscription upgrade
```

See [redshiftapp.com/pricing](https://redshiftapp.com/pricing) for details.

## Development

```bash
# Install dependencies
bun install
cd web && bun install

# Run CLI in dev mode
bun run dev

# Run web dev server
bun run dev:web

# Run tests
bun run test:all

# Build everything
bun run build:all
```

## Project Structure

```
redshift/
├── cli/               # CLI source code
├── web/               # SvelteKit web dashboard
├── packages/
│   ├── crypto/        # Shared NIP-59 Gift Wrap encryption
│   ├── cloud/         # Cloud tier access tokens & audit events
│   └── payments/      # BTCPay Server integration
├── dist/              # Built binaries
└── .github/           # CI/CD workflows
```

## Release

Releases are automated using
[Release Please](https://github.com/googleapis/release-please).

When you push commits to `main` with
[Conventional Commits](https://www.conventionalcommits.org/) format:

- `feat:` - New features (bumps minor version)
- `fix:` - Bug fixes (bumps patch version)
- `feat!:` or `BREAKING CHANGE:` - Breaking changes (bumps major version)

Release Please will automatically:

1. Create/update a release PR with changelog
2. When merged, create a GitHub release with tag
3. GitHub Actions builds binaries and attaches them to the release

### Manual Release (if needed)

```bash
# Prepare release (tests + builds)
bun run release:prepare

# Check built artifacts
bun run release:list
```

## Upgrading

```bash
# Check for updates and upgrade
redshift upgrade
```

## License

MIT
