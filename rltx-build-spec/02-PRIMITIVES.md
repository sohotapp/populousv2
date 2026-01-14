# RLTX Primitives - Complete Reference

## Overview

Each primitive is a **typed function** with defined inputs, outputs, and behavior. The composition layer selects and connects primitives; the execution engine runs them.

---

## Category 1: Agent Primitives

These primitives operate on individual agents.

---

### `agent.create`

**Purpose**: Instantiate a single agent with specific traits, beliefs, and memory.

**When to use**: 
- Creating named actors for game theory (e.g., "Competitor A CEO")
- Instantiating specific personas for targeted analysis
- Building custom agents outside standard population sampling

**Inputs**:
```typescript
{
  traits: {
    // Demographics
    age?: number | string;           // 34 or "25-34"
    gender?: string;                 // "male", "female", "non-binary"
    income?: number | string;        // 85000 or "high"
    education?: string;              // "bachelors", "graduate", "high_school"
    location?: string;               // "urban", "suburban", "rural" or specific
    occupation?: string;             // Free text or category
    
    // Psychographics
    values?: string[];               // ["security", "family", "achievement"]
    risk_tolerance?: number;         // 0.0 - 1.0
    political_leaning?: string;      // "liberal", "conservative", "moderate"
    lifestyle?: string[];            // ["health_conscious", "early_adopter"]
    
    // Behavioral
    brand_loyalty?: number;          // 0.0 - 1.0
    price_sensitivity?: number;      // 0.0 - 1.0
    information_seeking?: number;    // 0.0 - 1.0
    
    // Custom
    [key: string]: any;              // Domain-specific traits
  };
  
  beliefs?: {
    [topic: string]: {
      position: string;              // What they believe
      confidence: number;            // How strongly (0-1)
      source?: string;               // Why they believe it
    };
  };
  
  memory?: Array<{
    event: string;                   // What happened
    timestamp?: string;              // When
    valence?: number;                // Positive/negative (-1 to 1)
    salience?: number;               // How memorable (0-1)
  }>;
  
  goals?: string[];                  // What they're trying to achieve
  
  name?: string;                     // For named actors (game theory)
  role?: string;                     // "consumer", "competitor_ceo", "voter"
}
```

**Outputs**:
```typescript
{
  agent_id: string;                  // Unique identifier
  agent: Agent;                      // Full agent object
  prompt_context: string;            // Pre-compiled prompt segment
}
```

**Implementation Notes**:
- Validate trait values against ontology schema
- Generate unique ID
- Pre-compile the "You are..." prompt segment for efficiency
- Store in agent registry for retrieval

---

### `agent.reason`

**Purpose**: Have an agent answer a question or make a decision.

**When to use**:
- Core primitive for all agent-based reasoning
- Consumer response questions
- Strategic actor decisions
- Any "what would this person do/think" query

**Inputs**:
```typescript
{
  agent_id: string;                  // Reference to existing agent
  // OR
  agent: Agent;                      // Inline agent definition
  
  question: string;                  // The question to answer
  
  context?: {
    scenario?: string;               // Situational context
    options?: string[];              // Available choices (if applicable)
    constraints?: string[];          // Limitations or rules
    information?: string;            // Additional info the agent has
    other_agents?: Array<{           // For game theory - what others did
      name: string;
      action: string;
    }>;
  };
  
  output_format: {
    type: "binary" | "categorical" | "numeric" | "open" | "structured";
    options?: string[];              // For categorical
    range?: [number, number];        // For numeric
    schema?: object;                 // For structured (JSON schema)
  };
  
  reasoning_depth: "shallow" | "standard" | "deep";  // Affects prompt complexity
  
  model_override?: string;           // Force specific model
}
```

**Outputs**:
```typescript
{
  answer: any;                       // The agent's response (typed per output_format)
  confidence: number;                // Agent's self-reported confidence (0-1)
  reasoning: string;                 // Natural language explanation
  
  trace: {
    prompt: string;                  // Full prompt sent to LLM
    raw_response: string;            // Raw LLM output
    parsed_at: string;               // Timestamp
    model_used: string;              // Which model
    latency_ms: number;              // Response time
    tokens: {
      input: number;
      output: number;
    };
  };
  
  factors?: Array<{                  // Key decision factors (if deep reasoning)
    factor: string;
    influence: "positive" | "negative" | "neutral";
    weight: number;                  // 0-1
  }>;
}
```

**Implementation Notes**:
- Route to appropriate model based on `reasoning_depth` and question complexity
- Apply prompt template (see 05-AGENT-PROMPTS.md)
- Parse response according to `output_format`
- Validate parsed output
- Store full trace for debugging

**Model Selection Logic**:
```typescript
function selectModel(input: AgentReasonInput): string {
  // Override takes precedence
  if (input.model_override) return input.model_override;
  
  // Game theory actors need best model
  if (input.context?.other_agents?.length > 0) {
    return "claude-opus-4-5-20250514";
  }
  
  // Deep reasoning needs good model
  if (input.reasoning_depth === "deep") {
    return "claude-sonnet-4-20250514";
  }
  
  // Simple binary can use fast model
  if (input.output_format.type === "binary" && input.reasoning_depth === "shallow") {
    return "claude-haiku-3-5-20241022";
  }
  
  // Default
  return "claude-sonnet-4-20250514";
}
```

---

### `agent.converse`

**Purpose**: Multi-turn conversation with an agent for exploration.

**When to use**:
- User wants to "talk" to a simulated agent
- Exploring reasoning in depth
- Testing different framings of a question

**Inputs**:
```typescript
{
  agent_id: string;
  
  messages: Array<{
    role: "user" | "agent";
    content: string;
  }>;
  
  system_context?: string;           // Additional context for this conversation
  
  max_turns?: number;                // Limit conversation length
}
```

**Outputs**:
```typescript
{
  response: string;                  // Agent's response
  
  conversation_id: string;           // For continuation
  
  turn_count: number;
  
  trace: {
    full_prompt: string;
    raw_response: string;
    model_used: string;
  };
}
```

---

## Category 2: Population Primitives

These primitives operate on collections of agents.

---

### `population.sample`

**Purpose**: Draw a sample of agents from a population definition.

**When to use**:
- Starting any Monte Carlo simulation
- Creating the agent pool for ABM
- Any time you need "a group of people"

**Inputs**:
```typescript
{
  population_id?: string;            // Reference to stored population
  // OR
  population_spec: {
    base: string;                    // "us_adults", "us_voters", "custom"
    size: number;                    // Target sample size
    
    // Optional filters
    filters?: Array<{
      trait: string;                 // e.g., "age"
      operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "between";
      value: any;                    // e.g., 35 or [25, 54] or ["urban", "suburban"]
    }>;
    
    // Optional oversampling for specific segments
    oversample?: Array<{
      filter: { trait: string; operator: string; value: any };
      factor: number;                // 2.0 = 2x representation
    }>;
  };
  
  // Sampling strategy
  strategy: "random" | "stratified" | "quota" | "archetype";
  
  // For archetype strategy: cluster similar agents
  archetype_config?: {
    n_archetypes: number;            // How many distinct types
    clustering_traits: string[];     // Which traits to cluster on
  };
  
  // Random seed for reproducibility
  seed?: number;
}
```

**Outputs**:
```typescript
{
  agents: Agent[];                   // The sampled agents
  
  sample_metadata: {
    requested_size: number;
    actual_size: number;
    strategy_used: string;
    
    // Demographics of sample
    distribution: {
      [trait: string]: {
        [value: string]: number;     // Count per value
      };
    };
    
    // For archetype strategy
    archetypes?: Array<{
      archetype_id: string;
      centroid: { [trait: string]: any };
      member_count: number;
      representative_agent: Agent;
    }>;
  };
  
  weights?: number[];                // Statistical weights for each agent (for weighted aggregation)
}
```

**Implementation Notes**:
- Use IPF (Iterative Proportional Fitting) to generate statistically valid populations
- For archetype strategy: cluster agents, return one representative per cluster with weights
- Store weights for proper aggregation later
- Validate against census/survey distributions

---

### `population.filter`

**Purpose**: Subset a population based on trait criteria.

**When to use**:
- Segment analysis ("show me just urban millennials")
- Conditional sampling
- Creating subgroups for comparison

**Inputs**:
```typescript
{
  agents: Agent[];                   // Input population
  
  filters: Array<{
    trait: string;
    operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "between";
    value: any;
  }>;
  
  combine: "and" | "or";             // How to combine multiple filters
}
```

**Outputs**:
```typescript
{
  agents: Agent[];                   // Filtered population
  
  filter_metadata: {
    input_size: number;
    output_size: number;
    retention_rate: number;          // output/input
    filters_applied: object[];
  };
}
```

---

### `population.segment`

**Purpose**: Divide a population into non-overlapping segments for analysis.

**When to use**:
- Analyzing results by demographic group
- Identifying which segments respond differently
- Creating segment-specific reports

**Inputs**:
```typescript
{
  agents: Agent[];                   // Full population
  // OR
  agent_results: Array<{             // Agents with their results
    agent: Agent;
    result: any;
  }>;
  
  segment_by: string | string[];     // Trait(s) to segment on
  
  // For continuous traits, how to bucket
  bucketing?: {
    [trait: string]: {
      method: "quantile" | "equal_width" | "custom";
      n_buckets?: number;
      boundaries?: number[];
    };
  };
}
```

**Outputs**:
```typescript
{
  segments: Array<{
    segment_id: string;
    segment_name: string;            // Human readable: "Age 25-34, Urban"
    segment_criteria: object;
    agents: Agent[];
    agent_count: number;
    
    // If results were provided
    results?: {
      distribution: { [value: string]: number };
      mean?: number;
      median?: number;
    };
  }>;
  
  segment_comparison?: {
    metric: string;
    by_segment: { [segment_id: string]: number };
    max_difference: number;
    most_different_segments: [string, string];
  };
}
```

---

## Category 3: Orchestration Primitives

These primitives coordinate multi-agent execution patterns.

---

### `orchestrate.monte_carlo`

**Purpose**: Run many agents in parallel on the same question, aggregate results.

**When to use**:
- Consumer surveys ("would you buy X?")
- Polling ("who would you vote for?")
- Sentiment analysis ("how do you feel about X?")
- Any "what percent of people would..." question

**Inputs**:
```typescript
{
  agents: Agent[];                   // Population to simulate
  weights?: number[];                // Statistical weights per agent
  
  question: string;                  // The question to ask all agents
  
  context?: {
    scenario: string;                // Shared context for all agents
    information?: string;            // Info all agents have
  };
  
  output_format: {
    type: "binary" | "categorical" | "numeric" | "likert";
    options?: string[];              // For categorical
    range?: [number, number];        // For numeric
    scale?: number;                  // For likert (e.g., 5 or 7)
  };
  
  // Execution config
  reasoning_depth: "shallow" | "standard" | "deep";
  
  // Optimization
  use_archetypes?: boolean;          // If agents have archetype assignments
  batch_similar?: boolean;           // Batch agents with similar traits
  
  // Sampling (if running subset)
  sample_size?: number;              // Run only this many, extrapolate
  confidence_target?: number;        // Keep running until this confidence
}
```

**Outputs**:
```typescript
{
  // Primary result
  distribution: {
    [response: string]: {
      count: number;
      percentage: number;
      weighted_percentage: number;   // If weights provided
    };
  };
  
  // Summary statistics
  summary: {
    mode: string;                    // Most common response
    mean?: number;                   // For numeric
    median?: number;
    std_dev?: number;
    
    confidence_interval: {
      level: number;                 // e.g., 0.95
      lower: number;
      upper: number;
    };
  };
  
  // Execution metadata
  execution: {
    total_agents: number;
    agents_simulated: number;        // May be less if using archetypes
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
  
  // Individual results (for drill-down)
  agent_results: Array<{
    agent_id: string;
    agent_summary: string;           // "34yo urban professional"
    answer: any;
    confidence: number;
    reasoning_summary: string;       // Truncated reasoning
  }>;
  
  // Full traces (optional, for debugging)
  traces?: ReasoningTrace[];
}
```

**Implementation Notes**:
```typescript
async function executeMonteCarlo(input: MonteCarloInput): Promise<MonteCarloOutput> {
  const { agents, weights, question, context, output_format, reasoning_depth } = input;
  
  // 1. Prepare agent reasoning calls
  const reasoningCalls = agents.map((agent, i) => ({
    agent,
    weight: weights?.[i] ?? 1,
    input: {
      agent,
      question,
      context,
      output_format,
      reasoning_depth
    }
  }));
  
  // 2. Batch similar agents if enabled
  let batches: ReasoningCall[][];
  if (input.batch_similar) {
    batches = batchBySimilarity(reasoningCalls, { maxBatchSize: 10 });
  } else {
    batches = [reasoningCalls];
  }
  
  // 3. Execute in parallel with concurrency limit
  const results = await parallelExecute(batches, {
    concurrency: 50,  // Max parallel LLM calls
    retries: 2,
    timeout: 30000
  });
  
  // 4. Aggregate results
  const distribution = aggregateResponses(results, weights);
  
  // 5. Calculate statistics
  const summary = calculateStatistics(distribution, output_format);
  
  // 6. Build output
  return {
    distribution,
    summary,
    execution: buildExecutionMetadata(results),
    agent_results: results.map(summarizeAgentResult),
    traces: input.include_traces ? results.map(r => r.trace) : undefined
  };
}
```

---

### `orchestrate.game_theory`

**Purpose**: Model strategic interaction where actors reason about each other.

**When to use**:
- Competitive strategy ("if we do X, what will competitor do?")
- Negotiations
- Adversarial scenarios
- Any "how will they respond to our move" question

**Inputs**:
```typescript
{
  actors: Array<{
    agent: Agent;                    // The actor (e.g., competitor CEO)
    name: string;                    // Identifier
    role: string;                    // "player" | "nature" | "observer"
    
    // Actor-specific context
    objectives: string[];            // What they're trying to achieve
    constraints: string[];           // Limitations
    information: string;             // What they know
    
    // Strategy space
    available_actions?: string[];    // Discrete actions
    // OR
    action_space?: {                 // Continuous/complex
      description: string;
      constraints: string[];
    };
  }>;
  
  // Game structure
  game_type: "simultaneous" | "sequential" | "repeated";
  
  // For sequential games
  move_order?: string[];             // Actor names in order
  
  // For repeated games
  rounds?: number;
  
  // Iteration config
  max_iterations: number;            // Max best-response iterations
  convergence_threshold: number;     // Stop when changes < this
  
  // Initial state
  initial_state?: {
    [key: string]: any;
  };
  
  // Payoff structure (optional - can be implicit)
  payoffs?: {
    description: string;             // Natural language description
    // OR explicit matrix for simple games
    matrix?: {
      [actor1_action: string]: {
        [actor2_action: string]: {
          [actor: string]: number;
        };
      };
    };
  };
}
```

**Outputs**:
```typescript
{
  // Equilibrium (or final state)
  equilibrium: {
    found: boolean;
    iterations_to_converge: number;
    
    strategies: {
      [actor_name: string]: {
        action: string;              // Their equilibrium action
        reasoning: string;           // Why
        confidence: number;
        
        best_response_to: {          // What they were responding to
          [other_actor: string]: string;
        };
      };
    };
    
    outcome: {
      description: string;
      payoffs?: { [actor: string]: number };
    };
  };
  
  // Full iteration history
  iterations: Array<{
    iteration: number;
    
    moves: {
      [actor_name: string]: {
        action: string;
        reasoning: string;
        changed_from_previous: boolean;
      };
    };
    
    state_after: object;
  }>;
  
  // Analysis
  analysis: {
    stability: "stable" | "unstable" | "cycling";
    key_dependencies: Array<{
      actor: string;
      depends_on: string;
      relationship: string;
    }>;
    
    sensitivity: Array<{
      if_actor: string;
      deviated_to: string;
      others_would: { [actor: string]: string };
      outcome_change: string;
    }>;
  };
  
  traces: ReasoningTrace[];
}
```

**Implementation Notes**:
```typescript
async function executeGameTheory(input: GameTheoryInput): Promise<GameTheoryOutput> {
  const { actors, game_type, max_iterations, convergence_threshold } = input;
  
  // Initialize state
  let state = input.initial_state ?? {};
  let strategies: { [actor: string]: string } = {};
  let iterations: Iteration[] = [];
  let converged = false;
  
  // Iterated best response
  for (let i = 0; i < max_iterations && !converged; i++) {
    const previousStrategies = { ...strategies };
    const moves: { [actor: string]: MoveResult } = {};
    
    // Each actor best-responds (can parallelize for simultaneous games)
    if (game_type === "simultaneous") {
      // Parallel execution
      const results = await Promise.all(
        actors.filter(a => a.role === "player").map(actor => 
          computeBestResponse(actor, strategies, state, input)
        )
      );
      results.forEach(r => {
        strategies[r.actor] = r.action;
        moves[r.actor] = r;
      });
    } else {
      // Sequential execution
      for (const actorName of input.move_order ?? actors.map(a => a.name)) {
        const actor = actors.find(a => a.name === actorName);
        if (actor?.role === "player") {
          const result = await computeBestResponse(actor, strategies, state, input);
          strategies[actorName] = result.action;
          moves[actorName] = result;
        }
      }
    }
    
    // Record iteration
    iterations.push({ iteration: i, moves, state_after: { ...state } });
    
    // Check convergence
    converged = checkConvergence(previousStrategies, strategies, convergence_threshold);
  }
  
  return {
    equilibrium: {
      found: converged,
      iterations_to_converge: iterations.length,
      strategies: buildStrategySummary(actors, strategies, iterations),
      outcome: describeOutcome(strategies, input)
    },
    iterations,
    analysis: analyzeGame(iterations, actors),
    traces: collectTraces(iterations)
  };
}

async function computeBestResponse(
  actor: Actor,
  otherStrategies: { [actor: string]: string },
  state: object,
  gameInput: GameTheoryInput
): Promise<MoveResult> {
  // Build prompt for this actor to choose best response
  const prompt = buildGameTheoryPrompt(actor, otherStrategies, state, gameInput);
  
  // Use Opus for strategic reasoning
  const response = await callLLM({
    model: "claude-opus-4-5-20250514",
    prompt,
    output_format: {
      type: "structured",
      schema: {
        action: "string",
        reasoning: "string",
        confidence: "number",
        anticipated_responses: "object"
      }
    }
  });
  
  return {
    actor: actor.name,
    action: response.action,
    reasoning: response.reasoning,
    confidence: response.confidence,
    trace: response.trace
  };
}
```

---

### `orchestrate.abm`

**Purpose**: Agent-based model with environment, time steps, and emergent dynamics.

**When to use**:
- Opinion/information spread
- Social contagion
- Market dynamics over time
- Any "how does X spread/evolve" question

**Inputs**:
```typescript
{
  agents: Agent[];
  
  // Environment definition
  environment: {
    initial_state: {
      [key: string]: any;
    };
    
    // Network structure (optional)
    network?: {
      type: "random" | "small_world" | "scale_free" | "grid" | "custom";
      params?: object;
      adjacency?: number[][];        // For custom
    };
    
    // Global variables
    globals?: {
      [key: string]: any;
    };
  };
  
  // Agent behavior per timestep
  agent_step: {
    // What does each agent perceive?
    perception: {
      sees_neighbors: boolean;
      sees_globals: boolean;
      perception_radius?: number;    // For spatial models
      custom_perception?: string;    // Description of what they see
    };
    
    // What question do they answer?
    decision_question: string;       // Template with {variables}
    
    // How do they affect environment?
    action_effects: {
      type: "update_own_state" | "broadcast" | "targeted" | "custom";
      description: string;
    };
  };
  
  // Simulation config
  timesteps: number;
  
  // Stop conditions
  stop_conditions?: Array<{
    condition: string;               // e.g., "consensus_reached"
    threshold?: number;
  }>;
  
  // Sampling (don't need to run all agents every step)
  agent_activation: "synchronous" | "random" | "random_subset";
  activation_rate?: number;          // For random_subset
}
```

**Outputs**:
```typescript
{
  // Final state
  final_state: {
    timestep: number;
    environment: object;
    agent_states: Array<{
      agent_id: string;
      state: object;
    }>;
  };
  
  // Time series
  trajectory: Array<{
    timestep: number;
    
    environment_state: object;
    
    aggregate_metrics: {
      [metric: string]: number;      // e.g., "percent_adopted": 0.45
    };
    
    events: Array<{
      agent_id: string;
      action: string;
      effect: string;
    }>;
  }>;
  
  // Analysis
  analysis: {
    convergence: {
      converged: boolean;
      timestep?: number;
      final_distribution: object;
    };
    
    dynamics: {
      tipping_point?: number;        // When did adoption accelerate?
      growth_rate: number[];         // Per timestep
      influencer_agents?: string[];  // Who had most impact?
    };
    
    patterns: string[];              // Detected patterns
  };
  
  // Sampled traces (not all agents all steps)
  traces: ReasoningTrace[];
}
```

---

## Category 4: Aggregation Primitives

---

### `aggregate.distribution`

**Purpose**: Convert individual agent responses into a distribution.

**When to use**:
- After Monte Carlo, summarize results
- Any time you need "X% said yes"

**Inputs**:
```typescript
{
  results: Array<{
    agent_id?: string;
    response: any;
    weight?: number;
  }>;
  
  response_type: "binary" | "categorical" | "numeric" | "likert";
  
  // For numeric, how to bucket
  bucketing?: {
    method: "auto" | "fixed_width" | "quantile" | "custom";
    n_buckets?: number;
    boundaries?: number[];
  };
}
```

**Outputs**:
```typescript
{
  distribution: {
    [value: string]: {
      count: number;
      percentage: number;
      weighted_percentage?: number;
    };
  };
  
  statistics: {
    n: number;
    mode: string;
    mean?: number;
    median?: number;
    std_dev?: number;
    percentiles?: { [p: string]: number };
  };
}
```

---

### `aggregate.weighted`

**Purpose**: Combine results from multiple branches/scenarios with weights.

**When to use**:
- After counterfactual branches, combine into expected value
- Ensemble predictions

**Inputs**:
```typescript
{
  results: Array<{
    scenario_name: string;
    weight: number;                  // Should sum to 1
    distribution: object;            // From aggregate.distribution
  }>;
}
```

**Outputs**:
```typescript
{
  combined_distribution: {
    [value: string]: {
      weighted_percentage: number;
      by_scenario: {
        [scenario: string]: number;
      };
    };
  };
  
  expected_value?: number;           // For numeric outcomes
  
  uncertainty: {
    scenario_disagreement: number;   // How much scenarios differ
    max_scenario_gap: {
      outcome: string;
      scenarios: [string, string];
      gap: number;
    };
  };
}
```

---

### `aggregate.consensus`

**Purpose**: Find agreement/disagreement among a group.

**When to use**:
- Game theory: checking if actors agree
- Identifying areas of consensus/conflict

**Inputs**:
```typescript
{
  results: Array<{
    actor_name: string;
    position: any;
    reasoning?: string;
  }>;
  
  consensus_threshold: number;       // What % agreement = consensus
}
```

**Outputs**:
```typescript
{
  consensus_reached: boolean;
  consensus_position?: any;
  agreement_level: number;           // 0-1
  
  position_clusters: Array<{
    position: any;
    actors: string[];
    percentage: number;
  }>;
  
  key_disagreements: Array<{
    actors: [string, string];
    positions: [any, any];
    reasoning_difference: string;
  }>;
}
```

---

## Category 5: Branching Primitives

---

### `branch.scenario`

**Purpose**: Define a counterfactual scenario for comparison.

**When to use**:
- "What if competitor matches price?"
- "What if economy enters recession?"
- Any "what if X" analysis

**Inputs**:
```typescript
{
  scenario_name: string;
  
  description: string;               // Human readable
  
  probability?: number;              // Estimated likelihood (0-1)
  
  modifications: {
    // Context modifications
    context_changes?: {
      [key: string]: any;
    };
    
    // Agent modifications
    agent_changes?: {
      filter?: object;               // Which agents to modify
      trait_changes?: object;        // How to modify them
      belief_changes?: object;
    };
    
    // Environment modifications (for ABM)
    environment_changes?: object;
  };
}
```

**Outputs**:
```typescript
{
  scenario_id: string;
  scenario_name: string;
  
  modified_context: object;
  modified_agents?: Agent[];
  modified_environment?: object;
  
  ready: boolean;                    // Ready for execution
}
```

---

### `branch.compare`

**Purpose**: Run same simulation under multiple scenarios.

**When to use**:
- Comparing counterfactuals
- Sensitivity analysis
- "Compare outcome under A vs B vs C"

**Inputs**:
```typescript
{
  base_simulation: {
    type: "monte_carlo" | "game_theory" | "abm";
    config: object;                  // Full config for the simulation
  };
  
  scenarios: Array<{
    scenario_name: string;
    probability: number;
    modifications: object;
  }>;
  
  parallel: boolean;                 // Run scenarios in parallel
}
```

**Outputs**:
```typescript
{
  results_by_scenario: {
    [scenario_name: string]: {
      probability: number;
      result: object;                // Full simulation result
      key_metrics: { [metric: string]: number };
    };
  };
  
  comparison: {
    metric_comparison: {
      [metric: string]: {
        by_scenario: { [scenario: string]: number };
        expected_value: number;      // Probability-weighted
        range: [number, number];
        most_sensitive_to: string;   // Which scenario swings it most
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

---

### `branch.merge`

**Purpose**: Combine branch results into a single weighted prediction.

**When to use**:
- After branch.compare, create final prediction
- Ensemble different simulation approaches

**Inputs**:
```typescript
{
  branches: Array<{
    name: string;
    weight: number;
    result: object;
  }>;
  
  merge_strategy: "weighted_average" | "expected_value" | "worst_case" | "best_case";
}
```

**Outputs**:
```typescript
{
  merged_result: {
    primary_prediction: any;
    confidence: number;
    
    contribution_by_branch: {
      [branch: string]: {
        weight: number;
        contribution: number;        // How much this branch affected result
      };
    };
  };
  
  uncertainty: {
    total_uncertainty: number;
    from_branches: number;           // Uncertainty from branch weights
    within_branches: number;         // Uncertainty within each branch
  };
}
```

---

## Category 6: Analysis Primitives

---

### `analyze.factors`

**Purpose**: Identify what drove a prediction.

**When to use**:
- Explaining why result came out this way
- Identifying actionable insights

**Inputs**:
```typescript
{
  simulation_result: object;         // Full result from any simulation
  agent_results: Array<{
    agent: Agent;
    response: any;
    reasoning: string;
  }>;
  
  analysis_type: "feature_importance" | "reasoning_themes" | "both";
}
```

**Outputs**:
```typescript
{
  // Which traits predicted outcome
  feature_importance: Array<{
    feature: string;                 // e.g., "income_bracket"
    importance: number;              // 0-1
    direction: string;               // "high_income → more likely yes"
    evidence: string;
  }>;
  
  // Common reasoning themes
  reasoning_themes: Array<{
    theme: string;
    frequency: number;               // How often mentioned
    associated_with: string;         // Which response
    example_quotes: string[];
  }>;
  
  // Summary
  key_drivers: Array<{
    factor: string;
    impact: "high" | "medium" | "low";
    explanation: string;
  }>;
}
```

---

### `analyze.sensitivity`

**Purpose**: How would changes in inputs affect the output?

**When to use**:
- "What if we changed the price to X instead?"
- Identifying which assumptions matter most

**Inputs**:
```typescript
{
  base_result: object;
  
  parameters_to_vary: Array<{
    parameter: string;               // What to change
    variations: any[];               // Values to try
  }>;
  
  // Can either re-run simulation or estimate
  method: "rerun" | "estimate";
}
```

**Outputs**:
```typescript
{
  sensitivity_results: Array<{
    parameter: string;
    
    effect: Array<{
      value: any;
      outcome: number;
      change_from_base: number;
    }>;
    
    sensitivity_score: number;       // How much this parameter matters
    relationship: "linear" | "nonlinear" | "threshold";
    
    recommendation?: string;
  }>;
  
  tornado_chart_data: Array<{
    parameter: string;
    low_value: any;
    high_value: any;
    outcome_range: [number, number];
  }>;
}
```

---

### `analyze.uncertainty`

**Purpose**: Quantify confidence and identify sources of uncertainty.

**When to use**:
- Understanding how reliable a prediction is
- Identifying what would reduce uncertainty

**Inputs**:
```typescript
{
  simulation_result: object;
  simulation_config: object;
  agent_results: object[];
}
```

**Outputs**:
```typescript
{
  overall_confidence: number;        // 0-1
  
  confidence_interval: {
    level: number;                   // e.g., 0.95
    lower: number;
    upper: number;
  };
  
  uncertainty_sources: Array<{
    source: string;
    contribution: number;            // % of total uncertainty
    reducible: boolean;              // Can we get better data?
    reduction_method?: string;       // How to reduce
  }>;
  
  data_quality_assessment: {
    population_representativeness: number;
    calibration_recency: string;
    sample_size_adequacy: number;
  };
  
  recommendations: string[];
}
```

---

## Primitive Selection Guide

| Question Type | Primary Primitive | Supporting Primitives |
|--------------|-------------------|----------------------|
| "Would customers buy X?" | `orchestrate.monte_carlo` | `population.sample`, `aggregate.distribution`, `analyze.factors` |
| "What if we do X?" | `branch.compare` | `orchestrate.monte_carlo`, `branch.scenario`, `branch.merge` |
| "How will competitor respond?" | `orchestrate.game_theory` | `agent.create`, `analyze.sensitivity` |
| "How does opinion spread?" | `orchestrate.abm` | `population.sample`, environment setup |
| "Why did we predict X?" | `analyze.factors` | `analyze.uncertainty` |
| "Which segment responds best?" | `population.segment` | after monte_carlo results |
| "Talk to a customer" | `agent.converse` | after identifying interesting agent |
