# Teams Audit Logging

## ADDED Requirements

### Requirement: Audit Event Generation

The bunker SHALL generate audit events for all significant team operations. Each
audit event SHALL be a signed Nostr event (Kind 30079) containing the action,
actor pubkey, target, timestamp, and relevant metadata. Audit events SHALL be
encrypted to the team key so only team members can read them.

#### Scenario: Secret read generates audit event

- **GIVEN** developer `alice` reads secrets for project `api` on team `acme`
- **WHEN** the bunker processes the NIP-46 decrypt request
- **THEN** the bunker SHALL create a Kind 30079 event with:
  - `["d", "<team_id>"]` tag
  - `["action", "secret:read"]` tag
  - `["target", "api|prod"]` tag
  - Content: encrypted JSON with actor pubkey and timestamp

#### Scenario: Member removal generates audit event

- **GIVEN** admin `bob` removes member `carol` from team `acme`
- **WHEN** the removal is processed
- **THEN** the bunker SHALL create a Kind 30079 event with:
  - `["action", "member:remove"]` tag
  - `["target", "<carol_pubkey>"]` tag
  - Content: encrypted JSON with actor, target, and reason

### Requirement: Audit Log Retention

Audit logs SHALL be retained for a minimum of 90 days for the Teams tier. Logs
older than the retention period MAY be pruned from the local SQLite database.
Logs published to Nostr relays SHALL follow relay retention policies.

#### Scenario: Logs older than 90 days are prunable

- **GIVEN** the audit log contains events from 100 days ago
- **WHEN** the retention cleanup runs
- **THEN** events older than 90 days MAY be removed from local storage
- **AND** events within the 90-day window SHALL be preserved

### Requirement: Audit Log Query API

The bunker SHALL provide an API endpoint (`GET /api/teams/:id/audit`) for
querying audit logs. The endpoint SHALL support filtering by action type, date
range, and actor. The endpoint SHALL require team membership with at least
`readSecrets` permission.

#### Scenario: Query audit logs by action type

- **GIVEN** team `acme` has 50 audit events of various types
- **WHEN** an admin queries `GET /api/teams/acme/audit?action=member:remove`
- **THEN** the response SHALL contain only audit events with action
  `member:remove`
- **AND** events SHALL be sorted by timestamp descending

#### Scenario: Unauthorized user cannot query audit logs

- **GIVEN** user `eve` is NOT a member of team `acme`
- **WHEN** `eve` queries `GET /api/teams/acme/audit`
- **THEN** the response SHALL be 403 Forbidden
