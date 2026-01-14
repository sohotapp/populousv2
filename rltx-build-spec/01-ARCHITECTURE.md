# RLTX Simulation System - Core Architecture

## Overview

RLTX is a **multi-agent behavioral simulation platform**. It predicts how humans will behave by simulating thousands of AI agents that reason like real people.

**Core insight**: We don't ask "what is the answer?" We ask "what would 10,000 different people say, and why?"

---

## System Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                                │
│  Natural language questions → Results with confidence + explanations    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         COMPOSITION LAYER                               │
│  Claude Opus 4.5 converts question → execution graph                    │
│  Uses few-shot patterns + primitive library                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXECUTION ENGINE                                │
│  Traverses graph, executes primitives, manages state                    │
│  Parallelization, caching, batching for scale                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │   AGENT     │ │ POPULATION  │ │   DATA      │
            │   SYSTEM    │ │   SYSTEM    │ │   LAYER     │
            │             │ │             │ │             │
            │ Prompt      │ │ IPF Gen     │ │ Postgres    │
            │ Compiler    │ │ Sampling    │ │ Neo4j       │
            │ LLM Router  │ │ Weighting   │ │ Pinecone    │
            │ Parser      │ │ Filtering   │ │ Redis       │
            └─────────────┘ └─────────────┘ └─────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        CALIBRATION SYSTEM                               │
│  Backtest against ground truth → Error analysis → Adjustment            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Design Principles

### 1. Agent is the Atom
Everything reduces to: **"Ask a simulated person a question, get their answer and reasoning."**

All orchestration patterns (Monte Carlo, ABM, Game Theory) are just different ways of organizing agent reasoning calls.

### 2. Structure is Deterministic, Parameters are Dynamic
For known question types, the workflow STRUCTURE should be consistent. Claude parameterizes templates rather than inventing from scratch.

### 3. Every Prediction Has a Trace
Full reasoning chain from question → graph → agent responses → aggregation → result. No black boxes.

### 4. Calibration is Continuous
Every simulation with known ground truth feeds back into model improvement.

---

## Primitive Categories

RLTX uses **18 core primitives** organized into 6 categories:

| Category | Purpose | Primitives |
|----------|---------|------------|
| **Agent** | Individual reasoning | `agent.create`, `agent.reason`, `agent.converse` |
| **Population** | Manage agent collections | `population.sample`, `population.filter`, `population.segment` |
| **Orchestrate** | Run multi-agent patterns | `orchestrate.monte_carlo`, `orchestrate.game_theory`, `orchestrate.abm` |
| **Aggregate** | Combine results | `aggregate.distribution`, `aggregate.weighted`, `aggregate.consensus` |
| **Branch** | Counterfactuals | `branch.scenario`, `branch.compare`, `branch.merge` |
| **Analyze** | Interpret results | `analyze.factors`, `analyze.sensitivity`, `analyze.uncertainty` |

---

## Execution Model

### Node State Machine
```
PENDING → RUNNING → COMPLETED
              ↓
           FAILED
```

### Data Flow
- Each node receives `inputs` (from upstream nodes or initial context)
- Each node produces `outputs` (passed to downstream nodes)
- Outputs include: `result`, `confidence`, `trace`, `metadata`

### Parallelization Rules
- `orchestrate.monte_carlo`: All agents run in parallel
- `orchestrate.game_theory`: Agents within iteration run in parallel; iterations are sequential
- `orchestrate.abm`: Agents within timestep run in parallel; timesteps are sequential
- `branch.scenario`: All branches run in parallel

---

## Model Selection

| Task | Model | Rationale |
|------|-------|-----------|
| Workflow composition | `claude-opus-4-5-20250514` | Complex reasoning about simulation structure |
| Strategic actors (game theory) | `claude-opus-4-5-20250514` | Reasoning about other agents' reasoning |
| Standard agent reasoning | `claude-sonnet-4-20250514` | Good balance of quality and cost |
| Simple binary questions | `claude-haiku-3-5-20241022` | High volume, low complexity |
| Batch similar agents | Sonnet with batching | Amortize latency across similar prompts |

---

## File Structure

```
rltx-spec/
├── 01-ARCHITECTURE.md          # This file
├── 02-PRIMITIVES.md            # Complete primitive definitions
├── 03-COMPOSITION-PROMPT.md    # System prompt for workflow generation
├── 04-FEW-SHOT-PATTERNS.md     # Canonical workflow patterns
├── 05-AGENT-PROMPTS.md         # Agent prompt templates
├── 06-CALIBRATION.md           # Calibration methodology
├── 07-DATA-MODELS.md           # Database schemas
└── 08-IMPLEMENTATION.md        # Code structure guidance
```
