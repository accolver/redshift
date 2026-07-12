# Redshift Funding Showcase Release Checklist

> Draft showcase checklist for GitHub issue [#23](https://github.com/accolver/redshift/issues/23). It does not authorize a product release; releases follow the repository's gated Release Please workflow.

## Release Decision

- [x] Link the current certified release: [v0.14.0](https://github.com/accolver/redshift/releases/tag/v0.14.0).
- [x] Link installed-artifact evidence: [authenticated history release evidence](../piolium/authenticated-secret-history-evidence.md).
- [ ] Confirm the owner and public location for the funding showcase itself.
- [ ] Confirm whether a future showcase update is documentation-only or accompanies an independently approved product release.

## Required Showcase Artifacts

- [x] Funding showcase overview: [docs/funding-showcase.md](./funding-showcase.md)
- [x] Architecture summary: [docs/funding-showcase.md#architecture-summary](./funding-showcase.md#architecture-summary)
- [x] Demo script outline: [docs/funding-showcase.md#demo-script-outline](./funding-showcase.md#demo-script-outline)
- [x] Install docs link: [README installation](../README.md#installation)
- [x] CLI install docs link: [cli/README installation](../cli/README.md#installation)
- [x] Roadmap link: [ROADMAP.md](../ROADMAP.md)
- [x] Funding ask summary: [docs/funding-showcase.md#roadmap-and-funding-ask-summary](./funding-showcase.md#roadmap-and-funding-ask-summary)
- [x] Canonical threat model: [SECURITY.md](../SECURITY.md)
- [x] Funding threat-model summary: [docs/threat-model.md](./threat-model.md)
- [ ] Final 3-minute demo video URL.
- [ ] Public release notes or docs page URL.

## Reviewer Sanity Checks

- [x] Current public release install path passed on native macOS x64/arm64.
- [x] Current public release install path passed on Linux x64/arm64.
- [ ] `redshift login` works with a throwaway identity.
- [ ] `redshift setup` creates a valid `redshift.yaml`.
- [ ] `redshift secrets set/get/list` works against demo relays.
- [ ] `redshift run -- printenv API_KEY` injects a demo secret.
- [ ] Docs contain no production secrets, private keys, or real API tokens.
- [ ] All relative markdown links resolve.

## Release Automation Checks

Before cutting an actual release, follow the existing release process in [README.md#release](../README.md#release):

- [ ] Use Conventional Commits for release-triggering changes.
- [ ] Let Release Please create or update the release PR.
- [ ] Confirm changelog contents.
- [x] Confirm current release workflow attached and certified all expected native binaries.
- [ ] Do not manually tag unless Release Please is unavailable and the maintainer approves.

## Draft PR Requirements

- [ ] Draft PR links issue [#23](https://github.com/accolver/redshift/issues/23).
- [ ] PR description links the showcase overview.
- [ ] PR description states no GitHub release was cut.
- [ ] Open questions are posted as PR comments.

## Known Draft Gaps

- The demo video is outlined but not recorded.
- The public URL depends on merge/deploy location.
- The short funding threat-model summary is non-normative; [SECURITY.md](../SECURITY.md) remains canonical.
