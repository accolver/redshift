# Change: Operationalize the production release

## Why

Redshift's core hardening is locally and continuously verified, but production readiness still depends on resolving reachable dependency advisories, exercising a real attested GitHub release, validating clean installations, and expanding release-blocking end-to-end evidence across CLI and browser journeys.

## What Changes

- Close SEC-017 with a documented dependency-audit policy, patched lockfiles, and a release-blocking audit gate.
- Document the complete GitHub release ceremony and recovery procedure in `AGENTS.md`.
- Add reproducible clean-install validation for Linux containers and document why macOS requires native runners rather than Docker.
- Expand Playwright and compiled-CLI production journeys, including real release artifact installation and upgrade verification.
- Execute and verify the next GitHub release, including provenance, checksums, SBOM, native artifacts, installer, and updater.
- Record important resilience improvements as the next approved planning tranche without claiming they are shipped.

## Impact

- Affected specs: `quality-gates`, `release-integrity`, `product-truth`
- Affected code: dependency manifests/lockfiles, GitHub workflows, release/install scripts, CLI integration tests, Playwright tests, `AGENTS.md`, roadmap and audit evidence
- Supported scope remains the sovereign individual product; Teams, Cloud, and SLA claims remain deferred.
