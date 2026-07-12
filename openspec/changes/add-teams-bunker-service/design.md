# Design: Teams Bunker Service

## Context

The Teams bunker service is Phase 2. It assumes `add-nip46-bunker-prototype` has already completed the NIP-46 foundation: CLI bunker auth, encrypted request/response handling, external implementation vetting, and a documented build-vs-wrap decision.

This phase adds product-specific Teams behavior: team key custody, RBAC, OAuth onboarding, auditability, and deployment models.

## Goals / Non-Goals

### Goals

- Let teams share secrets through a team key held by a bunker.
- Enforce role-based permissions before signing, encrypting, or decrypting on behalf of the team key.
- Support both OAuth onboarding for non-Nostr users and direct Nostr pubkey membership.
- Provide team lifecycle commands and web UI.
- Provide audit logs for sensitive operations.
- Support managed and self-hosted deployment.

### Non-Goals

- Re-deciding Phase 1 NIP-46 implementation choices unless Phase 1 findings require a design revision.
- Enterprise SSO / SCIM / custom RBAC roles.
- Billing enforcement beyond integration points.
- MLS/FROSTR threshold custody as default. FROSTR remains a separate hardening track because it changes the key custody model substantially.

## Dependency on Phase 1

The Teams service SHALL reuse the signer abstraction, protocol helpers, and implementation decision from `add-nip46-bunker-prototype`. If Phase 1 selects an external implementation such as `nak bunker` wrapping, this design must adapt RBAC/audit enforcement around that boundary before implementation begins.

## Decisions

### 1. Team key as Phase 2 custody boundary

Each team has a dedicated Nostr keypair. Secrets are stored as Redshift NIP-59 Gift Wrap events addressed to the team pubkey. The private key stays inside the bunker service and is encrypted at rest.

### 2. RBAC enforced at signer/decrypt layer

The bunker must enforce permissions before executing NIP-46 methods. CLI or web UI checks are helpful UX but not security boundaries.

### 3. OAuth bridge follows oauth-bunker pattern

Use oauth-bunker as a reference for separating OAuth/session UX from signing key custody. The initial managed deployment may run web and signer in one Bun process; self-hosted or hardened deployments may split web and signer.

### 4. FROSTR is future hardening, not Teams MVP

FROSTR (`@frostr/bifrost`, `@frostr/igloo-core`) provides threshold custody and may reduce single-key risk, but it requires a separate security review, UX design for quorum/signers, and recovery model. Track it as a later Teams/Enterprise enhancement.

## Risks / Trade-offs

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Team key compromise | All team secrets exposed | Encrypt at rest, isolate signer, document backups, consider FROSTR later |
| Removed member already copied secrets | Revocation cannot claw back data | Immediate future-access revocation, key rotation, audit logs |
| OAuth subject mapping bugs | Wrong user could receive access | Stable provider IDs, invite matching, tests, admin review |
| RBAC bypass | Unauthorized secret writes/reads | Enforce only at bunker layer, not just CLI/web |
| Managed hosting trust concern | Redshift-hosted bunker becomes sensitive | Self-hosting remains supported; no lock-in; transparent docs |

## Migration Plan

Existing individual users remain unaffected. Teams are created explicitly. Existing single-user secrets are not automatically migrated to a team unless a later import/migration workflow is added.

## Open Questions

- How should team key backup/recovery work for managed and self-hosted teams?
- Should audit events be encrypted to owners/admins only or visible to all team members?
- Which Phase 1 implementation path will the Teams service inherit?
