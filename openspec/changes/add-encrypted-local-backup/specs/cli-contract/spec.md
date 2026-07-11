## MODIFIED Requirements

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

## ADDED Requirements

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
