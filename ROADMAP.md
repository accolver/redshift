# Redshift Roadmap

## Current status: individual product hardening

Redshift's supported scope is sovereign secret management for an individual
Nostr identity through the CLI and web dashboard. The product encrypts secret
bundles client-side, publishes them to user-selected relays, and can inject the
latest authorized state into a child process.

The individual product must remain usable without Redshift-operated
infrastructure. Managed services may add convenience and retention, but may not
become a prerequisite for reading, writing, or exporting a user's secrets.

## Implemented capabilities

| Surface | Current capability |
| --- | --- |
| CLI | `login`, `logout`, `setup`, `run`, `serve`, `configure`, and singular secret set/get/list/delete/upload/download workflows |
| Authentication | Local nsec, NIP-07 with NIP-44 capability gating, and NIP-46 remote signers |
| Secret protocol | NIP-59 Gift Wraps containing owner-authored Kind 30078 rumors, strict author/recipient validation, deterministic version selection, and logical tombstones |
| Relay resilience | Rate limiting, retry, majority publication quorum, deterministic read conflict handling, and typed quorum failures |
| Web dashboard | Individual project/environment management, encrypted secret editing, import/export, and full logout storage clearing |
| Embedded dashboard | The compiled `redshift serve` binary serves the hydrated SvelteKit dashboard under a nonce-based CSP |
| Managed relay code | NIP-42 principal binding, recipient-scoped Gift Wrap writes/reads, strict event verification, payment checks, and identity-scoped in-object quotas |
| Verification | Crypto/CLI/web/relay tests, real local-relay CLI journeys, compiled-binary tests, and standalone/embedded Chromium E2E |
| Release workflow (next release) | Locked installs, native-platform smoke tests, checksums, SPDX SBOM, and GitHub build-provenance attestations are implemented in source but not retroactive for `v0.10.0` |

## Security semantics and known limits

1. Relays provide availability, not confidentiality or trusted ordering.
2. Publication succeeds when a majority of configured relays accepts the exact
   signed event. Users should configure at least three independent relays when
   availability matters.
3. Equal-timestamp versions are resolved by the lexicographically lowest outer
   event ID. Clients reject malformed, unauthorized, and excessively
   future-dated states before comparison.
4. Secret deletion is a newer encrypted empty bundle. It removes current state
   but cannot erase historical ciphertext already retained by a relay, cache,
   export, or backup.
5. NIP-09 does not authorize deletion of Gift Wraps signed by ephemeral outer
   keys. It is limited to events owned by the deleting identity, such as
   project metadata.
6. Plaintext output requires an explicit `--raw` acknowledgement. Operators
   must keep plaintext stdout out of logs and shell history.
7. The hardened installer and self-updater require GitHub CLI attestation
   verification and are prepared for the next release. Public `v0.10.0`
   predates these controls. Linux and macOS x64/arm64 are the intended binary
   targets; Windows is not currently published.
8. The managed relay's custom domain and deployment workflow are declared in
   source, but uptime, geographic redundancy, backup retention, and SLA claims
   require independently verified production operations before they may be
   advertised.

## Priority sequence

### P0 — prove the individual product

- Keep every supported README journey covered by compiled CLI or browser E2E.
- Keep authorization, logical deletion, quorum, signer, and child-environment
  isolation contracts in release-blocking tests.
- Keep generated embedded assets and the relay worker reproducible from source.
- Resolve dependency advisories without weakening compatibility or deterministic
  builds.

### P1 — operationalize the managed relay

- Deploy through the reviewed workflow using least-scope Cloudflare credentials.
- Prove NIP-42 authentication, payment authorization, recipient-scoped reads,
  Gift Wrap writes, and quota behavior against the deployed endpoint.
- Add retention, backup/restore drills, monitoring, and incident runbooks.
- Publish an SLA only after measured production evidence supports it.

### P2 — trustworthy history and recovery

History, compare, and restore may be added only after authorization and version
ordering are stable. The UI and CLI must distinguish current logical state from
historical ciphertext and must never describe a tombstone as cryptographic
erasure.

### P3 — collaboration research

Teams, RBAC, invitations, revocation, rotation, and audit trails are not
implemented. Any proposal must use current Nostr encryption primitives (for
example NIP-44 where applicable), define revocation and key-rotation semantics,
and pass Telos/OpenSpec review before implementation. Teams work must not make
individual sovereignty dependent on a central service.

## Explicitly not production claims

The following are future goals, not shipped guarantees:

- automatic managed-relay backups;
- 99.9% uptime or geographic redundancy;
- shared team projects or role-based access control;
- enterprise SSO or compliance certification;
- cryptographic deletion of already-replicated ciphertext;
- full Doppler command/flag compatibility.

## Telos acceptance

Every roadmap change must converge in both directions:

- **L9 → L1:** it advances user sovereignty, truthful behavior, and a coherent
  individual secret-management journey;
- **L1 → L9:** its protocol contracts, implementation, tests, release process,
  and operational evidence can support the claim.

If either direction fails, revise or reject the change rather than expanding
scope.
