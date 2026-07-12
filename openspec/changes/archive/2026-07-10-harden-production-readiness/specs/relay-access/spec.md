## ADDED Requirements

### Requirement: Strict Event Integrity
The managed relay SHALL validate canonical event field bounds, recompute the NIP-01 event ID, require exact lowercase equality with the supplied ID, and verify the signature against that ID before storage, authorization, payment, or broadcast.

#### Scenario: Mismatched supplied ID
- **WHEN** a valid signature accompanies an arbitrary event ID
- **THEN** the relay rejects the event

### Requirement: Immutable Authenticated Principal
A WebSocket SHALL bind one authenticated principal after strict NIP-42 AUTH using the exact challenge, normalized relay URL, bounded timestamp, exact event ID, and valid signature; it SHALL reject rebinding to another key.

#### Scenario: Principal switch
- **WHEN** an authenticated socket submits AUTH for a different pubkey
- **THEN** the relay rejects it and retains the original principal

### Requirement: Recipient-Scoped Paid Gift Wrap Access
For Redshift kind 1059 writes, the relay SHALL verify the ephemeral outer event while using its sole canonical Redshift `p` recipient as authenticated/paid principal. Reads SHALL require a paid authenticated principal and filters explicitly constrained to kind 1059, the same sole `#p`, and the Redshift type tag. Direct kind 30078 SHALL be rejected.

#### Scenario: Paid recipient write
- **WHEN** a valid ephemeral-authored Gift Wrap targets the authenticated paid recipient
- **THEN** the relay accepts it

#### Scenario: Cross-recipient write
- **WHEN** a socket authenticated as one principal publishes a Gift Wrap for another recipient
- **THEN** the relay rejects it

#### Scenario: Broad read
- **WHEN** a paid authenticated principal sends a broad, mixed-kind, missing-recipient, or wrong-recipient filter
- **THEN** the relay closes/rejects the subscription

### Requirement: Shared Identity Quotas
Event, request, crypto-work, and active-connection limits SHALL be shared by authenticated identity across sockets and SHALL survive hibernation/reconstruction. Pre-authentication work SHALL have a bounded secondary limit.

#### Scenario: Parallel sockets
- **WHEN** two sockets for one identity consume the same operation quota
- **THEN** aggregate work is limited by one shared bucket

### Requirement: Explicit Publish Quorum
Clients SHALL publish once per relay, retry only failed relays with the same event, require majority quorum by default, and return or throw a typed per-relay report.

#### Scenario: Degraded success
- **WHEN** quorum accepts but one relay fails
- **THEN** the operation succeeds with an explicit degraded report

#### Scenario: Partial failure below quorum
- **WHEN** one relay accepted but quorum was not achieved
- **THEN** the operation fails with the accepted relay and event ID preserved in its report

### Requirement: Validated Relay Ingestion
Every global, project, environment, bunker, and runtime relay URL SHALL be normalized, deduplicated, and validated at ingestion and again at transport creation. Only `wss://` and loopback `ws://` are allowed.

#### Scenario: Remote plaintext relay
- **WHEN** a configuration contains remote `ws://`, HTTP, credentials, malformed input, or an excessive list
- **THEN** configuration fails closed

### Requirement: Bounded Bunker Work
The local bunker SHALL bound serialized event size, age, method/parameter size, queue depth, concurrent crypto, pre-verification rate, and per-client post-verification rate, and SHALL use resilient relay transport.

#### Scenario: Oversized or stale request
- **WHEN** a stale or oversized kind 24133 event arrives
- **THEN** it is rejected without invoking decrypt/sign/publish work
