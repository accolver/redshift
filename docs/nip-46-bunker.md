# NIP-46 Redshift bunker design

## Purpose and grant relevance

Redshift's grant-relevant goal is sovereign secret management: developers should use encrypted secrets without handing a long-lived `nsec` to every CLI, browser session, CI runner, or future team workflow. NIP-46 remote signing supports that goal by moving signing and NIP-44 encryption decisions into a controlled signer/bunker process while clients hold only a revocable client key.

This matters for:

- CLI safety: `redshift login --bunker` and `redshift login --connect` let the CLI operate without storing the account `nsec` locally.
- Web/extension parity: the same signer abstraction can back NIP-07, browser bunker, and CLI bunker flows.
- Teams/RBAC groundwork: future grants can build per-client grants instead of distributing shared secrets.

## Current architecture

Existing support already includes:

- `cli/src/lib/bunker.ts`: wrapper around `nostr-tools/nip46` `BunkerSigner` for remote client login.
- `cli/src/commands/login.ts`: `--bunker` and `--connect` flows that save bunker auth and client keys.
- Web signer shape in `web/src/lib/types/nostr.ts`, where `AuthMethod` already includes `bunker`.
- Shared crypto signer path in `packages/crypto`, especially signer-based Gift Wrap operations.

The missing half is a Redshift-owned local bunker/signer that can receive NIP-46 requests from those clients.

## Prototype added in this branch

`cli/src/lib/local-bunker.ts` adds the local signer core for a preview bunker:

- Creates a `bunker://<pubkey>?relay=...&secret=...` pointer without exposing the signer `nsec`.
- Decrypts NIP-46 kind `24133` requests with NIP-44.
- Responds to `connect`, `ping`, `get_public_key`, `sign_event`, `nip44_encrypt`, and `nip44_decrypt`.
- Enforces a default Redshift policy allowing only event kinds `1059`, `30078`, and `5` for signing.
- Encrypts NIP-46 responses back to the client.

This is deliberately relay-agnostic. Tests exercise request/response behavior in memory so the protocol core is stable before adding long-running relay subscriptions and interactive approvals.

## Proposed connection flow

### Client-initiated Nostr Connect

1. CLI runs `redshift login --connect`.
2. CLI creates `nostrconnect://<client-pubkey>?relay=<relay>&secret=<secret>&name=Redshift%20CLI&perms=...`.
3. Local bunker scans/pastes URI.
4. Bunker validates requested permissions:
   - `sign_event:1059`
   - `sign_event:30078`
   - `sign_event:5`
   - `nip44_encrypt`
   - `nip44_decrypt`
5. Bunker replies on the relay and persists an allowlist grant keyed by client pubkey.
6. CLI stores only its client secret key and bunker pointer.

### Bunker URL flow

1. Local bunker starts with a selected signer key and relays.
2. Bunker prints `bunker://<signer-pubkey>?relay=<relay>&secret=<pairing-secret>`.
3. CLI runs `redshift login --bunker '<url>'`.
4. Bunker receives `connect`, checks pairing secret, asks for approval, then records the grant.

## Security caveats

- The prototype is not yet a daemon and does not subscribe to relays.
- No persistent grant database exists yet; policy is in-memory/default-only.
- No interactive approval prompt exists yet, so tests call the local handler directly.
- A local bunker protects client devices from raw `nsec` exposure, but the bunker host still holds the signer private key and must be hardened.
- NIP-44 encrypt/decrypt grants are sensitive because they can reveal Redshift secret payloads. Default grants must be narrow and revocable.
- Relay metadata leaks are still possible: request timing, participating pubkeys, and event kinds are visible even when contents are encrypted.

## Next implementation steps

1. Add a `redshift bunker serve` command that loads the local signer key from keychain/config and subscribes to NIP-46 events on configured relays.
2. Add persistent grants under `~/.redshift/bunker-grants.json` or keychain-backed storage.
3. Add an approval UI for first-use `connect` and Nostr Connect pairing.
4. Wire bunker auth into `secrets`/`run` command paths that still require direct `nsec` today.
5. Add integration tests against a local relay fixture before marking the bunker production-ready.
