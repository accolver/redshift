# Managed Production Evidence - Product Requirements Document

## Overview

Define the operator workflow and evidence required to promote the managed-relay development candidate to a bounded production service. This PRD is an approval artifact, not deployment authorization. The individual v0.14.0 product remains the only certified scope.

## Goals & Objectives

- Primary goal: make every managed-service claim traceable to an approved immutable deployment and retained operational evidence.
- Secondary goals: preserve user sovereignty, prevent secret/telemetry leakage, prove incident and recovery procedures, and establish honest claim boundaries.
- Success metrics: all required gates have named owners and successful evidence; no plaintext or identifying telemetry is collected; rollback/rotation/restore drills complete; availability and recovery are measured over a preapproved window; no SLA or paid launch is inferred.

## User Stories

### User Story 1: Sovereign developer evaluates the service

**As a** developer
**I want to** see the exact managed-service scope and evidence
**So that** I can decide whether to add it without losing independent relay access

**Acceptance Criteria:**
- Given no launch decision exists, when I view product, relay, pricing, or legal surfaces, then they identify the service as unlaunched and make no retention/SLA promise.
- Given a future launch is approved, when I review its documentation, then I can find provider dependencies, metadata visibility, retention, export/self-host alternatives, incident contact, and measured claim boundaries.

### User Story 2: Operator performs an authorized deployment

**As an** authorized operator
**I want to** deploy only an approved immutable artifact with least privilege
**So that** production cannot drift from reviewed source

**Acceptance Criteria:**
- Given any approval, commit, plan digest, protected environment, credential scope, budget, or rollback evidence is missing, when deployment is requested, then mutation is blocked.
- Given every precondition is approved, when deployment runs, then evidence binds source, generated artifact, resource plan, principal, reviewers, timestamps, results, and rollback target without recording credentials.

### User Story 3: On-call responder handles a failure

**As an** incident owner
**I want to** receive metadata-safe alerts and follow tested runbooks
**So that** outages and compromises are contained without leaking user information

**Acceptance Criteria:**
- Given a synthetic relay check fails, when the threshold is reached, then the named owner receives a severity-classified alert containing no real user identity or plaintext.
- Given a bad deploy, outage, or credential compromise, when the runbook is exercised, then acknowledgement, containment, rollback/rotation, recovery, communication, and evidence retention are recorded.

### User Story 4: Recovery owner proves encrypted restore

**As a** recovery owner
**I want to** restore approved ciphertext backups into a fresh synthetic target
**So that** retention claims rely on tested recovery rather than backup existence

**Acceptance Criteria:**
- Given a backup is missing, expired, corrupted, unauthorized, or cannot be decrypted under approved custody, when restore is attempted, then it fails closed and alerts the owner.
- Given a valid backup and approved target, when the drill runs, then integrity/authenticity, scoped access, restored protocol behavior, cleanup, observed recovery point, and observed recovery time are recorded.

## Technical Requirements

### Architecture

- Immutable source and generated worker digests are bound to a reviewed deployment plan.
- GitHub preflight is credential-free; mutation is manual, protected, exact-commit bound, and least privilege.
- Cloudflare resources and bindings are declared explicitly; unmanaged drift blocks claims.
- Synthetic NIP-42 clients exercise recipient-scoped NIP-59 behavior and quotas.
- Payment endpoints and enforcement remain disabled.
- Monitoring and evidence storage collect no decrypted secret or real-user identifying analytics.

### Evidence Model

```typescript
interface ManagedProductionEvidence {
  sourceCommit: string;
  generatedArtifactSha256: string;
  deploymentPlanSha256: string;
  operator: string;
  approvals: Array<{ role: string; decision: 'approved' | 'rejected'; recordedAt: string }>;
  checks: Array<{ id: string; conclusion: 'success' | 'failure'; recordedAt: string }>;
  rollbackArtifactSha256: string;
  containsProductionUserData: false;
}
```

The representation may change during design review, but evidence MUST exclude tokens, private keys, decrypted payloads, passphrases, real-user identifiers, and sensitive provider response bodies.

### External Interfaces

- NIP-11 metadata over HTTPS.
- NIP-42 authentication and recipient-scoped NIP-59 reads/writes over WSS.
- Cloudflare deployment/resource APIs through least-privilege credentials.
- GitHub Actions protected environments and immutable repository refs.
- Approved alert, evidence, status, and backup systems selected during implementation review.

## User Experience

### Operator Flow

1. Operator selects an exact reviewed commit and credential-free plan.
2. Product/security/privacy/FinOps approvers record decisions.
3. Protected manual workflow re-verifies plan/source and deploys with scoped credentials.
4. Synthetic canaries verify declared protocol behavior.
5. Operator exercises rollback, alert, and credential-rotation paths.
6. Recovery owner performs encrypted restore drills.
7. Decision owners review sustained measurements and approve or reject bounded claims/launch.

### Edge Cases

- Empty state: no evidence means unlaunched, not unknown production readiness.
- Error state: any missing/non-successful gate blocks launch and claims.
- Loading state: long-running deployment/drills show pending, never success by timeout.
- Drift: resource or artifact mismatch invalidates prior deployment certification.
- Provider outage: preserve evidence, fail closed, and communicate the dependency without asserting data loss or recovery until verified.

## Security & Privacy

- NIP-59 client-side encryption and sole-recipient authorization remain mandatory.
- No nsec, token, passphrase, plaintext, real-user d-tag, or decrypted content enters logs/evidence.
- Synthetic identities are isolated, revocable, and excluded from user analytics.
- Credentials are least privilege, short lived where supported, rotated, and tested for revocation.
- Backup keys and deployment credentials have separate custody and authorization.
- Legal/privacy review is required for the exact operator, processors, metadata, retention, jurisdiction, and user rights.

## Performance and Reliability Requirements

- Quota and latency checks use preapproved thresholds derived from measured capacity, not invented marketing targets.
- Availability, restore point/time, alert acknowledgement, and rollback time are measured over a predeclared window.
- No percentage, RPO, RTO, retention duration, or SLA is published until owners approve the measurement method and evidence.

## Accessibility Requirements

Any public status or incident surface must meet the repository's WCAG-oriented keyboard, semantic status, contrast, and screen-reader requirements. Operator evidence must be available in a text-readable format.

## Implementation Phases

### Phase 1: Governance and synthetic preproduction

Approve authorities, plans, data inventory, budgets, alerts, and synthetic-only deployment/drills.

### Phase 2: Observation and recovery evidence

Run sustained canaries, incident/rotation/rollback exercises, and encrypted restore drills; review evidence and limitations.

### Phase 3: Explicit launch decision

Approve or reject bounded production claims and operative legal documents. Paid onboarding remains separately gated.

## Dependencies

- Approved OpenSpec change and Telos convergence.
- Named product, security, operations, privacy/legal, and FinOps authorities.
- Protected GitHub and least-privilege Cloudflare configuration.
- Approved monitoring, evidence, alerting, backup, and key-custody systems.
- Separate Cloud pricing approval for any commercial behavior.

## Open Questions

- Exact production operator/account and jurisdictions.
- Required branch/environment protection rules and approvers.
- Monitoring/evidence vendors and retention limits.
- Backup provider, key custody, and restore target design.
- Predeclared observation window and bounded claim thresholds.

## Out of Scope

- Paid subscriptions, Lightning/BTCPay, Teams/RBAC, Enterprise SSO/compliance, real-user onboarding before launch approval, and any guarantee not supported by measured evidence.
