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

Log in interactively so the private key is read through the hidden-input path rather than exposed in the process list or shell history:

```bash
cd "$DEMO_ROOT/app"
bun "$REDSHIFT_REPO/cli/src/main.ts" login
```

Select local nsec login and paste the disposable key at the hidden prompt. For an isolated non-interactive demo, you can skip persistent login and export the throwaway key for only the current shell:

```bash
export REDSHIFT_NSEC='nsec1...'
```

Never use a production identity for this walkthrough, and unset the variable during cleanup.

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

Expected result: the `get` command prints `sk-demo-123` after an explicit warning that `--raw` reveals plaintext. Keep the walkthrough terminal and its logs disposable.

## 4. Inject the Secret into a Command

```bash
bun "$REDSHIFT_REPO/cli/src/main.ts" run -- printenv API_KEY
```

Expected result: the child command receives `API_KEY` and prints:

```text
sk-demo-123
```

## 5. Demonstrate Relay Failure and Switching

Relay availability is intentionally decoupled from Redshift. To show how a read
can tolerate one unavailable relay, put an invalid relay first while retaining
enough healthy relays to observe the previously published bundle:

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

If the command still succeeds, explain that Redshift can continue when responding
configured relays hold the encrypted bundle. This is not proof of complete relay
retention or an availability SLA. Then switch to a known-good relay set:

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

Run the aggregate production gate from the repository root before a release:

```bash
bun run test:production
```

For ordinary development, run the full package suite with `bun run test:all`.
Release publication additionally requires the repository's native installed-artifact workflow.
