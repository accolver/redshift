## Context

NIP-59 outer Gift Wraps are ordinary events, so relays may retain multiple encrypted versions. The authoritative logical version is inside the decrypted owner-authored Kind 30078 rumor. Outer timestamps are randomized by NIP-59 and cannot order logical state. Relays may omit old events, cap queries, disagree, or disappear; therefore this feature can expose only bounded authenticated history observed from responding configured relays.

The CLI and browser already share strict NIP-59 unwrapping and deterministic `(inner created_at, lowest outer event ID)` selection. Publication already provides majority quorum, typed relay outcomes, and exact-event recovery. History must reuse these contracts rather than introduce raw-event access, a new event format, or server-side plaintext.

## Goals / Non-Goals

### Goals

- Show bounded authenticated versions and tombstones for one exact d-tag.
- Order independently of relay/input order using existing logical version semantics.
- Compare bundles without emitting secret values.
- Restore a selected version as a new authorized version with explicit destructive consent.
- Detect a current-version change during restore preflight.
- Work with local nsec, NIP-07, and NIP-46 decryption/signing.
- Keep CLI/browser logic aligned through shared pure history utilities.

### Non-Goals

- Complete or durable relay history, offline history, audit/compliance logging, author identity beyond the sole owner, cryptographic erasure, undo, global transactions, CAS guarantees, automatic retention, managed backup, RPO/RTO, or SLA.
- Raw Nostr event inspection or plaintext value output from history/compare commands.
- Cross-project or cross-environment comparison in this tranche.
- Persisting decrypted history to disk, IndexedDB, URLs, server rendering, analytics, or logs.

## Telos L9 → L1 → L9 Decision

### Downward

- **L9:** owner-authorized recovery from interoperable encrypted relay state strengthens sovereignty without custody.
- **L8:** history remains free core functionality; paid infrastructure may add retention evidence later, not access.
- **L7:** familiar list/compare/restore workflows hide Nostr event mechanics.
- **L6:** metadata-first UI is masked, explicit, minimal, and client-only.
- **L5:** CLI and browser journeys cover history through restored current state and failure recovery.
- **L4:** existing NIP-59 ownership, d-tag, version, tombstone, quorum, and recovery contracts remain stable.
- **L3:** one focused history panel composes existing shadcn controls and store state.
- **L2:** shared pure ordering/diff/pagination plus thin transport adapters are TDD-friendly.
- **L1:** strict bounded types, no `any`, no plaintext logging, and existing gates apply.

### Upward

Strict shared utilities and authenticated unwraps make deterministic history feasible (L1-L2); current stores and publication recovery support CLI/browser composition (L3-L5); Nostr's retention and lack of CAS require an observed-history label and optimistic concurrency check rather than completeness/atomicity claims (L4-L7); this bounded design still provides free portable recovery without central authority (L8-L9). Both flows converge on **proceed with explicit completeness and concurrency caveats**.

## Decisions

### 1. One shared metadata model

`@redshift/crypto` will expose:

```ts
interface SecretHistoryVersion {
  eventId: string;
  dTag: string;
  createdAt: number;
  secrets: Record<string, string>;
  tombstone: boolean;
}

interface SecretHistoryDiff {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: string[];
}
```

Pure utilities sort versions, compare bundles by key/value equality, encode/decode cursors, and paginate. They never format or log values.

### 2. Deterministic order and current marker

Versions sort by inner rumor timestamp descending; equal timestamps sort by outer event ID ascending. This is exactly the existing supersession rule. The first version is current. Duplicate outer IDs are removed before sorting.

### 3. Bounded observation

- Maximum unique outer Gift Wraps decrypted for one CLI or browser observation: 1,000 after deterministic global aggregation/deduplication.
- Maximum authenticated versions retained for one d-tag: 200.
- Maximum 2 MiB per NIP-44 ciphertext, 16 MiB aggregate ciphertext before decryption, 4,096 keys per version, 65,536 keys and 16 MiB decrypted secret material per observation, 256-byte key names, and 64 KiB values.
- Default page: 20; requested page range: 1–100.

Transport and EventStore paths cap before decryption. A result reaching an observation/version cap is marked truncated. Publication/restore preflight fails closed if bounded observation cannot establish safe current state. UI/CLI say “observed from responding relays” and never “complete history.” Outer `created_at` is used only to choose a deterministic bounded observation set, never to order logical versions.

### 4. Strict stable cursor

The non-secret cursor is `v1.<createdAt>.<eventId>`. It is validated for exact length, safe timestamp, lowercase 64-hex ID, and exact presence in the current observed result. Pagination starts after that exact version. Unknown/stale cursors fail instead of skipping unpredictably.

### 5. Safe remote-signer failure handling

Shared crypto validates NIP-44 version, base64 shape, length, and resource bounds locally before invoking a remote signer. Every exception after a remote decrypt call—including errors whose text resembles malformed ciphertext—is uncertain and aborts observation without caching omission. Successful decryptions and locally rejected unrelated/malformed envelopes may be cached. The browser and CLI use this same boundary; provider-controlled message substrings never determine safety.

### 6. CLI contract

```text
redshift history list [--project <slug>] [--config <env>] [--limit <1..100>] [--cursor <cursor>] [--json]
redshift history compare <from-event-id> <to-event-id> [--project <slug>] [--config <env>] [--json]
redshift history restore <event-id> [--project <slug>] [--config <env>] --yes [--overwrite-current]
```

- List and compare output only IDs, timestamps, tombstone/current status, counts, and key names/change categories.
- Restore always requires `--yes`; restoring a tombstone is clearly identified as logical deletion.
- `--overwrite-current` does not bypass ownership/d-tag/timestamp validation. It only authorizes proceeding if a second authenticated observation finds that current changed after initial preflight.
- JSON stdout remains parseable; warnings and prompts use stderr.

### 7. Restore is a new publication

The selected decrypted bundle is re-wrapped and signed as a new event. Its inner timestamp is strictly newer than the second-observation current version and within future-skew bounds. Publication uses existing provisional recovery before network I/O, quorum classification, degraded warnings, and exact-event retry. No old event is modified or deleted.

Nostr has no relay-wide compare-and-swap. The second observation reduces accidental overwrite but cannot prevent a concurrent publication after preflight. Documentation states this limitation.

### 8. Browser experience

A `SecretHistoryPanel` for the selected environment shows:

- observed-history and truncation language;
- current, historical, and tombstone badges;
- timestamp and abbreviated event ID;
- two-version key-level comparison with no values;
- restore action with a confirmation dialog describing full-bundle replacement or logical deletion;
- a changed-current conflict requiring a second explicit overwrite action.

All decrypted history remains in ephemeral client memory and is cleared on unsubscribe/logout. No values enter URLs, DOM data attributes, server output, or analytics.

### 9. Evidence and claim gate

The feature remains “implementation candidate” until shared tests, CLI/web unit tests, compiled local-relay E2E, Chromium restore/conflict/tombstone E2E, production gate, and supported public-release certification pass. v0.12.0 recovery and v0.13.0 backup documentation is corrected immediately; history is not marked shipped before its own release evidence.

## Risks / Trade-offs

- **Relay omission/retention:** history may be incomplete → bounded observed wording and truncation markers everywhere.
- **Outer-query cap with randomized timestamps:** old or even logically recent inner versions may be omitted → never infer completeness; current-state fetch remains separately authoritative for restore preflight.
- **Remote signer cost:** decrypting up to 1,000 events can be slow → cap/deduplicate before decryption, cache valid results, tear down replay buffers after unsubscribe, share the browser pipeline, and expose loading/error states.
- **Malicious ciphertext DoS:** structurally malformed ciphertext is rejected locally; a valid-shaped invalid-MAC event can still make a remote signer report an indistinguishable error → fail closed rather than silently omit possible state.
- **Concurrent writers:** no Nostr CAS → second authenticated observation, explicit overwrite flag, truthful residual-race documentation.
- **Plaintext exposure:** comparison needs values in memory → output key names/categories only; ephemeral client memory and logout cleanup.

## Rejected Alternatives

- **Raw event command/UI:** exposes Nostr complexity and encrypted internals without improving safe recovery.
- **Use outer timestamps:** invalid because NIP-59 randomizes them.
- **Persist decrypted history locally:** expands plaintext-at-rest risk and creates retention/erasure claims.
- **Treat relay retention as audit log:** relays can omit or delete events.
- **Restore by republishing identical old event:** does not create a newer logical version and may not become current.
- **Implicit restore or auto-merge:** can silently erase keys or undo concurrent work.
- **Unlimited history query:** enables memory, bandwidth, and remote-signer resource exhaustion.

## Rollout / Rollback

Additive code and docs ship behind explicit user actions; no migration or event-schema change exists. Rollback removes command/UI entry points while existing NIP-59 events and recovery records remain valid. Previously restored versions remain ordinary authorized state and cannot be rolled back globally.
