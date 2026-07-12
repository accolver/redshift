# Tasks: Operationalize the production release

## 0. Validation and specification

- [x] 0.1 Create the high-priority Telos validation task.
- [x] 0.2 Run L9→L1→L9 validation and confirm convergence on the sovereign individual release.
- [x] 0.3 Create and strictly validate this OpenSpec change before implementation.

## 1. SEC-017 dependency closure

- [x] 1.1 Capture root and relay advisory baselines.
- [x] 1.2 Upgrade vulnerable direct/transitive dependency groups with frozen lockfiles.
- [x] 1.3 Add release-blocking root and relay dependency-audit commands and workflow policy coverage.
- [x] 1.4 Run complete product, relay, browser, build, and generated-source gates after upgrades.
- [x] 1.5 Update the audit register with advisory counts, remediation, and final zero-advisory evidence.

## 2. Release documentation and controls

- [x] 2.1 Add an exact GitHub release ceremony, verification, rollback, and incident procedure to `AGENTS.md`.
- [x] 2.2 Add tests that require the documented release commands and release workflow gates to remain synchronized.
- [x] 2.3 Ensure release assets are not considered complete until checksums, SBOM, provenance, and all supported binaries exist.

## 3. Fresh setup and installer validation

- [x] 3.1 Add a Linux container fresh-install test that consumes a real or controlled release and exercises version/help/setup/auth/secret/run/delete behavior.
- [x] 3.2 Run the container journey for Linux arm64 and x64 on native GitHub runners.
- [x] 3.3 Exercise macOS arm64 locally and macOS arm64/x64 through native GitHub runners; document the Docker limitation.
- [x] 3.4 Verify unsupported Windows behavior remains explicit.

## 4. Browser and E2E confidence

- [x] 4.1 Run existing Playwright journeys locally in Chromium and inspect console/CSP/network failures.
- [x] 4.2 Expand release-blocking browser coverage for auth refusal/fallback, secret lifecycle, reload, logout cleanup, custom relay, and compiled dashboard interoperability.
- [x] 4.3 Add a single production-readiness command that runs dependency, build, CLI, relay, browser, installer/updater, and generated-source gates.
- [x] 4.4 Require deterministic cleanup of subprocesses, relays, ports, temporary credentials, and browser results.

## 5. Real release execution

- [x] 5.1 Complete PR QA and merge this change.
- [x] 5.2 Review and merge the Release Please PR.
- [x] 5.3 Monitor the corrected v0.11.1 release workflow to first-attempt success, including both native Linux certification jobs.
- [x] 5.4 Verify public release assets, exact checksums, SBOM, repository-bound GitHub attestations, installer, updater, and native smoke behavior.
- [x] 5.5 Record release URL, tag, workflow run, artifact digests, and supported-platform results.

## 6. Next resilience tranche

- [x] 6.1 Document per-relay health/quorum recovery, encrypted backup/recovery, history/restore semantics, monitoring, incident response, and recovery drills as the next prioritized improvements.
- [x] 6.2 Keep Teams, Cloud, Enterprise, SLA, and cryptographic-erasure claims explicitly deferred.

## 7. Final gates

- [x] 7.1 Root, web, relay, and package typechecks pass.
- [x] 7.2 Scoped Biome lint/format and `git diff --check` pass.
- [x] 7.3 Product, relay, compiled CLI, fresh-install, Playwright, and release verification pass without skips.
- [x] 7.4 Strict OpenSpec validation passes and no temporary processes, credentials, or generated artifacts remain.
