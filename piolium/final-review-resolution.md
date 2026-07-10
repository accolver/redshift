# Final Hardening Review Resolution

**Review run:** `4adafc2b`  
**Date:** 2026-07-10  
**Method:** two independent read-only diff/truth reviewers; no security scanner or dependency audit.

## Resolved findings

| Finding | Resolution |
| --- | --- |
| Same-second project metadata updates could disappear | `updateProject()` and `addEnvironment()` now use the observed-state monotonic timestamp helper. A fake-clock regression proves consecutive replacements advance to `now + 1` and `now + 2`. |
| Installer/updater candidates could cross filesystems | Installer candidates are created under the install directory; updater candidates are created beside the target binary. Replacement remains a same-filesystem rename, preserves an existing binary before verification, and has rollback/interruption regressions. |
| Attestation verification was repository-scoped only | Installer/updater now require the exact release workflow and the selected release tag's source commit digest, and deny self-hosted-runner attestations. The checksum manifest is also attested. |
| Checksum selection was optional/inexact | Installer/updater now require exactly one attested `checksums.txt`, exactly one canonical entry for the selected exact asset name, and matching SHA-256 before smoke test/replacement. |
| Successful web publishes retained timeout handles | `withPublishTimeout()` clears its timer on success and rejection; fake-timer regressions assert zero pending timers. |
| CI could silently repair a stale embedded dashboard | CI and release jobs rebuild embeds and fail on `git diff`; generator order and string serialization are deterministic. A workflow policy regression protects this gate. |
| Browser E2E cleanup could leak/hang | Relay/server startup is inside `try/finally`; bounded SIGTERM/SIGKILL cleanup handles already-exited processes and always removes the temp directory. |
| Public release and Cloud wording overstated deployed state | README and roadmap identify the controls as next-release/unreleased and note that `v0.10.0` predates them. Pricing describes Cloud as future and deployment-gated. |
| Workflow hardening lacked a regression | `cli/tests/integration/workflow-policy.test.ts` rejects mutable action refs, latest Bun, unlocked installs, broad write permissions, and missing generated-source checks. |
| TEST-002 tracking was contradictory | The issue register now marks the required pinned-`nak` compiled relay journey complete and links the exact CI/test evidence. |

## Intentionally open

The final reviewers confirmed or did not supersede these open gates: secret-bearing bunker argv (`SEC-008`), legacy plaintext credential fallback/local bunker custody (`SEC-013`), fresh dependency audit (`SEC-017`, skipped per user instruction), resilient NIP-46 relay transport (`REL-003`), hosted admin CSP (`WEB-004`), broader all-boundary compiled/installer E2E (`TEST-001`, `TEST-008`), full combined CI gate (`TEST-007`), OpenSpec archival/current truth (`GOV-002`), and final Cloud/Teams architecture approval (`GOV-003`). Credentialed deployment/release and operational backup/SLA evidence remain external.
