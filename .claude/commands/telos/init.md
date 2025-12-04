---
description: Initialize Telos multi-agent system for this project
---

# Telos Initialization

You are initializing the **Telos Framework** - a 9-level purpose-driven
architecture for AI-assisted software development. Your role is to analyze this
codebase, propose a complete hierarchy from ultimate purpose (L9) to code
structure (L1), and generate all necessary files.

## ⚠️ CRITICAL: One Question at a Time

**Throughout this initialization:**

- Ask ONLY ONE question at a time
- NEVER preview the next question or step
- NEVER say "Next, I'll..." or "Then I'll ask..."
- STOP and WAIT for user response before proceeding
- Only after receiving a response, move to the next step

This prevents confusion when the user answers one question and you misinterpret
it as answering a different question.

## Important Note

Platform setup (slash commands, config files) was already completed by running `npx telos-framework init`. You don't need to ask about platforms or create command files - they already exist. Your job is to analyze the codebase and generate the `.telos/` hierarchy files.

## Step 1: Analyze Codebase

Read and analyze the following to understand this project:

### 1.1 Project Documentation

- **README.md** - Extract:
  - Project purpose and description
  - Target users/beneficiaries
  - Goals and success metrics
  - Technology stack

### 1.2 Package Configuration

Check for and read (if exists):

- **package.json** (Node.js) - Identify:
  - Dependencies and frameworks (React, Express, Next.js, etc.)
  - Dev dependencies (testing, linting, build tools)
  - Scripts (test, lint, build commands)
- **pyproject.toml** or **requirements.txt** (Python)
- **Cargo.toml** (Rust)
- **pom.xml** or **build.gradle** (Java)
- **go.mod** (Go)

### 1.3 Source Code Structure

Scan the primary source directory:

- Look for **src/**, **lib/**, **app/**, or similar
- Identify:
  - Component patterns (React components, Vue SFCs)
  - API structure (routes, endpoints, controllers)
  - Architectural patterns (MVC, microservices, monolith)
  - Database integration (Prisma, Sequelize, MongoDB)

### 1.4 Testing and Quality Tools

Check for:

- **Test frameworks**: Jest, Vitest, Pytest, RSpec, etc.
- **Linters**: ESLint, Prettier, Ruff, Clippy, etc.
- **Type checkers**: TypeScript, mypy, etc.

### 1.5 Project State

Run: `git status` to check if this is an active repository

## Step 2: Propose Telos Hierarchy

Based on your analysis, propose a complete 9-level hierarchy. Present it using
this block format:

```
═══════════════════════════════════════════════════════════════════════════
                          PROPOSED TELOS HIERARCHY
═══════════════════════════════════════════════════════════════════════════

───────────────────────────────────────────────────────────────────────────
L9 - Telos-Guardian (Ultimate Purpose)
───────────────────────────────────────────────────────────────────────────
Purpose: [Proposed ultimate purpose statement]

Reasoning: [Why this is the ultimate purpose - based on README, project 
description, and inferred mission]
───────────────────────────────────────────────────────────────────────────

───────────────────────────────────────────────────────────────────────────
L8 - Market-Analyst (Business Value)
───────────────────────────────────────────────────────────────────────────
Purpose: [Proposed business value statement]

Reasoning: [Business outcomes this project serves - based on metrics, KPIs,
or market positioning mentioned in docs]
───────────────────────────────────────────────────────────────────────────

───────────────────────────────────────────────────────────────────────────
L7 - Insight-Synthesizer (Product Strategy)
───────────────────────────────────────────────────────────────────────────
Purpose: [Proposed product strategy statement]

Reasoning: [How it delivers user value - based on features, roadmap, or
user-facing goals]
───────────────────────────────────────────────────────────────────────────

───────────────────────────────────────────────────────────────────────────
L6 - UX-Simulator (Experience Philosophy)
───────────────────────────────────────────────────────────────────────────
Purpose: [Proposed UX philosophy statement]

Reasoning: [User experience principles - based on UI framework, design
system, or accessibility mentions]
───────────────────────────────────────────────────────────────────────────

───────────────────────────────────────────────────────────────────────────
L5 - Journey-Validator (Workflow Validation)
───────────────────────────────────────────────────────────────────────────
Purpose: [Proposed workflow validation statement]

Reasoning: [User journey requirements - based on E2E tests, integration
tests, or workflow documentation]
───────────────────────────────────────────────────────────────────────────

───────────────────────────────────────────────────────────────────────────
L4 - Integration-Contractor (API Contracts)
───────────────────────────────────────────────────────────────────────────
Purpose: [Proposed API contract statement]

Reasoning: [Based on detected API frameworks, protocols, and integration
patterns]
───────────────────────────────────────────────────────────────────────────

───────────────────────────────────────────────────────────────────────────
L3 - Component-Architect (Component Design)
───────────────────────────────────────────────────────────────────────────
Purpose: [Proposed component architecture statement]

Reasoning: [Based on detected UI framework, component patterns, and
architectural choices]
───────────────────────────────────────────────────────────────────────────

───────────────────────────────────────────────────────────────────────────
L2 - Function-Author (Function Implementation)
───────────────────────────────────────────────────────────────────────────
Purpose: [Proposed function implementation statement]

Reasoning: [Based on detected test framework, testing strategy, and code
coverage requirements]
───────────────────────────────────────────────────────────────────────────

───────────────────────────────────────────────────────────────────────────
L1 - Syntax-Linter (Code Quality)
───────────────────────────────────────────────────────────────────────────
Purpose: [Proposed code quality statement]

Reasoning: [Based on detected linters, formatters, and quality standards]
═══════════════════════════════════════════════════════════════════════════
```

### Auto-generation Guidelines for L1-L4

**L1 (Syntax-Linter)** - Based on detected tools:

- If ESLint found → "Ensure code passes ESLint strict mode with zero warnings"
- If Prettier found → "Maintain consistent code formatting via Prettier"
- If Ruff found (Python) → "Enforce Ruff linting rules for code quality"
- If Clippy found (Rust) → "Pass all Clippy lints at deny level"

**L2 (Function-Author)** - Based on test framework:

- If Vitest found → "Write TDD functions with Vitest coverage >80%"
- If Jest found → "Implement testable functions with Jest unit tests"
- If Pytest found → "Write pure functions with pytest coverage"

**L3 (Component-Architect)** - Based on framework:

- If React found → "Design reusable React components following composition
  patterns"
- If Vue found → "Build modular Vue components with clear prop contracts"
- If Flutter found → "Create widget hierarchies following Material/Cupertino
  design"

**L4 (Integration-Contractor)** - Based on detected APIs:

- If Express found → "Maintain RESTful API contracts with OpenAPI docs"
- If FastAPI found → "Define typed API endpoints with automatic validation"
- If GraphQL found → "Maintain GraphQL schema contracts"

## Step 3: User Review (Strategic Layers Only)

After presenting the table, present ONLY this question and WAIT for the user's
response:

---
**Strategic layers (L9-L5) define your project's purpose and require your input.**

**Technical layers (L1-L4) are auto-generated based on your detected tooling:**

- L1: [List detected linters]
- L2: [List detected test frameworks]
- L3: [List detected component frameworks]
- L4: [List detected API frameworks]

**Please review the strategic layers (L9-L5). Would you like to refine any of these?**

Options:

- "Accept all" - Proceed with generation
- "Refine L9" - Edit ultimate purpose layer
- "Refine L8" - Edit business value layer
- "Refine all" - Walk through each strategic layer
- "Restart" - Re-analyze with different focus
---

**IMPORTANT**: Do NOT preview the next step. Do NOT say "Next step: I'll also
ask...". Do NOT ask any other questions. STOP and WAIT for user response.

Once you receive the user's response:

- If they want refinements, engage conversationally:
  - Ask for their vision for the specific layer
  - Propose updated purpose statement
  - Confirm before moving to next layer

- If they say "Accept all", proceed immediately to Step 4 (Generate Telos
  System)

## Step 4: Generate Telos System

Once the hierarchy is finalized, create the following files:

### 4.1 Create `.telos/TELOS.md`

```markdown
# Telos: Ultimate Purpose

## Ultimate Purpose

[L9 purpose statement]

## Beneficiaries

[Who benefits from this project - extracted from README or inferred]

## Measurable Impact

[Success metrics - extracted from README or project goals]

## Ethical Constraints

[Constraints on how purpose is achieved - inferred from domain]

## 9-Level Hierarchy

| Level | Agent                  | Purpose      |
| ----- | ---------------------- | ------------ |
| L9    | Telos-Guardian         | [L9 purpose] |
| L8    | Market-Analyst         | [L8 purpose] |
| L7    | Insight-Synthesizer    | [L7 purpose] |
| L6    | UX-Simulator           | [L6 purpose] |
| L5    | Journey-Validator      | [L5 purpose] |
| L4    | Integration-Contractor | [L4 purpose] |
| L3    | Component-Architect    | [L3 purpose] |
| L2    | Function-Author        | [L2 purpose] |
| L1    | Syntax-Linter          | [L1 purpose] |

## How to Use This Document

This document is your **validation tool** - consult it before and during any
significant change to ensure alignment between purpose and implementation.

### Validate Downward (Purpose → Implementation)

When implementing new features or making changes:

1. **L9 → L8**: Does this change serve the ultimate purpose? What business value
   does it create?
2. **L8 → L7**: How does this fit our product strategy? What user needs does it
   address?
3. **L7 → L6**: What should the user experience be? How should this feel?
4. **L6 → L5**: What user journeys are affected? How do we validate the
   workflow?
5. **L5 → L4**: What API contracts are needed? How do systems integrate?
6. **L4 → L3**: What components are required? How should they be structured?
7. **L3 → L2**: What functions implement this? How are they tested?
8. **L2 → L1**: Does this code meet quality standards? Is it maintainable?

**Use this flow** to ensure every implementation decision traces back to
ultimate purpose.

### Validate Upward (Implementation → Purpose)

When encountering technical constraints or opportunities:

1. **L1 → L2**: Code quality issues suggest function refactoring needed
2. **L2 → L3**: Function complexity suggests component redesign needed
3. **L3 → L4**: Component limitations suggest API contract changes needed
4. **L4 → L5**: Integration challenges suggest workflow validation gaps
5. **L5 → L6**: User journey failures suggest UX philosophy misalignment
6. **L6 → L7**: Experience problems suggest product strategy needs revision
7. **L7 → L8**: Strategic failures suggest business value proposition is off
8. **L8 → L9**: Business metrics declining suggests purpose needs clarification

**Use this flow** when technical reality informs and validates strategic
decisions.

### The Convergence Rule

Before any significant change, validate through **both directions**:

1. **Start top-down**: Begin at L9, trace alignment with purpose down to L1
2. **Then bottom-up**: Begin at L1, verify technical feasibility up to L9
3. **Converge**: Proceed only when both directions agree the change is valid

**If flows disagree:**

- Top-down says "yes" but bottom-up says "infeasible" → Revise strategy at L5-L9
- Bottom-up says "possible" but top-down says "doesn't serve purpose" → Reject
  change
- Both say "no" → Stop and reconsider the change entirely

### Example: Adding a New Feature

**Downward (Purpose → Code):**

- L9: "Does user authentication serve our mission to provide secure access?"
- L8: "Will secure authentication increase user trust and retention?"
- L7: "OAuth fits our strategy of minimizing user friction"
- L6: "Social login provides best UX for our audience"
- L5: "Login → Dashboard journey needs OAuth callback handling"
- L4: "Need OAuth API contract with Google/GitHub"
- L3: "Need LoginButton and OAuthCallback components"
- L2: "Need validateToken() and refreshSession() functions"
- L1: "Code must pass ESLint security rules"

**Upward (Code → Purpose):**

- L1: "ESLint flags require HTTPS in production"
- L2: "Token validation requires crypto library"
- L3: "OAuth flow needs redirect handling component"
- L4: "OAuth providers require registered callback URLs"
- L5: "Users need fallback for failed OAuth (email login)"
- L6: "Multiple login options reduce UX simplicity - worth it?"
- L7: "Security requirements justify multi-option strategy"
- L8: "Enterprise customers require SSO (business value confirmed)"
- L9: "Secure authentication aligns with mission to protect users"

**Decision**: Feature approved - both flows converge on value and feasibility.

### Using This Document in Your Workflow

**Before writing code:**

1. Open this document and the relevant agent definition
   (`.telos/agents/l[N]-*.md`)
2. Run downward validation: Start at L9, trace down - "Does this serve ultimate
   purpose?"
3. Run upward validation: Start at L1, trace up - "Is this technically
   feasible?"
4. Check convergence: Do both flows agree? If yes, proceed. If no, revise.

**During code review:**

1. Start at L1: Does code meet quality standards? (See
   `.telos/agents/l1-syntax-linter.md`)
2. Trace upward to L5: Does this enable user workflows?
3. Trace to L9: Does this serve ultimate purpose?
4. If any layer fails validation, revise the change

**When stuck on a decision:**

1. Identify which level the blocker exists (L1-L9)
2. Consult adjacent levels in this hierarchy for context
3. Run both validation flows before proceeding
4. If flows don't converge, the decision needs more refinement

## Detected Technology Stack

**Languages**: [Detected languages]\
**Frameworks**: [Detected frameworks]\
**Testing**: [Test frameworks]\
**Linting**: [Linters and formatters]\
**Build Tools**: [Build systems]

## Initialization Metadata

- **Initialized**: [Current date]
- **AI Assistant**: Claude via Telos `/telos:init`
- **Project Type**: [Inferred project type]

## Quick Reference: Decision Validation

Open this document and run both flows before implementing changes:

### Making a Change?

1. **Check L9**: Does this serve ultimate purpose? (Top of this document)
2. **Check L1**: Is this technically sound? (See technology stack below)
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
```

### 4.2 Create Agent Files

For each level (L9 → L1), create `.telos/agents/l[N]-[agent-name].md`:

**Template structure:**

```markdown
# L[N]: [Agent Name]

## Purpose

[Purpose statement for this level]

## Role

[What this agent is responsible for]

## Capabilities

[What this agent can do]

## Tools

[List relevant tools based on detected stack]

## Validation Criteria

[How to verify this agent's output aligns with purpose]

## Examples

[2-3 examples of decisions this agent would make]
```

**Specific guidance per level:**

**L9 (Telos-Guardian)**: Ultimate purpose keeper

- Tools: Read access to all specs, ability to veto changes
- Examples: Reject feature that violates core purpose

**L8 (Market-Analyst)**: Business value measurer

- Tools: Analytics, metrics dashboards, user feedback
- Examples: Evaluate feature ROI against business goals

**L7 (Insight-Synthesizer)**: Product strategist

- Tools: User research, competitive analysis, roadmap planning
- Examples: Prioritize features based on user insights

**L6 (UX-Simulator)**: Experience designer

- Tools: Figma, user testing, accessibility checkers
- Examples: Ensure UI meets experience philosophy

**L5 (Journey-Validator)**: Workflow verifier

- Tools: E2E testing, user flow analysis, journey mapping
- Examples: Validate checkout flow meets user expectations

**L4 (Integration-Contractor)**: API contract enforcer

- Tools: [Detected API tools - OpenAPI, GraphQL schema, etc.]
- Examples: Ensure breaking changes follow versioning strategy

**L3 (Component-Architect)**: UI component designer

- Tools: [Detected framework - React, Vue, etc.], Storybook
- Examples: Design reusable button component following design system

**L2 (Function-Author)**: Function implementer

- Tools: [Detected test framework], code coverage tools
- Examples: Write TDD function with 100% coverage

**L1 (Syntax-Linter)**: Code quality enforcer

- Tools: [Detected linters - ESLint, Prettier, etc.]
- Examples: Reject PR with linting errors

### 4.2.1 Copy Sub-Agent Specialists

After creating the L1-L9 agent files, you MUST copy the specialized sub-agent files from the Telos framework templates.

**CRITICAL: Execute these bash commands immediately:**

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

**Verification:** After running these commands, confirm that `.telos/agents/sub-agents/` contains 15 markdown files and `.telos/agents/SUB_AGENT_MAPPING.md` exists.

**Sub-agents included:**
- api-design.md - REST/GraphQL API design
- code-reviewer.md - Code quality review
- component-implementation.md - UI component creation
- database-design.md - Database schema design
- devops.md - Deployment and CI/CD
- documentation.md - Technical documentation
- feature-implementation.md - Feature development
- infrastructure.md - Cloud infrastructure
- polish.md - Code optimization
- prd.md - Product requirements
- quality.md - Quality assurance
- refactoring.md - Code refactoring
- research.md - Technical research
- security-audit.md - Security review
- testing.md - Test creation

**Mapping file:**
- SUB_AGENT_MAPPING.md - Maps sub-agents to L1-L9 levels

These sub-agents can be invoked by the L1-L9 agents using the Task tool for specialized work.

### 4.3 Integrate with AI Assistant Configuration Files

**IMPORTANT**: You must use the actual template files from the telos-framework package, not simplified inline content.

**Step 4.3.1: Locate Template Files**

Run this command to find the telos-framework package:

```bash
TELOS_PATH=$(node -p "require.resolve('telos-framework/package.json').replace('/package.json', '')")
echo "Telos templates at: $TELOS_PATH/templates"
```

**Step 4.3.2: Read Template Files**

Read these two files to get the complete template content:

1. Read `$TELOS_PATH/templates/TELOS_CORE.md` - This contains the comprehensive validation instructions
2. Read `$TELOS_PATH/templates/AGENTS.md` - This contains the AGENTS.md template with `{{TELOS_CORE}}` placeholder
3. Read `$TELOS_PATH/templates/CLAUDE.md` - This contains the CLAUDE.md template

**Step 4.3.3: Process AGENTS.md Template**

Replace the `{{TELOS_CORE}}` placeholder in the AGENTS.md template with the full content from TELOS_CORE.md. The final content should look like:

```markdown
# AI Agent Instructions

<!-- Auto-generated by Telos initialization -->
<!-- This file contains the core Telos validation requirements for AI coding assistants -->

[FULL TELOS_CORE.md CONTENT HERE - NOT PLACEHOLDER]

## Slash Commands
...
```

**Step 4.3.4: Update or Create Configuration Files**

**Files to check and update:**

- `AGENTS.md` - Unified standard (always create/update)
- `CLAUDE.md` - Claude Code (always create if running from Claude)
- `.cursorrules` - Cursor IDE (if exists, prepend processed template)
- `.clinerules` - Cline/VS Code (if exists, prepend processed template)
- `.windsurfrules` - Windsurf IDE (if exists, prepend processed template)
- `.roocode` - Roo Code (if exists, prepend processed template)
- `GEMINI.md` - Google Gemini (if exists, prepend processed template)

**For AGENTS.md:**

- If it **doesn't exist**: Create it with the processed AGENTS.md template (with {{TELOS_CORE}} replaced)
- If it **exists** but doesn't contain "Telos Framework": **Append** the processed template to the end
- If it **exists** and already contains "Telos Framework": Skip (already configured)

**For CLAUDE.md:**

- If running from Claude Code (`.claude/` directory exists)
- AND `CLAUDE.md` doesn't exist: Create it with the CLAUDE.md template
- If it exists but doesn't contain "Telos Framework": **Append** the template to the end
- If it exists and already contains "Telos Framework": Skip (already configured)

**For other config files (.cursorrules, etc.):**

- If the file exists and doesn't contain "Telos Framework": **Prepend** the CLAUDE.md template content
- Otherwise skip

**CRITICAL**: Do NOT use simplified inline templates. You MUST read and use the actual template files from the package to ensure users get the complete validation instructions.

### 4.4 Platform Commands Already Installed

**Note**: Platform-specific slash commands were already installed by `npx telos-framework init`. You don't need to create or modify command files - they already exist in:
- `.claude/commands/telos/` (if Claude Code was selected)
- `.opencode/command/` (if Opencode was selected)

Skip any command installation steps.

### 4.5 Create Orchestrator (Optional)

If JavaScript/Node.js project, create `logos/orchestrator.js`:

```javascript
// Telos-Logos orchestrator
// Routes requests to appropriate L1-L9 agents

const hierarchy = [
  { level: 9, name: "telos-guardian", role: "ultimate-purpose" },
  { level: 8, name: "market-analyst", role: "business-value" },
  // ... all 9 levels
];

module.exports = { hierarchy };
```

## Step 5: Completion

Once all files are generated, display:

---
✅ **Telos initialization complete!**

**Generated files:**

- `.telos/TELOS.md` - Ultimate purpose and hierarchy
- `.telos/agents/l9-telos-guardian.md` through `l1-syntax-linter.md` - Nine level agent definitions
- `.telos/agents/sub-agents/` - 15 specialized sub-agents
- `.telos/agents/SUB_AGENT_MAPPING.md` - Sub-agent delegation guide

**Updated AI assistant configuration files:**

- `AGENTS.md` - Comprehensive Telos validation requirements (TELOS_CORE content)
- `CLAUDE.md` - Claude Code integration (if applicable)
- `.cursorrules`, `.clinerules`, `.windsurfrules`, `.roocode`, `GEMINI.md` (if they existed)

**Platform commands** (already installed by CLI):
  - Claude Code: `.claude/commands/telos/*.md` (5 commands)
  - Opencode: `.opencode/command/telos-*.md` (5 commands)

**Next steps:**

1. Review the generated agent definitions in `.telos/agents/`
2. **IMPORTANT**: Open `AGENTS.md` to see the complete validation requirements
3. Run `/telos:validate` to check alignment with current codebase
4. Run `/telos:status` to see current configuration
5. Start developing with purpose-driven AI assistance!

**Your AI assistant now has the full Telos framework!** The `AGENTS.md` file contains:
- ⚠️ Critical validation requirements
- Required validation process (L9→L1→L9)
- Agent responsibilities table
- Todo system integration
- Complete 9-level hierarchy reference

All changes must now validate through the Telos hierarchy before implementation.

**Slash commands available:**

- `/telos:validate` - Check if current code aligns with Telos
- `/telos:status` - Show current Telos configuration
- `/telos:reset` - Clear and reinitialize

---

## Tips

- If README is missing or vague, ask user for clarification before proposing L9
- If no testing framework detected, suggest adding one in L2
- If no linter detected, suggest adding one in L1
- For empty/greenfield projects, ask user for project vision before proposing
  hierarchy
- Be conversational and collaborative - this is a dialogue, not a survey
