# Next Resilience Improvements

Per-relay recovery shipped in v0.12.0, encrypted local backup/restore in v0.13.0, and bounded authenticated history/compare/restore in certified v0.14.0. Sections 4–5 and managed-production operations remain unapproved operational work requiring separate Telos/OpenSpec acceptance.

## 1. Per-relay health and publication recovery — shipped in v0.12.0

### Implemented behavior

- CLI and browser classify final relay outcomes as accepted, permanently rejected, or unavailable; browser retry exposes a transient retrying state.
- The exact signed encrypted event is durably recorded before network publication.
- Explicit retry targets unavailable relays only and never signs a replacement logical version.
- Quorum success is reported separately from full configured-relay redundancy.
- CLI records are atomic owner-only files; browser records are scoped to session storage and cleared on logout.
- Permanent rejection remains inspectable until the user explicitly removes the local notice.

### Evidence

- Compiled CLI E2E covers accepted/rejected/unavailable below-quorum publication, recovery, same-byte/event-ID retry, convergence, file modes, and cleanup.
- Five-relay Playwright covers three-relay majority success, permanent rejection, outage, reload persistence, unavailable-only retry, per-relay publish counts, recovered-relay reads, and logout cleanup.

This is local publication recovery, not automatic backup, retention, history, erasure, or an availability guarantee.

## 2. Encrypted local backup and restore — shipped in v0.13.0

### Implemented behavior

- Fixed versioned binary format with memory-hard scrypt, AES-256-GCM, authenticated header bytes, canonical bounded encrypted payload, and no plaintext fallback.
- Hidden or explicit stdin passphrase input; no passphrase argv, config, or environment-variable path.
- Atomic owner-only encrypted files with no plaintext intermediate.
- Snapshot of latest authenticated non-tombstoned state observed from responding configured relays, with project/environment identifiers and source version evidence.
- Explicit exclusion of signer credentials, relay configuration, recovery records, tombstones, and history.
- Same-identity restore by default; explicit target-identity migration and explicit conflict overwrite.
- Restore publishes new target-authorized NIP-59 state through normal quorum and exact-event recovery.

### Evidence

Certified release v0.13.0 passed known-answer and independent crypto interoperability tests; corruption, wrong-passphrase, hostile-format, and resource-bound rejection; atomic filesystem failure coverage; compiled fresh-config/fresh-identity local-relay E2E; partial-publication recovery E2E; and native public-artifact backup/restore certification. See [`piolium/encrypted-local-backup-evidence.md`](../piolium/encrypted-local-backup-evidence.md).

This shipped local capability is user-initiated portability only. It is not automatic, scheduled, managed, offsite, or retained backup; complete relay history; key/passphrase/account recovery; globally atomic restore; RPO/RTO; availability; or an SLA. Periodic production restore drills remain part of future managed-retention evidence, not the local capability.

## 3. Authenticated history, compare, and restore — shipped in v0.14.0

### Implemented behavior

- List only owner-authenticated versions for one project/environment with inner-timestamp/event-ID ordering, strict cursors, fixed bounds, deduplication, and explicit truncation.
- Compare key presence/value equality while outputting only key names and added/removed/changed/unchanged categories.
- Distinguish live versions, current state, and logical tombstones without raw-event or erasure claims.
- Restore a selected complete bundle or tombstone by publishing a strictly newer authorized NIP-59 event through normal quorum and exact-event recovery.
- Refresh authenticated current state before restore, abort on change by default, and require a second explicit overwrite action while documenting the residual lack of Nostr compare-and-swap.
- Keep browser-decrypted history ephemeral and clear it on environment/session cleanup.

### Evidence

Certified v0.14.0 passed shared ordering/diff/pagination and signer-failure tests, CLI/web tests, deterministic compiled local-relay and Chromium journeys, production gates, independent review, and installed public-artifact certification on Linux/macOS x64/arm64. See [`piolium/authenticated-secret-history-evidence.md`](../piolium/authenticated-secret-history-evidence.md).

This capability is bounded state observed from responding relays, not complete/durable history, an audit log, offline recovery, retained managed history, cryptographic erasure, compare-and-swap, RPO/RTO, availability, or an SLA.

## 4. Operational monitoring and incident response

### Current limitation

CI proves behavior, but production uptime, relay retention, geographic redundancy, and incident-response performance are not yet measured guarantees.

### Intended guarantee

- Synthetic checks for website, installer, release attestations, relay NIP-42, declared access policy, writes, reads, and quotas.
- Alerts with owners and severity thresholds that reveal metadata only and never secrets.
- Credential rotation, release compromise, relay outage, data-loss, and billing incident runbooks.
- Measured recovery-time and recovery-point objectives before any SLA is advertised.

### Required evidence

Alert fire/acknowledgement tests, game-day exercises, backup restore drills, credential rotation drills, post-incident reviews, and sustained production measurements.

## 5. Platform and release durability

### Current limitation

Linux and macOS x64/arm64 are supported; Windows is explicitly unsupported. Release availability depends on GitHub and the public installer endpoint.

### Intended guarantee

- Scheduled clean-install and upgrade canaries for every supported platform.
- Independent detection of missing/mutated release assets, attestations, checksums, or installer content.
- A documented alternate verified manual-download path when the convenience installer is unavailable.

### Required evidence

Recurring native/container canaries, installer outage drills, provenance-negative tests, and immutable patch-release recovery exercises.

## Deferred product scope

Teams/RBAC, paid Cloud, Enterprise SSO/compliance, automatic managed-relay backups, geographic redundancy, and SLA claims remain separate product capabilities. They must not be used to redefine the sovereign individual release or be advertised before their own operational evidence exists.
