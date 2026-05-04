# GitHub Actions integration

Redshift ships a composite GitHub Action at `actions/redshift-run`. It builds the
CLI inside the runner and runs one command through `redshift run`, so Redshift
secrets are injected into that command's process environment.

The safe path is a **self-hosted runner that is already logged in to Redshift**.
GitHub stores the workflow, but it does not store your app secrets or your Nostr
private key.

## Runner setup

On the self-hosted runner, install Bun and log in as the same OS user that runs
GitHub Actions:

```bash
curl -fsSL https://bun.sh/install | bash
redshift login
redshift setup --project my-app --environment production
redshift secrets get API_KEY
```

Prefer system keychain storage when available. If the runner uses file-based
config, protect the runner account and `~/.redshift` directory.

## Workflow

```yaml
name: deploy

on:
  workflow_dispatch:

jobs:
  deploy:
    runs-on: [self-hosted, redshift]
    steps:
      - uses: actions/checkout@v4

      - name: Deploy with Redshift secrets
        uses: accolver/redshift/actions/redshift-run@main
        with:
          project: my-app
          environment: production
          command: npm run deploy
```

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| `project` | Yes | Redshift project slug. |
| `environment` | Yes | Redshift environment/config slug. |
| `command` | Yes | Shell command to run with secrets injected. |
| `working-directory` | No | Directory where the command runs. Defaults to `.`. |
| `allow-pull-request` | No | Set to `true` only for trusted PR workflows. Defaults to `false`. |

## Security model

- Secrets remain encrypted on Nostr relays and are decrypted client-side by the
  CLI on your self-hosted runner.
- The action does not export secret values to later steps or write them into
  workflow files.
- The command receives secrets only in its process environment through
  `redshift run`.
- The action refuses to run on `pull_request` and `pull_request_target` events by
  default. Override only for fully trusted workflows.
- The CLI build step requires Bun to already be installed on the self-hosted
  runner, clears Redshift credential environment variables, and uses
  `bun install --ignore-scripts`.

GitHub-hosted runners are intentionally not the default recommendation because a
long-lived `nsec` in GitHub encrypted secrets would give a central platform the
credential needed to decrypt your Redshift data. Use a dedicated self-hosted
runner until remote signer / short-lived grant support lands.

## Funding narrative

This integration demonstrates the OpenSats/HRF/NLnet case for Redshift:
developers can run real CI/CD workflows with sovereign, censorship-resistant
secret storage, without a central vendor that can read, revoke, or lock up their
application credentials.
