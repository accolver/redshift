## ADDED Requirements

### Requirement: Multi-Relay Recovery Evidence
Production verification SHALL exercise classified partial publication and exact-event recovery against deterministic multi-relay outcomes in compiled CLI and browser journeys.

#### Scenario: Compiled CLI recovery
- **WHEN** the compiled release candidate publishes with accepted, rejected, and unavailable relay outcomes
- **THEN** the gate verifies durable state, same-ID unavailable-only retry, convergence, and complete process/temp-file cleanup

#### Scenario: Browser recovery
- **WHEN** three accepting relays reach majority quorum while one relay permanently rejects and one is unavailable
- **THEN** Playwright verifies the visible five-relay detail, same-ID unavailable-only retry after recovery, converged read state, per-relay publish counts, and logout cleanup

#### Scenario: Conditional skip
- **WHEN** a required relay recovery journey cannot execute
- **THEN** the production gate fails rather than conditionally passing or skipping it
