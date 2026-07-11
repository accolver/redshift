# quality-gates Specification

## Purpose
Define hermetic build, test, browser, relay, installer, updater, and release gates for every shipped Redshift surface.
## Requirements
### Requirement: Hermetic Owned-Source Gates
The repository SHALL provide passing typechecks for root/CLI, web, packages, and relay; a Biome gate scoped to owned non-generated source; and root plus relay dependency audits with no known advisory unless an explicit reviewed exception records advisory, reachability, owner, and expiry.

#### Scenario: External worktrees and generated output
- **WHEN** lint runs from the repository root
- **THEN** `.worktrees`, `.applesauce-src`, audit output, build output, embeds, and generated workers are excluded while an owned-source diagnostic fails the gate

#### Scenario: Vulnerable locked dependency
- **WHEN** either frozen dependency graph contains an unexcepted advisory
- **THEN** CI and release fail before artifacts are built

### Requirement: Shipped CLI Journey
CI SHALL build root `dist/redshift`, assert that exact executable is used, start an isolated real local relay, and cover login/setup/set/get/list/run, exact argv/shell execution, credential scrubbing, author rejection, deletion, quorum behavior, deterministic ties, exits, and signals without source fallback or conditional skip.

#### Scenario: Binary missing
- **WHEN** the compiled root binary is unavailable
- **THEN** the E2E fails rather than invoking source

### Requirement: NIP-46 CLI Journey
CI SHALL exercise the compiled CLI through a real local NIP-46 signer for authentication and secret operations and SHALL clean keys, relays, processes, ports, and temp state.

#### Scenario: Bunker lifecycle
- **WHEN** the test authenticates via bunker
- **THEN** compiled setup/set/get/run succeed without exposing client or signer keys

### Requirement: Browser Journeys
CI SHALL run the same primary secret journey against hosted and compiled embedded dashboards, include CLI interoperability through the same relay, capture CSP/console/network failures, prove custom relay configuration, and verify authentication refusal/fallback plus complete logout storage destruction.

#### Scenario: Embedded lifecycle
- **WHEN** a browser creates, saves, reloads, retrieves via CLI, and deletes secrets through the compiled dashboard
- **THEN** every state transition persists or tombstones correctly with no CSP violation

#### Scenario: Embedded production lifecycle
- **WHEN** a browser authenticates, creates, saves, reloads, retrieves via CLI, deletes secrets, and logs out through the compiled dashboard
- **THEN** every state transition persists or tombstones correctly, sensitive browser state is removed, and no CSP, console, or unexpected network failure occurs

### Requirement: Managed Relay Security Journey
CI SHALL run the actual managed relay locally with deterministic payment and quota fixtures and test NIP-42, paid/unpaid reads, recipient writes, cross-recipient denial, ID mismatch, shared quotas, retention, and metadata.

#### Scenario: Unpaid broad read
- **WHEN** an authenticated but unpaid or unconstrained reader subscribes
- **THEN** access is rejected

### Requirement: Installer and Updater Journey
CI SHALL use a controlled local release server/verifier to test valid replacement and every trust/atomicity failure without production credentials.

#### Scenario: Interrupted update
- **WHEN** download or replacement is interrupted
- **THEN** the prior executable remains usable and temporary artifacts are cleaned

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

