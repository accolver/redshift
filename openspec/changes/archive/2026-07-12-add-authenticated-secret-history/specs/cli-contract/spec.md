## ADDED Requirements

### Requirement: Strict Authenticated History Commands
The CLI SHALL provide `history list`, `history compare`, and `history restore` for one validated project/environment. It SHALL strictly validate subcommand-specific positions, lowercase event IDs, page limits, exact cursors, explicit restore consent, and changed-current overwrite authorization while keeping stdout machine-parseable and secret-value-free.

#### Scenario: List parsing and output
- **WHEN** a user invokes `history list` with optional project, config, limit, cursor, or JSON flags
- **THEN** the CLI returns only authenticated version metadata, key counts, tombstone/current status, truncation state, and a next cursor without secret values

#### Scenario: Compare parsing and output
- **WHEN** a user invokes `history compare <from-event-id> <to-event-id>`
- **THEN** both exact authenticated versions must belong to the requested d-tag and output contains only sorted key names and change categories

#### Scenario: Restore confirmation
- **WHEN** a user invokes `history restore <event-id>` without `--yes`
- **THEN** the CLI refuses before signing or publication

#### Scenario: Changed-current override boundary
- **WHEN** `--overwrite-current` is supplied to list/compare or without restore confirmation
- **THEN** strict parsing rejects the unsupported combination

#### Scenario: Unknown input
- **WHEN** an event ID, cursor, limit, flag, positional value, or subcommand is malformed, unknown, missing, or excessive
- **THEN** the CLI exits nonzero before authentication, decryption, or relay publication where structurally possible

#### Scenario: Partial restore publication
- **WHEN** history restore reaches degraded quorum, fails below quorum, or has uncertain local recovery persistence
- **THEN** warnings use stderr, stdout contains no secret values, and the exact event remains available through the existing recovery workflow
