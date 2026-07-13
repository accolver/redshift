## Context

The repository contains a Cloudflare-based relay candidate and deterministic local tests. The current live/repository environment has not supplied the governance or operational evidence required for a production claim. Managed operations must preserve the individual's ability to use independent relays and must never expose plaintext secrets or identifying product telemetry.

## Goals / Non-Goals

- Goals: gated immutable deployment; least-privilege custody; metadata-safe monitoring; tested incident/rollback/rotation; encrypted managed backup/restore evidence; measured availability and recovery; truthful legal and product claims.
- Non-goals: paid launch, Teams custody, Enterprise controls, specific SLA/RPO/RTO/retention promises, or replacement of user-selected relays.

## Decisions

### Decision: Evidence gates precede mutation and claims

A credential-free source/plan gate runs first. Mutation requires an exact commit, named authorization, protected environment, scoped credentials, budget boundary, reviewed resource plan, and rollback plan. A successful deployment is evidence only for that deployment; it is not launch or SLA evidence.

### Decision: Production observation uses synthetic identities and ciphertext

Canaries use dedicated synthetic Nostr identities and non-sensitive encrypted payloads. Alerts may include endpoint, check ID, coarse failure class, timestamp, and synthetic event ID. They must not include nsec material, decrypted content, real user pubkeys, d-tags, IP-derived identity, or identifying analytics.

### Decision: Commercial mode remains separate

Payment enforcement and endpoints remain disabled. Operational readiness can be evaluated independently of pricing. Enabling subscriptions or billing requires approval and implementation of the separate Cloud pricing change plus operative terms.

### Decision: Managed backup is ciphertext-only and separately governed

Any future backup copies encrypted relay state only. Backup keys, deployment credentials, and restore authority are separately scoped. Restore drills use fresh synthetic targets, verify authenticity/integrity, and record observed recovery—not promised RPO/RTO.

### Decision: Claims require a predeclared measurement plan

Before observation starts, owners approve check definitions, sampling, exclusions, outage accounting, evidence retention, and the minimum measurement window. Results may support bounded SLO language only after review; an SLA is a separate legal/commercial decision.

## Risks / Trade-offs

- Cloudflare and GitHub remain third-party dependencies. Mitigation: document dependencies, fail closed, retain export/self-host paths, and avoid sovereignty claims based on provider uptime.
- Monitoring can become surveillance. Mitigation: synthetic-only checks, data minimization, reviewed schemas, retention limits, and no user-identifying telemetry.
- Backups increase ciphertext and metadata exposure. Mitigation: explicit data inventory, encryption, least privilege, retention, deletion boundaries, and restore/access drills.
- A manual gate can become ceremonial. Mitigation: bind authorization to immutable source/plan digests and retain reviewer identities and conclusions.
- Cost and denial-of-service risk can grow. Mitigation: quotas, budget alerts, hard cost limits, and FinOps review before scale.

## Migration / Rollback Plan

No migration occurs while unapproved. After approval, use synthetic data and a non-user launch stage; capture current resource state; deploy the exact approved artifact; run canaries; and exercise rollback before onboarding. A failed gate revokes credentials where appropriate, restores the last approved artifact/configuration, preserves logs/digests, and forbids production claims.

## Open Questions

- Which account/project and legal operator are authorized for production?
- Which backup service and key-custody boundary meet the approved threat model?
- What observation window and outage accounting are sufficient for a bounded SLO claim?
- What data-retention jurisdiction and processor disclosures apply to the exact deployment?
- Which GitHub branch/environment protection rules and approvers will be mandatory?
