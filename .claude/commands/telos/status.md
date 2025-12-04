---
description: Show current Telos configuration and hierarchy
---

# Telos Status

Display the current Telos configuration for this project.

## Check Installation

First, check if Telos is initialized:

- Look for `.telos/TELOS.md`
- Look for `.telos/agents/` directory

If not found, display:

```
❌ Telos not initialized

Run `/telos-init` to set up the multi-agent system.
```

## Display Configuration

If Telos is initialized, read and display:

### 1. Ultimate Purpose

From `.telos/TELOS.md`, extract and display:

```
🎯 **Ultimate Purpose (L9)**
[L9 purpose statement from TELOS.md]

**Beneficiaries**: [Who benefits]
**Measurable Impact**: [Success metrics]
```

### 2. Purpose Hierarchy

Display all 9 levels:

| Level | Agent                  | Purpose   | Status                                      |
| ----- | ---------------------- | --------- | ------------------------------------------- |
| L9    | Telos-Guardian         | [Purpose] | [✅ if l9-telos-guardian.md exists]         |
| L8    | Market-Analyst         | [Purpose] | [✅ if l8-market-analyst.md exists]         |
| L7    | Insight-Synthesizer    | [Purpose] | [✅ if l7-insight-synthesizer.md exists]    |
| L6    | UX-Simulator           | [Purpose] | [✅ if l6-ux-simulator.md exists]           |
| L5    | Journey-Validator      | [Purpose] | [✅ if l5-journey-validator.md exists]      |
| L4    | Integration-Contractor | [Purpose] | [✅ if l4-integration-contractor.md exists] |
| L3    | Component-Architect    | [Purpose] | [✅ if l3-component-architect.md exists]    |
| L2    | Function-Author        | [Purpose] | [✅ if l2-function-author.md exists]        |
| L1    | Syntax-Linter          | [Purpose] | [✅ if l1-syntax-linter.md exists]          |

### 3. Technology Stack

From `.telos/TELOS.md`, show detected stack:

```
**Technology Stack**
- **Languages**: [Languages]
- **Frameworks**: [Frameworks]
- **Testing**: [Test frameworks]
- **Linting**: [Linters]
- **Build Tools**: [Build systems]
```

### 4. Installation Details

Show metadata:

```
**Installation**
- **Initialized**: [Date from TELOS.md]
- **Method**: [AI Assistant / CLI]
- **Agent Files**: [N]/9 present
- **Orchestrator**: [✅ Present / ❌ Not found] (logos/orchestrator.js)
```

### 5. Platform Integration

Check for platform-specific files:

```
**Platform Integration**
- **Claude Code**: [✅ AGENTS.md exists / ❌ Not configured]
- **OpenCode**: [✅ .opencode/ setup / ❌ Not configured]
```

## Health Check

Perform a quick health check:

**✅ Healthy**: All 9 agent files present, TELOS.md valid **⚠️ Incomplete**:
Some agent files missing **❌ Corrupted**: TELOS.md missing or invalid

If incomplete or corrupted:

```
⚠️  **Warning**: Telos installation is incomplete.

**Missing files**:
- [List missing agent files]

**Suggestion**: Run `/telos-reset` then `/telos-init` to reinstall.
```

## Quick Actions

Display available commands:

```
**Available Commands**
- `/telos-validate` - Check code alignment with purpose
- `/telos-reset` - Clear and reinitialize
- `/telos-init` - Reconfigure interactively
- `/telos-quick` - Fast reconfiguration
```

## Example Output

Full example when healthy:

```
🎯 **Ultimate Purpose (L9)**
Enable developers to build software with clear hierarchical purpose

**Beneficiaries**: Software development teams using AI assistants
**Measurable Impact**: Reduced technical debt, faster onboarding, purpose-aligned decisions

**Purpose Hierarchy**

| Level | Agent | Purpose | Status |
|-------|-------|---------|--------|
| L9 | Telos-Guardian | Enable purposeful software development | ✅ |
| L8 | Market-Analyst | Maximize developer productivity and code quality | ✅ |
| L7 | Insight-Synthesizer | Synthesize best practices into actionable guidance | ✅ |
| L6 | UX-Simulator | Ensure intuitive developer experience | ✅ |
| L5 | Journey-Validator | Validate developer workflows end-to-end | ✅ |
| L4 | Integration-Contractor | Maintain clean API contracts | ✅ |
| L3 | Component-Architect | Design modular component architecture | ✅ |
| L2 | Function-Author | Write testable, maintainable functions | ✅ |
| L1 | Syntax-Linter | Enforce code quality standards | ✅ |

**Technology Stack**
- **Languages**: JavaScript, Node.js
- **Frameworks**: None (CLI tool)
- **Testing**: Vitest
- **Linting**: ESLint, Prettier
- **Build Tools**: npm

**Installation**
- **Initialized**: 2025-01-15
- **Method**: AI Assistant (/telos-init)
- **Agent Files**: 9/9 present ✅
- **Orchestrator**: ✅ Present

**Platform Integration**
- **Claude Code**: ✅ AGENTS.md configured
- **OpenCode**: ✅ .opencode/ configured

**Health**: ✅ Fully operational

**Available Commands**
- `/telos-validate` - Check code alignment with purpose
- `/telos-reset` - Clear and reinitialize
- `/telos-init` - Reconfigure interactively
- `/telos-quick` - Fast reconfiguration
```
