## MODIFIED Requirements

### Requirement: Prioritized Resilience Follow-up
The roadmap SHALL identify classified per-relay recovery and user-initiated encrypted local backup/restore as shipped only after their named release evidence passes, while history/restore semantics, production monitoring, incident response, managed backup/retention, and recovery drills remain the next resilience tranche without shipped guarantees.

#### Scenario: Future resilience documentation
- **WHEN** a user reviews the next roadmap phase
- **THEN** shipped local capabilities link to named evidence and each remaining improvement states its current absence, intended guarantee, and evidence required before the guarantee may be advertised

#### Scenario: Resilience capability documentation
- **WHEN** a user reviews the resilience roadmap
- **THEN** released local capabilities link to named evidence and remaining improvements state their current absence, intended guarantee, and required evidence

## ADDED Requirements

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
