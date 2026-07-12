# Tasks: Add NIP-46 Bunker Prototype

## 0. Research and Decision Gate

- [x] 0.1 Vet `nostr-tools` NIP-46 capabilities for client and server-side reuse.
- [x] 0.2 Vet `nak bunker` as a self-hosted reference and possible wrapper fallback.
- [x] 0.3 Vet Signet, nsecbunkerd/nsecBunker, nsec.app, and Amber as interop targets.
- [x] 0.4 Vet FROSTR (`@frostr/bifrost`, `@frostr/igloo-core`) as future threshold-custody research; do not adopt for Phase 1 without explicit approval.
- [x] 0.5 Record the build-vs-wrap decision in the design doc before implementing the signer process.

## 1. CLI Signer Abstraction

- [x] 1.1 Add tests that prove current nsec-backed `secrets` and `run` workflows continue to work.
- [x] 1.2 Define a shared CLI signer abstraction supporting local nsec and NIP-46 signer methods.
- [x] 1.3 Refactor CLI secret read/write paths to use signer-backed Gift Wrap helpers when no raw private key is available.
- [x] 1.4 Update `requireAuth()` or add a replacement auth resolver that returns either a private-key signer or bunker signer.
- [x] 1.5 Wire stored bunker auth and keychain client key retrieval into command execution.
- [x] 1.6 Add tests for hidden-input bunker login, `redshift login --connect`, singular secret operations, and `run` with bunker auth.

## 2. Minimal Bunker Prototype

- [x] 2.1 Choose implementation mode: minimal TypeScript prototype, `nak bunker` wrapper, or vetted existing library integration.
- [x] 2.2 Add `redshift bunker start` for the selected prototype path.
- [x] 2.3 Generate or load transport signer key, user/team signing key, relays, and single-use connection secret.
- [x] 2.4 Output a `bunker://` connection URI and document Nostr Connect pairing if supported.
- [x] 2.5 Implement encrypted kind `24133` request/response handling with NIP-44.
- [x] 2.6 Implement `connect`, `get_public_key`, `sign_event`, `nip44_encrypt`, `nip44_decrypt`, `ping`, and `switch_relays`.
- [x] 2.7 Add basic session handling and authorization for connected client pubkeys.
- [x] 2.8 Add `redshift bunker status` for local prototype health.

## 3. Tests and Interop

- [x] 3.1 Unit test NIP-46 message parsing, encryption/decryption, request IDs, and error responses.
- [x] 3.2 Contract test each supported NIP-46 method.
- [x] 3.3 Integration test CLI secret roundtrip through a mock or local bunker.
- [x] 3.4 Add at least one manual or automated compatibility check against an external bunker implementation (`nak bunker`, Signet, nsecbunkerd, nsec.app, Amber).
- [x] 3.5 Verify no nsec, client secret key, decrypted secret, or NIP-44 plaintext is logged or persisted unexpectedly.

## 4. Documentation

- [x] 4.1 Write the issue #20 design doc covering grant-thesis fit, protocol flow, key model, implementation decision, limitations, and security caveats.
- [x] 4.2 Update CLI docs for bunker auth and local bunker prototype usage.
- [x] 4.3 Document which external implementations were vetted and why they were adopted, wrapped, or rejected.

## 5. Validation

- [x] 5.1 Run `openspec validate add-nip46-bunker-prototype --strict`.
- [x] 5.2 Run CLI tests from `cli/`.
- [x] 5.3 Run crypto package tests from `packages/crypto/`.
- [x] 5.4 Run relevant web auth tests if web bunker behavior changes.
