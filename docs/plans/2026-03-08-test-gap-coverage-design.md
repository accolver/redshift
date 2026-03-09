# Test Gap Coverage Design

**Date:** 2026-03-08 **Status:** Approved **Approach:** In-process mock relay +
unit tests for all gaps

## Context

QA audit of TESTING.md against automated test suites revealed 25 gaps across 7
high-risk, 10 medium-risk, and 8 low-risk areas. This design covers test
implementation for all actionable gaps.

## Discovery: Unimplemented Features

During source code review, several features declared in the CLI spec were found
to have no implementation:

| Feature                                                                    | CLI Flag Exists | Implementation                    | Test Strategy          |
| -------------------------------------------------------------------------- | --------------- | --------------------------------- | ---------------------- |
| `--mount` / `--mount-format`                                               | Yes             | No                                | Skip — nothing to test |
| `--fallback` / `--fallback-only` / `--fallback-readonly` / `--no-fallback` | Yes             | No                                | Skip — nothing to test |
| `--only-names`                                                             | Yes             | No                                | Skip — nothing to test |
| `--plain`                                                                  | Yes             | No                                | Skip — nothing to test |
| `download --format yaml/docker`                                            | Yes             | Only .env implemented             | Test current behavior  |
| `configure reset`                                                          | Yes             | Only clears auth, not full config | Test current behavior  |
| `run clean`                                                                | Yes             | No                                | Skip — nothing to test |

These gaps are tracked separately as implementation work, not testing work.

## New Test Files

### 1. `cli/tests/lib/config-security.test.ts`

Tests file permission enforcement and blocked config keys.

- Config directory created with 0700 permissions
- Config file written with 0600 permissions
- `SENSITIVE_KEYS` (nsec, bunker, authMethod, clientSecretKey) rejected by
  configure set
- Unknown keys rejected by configure set
- `ALLOWED_CONFIG_KEYS` accepted by configure set
- JSON value parsing for array configs (relays)
- `configure reset --yes` clears auth fields

### 2. `cli/tests/commands/serve-security.test.ts`

Tests HTTP security headers and origin validation.

- X-Frame-Options: DENY on all responses
- X-Content-Type-Options: nosniff on all responses
- Content-Security-Policy header present
- Cache-Control: no-store on API routes only
- Origin validation rejects non-localhost origins (403)
- Origin validation accepts localhost origins
- Safe API paths (/api/health, /api/info) exempt from origin check
- API routes without Origin require x-redshift-client header

### 3. `cli/tests/commands/secrets-output.test.ts`

Tests output formatting and value redaction.

- `redactValue()` always returns `'****'`
- `formatSecretValue()` masks values when raw=false
- `formatSecretValue()` shows truncated values when raw=true
- Table format output structure
- JSON format output structure
- Env format output with escaping
- Download currently only produces .env format

### 4. `cli/tests/commands/login-extended.test.ts`

Tests overwrite flag, NostrConnect URI, and me command output.

- Login with existing auth and no --overwrite returns early
- Login with --overwrite/--force proceeds past existing auth
- NostrConnect URI has correct format (nostrconnect://pubkey?params)
- NostrConnect URI includes relay, secret, name, perms params
- Default timeout is 120000ms
- `me` command output for nsec auth (text and JSON)
- `me` command output when not authenticated

### 5. `cli/tests/integration/mock-relay.ts`

Shared utility — in-process NIP-01 relay mock.

- Bun WebSocket server on random port
- EVENT → store, reply OK
- REQ → filter by kind/authors/#t/since, send matches + EOSE
- CLOSE → remove subscription
- Addressable events: newer created_at replaces older for same d-tag
- Exported `startMockRelay()` / `stopMockRelay()` functions

### 6. `cli/tests/integration/secrets-roundtrip.test.ts`

End-to-end secrets lifecycle using mock relay.

- Set secret → encrypt → publish → fetch → decrypt → verify value matches
- Update secret (newer timestamp wins)
- Delete secret (tombstone)
- Isolate secrets by d-tag (project|environment)
- List projects and environments
- Multiple secrets in one bundle

### 7. `web/tests/models/secrets-import.test.ts`

Tests import parsing for all formats.

- parseEnv: key=value, quoted values, comments, export prefix, escapes
- parseJson: valid object, nested values stringified, invalid JSON
- parseYaml: key: value, quoted values, inline comments
- parseCsv: header row, quoted fields, commas in values
- Merge mode: only adds/updates, doesn't delete
- Replace mode: deletes extras, then adds/updates

## Integration Test Infrastructure

### Mock Relay (`mock-relay.ts`)

~100 lines. Minimal NIP-01 server using `Bun.serve` with WebSocket upgrade.

```
startMockRelay() → { url: string, port: number, server: Server, events: Map }
stopMockRelay(server)
```

Events stored in `Map<string, NostrEvent>` keyed by event ID. Addressable events
(kind 30000-39999) keyed by `kind:pubkey:d-tag` for deduplication.

### Why not Docker/Playwright

- Docker: Adds 5-10s startup, requires Docker in CI, tests relay software not
  our code
- Playwright: Web UI doesn't have teams pages yet (Phase 8), premature
- In-process mock: Fast (~50ms), zero deps, deterministic, proven pattern in
  this codebase (http-server.test.ts)

## Estimated Impact

| Metric                   | Before              | After                              |
| ------------------------ | ------------------- | ---------------------------------- |
| CLI tests                | 495 pass            | ~545 pass                          |
| Web tests                | 318 pass            | ~330 pass                          |
| High-risk gaps covered   | 0/7                 | 5/7 (mount/fallback unimplemented) |
| Medium-risk gaps covered | 0/10                | 7/10                               |
| Integration test infra   | External relay only | In-process mock relay              |
