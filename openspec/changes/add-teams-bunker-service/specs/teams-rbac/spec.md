# Teams Role-Based Access Control

## ADDED Requirements

### Requirement: Built-in Team Roles

The system SHALL define four built-in roles with the following permission
matrix:

| Permission     | owner | admin | developer | readonly |
| -------------- | ----- | ----- | --------- | -------- |
| manageMembers  | yes   | yes   | no        | no       |
| manageRoles    | yes   | yes*  | no        | no       |
| manageProjects | yes   | yes   | no        | no       |
| readSecrets    | yes   | yes   | yes       | yes      |
| writeSecrets   | yes   | yes   | yes       | no       |
| deleteTeam     | yes   | no    | no        | no       |
| rotateTeamKey  | yes   | yes   | no        | no       |

*Admins can assign roles up to `admin` but cannot change the team owner.

#### Scenario: Developer can read and write secrets

- **GIVEN** user `alice` is a member of team `acme` with role `developer`
- **WHEN** `alice` requests to read secrets for project `api-keys` via NIP-46
- **THEN** the bunker SHALL sign the read operation
- **AND** when `alice` requests to write a new secret
- **THEN** the bunker SHALL sign the write operation

#### Scenario: Readonly member cannot write secrets

- **GIVEN** user `bob` is a member of team `acme` with role `readonly`
- **WHEN** `bob` requests to write a new secret via NIP-46
- **THEN** the bunker SHALL reject the signing request with a permission error

#### Scenario: Admin cannot delete the team

- **GIVEN** user `carol` is a member of team `acme` with role `admin`
- **WHEN** `carol` attempts to delete the team
- **THEN** the system SHALL reject the operation with a permission error

### Requirement: Role Assignment

Team owners and admins SHALL be able to assign roles to team members. The team
creator SHALL automatically receive the `owner` role. Admins SHALL be able to
assign any role except `owner`. Only the current owner SHALL be able to transfer
ownership.

#### Scenario: Owner assigns admin role

- **GIVEN** `alice` is the owner of team `acme`
- **AND** `bob` is a member with role `developer`
- **WHEN** `alice` changes `bob`'s role to `admin`
- **THEN** `bob`'s role SHALL be updated to `admin`
- **AND** an audit event SHALL be logged

#### Scenario: Admin cannot assign owner role

- **GIVEN** `carol` is an admin of team `acme`
- **AND** `dave` is a member with role `developer`
- **WHEN** `carol` attempts to change `dave`'s role to `owner`
- **THEN** the operation SHALL be rejected with a permission error

### Requirement: Permission Enforcement at Signing Layer

The bunker SHALL enforce RBAC permissions at the NIP-46 signing layer. Before
signing any event, the bunker SHALL verify that the requesting client's
associated team member has the required permissions for the operation. The
bunker SHALL map event kinds to permission categories:

- Kind 1059 (Gift Wrap for secrets): `readSecrets` for decrypt, `writeSecrets`
  for encrypt/publish
- Kind 5 (Deletion): `writeSecrets`
- Kind 30080 (Team metadata): `manageMembers`

#### Scenario: Bunker checks permission before signing

- **GIVEN** client `abc123` is associated with member `bob` (role: `readonly`)
- **WHEN** the bunker receives a `sign_event` request for a Kind 1059 event that
  publishes new secrets
- **THEN** the bunker SHALL check that `bob` has `writeSecrets` permission
- **AND** SHALL reject the request because `readonly` does not have
  `writeSecrets`

### Requirement: Team Membership Lifecycle

The system SHALL support the full membership lifecycle: invite, accept, update
role, and remove. When a member is removed, their access SHALL be revoked
immediately (active sessions invalidated, pubkey removed from authorized list).

#### Scenario: Member invited and joins team

- **GIVEN** `alice` is the owner of team `acme`
- **WHEN** `alice` invites `bob@company.com` with role `developer`
- **THEN** an invitation SHALL be created
- **AND** when `bob` authenticates via OAuth and accepts
- **THEN** `bob` SHALL be added to the team with role `developer`

#### Scenario: Removed member loses access immediately

- **GIVEN** `bob` is a member of team `acme` with an active NIP-46 session
- **WHEN** the team owner removes `bob`
- **THEN** `bob`'s session SHALL be invalidated immediately
- **AND** `bob`'s pubkey SHALL be removed from the authorized list
- **AND** subsequent signing requests from `bob` SHALL be rejected
- **AND** an audit event SHALL be logged
