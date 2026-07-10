# NIP-46 Bunker Prototype Design

## Purpose

This document satisfies the design-doc portion of GitHub issue #20: prototype Redshift as Nostr-native key/secret orchestration infrastructure.

Redshift's grant thesis is that application secrets can be managed through open Nostr protocols without centralized custody. NIP-46 extends that thesis from data storage to key orchestration: the CLI and web app can sign, encrypt, and decrypt through a remote signer without directly holding the user's or team's private key.

## Current State

Before this prototype:

- Web auth supported NIP-46 through `nostr-tools/nip46` `BunkerSigner`.
- `@redshift/crypto` supported signer-backed NIP-59 Gift Wrap operations.
- CLI login could store bunker connection metadata.
- CLI secret commands still required local private-key access, so bunker auth could not actually manage secrets.

This prototype completes the CLI signer abstraction and adds a minimal local NIP-46 bunker process.

## Protocol Overview

Redshift uses standard NIP-46 remote signing:

- Transport event kind: `24133`
- Content encryption: NIP-44 v2
- Request routing: request events are `p`-tagged to the remote signer pubkey
- Response routing: response events are `p`-tagged to the client pubkey

Supported prototype methods:

- `connect`
- `get_public_key`
- `sign_event` for Redshift-required kinds only: NIP-59 seal kind `13`, plus constrained NIP-09 deletion kind `5` events containing only `e` tags and a `k=1059` Gift Wrap scope tag.
- `nip44_encrypt`
- `nip44_decrypt`
- `ping`
- `switch_relays`

The signer transport pubkey and actual user/team signing pubkey are deliberately separate concepts. Clients must call `get_public_key` after connecting. Requested NIP-46 permissions are enforced per connected client; omitted permissions default to the Redshift prototype permission set.

## Implementation Decision

Phase 1 uses existing libraries where they fit:

- `nostr-tools` remains the NIP-46 client dependency for `BunkerSigner`, `parseBunkerInput`, and Nostr Connect flows.
- `nostr-tools` primitives are used for signing, event verification, NIP-44 encryption, and relay communication.
- Existing implementations (`nak bunker`, Signet, nsecbunkerd/nsecBunker, nsec.app, Amber) are treated as compatibility/reference targets rather than embedded dependencies for this first prototype.
- FROSTR (`@frostr/bifrost`, `@frostr/igloo-core`) is deferred. It is promising for future threshold custody, but it changes the key model and requires a dedicated security review.

## CLI Signer Abstraction

CLI secret workflows now use a signer-capable abstraction rather than assuming a raw private key. A signer must provide:

```ts
interface SecretManagerSigner {
  getPublicKey(): string;
  signEvent(event: EventTemplate): Promise<VerifiedEvent | NostrEvent>;
  nip44Encrypt(pubkey: string, plaintext: string): Promise<string>;
  nip44Decrypt(pubkey: string, ciphertext: string): Promise<string>;
  close?(): Promise<void>;
}
```

Local nsec auth still uses direct private-key operations. Bunker auth uses signer-backed NIP-59 helpers:

- `wrapSecretsWithSigner`
- `unwrapGiftWrapWithSigner`

## Local Prototype Workflow

Start or inspect the local prototype:

```bash
redshift bunker status --relay wss://relay.test
redshift bunker start --insecure-plaintext-keys --relay wss://relay.test
```

The command creates local prototype state under:

```text
~/.redshift/bunker/prototype.json
```

The `--insecure-plaintext-keys` acknowledgement is required the first time the prototype creates local keys because Phase 1 stores them in a `0600` plaintext file. It prints a connection URI:

```text
bunker://<signer-pubkey>?relay=<relay>&secret=<secret>
```

Then connect from the CLI:

```bash
redshift login --bunker-stdin
# Paste the one-time bunker URI at the hidden prompt.
redshift secrets list
redshift secrets set API_KEY abc123
redshift run -- npm test
```

## Security Caveats

This is a prototype, not the final Teams security boundary.

- Prototype keys are stored locally in a `0600` file under `~/.redshift/bunker`.
- There is no Teams RBAC in Phase 1.
- There is no OAuth bridge in Phase 1.
- There are no audit logs in Phase 1.
- There is no managed hosting or key backup/recovery workflow in Phase 1.
- Relay availability affects NIP-46 request/response reliability.
- If the local bunker host is compromised, the signing key is compromised.
- Revocation cannot erase secrets a user already decrypted or copied.

## Path to Teams

Phase 2 builds on this foundation:

1. A team key is held by the bunker.
2. Team members connect as NIP-46 clients.
3. The bunker enforces RBAC before decrypting or signing.
4. Audit events record sensitive operations.
5. OAuth onboarding maps non-Nostr identities to authorized team access.
6. Future FROSTR/threshold custody can harden team key management after separate review.
