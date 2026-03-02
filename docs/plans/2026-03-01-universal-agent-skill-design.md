# Universal Agent Skill + Docs Fixes Design

> **Approved:** 2026-03-01

**Goal:** Replace the OpenClaw-specific skill with a universal Agent Skills
standard skill, fix CLI reference completeness, fix Kind number inconsistency,
update integrations page, and fix CodeBlock bugs.

**Approach:** Single `SKILL.md` (Approach A) compatible with Claude Code,
OpenCode, Agent SDK, and claude.ai. Docs fixes address inaccuracies found during
exploration.

**Decisions:**

- Replace existing OpenClaw skill (not keep both)
- Rename integrations page from "OpenClaw" to "AI Agent Skills"
- Fix all identified docs issues in scope

See implementation plan: `docs/plans/2026-03-01-universal-agent-skill-impl.md`
