# secret-history Specification

## Purpose
TBD - created by archiving change add-authenticated-secret-history. Update Purpose after archive.
## Requirements
### Requirement: Bounded Authenticated History Observation
The system SHALL expose only NIP-59 versions whose sole outer recipient, verified seal author, decrypted rumor author, and exact d-tag match the authenticated owner and requested project/environment. It SHALL deduplicate by outer event ID, apply fixed observation/version bounds, and describe results as observed from responding configured relays rather than complete history.

#### Scenario: Multiple relays return one event
- **WHEN** the same valid Gift Wrap is returned by multiple relays
- **THEN** it appears exactly once in observed history

#### Scenario: Unauthorized or wrong d-tag event
- **WHEN** an event fails owner validation or decrypts to another project/environment
- **THEN** it does not participate in history, comparison, current selection, or restore

#### Scenario: Observation cap
- **WHEN** the outer-event or per-d-tag version cap is reached
- **THEN** results are bounded, marked truncated, and never described as complete or durable history

#### Scenario: Remote signer uncertainty
- **WHEN** a remote signer times out, denies, loses transport, or returns an unclassified decryption failure
- **THEN** history loading fails rather than caching the event as unrelated and silently omitting possible state

### Requirement: Deterministic History Order and Pagination
Authenticated versions SHALL sort by inner rumor timestamp descending and then lowest outer event ID first, independent of relay/input order. Pagination SHALL use a strict non-secret cursor identifying an exact observed version and SHALL reject malformed, stale, or out-of-result cursors.

#### Scenario: Equal timestamp versions
- **WHEN** two authenticated versions share an inner timestamp
- **THEN** the lower outer event ID appears first and is the deterministic current version

#### Scenario: Stable next page
- **WHEN** a valid cursor references a version in the current observed result
- **THEN** the next page starts immediately after that exact version with no duplicate

#### Scenario: Stale cursor
- **WHEN** a cursor is malformed or no longer present in the bounded observed result
- **THEN** pagination fails explicitly before displaying a misleading page

### Requirement: Metadata-Only History Comparison
The system SHALL compare two authenticated versions by secret-key presence and value equality while exposing only sorted key names and added, removed, changed, or unchanged categories. It SHALL NOT emit secret values to command output, logs, URLs, analytics, server rendering, or persistent browser storage.

#### Scenario: Changed value
- **WHEN** one key exists in both versions with unequal plaintext values
- **THEN** the key is reported as changed without either value

#### Scenario: Tombstone comparison
- **WHEN** one version is an authenticated empty bundle
- **THEN** comparison identifies its tombstone status and key removals without describing cryptographic erasure

### Requirement: Restore as a New Authorized Version
Restoring history SHALL require explicit destructive consent, re-observe authenticated current state immediately before publication, and publish the selected live bundle or tombstone as a newly signed version strictly newer than the re-observed current version through existing quorum and durable exact-event recovery. It SHALL never modify, delete, or claim erasure of prior events.

#### Scenario: Restore prior live bundle
- **WHEN** the selected authenticated historical bundle is not current and the user confirms restore
- **THEN** the complete selected bundle is published as a new owner-authorized version and destination-only current keys are not merged

#### Scenario: Restore tombstone
- **WHEN** the selected authenticated version is empty and the user confirms restore
- **THEN** a newer logical tombstone is published and output describes logical deletion, not relay erasure

#### Scenario: Current changed during preflight
- **WHEN** the current authenticated event ID differs between initial selection and the immediate pre-publication observation
- **THEN** restore aborts before signing/publication unless the user explicitly authorizes overwriting the newly observed current bundle

#### Scenario: Publication uncertainty
- **WHEN** restore publication is below quorum or final recovery persistence is uncertain
- **THEN** the command/UI reports the exact event ID and existing recovery guidance without generating an automatic replacement event

#### Scenario: Concurrent publication after preflight
- **WHEN** another writer publishes after the immediate pre-publication observation
- **THEN** documentation does not claim compare-and-swap, global atomicity, or guaranteed conflict prevention
