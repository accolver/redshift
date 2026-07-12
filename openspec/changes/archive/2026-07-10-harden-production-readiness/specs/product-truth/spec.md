## ADDED Requirements

### Requirement: Test-Backed Capability Claims
README, roadmap, docs, and help SHALL describe only capabilities proven by named passing gates and SHALL distinguish prototype, production, proposed, deferred, and unsupported behavior.

#### Scenario: Capability without a gate
- **WHEN** a user-facing claim cannot be linked to a passing capability test
- **THEN** it is removed, qualified, or marked proposed

### Requirement: Truthful Security and Deletion Language
Documentation SHALL state the actual key custody, raw-output, relay-retention, logical-deletion, and post-exposure guarantees without claiming cryptographic erasure of retained NIP-59 ciphertext.

#### Scenario: Deletion documentation
- **WHEN** a user reads project/environment deletion guidance
- **THEN** it explains tombstones, possible retained ciphertext, relay policy, and rotation limits

### Requirement: Current OpenSpec Truth
Completed implemented changes SHALL be verified and archived; current individual-product capability specs SHALL be established; incomplete Cloud/Teams/Enterprise work SHALL remain deferred proposals and SHALL not be described as shipped.

#### Scenario: Prototype completion
- **WHEN** every bunker prototype task and E2E gate passes
- **THEN** the change may be archived with its limitations retained in current specs

### Requirement: One Approved Commercial and Custody Model
Cloud pricing and Teams custody statements SHALL not conflict across roadmap/spec/proposals. Unapproved alternatives SHALL be explicitly superseded or remain proposals.

#### Scenario: Conflicting proposal
- **WHEN** two documents describe incompatible pricing or custody as current
- **THEN** the documentation gate fails until one approved decision is recorded
