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

1. **Use shadcn/ui** - Prefer shadcn components for Svelte
2. **Transitions** - Add `transition` class to elements with hover/animation
3. **Code Display** - Use `InlineCode` for inline, `CodeBlock` for blocks
4. **Tokyo Night Storm** - Use theme color tokens (`tokyo-blue`, etc.)
5. **DRY** - Extract repeated code into libs/components
6. **TDD** - Write tests first, run with `bun test`
7. **No `any`** - Always use proper TypeScript types
8. **Implicit Returns** - Prefer implicit TypeScript return types
