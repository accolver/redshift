## MODIFIED Requirements

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
