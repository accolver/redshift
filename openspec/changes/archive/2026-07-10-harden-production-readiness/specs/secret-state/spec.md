## ADDED Requirements

### Requirement: Authenticated Secret Ownership
The system SHALL accept a NIP-59 secret bundle as state only when its sole outer recipient, verified seal author, and decrypted rumor author all equal the authenticated Redshift owner.

#### Scenario: Owner-authored bundle
- **WHEN** a valid owner-authored Gift Wrap is addressed to that owner
- **THEN** the system accepts and decrypts it

#### Scenario: Attacker-authored bundle addressed to owner
- **WHEN** another key authors a valid Gift Wrap addressed to the authenticated owner
- **THEN** the system rejects it before state selection

#### Scenario: Malformed recipient structure
- **WHEN** a Gift Wrap has missing, duplicate, noncanonical, or wrong-recipient `p` tags
- **THEN** the system rejects it

### Requirement: Bounded and Deterministic Versions
The system SHALL reject invalid or more-than-300-seconds-future rumor timestamps and SHALL select observed state deterministically by inner timestamp and canonical identifier independent of relay/input order.

#### Scenario: Excessively future state
- **WHEN** an otherwise valid rumor is 301 seconds in the future
- **THEN** it is rejected

#### Scenario: Equal-second state
- **WHEN** two valid versions have the same inner timestamp
- **THEN** every input permutation selects the same version

#### Scenario: New write
- **WHEN** replacing observed state whose timestamp is current or future-within-tolerance
- **THEN** the new rumor timestamp is strictly greater than the selected version

### Requirement: Logical Secret Deletion
The system SHALL represent deletion as a newer authenticated empty bundle for every affected project/environment d-tag and SHALL NOT claim that NIP-09 erases ephemeral-authored Gift Wraps.

#### Scenario: Environment deletion
- **WHEN** a user deletes an environment
- **THEN** its empty tombstone reaches publication quorum before metadata/local state is removed

#### Scenario: Project deletion
- **WHEN** a user deletes a project with multiple environments
- **THEN** every environment d-tag receives a tombstone before local removal

#### Scenario: Historical relay query
- **WHEN** deletion succeeds and relay history is inspected
- **THEN** old ciphertext may still exist and the newest state is empty
