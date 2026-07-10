# NIP-46 Bunker Prototype

## ADDED Requirements

### Requirement: External Implementation Vetting

Before implementing a custom NIP-46 signer server, the project SHALL vet existing bunker implementations and libraries. The design decision SHALL document whether Redshift will integrate, wrap, fork, test against, or reject each candidate.

#### Scenario: Existing implementations are evaluated before custom code

- **WHEN** work begins on the bunker prototype
- **THEN** the design doc SHALL evaluate at least `nostr-tools`, `nak bunker`, Signet, nsecbunkerd/nsecBunker, oauth-bunker, and FROSTR
- **AND** the selected implementation approach SHALL be recorded before signer-server code is written

#### Scenario: FROSTR is deferred unless explicitly approved

- **GIVEN** FROSTR offers threshold signing and distributed key custody
- **WHEN** Phase 1 implementation decisions are made
- **THEN** FROSTR SHALL be treated as future custody research
- **AND** SHALL NOT become a Phase 1 dependency without explicit approval and security review

### Requirement: Minimal NIP-46 Signer Process

Redshift SHALL provide a minimal local bunker prototype or a wrapper around a vetted implementation that exposes equivalent behavior. The signer SHALL support Redshift secret workflows without requiring the user's private key in the CLI process.

#### Scenario: Local bunker outputs a connection URI

- **WHEN** the user starts the local bunker prototype
- **THEN** Redshift SHALL generate or load the signer transport key and signing key
- **AND** output a `bunker://` URI containing the signer pubkey, relay URL, and connection secret

#### Scenario: Bunker status reports health

- **GIVEN** the local bunker prototype is running
- **WHEN** the user runs `redshift bunker status`
- **THEN** Redshift SHALL report running state, configured relays, signer pubkey, user/team pubkey, and connected client count when available

### Requirement: NIP-46 Encrypted Request Response

The bunker prototype SHALL exchange NIP-46 requests and responses using kind `24133` events with NIP-44 encrypted content. It SHALL implement the methods required by Redshift secret management: `connect`, `get_public_key`, `sign_event`, `nip44_encrypt`, `nip44_decrypt`, `ping`, and `switch_relays`.

#### Scenario: Authorized client connects

- **GIVEN** the bunker is listening on `wss://relay.example.com`
- **AND** the client presents a valid connection secret or is already authorized
- **WHEN** the bunker receives a NIP-44 encrypted kind `24133` `connect` request
- **THEN** the bunker SHALL respond with an encrypted acknowledgement
- **AND** establish a session for that client pubkey

#### Scenario: Client gets actual signing pubkey

- **GIVEN** a client has connected to the bunker
- **WHEN** the client sends `get_public_key`
- **THEN** the bunker SHALL return the user or prototype signing pubkey
- **AND** the client SHALL NOT assume this pubkey is the same as the transport signer pubkey

#### Scenario: Client signs a Redshift event

- **GIVEN** a client has an active authorized session
- **WHEN** the client sends `sign_event` with a JSON-stringified unsigned Redshift event
- **THEN** the bunker SHALL sign the event with the configured signing key
- **AND** return the signed event as the NIP-46 result

#### Scenario: Client encrypts and decrypts NIP-44 content

- **GIVEN** a client has an active authorized session
- **WHEN** the client sends `nip44_encrypt` or `nip44_decrypt`
- **THEN** the bunker SHALL perform the operation with the configured signing key
- **AND** return only the encrypted or decrypted result for that request

### Requirement: Prototype Security Caveats

The prototype SHALL document its security boundaries and limitations before being presented as Teams-ready infrastructure.

#### Scenario: Design doc explains limitations

- **WHEN** the prototype design doc is published
- **THEN** it SHALL state that Phase 1 does not include Teams RBAC, OAuth onboarding, managed hosting, audit logs, MLS/FROSTR threshold custody, or production key-recovery workflows
- **AND** it SHALL describe risks around local key storage, relay availability, permission scope, and signer compromise
