# Design: Operationalize the production release

## Telos validation

### Downward: L9 → L1

- **L9–L8:** An independently verifiable release strengthens sovereignty and user trust without requiring Redshift infrastructure.
- **L7–L5:** Fresh install, setup, secret, run, browser, upgrade, and rollback journeys prove the familiar individual workflow end to end.
- **L4:** Release identity, artifact names, supported platforms, Nostr contracts, and CLI behavior remain stable.
- **L3–L1:** Existing modules are exercised through compiled artifacts, strict types, pinned dependencies, and deterministic gates.

### Upward: L1 → L9

- Patched dependency graphs, hermetic builds, container/native runner coverage, Playwright, and GitHub attestations can support the production claim.
- Docker validates Linux architectures; macOS remains validated on native GitHub runners and the local native host because Docker cannot provide a Darwin kernel.
- The flows converge on a release of the individual product while keeping managed-service guarantees deferred.

## Release model

Release Please remains the version authority. A release is eligible only after the release PR is merged and the release workflow passes verification, native builds, checksums, SBOM generation, provenance attestation, and artifact upload. Public installation validation then consumes the actual GitHub release and verifies repository-bound attestations before executing the binary.

## Dependency policy

Both root and relay lockfiles are audited. Critical/high advisories fail immediately; lower severities also fail unless an explicit reviewed exception records advisory, reachability, owner, and expiry. Production release policy targets zero known advisories.

## Fresh-environment matrix

- Linux x64: Docker container with the public installer and installed CLI lifecycle.
- Linux arm64: native ARM container on ARM hosts and GitHub ARM runners.
- macOS arm64: local native smoke plus GitHub `macos-14` release build/smoke.
- macOS x64: GitHub `macos-15-intel` release build/smoke.
- Windows: explicit unsupported-platform failure.

Container journeys use ephemeral keys, local relays where required, temporary configuration, and complete cleanup.

## Browser confidence

Playwright runs both hosted and compiled embedded dashboards. Release gates cover hydration/CSP, authentication boundaries, project/environment lifecycle, secret create/update/reload/delete, CLI interoperability, logout destruction, custom relay configuration, console errors, and mobile/desktop smoke behavior.

## Rollback

A failed release workflow leaves no trusted installable artifact. Existing installations remain unchanged because installer/updater verification and atomic replacement fail closed. A bad published release is marked non-latest and withdrawn; a patch release is produced rather than mutating artifacts.
