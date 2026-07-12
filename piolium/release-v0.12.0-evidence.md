# Redshift v0.12.0 release evidence

## Certified release

- Release: https://github.com/accolver/redshift/releases/tag/v0.12.0
- Source commit: `d6695b552f9f49c0f6b6b6932e1397e51609d3df`
- Release workflow: https://github.com/accolver/redshift/actions/runs/29145570021
- Main CI workflow: https://github.com/accolver/redshift/actions/runs/29145570013
- Published: 2026-07-11T08:16:37Z
- State: published, non-prerelease

The release workflow completed the draft-first build, source-bound attestation, publication, native Linux fresh-install verification, and failure-recovery gates. The withdrawal job was skipped because every required job succeeded.

## Release workflow results

- Release Please: passed
- Verify Release: passed
- Native builds: Linux x64, Linux arm64, macOS x64, and macOS arm64 passed
- Attest and Publish Release: passed
- Public fresh-install verification: Linux amd64 and Linux arm64 passed
- Withdraw Failed Release: skipped as expected
- Main Product Verification and Build Artifacts: passed

## Published artifacts

| Artifact | SHA-256 |
| --- | --- |
| `redshift-linux-x64` | `032dcf0a5373cf1585f4490802066144a519c2474ec223648d54eb0e7363a8b8` |
| `redshift-linux-arm64` | `a7706d1f96a16df5f3cc5f4784f0990be30f25ef23ddbd5632761cc3671a7753` |
| `redshift-darwin-x64` | `0a454878568c7dc233152241f5f1dc221cd9d9dfdea30185f0af3a890f2f9dc5` |
| `redshift-darwin-arm64` | `84afe579b091a2b2f7a97f1a0d2541c436f00fb88574377f84b4fd2e2351633d` |
| `checksums.txt` | `70f9f7cb3bd17956e4f2be841cda8ea7c539c2e189a3c1f2c0dcbaa4b62486e7` |
| `sbom.spdx.json` | `3717be2b3cd87ccb4704bfc84777b6deda951629cd033a61bf5d55391ce6b23e` |

## Production and recovery evidence

Before merge, `bun run test:production` passed with:

- zero root/workspace and managed-relay dependency advisories
- strict product and relay typechecks
- scoped Biome and generated-source verification
- 130 crypto tests
- 12 shared rate-limiter tests
- 538 CLI tests
- 358 web tests across 19 files
- 17 managed-relay tests
- 13 explicit compiled lifecycle tests
- 3 Chromium E2E journeys
- strict OpenSpec validation and `git diff --check`
- no leaked repository `workerd`, relay, CLI server, or `nak serve` process

Independent adversarial review found and verified fixes for durable provisional rollback, UUID revision compare-and-swap, exact NIP-20 classification, terminal below-quorum exit status, browser storage failure containment, kind-1059-only recovery, deterministic unavailable-relay ports, and browser-process cleanup.

The published macOS arm64 asset was then downloaded from GitHub, matched against `checksums.txt`, and passed `gh attestation verify` bound to the release workflow and exact source digest with self-hosted provenance denied. That public binary reported `redshift v0.12.0` and passed `cli/tests/integration/relay-publication-recovery.test.ts`, proving below-quorum persistence and byte-identical unavailable-only retry from the released artifact. A separate pinned public installer run installed v0.12.0 into a clean temporary directory and passed version/help smoke tests.

## Claim boundary

This release certifies classified per-relay outcomes and exact-event local publication recovery for the sovereign individual product. Recovery is not backup, history, retention, cryptographic erasure, managed-relay availability, or an SLA. Managed-service claims remain gated on credentialed deployment, monitoring, incident exercises, encrypted backup/restore drills, retention evidence, and measured uptime.
