# RLTX Implementation Guide

## Overview

This document provides implementation guidance for Claude Code to build the RLTX simulation platform. Follow these patterns exactly.

---

## Project Structure

```
rltx/
├── app/                          # Next.js app router
│   ├── api/
│   │   ├── compose/
│   │   │   └── route.ts         # Workflow composition endpoint
│   │   ├── execute/
│   │   │   └── route.ts         # Workflow execution endpoint
│   │   ├── simulations/
│   │   │   ├── route.ts         # List/create simulations
│   │   │   └── [id]/
│   │   │       ├── route.ts     # Get simulation
│   │   │       └── results/
│   │   │           └── route.ts # Get results
│   │   ├── populations/
│   │   │   └── route.ts         # Population management
│   │   └── agents/
│   │       └── [id]/
│   │           ├── route.ts     # Get agent
│   │           └── chat/
│   │               └── route.ts # Chat with agent
│   ├── dashboard/
│   │   └── page.tsx             # Dashboard
│   ├── simulations/
│   │   ├── page.tsx             # Simulation list
│   │   ├── new/
│   │   │   └── page.tsx         # Simulation builder
│   │   └── [id]/
│   │       └── page.tsx         # Simulation results
│   └── layout.tsx
│
├── lib/
│   ├── primitives/               # Primitive implementations
│   │   ├── index.ts             # Primitive registry
│   │   ├── agent/
│   │   │   ├── create.ts
│   │   │   ├── reason.ts
│   │   │   └── converse.ts
│   │   ├── population/
│   │   │   ├── sample.ts
│   │   │   ├── filter.ts
│   │   │   └── segment.ts
│   │   ├── orchestrate/
│   │   │   ├── monte-carlo.ts
│   │   │   ├── game-theory.ts
│   │   │   └── abm.ts
│   │   ├── aggregate/
│   │   │   ├── distribution.ts
│   │   │   ├── weighted.ts
│   │   │   └── consensus.ts
│   │   ├── branch/
│   │   │   ├── scenario.ts
│   │   │   ├── compare.ts
│   │   │   └── merge.ts
│   │   └── analyze/
│   │       ├── factors.ts
│   │       ├── sensitivity.ts
│   │       └── uncertainty.ts
│   │
│   ├── agents/                   # Agent system
│   │   ├── prompt-compiler.ts   # Build prompts from agent data
│   │   ├── response-parser.ts   # Parse LLM responses
│   │   ├── model-router.ts      # Select appropriate model
│   │   └── agent-store.ts       # Agent persistence
│   │
│   ├── population/              # Population system
│   │   ├── generator.ts         # IPF population generation
│   │   ├── sampler.ts           # Sampling strategies
│   │   └── distributions.ts     # Census/demographic data
│   │
│   ├── execution/               # Workflow execution
│   │   ├── engine.ts            # Graph executor
│   │   ├── scheduler.ts         # Parallel execution
│   │   └── trace.ts             # Trace management
│   │
│   ├── composition/             # Workflow composition
│   │   ├── composer.ts          # Main composition logic
│   │   ├── patterns.ts          # Canonical workflow patterns
│   │   └── validator.ts         # Workflow validation
│   │
│   ├── calibration/             # Calibration system
│   │   ├── runner.ts            # Backtest runner
│   │   ├── analyzer.ts          # Error analysis
│   │   └── adjuster.ts          # Apply adjustments
│   │
│   ├── llm/                     # LLM integration
│   │   ├── client.ts            # Anthropic client wrapper
│   │   ├── batch.ts             # Batching logic
│   │   └── cache.ts             # Response caching
│   │
│   └── db/                      # Database
│       ├── client.ts            # Prisma client
│       ├── schema.prisma        # Database schema
│       └── migrations/
│
├── components/                   # React components
│   ├── ui/                      # Base UI components
│   ├── simulation/
│   │   ├── builder/
│   │   ├── results/
│   │   └── trace/
│   ├── population/
│   └── dashboard/
│
├── prompts/                      # Prompt templates
│   ├── composition.ts           # Composition system prompt
│   ├── consumer-agent.ts        # Consumer agent template
│   ├── strategic-actor.ts       # Strategic actor template
│   └── abm-agent.ts             # ABM agent template
│
└── types/                        # TypeScript types
    ├── agent.ts
    ├── workflow.ts
    ├── primitive.ts
    └── simulation.ts
```

---

## Core Implementation Files

### 1. Primitive Registry

```typescript
// lib/primitives/index.ts

import { agentCreate } from './agent/create';
import { agentReason } from './agent/reason';
import { agentConverse } from './agent/converse';
import { populationSample } from './population/sample';
import { populationFilter } from './population/filter';
import { populationSegment } from './population/segment';
import { orchestrateMonteCarlo } from './orchestrate/monte-carlo';
import { orchestrateGameTheory } from './orchestrate/game-theory';
import { orchestrateABM } from './orchestrate/abm';
import { aggregateDistribution } from './aggregate/distribution';
import { aggregateWeighted } from './aggregate/weighted';
import { aggregateConsensus } from './aggregate/consensus';
import { branchScenario } from './branch/scenario';
import { branchCompare } from './branch/compare';
import { branchMerge } from './branch/merge';
import { analyzeFactors } from './analyze/factors';
import { analyzeSensitivity } from './analyze/sensitivity';
import { analyzeUncertainty } from './analyze/uncertainty';

import type { Primitive, PrimitiveInput, PrimitiveOutput } from '@/types/primitive';

export const primitiveRegistry: Record<string, Primitive> = {
  'agent.create': agentCreate,
  'agent.reason': agentReason,
  'agent.converse': agentConverse,
  'population.sample': populationSample,
  'population.filter': populationFilter,
  'population.segment': populationSegment,
  'orchestrate.monte_carlo': orchestrateMonteCarlo,
  'orchestrate.game_theory': orchestrateGameTheory,
  'orchestrate.abm': orchestrateABM,
  'aggregate.distribution': aggregateDistribution,
  'aggregate.weighted': aggregateWeighted,
  'aggregate.consensus': aggregateConsensus,
  'branch.scenario': branchScenario,
  'branch.compare': branchCompare,
  'branch.merge': branchMerge,
  'analyze.factors': analyzeFactors,
  'analyze.sensitivity': analyzeSensitivity,
  'analyze.uncertainty': analyzeUncertainty,
};

export async function executePrimitive(
  primitiveId: string,
  input: PrimitiveInput,
  context: ExecutionContext
): Promise<PrimitiveOutput> {
  const primitive = primitiveRegistry[primitiveId];
  
  if (!primitive) {
    throw new Error(`Unknown primitive: ${primitiveId}`);
  }
  
  // Validate input
  const validationResult = primitive.validate(input);
  if (!validationResult.valid) {
    throw new Error(`Invalid input for ${primitiveId}: ${validationResult.errors.join(', ')}`);
  }
  
  // Execute
  const startTime = Date.now();
  const result = await primitive.execute(input, context);
  const endTime = Date.now();
  
  // Build trace
  const trace: PrimitiveTrace = {
    primitive_id: primitiveId,
    input_summary: summarizeInput(input),
    output_summary: summarizeOutput(result),
    duration_ms: endTime - startTime,
    timestamp: new Date().toISOString(),
  };
  
  return {
    ...result,
    trace,
  };
}
```

### 2. Monte Carlo Orchestration

```typescript
// lib/primitives/orchestrate/monte-carlo.ts

import { callLLM } from '@/lib/llm/client';
import { compileAgentPrompt } from '@/lib/agents/prompt-compiler';
import { parseAgentResponse } from '@/lib/agents/response-parser';
import { selectModel } from '@/lib/agents/model-router';
import type { MonteCarloInput, MonteCarloOutput } from '@/types/primitive';

export const orchestrateMonteCarlo = {
  id: 'orchestrate.monte_carlo',
  
  validate(input: MonteCarloInput): ValidationResult {
    const errors: string[] = [];
    
    if (!input.agents || input.agents.length === 0) {
      errors.push('agents array is required');
    }
    if (!input.question) {
      errors.push('question is required');
    }
    if (!input.output_format?.type) {
      errors.push('output_format.type is required');
    }
    
    return { valid: errors.length === 0, errors };
  },
  
  async execute(
    input: MonteCarloInput, 
    context: ExecutionContext
  ): Promise<MonteCarloOutput> {
    const {
      agents,
      weights,
      question,
      context: questionContext,
      output_format,
      reasoning_depth = 'standard',
    } = input;
    
    // Select model based on depth
    const model = selectModel({ reasoning_depth, output_format });
    
    // Build all agent prompts
    const agentCalls = agents.map((agent, i) => ({
      agent,
      weight: weights?.[i] ?? 1,
      prompt: compileAgentPrompt({
        agent,
        question,
        scenario: questionContext?.scenario || '',
        output_format,
        reasoning_depth,
      }),
    }));
    
    // Execute in parallel batches
    const batchSize = 50;  // Concurrent LLM calls
    const results: AgentResult[] = [];
    
    for (let i = 0; i < agentCalls.length; i += batchSize) {
      const batch = agentCalls.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (call) => {
          const response = await callLLM({
            model,
            messages: [{ role: 'user', content: call.prompt }],
            max_tokens: reasoning_depth === 'deep' ? 1000 : 500,
          });
          
          const parsed = parseAgentResponse(response.content, output_format);
          
          return {
            agent_id: call.agent.id,
            agent_summary: summarizeAgent(call.agent),
            answer: parsed.answer,
            confidence: parsed.confidence,
            reasoning_summary: truncate(parsed.reasoning, 200),
            weight: call.weight,
            trace: {
              prompt: call.prompt,
              raw_response: response.content,
              model_used: model,
              latency_ms: response.latency_ms,
              tokens: response.usage,
            },
          };
        })
      );
      
      results.push(...batchResults);
    }
    
    // Aggregate results
    const distribution = aggregateResults(results, output_format);
    const summary = calculateSummaryStats(distribution, output_format);
    
    // Calculate execution metadata
    const execution = {
      total_agents: agents.length,
      agents_simulated: results.length,
      parallel_batches: Math.ceil(agents.length / batchSize),
      total_time_ms: results.reduce((sum, r) => sum + r.trace.latency_ms, 0),
      avg_time_per_agent_ms: results.reduce((sum, r) => sum + r.trace.latency_ms, 0) / results.length,
      model_usage: {
        [model]: {
          calls: results.length,
          tokens: results.reduce((sum, r) => sum + r.trace.tokens.input + r.trace.tokens.output, 0),
          cost: estimateCost(model, results),
        },
      },
    };
    
    return {
      distribution,
      summary,
      execution,
      agent_results: results.map(r => ({
        agent_id: r.agent_id,
        agent_summary: r.agent_summary,
        answer: r.answer,
        confidence: r.confidence,
        reasoning_summary: r.reasoning_summary,
      })),
    };
  },
};

function aggregateResults(
  results: AgentResult[],
  outputFormat: OutputFormat
): Distribution {
  const distribution: Distribution = {};
  
  // Count by response
  for (const result of results) {
    const key = String(result.answer);
    if (!distribution[key]) {
      distribution[key] = { count: 0, weighted_count: 0 };
    }
    distribution[key].count += 1;
    distribution[key].weighted_count += result.weight;
  }
  
  // Calculate percentages
  const totalCount = results.length;
  const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
  
  for (const key of Object.keys(distribution)) {
    distribution[key].percentage = distribution[key].count / totalCount;
    distribution[key].weighted_percentage = distribution[key].weighted_count / totalWeight;
  }
  
  return distribution;
}

function calculateSummaryStats(
  distribution: Distribution,
  outputFormat: OutputFormat
): SummaryStats {
  const entries = Object.entries(distribution);
  
  // Find mode
  const mode = entries.reduce((max, curr) => 
    curr[1].count > max[1].count ? curr : max
  )[0];
  
  const summary: SummaryStats = { mode };
  
  // For numeric types, calculate mean/median
  if (outputFormat.type === 'numeric' || outputFormat.type === 'likert') {
    const values = entries.flatMap(([key, data]) => 
      Array(data.count).fill(parseFloat(key))
    );
    
    summary.mean = values.reduce((a, b) => a + b, 0) / values.length;
    summary.median = values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    summary.std_dev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - summary.mean!, 2), 0) / values.length
    );
  }
  
  // Confidence interval (for binary/categorical)
  const n = Object.values(distribution).reduce((sum, d) => sum + d.count, 0);
  const p = distribution[mode]?.percentage || 0;
  const z = 1.96; // 95% CI
  const margin = z * Math.sqrt((p * (1 - p)) / n);
  
  summary.confidence_interval = {
    level: 0.95,
    lower: Math.max(0, p - margin),
    upper: Math.min(1, p + margin),
  };
  
  return summary;
}

function summarizeAgent(agent: Agent): string {
  return `${agent.traits.age}yo ${agent.traits.gender}, ${agent.traits.income_bracket} income, ${agent.traits.location_type}`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
```

### 3. Game Theory Orchestration

```typescript
// lib/primitives/orchestrate/game-theory.ts

import { callLLM } from '@/lib/llm/client';
import { compileStrategicPrompt } from '@/lib/agents/prompt-compiler';
import { parseStrategicResponse } from '@/lib/agents/response-parser';
import type { GameTheoryInput, GameTheoryOutput } from '@/types/primitive';

export const orchestrateGameTheory = {
  id: 'orchestrate.game_theory',
  
  validate(input: GameTheoryInput): ValidationResult {
    const errors: string[] = [];
    
    if (!input.actors || input.actors.length < 2) {
      errors.push('At least 2 actors required');
    }
    if (!input.game_type) {
      errors.push('game_type is required');
    }
    
    return { valid: errors.length === 0, errors };
  },
  
  async execute(
    input: GameTheoryInput,
    context: ExecutionContext
  ): Promise<GameTheoryOutput> {
    const {
      actors,
      game_type,
      move_order,
      max_iterations = 5,
      convergence_threshold = 0.1,
      initial_state,
    } = input;
    
    // Initialize state
    let state = initial_state || {};
    let strategies: Record<string, string> = {};
    const iterations: Iteration[] = [];
    let converged = false;
    
    // Iterated best response loop
    for (let i = 0; i < max_iterations && !converged; i++) {
      const previousStrategies = { ...strategies };
      const moves: Record<string, MoveResult> = {};
      
      // Determine execution order
      const order = game_type === 'sequential'
        ? (move_order || actors.map(a => a.name))
        : actors.map(a => a.name); // Simultaneous - order doesn't matter
      
      // Execute moves
      if (game_type === 'simultaneous') {
        // Parallel execution for simultaneous games
        const results = await Promise.all(
          actors.filter(a => a.role === 'player').map(actor =>
            computeBestResponse(actor, strategies, state, input)
          )
        );
        
        for (const result of results) {
          strategies[result.actor] = result.action;
          moves[result.actor] = result;
        }
      } else {
        // Sequential execution
        for (const actorName of order) {
          const actor = actors.find(a => a.name === actorName);
          if (!actor || actor.role !== 'player') continue;
          
          const result = await computeBestResponse(actor, strategies, state, input);
          strategies[actorName] = result.action;
          moves[actorName] = result;
        }
      }
      
      // Record iteration
      iterations.push({
        iteration: i,
        moves,
        state_after: { ...state },
      });
      
      // Check convergence
      converged = checkConvergence(previousStrategies, strategies, convergence_threshold);
    }
    
    // Build equilibrium summary
    const equilibrium = {
      found: converged,
      iterations_to_converge: iterations.length,
      strategies: buildStrategySummary(actors, strategies, iterations),
      outcome: describeOutcome(strategies, input),
    };
    
    // Analyze the game
    const analysis = analyzeGame(iterations, actors);
    
    // Collect traces
    const traces = iterations.flatMap(iter => 
      Object.values(iter.moves).map(m => m.trace)
    );
    
    return {
      equilibrium,
      iterations,
      analysis,
      traces,
    };
  },
};

async function computeBestResponse(
  actor: Actor,
  otherStrategies: Record<string, string>,
  state: object,
  gameInput: GameTheoryInput
): Promise<MoveResult> {
  // Build game state for this actor
  const gameState = {
    other_actors: gameInput.actors
      .filter(a => a.name !== actor.name)
      .map(a => ({
        name: a.name,
        role: a.role,
        likely_objectives: a.objectives?.join(', '),
        known_strategy: otherStrategies[a.name] || 'unknown',
        past_behavior: a.past_behavior || 'unknown',
      })),
    situation: gameInput.situation || '',
    available_actions: actor.available_actions?.map((action, i) => ({
      action: action,
      description: actor.action_descriptions?.[i] || action,
    })) || [],
    previous_moves: Object.entries(otherStrategies).map(([name, action]) => ({
      actor: name,
      action,
      timing: 'previous iteration',
    })),
  };
  
  // Compile prompt
  const prompt = compileStrategicPrompt(actor, gameState);
  
  // Call Opus for strategic reasoning
  const response = await callLLM({
    model: 'claude-opus-4-5-20250514',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2000,
  });
  
  // Parse response
  const parsed = parseStrategicResponse(response.content);
  
  return {
    actor: actor.name,
    action: parsed.action,
    reasoning: parsed.reasoning,
    confidence: parsed.confidence,
    anticipated_responses: parsed.anticipated_responses,
    trace: {
      prompt,
      raw_response: response.content,
      model_used: 'claude-opus-4-5-20250514',
      latency_ms: response.latency_ms,
      tokens: response.usage,
    },
  };
}

function checkConvergence(
  previous: Record<string, string>,
  current: Record<string, string>,
  threshold: number
): boolean {
  const actors = Object.keys(current);
  
  // Check if any actor changed strategy
  let changes = 0;
  for (const actor of actors) {
    if (previous[actor] !== current[actor]) {
      changes++;
    }
  }
  
  // Converged if change rate below threshold
  return changes / actors.length < threshold;
}

function analyzeGame(iterations: Iteration[], actors: Actor[]): GameAnalysis {
  // Detect stability
  const lastIteration = iterations[iterations.length - 1];
  const secondLastIteration = iterations.length > 1 ? iterations[iterations.length - 2] : null;
  
  let stability: 'stable' | 'unstable' | 'cycling' = 'unstable';
  
  if (secondLastIteration) {
    const changes = Object.keys(lastIteration.moves).filter(actor =>
      lastIteration.moves[actor].action !== secondLastIteration.moves[actor]?.action
    );
    
    if (changes.length === 0) {
      stability = 'stable';
    } else if (iterations.length >= 4) {
      // Check for cycling
      const thirdLastIteration = iterations[iterations.length - 3];
      const isCycling = Object.keys(lastIteration.moves).every(actor =>
        lastIteration.moves[actor].action === thirdLastIteration.moves[actor]?.action
      );
      if (isCycling) stability = 'cycling';
    }
  }
  
  // Identify key dependencies
  const key_dependencies = actors
    .filter(a => a.role === 'player')
    .map(actor => {
      const lastMove = lastIteration.moves[actor.name];
      const dependsOn = Object.keys(lastMove.anticipated_responses || {})[0];
      return {
        actor: actor.name,
        depends_on: dependsOn || 'none',
        relationship: lastMove.reasoning.slice(0, 100),
      };
    });
  
  return {
    stability,
    key_dependencies,
    sensitivity: [], // Would need additional runs to calculate
  };
}
```

### 4. Workflow Execution Engine

```typescript
// lib/execution/engine.ts

import { executePrimitive } from '@/lib/primitives';
import type { Workflow, WorkflowResult, NodeResult } from '@/types/workflow';

export async function executeWorkflow(
  workflow: Workflow,
  context: ExecutionContext
): Promise<WorkflowResult> {
  const { nodes, edges } = workflow.workflow;
  
  // Build dependency graph
  const dependencyGraph = buildDependencyGraph(nodes, edges);
  
  // Track node states
  const nodeStates: Map<string, NodeState> = new Map();
  const nodeResults: Map<string, NodeResult> = new Map();
  
  // Initialize all nodes as pending
  for (const node of nodes) {
    nodeStates.set(node.id, { status: 'pending' });
  }
  
  // Execute nodes in topological order with parallelization
  const executionPromises: Map<string, Promise<NodeResult>> = new Map();
  
  async function executeNode(nodeId: string): Promise<NodeResult> {
    // Check if already executing or done
    if (executionPromises.has(nodeId)) {
      return executionPromises.get(nodeId)!;
    }
    
    const node = nodes.find(n => n.id === nodeId)!;
    const dependencies = dependencyGraph.get(nodeId) || [];
    
    // Wait for dependencies
    const dependencyResults = await Promise.all(
      dependencies.map(depId => executeNode(depId))
    );
    
    // Build input from dependencies
    const input = buildNodeInput(node, dependencyResults, edges);
    
    // Mark as running
    nodeStates.set(nodeId, { status: 'running', startedAt: Date.now() });
    
    try {
      // Execute the primitive
      const result = await executePrimitive(node.primitive, input, context);
      
      // Mark as completed
      nodeStates.set(nodeId, { 
        status: 'completed', 
        completedAt: Date.now() 
      });
      
      const nodeResult: NodeResult = {
        node_id: nodeId,
        primitive: node.primitive,
        result,
        trace: result.trace,
      };
      
      nodeResults.set(nodeId, nodeResult);
      return nodeResult;
      
    } catch (error) {
      // Mark as failed
      nodeStates.set(nodeId, { 
        status: 'failed', 
        error: String(error) 
      });
      throw error;
    }
  }
  
  // Find terminal nodes (no outgoing edges)
  const terminalNodes = nodes.filter(node => 
    !edges.some(e => e.from === node.id)
  );
  
  // Execute from terminal nodes (will recursively execute dependencies)
  const promise = Promise.all(terminalNodes.map(n => executeNode(n.id)));
  
  // Track with start time
  const startTime = Date.now();
  await promise;
  const endTime = Date.now();
  
  // Build final result
  const finalResults = Array.from(nodeResults.values());
  
  // Find the primary result (last terminal node)
  const primaryResult = nodeResults.get(terminalNodes[terminalNodes.length - 1].id);
  
  return {
    workflow_id: workflow.name,
    status: 'completed',
    
    primary_result: primaryResult?.result,
    
    node_results: finalResults,
    
    execution_metadata: {
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      duration_ms: endTime - startTime,
      nodes_executed: finalResults.length,
    },
  };
}

function buildDependencyGraph(
  nodes: Node[],
  edges: Edge[]
): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  
  for (const node of nodes) {
    graph.set(node.id, []);
  }
  
  for (const edge of edges) {
    const deps = graph.get(edge.to) || [];
    deps.push(edge.from);
    graph.set(edge.to, deps);
  }
  
  return graph;
}

function buildNodeInput(
  node: Node,
  dependencyResults: NodeResult[],
  edges: Edge[]
): any {
  // Start with node's static config
  const input = { ...node.config };
  
  // Map outputs from dependencies to inputs
  for (const depResult of dependencyResults) {
    const edge = edges.find(e => 
      e.from === depResult.node_id && e.to === node.id
    );
    
    if (edge?.output_mapping) {
      // Explicit mapping
      for (const [sourceField, targetField] of Object.entries(edge.output_mapping)) {
        input[targetField] = depResult.result[sourceField];
      }
    } else {
      // Default: pass entire result
      // Try to intelligently map common fields
      if (depResult.result.agents) {
        input.agents = depResult.result.agents;
      }
      if (depResult.result.weights) {
        input.weights = depResult.result.weights;
      }
      if (depResult.result.distribution) {
        input.distribution = depResult.result.distribution;
      }
    }
  }
  
  return input;
}
```

### 5. Composition API Endpoint

```typescript
// app/api/compose/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { COMPOSITION_SYSTEM_PROMPT } from '@/prompts/composition';
import { validateWorkflow } from '@/lib/composition/validator';

const client = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, context } = body;
    
    if (!question) {
      return NextResponse.json(
        { error: 'question is required' },
        { status: 400 }
      );
    }
    
    // Call Opus for composition
    const response = await client.messages.create({
      model: 'claude-opus-4-5-20250514',
      max_tokens: 8000,
      system: COMPOSITION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Question: ${question}\n\nContext: ${JSON.stringify(context || {})}`
        }
      ]
    });
    
    // Extract JSON from response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }
    
    // Parse JSON (handle potential markdown wrapping)
    let workflow;
    try {
      const jsonMatch = content.text.match(/```json\n?([\s\S]*?)\n?```/) ||
                        [null, content.text];
      workflow = JSON.parse(jsonMatch[1] || content.text);
    } catch (parseError) {
      // Try to extract JSON object directly
      const jsonStart = content.text.indexOf('{');
      const jsonEnd = content.text.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        workflow = JSON.parse(content.text.slice(jsonStart, jsonEnd + 1));
      } else {
        throw new Error('Could not parse workflow JSON from response');
      }
    }
    
    // Validate workflow structure
    const validation = validateWorkflow(workflow);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid workflow', details: validation.errors },
        { status: 400 }
      );
    }
    
    // Return workflow
    return NextResponse.json({
      success: true,
      workflow,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      }
    });
    
  } catch (error) {
    console.error('Composition error:', error);
    return NextResponse.json(
      { error: 'Failed to compose workflow', details: String(error) },
      { status: 500 }
    );
  }
}
```

### 6. Simulation Execution Endpoint

```typescript
// app/api/execute/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { executeWorkflow } from '@/lib/execution/engine';
import { db } from '@/lib/db/client';
import type { Workflow } from '@/types/workflow';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflow, options } = body as {
      workflow: Workflow;
      options?: {
        save?: boolean;
        stream?: boolean;
      };
    };
    
    // Create simulation record
    const simulation = await db.simulation.create({
      data: {
        name: workflow.name,
        question: workflow.interpretation?.original_question || '',
        workflow: workflow as any,
        status: 'running',
      }
    });
    
    try {
      // Execute workflow
      const context = {
        simulation_id: simulation.id,
        user_id: 'anonymous', // Would come from auth
      };
      
      const result = await executeWorkflow(workflow, context);
      
      // Update simulation with results
      await db.simulation.update({
        where: { id: simulation.id },
        data: {
          status: 'completed',
          result: result as any,
          completedAt: new Date(),
        }
      });
      
      return NextResponse.json({
        success: true,
        simulation_id: simulation.id,
        result,
      });
      
    } catch (executionError) {
      // Update simulation as failed
      await db.simulation.update({
        where: { id: simulation.id },
        data: {
          status: 'failed',
          error: String(executionError),
        }
      });
      
      throw executionError;
    }
    
  } catch (error) {
    console.error('Execution error:', error);
    return NextResponse.json(
      { error: 'Failed to execute workflow', details: String(error) },
      { status: 500 }
    );
  }
}
```

---

## Database Schema

```prisma
// lib/db/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Simulation {
  id          String   @id @default(cuid())
  name        String
  question    String
  workflow    Json
  status      String   @default("pending") // pending, running, completed, failed
  result      Json?
  error       String?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  completedAt DateTime?
  
  // Relations
  traces      Trace[]
  
  @@index([status])
  @@index([createdAt])
}

model Population {
  id          String   @id @default(cuid())
  name        String
  description String?
  
  basePopulation String  // e.g., "us_adults"
  size        Int
  filters     Json?
  
  // Cached distribution
  distribution Json?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([basePopulation])
}

model Agent {
  id          String   @id @default(cuid())
  populationId String?
  
  traits      Json
  beliefs     Json?
  memory      Json?
  
  // For archetype-based optimization
  archetypeId String?
  
  createdAt   DateTime @default(now())
  
  @@index([populationId])
  @@index([archetypeId])
}

model Trace {
  id           String   @id @default(cuid())
  simulationId String
  simulation   Simulation @relation(fields: [simulationId], references: [id])
  
  nodeId       String
  primitiveId  String
  
  inputSummary  String?
  outputSummary String?
  
  prompt       String?  @db.Text
  rawResponse  String?  @db.Text
  
  modelUsed    String?
  latencyMs    Int?
  tokensInput  Int?
  tokensOutput Int?
  
  createdAt    DateTime @default(now())
  
  @@index([simulationId])
  @@index([nodeId])
}

model CalibrationScenario {
  id           String   @id @default(cuid())
  name         String
  domain       String   // enterprise, defense, policy
  scenarioType String
  
  question     String
  population   Json
  context      Json
  
  actualOutcome Json
  outcomeConfidence Float
  
  createdAt    DateTime @default(now())
  
  @@index([domain])
  @@index([scenarioType])
}

model CalibrationResult {
  id            String   @id @default(cuid())
  scenarioId    String
  
  predicted     Float
  actual        Float
  error         Float
  
  segmentErrors Json?
  
  modelConfig   Json     // What config was used
  
  createdAt     DateTime @default(now())
  
  @@index([scenarioId])
  @@index([createdAt])
}
```

---

## Environment Variables

```env
# .env.example

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/rltx"

# Anthropic API
ANTHROPIC_API_KEY="sk-ant-..."

# Optional: Redis for caching
REDIS_URL="redis://localhost:6379"

# Optional: Neo4j for ontology
NEO4J_URI="bolt://localhost:7687"
NEO4J_USER="neo4j"
NEO4J_PASSWORD="password"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/primitives/monte-carlo.test.ts

import { orchestrateMonteCarlo } from '@/lib/primitives/orchestrate/monte-carlo';

describe('orchestrateMonteCarlo', () => {
  it('validates required inputs', () => {
    const result = orchestrateMonteCarlo.validate({});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('agents array is required');
  });
  
  it('executes with mock agents', async () => {
    const mockAgents = [
      { id: '1', traits: { age: 30, income_bracket: 'medium' } },
      { id: '2', traits: { age: 45, income_bracket: 'high' } },
    ];
    
    const result = await orchestrateMonteCarlo.execute({
      agents: mockAgents,
      question: 'Would you buy this product?',
      output_format: { type: 'binary', options: ['yes', 'no'] },
    }, { simulation_id: 'test' });
    
    expect(result.distribution).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.agent_results.length).toBe(2);
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/composition.test.ts

import { POST } from '@/app/api/compose/route';
import { NextRequest } from 'next/server';

describe('Composition API', () => {
  it('generates valid workflow for simple question', async () => {
    const request = new NextRequest('http://localhost/api/compose', {
      method: 'POST',
      body: JSON.stringify({
        question: 'Would customers buy a subscription for $15/month?'
      })
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.workflow.interpretation.question_type).toBe('consumer_survey');
    expect(data.workflow.workflow.nodes.some(n => n.primitive === 'population.sample')).toBe(true);
    expect(data.workflow.workflow.nodes.some(n => n.primitive === 'orchestrate.monte_carlo')).toBe(true);
  });
});
```

---

## Deployment

### Docker

```dockerfile
# Dockerfile

FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]
```

### Docker Compose

```yaml
# docker-compose.yml

version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/rltx
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=rltx
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## Key Implementation Notes for Claude Code

1. **Model selection matters**: Use Opus for composition and strategic actors. Use Sonnet for standard agents. Use Haiku for simple binary questions.

2. **Parallel execution is critical**: Monte Carlo should run agents in parallel batches of 50.

3. **Cache aggressively**: Same agent + same question = same answer. Cache at the prompt level.

4. **Traces are not optional**: Every LLM call must be traced for debugging and calibration.

5. **Validation before execution**: Always validate primitive inputs before running.

6. **Error handling**: Fail fast on invalid inputs, but handle LLM errors gracefully with retries.

7. **Typing is essential**: Use TypeScript strictly. Define types for all primitives, inputs, outputs.

8. **Don't mock in production**: The current mocks should be replaced with real implementations as described.

9. **Composition prompt is precise**: Follow the system prompt exactly. Don't deviate from the patterns.

10. **Calibration is continuous**: Every simulation with known outcome should feed back into calibration.
