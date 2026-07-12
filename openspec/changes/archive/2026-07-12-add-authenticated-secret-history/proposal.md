# Change: Add authenticated secret history, compare, and restore

## Why

Redshift deterministically selects current secret state and now provides encrypted local backup, but users cannot inspect authenticated prior versions, understand key-level changes, or restore an earlier bundle without external Nostr tooling. Relay-retained ciphertext is currently opaque and must not be mistaken for a complete or durable history guarantee.

This is the next ordered individual-product resilience capability after v0.13.0 backup/restore. It advances sovereign recovery and familiar secret-manager DX while keeping history free, client-side decrypted, bounded, relay-observed, and non-custodial.

## What Changes

- Add shared deterministic history ordering, metadata-only comparison, strict cursor pagination, and hard resource bounds.
- Add bounded authenticated history retrieval in the CLI and browser, including live versions and logical tombstones for one project/environment d-tag.
- Add `history list`, `history compare`, and explicitly confirmed `history restore` CLI workflows without plaintext values in output.
- Add a client-only web history panel with current/tombstone state, key-level metadata-only comparison, and explicit restore confirmation.
- Restore selected state by publishing a new owner-authorized NIP-59 version through existing quorum and durable exact-event recovery; never rewrite or erase history.
- Detect a current-version change between restore preflight and publication and abort unless the user explicitly authorizes overwriting the newly observed current bundle.
- Add deterministic local-relay compiled CLI and Chromium coverage for authorization, ordering, ties, tombstones, pagination, concurrent updates, restore, partial publication, and cleanup.
- Correct roadmap/product-truth surfaces to identify v0.12.0 recovery and v0.13.0 encrypted backup as shipped while retaining bounded-history and managed-service limitations.

## Impact

- Affected specs: `secret-history` (new), `cli-contract`, `product-truth`, `quality-gates`
- Affected shared code: `packages/crypto/src/history.ts`, package exports/tests
- Affected CLI: parser/dispatch, `SecretManager`, relay filters, history command/tests, compiled E2E
- Affected web: Gift Wrap models, secret store, history component/page, unit and Playwright tests
- Affected docs/gates: README, CLI/web docs, skill, roadmap, production/release workflow evidence
- Dependencies: none added
- Compatibility: additive CLI and UI behavior; existing secret selection, d-tags, events, backup format, and recovery records remain unchanged
