# Redshift Funding Showcase Package

> Draft package for GitHub issue [#23](https://github.com/accolver/redshift/issues/23). This document is not itself a release; the current certified product release is [v0.14.2](https://github.com/accolver/redshift/releases/tag/v0.14.2).

## Reviewer Snapshot

Redshift is a decentralized, censorship-resistant secret manager for developers. It provides a Doppler-familiar CLI and web admin while keeping secrets client-side encrypted and portable across Nostr relays.

### What to review first

1. Install Redshift: [README installation](../README.md#installation) or [CLI installation](../cli/README.md#installation)
2. Run the quick start: [README quick start](../README.md#quick-start)
3. Review the architecture summary below
4. Review the canonical threat model: [SECURITY.md](../SECURITY.md)
5. Review the roadmap and funding ask below

## Current Package Status

| Artifact | Status | Link |
| --- | --- | --- |
| Showcase overview | Draft | This document |
| Release checklist | Draft | [docs/release-showcase-checklist.md](./release-showcase-checklist.md) |
| Demo script outline | Draft | [Demo script outline](#demo-script-outline) |
| Architecture summary | Draft | [Architecture summary](#architecture-summary) |
| Threat model | Canonical | [SECURITY.md](../SECURITY.md) |
| Funding threat-model summary | Draft | [docs/threat-model.md](./threat-model.md) |
| Install docs | Certified in v0.14.2 | [README installation](../README.md#installation), [CLI installation](../cli/README.md#installation) |
| Release evidence | Published | [v0.14.2 production-readiness evidence](../piolium/v0.14.2-production-readiness-evidence.md) |
| Roadmap | Existing | [ROADMAP.md](../ROADMAP.md) |
| Teams/Cloud/Enterprise design | Existing | [TEAMS_CLOUD_ENTERPRISE.md](../TEAMS_CLOUD_ENTERPRISE.md) |

## Evaluation Path for a Cold Reviewer

### 1. Understand the promise

Redshift gives developers sovereign secret management:

- **Client-side encryption:** secrets are wrapped before they leave the device.
- **Open protocol storage:** encrypted events live on Nostr relays rather than one vendor database.
- **Familiar workflow:** `redshift run -- npm start` mirrors established secret-manager DX.
- **Portable by design:** users can change relays, export data, or self-host without losing access.

### 2. Verify the product exists

Use the install docs, then run:

```bash
redshift login
redshift setup --project funding-demo --environment development
redshift secrets set API_KEY demo-value
redshift run -- printenv API_KEY
```

Expected result: the child process prints `demo-value`; the secret was fetched and decrypted locally.

### 3. Check the security model

Read the canonical [security and threat model](../SECURITY.md). The key claim is narrow: Redshift relays store encrypted NIP-59 Gift Wrap events, not plaintext secret values. The funding-oriented [summary](./threat-model.md) is non-normative.

### 4. Check funding readiness

Use [docs/release-showcase-checklist.md](./release-showcase-checklist.md) to see what is ready, what is draft-only, and what must be completed before a public tagged funding release.

## Architecture Summary

```text
Developer device
  ├─ CLI: login, setup, secrets, run, serve
  ├─ Web admin: browser-based secret editor
  └─ Signer: NIP-07, local nsec, or NIP-46 bunker
        │
        │ encrypt/sign locally
        ▼
Nostr protocol layer
  ├─ NIP-59 Gift Wrap for encrypted secret bundles
  ├─ Kind 30078 replaceable events for project/environment state
  └─ NIP-09 deletion/retraction semantics where supported
        │
        │ publish encrypted events
        ▼
Relays
  ├─ Public relays
  ├─ Self-hosted relays
  └─ Future Redshift Cloud managed relay
```

### Trust boundaries

- Private keys stay with the user, browser extension, local keychain, or remote signer.
- Secret encryption and decryption happen on the client side.
- Relays only see encrypted events and protocol metadata.
- Future paid tiers may add reliability, collaboration, and compliance workflows, but they are not part of the certified individual product and must not add key escrow or plaintext access.

### Core repositories and docs

- CLI commands and binary build: [`cli/`](../cli/)
- Web admin: [`web/`](../web/)
- Shared crypto package: [`packages/crypto/`](../packages/crypto/)
- Release automation: [README release section](../README.md#release)
- Business architecture: [TEAMS_CLOUD_ENTERPRISE.md](../TEAMS_CLOUD_ENTERPRISE.md)

## Demo Script Outline

Target length: 3 minutes.

| Time | Segment | Script beats |
| --- | --- | --- |
| 0:00-0:20 | Problem | Centralized secret managers can revoke access, leak metadata, and create vendor lock-in. |
| 0:20-0:45 | Install | Show install command and `redshift --version`. Mention source build path. |
| 0:45-1:15 | Login + setup | Run `redshift login` and `redshift setup`; explain Nostr identity and relay portability. |
| 1:15-1:50 | Secret workflow | Set/list/get a secret; show values are redacted by default. |
| 1:50-2:20 | Runtime injection | Run `redshift run -- printenv API_KEY`; show local decryption into a child process. |
| 2:20-2:45 | Web admin | Open `redshift serve` or hosted admin; show project/secret editing if available. |
| 2:45-3:00 | Funding ask | Explain funding milestones: polish public release, launch managed relay, build teams/enterprise security features. |

### Demo environment checklist

- Use throwaway test secrets only.
- Use a clean demo project slug such as `funding-demo`.
- Use one reliable relay plus one backup relay.
- Record terminal at large font size.
- Do not show a real `nsec`, private key, production token, or user wallet details.

## Roadmap and Funding Ask Summary

Redshift is MVP-complete for individual developers and ready for a funding-focused showcase. Funding accelerates public polish and paid-tier development without compromising the free sovereign core.

### Near-term showcase goals

- Keep certified release and installed-artifact evidence linked from the package.
- Record and publish the 3-minute demo video using throwaway identities and secrets.
- Make this showcase page available from public docs or release notes.
- Keep the funding summary aligned with the canonical threat model and product-truth specs.

### Funded milestones

1. **Release continuity:** preserve provenance, installed-artifact certification, documentation accuracy, and security review on every release.
2. **Redshift Cloud:** separately gate managed relay reliability, monitoring, encrypted backups, retention evidence, and measured availability.
3. **Teams:** separately specify and prove cryptographic sharing, member lifecycle, audit semantics, and key rotation.
4. **Enterprise:** separately evaluate SSO bridges, on-prem relay deployment guidance, and evidence-bounded compliance documentation.

### Funding ask

Fund development that preserves the sovereignty-first constraints in [ROADMAP.md](../ROADMAP.md):

- Keep CLI and self-hosted workflows free.
- Monetize managed infrastructure and collaboration convenience, not secret access.
- Maintain no-telemetry and no-key-escrow commitments.
- Produce reviewer-ready release artifacts: demo, threat model, architecture notes, and install docs.

## Questions and Follow-up

Per issue #23 workflow, open questions should be asked as comments on the draft PR rather than blocking this package.
