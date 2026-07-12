## ADDED Requirements

### Requirement: Durable CLI Publication Recovery
Before any network attempt, the CLI SHALL atomically persist and fsync a bounded, versioned provisional recovery record in a mode-`0700` directory and mode-`0600` regular file. Final outcomes SHALL atomically replace it. The record SHALL contain only owner/project/environment metadata, the encrypted signed event, relay snapshot, quorum state, and classified outcomes.

#### Scenario: Degraded quorum success
- **WHEN** publication reaches quorum but one relay is unavailable
- **THEN** the command succeeds with a degraded warning and stores the exact event for later retry

#### Scenario: Below quorum
- **WHEN** publication fails below quorum after one relay accepted
- **THEN** the command fails closed while preserving the exact accepted event and all relay outcomes in recovery storage

#### Scenario: Tampered recovery record
- **WHEN** filename/event/report identity, signature, owner tags, authenticated unwrap owner/d-tag, relay URL, schema, symlink status, or bound is invalid
- **THEN** recovery refuses before any relay publication and reports the invalid record

#### Scenario: Outcome persistence failure
- **WHEN** remote publication may have occurred but final outcome replacement fails
- **THEN** the provisional record remains and the command fails with the event ID and an explicit uncertainty warning without generating another event

### Requirement: CLI Recovery Workflow
The CLI SHALL provide list, show, retry, and remove operations for pending publications. Retry SHALL require current authentication matching the record owner and SHALL publish the exact event only to unavailable relays.

#### Scenario: Same-owner retry
- **WHEN** the authenticated owner retries a valid record after a relay recovers
- **THEN** the CLI updates per-relay outcomes and removes the record only when every original relay is accepted

#### Scenario: Permanent rejection remains
- **WHEN** all unavailable relays recover but one original relay is permanently rejected
- **THEN** the record remains inspectable until explicit removal

#### Scenario: Different owner
- **WHEN** a different authenticated identity attempts retry
- **THEN** the CLI refuses before any relay publication

#### Scenario: Explicit removal
- **WHEN** the user removes a pending or permanently rejected record
- **THEN** the local recovery record is deleted without publishing or claiming relay deletion
