# quality-gates Specification

## Purpose
Define hermetic build, test, browser, relay, installer, updater, and release gates for every shipped Redshift surface.
## Requirements
### Requirement: Hermetic Owned-Source Gates
The repository SHALL provide passing typechecks for root/CLI, web, packages, and relay; a Biome gate scoped to owned non-generated source; and a dependency audit with no silently accepted reachable vulnerability.

#### Scenario: External worktrees and generated output
- **WHEN** lint runs from the repository root
- **THEN** `.worktrees`, `.applesauce-src`, audit output, build output, embeds, and generated workers are excluded while an owned-source diagnostic fails the gate

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
CI SHALL run the same primary secret journey against hosted and compiled embedded dashboards, include CLI interoperability through the same relay, capture CSP/console failures, and prove custom relay configuration.

#### Scenario: Embedded lifecycle
- **WHEN** a browser creates, saves, reloads, retrieves via CLI, and deletes secrets through the compiled dashboard
- **THEN** every state transition persists or tombstones correctly with no CSP violation

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

