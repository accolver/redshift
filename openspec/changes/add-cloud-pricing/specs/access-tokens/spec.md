# Access Tokens

## ADDED Requirements

### Requirement: Token Generation

The system SHALL generate cryptographically signed access tokens for Cloud
subscribers using NIP-78 (Kind 30078).

#### Scenario: Generate token after payment

- **WHEN** a subscription payment is confirmed
- **THEN** the system generates an access token event containing:
  - Kind: 30078 (NIP-78 arbitrary app data)
  - d-tag: "com.redshiftapp.access-token" (reverse-DNS for global uniqueness)
  - User's Nostr pubkey
  - Tier: "cloud"
  - Issue timestamp
  - Expiration timestamp (30 days from issue)
  - BTCPay invoice ID reference
  - Relay operator signature in content
- **AND** wraps it with NIP-59 Gift Wrap to the user's pubkey

#### Scenario: Token stored as Nostr event

- **WHEN** an access token is generated
- **THEN** the system publishes it as a Kind 30078 event
- **AND** includes `["t", "redshift-cloud"]` tag for filtering
- **AND** publishes to the managed Nosflare relay

### Requirement: Token Validation

The system SHALL validate access tokens on relay connection.

#### Scenario: Valid token grants access

- **WHEN** a client connects to the managed relay with NIP-42 AUTH
- **AND** the relay finds a valid Kind 30078 token with d-tag
  "com.redshiftapp.access-token" for that pubkey
- **THEN** the client is granted full read/write access

#### Scenario: Invalid signature rejected

- **WHEN** a token has an invalid relay operator signature in its content
- **THEN** the relay rejects the connection
- **AND** returns an error message indicating invalid subscription

#### Scenario: Expired token rejected

- **WHEN** a token's expiration timestamp is in the past
- **THEN** the relay rejects write access
- **AND** allows read-only access to existing events
- **AND** returns a message indicating subscription expired

#### Scenario: Missing token handled

- **WHEN** no valid token exists for a connecting pubkey
- **THEN** the relay rejects the connection for non-subscribers
- **AND** returns a message directing user to subscription page

### Requirement: Token Refresh

The system SHALL support token refresh before expiration.

#### Scenario: Auto-refresh on renewal

- **WHEN** a subscriber's payment renews before expiration
- **THEN** the system generates a new token with updated expiration
- **AND** publishes it to the managed relay (replaces old token via d-tag)

#### Scenario: CLI token caching

- **WHEN** the CLI fetches an access token from the relay
- **THEN** the token is cached in local config
- **AND** used for offline validation until refresh needed

### Requirement: Token Revocation

The system SHALL support token revocation for security purposes.

#### Scenario: Manual token revocation

- **WHEN** an administrator revokes a user's token
- **THEN** the system publishes a new token with immediate expiration
- **AND** the relay rejects the old token on next validation

### Requirement: Token Schema (NIP-78 Compatible)

The access token SHALL conform to NIP-78 event schema for ecosystem
compatibility.

#### Scenario: Token event structure

- **WHEN** an access token is created
- **THEN** the inner rumor (before NIP-59 wrapping) contains:
  - kind: 30078 (NIP-78 arbitrary app data)
  - pubkey: user's pubkey
  - tags: `["d", "com.redshiftapp.access-token"]` (reverse-DNS for global
    uniqueness), `["t", "redshift-cloud"]`, `["tier", "cloud"]`,
    `["expires", timestamp]`, `["invoice", invoiceId]`
  - content: JSON with issuedAt, relayUrl, and relayOperatorSignature
