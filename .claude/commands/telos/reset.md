---
description: Clear existing Telos installation and reinitialize
---

# Telos Reset

This command removes all existing Telos configuration and allows you to start
fresh.

## What Gets Removed

This command will **delete** the following:

- `.telos/TELOS.md`
- `.telos/agents/` directory (all L1-L9 agent files)
- `logos/orchestrator.js` (if present)
- Telos sections in `AGENTS.md` and `CLAUDE.md` (if present)

## Safety Check

Before proceeding, ask the user:

---
⚠️  **Warning: This will delete all Telos configuration files.**

**Files to be removed:**
- `.telos/TELOS.md`
- `.telos/agents/l1-*.md` through `l9-*.md`
- `logos/orchestrator.js`
- Telos references in AGENTS.md / CLAUDE.md

**Are you sure you want to reset?** (yes/no)
---

If user responds "no" or anything other than "yes", abort with message: "Reset
cancelled. Your Telos configuration is unchanged."

## Reset Process

If user confirms "yes":

### Step 1: Remove Files

Delete the following files (if they exist):

```bash
rm -rf .telos/TELOS.md
rm -rf .telos/agents/
rm -rf logos/orchestrator.js
```

### Step 2: Clean Memory Files

If `AGENTS.md` exists:

- Remove any sections with headers containing "Telos" or "L1-L9"
- Keep all other content intact

If `CLAUDE.md` exists:

- Remove any sections referencing Telos
- Keep all other project-specific content

### Step 3: Clean State

Remove any initialization state files:

```bash
rm -f .telos-init-state.json
```

### Step 4: Confirm Completion

Display:

---
✅ **Telos reset complete.**

**Removed:**
- All Telos content and agent files
- Telos references in AGENTS.md / CLAUDE.md
- Initialization state

**Next steps:**
- Run `/telos-init` for full interactive setup
- Run `/telos-quick` for fast auto-generation
- Run `telos init` (CLI) to reinstall slash commands if needed
---

## Edge Cases

**If no Telos files found:** Display: "No Telos installation detected. Nothing
to reset."

**If only partial installation found:** Remove what exists and notify: "Partial
Telos installation found. Removed existing files. Run `/telos-init` to complete
setup."

**If git repository has uncommitted Telos files:** Warn: "You have uncommitted
Telos files. Consider running `git status` before resetting."
