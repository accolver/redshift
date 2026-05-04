# Redshift

Decentralized, censorship-resistant secret management built on
[Nostr](https://nostr.com). Learn more at [redshiftapp.com](https://redshiftapp.com).

Redshift gives developers a Doppler-compatible workflow while keeping secrets
client-side encrypted. Relays store only NIP-59 Gift Wrapped events; your keys
stay with you.

## Features

- **Client-side encryption** - secrets never leave your device unencrypted
  (NIP-59 Gift Wrap)
- **Nostr-based storage** - use public or managed relays without vendor lock-in
- **Doppler-compatible CLI** - familiar commands like `redshift run`
- **Web dashboard** - browser-based project and secret management
- **Relay resilience** - configure multiple relays and switch when one fails

## Install the CLI

```bash
# Install latest release
curl -fsSL https://redshiftapp.com/install | sh

# Verify
redshift --version
```

Build from source instead:

```bash
git clone https://github.com/accolver/redshift.git
cd redshift
bun install
bun run build:cli
./dist/redshift --version
```

## Quick Start

```bash
# 1. Log in with a Nostr identity
redshift login

# 2. Create redshift.yaml for this app
redshift setup --project my-project --config dev

# 3. Add a secret to the current project/environment
redshift secrets set API_KEY sk-test-123

# 4. Run a command with secrets injected
redshift run -- printenv API_KEY
```

`redshift setup` writes a local `redshift.yaml`:

```yaml
project: my-project
environment: dev
relays:
  - wss://relay.damus.io
  - wss://relay.primal.net
  - wss://nos.lol
  - wss://relay.nostr.band
```

The CLI reads project settings from `redshift.yaml` and auth/global relay
settings from `~/.redshift/config.json`. For isolated tests or demos, set
`REDSHIFT_CONFIG_DIR` to a temporary directory.

## Web Dashboard

Use the hosted dashboard at
[redshiftapp.com/admin](https://redshiftapp.com/admin), or run it locally:

```bash
bun install
bun run dev:web
# open the local URL printed by Vite
```

The web app supports browser-based Nostr login (for example, NIP-07 extensions)
and uses the same shared crypto package as the CLI.

## Local Development

Prerequisite: [Bun](https://bun.sh) 1.x. The repo is a Bun workspace with the CLI,
web app, and shared packages.

```bash
# Install all workspace dependencies
bun install

# Run the CLI from source
bun run dev -- --help
bun run dev -- login

# Run the web app
bun run dev:web

# Build
bun run build:web
bun run build:cli
bun run build

# Test/check
bun run test:crypto
bun run test:cli
bun run test:web
bun run test:all
bun run typecheck:web
bun run lint
```

## Documentation

- [CLI reference](cli/README.md)
- [Architecture](docs/architecture.md)
- [Demo walkthrough](docs/demo-walkthrough.md)
- [Relay deployment](relay/README.md)
- [OpenClaw skill](skills/redshift/SKILL.md)

## Project Structure

```text
redshift/
├── cli/                  # Bun CLI source and tests
├── web/                  # SvelteKit web dashboard and tests
├── packages/crypto/      # Shared NIP-59, Nostr, and .env helpers
├── packages/rate-limiter/# Shared relay rate limiting/backoff helpers
├── relay/                # Managed Redshift relay deployment assets
├── docs/                 # Architecture, demos, and plans
└── dist/                 # Local build output
```

## OpenClaw Skill

If you use [OpenClaw](https://openclaw.ai), install the Redshift skill for
natural-language secret management:

```bash
clawhub install redshift
```

## Upgrading

```bash
redshift upgrade
```

## Release

Releases are automated with
[Release Please](https://github.com/googleapis/release-please). Use
[Conventional Commits](https://www.conventionalcommits.org/) on `main`:

- `feat:` - new features, minor version
- `fix:` - bug fixes, patch version
- `feat!:` or `BREAKING CHANGE:` - major version

Manual release preparation:

```bash
bun run release:prepare
bun run release:list
```

## License

MIT
