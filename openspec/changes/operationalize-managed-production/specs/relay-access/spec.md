## ADDED Requirements

### Requirement: Deployed Candidate Protocol Evidence
Before any managed-production claim, the exact deployed relay artifact SHALL pass credentialed synthetic NIP-11, NIP-42, sole-recipient kind 1059 write/read, cross-recipient denial, broad-read denial, event-integrity, shared-quota, disabled-payment-route, and rollback verification.

#### Scenario: Local test differs from deployed behavior
- **WHEN** local fixtures pass but the deployed artifact, bindings, domain, metadata, authorization, quota, or payment-disabled behavior differs
- **THEN** managed-production certification fails and local evidence cannot substitute for the deployed result

#### Scenario: Payment route becomes active
- **WHEN** the deployed candidate exposes payment metadata, payment controls, payment endpoints, or payment enforcement without a separately approved commercial change
- **THEN** verification fails and onboarding remains disabled
