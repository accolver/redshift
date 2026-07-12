# Redshift Security and Threat Model

Redshift is a decentralized secret manager built on Nostr. Its core security
promise is narrow: secret **values** are encrypted on the client before
publication, and relays should only receive encrypted NIP-59 Gift Wrapped events.

This document explains what Redshift is designed to protect, what remains
visible, and which risks users still own.

## Assets Redshift Protects

- Application secret values such as API keys, tokens, passwords, and environment
  variables.
- Project and environment bundles after they are encrypted into NIP-59 Gift
  Wraps.
- User control over secret storage: users can choose relays and can export or
  migrate data using Nostr-compatible tooling.

## Assumptions

Redshift's security model assumes:

- Client devices used to edit or inject secrets are not compromised at the time
  secrets are handled.
- The user's Nostr private key, NIP-07 signer, NIP-46 bunker, or local nsec
  storage remains under user control.
- Cryptographic dependencies and platform crypto APIs behave correctly.
- Users verify that they are using trusted Redshift binaries, source, or web
  origins.
- Relays may be honest, malicious, unreliable, censored, or observing traffic.

## What Redshift Protects Against

### Relay operators reading secret values

Secret bundles are encrypted client-side before publication. A relay storing or
forwarding Redshift events should see encrypted blobs, not plaintext secret names
or values.

### Single-vendor lock-in

Redshift stores encrypted events on Nostr relays rather than a proprietary
database. Users can publish to multiple relays and can migrate away without
asking Redshift or a managed provider for permission.

### Relay deletion or censorship of one copy

A single relay can refuse writes, drop events, or disappear. Redshift's model
allows users to use multiple relays so one relay is not the only availability
path.

### Server-side breach of plaintext secrets

Because secrets are encrypted before relays receive them, compromise of a relay
database should not directly expose plaintext secret values.

## What Redshift Does Not Protect Against

### Compromised user devices

If malware, browser compromise, shell history capture, malicious npm scripts, or
a hostile CI runner can read process memory, files, environment variables, or
keystrokes while Redshift is running, it can likely steal secrets after
decryption.

### Compromised signing keys

If an attacker obtains the user's nsec, controls the user's NIP-07 extension,
controls a NIP-46 bunker, or can approve signing/decryption requests as the user,
they can read and publish secret bundles as that user.

### Phishing and malicious clients

A fake Redshift binary, malicious web origin, browser extension, or altered
source checkout can request keys, decrypt secrets, or publish attacker-controlled
events.

### Relay traffic analysis

NIP-59 hides event contents, but it does not make relay usage anonymous. Relays
and network observers can still learn metadata described below.

### Guaranteed deletion from relays

Nostr deletion requests and Redshift tombstones are best-effort. Relays, backups,
mirrors, and clients may retain old encrypted events indefinitely.

### Recovery without keys

Redshift has no backdoor, escrow key, or password-reset path that can decrypt
user secrets. Lost keys can mean permanent loss of access to encrypted secret
history.

## Metadata Leakage

Even when secret contents are encrypted, some metadata can remain visible or
inferable:

- User public key or recipient public key tags needed for routing Gift Wrapped
  events.
- Event kind, Redshift type tags, relay URLs, publish times, event counts, and
  approximate event sizes.
- IP addresses, user agents, connection timing, and access patterns visible to
  relays and network providers.
- Which relays a user trusts or depends on.
- Payment or account metadata for optional managed relay products, if used.
- CLI execution context after decryption: child processes receive secrets as
  environment variables and may expose them through logs, crash reports, process
  inspection, or build tooling.

Redshift should not be treated as an anonymity system. Users needing network
anonymity should combine Redshift with separate network privacy controls.

## Relay Trust Model

Relays are not trusted with plaintext secrets, but they are trusted for
availability and event delivery.

A relay can:

- Refuse connections, reads, writes, or deletion requests.
- Return stale, incomplete, reordered, duplicated, or spam events.
- Log IP addresses, timing, and event metadata.
- Retain encrypted events after deletion requests.
- Collude with other relays or observers to correlate activity.

A relay should not be able to decrypt secret values unless it also obtains the
user's private key or compromises the client.

Practical mitigations:

- Publish to more than one relay for availability.
- Include at least one relay you control or strongly trust for critical
  workflows.
- Treat managed relays as availability providers, not secrecy providers.
- Rotate secrets after suspected relay tampering, key exposure, or client
  compromise.

## Key Custody Model

Redshift's security follows the custody path users choose:

1. **NIP-07 browser extension**: preferred for web use because the app does not
   need direct access to the raw private key. Users still trust the extension,
   browser, and approval prompts.
2. **NIP-46 remote signer or bunker**: keeps signing authority outside the app
   process, but users trust the signer host, its access policy, and its
   operational security.
3. **Local nsec or environment variable**: most operationally risky. Any
   process, shell, CI runner, terminal logger, or local malware with access to
   the value can act as the user.

Practical mitigations:

- Prefer NIP-07 or a hardened signer over pasting nsec values into apps.
- Avoid long-lived `REDSHIFT_NSEC` values on shared machines and CI runners.
- Use OS keychain or encrypted config storage when local key storage is required.
- Keep browser extensions, Redshift binaries, and dependencies updated.
- Rotate the Nostr key and all affected application secrets after suspected key
  compromise.

## NIP-59 Limits

Redshift uses NIP-59 Gift Wraps to hide secret bundle contents from relays, but
NIP-59 has limits:

- It does not hide all routing metadata from relays.
- It does not provide deletion guarantees once encrypted events have propagated.
- It does not protect plaintext while secrets are being edited, displayed,
  injected into a process, or copied to the clipboard.
- It does not prevent a compromised recipient key from decrypting historical
  encrypted events available to the attacker.
- It does not make malicious or outdated clients safe.

## Recovery Limits

Redshift intentionally avoids key escrow and server-side recovery. This preserves
sovereignty but changes the failure mode:

- Lost private keys can make encrypted secret bundles unrecoverable.
- Deleted local config files may be recoverable only if the user has their own
  backup of keys and relay data.
- Managed Redshift infrastructure cannot decrypt or restore plaintext secrets for
  users.
- Team and enterprise recovery, if added, must be documented separately because
  it changes custody and authorization assumptions.

Practical mitigations:

- Back up Nostr private keys using an offline method appropriate for the value of
  the secrets.
- Document team ownership and emergency rotation procedures outside Redshift.
- Keep independent copies of critical application secrets where business
  continuity requires it.

## User Operational Risks

Users can accidentally defeat Redshift's cryptographic protections by exposing
decrypted secrets after retrieval.

Common risks:

- Committing `.env`, `redshift.yaml` with sensitive relay details, shell history,
  or debug logs.
- Running untrusted commands through `redshift run`.
- Printing secrets in CI logs, build output, test failures, crash reports, or
  analytics tools.
- Sharing terminals, machines, CI workspaces, or browser profiles.
- Installing malicious packages that read environment variables.

Practical mitigations:

- Run only trusted commands with injected secrets.
- Mask secrets in CI and disable verbose logging around secret-dependent
  commands.
- Keep project access scoped by environment and rotate high-risk production
  secrets regularly.
- Use separate keys and relays for personal, team, staging, and production
  contexts where practical.

## Known Weaknesses

- Relay metadata and network metadata can reveal usage patterns.
- Deletion is best-effort and cannot force third parties to erase old encrypted
  events.
- Compromise of a user's private key can expose historical encrypted bundles
  available to the attacker.
- Local nsec and environment-variable workflows are weaker than hardware-backed,
  extension-backed, or remote-signer workflows.
- Secrets are plaintext inside the user's process environment after
  `redshift run` injects them.
- Redshift has not yet published a formal third-party security audit.

## Non-Goals

Redshift is not intended to provide:

- Network anonymity or traffic-mixing.
- Plausible deniability about using Redshift or Nostr relays.
- Protection from a compromised endpoint.
- Server-side password reset for encrypted secrets.
- Guaranteed deletion from every relay, mirror, backup, or client cache.
- Legal, compliance, or operational approval for storing every class of
  regulated secret.

## Security Reporting

Please report suspected vulnerabilities privately through GitHub security
advisories for this repository, or contact the maintainers before publishing
details publicly. Include affected versions, reproduction steps, expected impact,
and any logs that do not disclose real secrets.
