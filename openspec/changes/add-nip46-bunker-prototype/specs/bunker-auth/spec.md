## ADDED Requirements
### Requirement: NIP-46 Bunker Prototype
The CLI SHALL include a preview local bunker protocol core that can create a NIP-46 bunker pointer and handle encrypted NIP-46 request/response events without exposing the signer private key to clients.

#### Scenario: Create bunker pointer
- **WHEN** a local signer key and relay list are provided
- **THEN** the system returns a `bunker://` URL containing the signer public key and relays but not the private key material

#### Scenario: Handle public key request
- **WHEN** a client sends an encrypted NIP-46 `get_public_key` request event
- **THEN** the bunker returns an encrypted response containing the signer public key

#### Scenario: Enforce signing policy
- **WHEN** a client requests signing for an event kind outside the Redshift allowlist
- **THEN** the bunker returns an encrypted error response instead of signing the event
