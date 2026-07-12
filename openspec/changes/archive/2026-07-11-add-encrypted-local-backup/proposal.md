# Change: Add encrypted local backup and restore

## Why

Redshift now protects individual secret publication across partial relay failure, but a user can still lose current logical state when relay access disappears or when moving to a fresh signer/session. A user-controlled, passphrase-encrypted local snapshot is the next unblocked resilience step: it improves sovereignty and portability without introducing managed custody, cloud credentials, or a new service dependency.

## What Changes

- Add a versioned, bounded, authenticated binary backup envelope shared through `@redshift/crypto`.
- Add `redshift backup create <file>` and `redshift backup restore <file>` with hidden or explicitly piped passphrase input; passphrases are never accepted through argv, config, or environment variables.
- Snapshot the latest authenticated, non-tombstoned secret state observed from configured relays, together with project/environment identifiers and source version evidence.
- Exclude signer credentials, keychain state, bunker material, relay configuration, publication-recovery records, historical events, and deleted state.
- Restore as newly signed NIP-59 state under the currently authenticated target signer, with explicit identity migration and conflict-overwrite authorization.
- Reuse quorum publication and durable per-relay recovery for every restored bundle.
- Add shared cryptographic negative tests, atomic filesystem tests, command tests, compiled fresh-session E2E, CI/release gates, and truthful documentation.

## Impact

- **Affected specs:** new `local-backup`; modified `cli-contract`, `product-truth`, and `quality-gates`.
- **Affected code:** `packages/crypto`, CLI parser/dispatch, auth input helpers, `SecretManager` snapshot/version APIs, backup commands, tests, docs, release verification.
- **Dependency:** add a direct reviewed `@noble/hashes` dependency to `@redshift/crypto` for interoperable memory-hard scrypt; the package is already present transitively through the Nostr stack.
- **No breaking change:** existing plaintext `.env` download/upload and release behavior remain unchanged.
- **Approval:** the user explicitly selected “Encrypted backup” to take through Telos, OpenSpec, TDD, review, and release on 2026-07-11.

## Explicit Non-Goals

- Browser backup UI in this tranche.
- Automatic, scheduled, managed, cloud, offsite, or retained backups.
- Secret history, comparison, tombstone/history export, or replay of source events.
- nsec, NIP-46 signer, keychain, passphrase, or account recovery.
- Relay completeness, availability, RPO/RTO, geographic redundancy, or SLA claims.
- Globally atomic multi-bundle restore or implicit destructive overwrite.
