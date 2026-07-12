# Redshift Grant Roadmap

## One-page project brief

**Redshift is open-source, freedom-tech infrastructure for developer secrets.** It gives developers a Doppler-style CLI and web admin while storing encrypted secret bundles on censorship-resistant Nostr relays instead of a centralized SaaS database.

Today, application secrets usually sit behind one vendor account, one billing relationship, and one revocation point. Redshift changes that model: secrets are encrypted on the client, wrapped with NIP-59, published as replaceable Nostr events, and recoverable from any relay the developer chooses. The project is MIT licensed and designed so individuals can run it for free forever.

**Why it matters:**

- **Sovereignty:** developers keep their keys and can migrate relays without asking Redshift for permission.
- **Censorship resistance:** secret access does not depend on one cloud provider, region, or account status.
- **Familiar DX:** commands such as `redshift login`, `redshift setup`, `redshift secrets set`, and `redshift run -- <command>` match existing secret-management workflows.
- **Auditable security:** the core protocol and clients are open source, with client-side encryption and no plaintext server storage.

**Current state:** MVP CLI, web admin, Nostr gift-wrap storage, local key handling, import/export, and release automation are implemented. The next grant-funded phase focuses on hardening, documentation, adoption, and repeatable third-party review.

## 12-week milestone plan

| Weeks | Milestone | What ships | Evidence of completion |
| --- | --- | --- | --- |
| 1-2 | Public grant-ready docs | Project brief, funding roadmap, architecture summary, install path, threat-model outline | Published docs linked from README |
| 3-4 | Protocol hardening | Documented event schemas, relay behavior, deletion/tombstone behavior, and compatibility notes | Versioned protocol docs plus regression tests |
| 5-6 | CLI reliability pass | Improved setup/run error paths, relay fallback guidance, and CI-friendly examples | Passing CLI tests and updated CLI docs |
| 7-8 | Web admin readiness | Clearer onboarding, project/environment workflow docs, and import/export guide | Updated web docs and smoke-tested user flow |
| 9-10 | Security review prep | Threat model, key-management notes, test vectors, and audit scope | Review packet in repo |
| 11 | External beta | Recruit early open-source maintainers and privacy-minded developers; collect issue-based feedback only | Public beta notes and triaged GitHub issues |
| 12 | Grant closeout | Release notes, demo script, metrics, and next-phase proposal | Tagged release and public closeout report |

## Funding target list

| Funder | Fit | Initial ask | Proposed focus |
| --- | --- | --- | --- |
| [OpenSats](https://opensats.org/) | Open-source infrastructure for Nostr-aligned developer sovereignty | General open-source development grant | Protocol hardening, CLI reliability, docs, and public beta |
| [Human Rights Foundation](https://hrf.org/) | Freedom-tech tooling that reduces dependency on censorable infrastructure | Freedom-tech development grant | Censorship-resistant secret access, threat model, security review prep |
| [NLnet](https://nlnet.nl/) | Open internet, user autonomy, and privacy-preserving decentralized tools | NGI / open internet grant | Interoperability docs, reproducible builds, audit packet, standards alignment |

## Public roadmap links

- [Repository roadmap](../../ROADMAP.md)
- [Product and architecture specification](../../spec.md)
- [Cloud, teams, and enterprise plan](../../TEAMS_CLOUD_ENTERPRISE.md)
- [Cloud tier plan](../../CLOUD_TIER_PLAN.md)
