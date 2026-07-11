# cli-contract Specification

## Purpose
Define the supported, strict, and secure Redshift CLI behavior for authentication, configuration, secret operations, process execution, and credential custody.
## Requirements
### Requirement: Exact Process Execution
The CLI SHALL pass positional child argv without join/reparse, SHALL isolate shell evaluation to explicit `--command`, SHALL scrub Redshift auth variables, SHALL reject dangerous runtime-hook secret names, and SHALL preserve child exit/signal semantics.

#### Scenario: Positional arguments
- **WHEN** a child argument contains spaces, quotes, glob characters, an empty string, or backslashes
- **THEN** the child receives the exact original argument bytes

#### Scenario: Authentication environment
- **WHEN** a child is launched while CLI authentication is supplied by environment
- **THEN** requested application secrets are present but `REDSHIFT_NSEC` and `REDSHIFT_BUNKER` are absent

#### Scenario: Runtime hook secret
- **WHEN** a secret name can alter runtime loading or startup behavior
- **THEN** the CLI fails before spawning the child

### Requirement: Strict and Truthful Parsing
The CLI SHALL reject unknown flags, unknown subcommands, missing option values, and removed unsupported functionality with a nonzero usage result.

#### Scenario: Typo
- **WHEN** a user enters an unknown flag or subcommand
- **THEN** the CLI does not run a default operation and exits nonzero

#### Scenario: Child flags
- **WHEN** tokens follow `run --`
- **THEN** they remain child arguments and are not parsed as Redshift flags

### Requirement: Safe Setup and Configuration
Setup SHALL validate slugs before side effects, distinguish overwrite force from interactivity, resolve explicit/project/global defaults deterministically, and preserve typed relay errors. Configuration mutations SHALL be atomic; reset SHALL clear auth, relays, and defaults.

#### Scenario: Existing configuration
- **WHEN** setup targets existing configuration without `--force`
- **THEN** it refuses without changing the file

#### Scenario: Noninteractive missing values
- **WHEN** `--no-interactive` cannot resolve required values
- **THEN** setup exits nonzero without reading stdin

#### Scenario: Invalid configure mutation
- **WHEN** a requested configuration mutation is unknown or invalid
- **THEN** nothing is written and the command exits nonzero

### Requirement: Consistent Secret Operations
The CLI SHALL support one validated secret per get/set/delete invocation, redacted listing, explicit raw reveal, env upload/download to stdout or an explicit path, and a distinct versioned passphrase-encrypted local backup/restore workflow. Unsupported batch mutation, clipboard, mount, fallback, and claims that plaintext env download is encrypted SHALL be removed.

#### Scenario: Invalid mutation
- **WHEN** a secret name or value is invalid
- **THEN** no bundle is published

#### Scenario: Explicit delete
- **WHEN** a user invokes `secrets delete <name>`
- **THEN** the CLI publishes a logical tombstone update for that one secret

#### Scenario: Upload validation
- **WHEN** an env upload contains malformed, reserved, duplicate-after-normalization, or invalid entries
- **THEN** upload fails before publishing

#### Scenario: Plaintext download versus backup
- **WHEN** a user requests env download or encrypted backup
- **THEN** help and output distinguish explicit plaintext `.env` export from the encrypted backup archive

### Requirement: Explicit Secret Reveal
Full secret values SHALL appear only through an explicitly documented reveal path or explicitly secret-bearing export operation; warnings SHALL use stderr and machine-readable stdout SHALL remain parseable.

#### Scenario: Default listing
- **WHEN** a user lists secrets without reveal intent
- **THEN** values are redacted

#### Scenario: Explicit reveal
- **WHEN** a user requests full raw values
- **THEN** values are complete and not truncated

### Requirement: Safe Credential Custody and Ownership
The CLI SHALL not write new plaintext nsec or bunker client keys when the keychain is unavailable, SHALL redact stored credentials by default, and SHALL clone caller-owned key bytes before zeroizing internal copies.

#### Scenario: Keychain failure
- **WHEN** persistent login cannot store a key securely
- **THEN** the credential is not written to config and the user receives a non-secret command-scoped authentication instruction

#### Scenario: Legacy plaintext migration
- **WHEN** a valid legacy nsec or bunker client key exists in config
- **THEN** the CLI stores it in the system keychain before removing every plaintext credential field from config

#### Scenario: Legacy migration failure
- **WHEN** the system keychain is unavailable during legacy migration
- **THEN** the CLI fails closed, preserves the legacy bytes for manual recovery, and never authenticates from plaintext config

#### Scenario: One-time bunker pairing
- **WHEN** a bunker URI contains a `secret=` pairing credential
- **THEN** the CLI rejects it from argv and accepts it only through hidden stdin or command-scoped environment input

#### Scenario: Piped hidden input
- **WHEN** a complete pairing URI and newline arrive in one stdin chunk
- **THEN** the CLI processes the line without echoing or truncating it

#### Scenario: Manager disconnect
- **WHEN** SecretManager disconnects
- **THEN** its internal key copy is zeroized and the caller's byte array is unchanged

### Requirement: Durable CLI Publication Recovery
Before any network attempt, the CLI SHALL atomically persist and fsync a bounded, versioned provisional recovery record in a mode-`0700` directory and mode-`0600` regular file. Final outcomes SHALL atomically replace it. The record SHALL contain only owner/project/environment metadata, the encrypted signed event, relay snapshot, quorum state, and classified outcomes.

#### Scenario: Degraded quorum success
- **WHEN** publication reaches quorum but one relay is unavailable
- **THEN** the command succeeds with a degraded warning and stores the exact event for later retry

#### Scenario: Below quorum
- **WHEN** publication fails below quorum after one relay accepted
- **THEN** the command fails closed while preserving the exact accepted event and all relay outcomes in recovery storage

#### Scenario: Tampered recovery record
- **WHEN** filename/event/report identity, signature, owner tags, authenticated unwrap owner/d-tag, relay URL, schema, symlink status, or bound is invalid
- **THEN** recovery refuses before any relay publication and reports the invalid record

#### Scenario: Outcome persistence failure
- **WHEN** remote publication may have occurred but final outcome replacement fails
- **THEN** the provisional record remains and the command fails with the event ID and an explicit uncertainty warning without generating another event

### Requirement: CLI Recovery Workflow
The CLI SHALL provide list, show, retry, and remove operations for pending publications. Retry SHALL require current authentication matching the record owner and SHALL publish the exact event only to unavailable relays.

#### Scenario: Same-owner retry
- **WHEN** the authenticated owner retries a valid record after a relay recovers
- **THEN** the CLI updates per-relay outcomes and removes the record only when every original relay is accepted

#### Scenario: Permanent rejection remains
- **WHEN** all unavailable relays recover but one original relay is permanently rejected
- **THEN** the record remains inspectable until explicit removal

#### Scenario: Different owner
- **WHEN** a different authenticated identity attempts retry
- **THEN** the CLI refuses before any relay publication

#### Scenario: Explicit removal
- **WHEN** the user removes a pending or permanently rejected record
- **THEN** the local recovery record is deleted without publishing or claiming relay deletion

### Requirement: Strict Encrypted Backup Commands
The CLI SHALL provide `backup create <file>` and `backup restore <file>` with subcommand-specific force, overwrite, identity-change, and explicit stdin flags; it SHALL reject unknown flags, missing/excess positional values, passphrase argv flags, and unsupported combinations with a nonzero usage result.

#### Scenario: Create parsing
- **WHEN** a user invokes `backup create <file>` with optional `--force` or `--passphrase-stdin`
- **THEN** the CLI dispatches exactly one validated output path without exposing a passphrase in argv

#### Scenario: Restore parsing
- **WHEN** a user invokes `backup restore <file>` with optional `--overwrite`, `--allow-identity-change`, or `--passphrase-stdin`
- **THEN** the CLI dispatches exactly one validated input path and the explicit conflict/identity policy

#### Scenario: Machine-readable boundary
- **WHEN** backup create/restore reports success, no-op, conflict, degraded publication, or failure
- **THEN** prompts and warnings use stderr and stdout contains only documented non-secret results

