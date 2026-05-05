# Teams Bunker Deployment

## ADDED Requirements

### Requirement: Managed Bunker Service

Redshift SHALL offer a managed bunker service as the default Teams experience.
Team owners SHALL be able to create a team and receive a bunker connection URI
without deploying any infrastructure. Redshift SHALL manage the bunker process,
relay connectivity, backups, and availability.

#### Scenario: Team owner gets managed bunker

- **GIVEN** a user subscribes to the Teams tier
- **WHEN** they create a new team via CLI or web UI
- **THEN** the system SHALL provision a managed bunker instance
- **AND** return a `bunker://` connection URI for team members
- **AND** the bunker SHALL be operational within 30 seconds

#### Scenario: Managed bunker auto-recovers

- **GIVEN** a managed bunker instance is running for team `acme`
- **WHEN** the bunker process crashes
- **THEN** the managed infrastructure SHALL restart the bunker automatically
- **AND** team members' existing sessions SHALL be recoverable after reconnect

### Requirement: Self-Hosted Deployment

Teams SHALL have the option to self-host the bunker service on their own
infrastructure. The bunker SHALL be distributable as a Docker image and
configurable via environment variables. A systemd service file generator SHALL
be provided for bare-metal deployment.

#### Scenario: Deploy via Docker

- **GIVEN** a team wants to self-host their bunker
- **WHEN** they run `docker run ghcr.io/redshift/bunker` with appropriate
  environment variables (`MASTER_KEY`, `NOSTR_RELAYS`, `OAUTH_*` credentials)
- **THEN** the bunker SHALL start and begin listening for NIP-46 requests
- **AND** expose a health check endpoint on the configured port

#### Scenario: Generate systemd service

- **WHEN** the user runs `redshift bunker systemd`
- **THEN** the CLI SHALL output a systemd unit file configured for the current
  bunker settings
- **AND** the unit file SHALL include security hardening directives
  (`NoNewPrivileges`, `ProtectSystem`, `ProtectHome`)

### Requirement: Split Architecture Support

The bunker SHALL support a split deployment mode where the web/OAuth service
faces the internet and the signing service runs on a private network. In split
mode, the web service SHALL communicate with the signer via NIP-44 encrypted
Nostr events on a shared relay. Private keys SHALL never leave the signer
process.

#### Scenario: Split mode approval flow

- **GIVEN** the web service and signer are deployed separately
- **AND** both are connected to relay `wss://relay.internal`
- **WHEN** a user completes OAuth authentication on the web service
- **THEN** the web service SHALL publish an NIP-44 encrypted approval event to
  the relay
- **AND** the signer SHALL receive the approval and authorize the user's client
  pubkey
- **AND** the user's NIP-46 signing requests SHALL be handled by the signer

### Requirement: Configuration

The bunker SHALL be configurable via environment variables with the following
required and optional settings:

| Variable               | Required | Description                           |
| ---------------------- | -------- | ------------------------------------- |
| `MASTER_KEY`           | Yes      | 32-byte hex key for NSEC encryption   |
| `NOSTR_RELAYS`         | Yes      | Comma-separated relay URLs            |
| `HOST`                 | No       | Bind address (default: `127.0.0.1`)   |
| `PORT`                 | No       | HTTP port (default: `3333`)           |
| `DATABASE_URL`         | No       | SQLite path (default: `bunker.db`)    |
| `GOOGLE_CLIENT_ID`     | No       | Google OAuth client ID                |
| `GOOGLE_CLIENT_SECRET` | No       | Google OAuth client secret            |
| `GITHUB_CLIENT_ID`     | No       | GitHub OAuth client ID                |
| `GITHUB_CLIENT_SECRET` | No       | GitHub OAuth client secret            |
| `ADMIN_PUBKEYS`        | No       | Comma-separated admin hex pubkeys     |
| `SESSION_TIMEOUT`      | No       | Session duration (default: `24h`)     |
| `PUBLIC_URL`           | No       | Public-facing URL for OAuth callbacks |

#### Scenario: Bunker starts with minimal config

- **GIVEN** `MASTER_KEY` and `NOSTR_RELAYS` are set
- **AND** no OAuth credentials are configured
- **WHEN** the bunker starts
- **THEN** the bunker SHALL start successfully in "direct auth only" mode
- **AND** OAuth endpoints SHALL return 404
- **AND** NIP-46 signing SHALL be operational for directly-authorized pubkeys

#### Scenario: Missing master key prevents startup

- **GIVEN** `MASTER_KEY` is NOT set
- **WHEN** the bunker attempts to start
- **THEN** the bunker SHALL exit with a clear error message indicating
  `MASTER_KEY` is required
