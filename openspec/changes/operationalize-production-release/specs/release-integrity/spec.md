## MODIFIED Requirements

### Requirement: Authenticated Release Artifacts
Production releases SHALL include exact-name SHA-256 metadata, SPDX SBOM, provenance, and artifact attestations bound to the expected repository, workflow, immutable tag, commit, artifact name, and digest. Every advertised platform artifact SHALL exist before the release is considered complete.

#### Scenario: Public release certification
- **WHEN** a release workflow reports success
- **THEN** an independent verifier can download each supported artifact, verify its checksum and GitHub attestation against `accolver/redshift`, and execute its version/help smoke contract

#### Scenario: Partial release
- **WHEN** any supported binary, checksum, SBOM, attestation, or verification job is absent or failed
- **THEN** the release is not certified as production-ready and shall not remain the latest advertised release

## ADDED Requirements

### Requirement: Documented Release Ceremony
`AGENTS.md` SHALL document the exact preflight, Release Please, workflow monitoring, artifact verification, clean-install, rollback, and incident commands used for a full GitHub release.

#### Scenario: Agent performs a release
- **WHEN** an agent is instructed to publish a production release
- **THEN** it follows the documented ceremony, stops on any failed gate, and records tag, commit, workflow, assets, and verification evidence

### Requirement: Immutable Release Recovery
Published release assets SHALL never be silently replaced to repair a defect. A failed or bad release SHALL be withdrawn from latest status and corrected by a new patch release.

#### Scenario: Defective published artifact
- **WHEN** post-publication verification detects a bad artifact or claim
- **THEN** maintainers preserve evidence, remove latest/recommended status, publish an incident note, and issue a new version rather than using `--clobber` to mutate trusted bytes
