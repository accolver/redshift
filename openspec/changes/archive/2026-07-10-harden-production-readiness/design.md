# Design: Harden Production Readiness

## Context

Redshift stores secret bundles as NIP-59 Gift Wraps, exposes them through a Bun CLI and Svelte dashboard, and optionally uses a Cloudflare Durable Object relay. The audit demonstrated that cryptographic validity was treated as state authorization, authentication credentials were inherited by workloads, several documented CLI options were inert, the managed relay authenticated the wrong NIP-59 identity, the compiled dashboard was blocked by its CSP, release verification was optional, and primary journeys were not exercised against the shipped binary.

The Telos L9→L1→L9 review converges on the same ordering: protect sovereign ownership and truthful portability first; make the complete individual journey reliable; then consider collaboration or paid infrastructure. Technical feasibility converges through existing `nostr-tools`, typed domain errors, Bun/Vitest, local `nak`, Playwright, and hermetic HTTP test fixtures.

## Goals

- Make unauthorized secret state impossible to select.
- Ensure only requested application secrets reach a child process.
- Make every documented core CLI contract exact, deterministic, and scriptable.
- Bind managed-relay access/payment/quota policy to the authenticated recipient identity.
- Make partial relay publication explicit and state ordering deterministic.
- Define deletion as a newer authenticated empty state without false erasure claims.
- Make installation, upgrade, generated output, and CI fail closed.
- Prove hosted, embedded, local-relay, and bunker user journeys with shipped artifacts.

## Decisions

### 1. NIP-59 authorization and state versioning

A secret bundle is valid only when all of the following are true:

- the outer event is a valid kind 1059 event with exactly one canonical `p` tag equal to the authenticated owner and the required `t=redshift-secrets` tag;
- the seal decrypts and verifies;
- the seal author and rumor author both equal the authenticated owner;
- the rumor is kind 30078, carries exactly one valid d-tag, has canonical content, and is not more than 300 seconds in the future;
- all relevant timestamps are non-negative safe integers.

The local-key API derives the expected owner from its private key. The signer-backed API requires an explicit expected owner.

Logical versions sort by inner `created_at`, then a deterministic canonical identifier. To remain compatible with NIP-01 replaceable-event tie behavior and avoid depending on randomized transport order, the shared comparator uses the outer event ID as the final observed tie-break. Writes use `max(now, latestTimestamp + 1)` when replacing observed state. A selected empty bundle is a tombstone.

A persistent anti-rollback checkpoint across fresh devices is not added here because recovery and synchronization semantics require a separate design. The implementation prevents input-order rollback among observed candidates and rejects excessive future skew.

### 2. Child environment boundary

`redshift run` builds a fresh environment and never mutates `process.env`. It removes Redshift authentication variables from the base and forbids secrets that alter runtime loading or startup behavior, including Node, Python, Ruby, shell, dynamic-loader, and Perl hook variables. A blocked key fails before process creation. Positional argv is passed byte-for-byte; shell execution exists only for explicit `--command` mode.

### 3. Relay publication and authorization

Publishing is per relay with `allSettled`, retry/backoff only for failed relays, and an explicit report. Majority quorum (`floor(n/2)+1`) is the default. Quorum success may report degraded relays; quorum failure throws a typed error that retains accepted, failed, and timed-out destinations and the exact event ID.

A managed-relay WebSocket binds one immutable principal after strict NIP-42 AUTH. For kind 1059 writes, the sole Redshift recipient is the principal and paid identity; the ephemeral outer author is verified but is not the account identity. Reads require a paid principal and filters constrained to kind 1059, that same sole `#p`, and `#t=redshift-secrets`. Direct plaintext kind 30078 is rejected.

Rate and active-connection limits are shared by authenticated identity rather than connection. A bounded unauthenticated/IP layer protects pre-authentication work. AUTH requires exact normalized relay URL, challenge, timestamp, event ID, and signature.

### 4. Bunker boundary

Bunker input is subject to serialized size, timestamp, method, parameter, queue, concurrency, global pre-verification, and per-client post-verification bounds. Unknown or unauthorized senders are rejected before expensive crypto where possible. Pairing URI secrets are accepted from hidden input/environment by preference, redacted from all failures, and never persisted in the web app. Bunker subscribe/publish uses the resilient relay adapter.

### 5. CLI truth contract

The parser is strict. Unknown flags/subcommands and missing values are usage errors. Global flags are accepted only where behavior is consistent. The retained core is:

- exact positional `run -- <argv...>` and explicit `run --command <shell>`;
- `run --preserve-env`; signal forwarding is unconditional;
- batch secret get/set/delete, `--only-names`, `--plain`, missing-secret control, confirmed delete, and env/json download to stdout or a path;
- no mount/fallback/clipboard/passphrase claims until separately specified;
- setup has independent `--force` and `--no-interactive` behavior;
- explicit CLI values override project config, which overrides global defaults;
- configure mutations are atomic/nonzero on error and reset clears all configuration;
- unauthenticated `me` is nonzero;
- new plaintext nsec/bunker-client fallback is not written;
- Windows upgrade is unsupported until release artifacts exist;
- `SecretManager` clones caller key material before owning/zeroizing it.

Raw/reveal semantics use one matrix: ordinary human/machine metadata is redacted; full secret values require an explicit reveal option or an explicitly secret-bearing export command. Warnings go to stderr and structured data remains parseable on stdout.

### 6. Logical deletion

Deleting an environment publishes a newer empty authenticated bundle for its d-tag before metadata is changed locally. Deleting a project publishes tombstones for every environment, then its owner-authored metadata deletion/tombstone, before local removal. Quorum failure aborts local deletion.

NIP-09 can request deletion only for events actually authored by the user. It cannot authorize deletion of Gift Wraps authored by discarded ephemeral keys. Documentation states that old ciphertext can remain on relays or with attackers and that credential/key rotation protects future access rather than erasing copies.

### 7. Browser auth, storage, content, and CSP

NIP-07 login completes only if both NIP-44 encrypt and decrypt capabilities exist. Web bunker restoration persists a versioned sanitized pointer and local client credential, never a one-time pairing secret. A full logout/account switch clears ciphertext and the IndexedDB CryptoKey; relay reconnect is a separate operation.

The compiled embedded dashboard and relay landing page use per-response cryptographic nonces. Runtime relay configuration is nonce-protected, validated, and reflected as exact CSP connect origins. The mutable relay landing dependency was removed. SvelteKit centrally generates nonce policies for dynamic hosted responses and hash policies for prerendered/static output; embedded serving removes the static CSP meta tag before applying its exact runtime nonce header so the two policies cannot conflict.

External blog/CMS HTML crosses one audited sanitizer boundary. JSON-LD serialization escapes `<`, `>`, `&`, U+2028/U+2029, and closing script sequences.

### 8. Release trust and atomic replacement

Release jobs use pinned actions, a pinned Bun version, frozen installs, least permissions, exact-name SHA-256 manifests, SBOMs, provenance, and GitHub artifact attestations bound to this repository/workflow/ref. Install/upgrade fetch metadata first, verify the attestation/trusted identity and exact filename/hash, download into a restrictive same-filesystem temporary file, verify, chmod, smoke-test, and atomically rename. The old binary remains recoverable until success. Missing, malformed, duplicate, unsigned, wrong-name, or wrong-hash metadata fails closed.

GitHub artifact attestation is selected instead of a long-lived project signing key. The installer/updater pins the expected GitHub repository and release workflow identity and resolves the selected release tag to the exact source commit digest required by verification. Local tests use injected command runners so failures are hermetic and do not trust an external network.

### 9. Tooling and test gates

Owned-source typechecks, scoped Biome, unit tests, required local-relay/NIP-46/managed-relay integration, compiled CLI E2E, compiled browser E2E, installer/updater integrity tests, generated-artifact consistency, builds, and release smoke/attestation verification are mandatory gates. Tests fail rather than fall back to source or skip the required release journeys. A fresh dependency audit remains an open gate because the user explicitly requested no further security scanning.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Existing malicious/malformed events become unreadable | Intentional fail-closed behavior; valid owner-authored events remain compatible |
| Majority quorum leaves minority relays stale | Return per-relay report and retain future repair feature |
| Logical deletion is mistaken for erasure | Update all user-facing claims and test relay history explicitly |
| Strict CLI changes break scripts relying on inert flags | Remove claims, provide migration notes, and test retained core |
| CSP changes break Svelte hydration | Build-generated policy plus real compiled-browser E2E |
| Release attestation unavailable on a development mirror | Development builds identify as unverified; production install/upgrade never bypasses verification |
| Dependency upgrades cause framework regressions | Upgrade in bounded groups with full gates after each group |
| Shared relay quotas need durable state | Central quota authority with fake-clock tests and lease expiry |

## Migration Plan

1. Land authorization, environment isolation, exact argv, key ownership, event-ID verification, and CSP fixes first.
2. Land strict CLI/config/secret behavior and relay authorization/quorum next.
3. Land browser custody/deletion/content changes and E2E harnesses.
4. Land release/CI/dependency/tooling hardening.
5. Replace docs/roadmap claims and establish archived/current OpenSpec truth.
6. Keep Teams/Cloud/Enterprise/history/recovery/repair proposals deferred and unimplemented.

## Validation

Every implementation task begins with a failing focused test. The program is complete only when all mandatory checks in `tasks.md` pass and every non-feature issue in `piolium/ALL-ISSUES-AND-GAPS.md` is checked with a linked regression test or an approved removal/documentation decision.

### Final Telos L9→L1→L9 checkpoint (2026-07-10)

- **L9→L5:** Owner-authorized state, scrubbed execution, truthful logical deletion, explicit raw output, and independently usable local/public-relay workflows serve sovereignty and the complete individual journey. Deferring Teams, Cloud, history, backup, and SLA claims prevents lower-priority scope from weakening that purpose.
- **L4→L1:** Canonical Nostr verification, recipient-scoped relay policy, durable principal quotas, typed quorum failures, strict CLI contracts, atomic release paths, and deterministic tests satisfy integration, component, function, and syntax constraints.
- **L1→L9:** Frozen builds, zero-diagnostic type/lint gates, 949 passing product tests, 17 relay tests, compiled local-relay/bunker journeys, two Playwright release journeys, deterministic generation, Wrangler dry-run, and strict OpenSpec validation demonstrate technical feasibility without contradicting product purpose.
- **Convergence:** Both directions approve the completed core hardening. They do not approve claiming full production readiness until the open custody, dependency-audit, NIP-46 transport, hosted-CSP, credentialed deployment/release, and operational evidence gates close.
