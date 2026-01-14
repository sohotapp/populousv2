# RLTX Implementation Plan

## Phase-by-Phase Build Guide

---

## Overview

This plan builds RLTX incrementally, shipping working software at each phase. Each phase builds on the previous, adding capabilities while maintaining a usable product.

---

## Phase 1: Foundation (MVP)

**Goal:** Working canvas with basic primitives, chat-to-workflow, and manual execution.

### 1.1 Project Setup

```bash
# Create Next.js project
npx create-next-app@latest rltx-app --typescript --tailwind --eslint --app --src-dir

cd rltx-app

# Install core dependencies
npm install @xyflow/react zustand @tanstack/react-query framer-motion
npm install @radix-ui/themes lucide-react sonner
npm install drizzle-orm postgres @neondatabase/serverless
npm install @clerk/nextjs
npm install zod react-hook-form @hookform/resolvers

# Install dev dependencies
npm install -D drizzle-kit @types/node tsx
```

### 1.2 Database Schema

```typescript
// src/db/schema.ts
import { pgTable, uuid, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const workflows = pgTable('workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  question: text('question').notNull(),
  graph: jsonb('graph').notNull().$type<WorkflowGraph>(),
  status: text('status').notNull().default('draft'),
  orgId: uuid('org_id').references(() => organizations.id),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const executions = pgTable('executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id').references(() => workflows.id),
  status: text('status').notNull(),
  nodeResults: jsonb('node_results').$type<Record<string, NodeResult>>(),
  results: jsonb('results').$type<ExecutionResults>(),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const templates = pgTable('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  graph: jsonb('graph').notNull().$type<WorkflowGraph>(),
  isPublic: boolean('is_public').default(false),
  orgId: uuid('org_id').references(() => organizations.id),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### 1.3 Primitive Definitions

```typescript
// src/lib/primitives/index.ts
import { Primitive } from '@/types/primitive';

export const primitives: Record<string, Primitive> = {
  // Data primitives
  'data.api.fetch': {
    id: 'data.api.fetch',
    name: 'API Fetch',
    description: 'Fetch data from REST API',
    category: 'data',
    icon: '🔗',
    color: '#3b82f6',
    inputs: [
      { id: 'url', name: 'URL', type: 'string', required: true },
    ],
    outputs: [
      { id: 'response', name: 'Response', type: 'object' },
    ],
    config: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' },
        headers: { type: 'object' },
      },
    },
    executor: 'external',
    estimatedCost: { dollars: 0.01 },
    estimatedTime: { p50: 1000, p95: 5000 },
  },

  // Reason primitives
  'reason.analyze': {
    id: 'reason.analyze',
    name: 'Deep Analysis',
    description: 'Use Claude for complex reasoning',
    category: 'reason',
    icon: '🧠',
    color: '#8b5cf6',
    inputs: [
      { id: 'data', name: 'Data', type: 'any', required: true },
      { id: 'context', name: 'Context', type: 'string', required: false },
    ],
    outputs: [
      { id: 'analysis', name: 'Analysis', type: 'object' },
    ],
    config: {
      type: 'object',
      properties: {
        prompt: { type: 'string', title: 'Custom Prompt' },
        model: { type: 'string', enum: ['claude-3-opus', 'claude-3-sonnet'], default: 'claude-3-sonnet' },
      },
    },
    executor: 'llm',
    estimatedCost: { dollars: 2.50 },
    estimatedTime: { p50: 15000, p95: 45000 },
  },

  'reason.compare': {
    id: 'reason.compare',
    name: 'Compare Options',
    description: 'Compare multiple options with pros/cons',
    category: 'reason',
    icon: '⚖️',
    color: '#8b5cf6',
    inputs: [
      { id: 'options', name: 'Options', type: 'array', required: true },
    ],
    outputs: [
      { id: 'comparison', name: 'Comparison', type: 'object' },
    ],
    config: {
      type: 'object',
      properties: {
        criteria: { type: 'array', items: { type: 'string' } },
      },
    },
    executor: 'llm',
    estimatedCost: { dollars: 1.50 },
    estimatedTime: { p50: 10000, p95: 30000 },
  },

  'reason.critique': {
    id: 'reason.critique',
    name: 'Pre-Mortem',
    description: 'Analyze what could go wrong',
    category: 'reason',
    icon: '🔍',
    color: '#ef4444',
    inputs: [
      { id: 'plan', name: 'Plan', type: 'object', required: true },
    ],
    outputs: [
      { id: 'critique', name: 'Critique', type: 'object' },
    ],
    config: {
      type: 'object',
      properties: {
        perspective: { type: 'string', enum: ['skeptic', 'competitor', 'regulator'] },
      },
    },
    executor: 'llm',
    estimatedCost: { dollars: 2.00 },
    estimatedTime: { p50: 12000, p95: 35000 },
  },

  // Simulate primitives
  'sim.montecarlo': {
    id: 'sim.montecarlo',
    name: 'Monte Carlo',
    description: 'Run probabilistic simulations',
    category: 'simulate',
    icon: '🎲',
    color: '#f59e0b',
    inputs: [
      { id: 'model', name: 'Model', type: 'object', required: true },
      { id: 'distributions', name: 'Distributions', type: 'object', required: true },
    ],
    outputs: [
      { id: 'results', name: 'Results', type: 'distribution' },
    ],
    config: {
      type: 'object',
      properties: {
        rollouts: { type: 'number', default: 10000, minimum: 100, maximum: 100000 },
        timeHorizon: { type: 'number', default: 5, title: 'Years' },
        confidenceInterval: { type: 'number', default: 0.95 },
      },
    },
    executor: 'compute',
    estimatedCost: { dollars: 3.00 },
    estimatedTime: { p50: 30000, p95: 90000 },
  },

  // Output primitives
  'output.report': {
    id: 'output.report',
    name: 'Evidence Pack',
    description: 'Generate board-ready report',
    category: 'output',
    icon: '📋',
    color: '#22c55e',
    inputs: [
      { id: 'recommendation', name: 'Recommendation', type: 'object', required: true },
      { id: 'evidence', name: 'Evidence', type: 'array', required: true },
    ],
    outputs: [
      { id: 'report', name: 'Report', type: 'document' },
    ],
    config: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['pdf', 'markdown', 'docx'], default: 'pdf' },
        template: { type: 'string', enum: ['executive', 'detailed', 'technical'] },
      },
    },
    executor: 'llm',
    estimatedCost: { dollars: 1.00 },
    estimatedTime: { p50: 20000, p95: 60000 },
  },
};
```

### 1.4 Canvas Page

```typescript
// src/app/workflow/[id]/page.tsx
import { Canvas } from '@/components/canvas/Canvas';
import { PrimitiveLibrary } from '@/components/primitives/PrimitiveLibrary';
import { Inspector } from '@/components/inspector/Inspector';
import { CanvasProvider } from '@/providers/CanvasProvider';

export default async function WorkflowPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <CanvasProvider workflowId={params.id}>
      <div className="flex h-screen">
        {/* Left: Primitive Library */}
        <div className="w-64 border-r bg-gray-50 overflow-y-auto">
          <PrimitiveLibrary />
        </div>

        {/* Center: Canvas */}
        <div className="flex-1">
          <Canvas workflowId={params.id} />
        </div>

        {/* Right: Inspector */}
        <div className="w-80 border-l bg-white overflow-y-auto">
          <Inspector />
        </div>
      </div>
    </CanvasProvider>
  );
}
```

### 1.5 Chat-to-Workflow Composer

```typescript
// src/lib/composer/index.ts
import Anthropic from '@anthropic-ai/sdk';
import { primitives } from '@/lib/primitives';

const anthropic = new Anthropic();

export async function composeWorkflow(question: string, context?: string) {
  const primitiveDescriptions = Object.values(primitives)
    .map(p => `- ${p.id}: ${p.description} (${p.category})`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are a decision workflow composer. Given a business question, design an optimal workflow using available primitives.

Available primitives:
${primitiveDescriptions}

Question: ${question}
${context ? `Context: ${context}` : ''}

Design a workflow DAG that:
1. Gathers necessary data
2. Performs appropriate analysis
3. Runs simulations if uncertainty is high
4. Generates a recommendation

Output as JSON:
{
  "name": "Workflow name",
  "nodes": [
    { "id": "node_1", "primitiveId": "...", "config": {...}, "position": { "x": 100, "y": 100 } }
  ],
  "edges": [
    { "id": "edge_1", "source": "node_1", "sourceHandle": "output", "target": "node_2", "targetHandle": "data" }
  ],
  "explanation": "Brief explanation of the workflow"
}`,
    }],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  // Parse JSON from response
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in response');

  return JSON.parse(jsonMatch[0]);
}
```

### 1.6 Basic Execution Engine

```typescript
// src/lib/executor/index.ts
import { WorkflowGraph, NodeResult } from '@/types/workflow';
import { executeNode } from './node-executors';

export async function executeWorkflow(
  graph: WorkflowGraph,
  onProgress: (nodeId: string, state: string, output?: any) => void
): Promise<Record<string, NodeResult>> {
  const results: Record<string, NodeResult> = {};

  // Topological sort
  const order = topologicalSort(graph);

  for (const nodeId of order) {
    const node = graph.nodes.find(n => n.id === nodeId)!;

    onProgress(nodeId, 'running');

    try {
      // Collect inputs from upstream nodes
      const inputs = collectInputs(node, graph, results);

      // Execute the node
      const startTime = Date.now();
      const output = await executeNode(node.primitiveId, node.config, inputs);
      const endTime = Date.now();

      results[nodeId] = {
        state: 'completed',
        output,
        timing: {
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date(endTime).toISOString(),
          durationMs: endTime - startTime,
        },
      };

      onProgress(nodeId, 'completed', output);
    } catch (error) {
      results[nodeId] = {
        state: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      onProgress(nodeId, 'failed');
      throw error;
    }
  }

  return results;
}

function topologicalSort(graph: WorkflowGraph): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  function visit(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    // Visit all nodes that this node depends on
    const incomingEdges = graph.edges.filter(e => e.target === nodeId);
    for (const edge of incomingEdges) {
      visit(edge.source);
    }

    result.push(nodeId);
  }

  for (const node of graph.nodes) {
    visit(node.id);
  }

  return result;
}

function collectInputs(
  node: any,
  graph: WorkflowGraph,
  results: Record<string, NodeResult>
): Record<string, any> {
  const inputs: Record<string, any> = {};

  const incomingEdges = graph.edges.filter(e => e.target === node.id);
  for (const edge of incomingEdges) {
    const sourceResult = results[edge.source];
    if (sourceResult?.output) {
      inputs[edge.targetHandle] = sourceResult.output;
    }
  }

  return inputs;
}
```

### Phase 1 Deliverables

- [ ] Next.js app with Clerk auth
- [ ] PostgreSQL database with Drizzle
- [ ] ReactFlow canvas with drag-and-drop
- [ ] Primitive library sidebar
- [ ] Inspector panel for configuration
- [ ] Chat interface for workflow composition
- [ ] Basic sequential execution
- [ ] Results view with recommendation

---

## Phase 2: Real-Time & Collaboration

**Goal:** WebSocket-based live updates, multi-user collaboration, streaming execution.

### 2.1 WebSocket Server

```typescript
// src/server/socket.ts
import { Server } from 'socket.io';
import { verifyClerkToken } from './auth';

export function createSocketServer(httpServer: any) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL,
      methods: ['GET', 'POST'],
    },
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    try {
      const user = await verifyClerkToken(token);
      socket.data.userId = user.id;
      socket.data.orgId = socket.handshake.query.orgId;
      next();
    } catch (err) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.data.userId} connected`);

    // Workflow room management
    socket.on('workflow:join', async ({ workflowId }) => {
      socket.join(`workflow:${workflowId}`);

      // Notify others
      socket.to(`workflow:${workflowId}`).emit('collaborator:joined', {
        userId: socket.data.userId,
        // Get user info...
      });
    });

    socket.on('workflow:leave', ({ workflowId }) => {
      socket.leave(`workflow:${workflowId}`);
      socket.to(`workflow:${workflowId}`).emit('collaborator:left', {
        userId: socket.data.userId,
      });
    });

    // Canvas collaboration
    socket.on('canvas:update', ({ workflowId, changes }) => {
      socket.to(`workflow:${workflowId}`).emit('canvas:update', {
        userId: socket.data.userId,
        changes,
      });
    });

    socket.on('canvas:cursor', ({ workflowId, cursor }) => {
      socket.to(`workflow:${workflowId}`).emit('canvas:cursor', {
        userId: socket.data.userId,
        cursor,
      });
    });

    // Execution control
    socket.on('execution:start', async ({ workflowId }) => {
      // Start execution and stream results...
    });

    socket.on('disconnect', () => {
      // Clean up...
    });
  });

  return io;
}
```

### 2.2 Streaming Execution

```typescript
// src/lib/executor/streaming.ts
export async function executeWorkflowStreaming(
  graph: WorkflowGraph,
  io: Server,
  executionId: string
) {
  const room = `execution:${executionId}`;

  io.to(room).emit('execution:started', { executionId });

  const order = topologicalSort(graph);

  for (const nodeId of order) {
    const node = graph.nodes.find(n => n.id === nodeId)!;

    io.to(room).emit('execution:node:started', {
      executionId,
      nodeId,
    });

    // For LLM nodes, stream the output
    if (isLLMPrimitive(node.primitiveId)) {
      const stream = await executeLLMNodeStreaming(node);

      for await (const chunk of stream) {
        io.to(room).emit('execution:node:output', {
          executionId,
          nodeId,
          output: chunk,
          partial: true,
        });
      }
    }

    // ... execution logic

    io.to(room).emit('execution:node:completed', {
      executionId,
      nodeId,
      output,
      timing,
    });
  }

  io.to(room).emit('execution:completed', {
    executionId,
    results,
  });
}
```

### Phase 2 Deliverables

- [ ] Socket.io server on Railway
- [ ] Real-time canvas sync
- [ ] Collaborator cursors
- [ ] Streaming LLM output
- [ ] Live progress indicators
- [ ] Node state animations

---

## Phase 3: Advanced Execution

**Goal:** Parallel execution, human checkpoints, error handling, Monte Carlo on Modal.

### 3.1 Temporal Workflow

```typescript
// src/workflows/execution.ts
import { proxyActivities, defineWorkflow } from '@temporalio/workflow';

const activities = proxyActivities<typeof activitiesImpl>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 3 },
});

export const executeWorkflowWorkflow = defineWorkflow({
  args: ['workflowId', 'graphJson'],
  async execute(workflowId: string, graphJson: string) {
    const graph = JSON.parse(graphJson);
    const results: Record<string, any> = {};

    // Get execution order with parallel groups
    const groups = getParallelGroups(graph);

    for (const group of groups) {
      // Execute nodes in parallel within each group
      const promises = group.map(async (nodeId) => {
        const node = graph.nodes.find((n: any) => n.id === nodeId);

        // Check for human checkpoint
        if (isHumanPrimitive(node.primitiveId)) {
          return await activities.waitForHumanInput(workflowId, nodeId);
        }

        const inputs = collectInputs(node, graph, results);
        return await activities.executeNode(node.primitiveId, node.config, inputs);
      });

      const groupResults = await Promise.all(promises);

      group.forEach((nodeId, i) => {
        results[nodeId] = groupResults[i];
      });
    }

    return results;
  },
});
```

### 3.2 Modal Monte Carlo

```python
# modal_functions/monte_carlo.py
import modal

app = modal.App("rltx-simulations")

image = modal.Image.debian_slim().pip_install("numpy", "scipy", "pandas")

@app.function(image=image, cpu=4, timeout=300)
def run_monte_carlo(params: dict) -> dict:
    import numpy as np
    from scipy import stats

    n_rollouts = params.get('rollouts', 10000)
    time_horizon = params.get('timeHorizon', 5)
    distributions = params.get('distributions', {})
    model = params.get('model', {})

    results = []

    for _ in range(n_rollouts):
        # Sample from distributions
        samples = {}
        for var, dist in distributions.items():
            if dist['type'] == 'normal':
                samples[var] = np.random.normal(dist['mean'], dist['std'])
            elif dist['type'] == 'triangular':
                samples[var] = np.random.triangular(dist['min'], dist['mode'], dist['max'])
            elif dist['type'] == 'uniform':
                samples[var] = np.random.uniform(dist['min'], dist['max'])

        # Run model
        outcome = evaluate_model(model, samples, time_horizon)
        results.append(outcome)

    results = np.array(results)

    return {
        'mean': float(np.mean(results)),
        'std': float(np.std(results)),
        'percentiles': {
            '5': float(np.percentile(results, 5)),
            '25': float(np.percentile(results, 25)),
            '50': float(np.percentile(results, 50)),
            '75': float(np.percentile(results, 75)),
            '95': float(np.percentile(results, 95)),
        },
        'probability_positive': float(np.mean(results > 0)),
        'var_95': float(np.percentile(results, 5)),
        'histogram': np.histogram(results, bins=50)[0].tolist(),
    }
```

### Phase 3 Deliverables

- [ ] Temporal.io integration
- [ ] Parallel node execution
- [ ] Human checkpoint UI
- [ ] Modal.com compute integration
- [ ] Monte Carlo simulations
- [ ] Error recovery and retries

---

## Phase 4: Results & Tripwires

**Goal:** Rich results visualization, Pareto frontier, tripwire monitoring.

### 4.1 Pareto Frontier Chart

```tsx
// src/components/results/ParetoChart.tsx
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function ParetoChart({ frontier, recommended }: ParetoChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <XAxis
          type="number"
          dataKey="price"
          name="Price"
          tickFormatter={(v) => `$${v / 1e6}M`}
        />
        <YAxis
          type="number"
          dataKey="expectedNpv"
          name="NPV"
          tickFormatter={(v) => `$${v / 1e6}M`}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload;
            return (
              <div className="bg-white p-2 rounded shadow border">
                <p>Price: ${(point.price / 1e6).toFixed(0)}M</p>
                <p>NPV: ${(point.expectedNpv / 1e6).toFixed(0)}M</p>
                <p>P(Success): {(point.probability * 100).toFixed(0)}%</p>
              </div>
            );
          }}
        />
        <Scatter
          data={frontier.points}
          fill="#3b82f6"
          shape={(props) => {
            const isRecommended = props.payload.id === recommended;
            return (
              <circle
                cx={props.cx}
                cy={props.cy}
                r={isRecommended ? 10 : 6}
                fill={isRecommended ? '#22c55e' : '#3b82f6'}
                stroke={isRecommended ? '#166534' : 'none'}
                strokeWidth={2}
              />
            );
          }}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
```

### 4.2 Tripwire Monitor

```typescript
// src/lib/tripwires/monitor.ts
import { CronJob } from 'cron';
import { db } from '@/db';
import { tripwires } from '@/db/schema';
import { eq } from 'drizzle-orm';

export function startTripwireMonitor() {
  // Check tripwires every hour
  const job = new CronJob('0 * * * *', async () => {
    const activeTripwires = await db.query.tripwires.findMany({
      where: eq(tripwires.status, 'active'),
    });

    for (const tripwire of activeTripwires) {
      const currentValue = await fetchDataSource(tripwire.dataSource);

      if (isTriggered(tripwire.condition, currentValue)) {
        await triggerTripwire(tripwire, currentValue);
      }
    }
  });

  job.start();
}

async function triggerTripwire(tripwire: Tripwire, currentValue: any) {
  // Update status
  await db.update(tripwires)
    .set({ status: 'triggered', triggeredAt: new Date() })
    .where(eq(tripwires.id, tripwire.id));

  // Send notifications
  await sendNotifications(tripwire.notifications, {
    tripwireId: tripwire.id,
    executionId: tripwire.executionId,
    condition: tripwire.condition,
    currentValue,
    threshold: tripwire.condition.threshold,
  });

  // Emit WebSocket event
  io.to(`org:${tripwire.orgId}`).emit('tripwire:triggered', {
    tripwireId: tripwire.id,
    // ...
  });
}
```

### Phase 4 Deliverables

- [ ] Results view with recommendation
- [ ] Interactive Pareto chart
- [ ] Sensitivity tornado chart
- [ ] Minority view display
- [ ] Tripwire configuration UI
- [ ] Tripwire monitoring service
- [ ] Email/push notifications

---

## Phase 5: Learning & Calibration

**Goal:** Track outcomes, learn calibration, improve recommendations.

### 5.1 Outcome Recording

```typescript
// src/lib/learning/outcomes.ts
export async function recordOutcome(
  executionId: string,
  outcomes: Record<string, { actual: number; predicted: Distribution }>
) {
  const execution = await db.query.executions.findFirst({
    where: eq(executions.id, executionId),
  });

  // Calculate accuracy metrics
  const metrics = Object.entries(outcomes).map(([key, { actual, predicted }]) => ({
    variable: key,
    actual,
    predicted: predicted.mean,
    error: actual - predicted.mean,
    withinCI: actual >= predicted.ci95[0] && actual <= predicted.ci95[1],
    percentile: calculatePercentile(actual, predicted),
  }));

  await db.insert(outcomeRecords).values({
    executionId,
    outcomes: metrics,
    recordedAt: new Date(),
  });

  // Update calibration
  await updateCalibration(execution.orgId);
}
```

### 5.2 Calibration Dashboard

```tsx
// src/components/calibration/CalibrationCurve.tsx
export function CalibrationCurve({ data }: { data: CalibrationData }) {
  return (
    <div>
      <h3>Calibration Curve</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data.points}>
          <XAxis
            dataKey="claimed"
            label="Claimed Confidence"
            tickFormatter={(v) => `${v * 100}%`}
          />
          <YAxis
            label="Actual Accuracy"
            tickFormatter={(v) => `${v * 100}%`}
          />
          {/* Perfect calibration line */}
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
            stroke="#9ca3af"
            strokeDasharray="3 3"
          />
          <Line
            dataKey="actual"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-sm text-gray-500 mt-2">
        {data.note}
      </p>
    </div>
  );
}
```

### Phase 5 Deliverables

- [ ] Outcome recording API
- [ ] Calibration calculation
- [ ] Calibration dashboard
- [ ] Learning flywheel analytics
- [ ] Per-organization adjustments

---

## Phase 6: Polish & Scale

**Goal:** Production hardening, performance, enterprise features.

### 6.1 Checklist

- [ ] Rate limiting with Upstash
- [ ] Error tracking with Sentry
- [ ] Analytics with PostHog
- [ ] CDN for static assets
- [ ] Database connection pooling
- [ ] Cache frequently accessed data
- [ ] SSO/SAML for enterprise
- [ ] Audit logging
- [ ] Data export/import
- [ ] API documentation
- [ ] Mobile-responsive design
- [ ] Keyboard shortcuts
- [ ] Accessibility (WCAG 2.1)

---

## Milestones

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Phase 1 | Weeks 1-4 | MVP: Canvas + Chat + Execution |
| Phase 2 | Weeks 5-6 | Real-time collaboration |
| Phase 3 | Weeks 7-9 | Advanced execution |
| Phase 4 | Weeks 10-11 | Results + Tripwires |
| Phase 5 | Weeks 12-13 | Learning + Calibration |
| Phase 6 | Weeks 14-16 | Polish + Launch |

---

## Getting Started

```bash
# Clone the starter template
git clone https://github.com/rltx/starter-template.git rltx-app
cd rltx-app

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Fill in API keys...

# Set up database
npm run db:push

# Start development
npm run dev
```

Open http://localhost:3000 and start building!
