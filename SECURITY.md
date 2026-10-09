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
- Project metadata published directly as kind 30078, including project slugs,
  display names, and environment names. These are not encrypted secret bundles.
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

### Current credential and execution safeguards

New CLI logins require OS keychain storage or command-scoped credentials;
there is no automatic plaintext config fallback. Legacy plaintext credentials
must migrate successfully to the keychain before use. Redshift strips its
authentication variables from `redshift run` children, including attempts to
reintroduce them with `--preserve-env`, and rejects dangerous fetched startup
variables such as `LD_PRELOAD` and `NODE_OPTIONS`.

Browser decryption caches are owner-scoped. Logout invalidates pending
decryption and history responses so they cannot refill a cleared session.
This does not make browser storage resistant to arbitrary same-origin XSS:
an attacker executing in the application origin could still invoke browser
crypto or a connected signer.

## Client Resource Limits

Relay-provided filter limits are not trusted. CLI queries and browser event
ingestion enforce local observation budgets: reaching 1,000 distinct events
or exceeding 16 MiB of aggregate UTF-8 content and tag data fails closed.
Per-event content is limited to 2 Mi characters; tags are limited to 256 arrays,
16 fields per array, and 64 KiB of aggregate UTF-8 data. Gift Wrap envelope
bounds are checked before the shared crypto layer hashes or decrypts them.

CLI overflow closes the subscription and is not automatically retried. Browser
live-sync overflow closes ingestion, clears partial state, and reports an error;
the budget lasts until disconnect so reconnecting cannot grow the same store
indefinitely. These limits intentionally favor an explicit failure over selecting
or overwriting secrets from an incomplete snapshot.

These are application-level bounds, not immunity from denial of service.
WebSocket buffering, transport JSON parsing and signature checks can occur before
application ingestion, and an untrusted relay can always withhold valid data.
Choose trusted alternate relays when one repeatedly causes a limit failure.

## Installation and Local Dashboard

The installer and updater require exact-name SHA-256 entries and GitHub artifact
attestations for both the binary and checksum manifest, bound to the expected
repository, release workflow, and source commit. Verification failure prevents
replacement of the installed binary. This protects against untrusted artifact
substitution, but does not make a compromised authorized build workflow safe.

`redshift serve` defaults to loopback. It checks the request authority as well
as the browser Origin to reject DNS-rebinding requests. Its read-only API does
not return secret values. An explicit public bind is still operator-controlled
and is not an authenticated remote administration service; keep the default
loopback bind for the local dashboard.

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
