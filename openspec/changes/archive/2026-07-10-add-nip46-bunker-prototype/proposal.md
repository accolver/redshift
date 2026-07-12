# Change: Add NIP-46 Bunker Prototype

## Why

GitHub issue #20 asks Redshift to prototype NIP-46 bunker support as Nostr-native key/secret orchestration infrastructure. This is also the prerequisite for Teams: the CLI must be able to read, write, and inject secrets through a remote signer before a team bunker can safely hold shared keys.

## What Changes

- Complete CLI bunker authentication so existing secret commands work with NIP-46 signers, not only local nsec keys.
- Add a minimal local Redshift bunker prototype for issue #20, or integrate/wrap a vetted existing implementation if research proves it is safer than custom code.
- Support `bunker://` login and `nostrconnect://` / Nostr Connect style pairing where feasible.
- Implement the encrypted NIP-46 request/response path for Redshift's required methods: `connect`, `get_public_key`, `sign_event`, `nip44_encrypt`, `nip44_decrypt`, `ping`, and `switch_relays`.
- Produce a design document that explains protocol choices, implementation options, grant-thesis fit, limitations, and security caveats.
- Defer Teams product features (OAuth bridge, RBAC, audit logs, managed hosting, team UI, MLS/FROSTR threshold custody) to the Teams phase.

## Impact

- Affected specs: `nip46-bunker`, `cli-bunker-auth`
- Affected code:
  - `cli/src/commands/login.ts`
  - `cli/src/lib/bunker.ts`
  - `cli/src/lib/secret-manager.ts`
  - `cli/src/commands/secrets.ts`
  - `cli/src/commands/run.ts`
  - `cli/src/commands/setup.ts`
  - `packages/crypto/` signer-based Gift Wrap call sites
  - optional new `packages/bunker/` or `cli/src/commands/bunker.ts`
- Related issue: https://github.com/accolver/redshift/issues/20
- Dependency posture: prefer `nostr-tools` and vetted existing bunker implementations before writing custom protocol code.
