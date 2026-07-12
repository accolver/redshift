# Encrypted Local Backup and Restore Evidence

Date: 2026-07-11
Change: `add-encrypted-local-backup`
Branch: `feat/encrypted-local-backup`

## Certified scope

This tranche adds manual, local, passphrase-encrypted backup and restore for the authenticated owner's current non-tombstoned secret state observed from responding configured relays.

It does **not** back up or recover signer credentials, relay configuration, publication-recovery records, historical versions, tombstones, deleted ciphertext, managed-relay data, or unavailable-relay state. It does not provide automatic scheduling, retention, key recovery, an RPO/RTO, availability, or an SLA. Loss of the signer and all independently stored recovery material remains unrecoverable.

## Telos L9 → L1 → L9 convergence

### Downward validation

- **L9 — Telos Guardian:** encrypted local portability advances sovereign user control without introducing custody or managed-service dependence.
- **L8 — Market value:** a durable user-controlled archive closes a concrete resilience gap for the independently usable individual product.
- **L7 — Product strategy:** the narrow manual capability precedes authenticated history and managed backup rather than implying them.
- **L6 — Experience:** explicit create/restore commands, hidden or explicitly piped passphrases, identity-change authorization, conflict preflight, and truthful partial-progress output keep destructive behavior visible.
- **L5 — Journey:** real local-relay tests cover creation, fresh-session migration, conflicts, tampering, wrong passphrases, below-quorum publication, and exact-event recovery.
- **L4 — Contract:** the fixed v1 envelope, allowlisted payload, strict parser bounds, restore semantics, and release gates are specified in OpenSpec.
- **L3 — Components:** shared crypto, archive filesystem handling, hidden input, storage locking, SecretManager snapshots, and command orchestration remain separated.
- **L2 — Functions:** each boundary is typed and tested, with no `any`, no plaintext intermediate file, and bounded resource use.
- **L1 — Syntax/quality:** type checks, scoped Biome checks, deterministic generated assets, tests, and `git diff --check` pass.

### Upward validation

L1-L4 verification demonstrates that the format and CLI contract are implementable with the existing Bun/WebCrypto/Nostr stack. L5-L8 evidence demonstrates the complete user journey without custody, compatibility, history, or SLA overclaims. The two flows converge at L9: the capability materially improves sovereign resilience while preserving the product's non-custodial boundary.

## Security design

- Fixed 64-byte binary v1 envelope with fixed suite identifiers and pre-KDF structural checks.
- scrypt `N=131072, r=8, p=1`, 32-byte key, 16-byte random salt.
- AES-256-GCM with a 12-byte random nonce and the complete header as AAD.
- Canonical, exact-key, bounded JSON payload inside ciphertext.
- Independent Node `scryptSync`/AES-GCM reference comparison plus a real Chromium WebCrypto round trip.
- Best-effort clearing of owned passphrase bytes, plaintext bytes, derived keys, WebCrypto copies, and archive buffers.
- No passphrase argv, environment-variable, or configuration channel.
- Default prompting requires a TTY with raw-mode support; explicit stdin mode requires non-TTY stdin and exact line counts.
- Owner-only, no-follow archive handling with bounded reads, concurrent-growth detection, same-directory atomic installation, fsync, durable commit markers, rollback reconciliation, orphan cleanup, and SQLite cross-process serialization.
- Archive decryption and validation precede target authentication or relay activity.
- Restore preflights every entry before publication; conflicts abort by default, identical state is a no-op, and overwrite and identity migration are explicit.
- Same-identity events are newer than both observed destination and archived source versions while respecting future-skew bounds.
- Every publication uses existing quorum classification and durable exact-event recovery; persistence uncertainty includes the current event ID.
- Remote-signer uncertainty aborts snapshot/preflight instead of silently omitting authenticated state.

## Adversarial review resolution

The independent reviewer run `a6c417ed` identified canonical-order mismatch, setup-failure zeroization gaps, forced-replacement durability and mode issues, unbounded changing-file reads, TTY/stdin ambiguity, orphan cleanup, lock reopen race, transient signer omission, recovery-ID loss, unsafe explicit timestamps, authentication ordering, mutable snapshot objects, same-identity version regression, stale generated embeds, macOS certification gaps, incomplete test claims, process cleanup, and stale skill syntax.

All blocker/high/medium findings were addressed in code and tests. Generated embeds were rebuilt deterministically. The unavailable follow-up subagent capacity was replaced by direct line-by-line security review plus the complete production gate; no unresolved blocker/high/medium issue remains known.

## Verification

`bun run test:production` passed on 2026-07-11 with:

- zero dependency advisories in root/workspace and relay graphs;
- root, CLI, package, web, and relay type checks;
- strict scoped Biome lint and format checks;
- deterministic dashboard embed and relay generated-source checks;
- 139 shared-crypto tests;
- 12 rate-limiter tests;
- 572 CLI tests;
- 358 web unit/component tests across 19 files;
- 17 managed-relay tests;
- 15 compiled lifecycle tests, including 2 encrypted-backup local-relay journeys;
- 4 Chromium journeys, including the actual shared backup crypto round trip;
- strict validation of all active OpenSpec changes and canonical specs;
- no leaked repository workerd, local relay, or compiled CLI server process.

## Published release certification

- Release: https://github.com/accolver/redshift/releases/tag/v0.13.0
- Source: `0d92a207435b3c16b16ec4627f4e4b96012fa0b4`
- Release workflow: https://github.com/accolver/redshift/actions/runs/29167037057
- Main CI: https://github.com/accolver/redshift/actions/runs/29167037052
- Published: 2026-07-11T20:38:45Z as latest, non-draft, and non-prerelease

The release workflow passed its complete verify stage, built all four native assets, generated checksums and an SPDX SBOM, attested and source-bound every artifact, published the verified draft, and then passed fresh public installed-binary backup/restore/tamper/upgrade certification on native Linux x64, Linux arm64, macOS x64, and macOS arm64 runners. The automatic withdrawal job was correctly skipped because every certification job passed.

A separate local public-artifact check downloaded all v0.13.0 assets, verified every checksum, verified the macOS arm64 artifact's GitHub attestation against the release workflow and exact source digest, confirmed `redshift v0.13.0`, and confirmed installed help exposes `backup create` and `backup restore`.

Greptile was requested on PR #43 and polled for the full 15-minute window, but it produced no reaction, review, or finding. No Greptile result is represented as evidence. PR #43's Product Verification, Build Artifacts, and Cloudflare Pages checks passed, and no unresolved review thread existed before merge.
