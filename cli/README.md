# Redshift CLI

Decentralized, censorship-resistant secret management CLI with
Doppler-compatible commands.

## Installation

```bash
# Build from source
bun build cli/src/main.ts --compile --outfile dist/redshift

# Or run directly
bun run cli/src/main.ts
```

## Quick Start

```bash
# 1. Login with your Nostr identity
redshift login

# 2. Configure your project
redshift setup

# 3. Set some secrets
redshift secrets set API_KEY sk_live_xxx
redshift secrets set DEBUG true

# 4. Run your app with secrets injected
redshift run -- npm start
```

## Commands

### `redshift login`

Authenticate with your Nostr identity. Supports multiple methods:

```bash
redshift login                              # Interactive (choose method)
redshift login --nsec nsec1...              # Direct private key
redshift login --bunker-stdin               # NIP-46 one-time pairing URI (hidden input)
redshift login --connect                    # Generate NostrConnect QR
redshift login --overwrite                  # Re-authenticate
```

**CI/CD**: Set `REDSHIFT_NSEC` or `REDSHIFT_BUNKER` environment variable.

### `redshift logout`

Clear stored credentials.

```bash
redshift logout
```

### `redshift setup`

Configure project and environment for the current directory.

```bash
redshift setup                              # Interactive
redshift setup -p myapp -c production       # Non-interactive
redshift setup --project myapp --config dev # Full flags
```

Creates `redshift.yaml`:

```yaml
project: myapp
environment: production
relays:
  - wss://relay.damus.io
  - wss://nos.lol
```

### `redshift run -- <command>`

Run a command with secrets injected into the environment.

```bash
redshift run -- npm start
redshift run -- python app.py
redshift run --command "npm start && npm test"  # Alternative syntax
redshift run -p myapp -c prod -- docker-compose up
```

Complex values (objects/arrays) are automatically JSON-stringified.

Use `redshift run --help` to see the supported execution and environment options.

### `redshift secrets`

Manage secrets for the current project/environment.

```bash
# List all secrets
redshift secrets                     # Default: list all secrets
redshift secrets --raw               # Show values (not redacted)
redshift secrets --json              # Output as JSON
redshift secrets -p myapp -c prod    # Override project/config

# Get a specific secret
redshift secrets get API_KEY
redshift secrets get API_KEY --raw   # Output raw value (for piping)

# Set a secret
redshift secrets set API_KEY sk_live_xxx
redshift secrets set PORT 3000
redshift secrets set FEATURES '{"new_ui": true}'  # JSON values

# Delete a secret
redshift secrets delete OLD_KEY

# Download as .env file
redshift secrets download > .env
```

### `redshift recovery`

Inspect and complete encrypted events that reached only part of the configured relay set.
Redshift writes the exact signed event before the first network attempt, so retry never creates a
conflicting logical version.

```bash
redshift recovery list
redshift recovery show <event-id>
redshift recovery retry <event-id>   # Same owner; unavailable relays only
redshift recovery remove <event-id>  # Removes only the local notice
```

Recovery records live under `~/.redshift/recovery/` (or `REDSHIFT_CONFIG_DIR`) in
owner-only files. They contain encrypted relay ciphertext and publication metadata—never the nsec,
bunker key, passphrase, or decrypted secret. A permanently rejected relay remains visible until the
record is explicitly removed. Recovery is not a backup and cannot erase ciphertext retained by a
relay.

### `redshift backup`

Create a versioned, passphrase-encrypted local snapshot of the latest authenticated non-tombstoned state observed from responding configured relays:

```bash
redshift backup create secrets.redshift
redshift backup create secrets.redshift --force
printf '%s\n%s\n' "$PASSPHRASE" "$PASSPHRASE" \
  | redshift backup create secrets.redshift --passphrase-stdin
```

Restore requires a separately authenticated target signer. A different signer must be explicitly authorized, and conflicting live bundles require explicit overwrite:

```bash
redshift backup restore secrets.redshift
redshift backup restore secrets.redshift --allow-identity-change
redshift backup restore secrets.redshift --allow-identity-change --overwrite
printf '%s\n' "$PASSPHRASE" \
  | redshift backup restore secrets.redshift --passphrase-stdin
```

Archives are atomic owner-only files and contain encrypted current secret state plus project/environment identifiers and source version evidence. They exclude nsec/bunker/keychain credentials, passphrases, relay configuration, raw events, recovery records, tombstones, and history. Passphrases are never accepted through argv, config, or environment variables.

Default restore preflights all bundles and performs zero writes if live destination values conflict. Identical bundles are no-ops; `--overwrite` replaces a full bundle without merging destination-only keys. Multi-bundle restore is not globally atomic, but every attempted bundle uses normal publication quorum and exact-event recovery.

This is user-initiated local portability—not automatic, managed, offsite, retained, or complete-relay backup; not key/account recovery; and not an RPO/RTO, availability, or SLA guarantee.

### `redshift history`

List bounded owner-authenticated state observed from responding configured relays, compare key metadata without printing values, or restore one exact version:

```bash
redshift history list --project my-app --config production
redshift history list --limit 20 --cursor <cursor> --json
redshift history compare <from-event-id> <to-event-id> --project my-app --config production
redshift history restore <event-id> --project my-app --config production --yes
```

Versions use authenticated inner timestamps and deterministic event-ID ties; NIP-59 outer timestamps do not order state. Empty versions are logical tombstones, not cryptographic erasure. Restore republishes the complete selected bundle as a strictly newer owner-authorized event through normal quorum and exact-event recovery. It refreshes current state immediately before publication and aborts on change; `--overwrite-current` is a second explicit authorization, not compare-and-swap. Relay retention may be incomplete, and fixed observation/version limits are reported as truncation.

This command never prints secret values. Decrypted history remains ephemeral in the dashboard and is not an audit log, retained/offline backup, managed history, RPO/RTO, or SLA guarantee.

### `redshift serve`

Start the web administration UI.

```bash
redshift serve                    # Default: http://127.0.0.1:3000
redshift serve --port 8080
redshift serve --host 0.0.0.0     # Allow network access
redshift serve --open             # Open browser automatically
```

### `redshift configure`

View and modify CLI configuration.

```bash
redshift configure                # Show current configuration
redshift configure --all          # Show all saved options
redshift configure get project    # Get specific option
redshift configure set project=myapp
redshift configure unset project
redshift configure reset --yes    # Reset to initial state
```

### `redshift me` / `redshift whoami`

Get info about the currently authenticated entity.

```bash
redshift me                       # Show auth info
redshift whoami                   # Alias
redshift me --json                # JSON output
```

### `redshift upgrade`

Update the Redshift CLI to the latest version.

```bash
redshift upgrade                  # Upgrade to latest
redshift upgrade --force          # Force reinstall
redshift upgrade --tag v0.3.0     # Install specific version
```

## Global Flags

These flags work with any command:

| Flag           | Short | Description               |
| -------------- | ----- | ------------------------- |
| `--help`       | `-h`  | Show help for command     |
| `--version`    | `-v`  | Show CLI version          |
| `--json`       |       | Output JSON format        |
| `--config-dir` |       | Override config directory |

## NIP-46 Bunker Authentication

Redshift supports
[NIP-46](https://github.com/nostr-protocol/nips/blob/master/46.md) remote
signing, allowing you to authenticate without exposing your private key
directly.

### Using a Bunker URL

If you have a bunker running (e.g., Amber, nsec.app, or `nak bunker`), it will
display a one-time `bunker://` URL. Paste that URL through hidden input so its
`secret=` value never appears in the process list:

```bash
redshift login --bunker-stdin
```

The `--bunker` flag accepts only secret-free restoration pointers. For
non-persistent CI authentication, provide `REDSHIFT_BUNKER` to the command that
needs access.

### Using NostrConnect (Client-Initiated)

Generate a `nostrconnect://` URI that your bunker app can scan:

```bash
redshift login --connect
```

This displays a URI you can paste into your bunker app (e.g., Amber, nsec.app).

### Starting a Test Bunker

For development/testing, use `nak` to run a local bunker:

```bash
# Generate a test key
TEST_KEY=$(nak key generate)

# Start local relay
nak serve --port 10547

# Start bunker (in another terminal)
nak bunker --sec $TEST_KEY ws://localhost:10547
# Note the bunker:// URL printed

# Login, then paste the bunker URL at the hidden prompt
redshift login --bunker-stdin
```

## Architecture

```
cli/
├── src/
│   ├── main.ts              # CLI entry point
│   ├── commands/
│   │   ├── parser.ts        # Argument parser
│   │   ├── login.ts         # Login command (nsec + bunker)
│   │   ├── setup.ts         # Setup command
│   │   ├── run.ts           # Run command
│   │   ├── secrets.ts       # Secrets command
│   │   └── serve.ts         # Serve command
│   └── lib/
│       ├── bunker.ts        # NIP-46 bunker support
│       ├── config.ts        # Config management
│       ├── crypto.ts        # NIP-59 encryption
│       ├── relay.ts         # Nostr relay communication
│       ├── secret-manager.ts # Secret operations
│       └── types.ts         # Type definitions
└── tests/
    ├── commands/
    │   └── parser.test.ts
    ├── crypto/
    │   └── crypto.test.ts
    ├── integration/
    │   └── relay-integration.test.ts
    └── lib/
        ├── config.test.ts
        ├── relay.test.ts
        └── secret-manager.test.ts
```

## Cryptography

All secrets are encrypted using NIP-59 (Gift Wrap) before being stored on Nostr
relays:

- **End-to-end encryption**: Only the owner (nsec holder) can decrypt
- **Metadata protection**: Gift Wrap hides sender/recipient information
- **Replaceable events**: Updates use the same d-tag, relays keep latest

```typescript
import { decodeNsec, unwrapSecrets, wrapSecrets } from "./lib/crypto";

const privateKey = decodeNsec("nsec1...");
const { event } = await wrapSecrets(
  { API_KEY: "secret" },
  privateKey,
  "proj|env",
);
const secrets = await unwrapSecrets(event, privateKey);
```

## Configuration

### Global Config (`~/.redshift/config.json`)

For nsec authentication, config stores only the selected method; the nsec remains in the OS keychain:

```json
{
  "authMethod": "nsec",
  "relays": ["wss://relay.damus.io", "wss://nos.lol"],
  "defaultProject": "my-project"
}
```

For bunker authentication, config stores only the public restoration pointer. The client key remains in the OS keychain and one-time pairing secrets are discarded:

```json
{
  "authMethod": "bunker",
  "bunker": {
    "bunkerPubkey": "abc123...",
    "relays": ["wss://relay.example"]
  },
  "relays": ["wss://relay.damus.io"]
}
```

### Project Config (`redshift.yaml`)

```yaml
project: my-project
environment: production
relays:
  - wss://custom.relay
```

## Environment Variables

| Variable              | Description                             |
| --------------------- | --------------------------------------- |
| `REDSHIFT_NSEC`       | Private key for CI/CD (bypasses login)  |
| `REDSHIFT_BUNKER`     | Bunker URL for CI/CD (alternative)      |
| `REDSHIFT_CONFIG_DIR` | Override config directory (~/.redshift) |

## Development

```bash
# Run CLI in dev mode
bun run dev

# Run unit tests
bun test cli/tests/crypto cli/tests/commands cli/tests/lib

# Run integration tests (requires local relay)
bun test cli/tests/integration

# Type check
bun run typecheck

# Lint
bun run lint
```

## Testing

### Unit Tests

Run all unit tests (no network required):

```bash
bun test cli/tests/crypto cli/tests/commands cli/tests/lib
```

### Integration Tests

Integration tests require a local Nostr relay. Install
[nak](https://github.com/fiatjaf/nak):

```bash
# Install nak (if not already installed)
go install github.com/fiatjaf/nak@latest
```

Run integration tests:

```bash
# Terminal 1: Start local relay
nak serve --port 10547

# Terminal 2: Run tests
bun test cli/tests/integration/relay-integration.test.ts
```

Or test with public relays (may be rate-limited):

```bash
TEST_RELAYS=public bun test cli/tests/integration/relay-integration.test.ts
```

### Testing Bunker Authentication

```bash
# Terminal 1: Start local relay
nak serve --port 10547

# Terminal 2: Start test bunker
nak bunker --sec $(nak key generate) ws://localhost:10547
# Copy the bunker:// URL from output

# Terminal 3: Test login, then paste the bunker URL at the hidden prompt
REDSHIFT_CONFIG_DIR=/tmp/redshift-test bun run dev -- login --bunker-stdin

# Verify config was saved
cat /tmp/redshift-test/config.json
```

### Full Integration Test

```bash
# Terminal 1: Start local relay
nak serve --port 10547

# Terminal 2: Run full test
REDSHIFT_CONFIG_DIR=/tmp/redshift-test bun run dev -- login --nsec $(nak encode nsec $(nak key generate))
REDSHIFT_CONFIG_DIR=/tmp/redshift-test bun run dev -- setup --project test --environment dev
REDSHIFT_CONFIG_DIR=/tmp/redshift-test bun run dev -- secrets set API_KEY test123
REDSHIFT_CONFIG_DIR=/tmp/redshift-test bun run dev -- secrets list --raw
REDSHIFT_CONFIG_DIR=/tmp/redshift-test bun run dev -- run -- echo "API_KEY is \$API_KEY"
```

## Test Coverage

- **89 unit tests** covering:
  - CLI argument parsing (Doppler-compatible)
  - NIP-59 Gift Wrap encryption/decryption
  - NIP-09 deletion events
  - Key validation with bech32 checksum
  - Config loading/saving (nsec + bunker)
  - Secret injection
  - Relay filtering and d-tag resolution

- **10 integration tests** covering:
  - Relay connectivity
  - Publishing and fetching secrets
  - Secret updates (newer timestamp wins)
  - D-tag isolation between projects
  - Tombstone (logical deletion)
  - Complex nested objects
  - Project and environment listing
