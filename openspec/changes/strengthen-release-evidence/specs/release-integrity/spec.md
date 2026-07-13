## ADDED Requirements

### Requirement: Pre-Publication Native Certification
A release SHALL remain draft and non-latest until every advertised native artifact, checksum manifest, SPDX document, and attestation has been downloaded from the exact draft release ID, bound to its expected tag name and immutable source commit, and certified successfully on the corresponding supported native platform. Certification SHALL NOT assume the Git tag exists before draft publication.

#### Scenario: Complete draft certification
- **WHEN** all four supported native artifacts and their trust material pass exact-release-ID, expected-name, source, digest, attestation, smoke, install, lifecycle, and cleanup checks
- **THEN** the unchanged draft is eligible for non-latest publication, exact created-tag verification, and public-path canaries before latest promotion

#### Scenario: Any non-successful certification
- **WHEN** a required build, upload, download, verification, or native certification job fails, is cancelled, is skipped, or lacks an expected artifact
- **THEN** the release remains draft/non-latest and no failed byte is recommended to users

### Requirement: Comprehensive Release SBOM Evidence
The release SHALL produce a validated SPDX document whose declared coverage includes first-party packages, frozen root and relay dependency graphs, pinned build tools, generated product sources, native artifact subjects, source commit, and explicit exclusions or unresolved relationships.

#### Scenario: SBOM coverage mismatch
- **WHEN** the SPDX document is malformed, omits a required frozen graph or first-party package, names the wrong source, or overstates an unsupported artifact relationship
- **THEN** release certification fails before publication

#### Scenario: SBOM evidence is auditable
- **WHEN** a release is certified
- **THEN** an independent verifier can associate the SPDX document, checksum, attestation, native assets, tag, and source commit from the retained evidence manifest
