## 1. Shared history contract

- [x] 1.1 Write failing tests for deterministic ordering, equal-time ties, deduplication, tombstones, metadata-only key diffs, strict cursors, stale cursors, page bounds, and version caps.
- [x] 1.2 Implement typed shared history models and pure ordering/diff/pagination utilities in `@redshift/crypto` without value formatting or logging.
- [x] 1.3 Validate NIP-44 ciphertext structure locally before remote calls, treat every remote signer exception as uncertain, and cover provider errors whose text resembles malformed ciphertext.

## 2. CLI authenticated observation

- [x] 2.1 Write failing relay-filter tests for the fixed 1,000-event history observation cap without changing current-state filter behavior.
- [x] 2.2 Write failing `SecretManager` tests for owner/d-tag filtering, invalid-event omission, uncertain signer abort, deduplication, deterministic ordering, tombstones, truncation, defensive copies, and bounded results.
- [x] 2.3 Implement `fetchSecretHistory()` while preserving existing current-state APIs and cache behavior.
- [x] 2.4 Write failing tests for a second-observation current-version conflict and strictly newer restore timestamp.

## 3. CLI command and parser

- [x] 3.1 Write failing strict parser/help tests for `history list`, `history compare`, and `history restore`, including positional/flag combinations, limit/cursor/ID validation, `--yes`, and `--overwrite-current`.
- [x] 3.2 Write failing command tests for metadata-only table/JSON output, pagination, compare categories, tombstone labeling, no-op current restore, full-bundle restore, concurrent-current abort/override, partial publication, and non-secret errors.
- [x] 3.3 Implement typed history errors, command dispatch, deterministic output, second authenticated preflight, and restore through existing publication recovery.

## 4. Browser model and store

- [x] 4.1 Write failing model tests for authenticated version history, deterministic ties, tombstones, cap/truncation, and remote-signer uncertainty.
- [x] 4.2 Add a shared history observable to the existing decryption pipeline without duplicate decryptions.
- [x] 4.3 Write failing store tests for ephemeral history state, project/environment switching, current-change conflicts, tombstone restore, quorum recovery, and logout cleanup.
- [x] 4.4 Implement history state and restore orchestration through existing client-side signing, strict timestamps, and publication recovery.

## 5. Browser component and UX

- [x] 5.1 Write failing component tests for loading/error/empty/truncated states, current/history/tombstone labels, metadata-only comparison, confirmation copy, and changed-current override.
- [x] 5.2 Implement an accessible shadcn-based `SecretHistoryPanel` with Tokyo Night tokens, transition classes, no value rendering, and explicit full-bundle/tombstone restore confirmation.
- [x] 5.3 Integrate the panel into the selected environment page without URLs, server rendering, analytics, or persistent decrypted history.

## 6. End-to-end evidence

- [x] 6.1 Add compiled CLI real-relay E2E for multiple versions, tie ordering, pagination, comparison, tombstone, restore-as-new, current-change abort, and below-quorum recovery.
- [x] 6.2 Extend Chromium local-relay E2E to inspect history, compare key changes, restore a live version and tombstone, handle a changed-current conflict, and prove no plaintext in URL/console/network output.
- [x] 6.3 Assert relay/server/process/port/temp/key cleanup on every success and failure path.
- [x] 6.4 Include history E2E explicitly in CI, production verification, release verification, workflow-policy tests, and public installed-binary certification.

## 7. Documentation and truth

- [x] 7.1 Correct roadmap/resilience text to identify v0.12.0 recovery and v0.13.0 encrypted backup as shipped with named evidence.
- [x] 7.2 Document CLI/web history commands, observed/truncated semantics, tombstones, metadata-only comparison, explicit restore, concurrency limits, and publication recovery.
- [x] 7.3 Keep complete history, audit/compliance logs, local persistence, retention, cryptographic erasure, managed backup, RPO/RTO, and SLA claims explicitly unavailable.
- [x] 7.4 Replace the archived local-backup spec's placeholder Purpose with current product truth.

## 8. Final validation and release

- [x] 8.1 Run strict OpenSpec validation, zero-advisory audits, typechecks, scoped Biome, generated-source checks, all package/CLI/web/relay tests, compiled lifecycle tests, and Chromium journeys.
- [x] 8.2 Run independent security/correctness/UX/product-truth reviews and resolve every blocker/high/medium finding.
- [x] 8.3 Run the aggregate production gate, diff/leak/process cleanup checks, and pre-commit build/test requirements.
- [ ] 8.4 Merge through passing PR checks, publish/certify the immutable release artifacts on all supported architectures, record evidence, and archive the OpenSpec change in a separate PR.
