# Design: Per-relay publication recovery

## Telos validation

### L9 → L1

- **L9:** Recovery improves censorship resistance and user-controlled availability without relying on a Redshift service.
- **L8–L7:** It strengthens the free individual product while keeping normal secret workflows simple; relay detail appears only when redundancy is degraded.
- **L6–L5:** Users receive a clear accepted/rejected/unavailable summary, an exact-event retry, and an explicit completion state.
- **L4:** Retries publish the identical NIP-59 outer event ID only to relays that were unavailable; permanently rejected relays are never automatically retried.
- **L3–L1:** Shared typed outcome logic, bounded storage, strict validation, and deterministic E2E implement the contract.

### L1 → L9

Strict TypeScript, existing quorum primitives, verifiable signed events, atomic `0600` CLI records, browser session storage, and local relay fixtures can support the guarantee. Both directions converge.

## Shared outcome model

Each final relay outcome is one of:

- `accepted`: the relay acknowledged the exact event;
- `rejected`: an `invalid`, `pow`, `blocked`, or `restricted` NIP-20 failure that the exact immutable event cannot recover from;
- `unavailable`: `rate-limited`, `error`, timeout, network, unknown, or unconfirmed `duplicate` failure.

NIP-20 prefixes are parsed into a typed exhaustive code. Unknown or misleading text fails safe as unavailable. A `duplicate` response becomes accepted only when a bounded query to that same relay returns an event whose computed ID, signature, and bytes match the pending event; otherwise it remains unavailable.

The report keeps the existing `accepted` and `failed` compatibility fields while adding classified outcomes. Retry functions accept the original report and exact signed event, attempt only `unavailable` targets, merge outcomes by relay, and never modify the event.

## CLI recovery storage

Before the first network attempt, a provisional record is synchronously written and fsynced beneath `$REDSHIFT_CONFIG_DIR/recovery/` (normally `~/.redshift/recovery/`) with a versioned schema and all relays initially unavailable. Final outcomes atomically replace and fsync that record. The directory is `0700`; records are `0600`; same-directory random temporary files use exclusive creation; file and directory fsync bracket rename; and load/remove reject symlinks or non-regular files. A record contains:

- owner pubkey;
- project and environment identifiers;
- exact signed encrypted event;
- quorum threshold and classified relay outcomes;
- creation/update timestamps.

Load validates schema bounds, normalized relay URLs, reason lengths, filename/event/report identity, exact event ID/signature/tags, owner identity, and file size. Before retry, authenticated unwrap verifies the rumor/seal owner and `project|environment` d-tag against stored metadata. Compatibility fields and thresholds are recomputed from the bounded relay snapshot rather than trusted from disk. Storage is capped by shared numeric constants and old fully accepted records are removed. No nsec, bunker client key, decrypted secret, or passphrase is stored.

`redshift recovery list`, `redshift recovery show <event-id>`, `redshift recovery retry <event-id>`, and `redshift recovery remove <event-id>` provide the workflow. Retry requires current authentication to match the event-bound record owner. A record is removed automatically only when every original relay is accepted; any permanent rejection remains visible until explicit removal.

If final outcome persistence fails, the provisional record remains and the command reports that remote publication may have succeeded together with the event ID. It never generates a replacement event automatically.

## Browser recovery

Before network publication of a NIP-59 secret Gift Wrap, the web store synchronously writes a bounded provisional record to session storage because the encrypted event is already public relay ciphertext. Public project/profile metadata continues to use quorum publication but is not represented as encrypted secret recovery. It validates and replaces the record with final outcomes, and clears the key on every disconnect/logout path. A persistence failure aborts before publication; an outcome-update failure leaves the provisional record and surfaces an explicit uncertainty error. Degraded publication exposes a reactive state used by a compact recovery panel. Retry republishes the exact event only to unavailable relays and updates the event store only after quorum was previously met or becomes met.

## Safety and bounds

- Shared constants bound records to 100, bytes per record to 256 KiB, relays per record to 16, failure reasons to 512 characters, and age to 30 days.
- Cross-process CLI serialization uses a crash-released SQLite `BEGIN IMMEDIATE` lock. Recovery paths reject static symlink/non-regular final components and require owner-only directory/file modes. The trusted boundary is the current OS user and their config root; a hostile same-UID process that can replace `~/.redshift` during an operation is outside this local CLI boundary and can already access that user's Redshift session/configuration.
- Relay URLs use the existing validated normalization contract.
- Exact event signature and ID are reverified before retry.
- Permanent failures are never retried automatically.
- Duplicate acceptance is success.
- A retry cannot alter project state or create a newer logical version.

## Testing

Unit tests cover typed classification, misleading reason text, duplicate confirmation/query timeout, merge, retry target selection, storage validation, identity mismatch, tampering, bounds, and cleanup. Compiled E2E covers a below-quorum accepting/rejecting/unavailable set. Browser degraded-success E2E uses five endpoints: three accepting, one permanently rejecting, and one unavailable/recovered. Both assert per-relay publish counts, exact event bytes/ID, unavailable-only retry, and exact-ID query convergence rather than timing alone.
