# Tasks: Add Teams Bunker Service

## 0. Prerequisites

- [ ] 0.1 Confirm `add-nip46-bunker-prototype` has been accepted or archived.
- [ ] 0.2 Confirm CLI secret operations work with bunker auth.
- [ ] 0.3 Confirm the Phase 1 build-vs-wrap/library decision is documented.
- [ ] 0.4 Update this design if Phase 1 selected an implementation boundary that changes RBAC/audit enforcement.

## 1. Team Bunker Core

- [ ] 1.1 Create or extend the approved bunker service package for team mode.
- [ ] 1.2 Add encrypted team key storage and loading.
- [ ] 1.3 Add team records, member records, sessions, invitations, and audit storage.
- [ ] 1.4 Add team metadata publication as Nostr events where required.
- [ ] 1.5 Add health checks for team-mode operation.

## 2. RBAC and Team Membership

- [ ] 2.1 Implement built-in roles: owner, admin, developer, readonly.
- [ ] 2.2 Implement permission matrix checks.
- [ ] 2.3 Enforce permissions inside NIP-46 signing/encryption/decryption handlers.
- [ ] 2.4 Implement invite, accept, role change, remove, and ownership transfer.
- [ ] 2.5 Invalidate active sessions immediately when members are removed or roles change.
- [ ] 2.6 Write tests for readonly denial, developer read/write, admin boundaries, and owner-only operations.

## 3. Team Secrets

- [ ] 3.1 Implement team secret read flow through bunker-mediated NIP-44 decryption.
- [ ] 3.2 Implement team secret write flow through signer-backed NIP-59 wrapping and NIP-46 signing.
- [ ] 3.3 Add `--team <team>` support to `secrets` and `run` commands.
- [ ] 3.4 Implement team key rotation with re-encryption of active secrets.
- [ ] 3.5 Write tests for read/write/delete/rotation flows.

## 4. OAuth Bridge

- [ ] 4.1 Implement Google OAuth Authorization Code + PKCE flow.
- [ ] 4.2 Implement GitHub OAuth flow.
- [ ] 4.3 Implement deterministic OAuth subject to Nostr identity mapping if retained after security review.
- [ ] 4.4 Add direct Nostr identity membership for existing npubs.
- [ ] 4.5 Add session management and identity picker endpoints/pages.
- [ ] 4.6 Write tests for OAuth callbacks, session lifecycle, and invite matching.

## 5. Audit Logging

- [ ] 5.1 Generate audit events for secret read/write/delete and membership/role changes.
- [ ] 5.2 Store and query audit logs with retention controls.
- [ ] 5.3 Add audit log privacy rules.
- [ ] 5.4 Write tests for audit event creation, access control, and retention pruning.

## 6. CLI and Web UI

- [ ] 6.1 Add `redshift teams create`.
- [ ] 6.2 Add `redshift teams invite`.
- [ ] 6.3 Add `redshift teams members`.
- [ ] 6.4 Add `redshift teams remove`.
- [ ] 6.5 Add `redshift teams rotate-key`.
- [ ] 6.6 Add team management pages in the web admin.
- [ ] 6.7 Add team switcher and team secrets view.
- [ ] 6.8 Add audit log viewer.

## 7. Deployment

- [ ] 7.1 Add managed bunker provisioning flow.
- [ ] 7.2 Add self-hosted Docker image and compose example.
- [ ] 7.3 Add systemd unit generator if still required after Phase 1 deployment decision.
- [ ] 7.4 Document split web/signer architecture.
- [ ] 7.5 Document backup and recovery process.

## 8. Future Custody Hardening

- [ ] 8.1 Create a separate OpenSpec change if FROSTR threshold custody is approved.
- [ ] 8.2 Create a separate OpenSpec change if MLS/NIP-EE group encryption is approved.

## 9. Validation

- [ ] 9.1 Run `openspec validate add-teams-bunker-service --strict`.
- [ ] 9.2 Run end-to-end Teams workflow tests: create team, invite member, connect, read/write secret, readonly denied write, remove member denied future access.
- [ ] 9.3 Complete security review for key custody, OAuth mapping, RBAC enforcement, audit privacy, and key rotation.
