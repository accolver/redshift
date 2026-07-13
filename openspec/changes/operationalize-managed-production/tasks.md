## 0. Approval and External Authority

- [ ] 0.1 Obtain explicit proposal approval from product, security, operations, privacy/legal, and FinOps owners.
- [ ] 0.2 Name the production operator, approved account/project, credential issuer, incident owner, evidence location, and launch authority.
- [ ] 0.3 Confirm protected branch/environment rules, least-privilege Cloudflare scopes, budget limits, and a reviewed immutable deployment plan before any mutation.

## 1. Pre-Mutation Tests and Plan

- [ ] 1.1 Add failing contract tests for source/digest binding, manual authorization, rollback, payment-disabled metadata, secret absence, and evidence completeness.
- [ ] 1.2 Produce a credential-free plan identifying every resource, binding, migration, custom domain, secret name, data class, and rollback action.
- [ ] 1.3 Review the plan and record approvals without storing credentials or user data in repository evidence.

## 2. Controlled Deployment

- [ ] 2.1 Exercise least-privilege credential validation and revocation with synthetic resources.
- [ ] 2.2 Deploy the exact approved commit only after protected-environment approval.
- [ ] 2.3 Verify NIP-11, NIP-42, recipient-scoped Gift Wrap reads/writes, quotas, disabled payment routes, and no production user data.
- [ ] 2.4 Exercise immutable rollback and record before/after resource and artifact digests.

## 3. Monitoring and Incident Operations

- [ ] 3.1 Add metadata-safe synthetic canaries, alerts, severity/ownership routing, and a status communication path.
- [ ] 3.2 Prove alert delivery and acknowledgement without plaintext secrets or identifying user telemetry.
- [ ] 3.3 Exercise relay outage, credential compromise/rotation, bad deployment, data-access failure, and third-party outage runbooks.

## 4. Managed Retention and Recovery

- [ ] 4.1 Define ciphertext-only backup scope, separate key custody, retention/deletion behavior, restore authorization, and cost limits.
- [ ] 4.2 Run backup corruption, access-denial, expiry, and fresh-target restore drills with synthetic encrypted fixtures.
- [ ] 4.3 Measure observed recovery point/time and document limitations without publishing guarantees.

## 5. Claim and Launch Gate

- [ ] 5.1 Complete security and privacy/legal review for the exact deployment and publish operative terms/notices before any user onboarding.
- [ ] 5.2 Run an approved sustained observation window and retain availability, incident, restore, and cost evidence.
- [ ] 5.3 Approve any SLO/RPO/RTO/retention wording separately; do not infer an SLA.
- [ ] 5.4 Run strict OpenSpec validation, the full production gate, credentialed end-to-end verification, and independent adversarial review.
- [ ] 5.5 Obtain an explicit launch decision. Keep payment and commercial onboarding disabled unless the separate Cloud pricing change is also approved and implemented.
