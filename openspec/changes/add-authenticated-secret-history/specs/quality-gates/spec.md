## ADDED Requirements

### Requirement: Authenticated History Evidence
CI, production, and release gates SHALL exercise shared history ordering/diff/pagination, authenticated CLI and browser observation, tombstone semantics, restore-as-new publication, changed-current conflict handling, exact-event recovery, and cleanup against deterministic real local relays without conditional skip.

#### Scenario: Compiled CLI history journey
- **WHEN** the exact compiled CLI observes multiple live/tombstone/tied versions from real local relays
- **THEN** ordering, pagination, metadata-only comparison, restore-as-new state, changed-current abort, and below-quorum recovery are verified without source fallback

#### Scenario: Browser history journey
- **WHEN** Chromium loads history for the selected environment and restores a live version or tombstone
- **THEN** current/history labels, key-level metadata comparison, confirmation, conflict handling, converged CLI state, and publication recovery are verified with no plaintext in URL, console, unexpected network output, or persistent storage

#### Scenario: Resource and signer failures
- **WHEN** history reaches a fixed cap or remote signer decryption is uncertain
- **THEN** tests prove bounded/truncated output or fail-closed behavior rather than silent omission

#### Scenario: Cleanup
- **WHEN** any history journey succeeds or fails
- **THEN** no signer key, plaintext artifact, browser history state, relay/server process, port, temporary config, or recovery fixture remains

#### Scenario: Public release certification
- **WHEN** a supported native release artifact is certified
- **THEN** installed-binary history list/compare/restore and tamper/authorization failure paths execute before the release remains latest
