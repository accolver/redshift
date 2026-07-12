# Change: Add Teams Bunker Service

## Status

**Proposed and deferred.** The canonical research baseline is a bunker-held team key with signer-layer RBAC. MLS and FROSTR remain explicit later custody research. Teams, OAuth, shared-key recovery, audit logging, and managed deployment are not implemented or approved for production.

## Why

Redshift Teams requires shared secret management without distributing a raw team private key to every member. After `add-nip46-bunker-prototype` proves the NIP-46 signing/decryption foundation, this phase turns that foundation into a Teams product with team key custody, RBAC, OAuth onboarding, audit logs, and managed/self-hosted deployment.

## What Changes

- Build the Teams bunker service on top of the approved NIP-46 foundation.
- Create team key custody where team secrets are encrypted to a team pubkey and signing/decryption requests go through the bunker.
- Add built-in roles (`owner`, `admin`, `developer`, `readonly`) and enforce permissions at the signing/decryption layer.
- Add OAuth bridge support for Google/GitHub onboarding and direct Nostr identity support for existing Nostr users.
- Add team management commands and web UI for team creation, invitation, membership, roles, secret access, and key rotation.
- Add audit logging for secret reads/writes/deletes and membership changes.
- Add managed deployment and self-hosted deployment options.
- Keep MLS/FROSTR threshold custody as a later hardening track unless explicitly approved in a separate change.

## Dependency

This change depends on `add-nip46-bunker-prototype` being accepted or archived with:

- CLI secret commands working with NIP-46 bunker auth.
- Encrypted NIP-46 request/response path tested end-to-end.
- Build-vs-wrap/library decision documented.
- Prototype limitations and security caveats documented.

## Impact

- Affected specs: `teams-bunker`, `teams-oauth`, `teams-rbac`, `teams-secrets`, `teams-audit`, `teams-deployment`
- Affected code:
  - `packages/bunker/` or approved bunker service package
  - `cli/src/commands/teams*.ts`
  - `cli/src/commands/secrets.ts` and `run.ts` team flags
  - `web/src/routes/teams/`
  - `web/src/lib/stores/` team state
  - `packages/crypto/` team key helpers if required
- Related follow-on: pricing/billing enablement via separate cloud-pricing work.
