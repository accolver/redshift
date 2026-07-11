# product-truth Specification

## Purpose
Keep product, security, deletion, commercial, and roadmap claims aligned with implemented and test-backed Redshift capabilities.
## Requirements
### Requirement: Test-Backed Capability Claims
README, roadmap, docs, help, and release notes SHALL describe only capabilities proven by named passing local and production gates and SHALL distinguish prototype, release-candidate, production, proposed, deferred, and unsupported behavior.

#### Scenario: Capability without a gate
- **WHEN** a user-facing claim cannot be linked to a passing capability test
- **THEN** it is removed, qualified, or marked proposed

#### Scenario: Production release claim
- **WHEN** Redshift is described as production-ready
- **THEN** the referenced release has passing dependency, native artifact, attestation, clean-install, compiled CLI, relay, and browser evidence

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

### Requirement: One Canonical Planning Baseline
Cloud pricing and Teams custody statements SHALL not conflict across roadmap/spec/proposals. One canonical planning baseline SHALL be identified without presenting it as an implemented offer, SLA, or production custody guarantee; alternatives SHALL be explicitly deferred or remain research proposals.

#### Scenario: Conflicting proposal
- **WHEN** two documents describe incompatible pricing or custody as current
- **THEN** the documentation gate fails until one canonical deferred baseline is recorded

### Requirement: Prioritized Resilience Follow-up
The roadmap SHALL identify per-relay recovery, encrypted backup/recovery, history/restore semantics, production monitoring, incident response, and recovery drills as the next resilience tranche without claiming them as shipped guarantees.

#### Scenario: Future resilience documentation
- **WHEN** a user reviews the next roadmap phase
- **THEN** each improvement states its current absence, intended guarantee, and evidence required before the guarantee may be advertised

