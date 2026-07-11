## ADDED Requirements

### Requirement: Encrypted Backup and Restore Evidence
The production and release gates SHALL include deterministic shared cryptographic tests, adversarial archive/filesystem tests, command preflight tests, and an explicit compiled-binary local-relay journey proving encrypted creation and fresh-session/identity restore without plaintext, credential, process, or temporary-artifact leakage.

#### Scenario: Known-answer and negative cryptography
- **WHEN** the shared backup format is tested
- **THEN** frozen vectors and round trips pass while wrong passphrases, authenticated-header/ciphertext tampering, truncation, trailing bytes, schema confusion, noncanonical payloads, and excessive resource requests fail closed

#### Scenario: Compiled fresh-session journey
- **WHEN** the exact compiled CLI is tested against deterministic real local relays
- **THEN** multiple project/environment bundles are archived to a mode-`0600` encrypted file, restored under a fresh config/authorized target signer, and fetched with identical logical values

#### Scenario: Conflict and partial failure
- **WHEN** compiled restore encounters a conflicting destination or degraded/below-quorum publication
- **THEN** default conflict produces zero writes, explicit overwrite is required, and partial publication produces truthful per-bundle output plus existing exact-event recovery evidence

#### Scenario: Release workflow inclusion
- **WHEN** CI or release certification runs
- **THEN** the compiled backup/restore journey and wrong-passphrase/tamper failure are explicit non-skipped gates on supported artifacts

#### Scenario: Cleanup
- **WHEN** any backup test succeeds or fails
- **THEN** no passphrase, plaintext archive, signer key, relay/server process, port, temporary config, or archive artifact remains
