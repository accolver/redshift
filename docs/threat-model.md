# Redshift Threat Model

> Draft threat model for funding-review purposes. This summarizes the current security posture and known limits; it is not a formal audit.

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

- Funding release should add binary checksums/signatures before broad promotion.

## Out of Scope for Current MVP

- Formal third-party security audit.
- SOC 2 controls.
- Enterprise SSO threat model.
- Full team key-rotation proof.
- Guaranteed relay availability on public relays.

## Review Checklist

- [ ] Confirm NIP-59 Gift Wrap usage for secret events.
- [ ] Confirm no docs or demos expose real keys or tokens.
- [ ] Confirm install flow can be verified from source.
- [ ] Confirm paid-tier designs preserve client-side encryption.
- [ ] Confirm release artifacts include checksums before a public tagged release.

## Related Docs

- [Funding showcase package](./funding-showcase.md)
- [Release showcase checklist](./release-showcase-checklist.md)
- [CLI README cryptography section](../cli/README.md#cryptography)
- [Teams, Cloud & Enterprise Architecture](../TEAMS_CLOUD_ENTERPRISE.md)
