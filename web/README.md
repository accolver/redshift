# Redshift Web Dashboard

SvelteKit dashboard for managing Redshift projects and secrets in the browser.
It shares crypto and relay primitives with the CLI through workspace packages.

## Development

From the repository root:

```bash
bun install
bun run dev:web
```

Or from this directory:

```bash
bun install
bun run dev
```

Open the local URL printed by Vite.

## Build and Check

```bash
# From repo root
bun run build:web
bun run typecheck:web
bun run test:web

# Or from web/
bun run build
bun run check
bun run test
```

## Notes

- Browser login depends on a Nostr signer such as a NIP-07 extension.
- Secrets are encrypted client-side before relay publish.
- Shared event types and NIP-59 helpers live in `../packages/crypto`.
