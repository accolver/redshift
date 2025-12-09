# Project Context

## Purpose

**Redshift** is a decentralized, censorship-resistant secret management platform
that empowers developers with sovereign control over their application secrets.
No third party can access, revoke, or compromise sensitive data.

### Goals

- Replicate the developer experience (DX) of **Doppler** while using Nostr for
  decentralized storage
- Ensure all encryption happens client-side - secrets are never stored in
  plaintext on any server
- Provide a single-binary CLI with embedded web admin UI
- Support unlimited projects and secrets for free (monetize convenience, not
  access)

### Beneficiaries

- Individual developers seeking complete ownership without vendor lock-in
- Open-source maintainers needing secure, decentralized secret management
- Teams requiring collaborative secret management with cryptographic access
  control
- Privacy-conscious developers wanting secrets beyond centralized provider reach

## Tech Stack

### Languages & Runtime

- **TypeScript** (strict mode) - Primary language for all code
- **Bun** - Runtime and build tool
- **Single binary** - Built via `bun build --compile`

### Frontend (Web Admin)

- **SvelteKit 5** with Runes (`$state`, `$derived`, `$effect`)
- **SPA mode** for admin app, **static generation** for docs/landing pages
- **shadcn-svelte** (v1.0+) - UI component library
- **svelte-motion** - Animations
- **Tailwind v4** - Styling with Tokyo Night Storm theme
- **lucide-svelte** - Icons

### Backend/CLI

- **Bun native** APIs
- **util.parseArgs** - CLI argument parsing
- **Bun.serve** - HTTP server for embedded admin UI

### Nostr Protocol

- **nostr-tools** - Signing, encryption, relay protocol
- **applesauce-core** - EventStore patterns (web)
- **applesauce-relay** - Relay connections (web)
- **@redshift/crypto** - Shared NIP-59 Gift Wrap package

### Testing

- **bun:test** - CLI tests
- **vitest** - Web tests
- **@testing-library/svelte** - Component testing

## Project Conventions

### Code Style

1. **No `any` type** - Always define proper TypeScript types
2. **Implicit return types** - Let TypeScript infer unless:
   - Function is part of a public API
   - Inferred type is too complex
   - Need to enforce specific return type contract
3. **Transitions** - Add `transition` class to elements with hover/animation
4. **Tokyo Night Storm theme** - Use color tokens: `tokyo-blue`, `tokyo-purple`,
   `tokyo-cyan`, `tokyo-green`, `tokyo-orange`, `tokyo-red`

### Code Display Components

- `InlineCode` (`$lib/components/InlineCode.svelte`) - Inline code snippets
- `CodeBlock` (`$lib/components/CodeBlock.svelte`) - Larger code blocks

### Architecture Patterns

#### Monorepo Structure

```
cli/           # Bun CLI application
web/           # SvelteKit web admin
packages/
  crypto/      # @redshift/crypto - Shared NIP-59 Gift Wrap
```

**Rule**: Code used by both CLI and Web MUST live in `/packages/`. If
duplicating code between `cli/` and `web/`, STOP and extract to a shared
package.

#### Applesauce Data Flow (Web)

1. **EventStore** - Single source of truth for all Nostr events
2. **RelayPool** - Manages relay connections, pipes events to EventStore
3. **Models** - Use `eventStore.model()` for reactive UI subscriptions
4. **EventFactory** - Create events with blueprints

#### Event Structure

- **Kind 30078** - Arbitrary Custom App Data (inner rumor)
- **d-tag format**: `{projectSlug}|{environment}` (pipe-separated)
- **Gift Wrap type tag**: `["t", "redshift-secrets"]` on outer envelope

#### Error Handling

Use typed errors from `cli/src/lib/errors.ts`:

- `RelayError` - Connection/query/publish failures
- `DecryptionError` - NIP-59 unwrap failures
- `AuthError` - Authentication issues
- `ConfigError` - Missing/invalid configuration
- `NotConnectedError` - Operation requires relay connection

**Rules**:

- Never return empty array on query failure - throw `RelayError`
- Use `isRetryableError()` for retry logic
- Use `formatError()` for user-facing messages
- Empty catch blocks OK only when decrypting Gift Wraps in loops

### Testing Strategy

**Test-Driven Development (TDD)** - Write tests first, then implement.

- CLI tests: `cli/tests/` - Run with `bun test` in `cli/`
- Web tests: `web/tests/` - Run with `bun test` in `web/`
- Coverage: 580+ total tests (273 web, 311 CLI)

#### TDD Phases

1. **Cryptographic Core** - NIP-59 Gift Wrap, secret manager
2. **CLI Engine** - Command parsing, secret injection
3. **Svelte UI** - Component rendering, state management
4. **Integration** - Binary spawning, HTTP responses

### Git Workflow

- **Release Please** - Automated versioning and changelog
- **Conventional Commits** - `feat:`, `fix:`, `chore:`, etc.
- **CI/CD** - GitHub Actions for test, build, multi-platform release

## Domain Context

### Nostr Protocol Knowledge

- **NIP-59 (Gift Wrap)** - Sealed, wrapped events for encrypted storage
- **NIP-09 (Deletion)** - Kind 5 deletion requests
- **NIP-07** - Browser extension signing (Alby, nos2x)
- **NIP-46** - Remote signer (Bunker)
- **NIP-44** - ChaCha20-Poly1305 encryption

### Secret Storage Model

- One Nostr identity (npub) manages unlimited **Projects**
- Each Project has unlimited **Environments** (dev, stg, prod)
- A Project+Environment pair = single **Replaceable Event** inside Gift Wrap
- Updates: New Gift Wrap with same d-tag, newer `created_at`
- Deletion: Kind 5 + tombstone event (empty content `{}`)

### Project Schema

```typescript
interface Project {
  id: string; // Internal UUID (for event d-tags)
  slug: string; // Immutable, CLI-friendly (lowercase, hyphens)
  displayName: string; // Human-readable (can be renamed)
  environments: Environment[];
  createdAt: number;
}
```

### Authentication Methods (Priority Order)

1. **NIP-07 Browser Extension** - Most secure, keys never leave extension
2. **NIP-46 Bunker** - Remote signer, good for CI/CD
3. **Local NSEC** - Stored in `~/.redshift/config` or system keychain

## Important Constraints

### Ethical Constraints (L9 Telos Guardian)

- **User Privacy** - Never store or transmit unencrypted secrets
- **No Surveillance** - No telemetry or analytics identifying users
- **Open Source** - Core functionality remains open and auditable
- **No Lock-in** - Export/migrate data anytime via standard Nostr protocols
- **No Backdoors** - Never implement backdoors or key escrow

### Technical Constraints

- **Rate Limiting Required** - All relay operations use `RateLimiter` class
- **Gift Wrap Type Tag** - All secrets use `["t", "redshift-secrets"]`
- **Prefer Existing Libraries** - Check nostr-tools, applesauce-\* before
  implementing primitives
- **Shared Packages** - No code duplication between CLI and Web

### Business Constraints

- **CLI remains fully free** - No premium commands or paywalled features
- **Self-hosting always works** - Paid tiers add convenience, not capability
- **Export always available** - Users can leave with their data anytime
- **Client-side encryption only** - We never have access to decrypt secrets

## External Dependencies

### Nostr Relays

- Public relays for free tier (user-configurable)
- Redshift Cloud managed relay for paid tier ($5/month)

### Key Libraries

| Functionality     | Library                                            |
| ----------------- | -------------------------------------------------- |
| Event signing     | `nostr-tools`                                      |
| NIP-44 encryption | `nostr-tools`                                      |
| Relay connections | `nostr-tools/pool` (CLI), `applesauce-relay` (Web) |
| Gift Wrap         | `@redshift/crypto` (wraps nostr-tools)             |
| Event storage     | `applesauce-core` EventStore (Web only)            |

### CI/CD

- **GitHub Actions** - Test, build, release workflows
- **Release Please** - Automated versioning
- **Multi-platform binaries** - Linux/macOS x64/arm64

### Planned Integrations (Paid Tiers)

- **BTCPay Server** - Bitcoin/Lightning payments
- **nak bunker** - Bunker orchestrator for Teams
- **OpenMLS** - MLS group encryption for Teams (NIP-EE)
- **OIDC providers** - Okta, AzureAD, Google for Enterprise SSO

## Telos Framework

This project uses the **9-level Telos Framework** for purpose-driven
development. See `.telos/TELOS.md` for the complete hierarchy.

### Key Levels

| Level | Agent                  | Responsibility                          |
| ----- | ---------------------- | --------------------------------------- |
| L9    | Telos-Guardian         | Ultimate purpose: user sovereignty      |
| L8    | Market-Analyst         | Business value: free tier + paid tiers  |
| L7    | Insight-Synthesizer    | Product strategy: Doppler-compatible DX |
| L6    | UX-Simulator           | Tokyo Night theme, minimalist design    |
| L5    | Journey-Validator      | User workflows: login → edit → run      |
| L4    | Integration-Contractor | NIP-59, NIP-09, Kind 30078 contracts    |
| L3    | Component-Architect    | Svelte 5 + shadcn-svelte components     |
| L2    | Function-Author        | TDD with bun:test                       |
| L1    | Syntax-Linter          | Strict TypeScript, Bun-native tooling   |

**Validation Rule**: Before significant changes, run bidirectional validation
(L9→L1→L9). Both flows must converge before proceeding.
