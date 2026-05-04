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
    Keychain[OS keychain or REDSHIFT_NSEC]
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

  Keychain --> CLI
  Config --> CLI
  Keychain --> Web
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
   - `redshift secrets set KEY VALUE` loads the latest bundle for the selected
     project/environment.
   - The client updates the bundle locally, encrypts it with NIP-59 Gift Wrap,
     tags the outer event with `t=redshift-secrets`, and publishes to relays.

4. **Secret reads and injection**
   - `redshift run -- <command>` fetches matching Gift Wrap events from the
     configured relays.
   - The client decrypts only events addressed to the logged-in identity.
   - The latest valid bundle is injected as environment variables into the child
     process.

5. **Relay resilience**
   - Relays are configurable globally (`redshift configure set relays='[...]'`)
     or per project (`redshift.yaml`).
   - Multiple relays reduce availability risk. If one relay is unhealthy, remove
     it or reorder relays and rerun the command.

## Main Components

| Path | Responsibility |
| --- | --- |
| `cli/src/main.ts` | CLI entrypoint and command dispatch |
| `cli/src/commands/` | Login, setup, secrets, run, serve, and upgrade commands |
| `cli/src/lib/secret-manager.ts` | Secret bundle fetch, decrypt, merge, encrypt, publish lifecycle |
| `cli/src/lib/relay.ts` | Relay pool wrapper with rate limiting and retry behavior |
| `web/src/` | SvelteKit dashboard and browser secret workflows |
| `packages/crypto/` | Shared Nostr kinds, NIP-59 helpers, and secret bundle types |
| `packages/rate-limiter/` | Shared retry/backoff primitives for relay operations |
| `relay/` | Cloudflare/Nosflare managed relay deployment assets |

## Security Boundaries

- Secrets are encrypted before relay publish and decrypted only by the client.
- Relays can deny service or lose data, but should not learn secret values.
- The CLI stores credentials in the OS keychain when available and falls back to
  `~/.redshift/config.json` with owner-only file permissions.
- Demo and CI flows can isolate credentials with `REDSHIFT_CONFIG_DIR` and
  `REDSHIFT_NSEC`.

## Local Development Map

```bash
bun install                 # workspace dependencies
bun run dev -- --help       # CLI from source
bun run dev:web             # SvelteKit dashboard
bun run build:web           # web production build
bun run build:cli           # native CLI binary in dist/redshift
bun run test:all            # crypto, CLI, and web tests
```
