# Change: Add deterministic fuzz and property testing

## Status

Approved for implementation by the user's explicit 2026-07-14 directive to prioritize code readiness, fuzz testing, and extensive automated tests. This change does not authorize managed-service deployment, production-data use, payment activation, or product claims.

## Why

Redshift's example-based tests and certified release journeys cover known cases well, but attacker-controlled secret files, backup payloads, Nostr events, relay filters, URLs, retry outcomes, and UI search inputs have combinatorial state spaces. Deterministic property testing can discover edge cases, shrink failures into reviewable regressions, and continuously exercise invariants without adding operational process or user telemetry.

## What Changes

- Add a test-only, exact-version property-testing dependency compatible with Bun and Vitest.
- Add a shared bounded fuzz configuration with deterministic default seeds, per-property seed derivation, environment-controlled run counts, replay metadata, and time limits.
- Add property suites for shared crypto/serialization, CLI upload parsing, publication quorum/retry behavior, relay event/policy validation, and web search/state helpers.
- Add a fast deterministic fuzz gate to normal CI and production-readiness verification.
- Add a separate scheduled/manual extended fuzz workflow that records the seed and run count required to reproduce failures.
- Preserve minimized failures as ordinary regression examples whenever a fuzz run finds a production defect.

## Non-Goals

- No managed-relay deployment or cloud-resource mutation.
- No production user data, secrets, telemetry, or identifying fuzz corpus.
- No claim that fuzzing proves cryptographic correctness, constant-time behavior, zeroization, availability, RPO/RTO, or SLA readiness.
- No browser monkey-testing, unbounded random loops, or flaky wall-clock assertions in this first tranche.
- No Cloud pricing, Teams, payment, or commercial onboarding work.

## Impact

- Affected specs: `quality-gates`.
- Affected systems: root test tooling, shared crypto and rate-limiter tests, CLI tests, web Vitest tests, relay Bun tests, CI, and the local production-readiness gate.
- Dependency impact: `fast-check` is development-only and is locked/audited in each dependency graph that imports it.

## Telos Validation

- **L9→L1:** More exhaustive fail-closed testing directly supports sovereignty by reducing secret corruption, cross-recipient disclosure, malformed-input crashes, and recovery failures while preserving custody and protocol contracts.
- **L1→L9:** Bun/Vitest-compatible bounded property tests, deterministic replay, strict TypeScript, and test-only dependencies are technically feasible without production telemetry or infrastructure.
- **Convergence:** Proceed with the smallest code-focused suite and CI integration. Defer operational deployment and governance work as explicitly requested.
