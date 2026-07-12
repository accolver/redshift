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
The roadmap SHALL identify classified per-relay recovery, user-initiated encrypted local backup/restore, and authenticated bounded history/compare/restore as shipped only after each capability's named release evidence passes. Production monitoring, incident response, managed backup/retention, sustained release canaries, and recovery drills SHALL remain future work without shipped guarantees.

#### Scenario: Future resilience documentation
- **WHEN** a user reviews the next roadmap phase
- **THEN** shipped local capabilities link to named evidence and each remaining improvement states its current absence, intended guarantee, and evidence required before the guarantee may be advertised

#### Scenario: Resilience capability documentation
- **WHEN** a user reviews the resilience roadmap
- **THEN** released local capabilities link to named evidence and remaining improvements state their current absence, intended guarantee, and required evidence

#### Scenario: History claim boundary
- **WHEN** authenticated history is documented or released
- **THEN** it is described as bounded owner-authenticated state observed from responding relays, not complete retention, an audit log, offline recovery, cryptographic erasure, compare-and-swap, RPO/RTO, or an SLA

### Requirement: Publication Redundancy Truth
Product surfaces SHALL distinguish logical quorum success from full configured-relay redundancy and SHALL describe recovery as republishing existing encrypted ciphertext, not backup, history, cryptographic erasure, or an availability guarantee.

#### Scenario: Degraded success copy
- **WHEN** an encrypted secret mutation reaches quorum but misses one or more relays
- **THEN** the user is told the secret state is saved with degraded relay redundancy and is offered inspection/retry

#### Scenario: Recovery documentation
- **WHEN** CLI or web recovery is documented
- **THEN** the documentation states that exact ciphertext may already exist on some relays and retry does not delete historical relay data

### Requirement: Local Backup Claim Boundary
Product surfaces SHALL describe encrypted backup as a user-initiated local snapshot of current logical state observed from responding configured relays and restore as newly signed state under a separately authenticated target signer. They SHALL NOT describe it as automatic/managed/offsite retention, complete relay history, key/passphrase/account recovery, globally atomic restore, cryptographic erasure, availability, RPO/RTO, geographic redundancy, or an SLA.

#### Scenario: Capability documentation
- **WHEN** local encrypted backup/restore is documented
- **THEN** contents, exclusions, signer requirements, relay-observation boundary, conflict policy, and partial-restore behavior are explicit

#### Scenario: Managed backup wording
- **WHEN** documentation mentions automatic backup, retention, restore drills, RPO/RTO, or availability
- **THEN** those claims remain deferred until separate managed production evidence exists

#### Scenario: Fresh identity wording
- **WHEN** documentation describes restore into a fresh identity or session
- **THEN** it states that the target signer must already be authenticated and no nsec, bunker key, or signer access is restored from the archive

