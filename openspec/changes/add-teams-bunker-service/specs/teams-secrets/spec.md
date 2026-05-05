# Teams Secret Sharing

## ADDED Requirements

### Requirement: Team Key Management (Phase 1)

Each team SHALL have a dedicated Nostr keypair (the "team key") generated and
managed by the bunker. The team key's private component SHALL be stored
encrypted (AES-256-GCM) in the bunker's SQLite database. Team secrets SHALL be
encrypted to the team key using NIP-59 Gift Wrap, following the same format as
individual secrets (`["t", "redshift-secrets"]` tag, Kind 30078 inner rumor,
`{projectSlug}|{environment}` d-tag).

#### Scenario: Team secrets use same format as individual secrets

- **GIVEN** team `acme` has a team key with pubkey `team_pub_1`
- **WHEN** a developer writes secrets for project `api` environment `prod`
- **THEN** the secrets SHALL be wrapped in NIP-59 Gift Wrap addressed to
  `team_pub_1`
- **AND** the inner rumor SHALL be Kind 30078 with d-tag `api|prod`
- **AND** the outer Gift Wrap SHALL include `["t", "redshift-secrets"]`

#### Scenario: Team key generated on team creation

- **GIVEN** a user creates a new team `acme`
- **WHEN** the team is initialized
- **THEN** the bunker SHALL generate a fresh Nostr keypair for the team
- **AND** store the private key encrypted with the master key
- **AND** return the team's public key (npub) to the creator

### Requirement: Bunker-Mediated Secret Access (Phase 1)

Team members SHALL access shared secrets by sending NIP-46 signing and
encryption requests to the team bunker. The bunker SHALL act as a signing proxy,
performing NIP-44 encrypt/decrypt and event signing on behalf of the team key.
The bunker SHALL check RBAC permissions before executing any operation.

#### Scenario: Developer reads team secrets via CLI

- **GIVEN** developer `alice` is authenticated via NIP-46 to team `acme`'s
  bunker
- **AND** `alice` has role `developer` (readSecrets: true)
- **WHEN** `alice` runs `redshift secrets list --team acme --project api`
- **THEN** the CLI SHALL request NIP-44 decryption of the Gift Wrapped secrets
  via NIP-46
- **AND** the bunker SHALL decrypt using the team key and return the plaintext
- **AND** the CLI SHALL display the secret names and values

#### Scenario: Developer writes team secrets via CLI

- **GIVEN** developer `bob` is authenticated via NIP-46 to team `acme`'s bunker
- **AND** `bob` has role `developer` (writeSecrets: true)
- **WHEN** `bob` runs
  `redshift secrets set API_KEY=abc123 --team acme --project api`
- **THEN** the CLI SHALL create a NIP-59 Gift Wrap event addressed to the team
  pubkey
- **AND** request the bunker to sign the event via NIP-46
- **AND** publish the signed event to configured relays

#### Scenario: Readonly member cannot write

- **GIVEN** user `charlie` has role `readonly` on team `acme`
- **WHEN** `charlie` attempts to set a secret via the CLI
- **THEN** the bunker SHALL reject the signing request
- **AND** the CLI SHALL display a permission error

### Requirement: Team Key Rotation (Phase 1)

Team owners and admins SHALL be able to rotate the team key. Rotation SHALL
generate a new keypair, re-encrypt all active team secrets to the new key, and
publish updated Gift Wrap events. The old key SHALL be retained (read-only) for
a configurable grace period to allow clients to sync.

#### Scenario: Team key rotated by owner

- **GIVEN** team `acme` has 10 active secrets across 3 projects
- **WHEN** the owner runs `redshift teams rotate-key --team acme`
- **THEN** the bunker SHALL generate a new team keypair
- **AND** decrypt all 10 secrets with the old key
- **AND** re-encrypt all 10 secrets with the new key
- **AND** publish the re-encrypted Gift Wrap events to relays
- **AND** update the team metadata with the new public key

### Requirement: MLS Group Encryption (Phase 2)

In Phase 2, the system SHALL implement MLS (Messaging Layer Security) group
encryption per RFC 9420 via NIP-EE for team secret sharing. Each team member
SHALL be a leaf node in an MLS ratchet tree. The group key SHALL be derived from
the tree root and SHALL change on any membership operation (add, remove,
update). Secrets SHALL be encrypted to the current epoch's group key.

#### Scenario: Member removal triggers epoch rotation

- **GIVEN** team `acme` has members Alice, Bob, and Carol at epoch N
- **WHEN** Carol is removed from the team
- **THEN** the MLS tree SHALL be updated to remove Carol's leaf
- **AND** a new epoch N+1 SHALL be derived
- **AND** all active secrets SHALL be re-encrypted to the epoch N+1 key
- **AND** Carol SHALL NOT be able to derive the epoch N+1 key

#### Scenario: New member can only access secrets from join point

- **GIVEN** team `acme` has secrets at epochs 1 through 5
- **WHEN** Dave joins the team at epoch 6
- **THEN** Dave SHALL be able to decrypt secrets encrypted at epoch 6 and later
- **AND** Dave SHALL NOT be able to decrypt secrets encrypted at epochs 1-5

### Requirement: CLI Team Commands

The CLI SHALL provide team management commands under the `redshift teams`
namespace. These commands SHALL support both interactive and non-interactive
(CI/CD) modes.

#### Scenario: Create a team

- **WHEN** the user runs `redshift teams create --name "Acme Corp"`
- **THEN** the CLI SHALL create a new team with a generated team key
- **AND** display the team ID, team pubkey, and bunker connection URI

#### Scenario: List team secrets

- **WHEN** the user runs
  `redshift secrets list --team acme --project api --env prod`
- **THEN** the CLI SHALL connect to the team bunker via NIP-46
- **AND** fetch and decrypt the team's secrets for that project/environment
- **AND** display them in the same format as individual secrets

#### Scenario: Inject team secrets into process

- **WHEN** the user runs
  `redshift run --team acme --project api -- node server.js`
- **THEN** the CLI SHALL fetch team secrets from the bunker
- **AND** inject them as environment variables into the spawned process
