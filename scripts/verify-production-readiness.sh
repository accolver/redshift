#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"

cleanup() {
  rm -rf web/test-results
}
trap cleanup EXIT

phase() {
  printf '\n==> %s\n' "$1"
}

phase "Frozen dependency installation"
bun install --frozen-lockfile
(
  cd relay/nosflare
  bun install --frozen-lockfile
)

phase "Dependency advisories"
bun run audit:dependencies

phase "Type checks"
bun run typecheck
bun run typecheck:web
(
  cd relay/nosflare
  bun run typecheck
)

phase "Owned-source lint and format"
bunx biome lint cli/src packages web/src web/tests relay/nosflare/src relay/nosflare/tests --diagnostic-level=error
bunx biome format cli/src packages web/src web/tests relay/nosflare/src relay/nosflare/tests

phase "Deterministic dashboard and CLI builds"
bun run verify:embeds
bun run build:web
bun run build:embeds
cp cli/src/lib/embedded-files.ts /tmp/redshift-embedded-files.ts
bun run build:embeds
cmp /tmp/redshift-embedded-files.ts cli/src/lib/embedded-files.ts
rm -f /tmp/redshift-embedded-files.ts
bun run build:cli
./dist/redshift --version
./dist/redshift --help >/dev/null
if ./dist/redshift --definitely-unknown >/dev/null 2>&1; then
  echo "Unknown CLI command unexpectedly succeeded" >&2
  exit 1
fi

phase "Product and managed-relay test suites"
bun run test:all
(
  cd relay/nosflare
  bun test
  bun run verify:generated
)

phase "Release-critical compiled lifecycle tests"
(
  cd cli
  bun test \
    tests/integration/binary-cli.test.ts \
    tests/integration/upgrade-binary-e2e.test.ts \
    tests/integration/installer-integrity.test.ts \
    tests/integration/nak-bunker-e2e.test.ts \
    tests/integration/relay-publication-recovery.test.ts
)

phase "Hosted and embedded browser journeys"
(
  cd web
  bunx playwright install chromium
  bun run test:e2e
)

phase "Specification and working-tree integrity"
bunx @fission-ai/openspec validate --all --strict
git diff --check

phase "Production-readiness verification passed"
