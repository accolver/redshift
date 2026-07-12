# OpenSats Proposal Draft: Redshift Nostr Secret Management

## Summary

Redshift is decentralized secret management for developers. It provides a
Doppler-like CLI and web admin while storing encrypted application secrets as
Nostr events. Secrets are encrypted on the client with NIP-59 Gift Wraps and can
be replicated across relays, so developers keep control of their keys and data
without depending on a centralized secrets vendor.

OpenSats support would fund Redshift as Nostr developer infrastructure: safer
key management, stronger relay resilience, and a polished open-source path for
Bitcoin and Nostr developers to manage app secrets without giving a cloud vendor
custody over their operational data.

## Funder Fit

OpenSats funds free and open-source work that strengthens Bitcoin and adjacent
open networks. Redshift fits because it:

- Uses Nostr as the storage and transport layer for encrypted app data.
- Improves developer operations for Nostr, Bitcoin, and self-hosted software
  projects.
- Keeps private keys and secrets under user control with no server-side
  plaintext.
- Reduces dependency on centralized SaaS secret managers.
- Exercises relay portability and resilience through real application use.

## Problem

Developers frequently place API keys, deploy tokens, webhook secrets, and relay
credentials in centralized systems. Those systems become control points: they can
lose data, revoke access, surveil metadata, or become unavailable. Nostr
developers also need better examples of serious app-data workloads that use
relays without compromising user privacy.

Redshift turns secret management into a Nostr-native workflow. A developer can
log in with a Nostr identity, publish encrypted secret bundles to one or more
relays, and inject secrets into local processes with a familiar command.

## Proposed Work

Funding would support a 16-week hardening cycle focused on Nostr developer
infrastructure.

### Workstream 1: Key Management

- Harden local key storage and recovery guidance.
- Improve NIP-46 bunker flows so users can avoid placing long-lived nsec keys on
  developer machines.
- Document key custody models for solo developers, teams, and CI systems.
- Add practical threat-model guidance for compromised laptops and relay outages.

### Workstream 2: Relay Resilience

- Improve multi-relay read/write behavior and failure reporting.
- Add clearer retry/backoff documentation and operator guidance.
- Test recovery from partial relay failure, stale events, and conflicting event
  versions.
- Publish relay compatibility notes for common public and self-hosted relays.

### Workstream 3: Developer Experience

- Refine CLI workflows for setup, secret upload/download, and process injection.
- Improve docs for using Redshift in Nostr app development and Bitcoin project
  deployments.
- Add examples for local development, CI, and self-hosted relay setups.

## Milestones

| Week | Milestone | Deliverables |
| --- | --- | --- |
| 1-2 | Baseline audit | Protocol and CLI audit; test matrix for NIP-59, Kind 30078, NIP-09, NIP-46, and relay behavior. |
| 3-5 | Key-management hardening | Improved NIP-46 docs and CLI UX; safer local custody guidance; regression tests for auth paths. |
| 6-8 | Relay resilience | Multi-relay failure tests; clearer retry/backoff behavior; documented recovery workflows. |
| 9-11 | Developer examples | Nostr app example, CI example, self-hosted relay example, and upgrade/install guide refresh. |
| 12-14 | Compatibility pass | Public relay compatibility notes; stale/conflicting event handling tests; release candidate. |
| 15-16 | Release and reporting | Tagged release, changelog, demo recording, and final grant report. |

## Budget Draft

Requested support: **$24,000 for 16 weeks**.

| Category | Amount | Notes |
| --- | ---: | --- |
| Core development | $16,000 | Key management, relay resilience, CLI hardening. |
| Testing and compatibility | $4,000 | Multi-relay test matrix, failure simulation, regression coverage. |
| Documentation and examples | $3,000 | Nostr developer docs, CI examples, operator notes. |
| Release/reporting | $1,000 | Demo, changelog, grant report. |

Budget can be adjusted to OpenSats preferred structure or denominated in sats at
award time.

## Current Evidence

- Repository: https://github.com/accolver/redshift
- README: https://github.com/accolver/redshift/blob/main/README.md
- Roadmap: https://github.com/accolver/redshift/blob/main/ROADMAP.md
- Architecture spec: https://github.com/accolver/redshift/blob/main/spec.md
- CLI source: https://github.com/accolver/redshift/tree/main/cli
- Shared crypto package: https://github.com/accolver/redshift/tree/main/packages/crypto
- Web admin source: https://github.com/accolver/redshift/tree/main/web
- Release evidence placeholder: TODO add latest release link.
- Demo evidence placeholder: TODO add short CLI/web demo recording.
- Test evidence placeholder: TODO add CI run link for the grant release.

## Sustainability

Redshift's core CLI, web admin, and protocol implementation remain open source.
Paid work, if pursued later, is limited to convenience layers such as managed
relays, team coordination, or enterprise support. Core secret ownership, export,
and self-hosted use remain free.

## Risks and Mitigations

- **Relay variance:** Relays may differ in retention and limits. Mitigation:
  compatibility notes and multi-relay defaults.
- **Key loss:** User-owned keys create recovery responsibility. Mitigation:
  custody docs and NIP-46 flows.
- **Metadata leakage:** Relays can observe event timing and public wrapper
  metadata. Mitigation: clear threat model and conservative defaults.
