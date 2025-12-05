# Redshift

Decentralized, censorship-resistant secret management built on
[Nostr](https://nostr.com).

## Features

- **Client-side encryption** - Secrets never leave your device unencrypted
- **Nostr-based** - Your keys, your data. No vendor lock-in
- **Doppler-compatible CLI** - Familiar commands like `redshift run`
- **Censorship-resistant** - Distributed across Nostr relays

## Quick Start

```bash
# Install CLI
curl -fsSL https://redshiftapp.com/install | sh

# Login with your Nostr identity
redshift login

# Set up a project
redshift setup

# Add secrets
redshift secrets set API_KEY sk-xxx

# Run with secrets injected
redshift run -- npm start
```

## Web Dashboard

Visit [redshiftapp.com/admin](https://redshiftapp.com/admin) to manage secrets
visually.

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
├── cli/          # CLI source code
├── web/          # SvelteKit web dashboard
├── dist/         # Built binaries
└── .github/      # CI/CD workflows
```

## Release

```bash
# Bump version
bun run version:bump patch

# Prepare release (tests + builds)
bun run release:prepare

# Tag and push
git tag v0.1.1
git push --tags
```

GitHub Actions will automatically build binaries and create a release.

## License

MIT
