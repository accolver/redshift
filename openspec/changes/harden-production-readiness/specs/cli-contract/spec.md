## ADDED Requirements

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
The CLI SHALL support validated batch get/set/delete, names/plain/missing handling, confirmed destructive operations, and env/JSON exports to stdout or an explicit path. Unsupported clipboard, mount, fallback, and encrypted-export claims SHALL be removed.

#### Scenario: Batch mutation
- **WHEN** one entry in a batch is invalid
- **THEN** no entry is published

#### Scenario: Noninteractive delete
- **WHEN** stdin is not a TTY and `--yes` is absent
- **THEN** deletion refuses without publishing

#### Scenario: Upload validation
- **WHEN** an env upload contains malformed, reserved, duplicate-after-normalization, or invalid entries
- **THEN** upload fails before publishing

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
- **THEN** the credential is not written to config and the user receives a non-secret fallback instruction

#### Scenario: Manager disconnect
- **WHEN** SecretManager disconnects
- **THEN** its internal key copy is zeroized and the caller's byte array is unchanged
