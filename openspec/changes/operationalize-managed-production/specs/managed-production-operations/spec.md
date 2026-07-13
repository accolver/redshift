## ADDED Requirements

### Requirement: Authorized Immutable Deployment
Managed-production mutation SHALL require an explicitly approved proposal, named operator and approvers, exact source and generated-artifact digests, credential-free resource plan, protected environment, least-privilege credentials, budget boundary, and tested rollback target.

#### Scenario: Missing authority or source binding
- **WHEN** any approval, principal, protection, source/plan digest, credential scope, budget, or rollback evidence is missing or mismatched
- **THEN** deployment fails before provider mutation

#### Scenario: Approved synthetic deployment
- **WHEN** every precondition is satisfied and an operator deploys the exact candidate
- **THEN** immutable evidence records inputs, reviewer decisions, resource results, canaries, and rollback target without credentials or production user data

### Requirement: Metadata-Safe Monitoring and Alerts
Managed-production checks SHALL use isolated synthetic identities and payloads, cover endpoint/NIP-11/NIP-42/recipient access/quota behavior, route severity-classified alerts to named owners, and exclude plaintext secrets and real-user identifying telemetry.

#### Scenario: Synthetic check fails
- **WHEN** an approved check crosses its declared failure threshold
- **THEN** the named owner receives and acknowledges a metadata-minimized alert and the event is retained as operational evidence

#### Scenario: Evidence contains sensitive data
- **WHEN** a proposed log, metric, trace, alert, or status payload contains credentials, decrypted content, real-user identity, or identifying analytics
- **THEN** collection is rejected before production use

### Requirement: Tested Incident, Rotation, and Rollback Operations
Operators SHALL maintain and exercise runbooks for outage, bad deployment, credential compromise/rotation, provider failure, suspected unauthorized access, and recovery communication.

#### Scenario: Exercise detects a failed control
- **WHEN** containment, rotation, rollback, alert delivery, cleanup, or communication does not meet the predeclared exercise criteria
- **THEN** production launch/claim approval remains blocked and corrective evidence is required

### Requirement: Encrypted Managed Retention and Restore Evidence
Any managed backup SHALL contain approved encrypted relay data only, use separately governed key custody and access, implement explicit retention/deletion behavior, and pass corruption, authorization, expiry, and fresh-target restore drills before a retention or recovery claim.

#### Scenario: Backup exists without a successful restore drill
- **WHEN** encrypted objects are present but an approved fresh-target restore has not succeeded
- **THEN** Redshift makes no managed backup, retention, RPO, or RTO claim

#### Scenario: Restore drill succeeds
- **WHEN** an authorized synthetic restore verifies authenticity/integrity and protocol behavior under the approved custody boundary
- **THEN** evidence records observed recovery point/time, cleanup, limitations, and data scope without converting observations into an SLA

### Requirement: Measured Claim and Launch Gate
Managed production SHALL remain unlaunched until the exact deployment passes an approved sustained observation plan, incident and restore drills, security/privacy/legal review, cost review, operative notices, and explicit launch approval. Payment SHALL remain disabled unless a separate commercial change is approved and implemented.

#### Scenario: Unmeasured availability or recovery
- **WHEN** a product surface proposes an uptime percentage, retention duration, RPO, RTO, geographic claim, or SLA without the approved measurement and review record
- **THEN** the claim is rejected or labeled an unapproved hypothesis

#### Scenario: Operations pass but commercial approval does not
- **WHEN** managed operational evidence passes while Cloud pricing remains unapproved or unimplemented
- **THEN** paid onboarding, payment endpoints, and payment enforcement remain disabled
