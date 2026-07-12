# Redshift Architecture

Redshift is a local-first secrets manager. Clients encrypt and sign secret
bundles before publishing them to Nostr relays; relays never receive plaintext
secrets.

## System Diagram

```mermaid
flowchart LR
  subgraph Developer Device
    CLI[Redshift CLI]
    Web[Web Dashboard]
    Signer[NIP-07, NIP-46, or local nsec]
    Config[redshift.yaml and ~/.redshift/config.json]
  end

  subgraph Shared Packages
    Crypto[@redshift/crypto\nNIP-59 Gift Wrap + event types]
    RateLimiter[@redshift/rate-limiter\nrelay throttling + backoff]
  end

  subgraph Nostr Network
    PublicRelays[Public relays]
    ManagedRelay[Managed Redshift relay]
  end

  App[User command\nredshift run -- ...]

  Signer --> CLI
  Signer --> Web
  Config --> CLI
  CLI --> Crypto
  Web --> Crypto
  CLI --> RateLimiter
  Web --> RateLimiter
  Crypto --> PublicRelays
  Crypto --> ManagedRelay
  PublicRelays --> CLI
  ManagedRelay --> CLI
  CLI --> App
```

## Data Flow

1. **Authentication**
   - CLI supports local `nsec`, `REDSHIFT_NSEC`, and NIP-46 bunker flows.
   - Web login uses browser Nostr capabilities such as NIP-07 where available.
   - Private keys stay on the developer device or with the configured signer.

2. **Project selection**
   - `redshift setup` writes `redshift.yaml` in the app directory.
   - The config identifies the project slug, environment, and relay list.
   - Secret bundle identifiers use `{project}|{environment}`.

3. **Secret writes**
   - `redshift secrets set KEY VALUE` loads the latest authenticated bundle for
     the selected project/environment.
   - The client updates the complete bundle locally, encrypts it with NIP-59
     Gift Wrap, tags the outer event with `t=redshift-secrets`, and publishes the
     same signed event to the configured relays.
   - Success requires publication quorum. Per-relay outcomes remain visible, and
     below-quorum publication can be retried by exact event ID without creating a
     conflicting replacement.

4. **Secret reads and injection**
   - `redshift run -- <command>` fetches matching Gift Wrap events from the
     configured relays.
   - The client accepts only owner-consistent recipient, seal, and inner-rumor
     identities with the exact project/environment d-tag.
   - Logical state is selected by inner rumor time and deterministic outer event
     ID tie-breaking, never by randomized Gift Wrap timestamps.
   - The selected bundle is injected as environment variables into the child
     process.

5. **Recovery, backup, and observed history**
   - Publication recovery preserves exact signed events and retries only relays
     that did not accept them.
   - Passphrase-encrypted local backup exports current observed state and restores
     it as new owner-authorized events under the target identity.
   - Authenticated history is bounded relay-observed state. Compare reveals key
     names and change categories only; restore publishes a new complete bundle or
     tombstone after explicit consent and a second observation.

6. **Relay resilience**
   - Relays are configurable globally (`redshift configure set relays='[...]'`)
     or per project (`redshift.yaml`).
   - Multiple relays reduce availability risk, but they do not establish complete
     retention, compare-and-swap, cryptographic erasure, RPO/RTO, or an SLA.

## Main Components

| Path | Responsibility |
| --- | --- |
| `cli/src/main.ts` | CLI entrypoint and command dispatch |
| `cli/src/commands/` | Login, setup, secrets, run, history, recovery, backup, serve, and upgrade commands |
| `cli/src/lib/secret-manager.ts` | Secret bundle fetch, decrypt, merge, encrypt, publish lifecycle |
| `cli/src/lib/relay.ts` | Relay pool wrapper with rate limiting and retry behavior |
| `web/src/` | SvelteKit dashboard and browser secret workflows |
| `packages/crypto/` | Shared Nostr kinds, NIP-59 helpers, and secret bundle types |
| `packages/rate-limiter/` | Shared retry/backoff primitives for relay operations |
| `relay/` | Cloudflare/Nosflare managed relay deployment assets |

## Security Boundaries

- Secrets are encrypted before relay publish and decrypted only by the client.
- Relays can deny service or lose data, but should not learn secret values.
- The CLI prefers OS keychain custody. Explicit local or environment-key flows
  expose signing authority to the local process and require stronger operational
  controls.
- Browser-decrypted history is ephemeral and is cleared when its project,
  environment, authentication, or subscription lifecycle ends.
- Demo and CI flows can isolate credentials with `REDSHIFT_CONFIG_DIR` and a
  disposable `REDSHIFT_NSEC`; long-lived private keys do not belong in CI logs or
  centrally stored workflow secrets.

## Local Development Map

```bash
bun install                 # workspace dependencies
bun run dev -- --help       # CLI from source
bun run dev:web             # SvelteKit dashboard
bun run build:web           # web production build
bun run build:cli           # native CLI binary in dist/redshift
bun run test:all            # crypto, CLI, and web tests
```
