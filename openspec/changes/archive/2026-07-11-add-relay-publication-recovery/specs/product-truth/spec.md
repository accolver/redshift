## ADDED Requirements

### Requirement: Publication Redundancy Truth
Product surfaces SHALL distinguish logical quorum success from full configured-relay redundancy and SHALL describe recovery as republishing existing encrypted ciphertext, not backup, history, cryptographic erasure, or an availability guarantee.

#### Scenario: Degraded success copy
- **WHEN** an encrypted secret mutation reaches quorum but misses one or more relays
- **THEN** the user is told the secret state is saved with degraded relay redundancy and is offered inspection/retry

#### Scenario: Recovery documentation
- **WHEN** CLI or web recovery is documented
- **THEN** the documentation states that exact ciphertext may already exist on some relays and retry does not delete historical relay data
