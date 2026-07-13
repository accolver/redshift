## ADDED Requirements

### Requirement: Draft Release Certification Matrix
Release gates SHALL exercise the exact draft-hosted Linux x64/arm64 and macOS x64/arm64 artifacts on their corresponding native execution environments before publication, without source fallback, mutable refs, conditional skip, or substitution of locally rebuilt bytes.

#### Scenario: Draft artifact differs from local build output
- **WHEN** a downloaded draft asset name or digest differs from the attested release manifest
- **THEN** the native certification fails even if a local rebuild would pass

#### Scenario: Unsupported substitution
- **WHEN** a Linux container is used to claim macOS behavior, a source command replaces a compiled binary, or a required architecture is unavailable
- **THEN** the matrix fails rather than narrowing the supported-release claim

### Requirement: Post-Publication Canary Recovery
Independent public installer and updater canaries SHALL run after publication and SHALL cause any non-successful release to lose latest/recommended status while preserving immutable evidence.

#### Scenario: Public path regression
- **WHEN** a published asset, installer, attestation, checksum, lifecycle, or forced-upgrade canary is non-successful
- **THEN** the release is withdrawn from latest status and remediation requires a new version
