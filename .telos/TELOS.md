# Telos: Ultimate Purpose

## Ultimate Purpose

Empower developers with sovereign, censorship-resistant control over their
application secrets, ensuring no third party can access, revoke, or compromise
their sensitive data.

## Beneficiaries

- **Individual developers** seeking complete ownership of their secrets without
  vendor lock-in
- **Open-source maintainers** who need secure, decentralized secret management
- **Teams and organizations** requiring collaborative secret management with
  cryptographic access control
- **Privacy-conscious developers** who want their secrets beyond the reach of
  centralized providers

## Measurable Impact

- **Adoption**: Number of active users managing secrets through Redshift
- **Sovereignty**: Zero secrets stored in plaintext on any server; all
  encryption client-side
- **Availability**: Secrets accessible from any Nostr relay without single point
  of failure
- **DX Parity**: CLI command compatibility with Doppler (drop-in replacement)
- **Free Tier Usage**: Unlimited projects/secrets for individual developers at
  zero cost

## Ethical Constraints

- **User Privacy**: Never store or transmit unencrypted secrets
- **No Surveillance**: No telemetry or analytics that could identify users or
  their secrets
- **Open Source**: Core functionality remains open and auditable
- **No Lock-in**: Users can export/migrate their data at any time using standard
  Nostr protocols
- **Cryptographic Integrity**: Never implement backdoors or key escrow

## 9-Level Hierarchy

| Level | Agent                  | Purpose                                                                                                                                          |
| ----- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| L9    | Telos-Guardian         | Empower developers with sovereign, censorship-resistant control over their application secrets                                                   |
| L8    | Market-Analyst         | Grow adoption through a completely free tier for individuals, monetizing via managed relays, Teams RBAC, and Enterprise SSO                      |
| L7    | Insight-Synthesizer    | Deliver Doppler-compatible CLI and web admin that abstracts Nostr complexity, making decentralized secret management familiar and effortless     |
| L6    | UX-Simulator           | Create a minimalist, Tokyo-Night themed interface with subtle motion and spreadsheet-like editing prioritizing clarity and developer comfort     |
| L5    | Journey-Validator      | Ensure complete user workflows: login -> project selection -> secret editing -> CLI injection -> command execution, across NIP-07 and local NSEC |
| L4    | Integration-Contractor | Maintain stable Nostr protocol contracts (NIP-59, NIP-09, Kind 30078) and Doppler-compatible CLI command interfaces                              |
| L3    | Component-Architect    | Build reusable Svelte 5 components using ShadCN-Svelte and Runes with clear prop contracts                                                       |
| L2    | Function-Author        | Write TDD functions using Bun's native test runner with comprehensive coverage for crypto, CLI parsing, and secret management                    |
| L1    | Syntax-Linter          | Enforce strict TypeScript typing with Bun-native tooling, ensuring security practices for cryptographic operations                               |

## How to Use This Document

This document is your **validation tool** - consult it before and during any
significant change to ensure alignment between purpose and implementation.

### Validate Downward (Purpose -> Implementation)

When implementing new features or making changes:

1. **L9 -> L8**: Does this change serve user sovereignty? What business value
   does it create?
2. **L8 -> L7**: How does this fit our free-tier-first strategy? What user needs
   does it address?
3. **L7 -> L6**: What should the user experience be? Does it match Doppler's DX?
4. **L6 -> L5**: What user journeys are affected? How do we validate the
   workflow?
5. **L5 -> L4**: What Nostr protocol contracts are needed? How do systems
   integrate?
6. **L4 -> L3**: What Svelte components are required? How should they be
   structured?
7. **L3 -> L2**: What functions implement this? How are they tested?
8. **L2 -> L1**: Does this code meet TypeScript strict mode? Is it secure?

**Use this flow** to ensure every implementation decision traces back to
ultimate purpose.

### Validate Upward (Implementation -> Purpose)

When encountering technical constraints or opportunities:

1. **L1 -> L2**: TypeScript errors suggest function signatures need revision
2. **L2 -> L3**: Function complexity suggests component redesign needed
3. **L3 -> L4**: Component limitations suggest API contract changes needed
4. **L4 -> L5**: Nostr protocol constraints suggest workflow validation gaps
5. **L5 -> L6**: User journey failures suggest UX philosophy misalignment
6. **L6 -> L7**: Experience problems suggest product strategy needs revision
7. **L7 -> L8**: Strategic failures suggest business value proposition is off
8. **L8 -> L9**: Business metrics declining suggests purpose needs clarification

**Use this flow** when technical reality informs and validates strategic
decisions.

### The Convergence Rule

Before any significant change, validate through **both directions**:

1. **Start top-down**: Begin at L9, trace alignment with purpose down to L1
2. **Then bottom-up**: Begin at L1, verify technical feasibility up to L9
3. **Converge**: Proceed only when both directions agree the change is valid

**If flows disagree:**

- Top-down says "yes" but bottom-up says "infeasible" -> Revise strategy at
  L5-L9
- Bottom-up says "possible" but top-down says "doesn't serve purpose" -> Reject
  change
- Both say "no" -> Stop and reconsider the change entirely

### Example: Adding NIP-07 Browser Extension Login

**Downward (Purpose -> Code):**

- L9: "Does NIP-07 login serve user sovereignty?" Yes - users control their own
  keys
- L8: "Does this support free tier adoption?" Yes - zero barrier to entry
- L7: "Does this match Doppler DX?" Yes - even simpler (no password needed)
- L6: "Does this fit our minimalist UX?" Yes - one-click login
- L5: "What journey does this enable?" Extension popup -> approve -> dashboard
- L4: "What contracts needed?" NIP-07 window.nostr API, session token storage
- L3: "What components?" LoginButton, NIP07Modal, AuthProvider
- L2: "What functions?" getPublicKey(), signEvent(), validateSession()
- L1: "TypeScript types?" NostrWindow interface, NIP07Provider type

**Upward (Code -> Purpose):**

- L1: "TypeScript requires window.nostr typing" - create global.d.ts
- L2: "Need async/await for extension communication" - functions must be async
- L3: "Need loading states for extension delay" - add skeleton UI
- L4: "Extension might not be installed" - need fallback flow
- L5: "Users without extension need alternative" - local NSEC input journey
- L6: "Two login paths increases complexity" - prioritize NIP-07, make NSEC
  secondary
- L7: "Multiple auth methods fits strategy" - supports different user segments
- L8: "Both free users served" - business value confirmed
- L9: "Both paths preserve sovereignty" - purpose alignment confirmed

**Decision**: Feature approved - both flows converge on value and feasibility.

### Using This Document in Your Workflow

**Before writing code:**

1. Open this document and the relevant agent definition
   (`.telos/agents/l[N]-*.md`)
2. Run downward validation: Start at L9, trace down - "Does this serve user
   sovereignty?"
3. Run upward validation: Start at L1, trace up - "Is this technically feasible
   in Bun/Svelte?"
4. Check convergence: Do both flows agree? If yes, proceed. If no, revise.

**During code review:**

1. Start at L1: Does code pass TypeScript strict mode? (See
   `.telos/agents/l1-syntax-linter.md`)
2. Trace upward to L5: Does this enable the intended user workflow?
3. Trace to L9: Does this serve user sovereignty?
4. If any layer fails validation, revise the change

**When stuck on a decision:**

1. Identify which level the blocker exists (L1-L9)
2. Consult adjacent levels in this hierarchy for context
3. Run both validation flows before proceeding
4. If flows don't converge, the decision needs more refinement

## Detected Technology Stack

**Languages**: TypeScript (strict mode) **Runtime**: Bun **Frameworks**:
SvelteKit 5 (Runes), ShadCN-Svelte, svelte-motion **Protocols**: Nostr (NIP-59
Gift Wrap, NIP-09 Deletion, Kind 30078) **Testing**: bun:test,
@testing-library/svelte **Build**: bun build --compile (single binary)
**Styling**: Tailwind v4, Tokyo-Night Storm theme

## Initialization Metadata

- **Initialized**: December 4, 2025
- **AI Assistant**: OpenCode via Telos `/telos-init`
- **Project Type**: Decentralized Secret Management Platform (CLI + Web Admin)
- **Project State**: Greenfield (spec.md defined, implementation pending)

## Quick Reference: Decision Validation

Open this document and run both flows before implementing changes:

### Making a Change?

1. **Check L9**: Does this serve user sovereignty? (Top of this document)
2. **Check L1**: Is this technically sound in Bun/TypeScript? (See technology
   stack below)
3. **Validate both directions**: Use flows above to trace through all layers
4. **Verify convergence**: Both flows must agree before proceeding

### Stuck on Implementation?

1. **Start at L1-L4** (technical layers)
2. **Trace upward** through this hierarchy to find strategic clarity
3. **Come back down** with informed decision grounded in purpose

### Stuck on Strategy?

1. **Start at L5-L9** (strategic layers)
2. **Trace downward** through this hierarchy to find technical constraints
3. **Revise strategy** based on what's actually feasible

### Before Any Commit

- [ ] Validated top-down from L9
- [ ] Validated bottom-up from L1
- [ ] Both flows converge and agree
- [ ] Consulted relevant agent definitions in `.telos/agents/`

This document is your source of truth. When in doubt, start here.
