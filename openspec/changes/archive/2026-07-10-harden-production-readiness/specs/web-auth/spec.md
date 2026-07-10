## ADDED Requirements

### Requirement: Capability-Gated Browser Authentication
The web app SHALL complete NIP-07 secret-management login only when the extension supplies getPublicKey/signing and callable NIP-44 encrypt and decrypt capabilities, and SHALL present bunker/nsec alternatives otherwise.

#### Scenario: Signing-only extension
- **WHEN** an installed extension lacks either NIP-44 operation
- **THEN** authentication remains disconnected and the UI explains the limitation

### Requirement: Sanitized Bunker Restoration
The web app SHALL persist only a versioned bunker pubkey/relay pointer and separately protected local client credential. It SHALL never persist a one-time `secret=` value and SHALL sanitize or remove legacy records before reconnecting.

#### Scenario: First pairing
- **WHEN** a bunker URI contains a one-time pairing secret
- **THEN** connection may use it once but persisted restoration state omits it

#### Scenario: Legacy record
- **WHEN** a legacy secret-bearing URI is restored
- **THEN** it is sanitized and overwritten before reconnect or removed on migration failure

### Requirement: Full Logout Storage Destruction
Full logout/account switch SHALL remove Redshift session ciphertext and its IndexedDB CryptoKey while ordinary relay reconnect SHALL retain the authenticated session.

#### Scenario: Full logout
- **WHEN** the user logs out
- **THEN** restored old ciphertext cannot be decrypted with retained browser key state

### Requirement: Safe External Content
External blog/CMS HTML SHALL cross one audited sanitizer boundary and JSON-LD SHALL use script-safe escaping before insertion into HTML.

#### Scenario: Malicious article
- **WHEN** article content contains scripts, event handlers, dangerous URLs, SVG/script, CSS escapes, or closing script sequences
- **THEN** executable content is removed or escaped while approved markup remains

### Requirement: Restrictive Executable Policy
Hosted, embedded, and relay pages SHALL execute only self-hosted pinned scripts authorized by exact hashes or cryptographic nonces and SHALL not use broad `script-src 'unsafe-inline'` on secret-handling origins.

#### Scenario: Compiled embedded dashboard
- **WHEN** `redshift serve` serves compiled Svelte assets
- **THEN** hydration completes with zero CSP violations and controls are interactive

#### Scenario: Modified inline code
- **WHEN** inline executable content lacks the expected nonce/hash
- **THEN** the browser blocks it

### Requirement: Validated Runtime Relay Configuration
The embedded dashboard SHALL inherit validated CLI/project relay configuration through nonce-protected runtime data and its CSP SHALL allow only the exact configured relay origins.

#### Scenario: Custom local relay
- **WHEN** CLI configuration names a validated local relay
- **THEN** the embedded dashboard can connect without wildcard WebSocket policy
