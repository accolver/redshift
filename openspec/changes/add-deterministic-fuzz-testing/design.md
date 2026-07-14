# Design: Deterministic fuzz and property testing

## Context

Redshift has strong example, integration, browser, and release-artifact tests. The remaining code-readiness gap is systematic exploration of attacker-controlled and state-combinatorial inputs. Bun does not provide a built-in property engine; `fast-check` supports Bun directly and provides shrinking and replay metadata.

## Goals

- Discover malformed-input, serialization, authorization, ordering, mutation, and resource-bound defects.
- Make every failure reproducible locally from a seed and shrink path.
- Keep normal CI bounded and fast while offering a deeper scheduled/manual tier.
- Reuse production APIs without adding test-only branches to shipped code.

## Decisions

### Decision: Use exact-version `fast-check` as a development dependency

Use `fast-check@4.9.0` in the root graph and the independently installed relay graph. It is runner-agnostic, works with `bun:test` and Vitest, and provides shrinking that a small custom PRNG would not.

Rejected alternative: a hand-written xorshift loop. It avoids a dependency but lacks shrinking, rich arbitraries, async properties, and model-based extension points; those limitations reduce defect-finding value and increase custom test infrastructure.

### Decision: Bounded deterministic defaults with explicit replay controls

A shared helper reads:

- `REDSHIFT_FUZZ_SEED` — signed/unsigned integer or hexadecimal base seed;
- `REDSHIFT_FUZZ_RUNS` — bounded cases per property;
- `REDSHIFT_FUZZ_TIME_MS` — bounded interrupt time per assertion;
- `REDSHIFT_FUZZ_PATH` — optional bounded fast-check shrink path for targeted local replay.

Normal tests use fixed defaults and derive a stable seed from the property name so properties do not consume identical streams. A custom reporter identifies the property, base seed, derived seed, run count, and fast-check shrink path. Invalid environment values fail the test harness instead of silently weakening coverage.

### Decision: Two execution tiers

- **Required tier:** bounded properties run in normal workspace tests and `test:production`.
- **Extended tier:** scheduled/manual workflow increases run counts and varies the recorded base seed. It uses synthetic generated inputs only and uploads replay metadata and output through ordinary Actions retention. Exact shrink-path replay remains a targeted local command so the path is not incorrectly applied to unrelated properties.

### Decision: Start at pure trust boundaries

The first tranche targets:

1. `.env` formatting/parsing and CLI upload normalization;
2. d-tag, slug, backup payload, NIP-44/Gift Wrap, and authenticated-history invariants;
3. quorum algebra, relay-reason sanitization, and terminal outcome preservation;
4. relay event-shape/signature rejection, exact recipient/type policy, filter scoping, and relay URL normalization;
5. web search/filter/sort consistency and immutability.

Browser action fuzzing, D1 differential query testing, Durable Object concurrency models, filesystem fault injection, and real-KDF-per-case testing are deferred to later bounded tranches.

### Decision: Fuzzing must remain secret-safe and resource-bounded

Generators use synthetic values only. Failure output must not include real credentials or user data. Arrays, strings, event counts, and crypto payloads are capped. Real scrypt vectors remain in the ordinary backup tests; property tests use canonical payload encoding or injected cheap keys where encryption behavior is exercised.

## Failure Handling

When a property finds a production defect:

1. preserve the failing seed/path in the test output;
2. add the minimized case as an ordinary regression test;
3. fix the production function without weakening the property;
4. rerun the exact replay and the full required tier.

## Risks and Mitigations

- **Runtime growth:** cap normal runs and assertion time; isolate the extended tier.
- **Flakiness:** fixed default seeds, no `Math.random`, no wall-clock races.
- **False confidence:** state explicitly that property testing complements rather than replaces integration, browser, native-platform, crypto-vector, and release-artifact tests.
- **Dependency risk:** exact version, frozen locks, low-level audits, development-only placement.
- **Sensitive failure output:** synthetic generators only and no production corpora.
