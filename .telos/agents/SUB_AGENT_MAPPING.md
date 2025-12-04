# Sub-Agent Mapping to Telos Levels

This document maps the 15 specialized sub-agents to the 9 Telos levels, showing which sub-agents each level can delegate to for specific tasks.

## Sub-Agent Overview

All sub-agents are located in `templates/agents/sub-agents/` and are available for delegation via the Task tool.

### Available Sub-Agents

1. **api-design.md** - REST/GraphQL API design, authentication, validation
2. **code-reviewer.md** - Code quality review, best practices validation
3. **component-implementation.md** - UI component creation, accessibility, responsiveness
4. **database-design.md** - Database schema, queries, optimization
5. **devops.md** - Deployment, CI/CD, infrastructure, monitoring
6. **documentation.md** - Technical documentation, guides, API docs
7. **feature-implementation.md** - Feature development, business logic
8. **infrastructure.md** - Cloud infrastructure, scalability, reliability
9. **polish.md** - Code optimization, performance tuning, refinement
10. **prd.md** - Product requirements documents, user stories
11. **quality.md** - QA, accessibility, security, performance testing
12. **refactoring.md** - Code restructuring, technical debt reduction
13. **research.md** - Technical research, library comparison, best practices
14. **security-audit.md** - Security review, vulnerability assessment
15. **testing.md** - Test creation, test strategy, coverage

## Telos Level Mapping

### L9: Telos-Guardian (Ultimate Purpose)

**Primary Sub-Agents:**
- `prd.md` - Understanding product requirements at strategic level
- `research.md` - Strategic technology research and direction

**Use Cases:**
- Validating feature alignment with ultimate purpose
- Researching strategic technology decisions
- Understanding product vision from requirements

**Example Delegation:**
```markdown
Use the research subagent to analyze whether adopting [technology] aligns with our ultimate purpose of [goal].
```

---

### L8: Market-Analyst (Business Value)

**Primary Sub-Agents:**
- `prd.md` - Understanding market needs and user requirements
- `research.md` - Competitive analysis and market trends

**Use Cases:**
- Analyzing feature business value
- Competitive technology research
- Market validation of technical decisions

**Example Delegation:**
```markdown
Use the prd subagent to create user stories that demonstrate business value for [feature].
```

---

### L7: Insight-Synthesizer (Product Strategy)

**Primary Sub-Agents:**
- `prd.md` - Product requirements and feature specifications
- `research.md` - Feature research and best practices

**Use Cases:**
- Creating comprehensive PRDs
- Researching product features
- Defining product strategy

**Example Delegation:**
```markdown
Use the prd subagent to create a comprehensive PRD for [feature] with user stories and acceptance criteria.
```

---

### L6: UX-Simulator (Experience Design)

**Primary Sub-Agents:**
- `component-implementation.md` - UI component creation
- `research.md` - UX patterns and accessibility research

**Secondary Sub-Agents:**
- `quality.md` - Accessibility validation
- `testing.md` - User journey testing

**Use Cases:**
- Designing user interfaces
- Implementing accessible components
- Researching UX patterns

**Example Delegation:**
```markdown
Use the component-implementation subagent to create an accessible [component] following WCAG 2.1 AA standards.
```

---

### L5: Journey-Validator (Workflow Verification)

**Primary Sub-Agents:**
- `testing.md` - User journey and E2E testing
- `quality.md` - Workflow quality assurance

**Secondary Sub-Agents:**
- `component-implementation.md` - User interaction implementation

**Use Cases:**
- Creating user journey tests
- Validating workflow completion
- Testing user interactions

**Example Delegation:**
```markdown
Use the testing subagent to create E2E tests that validate the [workflow] user journey.
```

---

### L4: Integration-Contractor (API Contracts)

**Primary Sub-Agents:**
- `api-design.md` - REST/GraphQL API design
- `database-design.md` - Data contracts and schemas

**Secondary Sub-Agents:**
- `devops.md` - API deployment
- `documentation.md` - API documentation
- `testing.md` - API testing

**Use Cases:**
- Designing API endpoints
- Defining data contracts
- API documentation

**Example Delegation:**
```markdown
Use the api-design subagent to design a RESTful API for [resource] with proper authentication and validation.
```

---

### L3: Component-Architect (Component Design)

**Primary Sub-Agents:**
- `component-implementation.md` - Component creation and design
- `feature-implementation.md` - Feature-level components

**Secondary Sub-Agents:**
- `refactoring.md` - Component refactoring
- `quality.md` - Component quality review
- `testing.md` - Component testing

**Use Cases:**
- Creating reusable components
- Refactoring component architecture
- Component quality assurance

**Example Delegation:**
```markdown
Use the component-implementation subagent to create a reusable [component] that follows our design system.
```

---

### L2: Function-Author (Function Implementation)

**Primary Sub-Agents:**
- `feature-implementation.md` - Feature and function implementation
- `refactoring.md` - Function refactoring

**Secondary Sub-Agents:**
- `polish.md` - Code optimization
- `database-design.md` - Data access functions
- `testing.md` - Unit testing

**Use Cases:**
- Implementing business logic
- Refactoring functions
- Optimizing code performance

**Example Delegation:**
```markdown
Use the feature-implementation subagent to implement the [function] with proper error handling and validation.
```

---

### L1: Syntax-Linter (Code Quality)

**Primary Sub-Agents:**
- `code-reviewer.md` - Code quality review
- `quality.md` - Quality assurance
- `security-audit.md` - Security review

**Secondary Sub-Agents:**
- `testing.md` - Test quality validation
- `refactoring.md` - Code cleanup

**Use Cases:**
- Code quality review
- Security audits
- Compliance validation

**Example Delegation:**
```markdown
Use the quality subagent to review [code] for quality, accessibility, security, and performance issues.
```

---

## Cross-Cutting Sub-Agents

These sub-agents can be used by ANY Telos level as needed:

### research.md
**Used by:** All levels
**Purpose:** Technical research, library comparison, best practices
**Example:** "Research the best state management library for React"

### documentation.md
**Used by:** All levels
**Purpose:** Technical documentation, guides, README files
**Example:** "Document the API endpoints with OpenAPI specification"

### devops.md
**Used by:** L4, L3, L2, L1
**Purpose:** Deployment, CI/CD, infrastructure
**Example:** "Set up CI/CD pipeline for automated testing and deployment"

### infrastructure.md
**Used by:** L4, L3, L2
**Purpose:** Cloud infrastructure, scalability
**Example:** "Design scalable infrastructure for high-traffic application"

### testing.md
**Used by:** All levels
**Purpose:** Test creation, test strategy
**Example:** "Create comprehensive test suite with unit, integration, and E2E tests"

### quality.md
**Used by:** All levels
**Purpose:** Quality assurance, validation
**Example:** "Validate code quality, accessibility, and security"

## Delegation Guidelines

### When to Delegate

1. **Specialization Needed** - Task requires deep expertise in a specific area
2. **Time-Intensive** - Task would consume significant tokens if done inline
3. **Parallel Work** - Multiple sub-agents can work on different aspects simultaneously
4. **Separation of Concerns** - Keep validation logic separate from implementation

### How to Delegate

Use the Task tool with the appropriate subagent:

```markdown
Use the [subagent-name] subagent to [specific task description].
```

### Delegation Best Practices

1. **Be Specific** - Provide clear, detailed instructions
2. **Provide Context** - Share relevant codebase patterns and requirements
3. **Set Expectations** - Clarify what deliverables you expect
4. **Review Results** - Always review sub-agent output for alignment with Telos level requirements

## Example Multi-Agent Workflows

### Full-Stack Feature Implementation

1. **L7 (Insight-Synthesizer)** → `prd.md` - Create feature PRD
2. **L4 (Integration-Contractor)** → `api-design.md` - Design API endpoints
3. **L4 (Integration-Contractor)** → `database-design.md` - Design data schema
4. **L3 (Component-Architect)** → `component-implementation.md` - Create UI components
5. **L2 (Function-Author)** → `feature-implementation.md` - Implement business logic
6. **L1 (Syntax-Linter)** → `quality.md` - Quality review
7. **L1 (Syntax-Linter)** → `security-audit.md` - Security review
8. **L5 (Journey-Validator)** → `testing.md` - Create E2E tests

### Code Quality Improvement

1. **L1 (Syntax-Linter)** → `code-reviewer.md` - Initial code review
2. **L1 (Syntax-Linter)** → `security-audit.md` - Security audit
3. **L2 (Function-Author)** → `refactoring.md` - Refactor code
4. **L2 (Function-Author)** → `polish.md` - Optimize performance
5. **L1 (Syntax-Linter)** → `quality.md` - Final quality validation
6. **All Levels** → `documentation.md` - Update documentation

### New Technology Adoption

1. **L9 (Telos-Guardian)** → `research.md` - Strategic technology research
2. **L8 (Market-Analyst)** → `research.md` - Competitive analysis
3. **L7 (Insight-Synthesizer)** → `prd.md` - Migration plan PRD
4. **L4 (Integration-Contractor)** → `api-design.md` - API compatibility review
5. **L3 (Component-Architect)** → `component-implementation.md` - Component migration
6. **L1 (Syntax-Linter)** → `quality.md` - Quality validation
7. **All Levels** → `documentation.md` - Update documentation

---

## Gap Analysis

After integrating these 15 sub-agents, the following areas are well-covered:

✅ **Covered Areas:**
- API Design
- UI Components
- Code Quality
- Security
- Testing
- DevOps/Infrastructure
- Documentation
- Research
- Database Design
- Refactoring
- Feature Implementation
- Product Requirements

❓ **Potential Gaps:**

The following specialized agents could be added if needed:

1. **performance-optimization.md** - Dedicated performance tuning (partially covered by polish.md)
2. **migration.md** - Data/code migration specialist
3. **accessibility.md** - Dedicated accessibility expert (partially covered by quality.md)
4. **internationalization.md** - i18n/l10n specialist
5. **analytics.md** - Analytics implementation and tracking
6. **ai-ml.md** - AI/ML integration specialist
7. **mobile.md** - Mobile-specific development
8. **design-system.md** - Design system creation and maintenance

These gaps are **not critical** as the existing sub-agents provide broad coverage. Additional specialized agents can be created as needed.

---

*This mapping ensures that each Telos level can delegate effectively to specialized sub-agents, maintaining the purpose-driven architecture while leveraging deep domain expertise.*
