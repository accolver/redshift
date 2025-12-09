# Audit Logging

## ADDED Requirements

### Requirement: Audit Event Generation

The system SHALL generate audit events for secret operations by Cloud
subscribers using NIP-78 (Kind 30078).

#### Scenario: Secret creation logged

- **WHEN** a Cloud subscriber creates a new secret
- **THEN** the system generates a Kind 30078 audit event with action
  "secret:create"
- **AND** encrypts the event content with NIP-44 to the user's key
- **AND** publishes to the managed Nosflare relay

#### Scenario: Secret update logged

- **WHEN** a Cloud subscriber updates an existing secret
- **THEN** the system generates a Kind 30078 audit event with action
  "secret:update"

#### Scenario: Secret deletion logged

- **WHEN** a Cloud subscriber deletes a secret
- **THEN** the system generates a Kind 30078 audit event with action
  "secret:delete"

#### Scenario: Secret read logged

- **WHEN** a Cloud subscriber reads secrets (via CLI run command)
- **THEN** the system generates a Kind 30078 audit event with action
  "secret:read"

### Requirement: Audit Event Schema (NIP-78 Compatible)

Audit events SHALL conform to NIP-78 event schema for ecosystem compatibility.

#### Scenario: Audit event structure

- **WHEN** an audit event is created
- **THEN** the inner rumor (before NIP-59 wrapping) contains:
  - kind: 30078 (NIP-78 arbitrary app data)
  - pubkey: user's pubkey
  - tags: `["d", "redshift-audit-{timestamp}"]`, `["t", "redshift-audit"]`,
    `["action", actionType]`, `["target", projectId]`
  - content: NIP-44 encrypted JSON with operation details

### Requirement: Audit Log Viewer

The system SHALL provide a web interface for viewing audit logs.

#### Scenario: View audit logs in web admin

- **WHEN** a Cloud subscriber visits `/admin/settings/audit-logs`
- **THEN** the system fetches Kind 30078 events with `["t", "redshift-audit"]`
  tag for their pubkey
- **AND** decrypts and displays the audit log entries
- **AND** shows action, target, and timestamp for each entry

#### Scenario: Filter audit logs by action

- **WHEN** a user selects an action filter (e.g., "secret:create")
- **THEN** the audit log view shows only matching entries

#### Scenario: Filter audit logs by date range

- **WHEN** a user selects a date range filter
- **THEN** the audit log view shows only entries within that range

### Requirement: Audit Log Retention

The system SHALL enforce 7-day retention for Cloud tier audit logs.

#### Scenario: Logs older than 7 days expired

- **WHEN** an audit event is older than 7 days
- **THEN** the Nosflare relay expires/deletes the event via NIP-40
- **AND** the event is no longer returned in queries

#### Scenario: Retention policy displayed

- **WHEN** a user views the audit log page
- **THEN** the page displays a notice: "Audit logs are retained for 7 days"

### Requirement: Audit Log API

The system SHALL provide an API endpoint for fetching audit logs.

#### Scenario: Fetch audit logs via API

- **WHEN** the backend receives `GET /api/audit-logs/:pubkey`
- **THEN** the system queries Kind 30078 events with `["t", "redshift-audit"]`
  for that pubkey
- **AND** returns the encrypted events (client decrypts)

#### Scenario: Paginated audit log results

- **WHEN** the API request includes `limit` and `from` parameters
- **THEN** the response includes only the requested page of results
- **AND** includes pagination metadata

### Requirement: Subscription Event Logging

The system SHALL log subscription lifecycle events.

#### Scenario: Subscription start logged

- **WHEN** a user completes their first subscription payment
- **THEN** the system generates an audit event with action "subscription:start"

#### Scenario: Subscription renewal logged

- **WHEN** a subscription payment renews
- **THEN** the system generates an audit event with action "subscription:renew"

#### Scenario: Subscription cancellation logged

- **WHEN** a user cancels their subscription
- **THEN** the system generates an audit event with action "subscription:cancel"
