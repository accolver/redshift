# Design: Encrypted local backup and restore

## Context

The individual product stores current secret state as owner-authenticated NIP-59 Gift Wraps selected by d-tag and deterministic version ordering. Publication recovery repairs partial writes but is not a backup. This change creates a portable encrypted snapshot of the latest non-tombstoned state the CLI observes from its configured relay union and restores that logical state as new target-authorized events.

The format is security-sensitive and must be interoperable with a future browser implementation without changing v1 semantics. No plaintext file, credential, or source event is exported.

## Telos L9→L1→L9 validation

### Downward: purpose to implementation

- **L9:** User-held encrypted snapshots reduce relay dependence and strengthen sovereign control without escrow.
- **L8:** Backup remains free core portability; it is not a managed-relay upsell or SLA.
- **L7:** Familiar `backup create` / `backup restore` workflows hide Nostr internals.
- **L6:** Hidden passphrases, explicit file paths, identity/conflict confirmation flags, and non-secret summaries keep the journey clear.
- **L5:** The validated journey is authenticate source → create archive → move to fresh configuration → authenticate target → preflight → restore → retrieve exact logical values.
- **L4:** The binary archive is a new local contract; restore still uses existing NIP-59 ownership, d-tags, version ordering, quorum, and publication recovery.
- **L3:** Crypto/format code belongs in `@redshift/crypto`; CLI orchestration and filesystem code remain isolated. No Svelte component is introduced.
- **L2:** TDD covers format vectors, hostile inputs, filesystem failure, conflict preflight, partial publication, and compiled E2E.
- **L1:** Strict TypeScript, exact schemas, bounded untrusted work, no `any`, owner-only files, no secret logging, and best-effort buffer clearing are mandatory.

### Upward: feasibility to purpose

- Bun and WebCrypto provide AES-256-GCM; `@noble/hashes` provides portable scrypt without a native/WASM service dependency.
- Existing authenticated state selection can expose source versions and tombstones for safe restore preflight.
- Existing publication recovery can preserve each exact restored event after partial relay failure.
- Nostr cannot make a multi-d-tag restore globally atomic, and a relay union query cannot prove every relay answered. Preflight, deterministic order, stop-on-failure behavior, and truthful reporting preserve a useful sovereign workflow without overstating guarantees.
- Both directions converge. The capability is feasible and directly advances no-lock-in and user-controlled resilience.

## Decisions

### 1. CLI-only initial user surface; shared format

V1 ships CLI commands only. Envelope and payload cryptography live in `@redshift/crypto` so a later browser flow can consume the same format. A browser UI requires its own design and E2E work.

### 2. Fixed binary v1 envelope

The archive is binary, not attacker-parameterized JSON. All integers are unsigned big-endian.

| Offset | Size | Field | Required v1 value |
| ---: | ---: | --- | --- |
| 0 | 8 | magic | ASCII `REDSHIFT` |
| 8 | 2 | format version | `1` |
| 10 | 1 | suite | `1` (scrypt + AES-256-GCM) |
| 11 | 1 | flags | `0` |
| 12 | 4 | header length | `64` |
| 16 | 4 | scrypt N | `131072` |
| 20 | 4 | scrypt r | `8` |
| 24 | 4 | scrypt p | `1` |
| 28 | 4 | plaintext length | at most 16 MiB |
| 32 | 4 | ciphertext length | plaintext length + 16-byte tag |
| 36 | 16 | random salt | cryptographic random bytes |
| 52 | 12 | random nonce | cryptographic random bytes |
| 64 | variable | ciphertext/tag | WebCrypto AES-GCM output |

The exact 64 header bytes are AES-GCM additional authenticated data. V1 accepts only the exact version, suite, flags, header length, KDF parameters, nonce/salt lengths, and declared lengths. File length must equal `64 + ciphertextLength`; truncation and trailing bytes fail. Structural and size checks happen before scrypt.

Unknown versions or suites fail closed with no fallback. Wrong passphrase or authenticated-data/ciphertext corruption returns one generic authentication error.

### 3. Memory-hard KDF and AEAD

- KDF: scrypt from direct `@noble/hashes`, fixed `N=131072`, `r=8`, `p=1`, 32-byte result, 16-byte random salt.
- Cipher: WebCrypto AES-256-GCM, 12-byte random nonce, 128-bit tag.
- Creation accepts passphrases of 12–1024 UTF-8 bytes. Restore accepts 1–1024 bytes so a short wrong passphrase follows the same authenticated-decryption failure path.
- Passphrases are not trimmed or normalized. Unpaired UTF-16 surrogates are rejected to avoid encoding ambiguity.
- Owned byte arrays for passphrase encoding, plaintext, and derived keys are filled in `finally`. Immutable JavaScript strings, WebCrypto internals, OS paging, and garbage-collected copies cannot be guaranteed erased; documentation must not claim perfect memory zeroization.

The direct dependency is justified because PBKDF2 is not memory-hard and native-only scrypt would prevent future browser interoperability. Any future KDF change requires a new suite/version.

### 4. Canonical encrypted payload

The authenticated plaintext is canonical UTF-8 JSON with a fixed insertion order:

```json
{
  "schema": "com.redshiftapp.backup",
  "version": 1,
  "createdAt": 1783792800,
  "sourcePubkey": "<64 lowercase hex>",
  "contents": {
    "secretState": "current-observed",
    "projectMetadata": "identifiers-only",
    "relayConfiguration": "excluded",
    "signerCredentials": "excluded",
    "historyAndTombstones": "excluded"
  },
  "entries": [
    {
      "project": "project",
      "environment": "dev",
      "sourceCreatedAt": 1783792700,
      "sourceEventId": "<64 lowercase hex>",
      "secrets": [["API_KEY", "value"]]
    }
  ]
}
```

Entries sort by canonical d-tag; secret pairs sort by key. Arrays preserve duplicate detection. Decryption validates exact keys/types/bounds, canonical project/environment and secret rules, unique d-tags and secret keys, nonempty live bundles, source IDs/timestamps, count/aggregate limits, and then reserializes and requires byte equality.

Limits:

- 16 MiB plaintext and 16 MiB + 80 bytes total archive.
- 4,096 bundles, 4,096 secrets per bundle, and 65,536 total secrets.
- Existing project, environment, secret-name, value, and Gift Wrap publication limits remain authoritative.
- Backup creation rejects invalid authenticated d-tags instead of silently omitting them.

Signer credentials, passphrases, keychain/config auth, bunker pointers/client keys, relay URLs, recovery files/events, historical events, and tombstones are structurally impossible to serialize because the payload is constructed through an allowlist.

### 5. Snapshot completeness boundary

Creation queries the configured relay union once and snapshots the latest authenticated non-tombstoned state observed from relays that respond. It cannot prove an unavailable relay does not hold otherwise missing state. Output and documentation say “observed current state,” never “complete relay backup.” Arbitrary undecryptable/attacker events remain ignored as in normal state selection.

### 6. Passphrase boundary

Commands:

```text
redshift backup create <file> [--force] [--passphrase-stdin]
redshift backup restore <file> [--overwrite] [--allow-identity-change] [--passphrase-stdin]
```

No `--passphrase` option and no passphrase environment variable exist.

- Interactive create prompts twice through hidden TTY input and requires equality.
- Interactive restore prompts once.
- Default prompting refuses non-TTY stdin, and `--passphrase-stdin` refuses a TTY so passphrases cannot silently cross the wrong input boundary.
- `--passphrase-stdin` consumes exactly two newline-delimited values for create and one for restore, preserving spaces and rejecting unexpected extra nonempty input.
- Prompts use stderr; machine-readable stdout remains free of prompts and secret data.
- Hidden-input terminal mode and listeners restore in `finally` on newline, EOF, error, or interrupt.

### 7. Atomic owner-only files

Create requires an existing real parent directory. It rejects destination symlinks, directories, devices, FIFOs, and sockets. Without `--force`, an existing path is never replaced. With `--force`, only a previously validated regular file may be replaced.

The CLI creates only encrypted same-directory temporary bytes using `O_CREAT | O_EXCL | O_NOFOLLOW`, mode `0600`; fsyncs the file; atomically installs/replaces it; fsyncs the directory; and cleans temporary/backup artifacts. A durable owner-only commit marker distinguishes an incomplete replacement (restore the rollback link) from a committed replacement whose rollback deletion was interrupted (keep the new archive). Cooperative operations serialize through the shared SQLite lock, and later reads/writes reconcile valid markers, rollback links, and bounded matching orphan temporaries. Failure before commit preserves the prior destination bytes. Restore opens with `O_NOFOLLOW`, requires a regular owner-only file, checks size from the open handle, performs a bounded exact-length read with concurrent-growth detection, and never allocates from an unchecked changing file size.

### 8. Restore identity and conflict behavior

Restore decrypts and validates the complete archive before relay publication, then requires a separately authenticated target signer. It never imports or generates a signer.

- Source and target owner must match by default.
- `--allow-identity-change` explicitly authorizes migration to the current different signer; restored events are newly authored/encrypted for that target.
- The destination state query includes latest live state and tombstones with source versions.
- Missing or tombstoned targets are publish candidates.
- Identical live targets are no-ops.
- Different live targets are conflicts. Default behavior aborts all publication during preflight; `--overwrite` authorizes full-bundle replacement without merging destination-only keys.
- Backup entries never delete destination d-tags absent from the archive.
- Every new write uses an inner timestamp strictly greater than the observed target version and, for same-identity restore, the archived source version; it remains within the existing future-skew bound.
- A remote-signer transport, timeout, denial, or unclassified decrypt failure aborts snapshot/preflight rather than being cached as an unrelated event; only recognized malformed NIP-44 ciphertext errors are skippable.

Entries publish in canonical order through `SecretManager.publishSecrets()`. Each receives normal quorum and durable exact-event recovery. The batch is not globally atomic: on a below-quorum or persistence-uncertainty failure, restore stops, reports completed/no-op/pending counts and the recovery event ID without secret values, and does not attempt compensating deletion. Rerun is logically idempotent because identical entries become no-ops.

## Rejected alternatives

- **PBKDF2:** dependency-free but not memory-hard against low-entropy passphrases.
- **Native `node:crypto` scrypt:** strong for CLI but prevents a shared browser-compatible implementation.
- **Argon2id dependency/WASM:** preferred in some settings but adds a larger unreviewed implementation/runtime surface; a future suite may add it after dependency and browser evaluation.
- **JSON envelope with caller-selected KDF values:** canonicalization and resource-amplification risks.
- **Including nsec/bunker credentials:** creates key escrow and account-recovery claims contrary to Telos.
- **Backing up raw relay events/history:** conflates current-state portability with history and can replay obsolete/tombstoned state.
- **Automatic conflict merge or implicit identity migration:** can preserve unintended destination secrets or publish under the wrong identity.
- **Global rollback after partial restore:** creates additional competing Nostr versions and cannot undo accepted relay history.

## Validation plan

- Frozen format vectors and Bun/browser-compatible crypto round trips.
- Negative structural/KDF/AEAD/payload tests and malformed-input fuzz corpus.
- Atomic filesystem and hidden-input tests.
- Command preflight/conflict/identity/partial-publication tests.
- Compiled local-relay fresh-config and fresh-identity E2E.
- Explicit production/release workflow inclusion, full production gate, independent security/correctness reviews, public artifact attestation, and native installed-binary backup/restore certification on Linux x64/arm64 and macOS x64/arm64 before capability claims.
