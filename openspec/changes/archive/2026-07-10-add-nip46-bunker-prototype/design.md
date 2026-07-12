# Design: NIP-46 Bunker Prototype

## Context

Redshift already has partial bunker support:

- Web auth can connect to a NIP-46 signer with `nostr-tools/nip46` `BunkerSigner`.
- `@redshift/crypto` already provides signer-backed NIP-59 helpers (`wrapSecretsWithSigner`, `unwrapGiftWrapWithSigner`).
- CLI login can store bunker auth, but CLI secret commands still require a raw private key and reject bunker auth.

Issue #20 requires a prototype branch or preview release with a design doc, minimal local signer/bunker process, Nostr Connect or equivalent flow, encrypted request/response path, and security caveats.

## Goals / Non-Goals

### Goals

- Make existing CLI secret workflows work with NIP-46 bunker auth.
- Deliver a minimal local bunker prototype or a safe wrapper around a vetted implementation.
- Keep protocol implementation small, testable, and compatible with external signers.
- Document how the prototype advances Redshift's grant thesis: sovereign key orchestration over Nostr.
- Establish a stable foundation for the Teams bunker service phase.

### Non-Goals

- Teams RBAC, OAuth bridge, managed hosting, team dashboard, audit API, billing, or MLS group encryption.
- Production-grade threshold custody in Phase 1.
- Adding NDK solely for NIP-46 if `nostr-tools` remains sufficient.

## External Implementation Research

### `nostr-tools`

Current Redshift dependency and best immediate fit for client-side NIP-46. It provides `BunkerSigner`, `parseBunkerInput`, and NIP-46 client connection flows. Redshift SHALL continue using it for client-side integration and protocol primitives where possible.

### `nak bunker`

A mature external Go CLI/service by fiatjaf. It is the strongest behavioral reference and potential compatibility target. Redshift SHALL test or document compatibility with `nak bunker`; wrapping it remains an implementation fallback if a TypeScript prototype proves unsafe or too broad.

### Signet

A TypeScript self-hosted NIP-46 remote signer (`Letdown2491/signet`) with `bunker://` / Nostr Connect style UX. It is useful as a TypeScript reference and interop target. It is not yet selected as a dependency because Redshift needs a small library boundary and Teams-specific enforcement later.

### `nsecbunkerd` / nsecBunker / nsec.app

Original ecosystem lineage for NIP-46 bunker daemons and useful compatibility targets. Treat as prior art and interoperability test targets, not direct dependencies for Redshift Teams.

### `oauth-bunker`

Rust/Axum service with OAuth-to-NIP-46 architecture. This belongs primarily to the Teams phase as an architecture reference for OAuth onboarding and split web/signer deployments.

### FROSTR (`@frostr/bifrost`, `@frostr/igloo-core`)

FROSTR provides threshold-signing/distributed key custody over Nostr relays. It is promising for future hardened team custody or enterprise quorum approval, but it is not required for issue #20 and adds substantial cryptographic complexity. Phase 1 SHALL document it as a deferred research track, not adopt it as the default bunker implementation.

### NDK / `@nostr-dev-kit/ndk`

NDK provides NIP-46 client abstractions, but Redshift already uses `nostr-tools` and Applesauce. Do not add NDK solely for bunker support unless a later web architecture decision justifies it.

## Decisions

### 1. Start with a signer abstraction in the CLI

CLI commands SHALL depend on a Redshift signer interface instead of a raw private key only. This preserves existing nsec behavior and allows bunker-backed signing/decryption.

```ts
interface RedshiftSigner {
  getPublicKey(): string | Promise<string>;
  signEvent(event: EventTemplate): Promise<VerifiedEvent>;
  nip44Encrypt(pubkey: string, plaintext: string): Promise<string>;
  nip44Decrypt(pubkey: string, ciphertext: string): Promise<string>;
  close?(): Promise<void>;
}
```

### 2. Build or wrap only after dependency vetting

The prototype SHALL use `nostr-tools` for protocol primitives and SHALL compare implementation effort against `nak bunker`, Signet, and nsecbunkerd before committing to custom signer-server code. If an existing implementation is selected, Redshift SHALL wrap it behind the same CLI/user stories rather than exposing implementation-specific behavior.

### 3. Minimal NIP-46 method surface

The bunker prototype SHALL implement only the methods Redshift needs for secret storage:

- `connect`
- `get_public_key`
- `sign_event`
- `nip44_encrypt`
- `nip44_decrypt`
- `ping`
- `switch_relays`

### 4. Protocol invariants

- NIP-46 events MUST be kind `24133`.
- Event content MUST be encrypted with NIP-44, not NIP-04.
- The transport signer pubkey and user/team identity pubkey MAY differ; clients MUST call `get_public_key`.
- `nostrconnect://` flows MUST validate the shared secret.
- `bunker://` secrets SHOULD be single-use.
- Auth challenge responses MUST preserve the same request ID and keep the client subscription open.

## Risks / Trade-offs

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Custom signer-server bugs | Could sign unintended events or leak data | Prefer existing libraries; keep method surface minimal; exhaustive contract tests |
| Scope creep into Teams | Delays issue #20 prototype | Keep OAuth/RBAC/audit/managed hosting in Phase 2 |
| CLI refactor regressions | Existing nsec flows break | TDD regression tests for nsec and bunker auth |
| Key custody concentration | Bunker becomes high-value target | Local-only prototype first; explicit security caveats; later Teams hardening/FROSTR research |
| Relay unreliability | NIP-46 requests fail | Support multiple relays, reconnects, and `switch_relays` |

## Migration Plan

No user data migration is required. Existing nsec auth remains supported. Bunker auth becomes usable for commands that currently reject it.

## Open Questions

- Should Phase 1 implement a minimal TypeScript server or wrap `nak bunker` for the preview release?
- Which external signer should be the first automated interop target: `nak bunker`, Signet, or nsecbunkerd?
- How much `redshift bunker start` state should persist in the single-binary prototype versus a later `packages/bunker` service?
