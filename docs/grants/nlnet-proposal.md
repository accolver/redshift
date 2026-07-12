# NLnet Proposal Draft: Redshift User-Controlled Encrypted App Data

## Summary

Redshift is an open-source secret-management platform that stores encrypted app
data on Nostr relays. It gives developers a familiar CLI and web admin for
managing project secrets while preserving user control: encryption happens on the
client, data can be replicated across relays, and users can export or self-host
without vendor lock-in.

NLnet support would fund Redshift as open internet infrastructure for
user-controlled encrypted application data. The work would generalize and harden
the Redshift pattern: local-first encryption, open protocol storage, portable
identity, and resilient synchronization over interoperable relays.

## Funder Fit

NLnet funds open internet projects that strengthen autonomy, interoperability,
and public-interest infrastructure. Redshift fits because it:

- Uses open protocols instead of proprietary storage APIs.
- Demonstrates user-controlled encrypted app data on a real developer workflow.
- Avoids server-side plaintext and key escrow.
- Supports self-hosting and relay portability.
- Produces reusable documentation and tests for encrypted Nostr app-data
  patterns.

## Problem

Modern applications increasingly store sensitive user and developer data in
centralized platforms. Even when encrypted at rest, users often cannot verify
custody, migrate cleanly, or continue operating when an account or provider is
lost. Developers who want user-controlled app data face a gap between protocol
ideas and production-quality examples.

Redshift addresses this gap through a concrete use case: application secrets.
Secrets are small, high-value records where portability, encryption, and recovery
matter. By hardening Redshift, the project can also document patterns useful to
other open internet applications.

## Proposed Work

Funding would support a 16-week infrastructure cycle focused on reusable open
protocol patterns and user-controlled encrypted data.

### Workstream 1: Encrypted App-Data Pattern

- Document Redshift's NIP-59 + Kind 30078 data model.
- Clarify replaceable event semantics, tombstones, deletion requests, and
  conflict resolution.
- Publish implementation notes that other Nostr app developers can reuse.
- Expand tests around encryption, event selection, and deletion behavior.

### Workstream 2: Portability and Self-Hosting

- Improve export/import documentation and examples.
- Document self-hosted relay setup for Redshift data.
- Add migration guidance for moving between public and self-hosted relays.
- Test data recovery from exported records and relay replicas.

### Workstream 3: Open Developer Tooling

- Improve CLI and web documentation for local-first workflows.
- Publish examples for using Redshift as a single-binary local admin tool.
- Add compatibility notes and validation commands for project maintainers.
- Prepare release artifacts and public implementation report.

## Milestones

| Week | Milestone | Deliverables |
| --- | --- | --- |
| 1-2 | Protocol baseline | Public design note for encrypted app-data model, current limitations, and test matrix. |
| 3-5 | Data model hardening | Tests and docs for replaceable events, tombstones, NIP-09 deletion, and conflict handling. |
| 6-8 | Portability workflows | Export/import recovery guide; relay migration guide; self-hosted relay setup notes. |
| 9-11 | Developer documentation | Reusable Nostr encrypted app-data guide and Redshift integration examples. |
| 12-14 | Compatibility and release candidate | Compatibility notes, validation commands, release candidate, and docs review. |
| 15-16 | Final release and report | Tagged release, public report, demo, and remaining-work roadmap. |

## Budget Draft

Requested support: **€22,000 for 16 weeks**.

| Category | Amount | Notes |
| --- | ---: | --- |
| Protocol/data model hardening | €9,000 | Event semantics, deletion, conflict handling, tests. |
| Portability and self-hosting | €5,000 | Export/import, relay migration, recovery docs. |
| Developer documentation | €5,000 | Reusable encrypted app-data implementation guide and examples. |
| Release/reporting | €3,000 | Release artifacts, demo, final report, roadmap. |

Budget can be adjusted to match NLnet's application format.

## Current Evidence

- Repository: https://github.com/accolver/redshift
- README: https://github.com/accolver/redshift/blob/main/README.md
- Roadmap: https://github.com/accolver/redshift/blob/main/ROADMAP.md
- Architecture spec: https://github.com/accolver/redshift/blob/main/spec.md
- Shared crypto package: https://github.com/accolver/redshift/tree/main/packages/crypto
- CLI source: https://github.com/accolver/redshift/tree/main/cli
- Web admin source: https://github.com/accolver/redshift/tree/main/web
- Encrypted app-data guide placeholder: TODO add final guide link.
- Self-hosting evidence placeholder: TODO add relay migration/self-hosting doc link.
- Release evidence placeholder: TODO add grant release link.
- Demo evidence placeholder: TODO add export/import and relay recovery demo.

## Public Benefit

The immediate benefit is a usable open-source tool for developer secret
management without custodial plaintext storage. The broader benefit is a
well-documented pattern for user-controlled encrypted app data over open relays.
Other projects can adapt the lessons around local encryption, replaceable event
state, relay portability, and recovery.

## Risks and Mitigations

- **Protocol ambiguity:** App-data patterns on Nostr are still evolving.
  Mitigation: document choices clearly and keep implementation conservative.
- **Data availability:** Relays may prune or reject events. Mitigation:
  multi-relay replication, self-hosting docs, and export/import recovery.
- **Deletion semantics:** NIP-09 deletion is best-effort across relays.
  Mitigation: clear docs, tombstone behavior, and threat-model notes.
