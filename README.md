# Redshift

Decentralized, censorship-resistant secret management built on
[Nostr](https://nostr.com). Learn more at [redshiftapp.com](https://redshiftapp.com).

## Features

- **Client-side encryption** - Secrets never leave your device unencrypted
  (NIP-59 Gift Wrap)
- **Nostr-based** - Your keys, your data. No vendor lock-in
- **Doppler-inspired CLI** - Familiar workflows such as `redshift run`, with Redshift's documented command contract
- **Censorship-resistant** - Distributed across Nostr relays

## Installation

The hardened release installer targets Linux and macOS and requires a current
[GitHub CLI](https://cli.github.com/). It fails closed unless the binary has a
GitHub build-provenance attestation from Redshift's release workflow and exact
release source commit. These controls are prepared for the next release; the
currently published `v0.10.0` predates them, so build from source until a newer
attested release is published and independently verified.

```bash
# Use after an attested post-v0.10.0 release is published
curl -fsSL https://redshiftapp.com/install | sh

# Current safe path: build from source
git clone https://github.com/accolver/redshift.git
cd redshift && bun install --frozen-lockfile
bun run build
install -m 0755 dist/redshift ~/.local/bin/redshift
```

### OpenClaw Skill

If you use [OpenClaw](https://openclaw.ai), install the Redshift skill for
natural-language secret management:

```bash
clawhub install redshift
```

## Quick Start

```bash

# Login with your Nostr identity
redshift login

# Set up a project (creates redshift.yaml)
redshift setup

# Add secrets
redshift secrets set API_KEY sk-xxx

# Values are redacted unless plaintext output is explicitly acknowledged
redshift secrets get API_KEY
redshift secrets get API_KEY --raw

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

### Relay configuration

Inspect active global relays with `redshift configure relays`. Set custom global
relays with:

```bash
redshift configure set relays='["wss://relay.damus.io","wss://nos.lol"]'
```

Project-specific `redshift.yaml` relays take precedence over global relays. See
[relay resilience and NIP-78 security](docs/relay-resilience-and-nip78-security.md)
for authorization, deletion, privacy, quorum, and availability tradeoffs.

## Web Dashboard

Visit [redshiftapp.com/admin](https://redshiftapp.com/admin) to manage secrets
visually.

When creating a project in the web UI, you'll set:

- **Display Name** - Human-readable name (can be changed later)
- **Slug** - Immutable identifier used by the CLI (lowercase, hyphens only)

## Security and deletion semantics

- A decrypted Gift Wrap is accepted only when its recipient, seal author, and
  inner rumor author all match the authenticated Redshift identity.
- Writes succeed after a majority of the configured relay set accepts the exact
  signed event. A partial success below quorum is reported as a failure.
- Deleting a secret, environment, or project publishes a newer encrypted empty
  bundle (a logical tombstone). This removes the item from current Redshift
  state; it does **not** cryptographically erase older ciphertext retained by a
  relay, cache, or backup.
- NIP-09 cannot erase Redshift Gift Wraps because their outer events are signed
  by ephemeral keys. Redshift uses NIP-09 only where the authenticated author
  owns the event being deleted, such as project metadata.
- `--raw` and `secrets download --raw` intentionally reveal plaintext. Keep
  their stdout out of CI logs, shell history, and captured terminals.

The individual CLI and dashboard are the supported product surfaces. Teams,
shared-secret history/restore, managed backup guarantees, and enterprise
controls remain roadmap work and are not production claims.

## Development

```bash
# Install dependencies
bun install
cd web && bun install

# Run CLI in dev mode
bun run dev

# Run web dev server
bun run dev:web

# Run tests (CLI integration requires nak on PATH)
bun run test:all
cd relay/nosflare && bun test

# Browser E2E (install once, then run)
cd web && bunx playwright install chromium && bun run test:e2e

# Build everything
bun run build:all
```

## Project Structure

```
redshift/
├── cli/              # CLI source code
├── web/              # SvelteKit web dashboard
├── packages/crypto/  # Shared NIP-59 Gift Wrap encryption
├── dist/             # Built binaries
└── .github/          # CI/CD workflows
```

## Release

Releases are automated using
[Release Please](https://github.com/googleapis/release-please).

When you push commits to `main` with
[Conventional Commits](https://www.conventionalcommits.org/) format:

- `feat:` - New features (bumps minor version)
- `fix:` - Bug fixes (bumps patch version)
- `feat!:` or `BREAKING CHANGE:` - Breaking changes (bumps major version)

The hardened release workflow is configured to:

1. Create/update a release PR with changelog
2. When merged, create a GitHub release with tag
3. GitHub Actions verifies tests and browser journeys on the compiled binary
4. Native Linux/macOS runners build and smoke-test each platform binary
5. Publish checksums, an SPDX SBOM, provenance attestations, and binaries

These are workflow capabilities in the unreleased hardening change, not evidence
that older public releases contain those assets.

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
