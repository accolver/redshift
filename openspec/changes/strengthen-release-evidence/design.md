## Context

Release Please creates a draft release, while the current workflow builds and attests native assets before publishing them. Fresh-install tests then consume the public release. This proves the final public path but leaves a window in which a newly published release can be latest before those tests finish.

## Goals / Non-Goals

- Goals: certify the exact draft assets on every supported native platform; bind draft release ID and expected tag name to one commit; validate SBOM coverage; avoid latest status until public-path certification; preserve fail-closed withdrawal.
- Non-goals: changing supported platforms, replacing GitHub as release host, claiming deterministic cross-platform bytes, or implementing managed relay operations.

## Decisions

### Decision: Two-phase draft then public release

1. Release Please creates a draft release with an expected version/tag name bound to the workflow source commit; the Git tag may not exist until publication.
2. Pinned native runners build and smoke-test four assets from that source commit.
3. The workflow generates exact-name checksums and an SPDX document, attests every subject, and uploads them to the exact draft release ID.
4. Native certification jobs download those draft assets through authenticated GitHub APIs, verify release ID/expected name/source/digests/attestations, and run controlled install/lifecycle tests without relying on a Git tag or latest status.
5. After every draft gate succeeds, publish the unchanged release as non-latest so GitHub creates the tag, then verify that exact tag resolves to the certified source commit.
6. Run independent public installer canaries. Only complete success promotes the release to latest; any non-success leaves or marks it non-latest/prerelease.

Alternative considered: publish first and withdraw on failure. Rejected as the primary design because withdrawal cannot eliminate the exposure window.

### Decision: SBOM coverage is explicit, not inferred from file existence

The SPDX gate will validate syntax plus expected first-party packages, root and relay frozen dependency graphs, pinned build tools, native artifact relationships, source commit, and absence of unsupported claims. The evidence must state what the SBOM does not cover.

### Decision: No in-place repair

Published or attested bytes are never replaced. A failed release is preserved as evidence and fixed through a new patch release.

## Risks / Trade-offs

- Draft assets may not be consumable through the public installer path. Mitigation: use authenticated draft download plus a controlled local release endpoint before publication, then retain public canaries afterward.
- More native jobs increase release time and runner cost. Mitigation: keep unit/browser verification centralized while reserving native jobs for artifact-specific checks.
- GitHub API or runner failure can block a good release. This is intentional fail-closed behavior; retry the same immutable run inputs or issue no release.
- SBOM completeness can be overstated. Mitigation: test declared coverage and publish exclusions.

## Migration Plan

Implement on a test branch after approval, exercise a non-latest test release, validate withdrawal and cleanup, then enable the new dependency graph. Existing release assets and tags remain immutable.

## Open Questions

- Which authenticated GitHub endpoint will provide stable draft-asset downloads on all native runners?
- Should the evidence manifest itself receive a separate attestation or be included in the checksum subject set?
- What exact SPDX relationships represent compiled Bun binaries and embedded dashboard/relay-generated sources without overstating component reachability?
