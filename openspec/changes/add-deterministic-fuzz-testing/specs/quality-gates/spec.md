## ADDED Requirements

### Requirement: Deterministic Property and Fuzz Gate

Redshift's required test gate SHALL run bounded property tests over security-critical parsing, serialization, authorization, ordering, retry, and state-selection invariants using synthetic inputs only. Every property SHALL use a reproducible seed, bounded case count, and bounded interrupt time.

#### Scenario: Property failure

- **WHEN** a generated case violates a required invariant
- **THEN** the gate fails nonzero and reports enough seed/path information to replay the minimized case
- **AND** the invariant is not weakened merely to make the fuzz suite pass

#### Scenario: Invalid fuzz configuration

- **WHEN** a seed, run count, or time limit override is malformed or exceeds the documented bound
- **THEN** the harness fails closed before executing a reduced or unbounded suite

### Requirement: Security-Critical Fuzz Coverage

The required property suite SHALL cover shared secret-file parsing, canonical backup payloads, NIP-59/NIP-44 boundaries, authenticated history, CLI secret upload normalization, publication quorum/retry state, relay event validation and recipient-scoped policy, and pure web search/state helpers.

#### Scenario: Malformed attacker-controlled input

- **WHEN** a generated malformed file, payload, event, filter, URL, relay reason, or state value reaches a public validation boundary
- **THEN** it is rejected or normalized according to the documented contract without secret disclosure, cross-recipient access, unsafe mutation, unbounded work, or an uncaught process-level failure

#### Scenario: Valid round trip

- **WHEN** a generated valid value is serialized and parsed or encrypted and decrypted through a supported round trip
- **THEN** the semantic value and required authentication metadata are preserved exactly

### Requirement: Extended Replayable Fuzzing

CI SHALL provide a scheduled and manually dispatchable extended fuzz tier that increases bounded run counts, varies a recorded seed, and remains reproducible without production credentials or production data.

#### Scenario: Scheduled fuzz run

- **WHEN** the extended workflow runs
- **THEN** it records the effective seed and run count
- **AND** executes with frozen dependencies and bounded resources
- **AND** exposes failures through retained CI logs or artifacts without including user secrets

### Requirement: Fuzz Regression Preservation

A production defect discovered by property testing SHALL retain the minimized input as an ordinary deterministic regression test before the production fix is considered complete.

#### Scenario: Discovered parser defect

- **WHEN** shrinking produces a minimal input that violates a parser or formatter invariant
- **THEN** that input remains covered by a named example test after the implementation is fixed
