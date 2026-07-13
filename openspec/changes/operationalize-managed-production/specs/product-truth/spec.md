## ADDED Requirements

### Requirement: Managed Production Claims Require Exact Operational Evidence
Documentation and product surfaces SHALL call a managed endpoint production, available, retained, recoverable, monitored, or SLA-backed only when the exact deployment has retained approval, immutable deployment, synthetic canary, alert, incident, credential-rotation, rollback, restore-drill, sustained-measurement, security/privacy/legal, and launch-decision evidence supporting that bounded claim.

#### Scenario: Source configuration or endpoint reachability only
- **WHEN** a worker configuration, custom domain, successful deployment, or reachable endpoint exists without the complete operational evidence set
- **THEN** it remains a development candidate and no production, retention, recovery, availability, or SLA claim is made

#### Scenario: Evidence expires or a required control fails
- **WHEN** current canaries, drills, approvals, legal notices, or measurement evidence become missing or non-successful
- **THEN** affected claims and onboarding are suspended until reviewed evidence is restored
