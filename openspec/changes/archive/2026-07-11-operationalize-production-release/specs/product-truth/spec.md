## MODIFIED Requirements

### Requirement: Test-Backed Capability Claims
README, roadmap, docs, help, and release notes SHALL describe only capabilities proven by named passing local and production gates and SHALL distinguish prototype, release-candidate, production, proposed, deferred, and unsupported behavior.

#### Scenario: Capability without a gate
- **WHEN** a user-facing claim cannot be linked to a passing capability test
- **THEN** it is removed, qualified, or marked proposed

#### Scenario: Production release claim
- **WHEN** Redshift is described as production-ready
- **THEN** the referenced release has passing dependency, native artifact, attestation, clean-install, compiled CLI, relay, and browser evidence

## ADDED Requirements

### Requirement: Prioritized Resilience Follow-up
The roadmap SHALL identify per-relay recovery, encrypted backup/recovery, history/restore semantics, production monitoring, incident response, and recovery drills as the next resilience tranche without claiming them as shipped guarantees.

#### Scenario: Future resilience documentation
- **WHEN** a user reviews the next roadmap phase
- **THEN** each improvement states its current absence, intended guarantee, and evidence required before the guarantee may be advertised
