# Redshift Managed Relay Candidate

This directory contains a **development managed-relay candidate** and local
verification fixtures. No Redshift Cloud subscription, paid offer, production
endpoint, backup/retention guarantee, or SLA is launched.
`wss://relay.redshiftapp.com` is a proposed endpoint, not availability evidence.
Pay-to-relay is disabled in the declared source.

The candidate accepts recipient-scoped NIP-59 Gift Wrap events (Kind 1059) and
requires NIP-42 authentication. It is not a general-purpose social relay.

**Upstream:** [Spl0itable/nosflare](https://github.com/Spl0itable/nosflare)
(included as a git subtree).

## Local verification

Use the repository-pinned Bun toolchain and frozen dependency graph:

```bash
cd relay/nosflare
bun install --frozen-lockfile
bun run typecheck
bun test
bun run verify:generated
```

The generated `worker.js` must match the owned TypeScript source.

## Development deployment reference

Do not run this workflow against a production account until the
`operationalize-managed-production` OpenSpec proposal is approved,
least-privilege credentials and branch/environment controls are reviewed, and
an exact deployment plan is authorized.

The helper accepts credentials through environment variables only. It rejects
argv credentials and checks both variables before dependency installation or
network activity:

```bash
cd relay
export CLOUDFLARE_API_TOKEN='set-through-an-approved-secret-channel'
export CLOUDFLARE_ACCOUNT_ID='approved-account-id'
./deploy.sh
```

Never print either credential. After a frozen install, authentication can be
checked without exposing the token:

```bash
./nosflare/node_modules/.bin/wrangler whoami
```

GitHub Actions runs a credential-free preflight on matching pushes. Deployment
is manual-only, binds to an exact approved commit, and remains disabled unless
an administrator sets `MANAGED_RELAY_DEPLOY_APPROVED=true` after proposal
approval and external governance review. The deploy job also uses the GitHub
`production` environment; credentials are scoped only to its deployment step.
The variable and environment declaration are gates, not evidence that branch or
environment protections have been configured.

## Current protocol truth

| Setting | Candidate behavior |
| --- | --- |
| Event kind | NIP-59 Gift Wrap (1059) only |
| Authentication | NIP-42 required |
| Principal | Sole typed Gift Wrap recipient |
| Reads/writes | Recipient-scoped |
| Pay-to-relay | Disabled |
| Paid service | Not launched |
| Canonical commercial hypothesis | Unapproved $5/month Cloud proposal |
| Managed backup/retention | Not launched or guaranteed |
| SLA/RPO/RTO | Unmeasured and not offered |

NIP-09 cannot authorize deletion of ephemeral-author Gift Wraps. Redshift
logical deletion uses a newer authenticated empty bundle; it does not erase
older relay ciphertext.

## Deployment inputs

The checked-in `wrangler.toml`, Durable Object bindings, migrations, and custom
domain declaration are source configuration, not proof that an approved
production service exists. The deployment helper does not create or rewrite
Cloudflare resources and does not accept credentials on argv.

## Security checklist before any approved production mutation

- [ ] Exact source commit and generated worker digest reviewed
- [ ] Credential-free preflight passed
- [ ] Least-privilege account/token scope approved
- [ ] Protected environment approval recorded
- [ ] Rollback plan and immutable evidence location approved
- [ ] Metadata-safe canaries and alert delivery reviewed
- [ ] Credential revocation procedure tested
- [ ] Production payment authorization separately approved and externally verified
- [ ] Reviewed operative privacy notice and terms published

## Related planning

- [`openspec/changes/add-cloud-pricing/`](../openspec/changes/add-cloud-pricing/)
  — proposed/deferred commercial hypothesis
- `openspec/changes/operationalize-managed-production/` — proposed operational
  governance; drafting does not authorize deployment
- [`CLOUD_TIER_PLAN.md`](../CLOUD_TIER_PLAN.md) — historical non-normative plan
