## Context
Redshift already has client-side NIP-46 login wrappers through `nostr-tools/nip46`, but no Redshift-owned signer/bunker server. Issue #20 asks for a prototype bunker or a preview skeleton with documented limitations.

## Goals / Non-Goals

- Goals:
  - Define how NIP-46 supports Redshift's sovereign secret-management grant narrative.
  - Prototype the local signer core for NIP-46 kind `24133` request/response handling.
  - Keep signing policy narrow for Redshift event kinds.
- Non-Goals:
  - Production daemon process.
  - Persistent grant database.
  - Relay integration or interactive approval UI.

## Decisions

- Decision: Build the protocol core first, relay-agnostic and tested in memory.
- Rationale: Relay subscriptions and approvals are higher-risk long-running behavior. A pure core lets future `bunker serve` work reuse tested signing, encryption, and policy checks.
- Alternatives considered: Implement a full daemon immediately. Rejected for preview scope because grant persistence, revocation, and approval UX need explicit product decisions.

## Risks / Trade-offs

- Risk: Skeleton may be mistaken for production-ready bunker. Mitigation: docs and module comments state relay listener and persistent grants are not implemented.
- Risk: Over-broad NIP-46 grants could expose secret payloads. Mitigation: default signing policy only allows Redshift kinds `1059`, `30078`, and `5`.

## Migration Plan

No user data migration. Future daemon can import this library and add relay subscriptions plus grant storage.

## Open Questions

- Where should persistent bunker grants live: config file, keychain, or encrypted Kind 30078 profile data?
- Should Redshift support per-client policy by event kind only, or also project/environment scope tags?
