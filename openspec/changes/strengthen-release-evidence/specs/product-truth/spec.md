## ADDED Requirements

### Requirement: Release Claims Require Retained Certification Evidence
Documentation SHALL describe a release as certified only when retained evidence identifies the immutable tag, source commit, workflow run, complete native asset matrix, exact digests, SPDX validation, attestations, pre-publication conclusions, and post-public canary conclusions.

#### Scenario: Incomplete release evidence
- **WHEN** any required artifact, platform, trust check, or job conclusion is absent or non-successful
- **THEN** product surfaces omit or withdraw the production-ready/latest claim and identify the release as uncertified
