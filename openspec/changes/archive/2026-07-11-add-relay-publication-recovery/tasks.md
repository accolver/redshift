# Tasks: Add per-relay publication recovery

## 0. Governance

- [x] 0.1 Create the high-priority Telos validation task.
- [x] 0.2 Run L9→L1→L9 validation and confirm convergence.
- [x] 0.3 Create and strictly validate this OpenSpec change; the user's instruction to continue the prioritized resilience work approves implementation.

## 1. Shared classified quorum model

- [x] 1.1 Write failing tests for accepted, permanently rejected, unavailable, duplicate, and merged retry outcomes.
- [x] 1.2 Add strict classified outcomes while retaining compatible accepted/failed report fields.
- [x] 1.3 Add retry-target selection and immutable outcome merging helpers.

## 2. CLI durable recovery

- [x] 2.1 Write failing storage tests for pre-network atomic/fsynced `0700`/`0600` records, schema/event/relay validation, authenticated owner/d-tag binding, no-symlink checks, bounds, tampering, uncertainty, and cleanup.
- [x] 2.2 Persist provisional exact signed events before network publication and final degraded/below-quorum outcomes without plaintext secrets or credentials.
- [x] 2.3 Write parser/command tests for recovery list/show/retry/remove.
- [x] 2.4 Implement recovery commands with same-owner authentication and unavailable-only exact-event retry.
- [x] 2.5 Add concise degraded-success and failed-quorum output with per-relay states.

## 3. Browser recovery

- [x] 3.1 Write store tests for pre-network classified state, validated session persistence, persistence uncertainty, immutable retry, permanent-failure exclusion, and every logout/disconnect cleanup path.
- [x] 3.2 Implement reactive publication recovery state and exact-event retry.
- [x] 3.3 Add a compact shadcn-based recovery panel with accepted/rejected/unavailable details and retry controls.

## 4. End-to-end evidence

- [x] 4.1 Add compiled CLI E2E for accepted/rejected/unavailable outcomes and recovered retry using the same event bytes/ID and asserted per-relay publish counts.
- [x] 4.2 Add five-relay Playwright coverage for quorum-degraded success, detail display, unavailable-only retry, convergence, per-relay counts, and logout cleanup.
- [x] 4.3 Ensure every relay/process/port/temp record is cleaned in success and failure paths.

## 5. Documentation and truth

- [x] 5.1 Document recovery commands, storage/security semantics, and degraded redundancy in CLI/docs/skills.
- [x] 5.2 Update `docs/resilience-next.md` and roadmap truth only after the gates pass.

## 6. Final validation

- [x] 6.1 Zero-advisory audits, typechecks, scoped Biome, generated-source checks, and all product/relay tests pass.
- [x] 6.2 Compiled lifecycle and Playwright release gates pass without skips.
- [x] 6.3 Strict OpenSpec validation and `git diff --check` pass; no processes, credentials, temp records, or generated artifacts remain.
