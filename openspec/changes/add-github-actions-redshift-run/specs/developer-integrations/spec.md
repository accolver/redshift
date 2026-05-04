## ADDED Requirements
### Requirement: GitHub Actions Secret Injection
Redshift SHALL provide a GitHub Actions integration that runs a configured command with Redshift-managed secrets injected into the process environment on a pre-authenticated self-hosted runner without copying plaintext secret values or Nostr private keys into workflow YAML.

#### Scenario: CI command receives Redshift secrets
- **GIVEN** a self-hosted GitHub Actions runner is already authenticated with Redshift
- **WHEN** the workflow invokes the Redshift GitHub Action with a project, environment, and command
- **THEN** the action builds the CLI, fetches the selected Redshift secrets from configured relays, and runs the command with those secrets in its environment

#### Scenario: Missing runner authentication fails closed
- **GIVEN** a self-hosted GitHub Actions runner is not authenticated with Redshift
- **WHEN** the workflow invokes the Redshift GitHub Action
- **THEN** the CLI exits before fetching secrets or running the configured command

#### Scenario: Pull request events fail closed
- **GIVEN** a workflow runs on a pull request event
- **WHEN** the workflow invokes the Redshift GitHub Action without explicitly allowing pull request use
- **THEN** the action exits before fetching secrets or running the configured command
