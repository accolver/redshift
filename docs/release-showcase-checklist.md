# Redshift Funding Showcase Release Checklist

> Draft checklist for GitHub issue [#23](https://github.com/accolver/redshift/issues/23). Do not cut a release from this checklist until every required item is complete.

## Release Decision

- [ ] Confirm target version/tag for vNext.
- [ ] Confirm release owner.
- [ ] Confirm whether this is a docs-only showcase release or a binary release.
- [ ] Confirm public location for the showcase page or release notes.

## Required Showcase Artifacts

- [x] Funding showcase overview: [docs/funding-showcase.md](./funding-showcase.md)
- [x] Architecture summary: [docs/funding-showcase.md#architecture-summary](./funding-showcase.md#architecture-summary)
- [x] Demo script outline: [docs/funding-showcase.md#demo-script-outline](./funding-showcase.md#demo-script-outline)
- [x] Install docs link: [README installation](../README.md#installation)
- [x] CLI install docs link: [cli/README installation](../cli/README.md#installation)
- [x] Roadmap link: [ROADMAP.md](../ROADMAP.md)
- [x] Funding ask summary: [docs/funding-showcase.md#roadmap-and-funding-ask-summary](./funding-showcase.md#roadmap-and-funding-ask-summary)
- [x] Threat model draft: [docs/threat-model.md](./threat-model.md)
- [ ] Final 3-minute demo video URL.
- [ ] Public release notes or docs page URL.

## Reviewer Sanity Checks

- [ ] Fresh install path works on macOS.
- [ ] Fresh install path works on Linux.
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
- [ ] Confirm release workflow attaches expected binaries.
- [ ] Do not manually tag unless Release Please is unavailable and the maintainer approves.

## Draft PR Requirements

- [ ] Draft PR links issue [#23](https://github.com/accolver/redshift/issues/23).
- [ ] PR description links the showcase overview.
- [ ] PR description states no GitHub release was cut.
- [ ] Open questions are posted as PR comments.

## Known Draft Gaps

- The demo video is outlined but not recorded.
- The public URL depends on merge/deploy location.
- Threat model is a draft and should get focused security review before being treated as final.
