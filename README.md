# Redshift

Decentralized, censorship-resistant secret management built on
[Nostr](https://nostr.com). Learn more at [redshiftapp.com](https://redshiftapp.com).

## Features

- **Client-side encryption** - Secrets never leave your device unencrypted
  (NIP-59 Gift Wrap)
- **Nostr-based** - Your keys, your data. No vendor lock-in
- **Doppler-inspired CLI** - Familiar workflows such as `redshift run`, with Redshift's documented command contract
- **Censorship-resistant** - Distributed across Nostr relays

## Public Roadmap

- [Grant roadmap and project brief](docs/grants/README.md)
- [Technical roadmap](ROADMAP.md)

## Installation

The verified installer supports Linux and macOS on x64 and arm64 and requires a
current [GitHub CLI](https://cli.github.com/). It verifies the selected release's
GitHub build-provenance attestations, exact source commit, and checksums before
installation. Certified release v0.14.2 passed native installation and lifecycle
verification on all four supported targets. Windows is not currently supported.

```bash
curl -fsSL https://redshiftapp.com/install | sh
```

The default destination is `~/.local/bin/redshift`. If that directory is not in
`PATH`, the installer prints the required shell configuration. See
[`piolium/v0.14.2-production-readiness-evidence.md`](piolium/v0.14.2-production-readiness-evidence.md)
for current release evidence. The original bounded-history certification remains in
[`piolium/authenticated-secret-history-evidence.md`](piolium/authenticated-secret-history-evidence.md).

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

If a write reaches quorum but not every configured relay, Redshift reports degraded redundancy and
preserves the exact encrypted event for unavailable-only retry:

```bash
redshift recovery list
redshift recovery retry <event-id>
```

This recovery record is not a backup or a relay-data deletion mechanism.

Create a user-controlled encrypted snapshot of current logical state observed from responding configured relays, then restore it under an authenticated signer:

```bash
redshift backup create secrets.redshift
redshift backup restore secrets.redshift
# Explicitly authorize migration when the target signer differs:
redshift backup restore secrets.redshift --allow-identity-change
```

Passphrases are entered through hidden prompts or explicit `--passphrase-stdin`; they are never accepted through argv, config, or an environment variable. Archives exclude signer credentials, relay configuration, history, tombstones, and publication-recovery files. Default restore performs no writes on a conflicting destination; use `--overwrite` only after reviewing the conflict.

Inspect bounded owner-authenticated versions, compare key metadata without values, and explicitly restore a complete historical bundle or logical tombstone as a new event:

```bash
redshift history list --project my-app --config production
redshift history compare <from-event-id> <to-event-id> --project my-app --config production
redshift history restore <event-id> --project my-app --config production --yes
```

History is observed from responding configured relays and may be incomplete or truncated. Restore refreshes current state and aborts if it changed unless `--overwrite-current` is also explicitly supplied; Nostr still provides no compare-and-swap guarantee.

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

## Architecture and demo

- [Architecture overview](docs/architecture.md)
- [Disposable end-to-end demo walkthrough](docs/demo-walkthrough.md)

## Security

Read Redshift's [security and threat model](SECURITY.md) for details on what
client-side encryption protects, what metadata remains visible, and which
operational risks users still need to manage.

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
- Encrypted local backup is a user-initiated snapshot, not automatic/offsite retention or key recovery. Restore publishes new target-authorized state and may be partially complete across multiple bundles; each publication keeps normal quorum and recovery behavior.

The individual CLI and dashboard are the supported product surfaces. Authenticated bounded history/compare/restore shipped in certified v0.14.0. It remains relay-observed, bounded, and potentially incomplete—not retained history, an audit log, offline recovery, compare-and-swap, or an availability guarantee. Teams, shared-secret collaboration, managed backup/retention guarantees, and enterprise controls remain roadmap work and are not production claims.

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

# Deterministic required and extended fuzz/property suites
bun run test:fuzz
bun run test:fuzz:extended
# Replay controls: REDSHIFT_FUZZ_SEED, REDSHIFT_FUZZ_RUNS,
# REDSHIFT_FUZZ_TIME_MS, and REDSHIFT_FUZZ_PATH

# Browser E2E (install once, then run)
cd web && bunx playwright install chromium && bun run test:e2e

# Build everything
bun run build:all
```

See [docs/fuzz-testing.md](docs/fuzz-testing.md) for bounded run modes, CI behavior,
and exact seed/path replay instructions.

## Project Structure

```
redshift/
├── cli/              # CLI source code
├── web/              # SvelteKit web dashboard
├── packages/crypto/  # Shared NIP-59 Gift Wrap encryption
├── dist/             # Built binaries
└── .github/          # CI/CD workflows
```

## Funding Showcase

Review the draft funding package in
[docs/funding-showcase.md](docs/funding-showcase.md), including release
checklist, demo outline, architecture summary, threat model, install links,
roadmap, and funding ask.

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
2. When merged, create an immutable release tag and draft GitHub release
3. GitHub Actions verifies tests and browser journeys on the compiled binary
4. Native Linux/macOS runners build and smoke-test each platform binary
5. Publish checksums, an SPDX SBOM, provenance attestations, and binaries

Certified v0.14.2 release evidence records these release controls and the
supported native installation matrix.

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
