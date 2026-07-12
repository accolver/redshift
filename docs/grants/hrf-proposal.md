# HRF Proposal Draft: Redshift for Private Developer Coordination

## Summary

Redshift is open-source, decentralized secret management built on Nostr. It lets
people store and synchronize application secrets without giving a centralized
provider plaintext access or unilateral control. Secrets are encrypted locally,
wrapped with NIP-59, and replicated through Nostr relays.

HRF support would fund Redshift as operational-security tooling for activists,
independent media, civil-society technologists, and developers working in hostile
environments. The grant would focus on private coordination, safer key custody,
and resilient access to infrastructure secrets when centralized services are
blocked, seized, or pressured.

## Funder Fit

HRF supports technology that protects freedom, privacy, and human rights. Redshift
fits because it helps vulnerable groups:

- Keep infrastructure secrets encrypted and user-controlled.
- Coordinate software operations without a single custodial SaaS provider.
- Recover access through multiple relays when one endpoint is blocked.
- Use open, auditable tooling instead of opaque secret-management services.
- Reduce blast radius when an account, laptop, or relay is compromised.

## Problem

Activist and civil-society software teams often manage websites, donation flows,
secure drop boxes, chat bots, publishing systems, and monitoring tools under
pressure. The credentials for those systems are sensitive. A centralized secret
manager can become a point of coercion, account shutdown, subpoena pressure, or
operational failure.

At the same time, teams still need usable workflows. Complex self-hosted vaults
are often too heavy for volunteer teams, while plaintext `.env` files and chat
messages are unsafe. Redshift aims to provide familiar developer ergonomics while
keeping custody with the people doing the work.

## Proposed Work

Funding would support a 12-week security and usability cycle for high-risk
operators.

### Workstream 1: Threat Model and Safety Guidance

- Publish an activist/developer threat model for decentralized secret storage.
- Document what Redshift protects against and what it does not protect against.
- Add guidance for device compromise, key compromise, relay blocking, and team
  member departure.
- Produce safe default recommendations for public relays, self-hosted relays,
  and offline backups.

### Workstream 2: Private Coordination Workflows

- Improve workflows for project/environment separation.
- Document patterns for rotating secrets after suspected compromise.
- Add examples for private website ops, Tor/onion service deployment, secure
  publishing, and emergency handoff.
- Clarify how NIP-46 bunker use can reduce direct exposure of long-lived keys.

### Workstream 3: Resilience and Recovery

- Test multi-relay access under partial outage and blocked-relay scenarios.
- Improve error messages so non-expert operators can distinguish auth, relay,
  and decryption problems.
- Add recovery playbooks for restoring access from exported encrypted data and
  relay replicas.

## Milestones

| Week | Milestone | Deliverables |
| --- | --- | --- |
| 1 | Threat-model draft | Public draft covering adversaries, assumptions, metadata limits, and user responsibilities. |
| 2-3 | Safety docs | Operator guidance for key custody, backups, NIP-46, relay choice, and device compromise. |
| 4-5 | Private coordination examples | Example workflows for small teams, emergency handoff, and secret rotation. |
| 6-8 | Recovery and resilience tests | Multi-relay outage tests; blocked/stale relay playbooks; clearer operator-facing errors. |
| 9-10 | High-risk user review | Feedback cycle with at-risk developer or civil-society reviewers; revisions from findings. |
| 11-12 | Release and report | Tagged release, final docs, demo, and HRF report with remaining limitations. |

## Budget Draft

Requested support: **$18,000 for 12 weeks**.

| Category | Amount | Notes |
| --- | ---: | --- |
| Security and resilience development | $9,000 | Recovery tests, error clarity, NIP-46/key-custody hardening. |
| Threat-model and safety documentation | $4,000 | High-risk operator docs and limitations. |
| User review and revisions | $3,000 | Feedback from civil-society or at-risk developer users. |
| Release/reporting | $2,000 | Demo, report, and public release materials. |

Budget can be adjusted to HRF's preferred grant format.

## Current Evidence

- Repository: https://github.com/accolver/redshift
- README: https://github.com/accolver/redshift/blob/main/README.md
- Roadmap: https://github.com/accolver/redshift/blob/main/ROADMAP.md
- Architecture spec: https://github.com/accolver/redshift/blob/main/spec.md
- CLI source: https://github.com/accolver/redshift/tree/main/cli
- Web admin source: https://github.com/accolver/redshift/tree/main/web
- NIP-46/key management evidence placeholder: TODO add PR or release link for bunker/key-custody work.
- Threat-model evidence placeholder: TODO add published threat-model link.
- Demo evidence placeholder: TODO add short private-coordination workflow demo.
- Review evidence placeholder: TODO add anonymized reviewer feedback summary if safe.

## Human-Rights Impact

Redshift is not a secure messenger and does not hide all metadata. Its value is
narrow and practical: help small teams keep operational secrets encrypted,
portable, and outside a single revocable account. For groups that maintain
websites, infrastructure, or developer tools under political pressure, this can
reduce dependency on centralized custodians and improve recovery when services
are blocked.

## Risks and Mitigations

- **False sense of security:** Users may assume all metadata is hidden.
  Mitigation: prominent threat model and limitation docs.
- **Key compromise:** If an adversary obtains a user's key, encrypted data may be
  exposed. Mitigation: NIP-46 guidance, rotation playbooks, and device-hardening
  docs.
- **Operational complexity:** High-risk users need simple guidance. Mitigation:
  short playbooks and tested examples rather than abstract protocol docs.
