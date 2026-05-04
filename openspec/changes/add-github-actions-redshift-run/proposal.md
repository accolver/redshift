# Change: Add GitHub Actions Redshift Run integration

## Why
Developers need a flagship integration that proves Redshift can inject sovereign, Nostr-backed secrets into existing delivery workflows without adding a central secrets SaaS.

## What Changes
- Add a composite GitHub Action that builds the Redshift CLI from this repository and runs a user command with Redshift secrets injected on a pre-authenticated self-hosted runner.
- Add documentation and example workflow for no-central-custody GitHub Actions usage.
- Fix command-token handling so `redshift run --command "..."` preserves shell commands with spaces.

## Impact
- Affected specs: none currently published
- Affected code: `actions/redshift-run/action.yml`, `cli/src/commands/run.ts`, CLI tests, docs/examples
