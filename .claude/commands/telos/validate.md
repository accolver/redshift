---
description: Validate current code against Telos purpose hierarchy
---

# Telos Validation

This command checks if your current codebase aligns with the established Telos
purpose hierarchy.

## Prerequisites

Check if Telos is initialized:

- `.telos/TELOS.md` must exist
- At least some agent files in `.telos/agents/` must exist

If not found, display: "❌ Telos not initialized. Run `/telos-init` first."

## Validation Process

### Step 1: Load Telos Configuration

Read `.telos/TELOS.md` to extract:

- Ultimate purpose (L9)
- 9-level hierarchy definitions
- Detected technology stack

### Step 2: Analyze Current Codebase

Check for alignment issues:

#### L1 (Syntax-Linter) Validation

- Run detected linters: `npm run lint` or equivalent
- Check for linting errors
- Report: ✅ Passes / ❌ Fails with [N] errors

#### L2 (Function-Author) Validation

- Run tests: `npm test` or equivalent
- Check test coverage
- Report: ✅ [X]% coverage / ❌ Below threshold

#### L3 (Component-Architect) Validation

- Check for components without proper structure
- Look for components violating design patterns
- Report: ✅ Components follow architecture / ⚠️ [N] components need refactoring

#### L4 (Integration-Contractor) Validation

- Check for API contract violations
- Look for breaking changes without versioning
- Report: ✅ API contracts maintained / ⚠️ [N] contract issues

#### L5 (Journey-Validator) Validation

- Look for missing E2E tests for critical flows
- Check if user journeys are documented
- Report: ✅ User journeys validated / ⚠️ [N] flows untested

#### L6 (UX-Simulator) Validation

- Check for accessibility issues (if tools available)
- Look for UX inconsistencies
- Report: ✅ UX standards met / ⚠️ [N] UX issues

#### L7 (Insight-Synthesizer) Validation

- Check if recent changes align with product strategy
- Look for features without clear user value
- Report: ✅ Strategy aligned / ⚠️ [N] strategic misalignments

#### L8 (Market-Analyst) Validation

- Check if metrics/analytics are tracked
- Look for features without measurable outcomes
- Report: ✅ Business value tracked / ⚠️ [N] untracked features

#### L9 (Telos-Guardian) Validation

- Review recent changes against ultimate purpose
- Look for purpose drift
- Report: ✅ Purpose aligned / ⚠️ Potential purpose drift detected

## Validation Report

Display results in a table:

| Level | Agent                  | Status   | Issues        |
| ----- | ---------------------- | -------- | ------------- |
| L9    | Telos-Guardian         | ✅/⚠️/❌ | [Description] |
| L8    | Market-Analyst         | ✅/⚠️/❌ | [Description] |
| L7    | Insight-Synthesizer    | ✅/⚠️/❌ | [Description] |
| L6    | UX-Simulator           | ✅/⚠️/❌ | [Description] |
| L5    | Journey-Validator      | ✅/⚠️/❌ | [Description] |
| L4    | Integration-Contractor | ✅/⚠️/❌ | [Description] |
| L3    | Component-Architect    | ✅/⚠️/❌ | [Description] |
| L2    | Function-Author        | ✅/⚠️/❌ | [Description] |
| L1    | Syntax-Linter          | ✅/⚠️/❌ | [Description] |

**Overall Status**: ✅ Fully aligned / ⚠️ Needs attention / ❌ Critical
misalignment

## Detailed Findings

For each ⚠️ or ❌ status, provide:

**[Level] - [Issue Description]**

- **Problem**: What's misaligned
- **Impact**: How it violates purpose
- **Suggestion**: How to fix

Example:

```
L2 (Function-Author) - Low Test Coverage
- **Problem**: Test coverage is 45%, below 80% threshold
- **Impact**: Violates L2 purpose of "Write TDD functions with Vitest coverage >80%"
- **Suggestion**: Add tests for modules in src/utils/ and src/services/
```

## Next Steps

If validation passes (all ✅): "🎉 Your codebase is fully aligned with Telos!
Keep up the great work."

If warnings found (⚠️): "⚠️ Some alignment issues detected. Address these to
maintain Telos integrity."

If critical issues (❌): "❌ Critical misalignment detected. These issues
violate core Telos principles and should be addressed urgently."

## Validation Frequency

Recommend:

- Run `/telos-validate` before major releases
- Run after completing significant features
- Run when onboarding new team members
- Integrate into CI/CD pipeline (via CLI: `telos validate`)
