#!/usr/bin/env bash
set -euo pipefail

# Deploy the declared managed-relay artifact.
# Credentials must be supplied through the environment; they are never accepted in argv.

if [[ $# -ne 0 ]]; then
  printf 'error: do not pass credentials in argv\n' >&2
  printf 'usage: CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... ./relay/deploy.sh\n' >&2
  exit 2
fi

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"

if ! command -v bun >/dev/null 2>&1; then
  printf 'error: Bun is required\n' >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/nosflare"

printf 'Installing locked relay dependencies...\n'
bun install --frozen-lockfile

printf 'Verifying types, protocol tests, and generated worker source...\n'
bun run typecheck
bun test
bun run verify:generated

printf 'Deploying worker.js and wrangler.toml declarations...\n'
./node_modules/.bin/wrangler deploy

printf 'Managed relay deployment completed.\n'
