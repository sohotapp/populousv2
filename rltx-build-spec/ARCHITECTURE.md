# RLTX Decision Compiler - System Architecture

## Open Source + API-First Implementation

**Version 1.0 | January 2026**

---

## Overview

This document specifies how to build RLTX using open source components and APIs. The architecture follows a **Cursor-style design** (AI-powered workflow canvas) with a **Figma-like canvas** (infinite zoom, real-time collaboration, node-based editing).

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        React + Next.js 14 App                          │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │ │
│  │  │   Command   │  │   Canvas    │  │   Results   │  │   Mobile     │  │ │
│  │  │   (Chat)    │  │   (React    │  │   (Data     │  │   (React     │  │ │
│  │  │   Interface │  │   Flow)     │  │   Viz)      │  │   Native)    │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ WebSocket + REST
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    Hono.js / Next.js API Routes                        │ │
│  │  Authentication (Clerk) │ Rate Limiting │ Request Routing              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
┌───────────────────────┐ ┌───────────────────┐ ┌───────────────────────────┐
│   COMPOSER SERVICE    │ │  EXECUTION ENGINE │ │   LEARNING SERVICE        │
│  ────────────────     │ │  ────────────────  │ │   ─────────────────       │
│  • LangGraph Cloud    │ │  • Temporal.io     │ │   • PostgreSQL + Drizzle  │
│  • Claude API         │ │  • Modal.com       │ │   • TimescaleDB           │
│  • Vector Store       │ │  • Redis Queues    │ │   • Vector embeddings     │
│    (Pinecone/Weaviate)│ │  • WebSocket push  │ │   • Calibration engine    │
└───────────────────────┘ └───────────────────┘ └───────────────────────────┘
                    │                 │                 │
                    └─────────────────┼─────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐               │
│  │   PostgreSQL   │  │     Neo4j      │  │   EventStore   │               │
│  │   (Neon.tech)  │  │   (Ontology)   │  │   (Audit Log)  │               │
│  │                │  │                │  │                │               │
│  │ • Workflows    │  │ • Entities     │  │ • Executions   │               │
│  │ • Users        │  │ • Relations    │  │ • Decisions    │               │
│  │ • Templates    │  │ • Actions      │  │ • Outcomes     │               │
│  └────────────────┘  └────────────────┘  └────────────────┘               │
│                                                                             │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐               │
│  │     Redis      │  │       S3       │  │   Pinecone     │               │
│  │   (Upstash)    │  │   (Cloudflare  │  │   (Vectors)    │               │
│  │                │  │    R2)         │  │                │               │
│  │ • State        │  │ • Documents    │  │ • Templates    │               │
│  │ • Cache        │  │ • Artifacts    │  │ • Patterns     │               │
│  │ • Queues       │  │ • Evidence     │  │ • Decisions    │               │
│  └────────────────┘  └────────────────┘  └────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL INTEGRATIONS                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ Claude  │  │ OpenAI  │  │Salesforce│ │Bloomberg│  │ Firecrawl│          │
│  │   API   │  │   API   │  │   API   │  │   API   │  │   API   │          │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Frontend (Cursor-Style Interface)

The frontend combines:
- **Command Interface**: Chat-first, like ChatGPT/Cursor
- **Canvas Interface**: Node-based workflow editor, like n8n/Figma
- **Results Interface**: Data visualization and decision support

**Key Libraries:**
```
React 18 + Next.js 14 (App Router)
├── @xyflow/react (ReactFlow v12)     # Canvas/node editor
├── @radix-ui/themes                  # Component library
├── @tanstack/react-query             # Data fetching
├── zustand                           # State management
├── framer-motion                     # Animations
├── @uiw/react-codemirror             # Code editing
├── recharts                          # Charts
└── socket.io-client                  # Real-time updates
```

### 2. Workflow Composer (AI-Powered)

Converts natural language questions into executable workflow DAGs.

**Stack:**
- LangGraph Cloud (workflow orchestration)
- Claude API (reasoning, composition)
- Pinecone (template matching via embeddings)

### 3. Execution Engine

Runs workflows with parallel execution, checkpointing, and streaming results.

**Stack:**
- Temporal.io (durable execution, state machines)
- Modal.com (serverless compute for simulations)
- Redis (state, queues, pub/sub)

### 4. Data Layer

- **PostgreSQL (Neon)**: Core data (users, workflows, templates)
- **Neo4j AuraDB**: Ontology graph (entities, relationships, actions)
- **EventStore**: Append-only audit log for compliance
- **Redis (Upstash)**: Caching, real-time state, pub/sub
- **S3/R2**: Document storage, artifacts

---

## The Canvas Architecture (Figma-Style)

The canvas is the heart of the product. It must support:

1. **Infinite Canvas**: Pan/zoom like Figma
2. **Semantic Zoom**: Show different detail levels at different zoom levels
3. **Real-time Collaboration**: Multiple users editing simultaneously
4. **Live Execution**: Nodes animate during workflow execution
5. **History/Undo**: Full undo/redo stack

### Canvas Data Model

```typescript
interface Canvas {
  id: string;
  workflowId: string;

  // Viewport state
  viewport: {
    x: number;
    y: number;
    zoom: number;  // 0.1 to 4.0
  };

  // Nodes (primitives)
  nodes: CanvasNode[];

  // Edges (connections)
  edges: CanvasEdge[];

  // Groups (for semantic zoom)
  groups: CanvasGroup[];

  // Selection state
  selection: {
    nodeIds: string[];
    edgeIds: string[];
  };

  // Collaboration
  collaborators: {
    userId: string;
    cursor: { x: number; y: number };
    selection: string[];
  }[];
}

interface CanvasNode {
  id: string;
  type: 'primitive' | 'group' | 'annotation';
  primitiveId?: string;  // Reference to primitive definition

  // Position and size
  position: { x: number; y: number };
  size: { width: number; height: number };

  // Configuration
  config: Record<string, any>;

  // Visual state
  state: 'idle' | 'pending' | 'running' | 'completed' | 'failed';

  // Execution results (when completed)
  output?: any;
  timing?: { startedAt: string; completedAt: string; durationMs: number };
}

interface CanvasEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;

  // Data transformation (optional)
  transform?: string;  // JSONPath expression

  // Visual state
  animated: boolean;
}

interface CanvasGroup {
  id: string;
  name: string;
  nodeIds: string[];
  collapsed: boolean;
  color: string;
}
```

---

## Primitive System

Primitives are the atomic building blocks of workflows.

### Primitive Interface

```typescript
interface Primitive {
  // Identity
  id: string;
  name: string;
  description: string;
  category: 'data' | 'reason' | 'simulate' | 'optimize' | 'human' | 'output' | 'control';
  icon: string;
  color: string;

  // Schema
  inputs: Port[];
  outputs: Port[];
  config: ConfigSchema;

  // Execution
  executor: 'llm' | 'compute' | 'external' | 'human';
  estimatedCost: { tokens?: number; computeMs?: number; dollars: number };
  estimatedTime: { p50: number; p95: number };  // milliseconds

  // Metadata
  tags: string[];
  version: string;
}

interface Port {
  id: string;
  name: string;
  type: 'any' | 'string' | 'number' | 'object' | 'array' | 'distribution';
  schema?: JSONSchema;
  required: boolean;
}

interface ConfigSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    title: string;
    description: string;
    default?: any;
    enum?: any[];
    minimum?: number;
    maximum?: number;
  }>;
  required: string[];
}
```

### Core Primitives (MVP Set)

| Category | Primitive | Description | Executor |
|----------|-----------|-------------|----------|
| **Data** | `data.api.fetch` | Fetch from REST API | External |
| **Data** | `data.doc.parse` | Parse PDF/DOCX | LLM |
| **Data** | `data.crm.salesforce` | Query Salesforce | External |
| **Data** | `data.db.query` | SQL query | External |
| **Reason** | `reason.analyze` | Deep analysis | LLM |
| **Reason** | `reason.summarize` | Summarize content | LLM |
| **Reason** | `reason.compare` | Compare options | LLM |
| **Reason** | `reason.critique` | Pre-mortem analysis | LLM |
| **Simulate** | `sim.montecarlo` | Monte Carlo simulation | Compute |
| **Simulate** | `sim.scenario` | Scenario branching | Compute |
| **Simulate** | `sim.sensitivity` | Sensitivity analysis | Compute |
| **Optimize** | `opt.pareto` | Multi-objective optimization | Compute |
| **Human** | `human.input` | Collect user input | Human |
| **Human** | `human.approve` | Approval gate | Human |
| **Output** | `output.report` | Generate report | LLM |
| **Output** | `output.chart` | Generate visualization | Compute |
| **Control** | `control.condition` | Conditional branching | Internal |
| **Control** | `control.loop` | Iterate over items | Internal |

---

## Real-Time System

### WebSocket Events

```typescript
// Client → Server
interface ClientEvents {
  // Canvas operations
  'canvas:update': { workflowId: string; changes: CanvasChange[] };
  'canvas:cursor': { workflowId: string; cursor: { x: number; y: number } };

  // Execution
  'workflow:run': { workflowId: string };
  'workflow:pause': { workflowId: string };
  'workflow:cancel': { workflowId: string };

  // Human interactions
  'human:respond': { checkpointId: string; response: any };
}

// Server → Client
interface ServerEvents {
  // Canvas sync
  'canvas:sync': { workflowId: string; canvas: Canvas };
  'canvas:update': { workflowId: string; changes: CanvasChange[] };
  'canvas:collaborator': { workflowId: string; collaborator: Collaborator };

  // Execution progress
  'execution:started': { workflowId: string; executionId: string };
  'execution:node:started': { executionId: string; nodeId: string };
  'execution:node:progress': { executionId: string; nodeId: string; progress: number };
  'execution:node:output': { executionId: string; nodeId: string; output: any };
  'execution:node:completed': { executionId: string; nodeId: string; timing: Timing };
  'execution:node:failed': { executionId: string; nodeId: string; error: string };
  'execution:completed': { executionId: string; results: Results };

  // Human checkpoints
  'human:checkpoint': { checkpointId: string; request: HumanRequest };
}
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VERCEL (Edge)                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Next.js App (SSR + Static + API Routes)                               │ │
│  │  • Frontend bundle (React + ReactFlow)                                  │ │
│  │  • API routes (Hono.js)                                                │ │
│  │  • WebSocket proxy                                                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
          ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
          │   Railway.app   │ │   Modal.com     │ │   Temporal.io   │
          │                 │ │                 │ │                 │
          │ • WebSocket     │ │ • Monte Carlo   │ │ • Workflow      │
          │   server        │ │   simulations   │ │   orchestration │
          │ • Background    │ │ • GPU compute   │ │ • Durable       │
          │   jobs          │ │ • LLM calls     │ │   execution     │
          └─────────────────┘ └─────────────────┘ └─────────────────┘
                    │                 │                 │
                    └─────────────────┼─────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MANAGED SERVICES                                   │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│  │ Neon.tech │  │  Upstash  │  │Neo4j Aura │  │ Pinecone  │               │
│  │(PostgreSQL)│  │  (Redis)  │  │  (Graph)  │  │ (Vectors) │               │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘               │
│                                                                             │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐                              │
│  │Cloudflare │  │   Clerk   │  │  Resend   │                              │
│  │    R2     │  │  (Auth)   │  │ (Email)   │                              │
│  │ (Storage) │  │           │  │           │                              │
│  └───────────┘  └───────────┘  └───────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cost Estimates (Monthly)

| Service | Plan | Cost |
|---------|------|------|
| Vercel | Pro | $20 |
| Railway | Pro | $20 |
| Neon | Launch | $19 |
| Upstash | Pay-as-you-go | ~$10 |
| Neo4j Aura | Free tier | $0 |
| Pinecone | Starter | $0 |
| Clerk | Pro | $25 |
| Cloudflare R2 | Pay-as-you-go | ~$5 |
| **Infrastructure Total** | | **~$99/month** |

| API | Estimated Usage | Cost |
|-----|-----------------|------|
| Claude API | 1M tokens/month | ~$15 |
| OpenAI (backup) | 100K tokens | ~$5 |
| Modal.com | 100 GPU hours | ~$50 |
| Temporal | Free tier | $0 |
| **API Total** | | **~$70/month** |

**Total MVP Cost: ~$170/month**

---

## Next Steps

1. **TECH_STACK.md** - Detailed open source component selection
2. **FRONTEND_CANVAS.md** - Canvas implementation with ReactFlow
3. **API_SPEC.md** - Complete API specification
4. **IMPLEMENTATION_PLAN.md** - Week-by-week build plan
