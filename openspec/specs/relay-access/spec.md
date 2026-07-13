# relay-access Specification

## Purpose
Define relay event integrity, authenticated access, quota, quorum, ingestion, and bounded NIP-46 transport requirements.
## Requirements
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

### Requirement: Recipient-Scoped Gift Wrap Access
For Redshift kind 1059 writes, the relay SHALL verify the ephemeral outer event while using its sole canonical Redshift `p` recipient as the authenticated principal. Reads SHALL require that authenticated principal and filters explicitly constrained to kind 1059, the same sole `#p`, and the Redshift type tag. Direct kind 30078 SHALL be rejected. The development candidate SHALL keep payment enforcement, payment endpoints, fees, and paid-service metadata disabled unless a separately approved commercial change is implemented.

#### Scenario: Authenticated recipient write
- **WHEN** a valid ephemeral-authored Gift Wrap targets the authenticated recipient
- **THEN** the relay accepts it without requiring an unapproved payment record

#### Scenario: Cross-recipient write
- **WHEN** a socket authenticated as one principal publishes a Gift Wrap for another recipient
- **THEN** the relay rejects it

#### Scenario: Broad read
- **WHEN** an authenticated principal sends a broad, mixed-kind, missing-recipient, or wrong-recipient filter
- **THEN** the relay closes/rejects the subscription

#### Scenario: Commercial mode is unapproved
- **WHEN** the candidate serves NIP-11 metadata, its landing page, or HTTP routes
- **THEN** it omits payment fees, payment URLs, payment controls, and active payment endpoints

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

### Requirement: Classified Per-Relay Outcomes
Every publication SHALL classify each normalized relay's final state as accepted, permanently rejected, or temporarily unavailable while preserving the exact event ID, quorum threshold, reasons, and compatibility accepted/failed fields.

#### Scenario: Mixed quorum success
- **WHEN** two relays accept, one permanently rejects, and one is unavailable while the threshold is two
- **THEN** publication succeeds as degraded and the report identifies every relay's classified state

#### Scenario: Confirmed duplicate event
- **WHEN** a retry receives a `duplicate` response and a bounded same-relay ID query returns the byte-identical valid event
- **THEN** the relay is classified as accepted

#### Scenario: Unconfirmed duplicate event
- **WHEN** a relay reports `duplicate` but the same-relay query is missing, mismatched, invalid, or times out
- **THEN** the relay remains unavailable and Redshift does not claim acceptance

#### Scenario: Typed permanent and transient reasons
- **WHEN** NIP-20 reasons use exact known prefixes
- **THEN** `invalid`, `pow`, `blocked`, and `restricted` are permanent; `rate-limited` and `error` are unavailable; and unknown or misleading text is unavailable

### Requirement: Immutable Publication Retry
Recovery SHALL retry the exact previously signed event only against relays classified unavailable, SHALL merge outcomes deterministically by normalized relay, and SHALL never retry a permanent rejection automatically.

#### Scenario: Retry after outage
- **WHEN** an unavailable relay recovers and the user retries a pending publication
- **THEN** that relay receives the identical event ID and its outcome becomes accepted without creating a new logical version

#### Scenario: Permanent rejection remains
- **WHEN** a record contains one restricted relay and one unavailable relay
- **THEN** retry attempts only the unavailable relay and preserves the restricted result for inspection

