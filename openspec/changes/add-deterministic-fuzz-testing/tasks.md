# Tasks: Deterministic fuzz and property testing

## 0. Alignment and Baseline

- [x] 0.1 Complete Telos L9→L1→L9 validation and confirm the change is test-only/product-code hardening.
- [x] 0.2 Record baseline targeted tests, type checks, dependency audit, and current coverage behavior.
- [x] 0.3 Strictly validate this OpenSpec change before implementation.

## 1. Test Harness

- [x] 1.1 Add exact-version test-only property-testing dependencies to the root and relay lock graphs.
- [x] 1.2 Add tests first for deterministic seed derivation, bounded environment overrides, and invalid-configuration rejection.
- [x] 1.3 Implement the shared fuzz configuration helper with replay metadata and resource caps.

## 2. Shared Crypto and CLI Properties

- [x] 2.1 Add `.env` format/parse round-trip, issue-line, duplicate, and CLI normalization properties.
- [x] 2.2 Add slug and d-tag validation/round-trip properties.
- [x] 2.3 Add canonical backup payload encode/decode and malformed payload/header properties without real-KDF-per-case work.
- [x] 2.4 Add NIP-44/Gift Wrap round-trip, tamper, recipient/type, and bounded-structure properties.
- [x] 2.5 Add authenticated-history ordering, permutation, diff partition, cursor, pagination, and defensive-copy properties.
- [x] 2.6 Preserve every discovered defect as a minimized ordinary regression test before fixing production code.

## 3. Relay and Rate-Limiter Properties

- [x] 3.1 Add quorum projection, deduplication, threshold, merge monotonicity, and hostile-reason properties.
- [x] 3.2 Add arbitrary-JSON event-shape and signature rejection properties.
- [x] 3.3 Add exact Gift Wrap recipient/type/write-policy and recipient-scoped read-filter properties.
- [x] 3.4 Add relay URL normalization properties for schemes, credentials, query/fragment ambiguity, and canonical output.
- [x] 3.5 Preserve every discovered defect as a minimized ordinary regression test before fixing production code.

## 4. Web Properties

- [x] 4.1 Add search match/score consistency, stable ordering, subset, and input-immutability properties.
- [x] 4.2 Add focused pure model/state properties where semantics are already explicit and no refactor is required.
- [x] 4.3 Preserve every discovered defect as a minimized ordinary regression test before fixing production code.

## 5. Required and Extended Gates

- [x] 5.1 Add root and relay fuzz scripts with documented seed/run/time overrides.
- [x] 5.2 Include the bounded required fuzz tier in CI and `test:production`.
- [x] 5.3 Add a scheduled/manual extended fuzz workflow that varies and records a reproducible seed.
- [x] 5.4 Add documentation for local replay and minimized regression handling.

## 6. Verification

- [x] 6.1 Run focused fuzz suites at default and extended run counts.
- [x] 6.2 Run frozen installs, dependency audits, type checks, lint/format, deterministic generated-source checks, and full workspace tests.
- [x] 6.3 Run `bun run test:production`, strict OpenSpec validation, and `git diff --check`.
- [x] 6.4 Obtain independent adversarial review of generators, invariants, runtime bounds, CI behavior, and discovered fixes.
