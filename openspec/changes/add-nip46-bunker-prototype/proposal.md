# Change: Add NIP-46 bunker prototype

## Why
Developers need a way to use Redshift without distributing long-lived Nostr private keys to every CLI or browser client. A NIP-46 bunker keeps signing and NIP-44 encryption authority in a local/remote signer while clients hold revocable connection keys.

## What Changes
- Add design documentation for Redshift NIP-46 bunker support and grant relevance.
- Add a relay-agnostic local bunker signer core for NIP-46 request handling.
- Add tests for bunker pointer creation, encrypted request/response handling, signing policy, and denial of disallowed event kinds.

## Impact
- Affected specs: `bunker-auth`
- Affected code: `cli/src/lib/local-bunker.ts`, CLI bunker tests, documentation.
