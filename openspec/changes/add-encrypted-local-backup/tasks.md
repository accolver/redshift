# Tasks: Add encrypted local backup and restore

## 0. Governance

- [x] 0.1 Create the high-priority Telos validation task.
- [x] 0.2 Run and document L9→L1→L9 validation; confirm convergence.
- [x] 0.3 Strictly validate this OpenSpec change and record the user's explicit implementation approval.

## 1. Shared backup format and cryptography

- [x] 1.1 Add the reviewed direct `@noble/hashes` dependency and confirm zero advisories/supply-chain regressions.
- [x] 1.2 Write failing known-answer and round-trip tests for the fixed binary v1 envelope, canonical payload, scrypt, AES-256-GCM, and random salt/nonce behavior.
- [x] 1.3 Write failing negative tests for wrong passphrases, header/ciphertext/tag tampering, unknown suites/versions, malformed lengths, trailing bytes, KDF bounds, Unicode ambiguity, payload canonicalization, duplicate entries/keys, and all resource limits.
- [x] 1.4 Implement strict shared envelope/payload encode, encrypt, decrypt, validate, and best-effort zeroization functions in `@redshift/crypto`.

## 2. Authenticated snapshot and strictly newer restore state

- [x] 2.1 Write failing `SecretManager` tests for detailed current-state snapshots including tombstones/version evidence and unchanged existing public APIs.
- [x] 2.2 Expose a bounded authenticated detailed snapshot API without exporting credentials, raw events, or recovery records.
- [x] 2.3 Write failing tests for publishing restore state strictly newer than observed current/future-within-tolerance versions.
- [x] 2.4 Add explicit created-at publication options while retaining existing default behavior and future-skew protection.

## 3. Safe passphrase and archive file handling

- [x] 3.1 Write failing hidden-input tests for whitespace preservation, create confirmation, exact piped-line counts, EOF/interrupt/error cleanup, stderr prompts, and no argv/environment passphrase path.
- [x] 3.2 Extract and harden the reusable hidden-input helper; preserve login behavior.
- [x] 3.3 Write failing archive filesystem tests for `0600`, no-follow regular files, bounds-before-read/KDF, no-clobber, forced atomic replacement, fsync, rollback, symlink/special-file rejection, and cleanup.
- [x] 3.4 Implement encrypted-only atomic write/read helpers with no plaintext intermediates.

## 4. CLI create and restore workflows

- [x] 4.1 Write failing parser/help tests for `backup create` and `backup restore`, including strict subcommand flags and rejection of passphrase argv/environment options.
- [x] 4.2 Write failing command tests for observed-state creation, exclusions, same/different identity, identical no-op, conflict abort with zero writes, explicit overwrite, strictly newer restore, deterministic order, partial publication, and non-secret output.
- [x] 4.3 Implement typed backup errors, parser/dispatch, create orchestration, preflight, restore publication, and truthful summaries.
- [x] 4.4 Ensure every restored publication uses existing quorum classification and durable exact-event recovery.

## 5. End-to-end and release evidence

- [x] 5.1 Add compiled CLI E2E with real local relays: multi-project source, encrypted `0600` archive, fresh config/identity restore, exact logical values, wrong-passphrase/tamper, conflict/no-write, identity-change, and cleanup.
- [x] 5.2 Add degraded/below-quorum restore E2E proving recovery records and exact unavailable-only retry.
- [x] 5.3 Include compiled backup E2E in CI, production verification, release verification, and workflow-policy tests.
- [x] 5.4 Extend public release certification to exercise backup/restore and tamper failure on installed native binaries.

## 6. Documentation and truth

- [x] 6.1 Document commands, passphrase handling, archive contents/exclusions, conflict/identity behavior, partial restore, and safe storage guidance in README/CLI docs/skill.
- [x] 6.2 Update resilience roadmap truth without claiming automatic/managed backup, complete relay state, history, key recovery, retention, RPO/RTO, availability, or SLA.

## 7. Final validation

- [x] 7.1 Zero-advisory audits, typechecks, Biome, generated-source checks, all package/CLI/web/relay tests, and compiled lifecycle tests pass.
- [x] 7.2 Independent cryptographic, filesystem, protocol, UX/truth, and release reviewers report no unresolved blocker/high/medium findings.
- [x] 7.3 Strict OpenSpec validation and `git diff --check` pass; no processes, plaintext, credentials, archives, temp files, ports, or generated artifacts remain.
- [ ] 7.4 Archive the completed OpenSpec change, merge through a passing PR, and certify the published immutable release artifact before marking backup shipped.
