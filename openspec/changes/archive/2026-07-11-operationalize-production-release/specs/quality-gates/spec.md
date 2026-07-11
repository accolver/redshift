## MODIFIED Requirements

### Requirement: Hermetic Owned-Source Gates
The repository SHALL provide passing typechecks for root/CLI, web, packages, and relay; a Biome gate scoped to owned non-generated source; and root plus relay dependency audits with no known advisory unless an explicit reviewed exception records advisory, reachability, owner, and expiry.

#### Scenario: External worktrees and generated output
- **WHEN** lint runs from the repository root
- **THEN** `.worktrees`, `.applesauce-src`, audit output, build output, embeds, and generated workers are excluded while an owned-source diagnostic fails the gate

#### Scenario: Vulnerable locked dependency
- **WHEN** either frozen dependency graph contains an unexcepted advisory
- **THEN** CI and release fail before artifacts are built

### Requirement: Browser Journeys
CI SHALL run the same primary secret journey against hosted and compiled embedded dashboards, include CLI interoperability through the same relay, capture CSP/console/network failures, prove custom relay configuration, and verify authentication refusal/fallback plus complete logout storage destruction.

#### Scenario: Embedded lifecycle
- **WHEN** a browser creates, saves, reloads, retrieves via CLI, and deletes secrets through the compiled dashboard
- **THEN** every state transition persists or tombstones correctly with no CSP violation

#### Scenario: Embedded production lifecycle
- **WHEN** a browser authenticates, creates, saves, reloads, retrieves via CLI, deletes secrets, and logs out through the compiled dashboard
- **THEN** every state transition persists or tombstones correctly, sensitive browser state is removed, and no CSP, console, or unexpected network failure occurs

## ADDED Requirements

### Requirement: Fresh Installation Matrix
Release gates SHALL validate a fresh public or controlled release installation on Linux x64 and arm64 containers and native macOS x64 and arm64 runners, while unsupported Windows installation fails explicitly.

#### Scenario: Linux fresh setup
- **WHEN** an empty Linux environment runs the installer for a trusted release
- **THEN** provenance and checksum verification precede execution and the installed binary completes version, help, setup, secret, run, and deletion journeys

#### Scenario: macOS coverage boundary
- **WHEN** cross-platform validation is run from Docker
- **THEN** Linux is tested in containers and macOS is delegated to native Darwin runners rather than claimed from a Linux kernel

### Requirement: Production Readiness Command
The repository SHALL provide one documented command that composes dependency audits, typechecks, formatting/lint, generated-source verification, builds, product/relay tests, compiled lifecycle tests, installer/updater tests, and browser E2E.

#### Scenario: Any constituent gate fails
- **WHEN** one production-readiness sub-gate exits nonzero
- **THEN** the aggregate command exits nonzero and identifies the failing phase
