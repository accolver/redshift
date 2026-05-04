# Relay resilience and NIP-78 security

Redshift stores encrypted secret bundles as NIP-59 gift wraps containing NIP-78/Kind 30078 app-data events. Relays provide availability, not trust: secret values remain client-side encrypted before publish.

## Relay configuration

The CLI uses relays in this order:

1. Project relays from `redshift.yaml` when present.
2. Global CLI relays from `~/.redshift/config.json`.
3. Built-in public defaults from `@redshift/crypto`.

Inspect the active global relay set:

```bash
redshift configure relays
```

Set a custom global relay set:

```bash
redshift configure set relays='["wss://relay.damus.io","wss://nos.lol"]'
# or
redshift configure set relays=wss://relay.damus.io,wss://nos.lol
```

Reset to built-in defaults:

```bash
redshift configure unset relays
```

For project-specific relays, edit `redshift.yaml`:

```yaml
project: my-project
environment: production
relays:
  - wss://relay.damus.io
  - wss://nos.lol
```

## Privacy tradeoffs

- Relays can see event metadata: event kind, timestamps, relay connection timing, outer gift-wrap tags, and the recipient `p` tag.
- Relays cannot read secret names or values because Redshift encrypts content client-side with NIP-59/NIP-44.
- Using many public relays improves availability but broadcasts metadata to more operators.
- Using one private relay reduces metadata exposure but creates an availability bottleneck.
- The `t=redshift-secrets` tag improves sync efficiency, but it also identifies events as Redshift-related app data.

## Availability tradeoffs

- Publishing to multiple relays makes secrets more likely to sync from another device if one relay is down or prunes data.
- Public relays may rate-limit, reject, or delete events without notice.
- Self-hosted or managed relays can provide stronger retention guarantees, but users should still keep more than one relay configured for failover.
- Redshift queries all configured relays and uses the latest replaceable event per `{project}|{environment}` d-tag.

## Recommended relay sets

- **Maximum availability:** 3+ relays across different operators.
- **Balanced privacy/availability:** 1 private or managed relay plus 1-2 reputable public relays.
- **Maximum privacy:** self-hosted relay only, with explicit backups and monitoring.

No relay set changes Redshift's cryptographic trust model: never publish plaintext secrets, and never rely on a relay operator to enforce confidentiality.
