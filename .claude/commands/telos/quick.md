---
description: Quick Telos initialization with auto-accepted AI proposals
---

# Telos Quick Initialization

This is the fast-track initialization mode that accepts all AI-proposed
hierarchy levels without user review. Use this when you trust the AI analysis
and want to get started immediately.

## Process

1. **Analyze codebase** (same as `/telos-init`)
2. **Propose hierarchy** (auto-accept without showing to user)
3. **Generate all files** immediately
4. **Show summary** of what was created

## Step 1: Silent Analysis

Perform the same analysis as `/telos-init`:

- Read README.md
- Check package.json / pyproject.toml / Cargo.toml
- Scan src/ or lib/ directory
- Detect testing and linting tools
- Check git status

## Step 2: Auto-Generate Hierarchy

Generate the 9-level hierarchy without user interaction:

**L9-L5 (Strategic)**: Infer from README and project description **L4-L1
(Technical)**: Auto-generate from detected tools

Do NOT ask for user review - proceed directly to generation.

## Step 3: Generate Files

Create all files exactly as specified in `/telos-init` Step 4:

- `.telos/TELOS.md`
- `.telos/agents/l9-telos-guardian.md` through `l1-syntax-linter.md`
- `.telos/agents/sub-agents/` (15 specialized sub-agent files)
- `.telos/agents/SUB_AGENT_MAPPING.md` (sub-agent mapping guide)
- `AGENTS.md` - AI assistant configuration with complete TELOS_CORE content
- `CLAUDE.md` - Claude Code integration (if applicable)
- `logos/orchestrator.js` (if Node.js project)

### Step 3.1: Copy Sub-Agent Specialists

**EXECUTE these bash commands** to copy the specialized sub-agents:

```bash
# Find telos-framework package location using Node module resolution
TELOS_PATH=$(node -p "require.resolve('telos-framework/package.json').replace('/package.json', '')")

# Create sub-agents directory
mkdir -p .telos/agents/sub-agents

# Copy all sub-agent files (15 specialized agents)
cp "$TELOS_PATH/templates/agents/sub-agents/"*.md .telos/agents/sub-agents/

# Copy sub-agent mapping guide
cp "$TELOS_PATH/templates/agents/SUB_AGENT_MAPPING.md" .telos/agents/
```

**Verification:** Confirm that `.telos/agents/sub-agents/` contains 15 markdown files.

### Step 3.2: Integrate with AI Assistant Configuration

**IMPORTANT**: Use the actual template files from the telos-framework package.

**Execute these steps:**

1. **Locate templates:**
   ```bash
   TELOS_PATH=$(node -p "require.resolve('telos-framework/package.json').replace('/package.json', '')")
   ```

2. **Read template files:**
   - Read `$TELOS_PATH/templates/TELOS_CORE.md`
   - Read `$TELOS_PATH/templates/AGENTS.md`
   - Read `$TELOS_PATH/templates/CLAUDE.md`

3. **Process AGENTS.md template:**
   - Replace `{{TELOS_CORE}}` in AGENTS.md template with full TELOS_CORE.md content
   - Create or append to `AGENTS.md` in project root

4. **Create CLAUDE.md** (if running from Claude Code):
   - If `.claude/` directory exists and `CLAUDE.md` doesn't exist, create it
   - Use the CLAUDE.md template content

**Do NOT use simplified inline templates - use the actual template files to ensure complete validation instructions are included.**

## Step 4: Display Summary

Once complete, show:

---
⚡ **Telos quick initialization complete!**

**Generated hierarchy:**

| Level | Agent | Purpose |
|-------|-------|---------|
| L9 | Telos-Guardian | [Purpose] |
| L8 | Market-Analyst | [Purpose] |
| L7 | Insight-Synthesizer | [Purpose] |
| L6 | UX-Simulator | [Purpose] |
| L5 | Journey-Validator | [Purpose] |
| L4 | Integration-Contractor | [Purpose] |
| L3 | Component-Architect | [Purpose] |
| L2 | Function-Author | [Purpose] |
| L1 | Syntax-Linter | [Purpose] |

**Files created:**
- `.telos/TELOS.md` - Ultimate purpose and hierarchy
- `.telos/agents/l9-telos-guardian.md` through `l1-syntax-linter.md` - Nine level agent definitions
- `.telos/agents/sub-agents/` - 15 specialized sub-agents
- `.telos/agents/SUB_AGENT_MAPPING.md` - Sub-agent delegation guide

**AI assistant configuration updated:**
- `AGENTS.md` - Comprehensive Telos validation requirements (TELOS_CORE content)
- `CLAUDE.md` - Claude Code integration (if applicable)

**Platform commands** (already installed by CLI):
- Claude Code: `.claude/commands/telos/*.md` (5 commands)
- Opencode: `.opencode/command/telos-*.md` (5 commands)

**Your AI assistant now has the full Telos framework!** The `AGENTS.md` file contains complete validation requirements, agent responsibilities, and the bidirectional validation process.

**Not satisfied?** Run `/telos:reset` then `/telos:init` for interactive mode with full customization.
---

## When to Use Quick Mode

✅ **Use quick mode when:**

- Starting a new project with clear conventions
- The codebase already has comprehensive README
- You trust AI inference for strategic purpose
- You want to iterate quickly and refine later

❌ **Use full `/telos-init` when:**

- Project has unique or nuanced purpose
- Strategic direction needs human input
- Multiple stakeholders need alignment
- Initial setup must be perfect
