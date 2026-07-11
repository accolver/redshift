# Next Resilience Improvements

These improvements are the next production-hardening tranche after the first attested individual release. They are **not shipped guarantees** and must receive separate Telos/OpenSpec approval before implementation.

## 1. Per-relay health and publication recovery

### Current limitation

The CLI reports typed majority-quorum failure, but users do not yet receive a durable per-relay recovery plan after partial publication.

### Intended guarantee

- Show accepted, rejected, unavailable, retrying, and permanently failed relay states.
- Preserve the exact signed event needed to complete a partial publication without generating conflicting state.
- Allow an explicit retry to missing relays while preventing duplicate logical versions.
- Explain when quorum succeeded but redundancy remains degraded.

### Required evidence

Compiled CLI and browser E2E with three or more relays covering outage, permanent rejection, reconnect, partial acceptance, retry, and deterministic read convergence.

## 2. Encrypted backup and recovery

### Current limitation

Exports support portability, but Redshift does not claim automatic backups, durable retention, or recovery from loss of every relay and local key.

### Intended guarantee

- A versioned, passphrase-encrypted backup format with authenticated metadata.
- Explicit distinction between secret data, project metadata, relay configuration, and signer credentials.
- No plaintext backup intermediates or recoverable passphrases in logs/configuration.
- Round-trip restore into a fresh identity/session with clear overwrite and conflict behavior.
- Documented limits: loss of both signer access and recovery material remains unrecoverable.

### Required evidence

Known-answer crypto tests, corruption/wrong-passphrase rejection, large-backup bounds, fresh-machine restore E2E, and periodic restore drills against retained production backups.

## 3. Trustworthy history, compare, and restore

### Current limitation

Redshift selects current logical state deterministically but does not expose a supported history or restore workflow. Relay-retained ciphertext is not a recovery guarantee.

### Intended guarantee

- Display only authenticated owner-authored versions.
- Distinguish current values, historical ciphertext, tombstones, and restored versions.
- Restore by publishing a new authorized version; never rewrite or falsely erase history.
- Compare values without leaking plaintext to logs, URLs, analytics, or server rendering.

### Required evidence

Authorization, tie-order, future-date, tombstone, pagination, concurrent-update, and restore E2E across CLI and browser.

## 4. Operational monitoring and incident response

### Current limitation

CI proves behavior, but production uptime, relay retention, geographic redundancy, and incident-response performance are not yet measured guarantees.

### Intended guarantee

- Synthetic checks for website, installer, release attestations, relay NIP-42, paid/unpaid policy, writes, reads, and quotas.
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
