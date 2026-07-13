## 0. Approval Gate

- [ ] 0.1 Obtain explicit approval for this proposal and its design before implementation.
- [ ] 0.2 Confirm the exact GitHub draft-asset download mechanism and native-runner matrix without publishing a test release as latest.

## 1. Contract Tests

- [ ] 1.1 Add workflow-policy tests proving publication depends on every pre-publication native certification job.
- [ ] 1.2 Add negative tests for tag/source/asset/checksum/SBOM/attestation mismatch, missing artifacts, cancelled jobs, and partial publication.
- [ ] 1.3 Add SBOM schema, subject, and dependency-coverage tests for root and relay frozen graphs.

## 2. Draft Artifact Certification

- [ ] 2.1 Upload all native binaries, checksums, and SPDX output to the draft release while preserving immutable source binding.
- [ ] 2.2 Download draft assets through an authenticated exact-release-ID path and certify Linux x64/arm64 plus native macOS x64/arm64 without assuming the Git tag exists.
- [ ] 2.3 Emit a signed or attested evidence manifest containing draft release ID, expected tag name, source commit, workflow run, asset names, digests, and certification conclusions.

## 3. Publication and Recovery

- [ ] 3.1 Publish the unchanged draft as non-latest only after all draft gates succeed, then verify the created tag resolves to the certified source commit.
- [ ] 3.2 Promote to latest only after public installer/updater canaries succeed; keep withdrawal for every later non-successful certification.
- [ ] 3.3 Verify rollback preserves evidence and always fixes forward with a new patch release rather than replacing assets.

## 4. Documentation and Verification

- [ ] 4.1 Update the release ceremony and incident runbook with exact commands and evidence locations.
- [ ] 4.2 Run strict OpenSpec validation, workflow-policy tests, the complete production gate, and independent adversarial review.
- [ ] 4.3 Record residual GitHub governance and third-party availability dependencies without converting them into guarantees.
