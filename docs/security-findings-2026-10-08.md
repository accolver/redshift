# Security finding disposition — 2026-10-08

Reviewed against source baseline `1e886c8` (v0.14.3). The supplied report combines
attack scenarios, existing mitigations, and descriptions of older implementations.
This is a source-level remediation record, not a third-party audit or a release
certification.

## Confirmed gaps fixed

| Gap | Fix | Regression evidence |
| --- | --- | --- |
| Ordinary CLI reads used unbounded `querySync`, bypassing history observation limits | Collect through a subscription with a shared local count/byte budget; close and throw a typed query failure on overflow, without retrying; current-state selection also rejects a truncated injected transport result | `cli/tests/lib/relay.test.ts`; `cli/tests/integration/relay-ingestion-limits.test.ts` uses a real local WebSocket relay sending signed events and withholding EOSE |
| Browser live sync retained events before applying decryption/history bounds | Enforce a session-wide ingestion budget before EventStore insertion; stop ingestion and clear partial state on overflow; bound refreshes and reserve the full batch before insertion | `web/tests/stores/nostr-managed-relay.test.ts`; shared budget tests |
| Shared crypto hashed oversized envelopes before rejecting them; local-key decryption lacked the explicit signer-path ciphertext guard | Bound content and tag data before envelope hashing; validate outer and inner NIP-44 structure for local-key decryptions too | `packages/crypto/tests/gift-wrap.test.ts`; `packages/crypto/tests/relay-budget.test.ts` |
| Browser cache used event IDs without owner scope; pending decryption/refresh could complete after logout | Include owner in cache/pending keys, invalidate work by session generation, stop superseded batches between events, and reject late history responses | `web/tests/models/gift-wrap-secrets.test.ts`; `web/tests/stores/nostr-publication-recovery.test.ts` |
| `--preserve-env` could restore stripped Redshift credentials | Reject authentication-variable names, case-insensitively, using the same credential classification as injection | `cli/tests/commands/run.test.ts` |
| Local HTTP origin checks allowed hostile Host headers when Origin was absent | Validate request authority against loopback and the explicit bind host before serving assets or APIs | `cli/tests/integration/binary-serve.test.ts` exercises the compiled server |

## Findings already mitigated in the baseline

| Supplied concern | Current implementation and evidence |
| --- | --- |
| Unsigned/optional updater checksums | `cli/src/commands/upgrade.ts` and `web/static/install` require attestations plus exact checksum entries before execution/replacement. Tests: `upgrade.test.ts`, `upgrade-binary-e2e.test.ts`, `installer-integrity.test.ts`. A compromised authorized release workflow remains a separate trust risk. |
| Plaintext fallback when keychain is unavailable | `cli/src/lib/config.ts` rejects new plaintext credential persistence and fails closed on unsuccessful legacy migration. Local filesystem compromise remains outside client encryption guarantees. |
| XSS through external blog content | `web/src/lib/content-safety.ts` implements a sanitizer allowlist and script-safe JSON serialization. Hosted/embedded CSP excludes broad inline script permission. Tests: `web/tests/lib/content-safety.test.ts`, auth/storage tests, and embedded-server tests. |
| Forged secret state addressed to a victim | Shared crypto verifies the envelope and seal and binds outer recipient, seal author, and rumor author to the authenticated owner. Existing crypto tests cover attacker-authored bundles and tampering. |
| Managed-relay NIP-42, identity-switch, cross-recipient and quota bypass | `relay/nosflare/src/event-verifier.ts`, `relay-policy.ts`, and quota modules implement strict IDs/signatures, immutable principals, recipient-scoped access and shared quotas. The local managed-relay suite passes; this is not proof of deployed operational configuration. |
| Dangerous `.env` variables reaching executed programs | Existing `injectSecrets` rejects fetched runtime-startup and credential variable names; argv execution uses `shell: false`. Explicit shell mode and trusted child programs remain operator choices. |

## Residual risks and scope

- Application budgets bound retained data and downstream decryption work. They
  do not impose raw WebSocket frame limits before third-party transport parsing
  and verification, or guarantee relay availability.
- Routing tags and directly published project metadata remain visible. Encrypting
  that metadata would require a protocol/migration proposal.
- Tombstones are logical deletion; relays may retain ciphertext indefinitely.
- Same-origin XSS and compromised endpoints/signers can access plaintext in use.
- Public `serve` binding remains an explicit operator choice. Host checking is
  DNS-rebinding protection, not remote-client authentication.
- The managed relay's commercial endpoints/payment enforcement are disabled in
  the current candidate. Legacy browser payment checks still trust the HTTPS
  service for a boolean eligibility response. They are not cryptographic proof
  of entitlement, and cannot grant access past relay-side authorization. Paid
  production operation remains covered by unapproved commercial/operations work.

## Telos and specification validation

L9→L1: preserve sovereign custody and availability (L9), protect the free individual
workflow (L8–L7), give explicit failure instead of misleading state (L6), preserve
login/edit/run journeys (L5), maintain NIP-59 and CLI contracts (L4), reuse shared
validation and lifecycle-owned stores (L3), reproduce failures in tests (L2), and
use strict TypeScript with existing cryptographic primitives (L1).

L1→L9: typed guards and bounded storage support tested functions, shared helpers
fit both clients, protocol formats remain compatible, incomplete reads fail
closed, and secret ownership remains with the user. The flows converge. These
are corrections to existing bounds, owner-isolation, credential-injection and
local-origin protections; no new custody or protocol capability is introduced.

## Shipping preparation and verification

The shipping follow-up repaired reproducibility and test-isolation problems:

- Web references to the two shared packages now use `workspace:*`, and Bun types
  are pinned to the already-used 1.3.14 toolchain instead of `latest`. Both frozen
  installs pass; no third-party runtime dependency version was upgraded.
- UI source-inspection tests import Vite raw assets rather than Node filesystem
  APIs through the browser transform. The same assertions now execute successfully.
- The nsec edge-case fixture restores its environment so a deliberately invalid
  credential cannot leak into later compiled-CLI tests.

Pre-commit results:

- `bun run build:web`, `bun run build:cli`, root/package TypeScript checks, Svelte
  checks, scoped source lint/format and `git diff --check` pass.
- CLI suite, run from `cli/` with its existing test setup: **643 pass, 0 fail**.
  `nak v0.19.7` was installed for real relay/bunker integration tests. The initial
  nine keychain failures came from running tests at the root without `cli/bunfig.toml`;
  they do not occur under the required workspace command.
- Full web suite: **396 pass, 0 fail**.
- Crypto: **165 pass**. Rate limiter: **17 pass**. Managed relay: **25 pass**.
- Generated dashboard embeds were rebuilt and their source digest verified.

### PR #59 dependency-audit follow-up

CI run `37885073921`, Product Verification job `113673140996`, failed at
`Audit frozen dependency graphs`. The failure reproduced locally with 38 product
and 18 relay-toolchain advisories (some overlap).

- Updated SvelteKit within major 2, Vitest/UI within major 4, and sanitize-html
  within the 2.17 patch line.
- Pinned Wrangler 4.116.0 in both deployment surfaces to retain stable Miniflare 4,
  with patched sharp 0.35.5 and undici 7.30.0 overrides.
- Updated vulnerable PostCSS, selector parser, source-map-js, devalue and fflate
  overrides, and refreshed the locked Nano ID 5 dependency within Applesauce's
  existing range. PostCSS retains its separate compatible Nano ID 3 dependency.
- Regenerated the root and relay lockfiles and embedded dashboard. Both frozen
  installs and both low-threshold audits pass with **no vulnerabilities found**.
- Reverified all 643 CLI, 396 web, 165 crypto, 17 rate-limiter and 25 relay tests,
  all fuzz suites, type checks, builds, lint/format and generated relay consistency.
- Telos validation converges: patched compatible dependencies support the existing
  user workflows and protocol contracts while preserving the release security gate.

The next CI run (`37886360614`) passed the audit and exposed a scheduling race in
the logout regression fixture. The fixture now waits for an explicit relay
subscription-ready signal and attaches its expected-rejection handler before
logout, rather than assuming that one microtask starts the subscription.

After PR #59 passed all checks and merged, main run `37888405156` exposed an
intermittent Bits UI body-scroll-lock cleanup timer outliving jsdom in the modal
tests. That fixture now uses an advancing fake clock, drains deferred cleanup
after unmount, and asserts no timers remain before restoring the real clock.

Other production-release blockers remain:

- Two selected Playwright dashboard journeys could not launch Chromium because
  this host lacks `libglib-2.0.so.0`; no browser workflow pass is claimed.
- The installed OpenSpec CLI's strict all-spec check passes 14 items and fails
  two unchanged items (`relay-access` and `add-teams-bunker-service`) on existing
  requirement-length warnings. No specification was modified.

GitHub CLI and Wrangler both report no authenticated account in this session.
SSH Git access alone does not authorize Release Please PR management or Cloudflare
deployment. The full production gate is not green and no production deployment or
release publication is claimed.
