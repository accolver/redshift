---
name: redshift
description: Manages application secrets with the Redshift CLI — decentralized, encrypted secret management built on Nostr. Use when setting, getting, deleting, listing, uploading, downloading, backing up, inspecting authenticated history, comparing versions, or restoring secrets; recovering partial relay publications; injecting secrets into commands; configuring projects/environments; or authenticating with Nostr keys. Covers redshift login, setup, secrets, history, backup, recovery, run, configure, serve, and upgrade.
---

# Redshift CLI

Decentralized secret management via the `redshift` CLI. Secrets are client-side
encrypted (NIP-59 Gift Wrap) and stored on Nostr relays — no central server.

Docs: https://redshiftapp.com/docs

## Key concepts

- **Project** (`-p`): a project slug (e.g. `backend`, `myapp`)
- **Config/Environment** (`-c`): an environment slug (e.g. `dev`, `staging`,
  `production`)
- **redshift.yaml**: per-directory project config created by `redshift setup`
- When `-p`/`-c` are omitted, Redshift reads from `redshift.yaml` in the current
  directory

## Security considerations

- Never pass secret values directly on the command line in shared/logged
  environments — prefer `redshift secrets set` interactively or pipe from stdin
- Use `REDSHIFT_NSEC` / `REDSHIFT_BUNKER` env vars for CI/CD rather than CLI
  flags
- Avoid `redshift serve --host 0.0.0.0` unless you intend to expose the web UI
  to the network — default `127.0.0.1` is localhost-only
- All encryption is client-side; secrets never leave the device unencrypted
- Private keys are stored in the system keychain, not in plaintext config files
- Backup passphrases must use hidden prompts or explicit `--passphrase-stdin`; never put them in argv, config, or environment variables

## Authentication

```bash
redshift login                    # Interactive (recommended)
redshift login --nsec nsec1...    # Direct private key (use env var in CI instead)
redshift login --bunker-stdin       # NIP-46 one-time pairing URI via hidden input
redshift login --connect          # Generate NostrConnect URI for bunker app
redshift login --overwrite        # Overwrite existing credentials
redshift me                       # Check current identity (alias: whoami)
redshift logout                   # Clear credentials
redshift logout                # Clear credentials without confirmation
```

CI/CD: set `REDSHIFT_NSEC` or `REDSHIFT_BUNKER` env vars instead of
`redshift login`. Store these in your CI platform's secret management (e.g.
GitHub Actions secrets), never hardcoded.

## Project setup

```bash
redshift setup                                  # Interactive
redshift setup -p myapp -c production           # Non-interactive
redshift setup --no-interactive -p app -c dev   # Strict non-interactive (errors if project/config missing)
```

Creates `redshift.yaml` with project, environment, and relay list.

## Secrets

```bash
# List/get (redacted unless --raw is explicit)
redshift secrets
redshift secrets --raw
redshift secrets --json
redshift secrets get API_KEY
redshift secrets get API_KEY --raw

# One validated mutation per invocation
redshift secrets set API_KEY sk_live_xxx
redshift secrets delete OLD_KEY

# Plaintext .env portability
redshift secrets download ./secrets.env --raw
redshift secrets upload .env
```

Override project/environment on any secrets command with `-p` / `-c`:

```bash
redshift secrets -p backend -c production --raw
redshift secrets set -p myapp -c staging FEATURE_FLAG true
```

## Relay publication recovery

When a mutation reports degraded redundancy or fails below quorum, inspect the owner-only local record and retry the exact signed encrypted event. Never create a replacement event automatically.

```bash
redshift recovery list
redshift recovery show <event-id>
redshift recovery retry <event-id>   # unavailable relays only
redshift recovery remove <event-id>  # local notice only; does not delete relay data
```

Recovery is not a backup, history, cryptographic erasure, or an availability guarantee.

## Encrypted local backup

```bash
redshift backup create secrets.redshift
redshift backup restore secrets.redshift
redshift backup restore secrets.redshift --allow-identity-change
redshift backup restore secrets.redshift --allow-identity-change --overwrite
```

The archive contains current logical state observed from responding configured relays. It excludes signer credentials, relay config, history/tombstones, and recovery files. Default restore performs no writes on conflicts; identical state is a no-op. Each restored bundle uses normal quorum and exact-event recovery, but the multi-bundle operation is not globally atomic.

## Authenticated history

```bash
redshift history list --project my-app --config production
redshift history compare <from-event-id> <to-event-id> --project my-app --config production
redshift history restore <event-id> --project my-app --config production --yes
```

History output contains event/timestamp/tombstone/key metadata only, never values. Results are bounded state observed from responding relays, not a complete audit log. Restore publishes the selected complete bundle or tombstone as a newer event and aborts if refreshed current state changed; `--overwrite-current` is an explicit override but cannot provide Nostr compare-and-swap.

Never claim this is automatic/managed/offsite retention, complete relay history, key recovery, RPO/RTO, availability, or an SLA.

## Run with secrets injected

**Important:** Only run commands the user has explicitly requested. Never
construct arbitrary commands to pass to `redshift run`. Always confirm the
command with the user before executing.

```bash
redshift run -- npm start
redshift run -- python app.py
redshift run --command "npm start && npm test"
redshift run -p myapp -c prod -- docker-compose up

# Preserve existing env values for specific keys
redshift run --preserve-env PORT,HOST -- npm start
```

## Configuration

```bash
redshift configure                        # Show config
redshift configure --all                  # Show all saved options
redshift configure get relays             # Get specific value
redshift configure set relays=wss://r.x   # Set value
redshift configure unset defaultProject   # Remove value
redshift configure reset --yes            # Reset to initial state
# Allowed keys: relays, defaultProject, defaultEnvironment
```

## Web UI

```bash
redshift serve                        # http://127.0.0.1:3000 (localhost only)
redshift serve --port 8080 --open     # Custom port, auto-open browser
redshift serve --host 0.0.0.0         # Exposes to network — use with caution
```

## Self-update

```bash
redshift upgrade                      # Update to latest version
redshift upgrade --force              # Force reinstall even if current
redshift upgrade --tag v0.5.0         # Install specific version
```

## Global flags

| Flag           | Short | Description                       |
| -------------- | ----- | --------------------------------- |
| `--help`       | `-h`  | Show help                         |
| `--version`    | `-v`  | Show version                      |
| `--json`       |       | JSON output where supported       |
| `--config-dir` |       | Override config dir (~/.redshift) |

## Environment variables

| Variable              | Description                                        |
| --------------------- | -------------------------------------------------- |
| `REDSHIFT_NSEC`       | Private key for CI/CD (bypasses interactive login) |
| `REDSHIFT_BUNKER`     | NIP-46 bunker URL for CI/CD (alternative to nsec)  |
| `REDSHIFT_CONFIG_DIR` | Override config directory (default: ~/.redshift)   |

## Important notes

- Always quote bunker URLs (`--bunker "bunker://..."`) — shell interprets `&`
  otherwise
- Secret values with spaces or special chars should be quoted
- Complex values (objects/arrays) are auto-JSON-stringified when injected by
  `redshift run`
- Exit codes: 0 = success, 1 = general error, 2 = auth required, 3 = project/env
  not configured
