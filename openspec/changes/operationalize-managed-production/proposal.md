# Change: Operationalize managed-production evidence

## Status

**Proposed and unapproved.** This change defines the governance and evidence required before the managed-relay candidate can be called a production service. Drafting it does not authorize deployment, Cloudflare/GitHub mutation, payment enablement, production data, user onboarding, retention claims, or an SLA.

## Why

Redshift has locally tested managed-relay code and a declared deployment workflow, but no approved credentialed deployment, protected release path, monitoring, alert delivery, incident exercise, credential rotation, rollback, encrypted managed backup/restore drill, retention measurement, or sustained availability evidence. Source configuration and a reachable endpoint cannot substitute for those controls.

## What Changes

- Define named owner, approval, least-privilege credential, immutable source, environment-protection, deployment, rollback, and evidence requirements.
- Require metadata-safe synthetic checks and alerts for endpoint, NIP-11, NIP-42, recipient-scoped reads/writes, quotas, and declared non-commercial access behavior.
- Require incident, credential-rotation, compromise, outage, and rollback exercises with recorded results.
- Define encrypted managed backup, retention, restore, deletion-boundary, and key-custody requirements before any managed-retention or recovery claim.
- Measure availability and recovery behavior over an approved observation window before publishing any SLO, RPO, RTO, retention duration, or SLA.
- Require operative legal/privacy documents for the exact deployment before users or production data are accepted.
- Keep payment disabled and treat Cloud pricing as a separate deferred commercial proposal.

## Non-Goals

- Implementing or launching paid Cloud, Teams, Enterprise, billing, SSO, or shared custody.
- Changing the sovereign individual CLI/dashboard or making Redshift-operated infrastructure mandatory.
- Promising a specific uptime, retention period, RPO, RTO, geographic scope, or launch date in this proposal.
- Deploying, adding secrets, changing branch/environment rules, or onboarding real users while the proposal is unapproved.

## Impact

- New capability: `managed-production-operations`
- Affected specs: `product-truth`, `quality-gates`, `relay-access`
- Affected systems after approval: GitHub environment governance, Cloudflare Workers/Durable Objects/D1/R2 as approved, monitoring/alerting, encrypted backup tooling, incident evidence, privacy/terms, and status communication
- External decisions: named operator, legal/privacy review, security review, FinOps limits, credential authority, evidence retention, and launch approval

## Telos Validation

- **L9→L1:** Bounded managed convenience can improve availability without weakening user custody only if no plaintext/identifying telemetry exists, self-hosting remains viable, claims are evidence-based, and implementation is protected by explicit contracts and tests.
- **L1→L9:** The candidate protocol tests, immutable source binding, least-privilege deploy tooling, synthetic identities, encrypted artifacts, and documented drills are technically feasible, but real credentials and production evidence are externally blocked.
- **Convergence:** The proposal aligns as an evidence program. Implementation and every mutation remain blocked until explicit approval and named external gates are satisfied.
