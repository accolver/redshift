# Redshift Threat Model

> Non-normative funding-review summary. The canonical security contract and known limits live in [SECURITY.md](../SECURITY.md); release evidence lives under [`piolium/`](../piolium/).

## Security Goals

Redshift must protect application secrets while preserving user sovereignty:

- Secrets are never stored in plaintext on Redshift-controlled infrastructure.
- Encryption and decryption happen on the user's device or approved signer flow.
- Users can choose public, managed, or self-hosted Nostr relays.
- Users can leave with their data and keys without vendor approval.
- Paid tiers must not introduce key escrow, backdoors, or plaintext server access.

## Assets

| Asset | Protection goal |
| --- | --- |
| Secret values | Confidentiality and integrity |
| Nostr private key / `nsec` | Confidentiality; signing authority |
| Project/environment mapping | Integrity and limited metadata exposure |
| Relay event history | Availability and tamper evidence |
| Local config and keychain entries | Confidentiality and correct access controls |

## Trust Boundaries

```text
User-controlled device/keychain/signer
  trusted for plaintext secret handling
        │
        ▼
Redshift CLI or web admin
  trusted to encrypt/decrypt locally
        │
        ▼
Nostr relays
  untrusted storage and transport for encrypted events
```

## In-Scope Threats

### Malicious or compromised relay

A relay can drop, delay, withhold, reorder, or delete events. It should not be able to read secret values because secret bundles are encrypted before publish.

Mitigations:

- Support multiple relays for redundancy.
- Use signed Nostr events for authenticity.
- Keep decryption client-side.

Residual risk:

- Relay metadata may reveal timing, pubkeys, and event kinds.
- Availability depends on relay selection and replication.

### Secret key compromise

If an attacker gets the user's private key or signer access, they can decrypt secrets and publish signed updates.

Mitigations:

- Support NIP-07 and NIP-46 so users can avoid pasting raw `nsec` values.
- Store local credentials in OS keychain where available.
- Encourage throwaway/demo keys in documentation and videos.

Residual risk:

- Compromised endpoints remain a critical risk.
- Key rotation and team offboarding need continued hardening for collaboration tiers.

### Malicious local process

A process launched by `redshift run` receives requested secrets as environment variables.

Mitigations:

- Make injection explicit through `redshift run -- <command>`.
- Keep list output redacted by default.
- Document demo and operational hygiene.

Residual risk:

- Child processes can print, persist, or exfiltrate injected values.
- OS-level process inspection may expose environment variables on some systems.

### Supply chain compromise

A compromised binary, dependency, or install script could steal keys or secrets.

Mitigations:

- Keep source open and auditable.
- Use CI build and release workflows.
- Document source-build path.

Residual risk:

- Current releases publish checksums, an SPDX SBOM, and GitHub artifact attestations before promotion; future releases must preserve those gates.

## Out of Scope for the Certified Individual Product

- Formal third-party security audit.
- SOC 2 controls.
- Enterprise SSO threat model.
- Full team key-rotation proof.
- Guaranteed relay availability on public relays.

## Review Checklist

- [x] Confirm NIP-59 Gift Wrap usage for secret events.
- [x] Confirm no funding docs or demos contain real keys or tokens.
- [x] Confirm public installation and source-build verification paths.
- [ ] Confirm every future paid-tier design preserves client-side encryption and introduces no key escrow.
- [x] Confirm current release artifacts include checksums, SBOM, and attestations before publication.

## Related Docs

- [Canonical security and threat model](../SECURITY.md)
- [Funding showcase package](./funding-showcase.md)
- [Release showcase checklist](./release-showcase-checklist.md)
- [CLI README cryptography section](../cli/README.md#cryptography)
- [Teams, Cloud & Enterprise Architecture](../TEAMS_CLOUD_ENTERPRISE.md)
