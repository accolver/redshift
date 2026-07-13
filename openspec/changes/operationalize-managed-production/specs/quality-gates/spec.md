## ADDED Requirements

### Requirement: Managed Production Evidence Gate
The managed-production gate SHALL validate immutable authorization, exact deployed source/artifact, credential scope, synthetic protocol canaries, alert delivery/acknowledgement, incident and rollback exercises, credential rotation, encrypted restore drills, cleanup, privacy-safe evidence, and the approved observation record without conditional skip.

#### Scenario: External dependency prevents a gate
- **WHEN** credentials, provider access, protected-environment approval, alert delivery, restore target, native evidence, or named reviewer is unavailable
- **THEN** managed-production certification remains blocked rather than substituting local tests or source declarations

#### Scenario: Sensitive evidence leak
- **WHEN** a gate output contains a credential, private key, passphrase, decrypted secret, or real-user identifying telemetry
- **THEN** the gate fails, the evidence is contained under the incident process, and launch approval is blocked
