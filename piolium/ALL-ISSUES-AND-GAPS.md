# Redshift — Complete Issues and Gaps Register

**Audit snapshot:** `main@9b98467`  
**Source reports:** `piolium/final-audit-report.md`, `piolium/findings.json`, `piolium/attack-surface/knowledge-base-report.md`  
**Status legend:** `P0` release blocker · `P1` next release · `P2` planned hardening · `P3` deferred product opportunity

This file is the exhaustive implementation register for every confirmed security issue, functional defect, test/tooling gap, documentation mismatch, and explicitly deferred opportunity found during the audit. Speculative Cloud/Teams/history work is recorded but is not treated as a defect in the individual/free product.

**Local verification checkpoint (2026-07-10):** frozen installs, scoped Biome, root/web/relay typechecks, 949 unit/integration tests (10 legacy optional-relay skips), 17 managed-relay tests, two Playwright release journeys, all four native CLI builds, web/embed/relay builds, deterministic generated outputs, Wrangler dry-run, strict OpenSpec validation, and `git diff --check` passed. Required compiled `nak` relay and bunker journeys ran rather than skipping. Deployment, release-attestation infrastructure, dependency-audit policy, and operational backup/SLA evidence remain external or open gates as noted below.

## Security Issues

### P0 — Critical/High

- [x] **SEC-001 — Reject attacker-authored secret state (Critical).**
  - CLI and web accept any valid NIP-59 sender addressed to the victim, then select by attacker-controlled rumor timestamp.
  - A local-relay PoC proved the attacker bundle wins; `NODE_OPTIONS --import` can turn this into code execution for Node commands.
  - Affected: `packages/crypto/src/gift-wrap.ts`, `cli/src/lib/secret-manager.ts`, `web/src/lib/models/gift-wrap-secrets.ts`.
  - Required: expected-author checks for local and signer-backed unwrap, future timestamp bound, deterministic tie-break, dangerous environment-name validation, malicious-sender E2E.

- [x] **SEC-002 — Remove Redshift master credentials from child environments (High).**
  - `REDSHIFT_NSEC` and `REDSHIFT_BUNKER` are inherited by every `redshift run` child and dependency.
  - Required: scrub auth-only variables while preserving requested application secrets; child-process E2E.

- [x] **SEC-003 — Make installer/updater artifact verification mandatory (High).**
  - Installer writes directly to the final executable path without verification.
  - Updater continues when checksum metadata is absent/malformed/missing an entry.
  - Release workflow produces no checksum, signature, attestation, provenance, or SBOM; current release is mutable.
  - Required: signed SHA-256 manifest or Sigstore/GitHub attestation, temporary restrictive file, verify then atomic replacement, rollback test.

- [x] **SEC-004 — Remove mutable remote signing script from relay origin (High).**
  - Relay landing page loads `nostr-login@latest` from unpkg with `sign_event:1` and no pin/SRI/CSP.
  - Required: vendor/self-host reviewed version, immutable digest, restrictive CSP.

### P1 — Medium

- [x] **SEC-005 — Redact credentials from configuration reads.**
  - `configure get`, `configure --all`, and specific sensitive-key reads can print fallback nsec or bunker client keys.
  - Required: centralized redaction; explicit warned reveal path only if truly needed.

- [x] **SEC-006 — Enforce paid/authorized relay reads.**
  - Any authenticated key can issue unrestricted REQ filters; payment is checked only for writes.
  - Required: payment/allow check before subscription and a documented recipient/identity-scoped read policy.

- [x] **SEC-007 — Enforce relay quotas per identity, not connection.**
  - Every WebSocket gets fresh event/REQ buckets, allowing parallel-connection multiplication.
  - Required: shared authenticated-pubkey quota plus secondary connection limit.

- [x] **SEC-008 — Protect bunker pairing credentials.**
  - Secret-bearing pairing URIs are rejected from `login --bunker`; users must use hidden stdin or command-scoped environment input.
  - Query credentials are redacted from failures, piped hidden input is parsed correctly, and CLI/docs no longer recommend putting one-time secrets in argv.

- [x] **SEC-009 — Bound local bunker inbound work.**
  - Arbitrary senders can force signature verification, NIP-44 decrypt/encrypt, signing, and response publication.
  - Required: global/per-client token buckets, event-age and payload-size limits, flood tests.

### P2 — Security hardening and dependency hygiene

- [x] **SEC-010 — Verify relay event IDs.**
  - Relay recomputes the signature hash but does not require supplied `event.id` to equal that hash.
  - Required: strict lowercase 64-hex ID equality before storage/broadcast.

- [x] **SEC-011 — Validate every relay URL at ingestion.**
  - `validateRelayUrl()` exists but global/project/bunker paths can bypass it; non-local plaintext or non-WebSocket protocols can be stored.

- [x] **SEC-012 — Do not persist a secret-bearing bunker URI in the web app.**
  - Web restoration stores the original URI while CLI intentionally omits one-time pairing secrets.
  - Required: persist only sanitized pointer + client credential required for reconnection.

- [x] **SEC-013 — Improve local credential fallback custody.**
  - Persistent login now fails closed when the OS keychain is unavailable and points users to command-scoped `REDSHIFT_NSEC`/`REDSHIFT_BUNKER` authentication.
  - Valid legacy plaintext credentials migrate transactionally to keychain before config sanitization; failed migration preserves recovery bytes but never authenticates from them. The local signer remains explicitly labeled an insecure plaintext-key prototype and requires opt-in.

- [x] **SEC-014 — Gate NIP-07 login on NIP-44 capability.**
  - Users can appear logged in through an extension that cannot read/write secrets.
  - Required: capability detection before successful secret-management login and clear fallback UX.

- [x] **SEC-015 — Harden relay deployment supply chain.**
  - `relay/deploy.sh` accepts Cloudflare token through argv, installs mutable Wrangler, and uses mutable npm installs rather than frozen Bun lock resolution.
  - Required: environment/secure prompt, least-scope token, pinned tools, `bun install --frozen-lockfile`.

- [x] **SEC-016 — Harden GitHub Actions dependencies and permissions.**
  - Actions use mutable major tags, Bun uses `latest`, installs are not frozen, and release permissions are workflow-wide.
  - Required: pin reviewed SHAs/Bun version, frozen lockfiles, job-level least permissions.

- [ ] **SEC-017 — Resolve reachable dependency advisories.**
  - Upgrade `yaml@2.8.2` to `>=2.8.3` (hostile nested YAML stack overflow).
  - Upgrade vulnerable SvelteKit/Svelte/Vite/Vitest/Rollup/PostCSS/Picomatch/Undici/ws/esbuild versions and verify runtime/build reachability.
  - Add dependency audit to CI.

- [x] **SEC-018 — Sign/attest releases and generated artifacts.**
  - Add signed/immutable tags or release attestations, SBOM, provenance, and source-to-generated checks for `embedded-files.ts` and relay `worker.js`.

- [x] **SEC-019 — Clarify raw secret output boundaries.**
  - JSON/env formats disclose values regardless of `--raw`; table `--raw` truncates.
  - Required: consistent explicit raw/reveal semantics and warnings suitable for CI/logging.

- [x] **SEC-020 — Clear browser encryption-key state on disconnect when appropriate.**
  - Session ciphertext is removed but the IndexedDB CryptoKey remains; `secureClearAll()` is test-only.
  - Required: define reconnect vs logout semantics and clear the key for a full logout/account switch.

## Core Functional and Protocol Defects

### P0 — Release blockers

- [x] **CORE-001 — Fix blank compiled `redshift serve` dashboard.**
  - CLI CSP blocks the inline SvelteKit bootstrap. Browser tests show 0 controls; Vite preview works.
  - Required: nonce/hash-compatible bootstrap and compiled-binary browser E2E.

- [x] **CORE-002 — Preserve positional argv and repair `run --command`.**
  - Already-tokenized argv is joined/reparsed; spaced arguments split and `sh -c` boundaries break.
  - Required: positional argv remains exact; explicit shell mode is isolated and tested; exit/signal forwarding remains correct.

- [x] **CORE-003 — Correct setup force/noninteractive behavior.**
  - Ordinary setup overwrites; `--no-interactive` controls unrelated force behavior and can still prompt; help references an undefined force flag.
  - Required: independent `force` and `interactive` options, explicit overwrite refusal, noninteractive missing-value failure.

- [x] **CORE-004 — Make managed relay authorization compatible with NIP-59.**
  - Relay requires the ephemeral outer Gift Wrap author to authenticate/pay; Redshift discards that key.
  - Required: for kind 1059, authenticate/payment-check the intended paid recipient/payer via `p` tag while still verifying the outer event.

- [x] **CORE-005 — Correct project/environment deletion semantics.**
  - Project/environment deletion does not tombstone every affected secret d-tag.
  - User-signed NIP-09 requests cannot erase Gift Wraps authored by discarded ephemeral keys.
  - Required: publish newer empty tombstones for every affected d-tag; document retained ciphertext; define key rotation/cryptographic erasure and relay retention rather than claiming NIP-09 erasure.

### P1 — CLI contract/reliability

- [x] **CLI-001 — Remove or implement help-only run functionality.**
  - `clean`, mount/mount-format, fallback/fallback-only/fallback-config, preserve-env, signal and related flags are accepted/advertised but not dispatched.

- [x] **CLI-002 — Remove or implement help-only secrets functionality.**
  - Multi-key get/set/delete, only-names/plain/copy, no-exit-on-missing, interactive/no-interactive, delete confirmation, download path/format/no-file/passphrase are missing or ignored.

- [x] **CLI-003 — Fail closed on unknown flags/subcommands and missing flag values.**
  - Parser uses `strict:false`; typos become defaults, unknown bunker subcommands start the bunker, and missing strings can become booleans.

- [x] **CLI-004 — Make configure mutations fail with nonzero status.**
  - Unknown/invalid keys print errors and still exit 0.

- [x] **CLI-005 — Make `configure reset --yes` actually reset all CLI configuration.**
  - It currently clears only authentication while preserving relays/defaults.

- [x] **CLI-006 — Make global flags truthful and consistent.**
  - `--silent`, `--json`, and `--debug` affect only selected paths; direct output/process exits bypass them.

- [x] **CLI-007 — Use configured default project/environment.**
  - `defaultProject` is not consumed; `defaultEnvironment` is accepted but absent from `Config` and command resolution.

- [x] **CLI-008 — Validate setup project/environment slugs before writing.**
  - Invalid config is saved and rejected only by later commands.

- [x] **CLI-009 — Validate uploaded `.env` keys/values consistently.**
  - Upload bypasses normalization/reserved-name/value checks used by direct set.

- [x] **CLI-010 — Define unauthenticated/scriptable exit semantics.**
  - `me` exits 0 while unauthenticated; logout/revoke/delete confirmations and `--yes` behavior are inconsistent.

- [x] **CLI-011 — Preserve typed relay/setup errors.**
  - Setup swallows project-query failures and silently falls back to manual input, losing debug/typed error context.

- [x] **CLI-012 — Align supported platforms.**
  - Updater detects Windows but release workflow builds only Darwin/Linux.

- [x] **CLI-013 — Correct compiled binary integration path.**
  - Tests search `cli/dist/redshift`; builds emit root `dist/redshift`, so tests silently fall back to source and CI skips the actual binary.

- [x] **CLI-014 — Define SecretManager key ownership.**
  - `close()/disconnect()` zeroizes the caller-owned `Uint8Array` by reference, causing the real-relay test suite to fail 2 tests.
  - Required: clone internally or document transfer and update callers/tests; prefer clone for a safe API.

### P1 — Relay and distributed-state reliability

- [x] **REL-001 — Replace all-relays-must-succeed publishing with explicit quorum semantics.**
  - `Promise.all` can report failure after one relay accepted the update, causing ambiguous retries/partial writes.

- [x] **REL-002 — Make latest-state ordering deterministic.**
  - One-second timestamps and strict `>` make same-second updates dependent on relay ordering.
  - Required: deterministic `(created_at,event/id)` tie-break and rollback/future-skew protection.

- [x] **REL-003 — Route bunker transport through rate limit/backoff policy.**
  - Client and signer NIP-46 pools reconnect subscriptions and independently rate-limit/retry each relay publish.
  - A signer response succeeds through any healthy configured relay; permanent relay rejection is not retried and pool ownership remains explicit.

- [x] **REL-004 — Align relay NIP claims/config.**
  - NIP-09 is advertised but kind 5 is excluded from allowed kinds; payment-required metadata is inconsistent; logical/historical deletion behavior is unclear.

- [x] **REL-005 — Make embedded web relay configuration match CLI configuration.**
  - `redshift serve` CSP permits only built-ins and the web app does not inherit CLI/project relays.

- [x] **REL-006 — Add managed-relay security/integration tests.**
  - Cover NIP-42, paid/unpaid REQ, Gift Wrap recipient authorization, ID mismatch, per-pubkey quotas, deletion/retention, and rate-limit bypass.

### P1 — Web correctness and UX

- [x] **WEB-001 — Add complete hosted and embedded browser journeys.**
  - No Playwright/real-browser suite covers login → create project/environment → edit/save → refresh → CLI retrieval.

- [x] **WEB-002 — Make NIP-07 capabilities explicit.**
  - Detect NIP-44 before completing login; label read/write capability and offer bunker/nsec fallback.

- [x] **WEB-003 — Sanitize future external blog/CMS content.**
  - Static hardcoded `{@html post.content}` is currently trusted; any future CMS/external source must be sanitized. JSON-LD must escape `<`/`</script>` if metadata becomes external.

- [x] **WEB-004 — Replace broad admin `unsafe-inline` CSP when feasible.**
  - SvelteKit centrally emits nonce policies for dynamic responses and hash policies for prerendered/static output.
  - Embedded serving removes the static meta policy before applying its authoritative runtime nonce header; standalone and embedded browser journeys fail on CSP execution errors.

## Testing, Build, and Governance Gaps

- [x] **TEST-001 — Add a true compiled CLI local-relay E2E.**
  - The compiled binary covers setup, set/get/list/delete, redaction/reveal, exact argv, explicit shell mode, credential scrubbing, child exit/signal, logical deletion, and majority success with one unavailable relay.
  - Author/recipient rejection and deterministic equal-timestamp selection remain covered at the shared state/manager boundary where crafted events can be injected deterministically.

- [x] **TEST-002 — Run real relay integration in CI.**
  - Start local `nak`; do not conditionally skip the primary relay lifecycle suite.

- [x] **TEST-003 — Add NIP-46 CLI-level E2E.**
  - Existing NAK test exercises library-level flows but does not spawn `redshift login/setup/secrets/run` through bunker auth.

- [x] **TEST-004 — Add compiled embedded-dashboard browser E2E.**
  - HTTP-content assertions did not catch the blank UI.

- [x] **TEST-005 — Repair root TypeScript check.**
  - `tsc --noEmit` cannot resolve `bun-types` despite `@types/bun` installation.

- [x] **TEST-006 — Repair Biome scope and baseline.**
  - Ignore `.worktrees`, `.applesauce-src`, audit/generated output; handle 3.4 MiB embed; fix product-source diagnostics.

- [x] **TEST-007 — Make CI/release gates complete.**
  - CI/release require frozen installs, scoped lint/format, all typechecks/tests, explicit compiled lifecycle E2E, managed relay verification, generated consistency, browser journeys, and native artifact smoke tests.
  - Dependency audit remains separately deferred as SEC-017 under explicit user instruction.

- [x] **TEST-008 — Add upgrade/install E2E.**
  - Hermetic shell-installer coverage exercises attestation/checksum/smoke/rollback failures, while a compiled upgrade journey uses controlled release assets and a fake GitHub attestation CLI to prove verified atomic replacement and preservation on provenance failure.

- [x] **TEST-009 — Add custom relay CSP/config E2E.**
  - Prove CLI and embedded web can use a configured local/custom relay without widening CSP unsafely.

- [x] **GOV-001 — Make roadmap/docs capability claims test-backed.**
  - Remove inaccurate “MVP Complete,” `/tutorial`, complete deletion, complete bunker custody, and overly broad Doppler-compatibility claims.

- [x] **GOV-002 — Establish current OpenSpec truth.**
  - Completed NIP-46 and production-hardening changes are archived into nine current capability specs; future Cloud/Teams proposals remain clearly separated and deferred.

- [x] **GOV-003 — Resolve pricing/architecture contradictions.**
  - The deferred Cloud hypothesis is explicitly $5 USD monthly with BTCPay conversion at invoice creation, not a live offer.
  - The deferred Teams research baseline is a bunker-held team key with signer-layer RBAC; MLS/FROSTR are labeled later custody research.

## Verified Remediation Matrix

The checked items above are backed by the following focused regressions or release gates. Grouped rows list every completed issue ID explicitly.

| Completed IDs | Verification evidence |
| --- | --- |
| SEC-001, REL-002 | `packages/crypto/tests/gift-wrap*.test.ts`, `cli/tests/lib/secret-manager.test.ts`, `web/tests/models/gift-wrap-secrets.test.ts` |
| SEC-002, CORE-002, CLI-001 | `cli/tests/commands/run.test.ts`, `cli/tests/integration/binary-cli.test.ts`, `cli/tests/integration/binary-serve.test.ts` |
| SEC-003, SEC-018 | `cli/tests/commands/upgrade.test.ts` rollback/source-identity cases, `cli/tests/integration/installer-integrity.test.ts` same-filesystem preservation cases, and release workflow attestation/SBOM/provenance gates |
| SEC-004 | `relay/nosflare/tests/landing-page.test.ts` |
| SEC-005, CLI-004, CLI-005, CLI-006 | `cli/tests/commands/configure.test.ts`, `cli/tests/lib/config.test.ts`, `cli/tests/lib/cli.test.ts` |
| SEC-006, SEC-007, CORE-004, REL-006 | `relay/nosflare/tests/relay-policy.test.ts`, `principal-quota.test.ts`, `quota-object.test.ts`, `event-verifier.test.ts` |
| SEC-008 | `cli/tests/commands/login.test.ts` and hidden-input spawned flow in `cli/tests/integration/cli-bunker-workflows.test.ts` |
| SEC-009 | `cli/tests/lib/nip46-bunker.test.ts` and the bounded local signer journey in `cli/tests/integration/nak-bunker-e2e.test.ts` |
| SEC-010 | `relay/nosflare/tests/event-verifier.test.ts` |
| SEC-011 | `cli/tests/lib/config.test.ts`, `cli/tests/commands/serve.test.ts`, and runtime relay validation exercised by Playwright |
| SEC-012, SEC-014, SEC-020, WEB-002 | `web/tests/stores/auth.test.ts`, `web/tests/stores/secure-storage.test.ts` |
| SEC-013 | keychain-failure/migration cases in `cli/tests/lib/config.test.ts`, persistence tests in `cli/tests/commands/login.test.ts`, and cross-process file-backed test keychain journey |
| REL-003 | `packages/rate-limiter/tests/resilient-pool.test.ts`, NIP-46 service healthy-relay test, and real `nak` bunker E2E |
| SEC-015, SEC-016 | `cli/tests/integration/workflow-policy.test.ts`, frozen-install/pinned-action/least-permission workflow gates, plus `bash -n relay/deploy.sh` |
| SEC-019, CLI-002 | `cli/tests/commands/secrets-output.test.ts`, `cli/tests/commands/secrets.test.ts`, `cli/tests/lib/cli.test.ts` |
| CORE-001, WEB-001, TEST-004 | `web/tests/e2e/dashboard.spec.ts` against standalone and compiled embedded dashboards |
| CORE-003, CLI-007, CLI-008, CLI-011 | `cli/tests/commands/setup.test.ts` |
| CORE-005 | `web/tests/stores/projects.test.ts`, tombstone tests in `packages/crypto/tests/gift-wrap.test.ts` |
| CLI-003, CLI-013 | `cli/tests/lib/cli.test.ts`, `cli/tests/integration/binary-cli.test.ts` |
| CLI-009 | `packages/crypto` env-parser tests and `cli/tests/lib/secret-manager.test.ts` |
| CLI-010 | `cli/tests/integration/binary-cli.test.ts`, command-level login/logout/secrets tests |
| CLI-012 | pure platform cases in `cli/tests/commands/upgrade.test.ts` |
| CLI-014 | `cli/tests/lib/secret-manager.test.ts`, `cli/tests/integration/relay-integration.test.ts` |
| REL-001 | `packages/rate-limiter/tests/quorum.test.ts`, CLI/web rate-limiter and project-store tests |
| REL-004 | `relay/nosflare/tests/metadata.test.ts` |
| REL-005, TEST-009 | `cli/tests/commands/serve.test.ts`, `web/tests/e2e/dashboard.spec.ts` custom-relay browser/CLI journey |
| WEB-003 | `web/tests/lib/content-safety.test.ts` |
| WEB-004 | centralized SvelteKit CSP regression, static hash build, runtime nonce tests, and standalone/embedded Playwright hydration journeys |
| TEST-002 | pinned `nak` installation in `.github/workflows/ci.yml` and the unconditional compiled relay case in `cli/tests/integration/binary-cli.test.ts` |
| TEST-003 | compiled command-scoped bunker case in `cli/tests/integration/nak-bunker-e2e.test.ts` |
| TEST-005 | root, web/Svelte, and relay `tsc`/`svelte-check` gates |
| TEST-006 | scoped Biome gate over owned source and tests |
| TEST-001, TEST-007, TEST-008 | compiled multi-relay lifecycle and upgrade E2E, installer integrity matrix, workflow policy regressions, and native matrix smoke gates |
| GOV-001 | rewritten `README.md`, `ROADMAP.md`, CLI/docs/pricing/privacy/terms pages and passing release journeys |
| GOV-002, GOV-003 | nine archived current capability specs plus explicit deferred Cloud pricing and Teams custody baselines in OpenSpec |

## Product Opportunities (Not Current Defects)

### P2 — After core hardening

- [ ] **FEAT-001 — Secret history, compare, and restore.**
  - Build only after author authorization, deterministic ordering, rollback protection, and deletion semantics are fixed.

- [ ] **FEAT-002 — Trustworthy backup/export and recovery.**
  - Add passphrase-encrypted formats, explicit recovery guarantees, and round-trip tests.

- [ ] **FEAT-003 — Per-relay status and recovery UI/CLI.**
  - Show accepted/failed relays, quorum, retries, and repair/sync actions.

### P3 — Explicitly deferred

- [ ] **FEAT-004 — Teams.**
  - Defer until key custody, RBAC, invite/removal/rotation, readonly denial, audit, and recovery threat model converges and has an approved minimal E2E contract.

- [ ] **FEAT-005 — Cloud paid tier.**
  - Defer until managed relay compatibility, payment/read/write policy, pricing, backup, retention, and sovereignty guarantees converge.

- [ ] **FEAT-006 — Enterprise SSO/compliance.**
  - Defer until Teams custody/boundaries and operational controls are implemented and independently reviewed.

## Completion Definition

The hardening program is complete only when:

1. Every `SEC-*`, `CORE-*`, `CLI-*`, `REL-*`, `WEB-*`, `TEST-*`, and `GOV-*` item is implemented or explicitly removed from product/docs through an approved OpenSpec decision.
2. `bun run test:all`, CLI local-relay integration, web browser E2E, root/web/relay typechecks, scoped Biome, dependency audit, and all builds pass.
3. The compiled binary—not source fallback—passes CLI and embedded-dashboard tests.
4. No security finding remains reproducible, and each regression has a test.
5. Telos L9→L1→L9 validation converges and the README/roadmap claims link to passing capability tests.
