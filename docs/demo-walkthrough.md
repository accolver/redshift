# Demo Walkthrough

This walkthrough shows the core Redshift loop: login, add a secret, inject it
into a command, and switch relays if a relay is unavailable.

The commands use the CLI from source so the demo works before installing a
release binary.

## Prerequisites

- Bun 1.x
- Network access to at least one configured Nostr relay
- A disposable Nostr `nsec` for demos

Install dependencies from the repository root and keep that path for later:

```bash
cd /path/to/redshift
bun install
export REDSHIFT_REPO="$PWD"
```

Create an isolated demo directory so your real Redshift config is untouched:

```bash
export DEMO_ROOT="$(mktemp -d)"
export REDSHIFT_CONFIG_DIR="$DEMO_ROOT/config"
mkdir -p "$DEMO_ROOT/app"
cd "$DEMO_ROOT/app"
```

## 1. Login

Generate a throwaway key and copy the printed `nsec` value:

```bash
cd "$REDSHIFT_REPO"
bun run generate:nsec
```

Log in with that key:

```bash
cd "$DEMO_ROOT/app"
bun "$REDSHIFT_REPO/cli/src/main.ts" login --nsec nsec1...
```

For CI-style demos, you can skip persistent login and export the key instead:

```bash
export REDSHIFT_NSEC='nsec1...'
```

## 2. Configure a Project

```bash
bun "$REDSHIFT_REPO/cli/src/main.ts" setup --project demo-app --config dev
```

Expected result: `redshift.yaml` appears in the current directory.

```yaml
project: demo-app
environment: dev
relays:
  - wss://relay.damus.io
  - wss://relay.primal.net
  - wss://nos.lol
  - wss://relay.nostr.band
```

## 3. Add and Read a Secret

```bash
bun "$REDSHIFT_REPO/cli/src/main.ts" secrets set API_KEY sk-demo-123
bun "$REDSHIFT_REPO/cli/src/main.ts" secrets get API_KEY --raw
```

Expected result: the `get` command prints `sk-demo-123`.

## 4. Inject the Secret into a Command

```bash
bun "$REDSHIFT_REPO/cli/src/main.ts" run -- printenv API_KEY
```

Expected result: the child command receives `API_KEY` and prints:

```text
sk-demo-123
```

## 5. Demonstrate Relay Failure and Switching

Relay availability is intentionally decoupled from Redshift. To show how a user
recovers from a bad relay, put an invalid relay first while keeping healthy
relays in the list:

```bash
cat > redshift.yaml <<'YAML'
project: demo-app
environment: dev
relays:
  - wss://invalid.redshift-demo.invalid
  - wss://relay.damus.io
  - wss://relay.primal.net
  - wss://nos.lol
YAML

bun "$REDSHIFT_REPO/cli/src/main.ts" run -- printenv API_KEY
```

If the command still succeeds, explain that Redshift can continue when another
configured relay has the encrypted bundle. Then switch to a known-good relay set:

```bash
cat > redshift.yaml <<'YAML'
project: demo-app
environment: dev
relays:
  - wss://relay.damus.io
  - wss://relay.primal.net
  - wss://nos.lol
  - wss://relay.nostr.band
YAML

bun "$REDSHIFT_REPO/cli/src/main.ts" run -- printenv API_KEY
```

For a global relay switch instead of a project-local switch:

```bash
bun "$REDSHIFT_REPO/cli/src/main.ts" configure set relays='["wss://relay.damus.io","wss://nos.lol"]'
bun "$REDSHIFT_REPO/cli/src/main.ts" configure get relays
```

Project `redshift.yaml` relays take precedence for commands run in that project.
Remove the `relays:` block to use global relays.

## 6. Optional Web Dashboard Demo

From the repository root:

```bash
bun run dev:web
```

Open the local URL printed by Vite, log in with a browser Nostr signer, and show
project/secret management visually. Use the CLI walkthrough above for the
reproducible scripted path.

## Cleanup

```bash
rm -rf "$DEMO_ROOT"
unset REDSHIFT_CONFIG_DIR REDSHIFT_NSEC REDSHIFT_REPO DEMO_ROOT
```

## Verified Commands

Run these from the repo root before a release or PR when time allows:

```bash
bun run build:web
bun run build:cli
bun run test:crypto
bun run test:cli
bun run test:web
```
