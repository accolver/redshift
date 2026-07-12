# Change: Add per-relay publication recovery

## Why

Redshift reports majority-quorum failures, but users cannot inspect durable per-relay outcomes or safely retry an exact signed event after partial publication. This leaves degraded redundancy opaque and encourages generating conflicting replacement events.

## What Changes

- Classify final per-relay publication outcomes as accepted, permanently rejected, or temporarily unavailable.
- Preserve the exact signed event and owner/project/environment metadata in bounded local recovery storage whenever any configured relay misses publication.
- Add CLI recovery list/show/retry/remove workflows that retry only unavailable relays with the original event.
- Add browser-visible degraded NIP-59 secret publication state, per-relay details, exact-event retry, persistence, and logout cleanup.
- Distinguish quorum success from full redundancy without turning degraded success into silent success.
- Add compiled CLI and five-relay Playwright coverage for acceptance, permanent rejection, outage, retry, and deterministic convergence.

## Impact

- Affected specs: `relay-access`, `cli-contract`, `quality-gates`, `product-truth`
- Affected code: shared rate-limiter/quorum package, CLI relay and recovery storage/commands, web relay store and recovery UI, compiled/browser E2E
- No new dependency, central service, key custody, telemetry, or plaintext secret persistence is introduced.
