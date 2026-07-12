# Teams OAuth Bridge

## ADDED Requirements

### Requirement: OAuth Provider Integration

The bunker service SHALL support OAuth 2.0 authentication with Google and GitHub
as identity providers. Each provider SHALL implement the Authorization Code flow
with PKCE. Additional providers (Microsoft, Apple) MAY be added in future
phases.

#### Scenario: User authenticates with Google OAuth

- **GIVEN** Google OAuth is configured with valid `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET`
- **WHEN** a user navigates to `/auth/google`
- **THEN** the service SHALL redirect to Google's OAuth consent screen
- **AND** on successful authentication, SHALL receive the user's email and
  subject identifier

#### Scenario: User authenticates with GitHub OAuth

- **GIVEN** GitHub OAuth is configured with valid `GITHUB_CLIENT_ID` and
  `GITHUB_CLIENT_SECRET`
- **WHEN** a user navigates to `/auth/github`
- **THEN** the service SHALL redirect to GitHub's OAuth authorization page
- **AND** on successful callback, SHALL receive the user's email and GitHub user
  ID

#### Scenario: Unconfigured provider returns error

- **GIVEN** Microsoft OAuth credentials are NOT configured
- **WHEN** a user navigates to `/auth/microsoft`
- **THEN** the service SHALL return a 404 or appropriate error indicating the
  provider is not available

### Requirement: OAuth-to-Nostr Key Derivation

The bunker SHALL derive a deterministic Nostr keypair for team members who
authenticate via OAuth and do not have existing Nostr keys. Key derivation SHALL
use HKDF-SHA256 with the bunker's master seed, team ID as salt, and the OAuth
provider's stable subject identifier as info material.

#### Scenario: Derived keypair is deterministic

- **GIVEN** master seed `0xabc...`, team ID `team-1`, OAuth subject
  `google|12345`
- **WHEN** the key derivation function is called twice with the same inputs
- **THEN** the same Nostr keypair SHALL be produced both times

#### Scenario: Different OAuth subjects produce different keys

- **GIVEN** the same master seed and team ID
- **WHEN** keys are derived for OAuth subject `google|12345` and `google|67890`
- **THEN** the resulting Nostr keypairs SHALL be different

#### Scenario: Different teams produce different keys for same user

- **GIVEN** the same master seed and OAuth subject
- **WHEN** keys are derived for team `team-1` and team `team-2`
- **THEN** the resulting Nostr keypairs SHALL be different

### Requirement: Existing Nostr Identity Support

The system SHALL allow team members who already have a Nostr identity (via
NIP-07 browser extension, their own bunker, or nsec) to join a team using their
existing pubkey without going through OAuth. The team bunker SHALL authorize
their pubkey directly.

#### Scenario: Member joins with existing npub

- **GIVEN** a team `team-1` exists
- **AND** user has Nostr pubkey `npub1existing...`
- **WHEN** the team owner invites `npub1existing...`
- **THEN** the pubkey SHALL be added to the authorized list
- **AND** the user SHALL be able to connect via NIP-46 using their own client
  key

### Requirement: OAuth Session Management

After successful OAuth authentication, the bunker SHALL create a web session
(HTTP-only cookie) that identifies the authenticated user. Sessions SHALL expire
after a configurable timeout (default: 7 days). The service SHALL provide a
`/api/me` endpoint returning the current user's info and a `/api/logout`
endpoint to end the session.

#### Scenario: Session created after OAuth callback

- **GIVEN** a user completes Google OAuth authentication
- **WHEN** the callback is processed successfully
- **THEN** the service SHALL set an HTTP-only session cookie
- **AND** redirect the user to the identity picker or team dashboard

#### Scenario: Expired session requires re-authentication

- **GIVEN** a user's session has expired
- **WHEN** the user accesses `/api/me`
- **THEN** the service SHALL return 401 Unauthorized
