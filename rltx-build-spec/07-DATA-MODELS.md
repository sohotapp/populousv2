# RLTX Type Definitions

## Overview

This document defines all TypeScript types used in the RLTX system. These types should be placed in `/types/` and imported throughout the codebase.

---

## Core Types

### Agent Types

```typescript
// types/agent.ts

export interface AgentTraits {
  // Demographics
  age: number;
  gender: 'male' | 'female' | 'non-binary' | 'other';
  income: number;
  income_bracket: 'low' | 'medium' | 'high' | 'affluent';
  education: 'high_school' | 'some_college' | 'bachelors' | 'graduate' | 'doctorate';
  occupation: string;
  location_type: 'urban' | 'suburban' | 'rural';
  location_name: string;
  household_composition: string;
  
  // Psychographics
  values: string[];
  risk_tolerance: number;  // 0-1
  price_sensitivity: number;  // 0-1
  information_seeking: number;  // 0-1
  brand_loyalty: number;  // 0-1
  
  // Optional domain-specific
  [key: string]: any;
}

export interface AgentBelief {
  topic: string;
  position: string;
  confidence: number;  // 0-1
  source?: string;
}

export interface AgentMemory {
  event: string;
  timestamp?: string;
  valence?: number;  // -1 to 1 (negative to positive)
  salience?: number;  // 0-1 (how memorable)
  impact?: string;  // Human-readable impact description
}

export interface Agent {
  id: string;
  population_id?: string;
  archetype_id?: string;
  
  traits: AgentTraits;
  beliefs: AgentBelief[];
  memory: AgentMemory[];
  goals?: string[];
  
  // For named actors (game theory)
  name?: string;
  role?: string;
  
  // Computed
  prompt_context?: string;  // Pre-compiled prompt segment
}

export interface StrategicActor extends Agent {
  name: string;
  role: 'player' | 'nature' | 'observer';
  
  organization?: string;
  title?: string;
  tenure?: string;
  
  objectives: string[];
  constraints: string[];
  information: string[];
  
  available_actions?: string[];
  action_descriptions?: string[];
  
  risk_appetite?: string;
  time_horizon?: string;
  reputation?: string;
  threat_response_style?: string;
  past_behavior?: string;
}
```

### Workflow Types

```typescript
// types/workflow.ts

export interface WorkflowNode {
  id: string;
  primitive: string;
  name: string;
  config: Record<string, any>;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  output_mapping?: Record<string, string>;
}

export interface WorkflowInterpretation {
  original_question: string;
  question_type: 'consumer_survey' | 'change_impact' | 'competitive_response' | 'wargame' | 'dynamics' | 'counterfactual' | 'custom';
  key_entities: string[];
  assumptions: string[];
  clarifications_needed: string[];
}

export interface ExecutionPlan {
  estimated_agents: number;
  estimated_llm_calls: number;
  parallelizable: boolean;
  estimated_time_seconds: number;
  estimated_cost_usd: number;
}

export interface WorkflowValidation {
  required_inputs: string[];
  default_values: Record<string, any>;
  warnings: string[];
}

export interface Workflow {
  name: string;
  description: string;
  
  interpretation: WorkflowInterpretation;
  
  workflow: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  };
  
  execution_plan: ExecutionPlan;
  validation: WorkflowValidation;
}

export interface NodeState {
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface NodeResult {
  node_id: string;
  primitive: string;
  result: any;
  trace?: PrimitiveTrace;
}

export interface WorkflowResult {
  workflow_id: string;
  status: 'completed' | 'failed' | 'cancelled';
  
  primary_result: any;
  
  node_results: NodeResult[];
  
  execution_metadata: {
    start_time: string;
    end_time: string;
    duration_ms: number;
    nodes_executed: number;
  };
}
```

### Primitive Types

```typescript
// types/primitive.ts

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ExecutionContext {
  simulation_id: string;
  user_id?: string;
  cache?: CacheInterface;
}

export interface PrimitiveTrace {
  primitive_id: string;
  input_summary: string;
  output_summary: string;
  duration_ms: number;
  timestamp: string;
  
  // LLM-specific
  prompt?: string;
  raw_response?: string;
  model_used?: string;
  latency_ms?: number;
  tokens?: {
    input: number;
    output: number;
  };
}

export interface Primitive<TInput = any, TOutput = any> {
  id: string;
  
  validate(input: TInput): ValidationResult;
  
  execute(input: TInput, context: ExecutionContext): Promise<TOutput & { trace?: PrimitiveTrace }>;
}

// Output format specification
export interface OutputFormat {
  type: 'binary' | 'categorical' | 'numeric' | 'likert' | 'open' | 'structured';
  options?: string[];  // For binary/categorical
  range?: [number, number];  // For numeric
  scale?: number;  // For likert (e.g., 5 or 7)
  schema?: Record<string, any>;  // For structured (JSON schema)
}

// Distribution result
export interface DistributionEntry {
  count: number;
  percentage: number;
  weighted_count?: number;
  weighted_percentage?: number;
}

export interface Distribution {
  [value: string]: DistributionEntry;
}

// Summary statistics
export interface SummaryStats {
  mode: string;
  mean?: number;
  median?: number;
  std_dev?: number;
  percentiles?: Record<string, number>;
  confidence_interval?: {
    level: number;
    lower: number;
    upper: number;
  };
}
```

### Primitive Input/Output Types

```typescript
// types/primitives/agent.ts

export interface AgentCreateInput {
  traits: Partial<AgentTraits>;
  beliefs?: AgentBelief[];
  memory?: AgentMemory[];
  goals?: string[];
  name?: string;
  role?: string;
}

export interface AgentCreateOutput {
  agent_id: string;
  agent: Agent;
  prompt_context: string;
}

export interface AgentReasonInput {
  agent_id?: string;
  agent?: Agent;
  
  question: string;
  
  context?: {
    scenario?: string;
    options?: string[];
    constraints?: string[];
    information?: string;
    other_agents?: Array<{
      name: string;
      action: string;
    }>;
  };
  
  output_format: OutputFormat;
  reasoning_depth: 'shallow' | 'standard' | 'deep';
  model_override?: string;
}

export interface AgentReasonOutput {
  answer: any;
  confidence: number;
  reasoning: string;
  
  trace: {
    prompt: string;
    raw_response: string;
    parsed_at: string;
    model_used: string;
    latency_ms: number;
    tokens: {
      input: number;
      output: number;
    };
  };
  
  factors?: Array<{
    factor: string;
    influence: 'positive' | 'negative' | 'neutral';
    weight: number;
  }>;
}
```

```typescript
// types/primitives/population.ts

export interface PopulationSpec {
  base: string;  // "us_adults", "us_voters", etc.
  size: number;
  
  filters?: Array<{
    trait: string;
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'between';
    value: any;
  }>;
  
  oversample?: Array<{
    filter: { trait: string; operator: string; value: any };
    factor: number;
  }>;
}

export interface PopulationSampleInput {
  population_id?: string;
  population_spec?: PopulationSpec;
  
  strategy: 'random' | 'stratified' | 'quota' | 'archetype';
  
  archetype_config?: {
    n_archetypes: number;
    clustering_traits: string[];
  };
  
  seed?: number;
}

export interface PopulationSampleOutput {
  agents: Agent[];
  
  sample_metadata: {
    requested_size: number;
    actual_size: number;
    strategy_used: string;
    
    distribution: {
      [trait: string]: {
        [value: string]: number;
      };
    };
    
    archetypes?: Array<{
      archetype_id: string;
      centroid: Record<string, any>;
      member_count: number;
      representative_agent: Agent;
    }>;
  };
  
  weights?: number[];
}
```

```typescript
// types/primitives/orchestrate.ts

export interface MonteCarloInput {
  agents: Agent[];
  weights?: number[];
  
  question: string;
  
  context?: {
    scenario?: string;
    information?: string;
  };
  
  output_format: OutputFormat;
  reasoning_depth: 'shallow' | 'standard' | 'deep';
  
  use_archetypes?: boolean;
  batch_similar?: boolean;
  sample_size?: number;
  confidence_target?: number;
}

export interface MonteCarloOutput {
  distribution: Distribution;
  summary: SummaryStats;
  
  execution: {
    total_agents: number;
    agents_simulated: number;
    parallel_batches: number;
    total_time_ms: number;
    avg_time_per_agent_ms: number;
    
    model_usage: {
      [model: string]: {
        calls: number;
        tokens: number;
        cost: number;
      };
    };
  };
  
  agent_results: Array<{
    agent_id: string;
    agent_summary: string;
    answer: any;
    confidence: number;
    reasoning_summary: string;
  }>;
  
  traces?: PrimitiveTrace[];
}

export interface GameTheoryInput {
  actors: StrategicActor[];
  
  game_type: 'simultaneous' | 'sequential' | 'repeated';
  move_order?: string[];
  rounds?: number;
  
  max_iterations: number;
  convergence_threshold: number;
  
  initial_state?: Record<string, any>;
  situation?: string;
  
  payoffs?: {
    description: string;
    matrix?: Record<string, Record<string, Record<string, number>>>;
  };
}

export interface GameTheoryIteration {
  iteration: number;
  
  moves: {
    [actor_name: string]: {
      action: string;
      reasoning: string;
      confidence: number;
      changed_from_previous: boolean;
      anticipated_responses?: Record<string, string>;
    };
  };
  
  state_after: Record<string, any>;
}

export interface GameTheoryOutput {
  equilibrium: {
    found: boolean;
    iterations_to_converge: number;
    
    strategies: {
      [actor_name: string]: {
        action: string;
        reasoning: string;
        confidence: number;
        best_response_to: Record<string, string>;
      };
    };
    
    outcome: {
      description: string;
      payoffs?: Record<string, number>;
    };
  };
  
  iterations: GameTheoryIteration[];
  
  analysis: {
    stability: 'stable' | 'unstable' | 'cycling';
    key_dependencies: Array<{
      actor: string;
      depends_on: string;
      relationship: string;
    }>;
    sensitivity: Array<{
      if_actor: string;
      deviated_to: string;
      others_would: Record<string, string>;
      outcome_change: string;
    }>;
  };
  
  traces: PrimitiveTrace[];
}
```

```typescript
// types/primitives/branch.ts

export interface BranchScenarioInput {
  scenario_name: string;
  description: string;
  probability?: number;
  
  modifications: {
    context_changes?: Record<string, any>;
    agent_changes?: {
      filter?: Record<string, any>;
      trait_changes?: Record<string, any>;
      belief_changes?: Record<string, any>;
    };
    environment_changes?: Record<string, any>;
  };
}

export interface BranchScenarioOutput {
  scenario_id: string;
  scenario_name: string;
  
  modified_context: Record<string, any>;
  modified_agents?: Agent[];
  modified_environment?: Record<string, any>;
  
  ready: boolean;
}

export interface BranchCompareInput {
  base_simulation: {
    type: 'monte_carlo' | 'game_theory' | 'abm';
    config: Record<string, any>;
  };
  
  scenarios: Array<{
    scenario_name: string;
    probability: number;
    modifications: Record<string, any>;
  }>;
  
  parallel: boolean;
}

export interface BranchCompareOutput {
  results_by_scenario: {
    [scenario_name: string]: {
      probability: number;
      result: any;
      key_metrics: Record<string, number>;
    };
  };
  
  comparison: {
    metric_comparison: {
      [metric: string]: {
        by_scenario: Record<string, number>;
        expected_value: number;
        range: [number, number];
        most_sensitive_to: string;
      };
    };
    
    scenario_ranking: Array<{
      scenario: string;
      primary_metric: number;
      probability: number;
    }>;
  };
}
```

### Simulation Types

```typescript
// types/simulation.ts

export type SimulationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Simulation {
  id: string;
  name: string;
  question: string;
  
  workflow: Workflow;
  
  status: SimulationStatus;
  
  result?: WorkflowResult;
  error?: string;
  
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface SimulationCreateRequest {
  question: string;
  context?: Record<string, any>;
  
  // Optional: provide workflow directly instead of composing
  workflow?: Workflow;
  
  // Options
  options?: {
    sample_size?: number;
    population_id?: string;
    save?: boolean;
  };
}

export interface SimulationResult {
  simulation_id: string;
  
  // Primary result
  prediction: {
    value: any;
    confidence: number;
    confidence_interval?: {
      lower: number;
      upper: number;
      level: number;
    };
  };
  
  // Distribution (for Monte Carlo)
  distribution?: Distribution;
  
  // Scenario breakdown (for counterfactuals)
  scenarios?: Array<{
    name: string;
    probability: number;
    result: any;
  }>;
  
  // Segment analysis
  segments?: Array<{
    segment_name: string;
    segment_criteria: Record<string, any>;
    result: any;
    difference_from_overall: number;
  }>;
  
  // Key factors
  factors?: Array<{
    factor: string;
    impact: 'high' | 'medium' | 'low';
    direction: 'positive' | 'negative';
    explanation: string;
  }>;
  
  // Execution metadata
  metadata: {
    agents_simulated: number;
    llm_calls: number;
    total_time_ms: number;
    cost_usd: number;
  };
}
```

### Calibration Types

```typescript
// types/calibration.ts

export interface CalibrationScenario {
  id: string;
  name: string;
  date: string;
  domain: 'enterprise' | 'defense' | 'policy';
  scenario_type: string;
  
  question: string;
  
  population: {
    description: string;
    size: number;
    known_demographics: Record<string, Record<string, number>>;
  };
  
  context: {
    economic_conditions: string;
    competitive_landscape?: string;
    prior_events: string[];
  };
  
  outcome: {
    metric: string;
    value: number;
    confidence: number;
    sample_size?: number;
  };
}

export interface CalibrationResult {
  scenario_id: string;
  scenario: CalibrationScenario;
  
  predicted: number;
  actual: number;
  error: number;
  
  segment_errors?: Array<{
    segment: string;
    predicted: number;
    actual: number;
    error: number;
  }>;
  
  trace_id?: string;
  
  model_config: Record<string, any>;
  timestamp: string;
}

export interface ErrorAnalysis {
  overall: {
    mae: number;
    bias: number;
    directional_accuracy: number;
  };
  
  by_scenario_type: {
    [type: string]: {
      mae: number;
      bias: number;
      n: number;
    };
  };
  
  by_segment: {
    [segment: string]: {
      mae: number;
      bias: number;
      worst_scenarios: string[];
    };
  };
  
  systematic_patterns: Array<{
    pattern: string;
    evidence: string;
    suggested_fix: string;
  }>;
}

export interface CalibrationAdjustment {
  type: 'population_weight' | 'trait_mapping' | 'prompt_change' | 'aggregation';
  
  before: any;
  after: any;
  
  expected_impact: {
    mae_reduction: number;
    bias_reduction: number;
  };
  
  applied_at: string;
  validated: boolean;
}

export interface CalibrationReport {
  period: {
    start: string;
    end: string;
  };
  
  simulations_with_outcomes: number;
  
  metrics: {
    mae: number;
    mae_trend: 'improving' | 'stable' | 'degrading';
    bias: number;
    directional_accuracy: number;
  };
  
  by_domain: {
    [domain: string]: {
      simulations: number;
      mae: number;
      status: 'healthy' | 'warning' | 'critical';
    };
  };
  
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical';
    message: string;
    suggested_action: string;
  }>;
}
```

### API Types

```typescript
// types/api.ts

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface ComposeRequest {
  question: string;
  context?: Record<string, any>;
}

export interface ComposeResponse {
  success: boolean;
  workflow: Workflow;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ExecuteRequest {
  workflow: Workflow;
  options?: {
    save?: boolean;
    stream?: boolean;
  };
}

export interface ExecuteResponse {
  success: boolean;
  simulation_id: string;
  result: WorkflowResult;
}

export interface AgentChatRequest {
  agent_id: string;
  message: string;
  conversation_id?: string;
}

export interface AgentChatResponse {
  response: string;
  conversation_id: string;
  turn_count: number;
}
```

---

## Utility Types

```typescript
// types/utils.ts

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> =
  Pick<T, Exclude<keyof T, Keys>> &
  { [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>> }[Keys];

export type Awaited<T> = T extends Promise<infer U> ? U : T;

export type ValueOf<T> = T[keyof T];

// For discriminated unions
export type DiscriminateUnion<T, K extends keyof T, V extends T[K]> = 
  T extends Record<K, V> ? T : never;
```

---

## Type Guards

```typescript
// types/guards.ts

import type { Agent, StrategicActor } from './agent';
import type { Distribution, OutputFormat } from './primitive';

export function isStrategicActor(agent: Agent): agent is StrategicActor {
  return 'objectives' in agent && Array.isArray((agent as any).objectives);
}

export function isBinaryOutput(format: OutputFormat): boolean {
  return format.type === 'binary';
}

export function isCategoricalOutput(format: OutputFormat): boolean {
  return format.type === 'categorical';
}

export function isNumericOutput(format: OutputFormat): boolean {
  return format.type === 'numeric' || format.type === 'likert';
}

export function hasDistribution(result: any): result is { distribution: Distribution } {
  return 'distribution' in result && typeof result.distribution === 'object';
}
```

---

## Constants

```typescript
// types/constants.ts

export const MODELS = {
  OPUS: 'claude-opus-4-5-20250514',
  SONNET: 'claude-sonnet-4-20250514',
  HAIKU: 'claude-haiku-3-5-20241022',
} as const;

export const PRIMITIVES = {
  AGENT: {
    CREATE: 'agent.create',
    REASON: 'agent.reason',
    CONVERSE: 'agent.converse',
  },
  POPULATION: {
    SAMPLE: 'population.sample',
    FILTER: 'population.filter',
    SEGMENT: 'population.segment',
  },
  ORCHESTRATE: {
    MONTE_CARLO: 'orchestrate.monte_carlo',
    GAME_THEORY: 'orchestrate.game_theory',
    ABM: 'orchestrate.abm',
  },
  AGGREGATE: {
    DISTRIBUTION: 'aggregate.distribution',
    WEIGHTED: 'aggregate.weighted',
    CONSENSUS: 'aggregate.consensus',
  },
  BRANCH: {
    SCENARIO: 'branch.scenario',
    COMPARE: 'branch.compare',
    MERGE: 'branch.merge',
  },
  ANALYZE: {
    FACTORS: 'analyze.factors',
    SENSITIVITY: 'analyze.sensitivity',
    UNCERTAINTY: 'analyze.uncertainty',
  },
} as const;

export const QUESTION_TYPES = [
  'consumer_survey',
  'change_impact',
  'competitive_response',
  'wargame',
  'dynamics',
  'counterfactual',
  'custom',
] as const;

export const SIMULATION_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;

export const CALIBRATION_THRESHOLDS = {
  MAE_TARGET: 0.10,
  BIAS_LIMIT: 0.02,
  DIRECTIONAL_ACCURACY_MIN: 0.85,
} as const;
```

---

## Zod Schemas (for runtime validation)

```typescript
// types/schemas.ts

import { z } from 'zod';

export const AgentTraitsSchema = z.object({
  age: z.number().min(0).max(120),
  gender: z.enum(['male', 'female', 'non-binary', 'other']),
  income: z.number().min(0),
  income_bracket: z.enum(['low', 'medium', 'high', 'affluent']),
  education: z.enum(['high_school', 'some_college', 'bachelors', 'graduate', 'doctorate']),
  occupation: z.string(),
  location_type: z.enum(['urban', 'suburban', 'rural']),
  location_name: z.string(),
  household_composition: z.string(),
  values: z.array(z.string()),
  risk_tolerance: z.number().min(0).max(1),
  price_sensitivity: z.number().min(0).max(1),
  information_seeking: z.number().min(0).max(1),
  brand_loyalty: z.number().min(0).max(1),
}).passthrough();  // Allow additional properties

export const OutputFormatSchema = z.object({
  type: z.enum(['binary', 'categorical', 'numeric', 'likert', 'open', 'structured']),
  options: z.array(z.string()).optional(),
  range: z.tuple([z.number(), z.number()]).optional(),
  scale: z.number().optional(),
  schema: z.record(z.any()).optional(),
});

export const MonteCarloInputSchema = z.object({
  agents: z.array(z.any()),  // Full agent schema too complex for here
  weights: z.array(z.number()).optional(),
  question: z.string().min(1),
  context: z.object({
    scenario: z.string().optional(),
    information: z.string().optional(),
  }).optional(),
  output_format: OutputFormatSchema,
  reasoning_depth: z.enum(['shallow', 'standard', 'deep']),
  use_archetypes: z.boolean().optional(),
  batch_similar: z.boolean().optional(),
  sample_size: z.number().optional(),
  confidence_target: z.number().optional(),
});

export const WorkflowNodeSchema = z.object({
  id: z.string(),
  primitive: z.string(),
  name: z.string(),
  config: z.record(z.any()),
});

export const WorkflowEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  output_mapping: z.record(z.string()).optional(),
});

export const WorkflowSchema = z.object({
  name: z.string(),
  description: z.string(),
  interpretation: z.object({
    original_question: z.string(),
    question_type: z.string(),
    key_entities: z.array(z.string()),
    assumptions: z.array(z.string()),
    clarifications_needed: z.array(z.string()),
  }),
  workflow: z.object({
    nodes: z.array(WorkflowNodeSchema),
    edges: z.array(WorkflowEdgeSchema),
  }),
  execution_plan: z.object({
    estimated_agents: z.number(),
    estimated_llm_calls: z.number(),
    parallelizable: z.boolean(),
    estimated_time_seconds: z.number(),
    estimated_cost_usd: z.number(),
  }),
  validation: z.object({
    required_inputs: z.array(z.string()),
    default_values: z.record(z.any()),
    warnings: z.array(z.string()),
  }),
});
```
