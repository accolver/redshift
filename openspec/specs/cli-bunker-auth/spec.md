# cli-bunker-auth Specification

## Purpose
Define secure signer-based CLI authentication and NIP-46 reconnection without placing long-lived private keys in plaintext configuration.
## Requirements
### Requirement: Signer-Based CLI Authentication

The CLI SHALL support authentication through a signer abstraction that works with both local nsec keys and NIP-46 bunker signers. Existing secret commands SHALL NOT require direct private key access when a connected signer can provide `sign_event`, `nip44_encrypt`, and `nip44_decrypt`.

#### Scenario: Existing nsec workflow remains unchanged

- **GIVEN** a user is authenticated with local nsec auth
- **WHEN** the user runs `redshift secrets set API_KEY abc123`
- **THEN** the CLI SHALL sign, encrypt, publish, fetch, and decrypt secrets exactly as before
- **AND** no bunker connection SHALL be required

#### Scenario: Bunker auth works for secret listing

- **GIVEN** the user has logged in through hidden bunker input
- **AND** the stored bunker client key is available in the OS keychain
- **WHEN** the user runs `redshift secrets`
- **THEN** the CLI SHALL reconnect to the bunker
- **AND** request NIP-44 decryption through the signer
- **AND** display secrets without requiring a local nsec

#### Scenario: Bunker auth works for writing secrets

- **GIVEN** the user has logged in with bunker auth
- **WHEN** the user runs `redshift secrets set API_KEY abc123`
- **THEN** the CLI SHALL create the Redshift NIP-59 Gift Wrap using signer-backed encryption
- **AND** request event signing through NIP-46
- **AND** publish the resulting event to configured relays

### Requirement: Bunker Login and Reconnection

The CLI SHALL support both `bunker://` login and client-initiated Nostr Connect pairing. Bunker client secret keys SHALL be stored only in the system keychain for persistent login. If secure storage is unavailable, login SHALL fail closed and direct users to command-scoped authentication.

#### Scenario: Login with bunker URI

- **WHEN** the user runs `redshift login --bunker-stdin` and provides a secret-bearing pairing URI through hidden input
- **THEN** the CLI SHALL connect to the remote signer using NIP-46
- **AND** call `get_public_key` to learn the user's actual signing pubkey
- **AND** reject the same secret-bearing URI if passed through process argv
- **AND** store reconnection metadata without storing the user's private key

#### Scenario: Login with Nostr Connect pairing

- **WHEN** the user runs `redshift login --connect`
- **THEN** the CLI SHALL generate a `nostrconnect://` URI with requested Redshift permissions
- **AND** wait for the signer to approve the connection
- **AND** validate the returned connection secret before storing auth metadata

#### Scenario: Auth challenge URL is shown

- **GIVEN** the remote signer returns an auth challenge
- **WHEN** the CLI receives a NIP-46 response with `result: "auth_url"`
- **THEN** the CLI SHALL print the URL for the user
- **AND** keep waiting for the final response with the same request ID

### Requirement: Bunker Environment Auth

The CLI SHALL support `REDSHIFT_BUNKER` for CI/CD and non-interactive environments. Environment bunker auth SHALL avoid storing persistent credentials unless explicitly requested by a command.

#### Scenario: CI uses REDSHIFT_BUNKER

- **GIVEN** `REDSHIFT_BUNKER` is set to a valid bunker URI
- **WHEN** a CI job runs `redshift run -- npm test`
- **THEN** the CLI SHALL connect to the bunker for signing/decryption
- **AND** inject secrets into the child process without requiring `REDSHIFT_NSEC`

