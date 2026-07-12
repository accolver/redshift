# Redshift v0.11.1 Production Release Evidence

**Release:** https://github.com/accolver/redshift/releases/tag/v0.11.1  
**Immutable tag:** `v0.11.1`  
**Source commit:** `eed3fdbd1cc834ae0f2bbddd4a0948196529d6d3`  
**Release workflow:** https://github.com/accolver/redshift/actions/runs/29135599338  
**Result:** passed on the first attempt

## Release workflow evidence

Every required job completed successfully:

- Release Please
- Verify Release
- Build `redshift-darwin-arm64`
- Build `redshift-darwin-x64`
- Build `redshift-linux-arm64`
- Build `redshift-linux-x64`
- Attest and Publish Release
- Verify Published Release (`linux/amd64`, native runner)
- Verify Published Release (`linux/arm64`, native runner)

The failure-recovery job was correctly skipped.

## Product gates

The release verification job passed:

- zero root/workspace dependency advisories;
- zero managed-relay dependency advisories;
- root, web, and relay typechecks;
- scoped Biome lint and format;
- deterministic web embeds and generated relay worker;
- 130 crypto/package tests;
- 6 rate-limiter tests;
- 507 CLI tests;
- 340 web tests;
- 17 managed-relay tests;
- 11 explicit compiled installer/updater/CLI/NIP-46 release lifecycle tests;
- 2 Chromium hosted/embedded browser journeys;
- strict OpenSpec validation.

## Public artifact checksums

The independently downloaded `checksums.txt` was applied to every release asset.

| Asset | SHA-256 |
| --- | --- |
| `redshift-darwin-arm64` | `f3bc3bdf2df14b9cab5c2809ed3410212a3b3299f8e3ba7518ea4c8f55a91e62` |
| `redshift-darwin-x64` | `3db14bd95de1cbd17c5dd15881fa9b1b423b711d924a2c612ce9b23b7a41af13` |
| `redshift-linux-arm64` | `8194d5ac77c1f902da77f6e1147cadd20c36ab22162808922cfdcaaabedb3e64` |
| `redshift-linux-x64` | `95ba2c705040c01bd3cc0d93607aaafb1c90f2dda747e4a6584ffbb75ae24d21` |
| `sbom.spdx.json` | `ab1b0b6cc87689489461410f872ad7a40c1c34003bf3e754f74c4648256d9894` |

## Attestation evidence

`gh attestation verify` passed independently for:

- all four native binaries;
- `checksums.txt`;
- `sbom.spdx.json`.

Verification was bound to:

- repository `accolver/redshift`;
- signer workflow `accolver/redshift/.github/workflows/release.yml`;
- source digest `eed3fdbd1cc834ae0f2bbddd4a0948196529d6d3`;
- GitHub-hosted runners only.

## Fresh-install evidence

### Linux

The release workflow used native GitHub runners for both architectures. Each empty container:

1. installed the pinned public release through `https://redshiftapp.com/install`;
2. verified repository-bound GitHub attestations and exact checksums;
3. ran version/help/unknown-command checks;
4. started a local `nak` relay;
5. completed configure, setup, secret set/list/get, exact child execution, and deletion;
6. confirmed Redshift credentials were scrubbed from the child environment;
7. forced a same-tag updater download, attestation, checksum, smoke test, and atomic replacement;
8. cleaned relay, credentials, temporary directories, and container image.

### macOS

- Native macOS arm64 release artifact version/help/unknown-command smoke passed.
- The public latest installer resolved and installed `v0.11.1` on macOS arm64.
- macOS arm64 and x64 artifacts were built and smoke-tested on native GitHub runners.

### Windows

Windows remains explicitly unsupported and no Windows artifact is advertised.

## v0.11.0 recovery exercise

The preceding v0.11.0 release served as a successful fail-closed recovery drill:

1. A draft release had no fetchable Git tag, causing verification checkout to fail.
2. The draft remained unpublished.
3. Recovery used an immutable tag at the exact draft target commit.
4. Builds, checksums, SBOM, and attestations passed, but the emulated ARM post-publication relay canary timed out.
5. The workflow automatically marked v0.11.0 non-latest/prerelease.
6. Native x64/arm64 manual certification then passed.
7. The workflow was corrected to build from `github.sha`, use pinned installer versions, and run architecture-native certification.
8. v0.11.1 proved the corrected fully automatic flow on its first attempt.

Published artifact bytes were never replaced or clobbered.

## Remaining non-release scope

This evidence certifies the sovereign individual release. It does not claim managed-relay backup/retention, geographic redundancy, SLA, Teams/RBAC, Cloud availability, Enterprise SSO/compliance, or cryptographic erasure of relay-retained ciphertext. Those remain governed by `docs/resilience-next.md` and separate approved work.
