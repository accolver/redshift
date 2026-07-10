# Change: Harden Production Readiness

## Why

A repository-wide security and journey audit found release-blocking authorization, credential-isolation, artifact-integrity, CLI contract, managed-relay, deletion, browser, test, and documentation gaps. The individual/free Redshift product cannot truthfully claim production readiness until attacker-authored state is rejected, child processes receive only application secrets, shipped artifacts are verified, documented CLI behavior matches the binary, NIP-59 relay authorization uses the authenticated recipient, deletion is represented as newer encrypted state, and the compiled CLI and dashboard pass hermetic end-to-end tests.

This change is authorized by the user's explicit request to document and fix every confirmed issue. It deliberately hardens the existing individual product before adding Teams, Cloud, history, or enterprise scope.

## What Changes

- Authenticate the decrypted NIP-59 owner, recipient, structure, and freshness; make latest-state ordering deterministic.
- Scrub Redshift authentication credentials and runtime-hook variables from child environments.
- Make release installation and upgrade fail closed on authenticated artifact metadata, with atomic replacement and rollback.
- Remove mutable remote scripts and broad inline-script policy from relay and dashboard origins.
- Redact stored credentials and remove new plaintext fallback custody.
- Enforce identity-bound managed-relay reads, writes, payments, quotas, exact event IDs, and strict relay URL ingestion.
- Bound NIP-46 bunker input and route bunker relay work through the resilient relay policy.
- Repair positional CLI execution, strict parsing, setup/configuration semantics, secret CRUD/export contracts, status codes, platform claims, and key ownership.
- Add explicit publish-quorum reports, deterministic state selection, logical tombstones, truthful retention/deletion language, and embedded relay configuration.
- Add capability-gated NIP-07, sanitized bunker restoration, complete browser logout, sanitized external content boundaries, and compiled browser journeys.
- Repair typecheck/lint/dependency/release gates; add true compiled CLI, local relay, NIP-46, managed relay, installer/updater, and browser E2E.
- Replace unsupported documentation and roadmap claims with test-backed capability statements and reconcile proposal status.

## Explicit Non-Goals

- Teams, Cloud paid tier, and Enterprise SSO/compliance remain deferred until their custody, pricing, authorization, and operational contracts are separately approved.
- Secret history/compare/restore, encrypted backup/recovery, and relay repair UI remain future capabilities after core state authorization is trustworthy.
- Logical deletion does not promise erasure of ciphertext already copied or retained by relays.
- This change does not introduce an insecure credential-storage or runtime-hook bypass.

## Impact

- Affected specs: `secret-state`, `cli-contract`, `relay-access`, `web-auth`, `release-integrity`, `quality-gates`, `product-truth`.
- Affected code: `packages/crypto/`, `packages/rate-limiter/`, `cli/`, `web/`, `relay/nosflare/`, release/install scripts, CI, docs, and generated artifacts.
- Breaking behavior:
  - attacker-authored, malformed, or excessively future-dated secret bundles are ignored;
  - unknown flags/subcommands fail instead of falling through;
  - undocumented/unimplemented flags are removed;
  - runtime-hook secret names are rejected;
  - extensions without NIP-44 encrypt/decrypt cannot enter secret-management state;
  - new plaintext credential fallback is removed;
  - Windows upgrade is rejected until Windows artifacts exist;
  - raw secret values require the documented explicit reveal path.
- Audit register: `piolium/ALL-ISSUES-AND-GAPS.md`.
