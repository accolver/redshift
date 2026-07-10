# Redshift Security, CLI, and Product Audit

**Snapshot:** `main@9b98467`  
**Original assessment:** **NEEDS CHANGES before production use**  
**Remediation checkpoint (2026-07-10):** **CORE HARDENING VERIFIED LOCALLY; PRODUCTION RELEASE STILL GATED**  
**Scope:** README promises, CLI commands/flags, shared crypto, web dashboard, embedded dashboard, managed relay, distribution pipeline, tests, and roadmap/spec alignment.

The findings below preserve the audit evidence from the original snapshot. The remediation program fixed the release-blocking authorization, process-isolation, CLI, managed-relay, deletion, browser-auth, release-integrity, embedded-dashboard, and product-truth defects and added regressions listed in `piolium/ALL-ISSUES-AND-GAPS.md`. This does not claim that production deployment, live release attestations, backup/recovery operations, uptime/SLA controls, or a fresh dependency-security review have been completed.

## Executive Summary

Redshift has a credible cryptographic core and a substantial working prototype: NIP-59 wrapping, NIP-44/NIP-46 integrations, local key storage protections, CRUD, the built web dashboard, and hundreds of tests work. The core README journey can set and retrieve a secret against a local relay.

It is not production-ready. The most serious issue is an authorization flaw: any Nostr sender can write a valid Gift Wrap to a victim, Redshift accepts it as the victim's latest secret state, and `redshift run` injects attacker-controlled environment variables. A real local-relay reproduction confirmed the overwrite; a harmless `NODE_OPTIONS --import` reproduction confirmed the path can become code execution for Node commands. The CLI also passes `REDSHIFT_NSEC` into every launched application.

The product surface has release-blocking correctness gaps: the compiled `redshift serve` dashboard is blank, `run` corrupts argv and breaks `--command`, setup overwrites existing configuration, many documented flags are accepted but ignored, deletion claims exceed Nostr's actual guarantees, and the paid relay's authorization model is incompatible with Redshift's ephemeral Gift Wrap authors.

## System Understanding

- **CLI:** authenticates with local nsec or NIP-46, reads `redshift.yaml`, queries encrypted bundles from relays, and injects values into a child process.
- **Web:** SvelteKit dashboard with NIP-07, local nsec, and bunker auth; browser-side signing/encryption; EventStore-backed project/secret models.
- **Crypto:** NIP-59 rumor → seal → Gift Wrap using NIP-44, custom outer `t=redshift-secrets`, and d-tag `{project}|{environment}`.
- **Relay:** Cloudflare Worker/Durable Objects/D1 with NIP-42, payment checks, filters, storage, and a payment/login page.
- **Distribution:** GitHub Actions release binaries, `curl | sh` installer, and CLI self-upgrade.

## Confirmed Security Findings

| ID | Severity | Finding | Evidence / impact |
|---|---|---|---|
| C1 | Critical | Attacker-authored Gift Wrap becomes victim secret state | `packages/crypto/src/gift-wrap.ts:128-183,338-410`; `cli/src/lib/secret-manager.ts:265-310`; `web/src/lib/models/gift-wrap-secrets.ts:66-104,157-238`. Local-relay PoC showed attacker bundle won. Attacker-controlled `NODE_OPTIONS` can execute code in a Node child. |
| H1 | High | Master authentication credential inherited by child | `cli/src/commands/run.ts:111-138`; `cli/src/lib/secret-manager.ts:454-473`. Compiled CLI test returned `nsecPresent:true`. A dependency/application receives the key for every project, not just requested secrets. |
| H2 | High | Installer/updater accept unverified binaries | `web/static/install:47-77`; `cli/src/commands/upgrade.ts:164-225`; `.github/workflows/release.yml:47-69`. Live `v0.10.0` has no checksum/signature/attestation/SBOM and is mutable. |
| H3 | High | Relay executes mutable third-party signing script | `relay/nosflare/src/relay-worker.ts:2252` loads `nostr-login@latest` with `sign_event:1`; `PAY_TO_RELAY_ENABLED=true`. Package/CDN mutation executes in the relay's authentication/payment origin. |
| M1 | Medium | Config reads disclose fallback credentials | `cli/src/main.ts:303-319,422-437`. `configure get` and `configure --all` print fallback nsec/bunker keys. Isolated test confirmed exact credential output. |
| M2 | Medium | Paid relay read boundary is bypassable | `relay/nosflare/src/durable-object.ts:963-1075`. REQ requires any authenticated key but never checks payment or scopes filters; encrypted event/recipient/timing metadata can be enumerated. |
| M3 | Medium | Relay rate limits are per connection, not per pubkey | `durable-object.ts:580-585,645-651,986`. Parallel authenticated connections multiply quotas, enabling storage/query load amplification. |
| M4 | Medium | Bunker pairing secret can leak through argv/errors | `cli/src/commands/login.ts:42-63,130-175`; `cli/src/lib/bunker.ts:48-70`. The secret-bearing URI is visible in process listings and can be echoed in parse errors. |
| M5 | Medium | Local bunker performs expensive work for unbounded inbound traffic | `cli/src/lib/nip46-bunker.ts:319-372`. Any sender can force signature verification/decryption/response processing; no age, size, global, or per-client limit exists. |

### Required Security Fix Order

1. Require the decrypted rumor/seal author to equal the authenticated Redshift owner in **both** local-key and signer-backed CLI/web paths. Reject future timestamps and add deterministic tie-breaking.
2. Validate decrypted environment names before injection and block dangerous runtime hooks (`NODE_OPTIONS`, `PYTHONPATH`, `RUBYOPT`, loader/library injection variables, and Redshift auth variables).
3. Build the child environment from a scrubbed copy that removes `REDSHIFT_NSEC` and `REDSHIFT_BUNKER`.
4. Generate signed checksums/attestations during release; installer/updater must fail closed and atomically replace only after verification.
5. Vendor/pin the relay login script and apply a restrictive CSP.
6. Enforce payment and per-identity quotas on REQ; add bounded bunker request handling.

## Release-Blocking Functional Findings

### P0 — Core Journey

1. **`redshift serve` renders a blank dashboard.**  
   `cli/src/commands/serve.ts:22-34` sets `script-src 'self'`, but the SvelteKit static fallback uses an inline bootstrap. Repeated Chrome tests showed 0 interactive elements after 3 seconds. The same built app under Vite preview hydrated correctly with 10 controls. Existing binary tests assert only HTTP/HTML, not browser execution.

2. **`run` does not preserve argv and `--command` fails.**  
   `cli/src/commands/run.ts:27-78,130-138` joins already-tokenized argv and parses it again. Compiled CLI test changed `"hello world"` into two arguments. `run --command "printf ..."` exited 2 because `['sh','-c',value]` was re-tokenized.

3. **Setup overwrite/noninteractive semantics are reversed.**  
   `cli/src/main.ts:154-163` maps `--no-interactive` to `force=false`; ordinary setup uses `force=true`. An existing `redshift.yaml` was overwritten without a working/documented force flag.

4. **Managed relay writes are incompatible with Gift Wrap.**  
   `relay/nosflare/src/durable-object.ts:830-869` requires the event's pubkey to be authenticated and paid. NIP-59 outer authors are ephemeral and discarded by Redshift. Normal clients cannot authenticate/pay as those authors. For kind 1059, authorize the authenticated paid recipient/payer against the `p` tag instead of requiring the outer author.

5. **Deletion is incomplete and protocol claims are incorrect.**  
   `web/src/lib/stores/projects.svelte.ts:139-191,277-320` removes metadata but does not tombstone every secret d-tag. More fundamentally, NIP-09 only deletes referenced events authored by the deletion request's pubkey; user-signed kind-5 requests cannot erase Gift Wraps authored by discarded ephemeral keys. Historical ciphertext remains. Document this and design logical tombstones, key rotation/cryptographic erasure, and retention accordingly.

### P1 — CLI Contract and Reliability

6. **Help exposes functionality the dispatcher does not implement.** Run mount/fallback/clean/preserve-env flags; multi-key secret operations; interactive/no-interactive behavior; download file/format/passphrase; confirmations; and several global flags are parser/help-only (`cli/src/lib/cli.ts`; `cli/src/main.ts:167-257`). Remove unsupported flags or implement and test them.

7. **Unknown flags/subcommands fail open.** `strict:false` parsing accepts typos; `configure frobnicate --bogus` exited 0, and unknown bunker subcommands route to `start`.

8. **Custom relay handling is inconsistent.** `validateRelayUrl()` exists but configuration never calls it. The embedded CSP lists only built-ins, and the web app does not inherit CLI relay configuration.

9. **Multi-relay publish has ambiguous partial success.** `Promise.all(pool.publish(...))` reports failure if any relay fails even after another accepted the event. Use quorum/at-least-one semantics and report per-relay status.

10. **Same-second writes are nondeterministic.** Rumor timestamps have one-second resolution and replacement uses only `>`; integration tests sleep 1.1 seconds, avoiding the real edge case.

11. **Configured defaults are not consumed.** `defaultProject` is not used, and `defaultEnvironment` is accepted by configure but absent from the `Config` type and command resolution.

12. **Secret export controls are misleading.** JSON/env output reveals values regardless of `--raw`, while table `--raw` still truncates values over 50 characters. Download flags are not wired.

## Test and Tooling Findings (Audit Baseline)

| Check | Result |
|---|---|
| `bun run test:all` | **876 passed, 10 skipped**: crypto 122, CLI 429 + 10 skipped, web 325. |
| `cd cli && bun test ./tests/integration` | 10 passed, 10 skipped when local relay absent; NAK bunker E2E passed. Binary test silently used source because it looks for `cli/dist/redshift` instead of root `dist/redshift`. |
| Local `nak` relay integration | **8 passed, 2 failed**. `SecretManager.disconnect()` zeroizes the caller-owned shared key buffer, so later tests fail with `invalid scalar`. The documented real-relay mode is not green. |
| Compiled CLI local-relay journey | Setup/set/list/get succeeded. Confirmed argv split, broken `--command`, auth credential inheritance, config disclosure, and overwrite behavior. |
| Browser: built web preview | Hydrated; local nsec login worked; encrypted session storage used; logout cleared session values. |
| Browser: compiled `redshift serve` | HTTP routes/headers passed, but UI remained blank due to bootstrap CSP mismatch. |
| `bun run build:web`, `build:embeds`, `build:cli` | Passed. |
| Relay `typecheck` + `build` | Passed. |
| Web `svelte-check` | 0 errors, 0 warnings. |
| Root `tsc --noEmit` | Failed: cannot find `bun-types` despite `@types/bun`; tsconfig/dependency resolution is inconsistent. |
| `biome check .` | Failed with 13,952 errors because `.worktrees` and `.applesauce-src` are not ignored. Scoped product check still reported 940 formatting/lint issues and the 3.4 MiB generated embed exceeds Biome's 1 MiB limit. |
| Dependency audit | Root/web: 38 advisories; relay: 15. `yaml@2.8.2` is directly reachable and should be upgraded to `>=2.8.3`. |
| CodeQL / Semgrep | Completed before the request to stop further scanning; no additional scan is recommended until the confirmed issues are fixed. Generic alerts were mostly false positives or tooling paths; architecture-specific review found the critical issues above. |

## Remediation Verification (2026-07-10)

| Gate | Verified result |
|---|---|
| Frozen dependency resolution | Root and relay `bun install --frozen-lockfile` passed with Bun 1.3.14. |
| Scoped quality/type gates | Biome reported no owned-source errors; root `tsc`, web `svelte-check`, and relay `tsc` passed with zero diagnostics. |
| Product tests | Crypto/package 130, auxiliary package 2, CLI 477, and web 340 tests passed: **949 passed** total. Ten legacy optional-relay cases remained skipped, while required compiled local-`nak` relay and bunker journeys ran and passed. |
| Managed relay | **17 passed**, covering canonical verification, recipient policy, principal quotas, metadata, and landing-page integrity. |
| Browser release journeys | **2 Playwright tests passed**: standalone hydration/login UI and compiled embedded login → project → secret save → reload → compiled CLI retrieval over a configured local relay. |
| Builds | Web, deterministic embeds, root CLI, Darwin/Linux x64/arm64 native CLIs, relay worker, and Wrangler deployment dry-run passed. |
| Generated output | Rebuilding `embedded-files.ts` and `worker.js` produced identical SHA-256 hashes; `git diff --check` passed. |
| Specification | `bunx @fission-ai/openspec validate harden-production-readiness --strict` passed; final Telos L9→L1→L9 review converged. |

Follow-up work closed secret-bearing bunker CLI argv exposure (`SEC-008`) by requiring hidden stdin or command-scoped environment input for one-time pairing secrets. Residual local work remains explicitly open in the issue register: legacy plaintext credential fallback/local bunker custody (`SEC-013`), a fresh dependency audit (`SEC-017`, skipped per user instruction), resilient NIP-46 relay transport (`REL-003`), hosted admin `unsafe-inline` removal (`WEB-004`), broader compiled/installer interruption coverage, OpenSpec archive/current-truth work (`GOV-002`), and final Cloud/Teams architecture approval (`GOV-003`). Production relay deployment and real release-attestation verification require external Cloudflare/GitHub credentials and environments. Backup, retention, recovery, uptime, and SLA claims require operational evidence and drills.

## Feature Gaps and Suggested Work

### Next 1 — Stabilize the individual/free product

- Add automated local-relay E2E: `login/setup/secrets set/get/run`, exact argv, shell command, child exit/signal, environment scrubbing, author rejection, same-second writes, and one-relay-fails scenarios.
- Add Playwright/real-browser E2E for hosted and embedded dashboard: NIP-07 capability detection, nsec login/logout, project create/edit/delete, refresh/reload, import/export, and CLI interoperability.
- Make the capability matrix truthful: distinguish CLI client, web client, local bunker prototype, hosted relay, Teams proposal, and Cloud proposal.
- Fix root typecheck/lint/CI scope, then make typecheck, lint, dependency audit, browser E2E, and real compiled-binary tests required release gates.

### Next 2 — Recovery and trustworthy state

- Add secret history, compare, and restore **after** author/freshness/deletion semantics are corrected.
- Introduce rollback/future-timestamp protection and deterministic event ordering.
- Provide explicit relay status/quorum reporting and recovery from partial publication.
- Add export/backup formats only with honest encryption/passphrase behavior and recovery tests.

### Defer

- **Teams:** key custody, RBAC, member removal, and rotation threat model is unresolved across roadmap/spec/proposal. Do not build until a minimal invite → read/write → readonly denial → removal/rotation E2E contract is approved.
- **Cloud:** pricing conflicts (one-time sats vs monthly USD), managed relay is currently incompatible with normal Gift Wrap publishing, and backup/deletion guarantees are unresolved. Fix core sovereignty and reliability first.

## Telos Validation (L9→L1→L9)

Both directions converge on the same priority: secure author authorization, key isolation, truthful deletion, reliable CLI execution, and real journey tests directly serve user sovereignty and Doppler-like DX. Cloud/Teams do not outrank these foundations. The technically feasible path is to narrow claims and finish the individual product before adding custody or paid infrastructure complexity.

## Conclusion

The original C1/H1 and core journey blockers are fixed and locally verified against shipped binaries, real local relays, the embedded dashboard, and managed-relay policy tests. The sovereign individual product now has a substantially stronger, truthful core, but a production release remains conditional on the residual custody/transport/CSP/dependency gates and credentialed deployment/release verification above. History/restore, Teams, Cloud, backup, and SLA expansion remain deferred until those contracts and operational evidence are approved.
