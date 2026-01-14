# RLTX Simulation Platform - Complete Technical Specification

## What Is This?

This is a **production-grade specification** for building the RLTX multi-agent behavioral simulation platform. It's designed to be fed directly to Claude Code or any AI coding assistant to implement the system correctly.

## What RLTX Does

RLTX predicts how humans will behave by simulating thousands of AI agents that think like real people.

**Core insight**: Instead of asking "what is the answer?", we ask "what would 10,000 different people say, and why?"

### Three Verticals

| Vertical | Use Case | Example |
|----------|----------|---------|
| **Enterprise** | Consumer behavior prediction | "What if we raise prices 20%?" |
| **Defense** | Adversary modeling & wargaming | "How does Country X respond to sanctions?" |
| **Policy** | Citizen response modeling | "How will voters react to this regulation?" |

## Document Structure

| File | Purpose | Key Contents |
|------|---------|--------------|
| **01-ARCHITECTURE.md** | System overview | Components, data flow, design principles |
| **02-PRIMITIVES.md** | Complete primitive reference | 18 primitives with full I/O specs |
| **03-COMPOSITION-PROMPT.md** | Workflow generation | System prompt for Claude Opus |
| **04-FEW-SHOT-PATTERNS.md** | Canonical patterns | 6 workflow templates with full JSON |
| **05-AGENT-PROMPTS.md** | Agent prompt templates | Consumer, strategic, ABM agents |
| **06-CALIBRATION.md** | Accuracy methodology | How to validate and tune the system |
| **07-DATA-MODELS.md** | TypeScript types | All data structures |
| **08-IMPLEMENTATION.md** | Code structure | File layout, key implementations |

## How to Use This Specification

### For Claude Code / AI Assistants

1. Start with **01-ARCHITECTURE.md** to understand the system
2. Read **02-PRIMITIVES.md** for the building blocks
3. Implement primitives following **08-IMPLEMENTATION.md**
4. Use **03-COMPOSITION-PROMPT.md** for the composition API
5. Apply **04-FEW-SHOT-PATTERNS.md** for workflow templates
6. Implement agent prompts from **05-AGENT-PROMPTS.md**
7. Follow **07-DATA-MODELS.md** for type definitions

### For Human Developers

Read in order: 01 → 02 → 03 → 04 → 05 → 08 → 06 → 07

## Key Technical Decisions

### Model Selection

| Task | Model | Why |
|------|-------|-----|
| Workflow composition | Claude Opus 4.5 | Complex reasoning about simulation structure |
| Strategic actors (game theory) | Claude Opus 4.5 | Reasoning about other agents' reasoning |
| Standard agent reasoning | Claude Sonnet 4 | Good balance of quality and cost |
| Simple binary questions | Claude Haiku 3.5 | High volume, low complexity |

### Primitive Categories

| Category | Primitives | Purpose |
|----------|------------|---------|
| Agent | `create`, `reason`, `converse` | Individual agent operations |
| Population | `sample`, `filter`, `segment` | Agent collection management |
| Orchestrate | `monte_carlo`, `game_theory`, `abm` | Multi-agent execution patterns |
| Aggregate | `distribution`, `weighted`, `consensus` | Result combination |
| Branch | `scenario`, `compare`, `merge` | Counterfactual analysis |
| Analyze | `factors`, `sensitivity`, `uncertainty` | Result interpretation |

### Workflow Patterns

| Pattern | Use When | Structure |
|---------|----------|-----------|
| Consumer Survey | "Would customers buy X?" | sample → monte_carlo → segment → factors |
| Change Impact | "What if we change X?" | sample → scenarios → monte_carlo × N → compare → factors |
| Competitive Response | "How will competitor respond?" | game_theory → consumer scenarios → merge → factors |
| Wargame | "How would adversary respond?" | strategic actors → game_theory → analysis |
| Dynamics | "How does X spread?" | sample → ABM → factors |
| Counterfactual | "Compare A vs B vs C" | sample → scenarios × N → monte_carlo × N → compare |

## Implementation Priorities

### Phase 1: Foundation (Weeks 1-4)
1. Basic primitives (`agent.reason`, `population.sample`, `orchestrate.monte_carlo`)
2. Agent prompt compiler and response parser
3. Simple composition endpoint
4. Database schema and basic API

### Phase 2: Core Product (Weeks 5-8)
1. Full primitive library
2. Game theory orchestration
3. Branching and counterfactuals
4. Results UI with traces

### Phase 3: Production (Weeks 9-12)
1. Calibration pipeline
2. Caching and optimization
3. ABM implementation
4. Full analysis primitives

## Critical Implementation Notes

1. **Every LLM call must be traced** - No black boxes. Full prompts and responses stored.

2. **Parallel execution is essential** - Monte Carlo should batch 50+ concurrent calls.

3. **Cache aggressively** - Same agent + same question = same answer (deterministic).

4. **Validate before executing** - Check workflow structure before running.

5. **Use Opus strategically** - Only for composition and strategic actors.

6. **The prompt IS the product** - Agent prompt quality determines simulation accuracy.

7. **Calibration never stops** - Every simulation with known outcome feeds back.

## Quick Start for Claude Code

```bash
# Tell Claude Code:
"Read the RLTX specification files in order:
1. Start with 01-ARCHITECTURE.md to understand the system
2. Implement the primitives defined in 02-PRIMITIVES.md
3. Follow the file structure in 08-IMPLEMENTATION.md
4. Use the exact prompt templates from 03-COMPOSITION-PROMPT.md
5. Apply the patterns from 04-FEW-SHOT-PATTERNS.md

Start by creating the project structure and basic types from 07-DATA-MODELS.md"
```

## Validation Checklist

Before deploying, verify:

- [ ] All 18 primitives implemented
- [ ] Composition produces valid JSON workflows
- [ ] Monte Carlo executes 10,000 agents in < 3 minutes
- [ ] Game theory converges in < 5 iterations
- [ ] All traces stored correctly
- [ ] Response parsing handles edge cases
- [ ] Error handling gracefully degrades
- [ ] Caching reduces duplicate calls > 80%
- [ ] Calibration pipeline functional
- [ ] UI displays results with traces

## Files in This Specification

```
rltx-spec/
├── README.md                    # This file
├── 01-ARCHITECTURE.md           # System design (7.5KB)
├── 02-PRIMITIVES.md             # Primitive definitions (33KB)
├── 03-COMPOSITION-PROMPT.md     # Claude Opus system prompt (23KB)
├── 04-FEW-SHOT-PATTERNS.md      # Workflow templates (41KB)
├── 05-AGENT-PROMPTS.md          # Agent prompt templates (28KB)
├── 06-CALIBRATION.md            # Accuracy methodology (25KB)
├── 07-DATA-MODELS.md            # TypeScript types (22KB)
└── 08-IMPLEMENTATION.md         # Code structure (37KB)

Total: ~220KB of specification
```

## Questions?

This specification is designed to be complete and self-contained. If something is unclear:

1. Check if it's covered in another document
2. Look for examples in the patterns file
3. Reference the data models for type definitions
4. Check implementation notes for edge cases

---

**Built for RLTX by Claude** | January 2026
