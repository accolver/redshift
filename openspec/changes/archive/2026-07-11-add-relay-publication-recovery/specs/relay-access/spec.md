## ADDED Requirements

### Requirement: Classified Per-Relay Outcomes
Every publication SHALL classify each normalized relay's final state as accepted, permanently rejected, or temporarily unavailable while preserving the exact event ID, quorum threshold, reasons, and compatibility accepted/failed fields.

#### Scenario: Mixed quorum success
- **WHEN** two relays accept, one permanently rejects, and one is unavailable while the threshold is two
- **THEN** publication succeeds as degraded and the report identifies every relay's classified state

#### Scenario: Confirmed duplicate event
- **WHEN** a retry receives a `duplicate` response and a bounded same-relay ID query returns the byte-identical valid event
- **THEN** the relay is classified as accepted

#### Scenario: Unconfirmed duplicate event
- **WHEN** a relay reports `duplicate` but the same-relay query is missing, mismatched, invalid, or times out
- **THEN** the relay remains unavailable and Redshift does not claim acceptance

#### Scenario: Typed permanent and transient reasons
- **WHEN** NIP-20 reasons use exact known prefixes
- **THEN** `invalid`, `pow`, `blocked`, and `restricted` are permanent; `rate-limited` and `error` are unavailable; and unknown or misleading text is unavailable

### Requirement: Immutable Publication Retry
Recovery SHALL retry the exact previously signed event only against relays classified unavailable, SHALL merge outcomes deterministically by normalized relay, and SHALL never retry a permanent rejection automatically.

#### Scenario: Retry after outage
- **WHEN** an unavailable relay recovers and the user retries a pending publication
- **THEN** that relay receives the identical event ID and its outcome becomes accepted without creating a new logical version

#### Scenario: Permanent rejection remains
- **WHEN** a record contains one restricted relay and one unavailable relay
- **THEN** retry attempts only the unavailable relay and preserves the restricted result for inspection
