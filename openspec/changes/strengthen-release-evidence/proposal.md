# Change: Strengthen release evidence before publication

## Status

**Proposed and unapproved.** This change defines a release-architecture redesign only. Existing fail-closed withdrawal and manual tag-verification bug fixes may proceed, but pre-publication staging, certification, and expanded SBOM behavior MUST NOT be implemented until this proposal is approved.

## Why

The current workflow verifies locally built artifacts before publication, but its fresh-install certification uses public release assets only after the draft has been published as latest. A bad asset can therefore be publicly recommended during the certification window. The generated SPDX file also needs an explicit coverage and validation contract before it can support stronger supply-chain claims.

## What Changes

- Keep Release Please releases draft while every supported native artifact is built, checksummed, attested, uploaded to the exact draft release, downloaded again through an authenticated release-ID path, and certified on its native platform.
- Bind the draft release ID, expected version/tag name, checkout, assets, checksum manifest, SBOM, attestations, and certification record to one immutable source commit; do not assume the Git tag exists while the release is draft.
- Publish the unchanged draft as non-latest only after the pre-publication matrix succeeds, verify the newly created tag resolves to the certified commit, then promote it to latest only after the required public-path canaries succeed.
- Retain independent post-public installer canaries and withdraw latest status on every non-success outcome; never replace trusted bytes in place.
- Define an SPDX validation and coverage policy for frozen root and relay dependency graphs, first-party packages, build tools, generated artifacts, and native release subjects.
- Record a machine-readable release evidence manifest and a human audit summary for each release.

## Non-Goals

- Changing Redshift cryptography, Nostr event formats, CLI commands, or supported platforms.
- Publishing a release, changing GitHub protections, or mutating repository secrets as part of proposal drafting.
- Claiming reproducible native binaries across operating systems without independent byte-for-byte evidence.

## Impact

- Affected specs: `release-integrity`, `quality-gates`, `product-truth`
- Affected code after approval: `.github/workflows/release.yml`, `.github/workflows/verify-published-release.yml`, release test scripts, SBOM validation scripts, and release documentation
- Operational dependencies: GitHub draft-release APIs, native Linux/macOS runners, build-provenance attestations, and immutable evidence retention

## Telos Validation

- **L9→L1:** Pre-publication certification protects sovereign users from unauthenticated or defective release bytes, preserves open verification, and implements the promise through explicit native tests and strict tooling.
- **L1→L9:** Existing pinned Bun/GitHub tooling, native runners, checksum and attestation commands, and draft releases make the design technically feasible without weakening cryptographic or product contracts.
- **Convergence:** The proposal aligns and is feasible, but implementation remains gated on explicit approval and validated staging details.
