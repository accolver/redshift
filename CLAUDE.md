<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Project Context for Claude

<!-- Telos Framework Instructions: See AGENTS.md for complete validation requirements -->

This project uses the **Telos Framework**. See `AGENTS.md` for complete
instructions on validation requirements.

## Claude-Specific Commands

Use these slash commands in Claude Code:

- `/telos-init` - Initialize Telos with AI-driven codebase analysis
- `/telos-quick` - Fast initialization (auto-accept AI proposals)
- `/telos-validate` - Check code alignment with purpose hierarchy
- `/telos-status` - Show current Telos configuration
- `/telos-reset` - Clear and reinitialize

## Integration with OpenSpec

If this project uses OpenSpec for change management, ensure that:

- Major changes have proposals referencing Telos levels
- Breaking changes are validated against L9 (ultimate purpose)
- Technical specs reference L1-L4 agents for implementation guidance

---

**⚠️ IMPORTANT**: Before any significant changes, consult `AGENTS.md` for Telos
validation requirements.

---

## Project Coding Standards

See `AGENTS.md` for the complete coding standards. Key points:

### UI & Styling

1. **Use shadcn/ui** - Prefer shadcn components for Svelte
2. **Transitions** - Add `transition` class to elements with hover/animation
3. **Code Display** - Use `InlineCode` for inline, `CodeBlock` for blocks
4. **Tokyo Night Storm** - Use theme color tokens (`tokyo-blue`, etc.)

### Code Organization

5. **DRY** - Extract repeated code into libs/components
6. **TDD** - Write tests first, run with `bun test`
7. **No `any`** - Always use proper TypeScript types
8. **Implicit Returns** - Prefer implicit TypeScript return types

### Architecture (CRITICAL)

9. **Shared Packages** - Code for both CLI/Web MUST go in `/packages/`
10. **Prefer Nostr Libs** - Use `nostr-tools`, `applesauce-*`,
    `@redshift/crypto`
11. **Typed Errors** - Use `RelayError`, `DecryptionError`, etc. from
    `errors.ts`
12. **Gift Wrap Type Tag** - All secrets use `["t", "redshift-secrets"]` tag
13. **Rate Limiting** - All relay operations use `RateLimiter` by default

See `spec.md` Section 4 for full architectural constraints.
