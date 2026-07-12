# Teams Bunker Service

## ADDED Requirements

### Requirement: Team Bunker Foundation Dependency

The Teams bunker service SHALL build on the accepted NIP-46 foundation from `add-nip46-bunker-prototype`. Teams implementation SHALL NOT reintroduce a separate NIP-46 protocol stack unless the Phase 1 design decision is explicitly revised.

#### Scenario: Teams implementation reuses Phase 1 foundation

- **GIVEN** the NIP-46 bunker prototype has established the signer abstraction and encrypted request/response path
- **WHEN** Teams bunker implementation begins
- **THEN** it SHALL reuse the approved signer, client auth, and protocol boundaries
- **AND** document any deviation before code is written

### Requirement: Team Key Custody

Each team SHALL have a dedicated Nostr keypair managed by the Teams bunker. The team private key SHALL be encrypted at rest and SHALL never be returned to CLI, web, or team member clients.

#### Scenario: Team key generated on team creation

- **WHEN** a user creates a new team
- **THEN** the Teams bunker SHALL generate a fresh team keypair
- **AND** store the private key encrypted at rest
- **AND** return the team public key and connection information to the creator

#### Scenario: Team member cannot export raw team key

- **GIVEN** a member is authorized to use team secrets
- **WHEN** the member connects through NIP-46
- **THEN** the bunker SHALL allow only permitted signing/encryption/decryption operations
- **AND** SHALL NOT expose the raw team private key

### Requirement: Team NIP-46 Access

Team members SHALL access team secrets through NIP-46 requests to the Teams bunker. The bunker SHALL use the team key for permitted `sign_event`, `nip44_encrypt`, and `nip44_decrypt` operations.

#### Scenario: Member connects to team bunker

- **GIVEN** a team member has accepted an invitation or has an authorized Nostr pubkey
- **WHEN** the member connects to the team bunker
- **THEN** the bunker SHALL establish a session linked to that team member
- **AND** `get_public_key` SHALL return the team public key for team-secret operations

#### Scenario: Unauthorized client is rejected

- **GIVEN** a client pubkey is not associated with a team member or valid invite
- **WHEN** the client attempts to connect to the team bunker
- **THEN** the bunker SHALL reject the connection
- **AND** SHALL NOT execute signing or decryption requests for that client

### Requirement: Team Service Health

The Teams bunker service SHALL expose operational health information for managed and self-hosted deployments.

#### Scenario: Health check includes team-mode status

- **WHEN** a health check is requested
- **THEN** the service SHALL report running state, relay connectivity, team-mode availability, and active session counts without exposing secrets or private keys
