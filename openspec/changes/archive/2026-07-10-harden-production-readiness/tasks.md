# Tasks: Harden Production Readiness

Every implementation task is tests-first. Check an audit item only after its focused regression and relevant integration/E2E gate pass. Product opportunities remain deferred and are completed here only by an explicit approved deferral, not by speculative implementation.

## 0. Validation and Baseline

- [x] 0.1 Document every confirmed issue/gap in `piolium/ALL-ISSUES-AND-GAPS.md`.
- [x] 0.2 Run Telos L9→L1→L9 review for security, individual journey, protocol, implementation, and code quality; record convergence in design.
- [x] 0.3 Create proposal, design, delta specs, tasks, and migration decisions for this hardening change.
- [x] 0.4 Validate OpenSpec strictly with available project tooling; validated with `bunx @fission-ai/openspec@latest validate harden-production-readiness --strict`.
- [x] 0.5 Capture baseline test/build/typecheck/lint/audit results in `piolium/final-audit-report.md`; maintain the issue-to-test matrix in `piolium/ALL-ISSUES-AND-GAPS.md`.

## 1. P0 Secret Authorization and Process Isolation

- [x] 1.1 Add malicious-sender, recipient-structure, author, timestamp, local/signer, and tie-break tests in `@redshift/crypto` (SEC-001, REL-002).
- [x] 1.2 Implement shared authenticated Gift Wrap validation, expected signer author, future-skew bound, and deterministic version comparator (SEC-001, REL-002).
- [x] 1.3 Update CLI/web callers and caches to retain outer IDs and select only authorized deterministic state (SEC-001, REL-002).
- [x] 1.4 Add child-environment unit and compiled E2E tests for auth scrub and runtime-hook rejection (SEC-002).
- [x] 1.5 Implement immutable hardened child environment construction and typed blocked-key errors (SEC-002).
- [x] 1.6 Clone caller key material inside SecretManager and reverse ownership regression tests (CLI-014).

## 2. P0 CLI and Dashboard Correctness

- [x] 2.1 Add strict-parser/dispatch tests for unknown flags/subcommands, missing values, globals, and `run --` boundaries (CLI-003, CLI-006).
- [x] 2.2 Make parser/dispatch strict; remove unsupported mount/fallback/clipboard/passphrase/silent/debug claims (CLI-001, CLI-002, CLI-003, CLI-006).
- [x] 2.3 Add exact positional argv, shell mode, preserve-env, exit, and signal tests (CORE-002, CLI-001).
- [x] 2.4 Remove argv join/reparse; implement isolated `--command`, preserve-env, and unconditional signal forwarding (CORE-002, CLI-001).
- [x] 2.5 Add setup tests for overwrite, force, no-interactive, defaults, invalid slugs, and typed relay failures (CORE-003, CLI-007, CLI-008, CLI-011).
- [x] 2.6 Implement independent setup force/interactivity, validated slugs, deterministic defaults, and preserved relay errors (CORE-003, CLI-007, CLI-008, CLI-011).
- [x] 2.7 Add compiled browser CSP hydration regression coverage (CORE-001, TEST-004).
- [x] 2.8 Make Svelte hosted/embedded bootstrap hash/nonce compatible and remove broad admin `unsafe-inline` (CORE-001, WEB-004). SvelteKit now emits nonce/hash CSP, while embedded serving removes the static meta policy before applying its runtime nonce header.

## 3. CLI Configuration, Secrets, Auth, and Output

- [x] 3.1 Add behavioral configure mutation/reset/redaction tests (SEC-005, CLI-004, CLI-005).
- [x] 3.2 Centralize configuration output redaction; make mutations atomic/nonzero; reset all config/auth (SEC-005, CLI-004, CLI-005).
- [x] 3.3 Add retained singular secret CRUD, missing-value, explicit-raw, and env/JSON download path/stdout tests (CLI-002, CLI-010, SEC-019).
- [x] 3.4 Implement the retained core secret contract and explicit reveal matrix; remove inert options (CLI-002, CLI-010, SEC-019).
- [x] 3.5 Add detailed env parse/upload tests for malformed, reserved, normalized duplicate, and invalid values (CLI-009).
- [x] 3.6 Implement all-or-nothing validated upload and detailed parse errors (CLI-009).
- [x] 3.7 Add unauthenticated `me`, immediate logout/revoke/delete, and stdout/stderr tests (CLI-010).
- [x] 3.8 Implement consistent script exit and immediate mutation semantics; remove unsupported confirmation flags (CLI-010).
- [x] 3.9 Add keychain-failure and legacy-plaintext migration tests (SEC-013).
- [x] 3.10 Stop new plaintext credential fallback, warn/migrate legacy config, and preserve command-scoped auth path (SEC-013).
- [x] 3.11 Reject unsupported Windows upgrade in pure platform tests and implementation (CLI-012).
- [x] 3.12 Reject secret-bearing bunker pairing URIs from argv, support hidden piped input, and update user guidance (SEC-008).

## 4. Relay Integrity, Authorization, Quotas, and Reliability

- [x] 4.1 Add strict event field/ID/signature tests across EVENT, AUTH, zap, and internal paths (SEC-010).
- [x] 4.2 Replace custom partial verification with one exact canonical verifier (SEC-010).
- [x] 4.3 Add managed relay policy tests for immutable AUTH principal, exact relay tag, recipient-paid Gift Wrap writes, read filters, and direct plaintext rejection (CORE-004, SEC-006).
- [x] 4.4 Implement immutable principal and recipient-scoped paid NIP-59 read/write authorization (CORE-004, SEC-006).
- [x] 4.5 Add fake-clock multi-socket/hibernation/lease quota tests (SEC-007).
- [x] 4.6 Implement durable shared per-principal buckets, connection leases, and pre-auth cap (SEC-007).
- [x] 4.7 Add relay URL table tests for global/project/environment/bunker/configure/runtime sources (SEC-011).
- [x] 4.8 Centralize normalized/deduplicated relay ingestion and enforce transport defense in depth (SEC-011).
- [x] 4.9 Add quorum report/retry/timeout tests for CLI and web (REL-001).
- [x] 4.10 Implement per-relay majority quorum reports and retry only failed relays (REL-001).
- [x] 4.11 Add bounded bunker age/size/rate/concurrency/queue tests (SEC-009).
- [x] 4.12 Route bunker transport through the resilient relay policy (REL-003). Client and signer transports use reconnecting subscriptions plus independent per-relay rate limiting/backoff, and signer responses require at least one healthy relay.
- [x] 4.13 Correct relay NIP/payment/retention metadata and add metadata tests (REL-004).
- [x] 4.14 Add and pass local managed-relay security/integration suite (REL-006).

## 5. Deletion and Browser Custody/UX

- [x] 5.1 Add web store and local-relay tests for environment/project tombstones, quorum abort, old ciphertext retention, and no invalid Gift Wrap kind-5 claim (CORE-005).
- [x] 5.2 Publish strictly newer tombstones for every affected d-tag before metadata/local deletion; narrow NIP-09 to owner-authored metadata (CORE-005).
- [x] 5.3 Add web bunker pairing/legacy restoration tests (SEC-012).
- [x] 5.4 Persist versioned sanitized bunker pointer and migrate/remove legacy secret-bearing URI (SEC-012).
- [x] 5.5 Add NIP-07 capability matrix and LoginDialog UX tests (SEC-014, WEB-002).
- [x] 5.6 Gate login on both NIP-44 operations and present fallback capability UX (SEC-014, WEB-002).
- [x] 5.7 Add full-logout CryptoKey/ciphertext destruction and reconnect-preservation tests (SEC-020).
- [x] 5.8 Clear all secure storage on full logout/account switch and separate relay reconnect (SEC-020).
- [x] 5.9 Add sanitizer and script-safe JSON-LD adversarial tests (WEB-003).
- [x] 5.10 Add one audited external-content sanitizer boundary and script-safe metadata serializer (WEB-003).
- [x] 5.11 Expose validated CLI/project relays through nonce-protected embedded runtime config and exact connect CSP with tests (REL-005, TEST-009).

## 6. Release, Installer, Deployment, CI, and Dependencies

- [x] 6.1 Add installer/updater hermetic E2E for valid, missing, malformed, duplicate, wrong-name/hash/identity, interruption, smoke failure, and rollback (SEC-003, TEST-008). Shell installer cases and compiled upgrade provenance/success-preservation lifecycles use controlled local release infrastructure.
- [x] 6.2 Implement exact GitHub artifact-attestation verification, restrictive temp file, atomic replacement, smoke test, cleanup, and rollback-safe replacement (SEC-003).
- [x] 6.3 Add release manifest, SHA-256, SBOM, provenance, artifact attestations, immutable tag checks, and generated-artifact consistency (SEC-018).
- [x] 6.4 Add workflow policy tests, pin action SHAs/Bun, freeze installs, and narrow permissions (SEC-016).
- [x] 6.5 Harden relay deployment: remove argv tokens/global mutable installs and use environment credentials plus pinned repository tooling (SEC-015).
- [x] 6.6 Remove the mutable nostr-login dependency entirely and apply restrictive nonce CSP with static regression tests (SEC-004).
- [ ] 6.7 Upgrade vulnerable dependency groups and run all gates after each; add dependency audit policy (SEC-017).

## 7. Hermetic Test and Build Gates

- [x] 7.1 Repair root/CLI Bun TypeScript configuration and add root/web/package/relay typecheck scripts (TEST-005).
- [x] 7.2 Scope Biome to owned source, exclude external/generated/audit/build trees, and fix owned-source baseline (TEST-006).
- [x] 7.3 Fix compiled integration path to root `dist/redshift`; forbid source fallback/skips and assert executable identity (CLI-013).
- [x] 7.4 Add true compiled CLI local-`nak` lifecycle E2E covering P0/P1 setup, redacted/raw state, exact argv, shell mode, environment scrubbing, child exit/signal, logical deletion, and partial-relay quorum boundaries (TEST-001).
- [x] 7.5 Install pinned `nak` in CI and run required compiled real-relay/bunker journeys unconditionally (TEST-002).
- [x] 7.6 Add compiled CLI NIP-46 E2E through pinned local signer (TEST-003).
- [x] 7.7 Add Playwright hosted and compiled embedded journeys with CLI interoperability and cleanup (WEB-001, TEST-004).
- [x] 7.8 Make CI/release require frozen install, scoped lint/format, all typechecks/tests/E2E/builds, generated consistency, native binary smoke, and attestation verification (TEST-007). Dependency audit remains separately deferred under 6.7/9.2 by explicit user instruction.

## 8. Product Truth and OpenSpec

- [x] 8.1 Update CLI/web/root docs for strict core contract, explicit reveal, custody, tombstone/retention, rotation limits, and supported platforms (GOV-001).
- [x] 8.2 Replace inaccurate “MVP Complete,” nonexistent `/tutorial`, complete deletion/custody, and broad Doppler-compatibility claims with test-backed current behavior (GOV-001).
- [x] 8.3 Verify completed NIP-46 prototype tasks/E2E, establish current core specs, and archive completed change without losing limitations (GOV-002). Archived as `2026-07-10-add-nip46-bunker-prototype` with current `cli-bunker-auth` and `nip46-bunker` specs.
- [x] 8.4 Reconcile Cloud pricing and Teams custody architecture in one planning baseline; mark alternatives deferred/proposed and keep product unavailable until operational approval (GOV-003).
- [x] 8.5 Record FEAT-001/002/003 as post-hardening proposals and FEAT-004/005/006 as explicit deferred scope; do not implement them in this program.
- [x] 8.6 Check every completed issue in `piolium/ALL-ISSUES-AND-GAPS.md` with regression-test references.

## 9. Final Verification

- [x] 9.1 `bun install --frozen-lockfile`.
- [ ] 9.2 Dependency audit passes or every unavoidable advisory has reviewed reachability, owner, and expiry. Deferred because the user explicitly requested no further security scanning.
- [x] 9.3 Scoped Biome and all typechecks pass.
- [x] 9.4 Crypto, CLI, web, relay, and package unit tests pass.
- [x] 9.5 Local real-`nak`, managed relay, NIP-46, compiled CLI, hosted preview, embedded browser, install/upgrade, and custom-relay E2E pass without skip/fallback. Credentialed production deployment/release execution remains external evidence.
- [x] 9.6 Web, embeds, CLI host/all-platform, and relay builds pass; regenerated output is deterministic.
- [x] 9.7 OpenSpec strict validation passes; Telos L9→L1→L9 final review converges.
- [x] 9.8 `git diff --check` passes and no temporary credentials/processes/artifacts remain.
