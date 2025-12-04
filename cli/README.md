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
redshift login --bunker <bunker-url>        # NIP-46 remote signer
redshift login --connect                    # Generate NostrConnect QR
redshift login --force                      # Re-authenticate
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
redshift setup --project myapp --environment production
redshift setup --force                      # Reconfigure
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
redshift run -- docker-compose up
```

Complex values (objects/arrays) are automatically JSON-stringified.

### `redshift secrets`

Manage secrets for the current project/environment.

```bash
# List all secrets
redshift secrets list
redshift secrets list --raw          # Show values (not redacted)
redshift secrets list --format json  # Output as JSON
redshift secrets list --format env   # Output as .env format

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

### `redshift serve`

Start the web administration UI.

```bash
redshift serve                    # Default: http://127.0.0.1:3000
redshift serve --port 8080
redshift serve --host 0.0.0.0     # Allow network access
redshift serve --open             # Open browser automatically
```

## NIP-46 Bunker Authentication

Redshift supports
[NIP-46](https://github.com/nostr-protocol/nips/blob/master/46.md) remote
signing, allowing you to authenticate without exposing your private key
directly.

### Using a Bunker URL

If you have a bunker running (e.g., Amber, nsec.app, or `nak bunker`), it will
display a `bunker://` URL. Copy that URL and pass it to the login command:

```bash
redshift login --bunker "bunker://pubkey?relay=wss://relay.example&secret=xxx"
```

> **Important**: Always wrap the bunker URL in **quotes**! The `&` and other
> special characters will be interpreted by your shell otherwise, causing errors
> like `zsh: no matches found`.

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

# Login with the bunker URL
redshift login --bunker "bunker://..."
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

For nsec authentication:

```json
{
  "authMethod": "nsec",
  "nsec": "nsec1...",
  "relays": ["wss://relay.damus.io", "wss://nos.lol"],
  "defaultProject": "my-project"
}
```

For bunker authentication:

```json
{
  "authMethod": "bunker",
  "bunker": {
    "bunkerPubkey": "abc123...",
    "relays": ["wss://relay.example"],
    "secret": "optional-secret",
    "clientSecretKey": "hex-encoded-key"
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

# Terminal 3: Test login
REDSHIFT_CONFIG_DIR=/tmp/redshift-test bun run dev -- login --bunker "bunker://..."

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
