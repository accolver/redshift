# Manual Testing Guide

Comprehensive manual test plan for Redshift — a decentralized secret manager
built on Nostr. This guide covers every user-facing feature across the CLI, web
admin, teams/bunker server, and security controls.

**Audience:** Developers, QA testers, and contributors validating Redshift
before a release or after significant changes.

**Estimated time:** 2-3 hours for full pass, 15-20 minutes for smoke tests
(Section 1A).

## Table of Contents

- [Smoke Tests (Quick Sanity)](#1a-smoke-tests-quick-sanity)
- [1. Authentication](#1-authentication)
- [2. Project Setup](#2-project-setup)
- [3. Secrets Management (CLI)](#3-secrets-management-cli)
- [4. Run Command](#4-run-command)
- [5. Configuration](#5-configuration)
- [6. Local Web Admin Server](#6-local-web-admin-server)
- [7. Web Application](#7-web-application)
- [8. Teams (CLI)](#8-teams-cli)
- [9. Bunker Server](#9-bunker-server)
- [10. Upgrade](#10-upgrade)
- [11. Global Flags](#11-global-flags)
- [12. Error Handling](#12-error-handling)
- [13. Security Verification](#13-security-verification)
- [14. Pricing Tier Behavior](#14-pricing-tier-behavior)
- [15. Automated Test Suites](#15-automated-test-suites)
- [16. Troubleshooting](#16-troubleshooting)
- [17. Pass/Fail Criteria](#17-passfail-criteria)

## Glossary

| Term          | Meaning                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **NIP**       | Nostr Implementation Possibility — a numbered protocol specification (see [nostr-nips](https://github.com/nostr-protocol/nips)) |
| **NIP-07**    | Browser extension signer interface (e.g., nos2x, Alby)                                                                          |
| **NIP-46**    | Remote signer (bunker) protocol for delegated key operations                                                                    |
| **NIP-59**    | Gift Wrap — double-encrypted event wrapper for private messaging                                                                |
| **NIP-98**    | HTTP Auth — signing HTTP requests with Nostr keys                                                                               |
| **nsec**      | Nostr secret key (bech32-encoded private key)                                                                                   |
| **npub**      | Nostr public key (bech32-encoded public key)                                                                                    |
| **Gift Wrap** | NIP-59 encryption envelope — secrets are stored as encrypted Gift Wrap events on relays                                         |
| **d-tag**     | Nostr event tag used for addressable events; Redshift format: `{projectId}\|{environment}`                                      |
| **RBAC**      | Role-Based Access Control — owner/admin/developer/readonly                                                                      |

---

## 1A. Smoke Tests (Quick Sanity)

Run these first. If any fail, stop and investigate before running the full
suite. Estimated time: 15-20 minutes.

```sh
# Build
bun run build:cli

# Auth round-trip
redshift login --nsec nsec1<your-test-key>
redshift me
redshift logout --yes

# Project + secrets round-trip
redshift login --nsec nsec1<your-test-key>
mkdir /tmp/smoke-test && cd /tmp/smoke-test
redshift setup --project smoke-test --config dev
redshift secrets set SMOKE_KEY smoke_value
redshift secrets get SMOKE_KEY --plain
redshift secrets delete SMOKE_KEY --yes

# Run command
redshift secrets set SMOKE_RUN hello
redshift run -- printenv SMOKE_RUN

# Web build
cd /path/to/redshift && bun run build:web

# Automated tests
cd packages/bunker && bun test
cd cli && bun test
cd web && bun run test
```

- [ ] Login succeeds, `me` shows npub, logout clears auth
- [ ] Setup creates `redshift.yaml`, secrets set/get/delete work
- [ ] `run` injects secret as env var
- [ ] All automated test suites pass
- [ ] Both builds succeed

---

## Prerequisites

```sh
# Build the CLI
bun run build:cli

# Or run directly via bun during development
alias redshift="bun run cli/src/main.ts"

# Generate a test keypair (save the nsec output)
bun -e "
  const { generateSecretKey } = require('nostr-tools/pure');
  const { nsecEncode, npubEncode } = require('nostr-tools/nip19');
  const { getPublicKey } = require('nostr-tools/pure');
  const sk = generateSecretKey();
  console.log('nsec:', nsecEncode(sk));
  console.log('npub:', npubEncode(getPublicKey(sk)));
  console.log('hex pubkey:', getPublicKey(sk));
"
```

Keep the nsec and npub handy — you'll use them throughout this guide.

---

## 1. Authentication

### 1.1 Login with nsec (direct)

```sh
redshift login --nsec nsec1<your-test-key>
```

- [ ] Prints `✓ Logged in successfully!` with npub
- [ ] Warns about nsec being visible in process listings
- [ ] Config file created at `~/.redshift/config.json` with permissions `0600`
- [ ] Config directory has permissions `0700`

### 1.2 Login with nsec (interactive)

```sh
redshift login
```

- [ ] Shows menu: (1) Enter nsec directly, (2) Connect via bunker URL, (3)
      Generate NostrConnect QR
- [ ] Select option 1
- [ ] Input is hidden (no echo)
- [ ] Accepts valid nsec, rejects invalid input
- [ ] Stores in system keychain when available (macOS Keychain / Linux
      secret-service)

### 1.3 Login with bunker URL

```sh
redshift login --bunker "bunker://pubkey?relay=wss://relay.example.com"
```

- [ ] Connects to the bunker relay
- [ ] Stores client secret key in keychain
- [ ] Shows authenticated npub
- [ ] Subsequent commands use bunker for signing/encryption

### 1.4 Login with NostrConnect

```sh
redshift login --connect
```

- [ ] Generates `nostrconnect://` URI
- [ ] Displays the URI (for pasting into a bunker app)
- [ ] Waits up to 120 seconds for connection
- [ ] Times out gracefully if no connection received

### 1.5 Overwrite existing auth

```sh
# Login first
redshift login --nsec nsec1<key1>
# Try to login again without --overwrite
redshift login --nsec nsec1<key2>
```

- [ ] Second login warns that auth already exists
- [ ] With `--overwrite` flag, replaces existing auth

### 1.6 View current auth

```sh
redshift me
redshift whoami          # alias
redshift me --json
```

- [ ] Shows auth method, npub, source (keychain/config/env)
- [ ] `--json` outputs structured JSON
- [ ] When not logged in, shows "Not logged in" message

### 1.7 Logout

```sh
redshift logout
```

- [ ] Prompts for confirmation
- [ ] With `--yes` flag, skips confirmation
- [ ] Clears credentials from keychain and config file
- [ ] `redshift me` shows "Not logged in" afterward

### 1.8 Login revoke

```sh
redshift login revoke
```

- [ ] Same behavior as `redshift logout`

### 1.9 Environment variable auth

```sh
REDSHIFT_NSEC=nsec1<key> redshift me
```

- [ ] Env var takes highest priority over config/keychain
- [ ] Shows source as "env" in `redshift me` output

```sh
REDSHIFT_BUNKER="bunker://pubkey?relay=wss://relay.example.com" redshift me
```

- [ ] Bunker env var works for remote signing auth

---

## 2. Project Setup

### 2.1 Interactive setup

```sh
mkdir /tmp/test-project && cd /tmp/test-project
redshift setup
```

- [ ] Authenticates first (prompts login if not logged in)
- [ ] Fetches existing projects from relays
- [ ] Shows numbered list of projects + "Create new project" option
- [ ] Shows environment options (dev, staging, prod, or custom)
- [ ] Creates `redshift.yaml` in current directory

### 2.2 Non-interactive setup

```sh
redshift setup --project my-app --config dev
redshift setup --project my-app --environment staging  # --environment is alias for --config
```

- [ ] Creates `redshift.yaml` with specified values
- [ ] `--no-interactive` flag exits with error if project/config not specified

### 2.3 Verify project config

```sh
cat redshift.yaml
```

- [ ] Contains `project`, `environment`, and `relays` keys
- [ ] Relay URLs are valid `wss://` URLs

---

## 3. Secrets Management (CLI)

> Requires: logged in + project setup (redshift.yaml in cwd)

### 3.1 Set a secret

```sh
redshift secrets set API_KEY sk-test-12345
redshift secrets set DB_URL=postgres://localhost:5432/mydb
```

- [ ] Shows `✓ Set API_KEY in project/environment`
- [ ] Accepts both `KEY VALUE` and `KEY=VALUE` syntax
- [ ] Values with `=` signs work:
      `redshift secrets set CONN="host=localhost port=5432"`

### 3.2 List secrets

```sh
redshift secrets
redshift secrets --raw
redshift secrets --only-names
redshift secrets --json
```

- [ ] Default: table with KEY and VALUE columns, values show `****`
- [ ] `--raw`: shows actual values (truncated to 50 chars)
- [ ] `--only-names`: shows only key names
- [ ] `--json`: outputs `{ "KEY": "value", ... }`

### 3.3 Get a specific secret

```sh
redshift secrets get API_KEY
redshift secrets get API_KEY DB_URL         # multiple keys
redshift secrets get API_KEY --plain
redshift secrets get NONEXISTENT_KEY
redshift secrets get NONEXISTENT_KEY --no-exit-on-missing-secret
```

- [ ] Shows key-value pair
- [ ] `--plain` prints raw value without formatting
- [ ] Missing key exits with error (exit code 1)
- [ ] `--no-exit-on-missing-secret` continues without error

### 3.4 Delete a secret

```sh
redshift secrets delete API_KEY
redshift secrets delete API_KEY --yes       # skip confirmation
```

- [ ] Prompts for confirmation
- [ ] `--yes` skips confirmation
- [ ] Secret is removed from the bundle

### 3.5 Upload from .env file

```sh
echo 'KEY1=value1
KEY2="value2"
# comment line
KEY3=value with spaces' > /tmp/test.env

redshift secrets upload /tmp/test.env
```

- [ ] Parses .env format (comments, quotes, escapes)
- [ ] Shows summary: new keys, overwritten keys
- [ ] Merges with existing secrets (doesn't delete keys not in file)

### 3.6 Download secrets

```sh
redshift secrets download
redshift secrets download secrets.json
redshift secrets download --format env
redshift secrets download --format json --no-file
redshift secrets download --format yaml
```

- [ ] Default: writes `secrets.json` to current directory
- [ ] Custom filename works
- [ ] Formats: `json`, `env`, `yaml`, `docker`, `env-no-quotes`
- [ ] `--no-file` prints to stdout
- [ ] `--passphrase` encrypts the file

### 3.7 Override project/environment

```sh
redshift secrets --project other-project --config staging
redshift secrets -p other-project -c staging               # short flags
```

- [ ] Uses specified project/environment instead of redshift.yaml values

### 3.8 Team-scoped secrets (not yet wired)

> **Status: Blocked** — The `--team` flag is parsed but not fully wired to the
> bunker backend. Full team-scoped secret operations require Phase 8 (Web UI)
> and Phase 11 (Integration). Currently only logs that the flag was received.

```sh
redshift secrets --team my-team
redshift secrets -t my-team
```

- [ ] Logs `Using team: my-team`
- [ ] Does NOT yet read/write secrets via the bunker (expected — pending future
      phase)

---

## 4. Run Command

> Requires: logged in + project setup

### 4.1 Basic command injection

```sh
redshift run -- env | grep API_KEY
redshift run -- printenv API_KEY
redshift run --command "echo \$API_KEY"
```

- [ ] Secrets injected as environment variables
- [ ] Child process has access to all project secrets
- [ ] Status messages go to stderr, child stdout is clean

### 4.2 Mount secrets to file

```sh
redshift run --mount /tmp/secrets.json -- cat /tmp/secrets.json
redshift run --mount /tmp/secrets.env --mount-format env -- cat /tmp/secrets.env
```

- [ ] Creates ephemeral file at specified path
- [ ] `REDSHIFT_CLI_SECRETS_PATH` env var set to the mount path
- [ ] JSON format: `{ "KEY": "value" }`
- [ ] Env format: `KEY="value"`
- [ ] File is cleaned up after child process exits

### 4.3 Fallback file (offline mode)

```sh
# First run — creates fallback
redshift run --fallback /tmp/fallback.json -- echo "online"

# Simulate offline — use fallback
redshift run --fallback-only --fallback /tmp/fallback.json -- printenv API_KEY
```

- [ ] `--fallback <path>`: writes secrets to fallback file, reads from it if
      relay offline
- [ ] `--fallback-only`: skips relay entirely, reads from fallback file
- [ ] `--fallback-readonly`: doesn't update the fallback file
- [ ] `--no-fallback`: disables fallback file entirely

### 4.4 Preserve existing environment

```sh
API_KEY=local-override redshift run --preserve-env API_KEY -- printenv API_KEY
```

- [ ] Prints `local-override` (env value takes precedence over Redshift secret)

### 4.5 Signal forwarding

```sh
redshift run -- sleep 60
# In another terminal: kill -SIGINT <redshift-pid>
```

- [ ] SIGINT/SIGTERM forwarded to child process
- [ ] Child process terminates, redshift exits with child's exit code

### 4.6 Clean fallback files

```sh
redshift run clean
```

- [ ] Deletes old/stale fallback files

---

## 5. Configuration

### 5.1 View config

```sh
redshift configure
redshift configure --all
redshift configure get
redshift configure get relays defaultProject
```

- [ ] Shows config directory, auth method, default project, relays
- [ ] `--all` shows full JSON config
- [ ] `get` with args shows specific keys

### 5.2 Set config values

```sh
redshift configure set defaultProject=my-app
redshift configure set relays='["wss://relay.damus.io","wss://nos.lol"]'
redshift configure set bunkerUrl=https://bunker.example.com
```

- [ ] Allowed keys: `relays`, `defaultProject`, `defaultEnvironment`,
      `bunkerUrl`
- [ ] JSON values parsed correctly (arrays, objects)
- [ ] String values stored as-is

### 5.3 Blocked config keys

```sh
redshift configure set nsec=nsec1...
redshift configure set authMethod=nsec
```

- [ ] Rejects sensitive keys with "Use 'redshift login' instead" message
- [ ] Blocked keys: `nsec`, `bunker`, `authMethod`, `clientSecretKey`

### 5.4 Unset config values

```sh
redshift configure unset defaultProject
```

- [ ] Removes the key from config

### 5.5 Reset all config

```sh
redshift configure reset --yes
```

- [ ] Clears all config and auth
- [ ] Without `--yes`, prompts for confirmation

### 5.6 Custom config directory

```sh
redshift --config-dir /tmp/test-redshift me
REDSHIFT_CONFIG_DIR=/tmp/test-redshift redshift me
```

- [ ] Uses specified directory instead of `~/.redshift`
- [ ] Both flag and env var work

---

## 6. Local Web Admin Server

> Requires: logged in (`redshift login`)

### 6.1 Start the server

```sh
redshift serve
redshift serve --port 8080 --host 0.0.0.0
redshift serve --open                       # opens browser
```

- [ ] Starts on port 3000 by default
- [ ] Shows URL in output
- [ ] `--open` opens browser to the URL
- [ ] `Ctrl+C` shuts down cleanly

### 6.2 API endpoints

```sh
curl http://localhost:3000/api/health
curl http://localhost:3000/api/info
```

- [ ] `/api/health` returns `{ "status": "ok" }`
- [ ] `/api/info` returns version, address, redacted npub

### 6.3 Security headers

```sh
curl -v http://localhost:3000/ 2>&1 | grep -i "x-frame\|content-security\|x-content-type"
```

- [ ] `X-Frame-Options: DENY`
- [ ] `Content-Security-Policy` header present
- [ ] `X-Content-Type-Options: nosniff`

### 6.4 Origin validation

```sh
curl -H "Origin: https://evil.com" http://localhost:3000/api/health
```

- [ ] Rejects requests from non-localhost origins

---

## 7. Web Application

### 7.1 Public pages

Open each in a browser:

- [ ] `/` — Landing page loads, install command visible, feature cards displayed
- [ ] `/pricing` — All tiers shown (Free, Cloud, Teams, Enterprise)
- [ ] `/docs` — Documentation hub accessible
- [ ] `/docs/quickstart` — Quickstart guide loads
- [ ] `/docs/cli` — CLI reference with all commands
- [ ] `/blog` — Blog listing loads

### 7.2 Authentication (web)

Navigate to `/admin`:

- [ ] **NIP-07 extension**: If browser extension installed (nos2x, Alby),
      auto-detects and connects
- [ ] **nsec login**: Click login, enter nsec, authenticates
- [ ] **Session persistence**: Refresh page, still authenticated
- [ ] **Logout**: Clears session, returns to login prompt

### 7.3 Dashboard

After authenticating, navigate to `/admin`:

- [ ] Shows all projects as cards (or empty state if none exist)
- [ ] "New Project" button opens creation modal
- [ ] Create a project: enter name, select environment, confirm
- [ ] CLI Quick Reference section shown with copy-to-clipboard commands
- [ ] Relay status indicator visible in header

### 7.4 Secrets management (web)

Navigate to a project/environment:

- [ ] **View secrets**: Table of KEY/VALUE pairs displayed
- [ ] **Masked values**: Values show masked by default
- [ ] **Reveal values**: Click eye icon or "Show All" to unmask
- [ ] **Search**: Type in search box, filters secrets by key name (fuzzy match)
- [ ] **Sort**: Sort by A-Z, Z-A, Newest, Oldest
- [ ] **Add secret**: Type key/value in the "Add Secret" row, click add
- [ ] **Edit inline**: Click a value to edit it in place
- [ ] **Key formatting**: Keys auto-uppercase, only alphanumeric + underscore
- [ ] **Save changes**: Click "Save" button, all dirty secrets are saved
- [ ] **Dirty indicator**: Modified rows show visual indicator before saving
- [ ] **Delete secret**: Click delete icon on a row, confirm
- [ ] **Copy to clipboard**: Click copy icon, value copied
- [ ] **Clipboard auto-clear**: After 30 seconds, clipboard is cleared (verify
      via paste)

### 7.5 Multi-environment operations

- [ ] **Switch environment**: Use environment dropdown to change
- [ ] **Add environment**: Create new environment via dropdown
- [ ] **Missing secrets**: Shows secrets that exist in other environments but
      not the current one
- [ ] **Multi-env save**: When saving, prompted to select which environments to
      apply changes to
- [ ] **Delete environment**: Via "..." menu, only allowed if more than one
      environment exists

### 7.6 Import/Export

- [ ] **Export**: "..." menu > Export, choose format (JSON/env/yaml), downloads
      file
- [ ] **Import**: "..." menu > Import, upload .env or JSON file
- [ ] **Import merge mode**: Merges imported secrets with existing (doesn't
      delete extras)
- [ ] **Import replace mode**: Replaces all secrets with imported ones

### 7.7 Global search

- [ ] `Cmd+K` / `Ctrl+K` opens search dialog
- [ ] Search across all projects and secrets
- [ ] Click result navigates to that project/secret
- [ ] URL highlight: navigating to `?highlight=KEY` scrolls to and highlights
      that key

### 7.8 Project management

- [ ] **Delete project**: Via "..." menu, confirms, navigates to dashboard
- [ ] **Project switching**: Via breadcrumb dropdown

---

## 8. Teams (CLI)

> Requires: authenticated + bunker URL configured

### 8.1 Setup

```sh
# Set bunker URL
redshift configure set bunkerUrl=https://bunker.example.com
# Or via env
export REDSHIFT_BUNKER_URL=https://bunker.example.com
```

### 8.2 Create a team

```sh
redshift teams create "My Team" --slug my-team
redshift teams create "Dev Squad" -s dev-squad       # short flag
```

- [ ] Shows team name, slug, and pubkey
- [ ] `--json` outputs full team JSON

### 8.3 List teams

```sh
redshift teams list
redshift teams list --json
```

- [ ] Table format: Name, Slug, Pubkey (truncated), Members, Created
- [ ] JSON format: array of team objects

### 8.4 View team members

```sh
redshift teams members <team-id>
redshift teams members <team-id> --json
```

- [ ] Table format: Pubkey (truncated), Role, Email, Joined
- [ ] Shows all members including owner

### 8.5 Invite a member

```sh
# By email
redshift teams invite <team-id> --email user@example.com --role developer

# By pubkey
redshift teams invite <team-id> --pubkey <hex-pubkey> --role admin

# Short flags
redshift teams invite <team-id> --email user@example.com -r readonly
```

- [ ] Valid roles: `admin`, `developer`, `readonly`
- [ ] Requires at least one of `--email` or `--pubkey`
- [ ] Requires `--role`
- [ ] Shows invitation confirmation

### 8.6 Remove a member

```sh
redshift teams remove <team-id> <pubkey>
```

- [ ] Member removed from team
- [ ] Owner cannot be removed

### 8.7 Rotate team key

```sh
redshift teams rotate-key <team-id>
```

- [ ] Shows old pubkey and new pubkey
- [ ] Old key preserved in rotated_keys table for re-encryption

### 8.8 Audit log

```sh
redshift teams audit <team-id>
redshift teams audit <team-id> --action member_invited
redshift teams audit <team-id> --actor <pubkey>
redshift teams audit <team-id> --since 1700000000 --until 1710000000
redshift teams audit <team-id> --limit 10 --offset 20
redshift teams audit <team-id> --json
```

- [ ] Table format: Time, Actor (truncated), Action, Target
- [ ] Filters work correctly (action, actor, time range)
- [ ] Pagination: shows "Showing X of Y" and "More results available" when
      applicable

### 8.9 Audit summary

```sh
redshift teams audit-summary <team-id>
redshift teams audit-summary <team-id> --json
```

- [ ] Table format: Action, Count (sorted by count descending)
- [ ] JSON format: `{ counts: { action: count, ... } }`

---

## 9. Bunker Server

> Requires: `@redshift/bunker` package built, environment variables set (see
> 9.1). Uses NIP-46 for remote signing and NIP-98 for admin HTTP auth.

### 9.1 Start the bunker

```sh
# Set required environment variables
export MASTER_KEY=$(openssl rand -hex 32)
export NOSTR_RELAYS="wss://relay.damus.io,wss://nos.lol"
export ADMIN_PUBKEYS="<your-hex-pubkey>"
export DATABASE_URL=":memory:"              # or a file path

redshift bunker start
redshift bunker start --port 4000 --host 0.0.0.0
redshift bunker start --database /tmp/bunker.db
```

- [ ] Prints config summary (host, port, relay count, team count)
- [ ] HTTP server starts on specified port
- [ ] Subscribes to Nostr relays for NIP-46 events
- [ ] `Ctrl+C` shuts down gracefully

### 9.2 Health check

```sh
# While bunker is running
curl http://localhost:3333/health
```

- [ ] Returns `{ "status": "ok" }`

### 9.3 Bunker status (from CLI)

```sh
export REDSHIFT_BUNKER_URL=http://localhost:3333
redshift bunker status
redshift bunker status --json
```

- [ ] Shows: URL, status (ok/unreachable), response time
- [ ] `--json` outputs structured JSON
- [ ] When bunker is not running, shows "unreachable"

### 9.4 OAuth flows

> Requires: Google and/or GitHub OAuth app configured

```sh
export GOOGLE_CLIENT_ID=<id>
export GOOGLE_CLIENT_SECRET=<secret>
export GITHUB_CLIENT_ID=<id>
export GITHUB_CLIENT_SECRET=<secret>
export PUBLIC_URL=http://localhost:3333
```

#### Google OAuth

- [ ] `GET /auth/google?team=<team-id>` — redirects to Google consent screen
- [ ] After consent, callback creates member + identity
- [ ] Session cookie set, `/api/me` returns member info

#### GitHub OAuth

- [ ] `GET /auth/github?team=<team-id>` — redirects to GitHub authorization
- [ ] After authorization, callback creates member + identity
- [ ] Session cookie set, `/api/me` returns member info

### 9.5 Session API

```sh
# After OAuth login (with session cookie)
curl -b cookies.txt http://localhost:3333/api/me
curl -b cookies.txt http://localhost:3333/api/identities
curl -b cookies.txt -X POST http://localhost:3333/api/logout
```

- [ ] `/api/me` returns member info and team
- [ ] `/api/identities` lists assigned identities
- [ ] `/api/logout` clears session cookie

### 9.6 Admin API (NIP-98 auth)

> All admin endpoints require a signed NIP-98 Authorization header. The
> `redshift teams` CLI commands handle this automatically.

Test manually with curl by constructing the auth header:

```sh
# The teams CLI commands test this automatically.
# To test raw API, use the teams CLI:

redshift teams create "Test Team" --slug test-team
redshift teams list
redshift teams members <team-id>
redshift teams invite <team-id> --email test@example.com --role developer
redshift teams remove <team-id> <pubkey>
redshift teams rotate-key <team-id>
redshift teams audit <team-id>
redshift teams audit-summary <team-id>
```

### 9.7 NIP-46 remote signing

> Requires: bunker running + team created + member authorized

```sh
# 1. Start bunker
redshift bunker start

# 2. Create team and note the team pubkey
redshift teams create "NIP46 Test" --slug nip46-test --json

# 3. Login to CLI via bunker
redshift login --bunker "bunker://<team-pubkey>?relay=wss://relay.damus.io"

# 4. Operations now use bunker for signing
redshift secrets set TEST_KEY test_value
redshift secrets get TEST_KEY
```

- [ ] CLI connects to bunker via NIP-46 protocol
- [ ] `sign_event` requests signed by team key
- [ ] `nip44_encrypt` / `nip44_decrypt` handled by bunker
- [ ] RBAC enforced — readonly members cannot write secrets

### 9.8 RBAC enforcement

Test with different member roles:

| Operation                                     | Owner | Admin | Developer | Readonly |
| --------------------------------------------- | ----- | ----- | --------- | -------- |
| Read secrets (`nip44_decrypt`)                | Yes   | Yes   | Yes       | Yes      |
| Write secrets (`sign_event`, `nip44_encrypt`) | Yes   | Yes   | Yes       | No       |
| Manage members                                | Yes   | Yes   | No        | No       |
| Delete team                                   | Yes   | No    | No        | No       |

- [ ] Readonly member cannot sign events (gets `forbidden` error)
- [ ] Developer cannot invite/remove members
- [ ] Only owner can delete team

---

## 10. Upgrade

### 10.1 Check for updates

```sh
redshift upgrade
```

- [ ] Checks GitHub releases for latest version
- [ ] If current version is latest, says "Already on latest"
- [ ] If update available, shows version comparison and downloads

### 10.2 Force install

```sh
redshift upgrade --force
redshift upgrade --tag v0.3.0
```

- [ ] `--force` reinstalls even if on latest
- [ ] `--tag` installs specific version
- [ ] Detects OS (darwin/linux/windows) and arch (x64/arm64)
- [ ] Verifies SHA-256 checksum when available
- [ ] Creates backup of current binary before replacing

---

## 11. Global Flags

### 11.1 Help

```sh
redshift --help
redshift secrets --help
redshift teams invite --help
```

- [ ] Main help shows all commands with descriptions
- [ ] Command help shows flags, subcommands, examples
- [ ] Subcommand help shows specific flags and usage

### 11.2 Version

```sh
redshift --version
redshift -v
```

- [ ] Prints `redshift v<version>`

### 11.3 JSON output

```sh
redshift me --json
redshift secrets --json
redshift teams list --json
redshift bunker status --json
```

- [ ] All commands supporting `--json` output valid JSON to stdout

### 11.4 Silent mode

```sh
redshift --silent secrets set KEY value
```

- [ ] Suppresses informational messages

### 11.5 Debug mode

```sh
redshift --debug secrets get NONEXISTENT
```

- [ ] Shows full error stack traces

---

## 12. Error Handling

### 12.1 Not authenticated

```sh
redshift logout --yes
redshift secrets
```

- [ ] Shows "Not logged in" error with instructions to run `redshift login`

### 12.2 No project config

```sh
cd /tmp
redshift secrets
```

- [ ] Shows error about missing project/environment
- [ ] Suggests running `redshift setup`

### 12.3 Invalid inputs

```sh
redshift secrets set ""                     # empty key
redshift secrets set "invalid key!" value   # invalid characters in key
redshift setup --project "bad|name"         # pipe in project name
```

- [ ] Validates project IDs (alphanumeric, hyphens, underscores)
- [ ] Validates environment names
- [ ] Validates secret keys (uppercase, alphanumeric, underscores)
- [ ] Provides clear error messages

### 12.4 Unknown command

```sh
redshift foobar
```

- [ ] Shows "Unknown command" error
- [ ] Displays help text

### 12.5 Relay unreachable

```sh
redshift configure set relays='["wss://nonexistent.example.com"]'
redshift secrets
```

- [ ] Times out gracefully (5 second default)
- [ ] Shows relay connection error

---

## 13. Security Verification

### 13.1 Secrets are encrypted at rest

```sh
# Set a secret
redshift secrets set SENSITIVE_KEY "super-secret-value"

# The secret is stored as a NIP-59 Gift Wrap event on relays.
# Verify by querying the relay directly — the content is encrypted,
# not readable without the private key.
```

### 13.2 Config file permissions

```sh
ls -la ~/.redshift/config.json
ls -la ~/.redshift/
```

- [ ] `config.json` permissions: `-rw-------` (0600)
- [ ] `.redshift/` directory permissions: `drwx------` (0700)

### 13.3 Keychain storage

```sh
# On macOS, verify keychain entry
security find-generic-password -s com.redshiftapp.cli -a nsec

# On Linux, verify via secret-service
secret-tool lookup service com.redshiftapp.cli
```

- [ ] nsec stored in keychain, not in config file (when keychain available)

### 13.4 Value redaction

```sh
redshift secrets               # values show ****
redshift secrets --raw          # values shown (truncated)
```

- [ ] Default output never reveals secret values
- [ ] `--raw` flag required to see values

### 13.5 Sensitive config protection

```sh
redshift configure set nsec=nsec1...
redshift configure set authMethod=nsec
```

- [ ] Both commands rejected with "Use 'redshift login' instead"

---

## 14. Pricing Tier Behavior

### 14.1 Free tier

- [ ] Unlimited projects and secrets
- [ ] Uses any Nostr relay (default relays or custom)
- [ ] No account required — just a Nostr keypair
- [ ] Full CLI and web admin access

### 14.2 Cloud tier

- [ ] One-time purchase (12,121 sats)
- [ ] Managed relay access (automatic sync)
- [ ] Cloud badge shown in web UI when managed relay detected
- [ ] 7-day audit logs

### 14.3 Teams tier (requires bunker)

- [ ] Team creation and management
- [ ] RBAC with 4 roles (owner, admin, developer, readonly)
- [ ] NIP-46 remote signing via bunker
- [ ] OAuth onboarding (Google/GitHub)
- [ ] 90-day audit logs with query/filter/pruning
- [ ] Team key rotation

### 14.4 Enterprise tier

- [ ] Custom pricing
- [ ] Not yet available (marked "Coming Soon" on pricing page)

---

## 15. Automated Test Suites

Run the full automated test suite to verify nothing is broken:

```sh
# From repo root
cd /path/to/redshift

# Bunker package tests
cd packages/bunker && bun test

# CLI tests
cd cli && bun test

# Web tests (Vitest)
cd web && bun run test

# Builds
bun run build:cli
bun run build:web
```

**Expected results:**

| Suite              | Expected                    | Notes                                |
| ------------------ | --------------------------- | ------------------------------------ |
| `packages/bunker/` | 420 pass, 0 fail            |                                      |
| `cli/`             | 495 pass, 10 skip, 0 fail   | 10 skips are relay integration tests |
| `web/`             | 318 pass, 0 fail            |                                      |
| `build:cli`        | Compiles to `dist/redshift` |                                      |
| `build:web`        | Writes to `web/dist/`       |                                      |

> **Note:** Test counts may drift as new tests are added. The important thing is
> 0 failures. If counts are lower than expected, check whether tests were
> removed or skipped intentionally.

---

## 16. Troubleshooting

Common issues encountered during manual testing and how to resolve them.

### "Not logged in" error on every command

**Symptom:** `redshift secrets` or other commands fail with "Not logged in."

**Fix:** Run `redshift login --nsec nsec1<key>`. If you just logged in and it
still fails, check `redshift me` to verify auth source. The env var
`REDSHIFT_NSEC` overrides config — ensure it's not set to an empty value.

### Relay connection timeouts

**Symptom:** Commands hang for 5+ seconds then fail with relay errors.

**Fix:** Check relay URLs with `redshift configure get relays`. Verify the
relays are reachable:
`curl -o /dev/null -s -w "%{http_code}" https://relay.damus.io`. Try switching
to a different relay. Default timeout is 5 seconds.

### `redshift.yaml` not found

**Symptom:** Secrets commands fail with "Missing project/environment."

**Fix:** Run `redshift setup` in your project directory, or pass `--project` and
`--config` flags explicitly. The file must be in the current working directory.

### Keychain errors on Linux

**Symptom:** Login fails with keychain/secret-service errors.

**Fix:** Ensure `gnome-keyring` or `kwallet` is running. Alternatively, the CLI
falls back to storing credentials in `~/.redshift/config.json` (with `0600`
permissions). Set `REDSHIFT_NSEC` env var as a workaround.

### Bunker server won't start

**Symptom:** `redshift bunker start` fails immediately.

**Fix:** Ensure all required env vars are set: `MASTER_KEY` (64 hex chars),
`NOSTR_RELAYS` (comma-separated `wss://` URLs), `ADMIN_PUBKEYS` (hex pubkeys).
Check `DATABASE_URL` points to a writable path or use `:memory:`.

### OAuth callback fails

**Symptom:** Google/GitHub OAuth redirects to an error page.

**Fix:** Verify `PUBLIC_URL` matches the redirect URI configured in your OAuth
app. Ensure `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (or GitHub equivalents)
are set. The callback URL must be `{PUBLIC_URL}/auth/{provider}/callback`.

### Web build fails with type errors

**Symptom:** `bun run build:web` fails with TypeScript errors.

**Fix:** Known issue: `tsc --noEmit` may fail due to `bun-types` resolution.
This is a pre-existing monorepo issue. If the Vite build itself succeeds
(produces output in `web/dist/`), the build is fine. Check the exit code —
warnings (exit 0) are acceptable.

---

## 17. Pass/Fail Criteria

### Release gate (full regression)

**Pass — clear to release:**

- [ ] All smoke tests pass (Section 1A)
- [ ] All automated test suites pass with 0 failures (Section 15)
- [ ] Both builds succeed (`build:cli`, `build:web`)
- [ ] Sections 1-5 (CLI core) have no unchecked boxes
- [ ] Section 13 (Security) has no unchecked boxes

**Conditional pass — release with known issues:**

- Sections 6-7 (web UI) have minor unchecked items with documented workarounds
- Section 9.4 (OAuth) skipped due to missing OAuth app credentials
- Section 10 (Upgrade) skipped in development builds

**Fail — do not release:**

- Any smoke test fails
- Any automated test suite has failures
- Any build fails with non-zero exit code
- Section 1 (Authentication) has unchecked boxes
- Section 3 (Secrets) has unchecked boxes (data integrity risk)
- Section 13.1-13.2 (encryption/permissions) has unchecked boxes
