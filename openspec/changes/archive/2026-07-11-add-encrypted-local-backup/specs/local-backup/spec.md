## ADDED Requirements

### Requirement: Versioned Authenticated Backup Envelope
The CLI SHALL create and consume a bounded binary v1 archive using fixed memory-hard scrypt parameters, AES-256-GCM, exact authenticated header bytes, canonical encrypted payload bytes, cryptographically random salt/nonce values, and no algorithm or plaintext fallback.

#### Scenario: Successful encrypted creation
- **WHEN** an authenticated user creates a backup with a valid confirmed passphrase
- **THEN** the current observed logical secret state round-trips through a versioned authenticated archive without a plaintext file or log

#### Scenario: Wrong passphrase or corruption
- **WHEN** the passphrase is wrong or any authenticated header, ciphertext, or tag byte is modified
- **THEN** restore fails with a generic authentication error before relay connection or publication

#### Scenario: Hostile envelope
- **WHEN** an archive has an unknown version/suite, noncanonical flags/parameters, malformed or excessive lengths, truncation, or trailing bytes
- **THEN** it fails within documented bounds before expensive KDF work where structurally possible

#### Scenario: Existing destination file
- **WHEN** create targets an existing path without explicit force
- **THEN** the existing bytes remain unchanged

### Requirement: Explicit and Bounded Backup Contents
The encrypted payload SHALL contain only the latest authenticated non-tombstoned secret bundles observed from configured responding relays, canonical project/environment identifiers, source owner/version evidence, and explicit inclusion/exclusion metadata. It SHALL exclude signer credentials, passphrases, keychain/auth configuration, bunker material, relay configuration, raw events, publication-recovery state, tombstones, and history.

#### Scenario: Canonical payload
- **WHEN** equivalent logical state is archived
- **THEN** entries and secret keys have deterministic canonical ordering and duplicate d-tags or secret names are rejected

#### Scenario: Resource limits
- **WHEN** a payload exceeds file, plaintext, bundle, secret-count, identifier, value, or aggregate limits
- **THEN** create/restore fails before writing plaintext or publishing relay state

#### Scenario: Unavailable relay
- **WHEN** one configured relay does not answer the snapshot query
- **THEN** output describes state observed from responding relays and does not claim complete relay history or guaranteed completeness

#### Scenario: Credential fixture
- **WHEN** config, keychain, bunker, recovery, and authentication fixtures exist during creation
- **THEN** none of their structural fields or values appear in the decrypted allowlisted payload

### Requirement: Authenticated Restore as New Target State
Restore SHALL require a separately authenticated target signer, fully decrypt/validate/preflight before publication, and publish newly target-authored NIP-59 state through existing ownership, d-tag, strictly newer version, quorum, and durable publication-recovery contracts.

#### Scenario: Same-identity fresh destination
- **WHEN** the authenticated owner matches the archive source and destination d-tags are absent or tombstoned
- **THEN** restored values are published strictly newer than both the observed destination version and archived source version, and can be fetched from a real relay

#### Scenario: Different target identity
- **WHEN** source and target owners differ
- **THEN** restore performs no publication unless explicit identity-change authorization is present, and it never imports or claims recovery of the source signer

#### Scenario: Identical destination
- **WHEN** a destination bundle already equals the backup bundle
- **THEN** restore treats it as a no-op and publishes no redundant version

#### Scenario: Conflicting destination
- **WHEN** any live destination bundle differs from the backup
- **THEN** default restore aborts every publication during preflight, while explicit overwrite authorization replaces full bundles without merging destination-only keys

#### Scenario: Future selected version
- **WHEN** a destination tombstone or live state has a current or future-within-tolerance timestamp
- **THEN** the restore event timestamp is strictly greater while remaining within the accepted future-skew bound, or restore fails before publication

#### Scenario: Partial multi-bundle restore
- **WHEN** a later deterministic restore publication fails or has uncertain persistence
- **THEN** completed/no-op/pending counts and recovery guidance are reported without secret values, no global atomicity or rollback is claimed, and exact-event recovery remains available

#### Scenario: Remote signer uncertainty during snapshot or preflight
- **WHEN** a remote signer times out, denies, loses transport, or returns an unclassified decryption error
- **THEN** backup creation or restore preflight fails instead of caching the event as unrelated and omitting authenticated state

### Requirement: Safe Archive and Passphrase Handling
The CLI SHALL accept backup passphrases only through hidden interactive input or an explicit stdin mode, preserve passphrase bytes without trimming/normalization, reject ambiguous input, write encrypted archives atomically with owner-only permissions, and read only bounded no-follow regular owner-only files.

#### Scenario: Process-visible passphrase request
- **WHEN** a user supplies a passphrase through argv, configuration, or an environment variable option
- **THEN** strict parsing or command validation rejects the request

#### Scenario: Passphrase input boundary
- **WHEN** default hidden input is requested without a TTY or explicit stdin mode is requested from a TTY
- **THEN** the CLI rejects the mismatched input mode before reading the passphrase

#### Scenario: Interactive create
- **WHEN** create runs interactively
- **THEN** two hidden passphrase entries must match and terminal state/listeners are restored on completion, error, EOF, or interrupt

#### Scenario: Piped passphrase
- **WHEN** explicit stdin mode is selected
- **THEN** create consumes exactly two matching lines and restore consumes exactly one line without trimming spaces or accepting unexpected nonempty input

#### Scenario: Atomic file failure
- **WHEN** writing, syncing, installing, replacing, or directory-syncing an archive fails
- **THEN** no plaintext artifact remains, failure before durable commit preserves the prior destination, bounded owner-only recovery artifacts are cleaned immediately or reconciled on the next operation, and the error contains no passphrase or secret data
