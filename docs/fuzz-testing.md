# Deterministic fuzz testing

Redshift uses `fast-check` with Bun and Vitest to explore security-critical input and state combinations while keeping every run bounded and replayable. Generators use synthetic values only; never add production secrets or captured user payloads to a corpus.

## Required local suite

```bash
bun run test:fuzz
```

The required suite runs with fixed defaults:

- 250 cases per property;
- a stable base seed;
- a 30-second interrupt limit per assertion;
- property-specific derived seeds;
- shrinking and replay metadata on failure.

It covers shared crypto and serialization, CLI secret uploads, publication quorum behavior, relay validation/policy, and pure web models and search helpers. It also runs explicitly in CI and `bun run test:production`.

## Extended suite

```bash
bun run test:fuzz:extended
```

The extended default is 5,000 cases per property with a 120-second assertion limit. Override bounded settings when reproducing or exploring:

```bash
REDSHIFT_FUZZ_SEED=4242 \
REDSHIFT_FUZZ_RUNS=10000 \
REDSHIFT_FUZZ_TIME_MS=120000 \
bun run test:fuzz
```

`.github/workflows/fuzz.yml` runs the extended suite daily and supports manual seed and run-count inputs. Every run uploads `fuzz-replay.txt` and `fuzz-output.log` for 14 days. Shrink paths are intentionally replayed with a targeted local test so one property's path is not applied to unrelated properties.

## Replaying a minimized failure

A failed property reports:

- the property name;
- the base Redshift seed;
- the effective fast-check seed;
- the run count;
- a fast-check shrink path.

Replay with the reported base seed and path, targeting the failing test when useful:

```bash
REDSHIFT_FUZZ_SEED=4242 \
REDSHIFT_FUZZ_RUNS=5000 \
REDSHIFT_FUZZ_PATH='0:2:1' \
bun test packages/crypto/tests/fuzz.test.ts -t 'property name'
```

Overrides fail closed when malformed or outside these bounds:

- seed: signed or unsigned 32-bit integer, decimal or hexadecimal;
- runs: 1-100,000;
- time: 1,000-600,000 milliseconds;
- shrink path: numeric colon-separated fast-check path, at most 4,096 characters.

## Fixing discovered defects

1. Preserve the minimized input as a named ordinary regression test.
2. Confirm that example test fails before changing production code.
3. Fix the production implementation without weakening the property.
4. Replay the exact seed/path.
5. Run `bun run test:fuzz`, focused workspace tests, and `bun run test:production`.

Fuzzing complements rather than replaces known-answer crypto vectors, local-relay integration tests, browser journeys, native release tests, and independent review. It does not prove constant-time behavior, memory zeroization, availability, retention, RPO/RTO, or SLA readiness.
