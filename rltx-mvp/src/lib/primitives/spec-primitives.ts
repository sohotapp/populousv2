/**
 * RLTX Primitives - Complete Reference from Domain Architecture Spec
 *
 * 6 Categories, 18 Primitives total:
 * - Agent (3): agent.create, agent.reason, agent.converse
 * - Population (3): population.sample, population.filter, population.segment
 * - Orchestrate (3): orchestrate.monte_carlo, orchestrate.game_theory, orchestrate.abm
 * - Aggregate (3): aggregate.distribution, aggregate.weighted, aggregate.consensus
 * - Branch (3): branch.scenario, branch.compare, branch.merge
 * - Analyze (3): analyze.factors, analyze.sensitivity, analyze.uncertainty
 */

import type { Primitive, Port } from "@/types";

// ============================================================
// LINEAR DESIGN TOKENS (verbatim from design.md)
// ============================================================
export const designTokens = {
  // Backgrounds
  bgBase: "hsl(0, 0%, 7%)",
  bgSurface: "hsl(0, 0%, 10%)",
  bgElevated: "hsl(0, 0%, 9%)",
  bgHover: "hsl(0, 0%, 12%)",
  bgActive: "hsl(0, 0%, 14%)",

  // Borders
  borderSubtle: "hsl(0, 0%, 12%)",
  borderDefault: "hsl(0, 0%, 15%)",
  borderHover: "hsl(0, 0%, 20%)",
  borderFocus: "hsl(0, 0%, 25%)",

  // Text
  textPrimary: "hsl(0, 0%, 93%)",
  textSecondary: "hsl(0, 0%, 70%)",
  textTertiary: "hsl(0, 0%, 50%)",
  textQuaternary: "hsl(0, 0%, 35%)",

  // Icons
  iconPrimary: "hsl(0, 0%, 93%)",
  iconSecondary: "hsl(0, 0%, 45%)",
  iconEmpty: "hsl(0, 0%, 20%)",

  // Status
  statusSuccess: "hsl(142, 70%, 45%)",
  statusWarning: "hsl(38, 90%, 50%)",
  statusError: "hsl(0, 70%, 55%)",
  statusInfo: "hsl(210, 70%, 55%)",

  // Accents (for node categories)
  accentAgent: "hsl(270, 60%, 50%)",       // Purple
  accentPopulation: "hsl(210, 60%, 50%)",  // Blue
  accentOrchestrate: "hsl(38, 70%, 50%)",  // Orange
  accentAggregate: "hsl(142, 60%, 45%)",   // Green
  accentBranch: "hsl(330, 60%, 50%)",      // Pink
  accentAnalyze: "hsl(0, 60%, 50%)",       // Red

  // Typography
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontSizeBase: "13px",
  fontSizeSmall: "11px",
  fontSizeLarge: "15px",
  fontWeightNormal: 400,
  fontWeightMedium: 500,
  fontWeightSemibold: 600,

  // Spacing
  spacingXs: "4px",
  spacingSm: "8px",
  spacingMd: "12px",
  spacingLg: "16px",
  spacingXl: "24px",

  // Transitions
  transitionFast: "100ms ease",
  transitionNormal: "150ms ease",
  transitionSlow: "200ms ease",

  // Border radius
  radiusSm: "4px",
  radiusMd: "6px",
  radiusLg: "8px",
};

// ============================================================
// CATEGORY DEFINITIONS
// ============================================================
export type PrimitiveCategory =
  | "agent"
  | "population"
  | "orchestrate"
  | "aggregate"
  | "branch"
  | "analyze";

export interface CategoryDefinition {
  id: PrimitiveCategory;
  name: string;
  description: string;
  color: string;
  icon: string;
}

export const categories: Record<PrimitiveCategory, CategoryDefinition> = {
  agent: {
    id: "agent",
    name: "Agent",
    description: "Primitives that operate on individual agents",
    color: designTokens.accentAgent,
    icon: "User",
  },
  population: {
    id: "population",
    name: "Population",
    description: "Primitives that operate on collections of agents",
    color: designTokens.accentPopulation,
    icon: "Users",
  },
  orchestrate: {
    id: "orchestrate",
    name: "Orchestrate",
    description: "Primitives that coordinate multi-agent execution patterns",
    color: designTokens.accentOrchestrate,
    icon: "Workflow",
  },
  aggregate: {
    id: "aggregate",
    name: "Aggregate",
    description: "Primitives that combine and summarize results",
    color: designTokens.accentAggregate,
    icon: "BarChart3",
  },
  branch: {
    id: "branch",
    name: "Branch",
    description: "Primitives for counterfactual and scenario analysis",
    color: designTokens.accentBranch,
    icon: "GitBranch",
  },
  analyze: {
    id: "analyze",
    name: "Analyze",
    description: "Primitives that identify drivers and quantify uncertainty",
    color: designTokens.accentAnalyze,
    icon: "LineChart",
  },
};

// ============================================================
// PRIMITIVE DEFINITIONS (All 18 from spec)
// ============================================================
export const specPrimitives: Record<string, Primitive> = {
  // ========== AGENT PRIMITIVES (3) ==========

  "agent.create": {
    id: "agent.create",
    name: "Create Agent",
    description: "Instantiate a single agent with specific traits, beliefs, and memory",
    category: "agent",
    icon: "UserPlus",
    color: designTokens.accentAgent,
    inputs: [],
    outputs: [
      { id: "agent_id", name: "Agent ID", type: "string", required: true },
      { id: "agent", name: "Agent", type: "object", required: true },
      { id: "prompt_context", name: "Prompt Context", type: "string", required: true },
    ],
    config: {
      type: "object",
      properties: {
        name: { type: "string", title: "Agent Name", description: "For named actors (game theory)" },
        role: { type: "string", title: "Role", enum: ["consumer", "competitor_ceo", "voter", "custom"], default: "consumer" },
        traits: {
          type: "object",
          title: "Traits",
          description: "Demographics, psychographics, and behavioral traits",
          properties: {
            age: { type: "string", title: "Age" },
            gender: { type: "string", title: "Gender" },
            income: { type: "string", title: "Income" },
            education: { type: "string", title: "Education" },
            location: { type: "string", title: "Location" },
            occupation: { type: "string", title: "Occupation" },
            risk_tolerance: { type: "number", title: "Risk Tolerance", minimum: 0, maximum: 1 },
            brand_loyalty: { type: "number", title: "Brand Loyalty", minimum: 0, maximum: 1 },
          },
        },
        beliefs: { type: "object", title: "Beliefs", description: "What the agent believes about topics" },
        goals: { type: "array", title: "Goals", items: { type: "string" } },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 0.01 },
    estimatedTime: { p50: 100, p95: 500 },
  },

  "agent.reason": {
    id: "agent.reason",
    name: "Agent Reason",
    description: "Have an agent answer a question or make a decision",
    category: "agent",
    icon: "Brain",
    color: designTokens.accentAgent,
    inputs: [
      { id: "agent", name: "Agent", type: "object", required: true },
      { id: "context", name: "Context", type: "object", required: false },
    ],
    outputs: [
      { id: "answer", name: "Answer", type: "any", required: true },
      { id: "confidence", name: "Confidence", type: "number", required: true },
      { id: "reasoning", name: "Reasoning", type: "string", required: true },
      { id: "factors", name: "Factors", type: "array", required: false },
      { id: "trace", name: "Trace", type: "object", required: true },
    ],
    config: {
      type: "object",
      properties: {
        question: { type: "string", title: "Question", description: "The question to answer" },
        output_format: {
          type: "object",
          title: "Output Format",
          properties: {
            type: { type: "string", title: "Type", enum: ["binary", "categorical", "numeric", "open", "structured"], default: "categorical" },
            options: { type: "array", title: "Options", items: { type: "string" } },
            range: { type: "array", title: "Range", items: { type: "number" } },
          },
        },
        reasoning_depth: { type: "string", title: "Reasoning Depth", enum: ["shallow", "standard", "deep"], default: "standard" },
      },
      required: ["question"],
    },
    executor: "llm",
    estimatedCost: { dollars: 0.50 },
    estimatedTime: { p50: 5000, p95: 15000 },
  },

  "agent.converse": {
    id: "agent.converse",
    name: "Agent Converse",
    description: "Multi-turn conversation with an agent for exploration",
    category: "agent",
    icon: "MessageSquare",
    color: designTokens.accentAgent,
    inputs: [
      { id: "agent_id", name: "Agent ID", type: "string", required: true },
      { id: "messages", name: "Messages", type: "array", required: false },
    ],
    outputs: [
      { id: "response", name: "Response", type: "string", required: true },
      { id: "conversation_id", name: "Conversation ID", type: "string", required: true },
      { id: "turn_count", name: "Turn Count", type: "number", required: true },
      { id: "trace", name: "Trace", type: "object", required: true },
    ],
    config: {
      type: "object",
      properties: {
        system_context: { type: "string", title: "System Context", description: "Additional context for this conversation" },
        max_turns: { type: "number", title: "Max Turns", default: 10, minimum: 1, maximum: 50 },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 1.00 },
    estimatedTime: { p50: 8000, p95: 20000 },
  },

  // ========== POPULATION PRIMITIVES (3) ==========

  "population.sample": {
    id: "population.sample",
    name: "Sample Population",
    description: "Draw a sample of agents from a population definition",
    category: "population",
    icon: "Users",
    color: designTokens.accentPopulation,
    inputs: [],
    outputs: [
      { id: "agents", name: "Agents", type: "array", required: true },
      { id: "sample_metadata", name: "Sample Metadata", type: "object", required: true },
      { id: "weights", name: "Statistical Weights", type: "array", required: false },
    ],
    config: {
      type: "object",
      properties: {
        population_spec: {
          type: "object",
          title: "Population Spec",
          properties: {
            base: { type: "string", title: "Base Population", enum: ["us_adults", "us_voters", "us_consumers", "enterprise_decision_makers", "custom"], default: "us_adults" },
            size: { type: "number", title: "Sample Size", default: 1000, minimum: 10, maximum: 100000 },
          },
        },
        strategy: { type: "string", title: "Sampling Strategy", enum: ["random", "stratified", "quota", "archetype"], default: "stratified" },
        filters: {
          type: "array",
          title: "Filters",
          items: {
            type: "object",
            properties: {
              trait: { type: "string" },
              operator: { type: "string", enum: ["eq", "neq", "gt", "lt", "gte", "lte", "in", "between"] },
              value: { type: "string" },
            },
          },
        },
        archetype_config: {
          type: "object",
          title: "Archetype Config",
          properties: {
            n_archetypes: { type: "number", title: "Number of Archetypes", default: 50 },
            clustering_traits: { type: "array", title: "Clustering Traits", items: { type: "string" } },
          },
        },
        seed: { type: "number", title: "Random Seed", description: "For reproducibility" },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 0.05 },
    estimatedTime: { p50: 2000, p95: 8000 },
  },

  "population.filter": {
    id: "population.filter",
    name: "Filter Population",
    description: "Subset a population based on trait criteria",
    category: "population",
    icon: "Filter",
    color: designTokens.accentPopulation,
    inputs: [
      { id: "agents", name: "Agents", type: "array", required: true },
    ],
    outputs: [
      { id: "agents", name: "Filtered Agents", type: "array", required: true },
      { id: "filter_metadata", name: "Filter Metadata", type: "object", required: true },
    ],
    config: {
      type: "object",
      properties: {
        filters: {
          type: "array",
          title: "Filters",
          items: {
            type: "object",
            properties: {
              trait: { type: "string", title: "Trait" },
              operator: { type: "string", title: "Operator", enum: ["eq", "neq", "gt", "lt", "gte", "lte", "in", "between"] },
              value: { type: "string", title: "Value" },
            },
          },
        },
        combine: { type: "string", title: "Combine Logic", enum: ["and", "or"], default: "and" },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 0.01 },
    estimatedTime: { p50: 100, p95: 500 },
  },

  "population.segment": {
    id: "population.segment",
    name: "Segment Population",
    description: "Divide a population into non-overlapping segments for analysis",
    category: "population",
    icon: "PieChart",
    color: designTokens.accentPopulation,
    inputs: [
      { id: "agents", name: "Agents", type: "array", required: true },
      { id: "agent_results", name: "Agent Results", type: "array", required: false },
    ],
    outputs: [
      { id: "segments", name: "Segments", type: "array", required: true },
      { id: "segment_comparison", name: "Segment Comparison", type: "object", required: false },
    ],
    config: {
      type: "object",
      properties: {
        segment_by: { type: "array", title: "Segment By", items: { type: "string" }, default: ["age_group", "income_bracket"] },
        bucketing: {
          type: "object",
          title: "Bucketing",
          description: "For continuous traits, how to bucket",
        },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 0.02 },
    estimatedTime: { p50: 500, p95: 2000 },
  },

  // ========== ORCHESTRATE PRIMITIVES (3) ==========

  "orchestrate.monte_carlo": {
    id: "orchestrate.monte_carlo",
    name: "Monte Carlo",
    description: "Run many agents in parallel on the same question, aggregate results",
    category: "orchestrate",
    icon: "Shuffle",
    color: designTokens.accentOrchestrate,
    inputs: [
      { id: "agents", name: "Agents", type: "array", required: true },
      { id: "weights", name: "Weights", type: "array", required: false },
      { id: "context", name: "Context", type: "object", required: false },
    ],
    outputs: [
      { id: "distribution", name: "Distribution", type: "object", required: true },
      { id: "summary", name: "Summary Statistics", type: "object", required: true },
      { id: "execution", name: "Execution Metadata", type: "object", required: true },
      { id: "agent_results", name: "Agent Results", type: "array", required: true },
      { id: "traces", name: "Traces", type: "array", required: false },
    ],
    config: {
      type: "object",
      properties: {
        question: { type: "string", title: "Question", description: "The question to ask all agents" },
        context: {
          type: "object",
          title: "Context",
          properties: {
            scenario: { type: "string", title: "Scenario" },
            information: { type: "string", title: "Information" },
          },
        },
        output_format: {
          type: "object",
          title: "Output Format",
          properties: {
            type: { type: "string", title: "Type", enum: ["binary", "categorical", "numeric", "likert"], default: "categorical" },
            options: { type: "array", title: "Options", items: { type: "string" } },
            scale: { type: "number", title: "Likert Scale", default: 5 },
          },
        },
        reasoning_depth: { type: "string", title: "Reasoning Depth", enum: ["shallow", "standard", "deep"], default: "standard" },
        use_archetypes: { type: "boolean", title: "Use Archetypes", default: true },
        batch_similar: { type: "boolean", title: "Batch Similar", default: true },
        sample_size: { type: "number", title: "Sample Size", description: "Run only this many, extrapolate" },
        confidence_target: { type: "number", title: "Confidence Target", minimum: 0.8, maximum: 0.99 },
      },
      required: ["question"],
    },
    executor: "llm",
    estimatedCost: { dollars: 15.00 },
    estimatedTime: { p50: 120000, p95: 300000 },
  },

  "orchestrate.game_theory": {
    id: "orchestrate.game_theory",
    name: "Game Theory",
    description: "Model strategic interaction where actors reason about each other",
    category: "orchestrate",
    icon: "Target",
    color: designTokens.accentOrchestrate,
    inputs: [
      { id: "actors", name: "Actors", type: "array", required: true },
      { id: "initial_state", name: "Initial State", type: "object", required: false },
    ],
    outputs: [
      { id: "equilibrium", name: "Equilibrium", type: "object", required: true },
      { id: "iterations", name: "Iterations", type: "array", required: true },
      { id: "analysis", name: "Analysis", type: "object", required: true },
      { id: "traces", name: "Traces", type: "array", required: true },
    ],
    config: {
      type: "object",
      properties: {
        game_type: { type: "string", title: "Game Type", enum: ["simultaneous", "sequential", "repeated"], default: "sequential" },
        move_order: { type: "array", title: "Move Order", items: { type: "string" }, description: "Actor names in order (for sequential)" },
        rounds: { type: "number", title: "Rounds", description: "For repeated games" },
        max_iterations: { type: "number", title: "Max Iterations", default: 5, minimum: 1, maximum: 20 },
        convergence_threshold: { type: "number", title: "Convergence Threshold", default: 0.1, minimum: 0, maximum: 1 },
        payoffs: {
          type: "object",
          title: "Payoffs",
          properties: {
            description: { type: "string", title: "Description" },
          },
        },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 25.00 },
    estimatedTime: { p50: 180000, p95: 420000 },
  },

  "orchestrate.abm": {
    id: "orchestrate.abm",
    name: "Agent-Based Model",
    description: "Simulate opinion/adoption dynamics through agent interactions over time",
    category: "orchestrate",
    icon: "Network",
    color: designTokens.accentOrchestrate,
    inputs: [
      { id: "agents", name: "Agents", type: "array", required: true },
      { id: "environment", name: "Environment", type: "object", required: false },
    ],
    outputs: [
      { id: "final_state", name: "Final State", type: "object", required: true },
      { id: "trajectory", name: "Trajectory", type: "array", required: true },
      { id: "analysis", name: "Analysis", type: "object", required: true },
      { id: "traces", name: "Traces", type: "array", required: false },
    ],
    config: {
      type: "object",
      properties: {
        environment: {
          type: "object",
          title: "Environment",
          properties: {
            initial_state: { type: "object", title: "Initial State" },
            network: {
              type: "object",
              title: "Network",
              properties: {
                type: { type: "string", title: "Network Type", enum: ["random", "small_world", "scale_free", "grid", "custom"], default: "small_world" },
              },
            },
            globals: { type: "object", title: "Global Variables" },
          },
        },
        agent_step: {
          type: "object",
          title: "Agent Step",
          properties: {
            perception: {
              type: "object",
              properties: {
                sees_neighbors: { type: "boolean", default: true },
                sees_globals: { type: "boolean", default: true },
                perception_radius: { type: "number", default: 2 },
              },
            },
            decision_question: { type: "string", title: "Decision Question" },
            action_effects: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["update_own_state", "broadcast", "targeted", "custom"], default: "broadcast" },
                description: { type: "string" },
              },
            },
          },
        },
        timesteps: { type: "number", title: "Time Steps", default: 52, minimum: 1, maximum: 365 },
        stop_conditions: {
          type: "array",
          title: "Stop Conditions",
          items: {
            type: "object",
            properties: {
              condition: { type: "string" },
              threshold: { type: "number" },
            },
          },
        },
        agent_activation: { type: "string", title: "Agent Activation", enum: ["synchronous", "random", "random_subset"], default: "random_subset" },
        activation_rate: { type: "number", title: "Activation Rate", default: 0.3, minimum: 0.1, maximum: 1 },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 45.00 },
    estimatedTime: { p50: 300000, p95: 600000 },
  },

  // ========== AGGREGATE PRIMITIVES (3) ==========

  "aggregate.distribution": {
    id: "aggregate.distribution",
    name: "Distribution",
    description: "Convert individual agent responses into a distribution",
    category: "aggregate",
    icon: "BarChart3",
    color: designTokens.accentAggregate,
    inputs: [
      { id: "results", name: "Results", type: "array", required: true },
    ],
    outputs: [
      { id: "distribution", name: "Distribution", type: "object", required: true },
      { id: "statistics", name: "Statistics", type: "object", required: true },
    ],
    config: {
      type: "object",
      properties: {
        response_type: { type: "string", title: "Response Type", enum: ["binary", "categorical", "numeric", "likert"], default: "categorical" },
        bucketing: {
          type: "object",
          title: "Bucketing",
          properties: {
            method: { type: "string", title: "Method", enum: ["auto", "fixed_width", "quantile", "custom"], default: "auto" },
            n_buckets: { type: "number", title: "Number of Buckets" },
            boundaries: { type: "array", title: "Custom Boundaries", items: { type: "number" } },
          },
        },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 0.01 },
    estimatedTime: { p50: 200, p95: 1000 },
  },

  "aggregate.weighted": {
    id: "aggregate.weighted",
    name: "Weighted Aggregate",
    description: "Combine results from multiple branches/scenarios with weights",
    category: "aggregate",
    icon: "Scale",
    color: designTokens.accentAggregate,
    inputs: [
      { id: "results", name: "Results", type: "array", required: true },
    ],
    outputs: [
      { id: "combined_distribution", name: "Combined Distribution", type: "object", required: true },
      { id: "expected_value", name: "Expected Value", type: "number", required: false },
      { id: "uncertainty", name: "Uncertainty", type: "object", required: true },
    ],
    config: {
      type: "object",
      properties: {
        normalize_weights: { type: "boolean", title: "Normalize Weights", default: true },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 0.01 },
    estimatedTime: { p50: 100, p95: 500 },
  },

  "aggregate.consensus": {
    id: "aggregate.consensus",
    name: "Consensus",
    description: "Find agreement/disagreement among a group",
    category: "aggregate",
    icon: "CheckCircle2",
    color: designTokens.accentAggregate,
    inputs: [
      { id: "results", name: "Results", type: "array", required: true },
    ],
    outputs: [
      { id: "consensus_reached", name: "Consensus Reached", type: "boolean", required: true },
      { id: "consensus_position", name: "Consensus Position", type: "any", required: false },
      { id: "agreement_level", name: "Agreement Level", type: "number", required: true },
      { id: "position_clusters", name: "Position Clusters", type: "array", required: true },
      { id: "key_disagreements", name: "Key Disagreements", type: "array", required: false },
    ],
    config: {
      type: "object",
      properties: {
        consensus_threshold: { type: "number", title: "Consensus Threshold", default: 0.7, minimum: 0.5, maximum: 1 },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 0.01 },
    estimatedTime: { p50: 200, p95: 1000 },
  },

  // ========== BRANCH PRIMITIVES (3) ==========

  "branch.scenario": {
    id: "branch.scenario",
    name: "Scenario",
    description: "Define a counterfactual scenario for comparison",
    category: "branch",
    icon: "GitBranch",
    color: designTokens.accentBranch,
    inputs: [
      { id: "base_context", name: "Base Context", type: "object", required: false },
    ],
    outputs: [
      { id: "scenario_id", name: "Scenario ID", type: "string", required: true },
      { id: "scenario_name", name: "Scenario Name", type: "string", required: true },
      { id: "modified_context", name: "Modified Context", type: "object", required: true },
      { id: "modified_agents", name: "Modified Agents", type: "array", required: false },
      { id: "ready", name: "Ready", type: "boolean", required: true },
    ],
    config: {
      type: "object",
      properties: {
        scenario_name: { type: "string", title: "Scenario Name" },
        description: { type: "string", title: "Description" },
        probability: { type: "number", title: "Probability", minimum: 0, maximum: 1, default: 0.33 },
        modifications: {
          type: "object",
          title: "Modifications",
          properties: {
            context_changes: { type: "object", title: "Context Changes" },
            agent_changes: { type: "object", title: "Agent Changes" },
            environment_changes: { type: "object", title: "Environment Changes" },
          },
        },
      },
      required: ["scenario_name"],
    },
    executor: "compute",
    estimatedCost: { dollars: 0.01 },
    estimatedTime: { p50: 100, p95: 500 },
  },

  "branch.compare": {
    id: "branch.compare",
    name: "Compare Branches",
    description: "Run same simulation under multiple scenarios",
    category: "branch",
    icon: "GitCompare",
    color: designTokens.accentBranch,
    inputs: [
      { id: "scenarios", name: "Scenarios", type: "array", required: true },
      { id: "base_simulation", name: "Base Simulation", type: "object", required: true },
    ],
    outputs: [
      { id: "results_by_scenario", name: "Results by Scenario", type: "object", required: true },
      { id: "comparison", name: "Comparison", type: "object", required: true },
    ],
    config: {
      type: "object",
      properties: {
        metrics: { type: "array", title: "Metrics", items: { type: "string" }, default: ["conversion_rate", "expected_value"] },
        calculate_lift: { type: "boolean", title: "Calculate Lift", default: true },
        parallel: { type: "boolean", title: "Run in Parallel", default: true },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 0.10 },
    estimatedTime: { p50: 5000, p95: 20000 },
  },

  "branch.merge": {
    id: "branch.merge",
    name: "Merge Branches",
    description: "Combine branch results into a single weighted prediction",
    category: "branch",
    icon: "GitMerge",
    color: designTokens.accentBranch,
    inputs: [
      { id: "branches", name: "Branches", type: "array", required: true },
    ],
    outputs: [
      { id: "merged_result", name: "Merged Result", type: "object", required: true },
      { id: "uncertainty", name: "Uncertainty", type: "object", required: true },
    ],
    config: {
      type: "object",
      properties: {
        merge_strategy: { type: "string", title: "Merge Strategy", enum: ["weighted_average", "expected_value", "worst_case", "best_case"], default: "weighted_average" },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 0.01 },
    estimatedTime: { p50: 200, p95: 1000 },
  },

  // ========== ANALYZE PRIMITIVES (3) ==========

  "analyze.factors": {
    id: "analyze.factors",
    name: "Factor Analysis",
    description: "Identify what drove a prediction",
    category: "analyze",
    icon: "TrendingUp",
    color: designTokens.accentAnalyze,
    inputs: [
      { id: "simulation_result", name: "Simulation Result", type: "object", required: true },
      { id: "agent_results", name: "Agent Results", type: "array", required: true },
    ],
    outputs: [
      { id: "feature_importance", name: "Feature Importance", type: "array", required: true },
      { id: "reasoning_themes", name: "Reasoning Themes", type: "array", required: true },
      { id: "key_drivers", name: "Key Drivers", type: "array", required: true },
    ],
    config: {
      type: "object",
      properties: {
        analysis_type: { type: "string", title: "Analysis Type", enum: ["feature_importance", "reasoning_themes", "both"], default: "both" },
        top_n: { type: "number", title: "Top N Factors", default: 10, minimum: 3, maximum: 20 },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 2.00 },
    estimatedTime: { p50: 15000, p95: 45000 },
  },

  "analyze.sensitivity": {
    id: "analyze.sensitivity",
    name: "Sensitivity Analysis",
    description: "How would changes in inputs affect the output?",
    category: "analyze",
    icon: "Sliders",
    color: designTokens.accentAnalyze,
    inputs: [
      { id: "base_result", name: "Base Result", type: "object", required: true },
    ],
    outputs: [
      { id: "sensitivity_results", name: "Sensitivity Results", type: "array", required: true },
      { id: "tornado_chart_data", name: "Tornado Chart Data", type: "array", required: true },
    ],
    config: {
      type: "object",
      properties: {
        parameters_to_vary: {
          type: "array",
          title: "Parameters to Vary",
          items: {
            type: "object",
            properties: {
              parameter: { type: "string", title: "Parameter" },
              variations: { type: "array", title: "Variations", items: { type: "string" } },
            },
          },
        },
        method: { type: "string", title: "Method", enum: ["rerun", "estimate"], default: "estimate" },
        variation_range: { type: "number", title: "Variation Range %", default: 20, minimum: 5, maximum: 50 },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 5.00 },
    estimatedTime: { p50: 30000, p95: 90000 },
  },

  "analyze.uncertainty": {
    id: "analyze.uncertainty",
    name: "Uncertainty Analysis",
    description: "Quantify confidence and identify sources of uncertainty",
    category: "analyze",
    icon: "HelpCircle",
    color: designTokens.accentAnalyze,
    inputs: [
      { id: "simulation_result", name: "Simulation Result", type: "object", required: true },
      { id: "simulation_config", name: "Simulation Config", type: "object", required: true },
      { id: "agent_results", name: "Agent Results", type: "array", required: true },
    ],
    outputs: [
      { id: "overall_confidence", name: "Overall Confidence", type: "number", required: true },
      { id: "confidence_interval", name: "Confidence Interval", type: "object", required: true },
      { id: "uncertainty_sources", name: "Uncertainty Sources", type: "array", required: true },
      { id: "data_quality_assessment", name: "Data Quality", type: "object", required: true },
      { id: "recommendations", name: "Recommendations", type: "array", required: true },
    ],
    config: {
      type: "object",
      properties: {
        confidence_level: { type: "number", title: "Confidence Level", default: 0.95, minimum: 0.8, maximum: 0.99 },
        include_recommendations: { type: "boolean", title: "Include Recommendations", default: true },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 3.00 },
    estimatedTime: { p50: 20000, p95: 60000 },
  },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getSpecPrimitivesByCategory(): Record<PrimitiveCategory, Primitive[]> {
  const result: Record<PrimitiveCategory, Primitive[]> = {
    agent: [],
    population: [],
    orchestrate: [],
    aggregate: [],
    branch: [],
    analyze: [],
  };

  Object.values(specPrimitives).forEach((primitive) => {
    const category = primitive.category as PrimitiveCategory;
    if (result[category]) {
      result[category].push(primitive);
    }
  });

  return result;
}

export function getSpecPrimitive(id: string): Primitive | undefined {
  return specPrimitives[id];
}

export function getCategoryForPrimitive(primitiveId: string): CategoryDefinition | undefined {
  const primitive = specPrimitives[primitiveId];
  if (!primitive) return undefined;
  return categories[primitive.category as PrimitiveCategory];
}

export const categoryOrder: PrimitiveCategory[] = [
  "agent",
  "population",
  "orchestrate",
  "aggregate",
  "branch",
  "analyze",
];

// Primitive selection guide from spec
export const primitiveSelectionGuide: Record<string, { primary: string; supporting: string[] }> = {
  "would_customers_buy": { primary: "orchestrate.monte_carlo", supporting: ["population.sample", "aggregate.distribution", "analyze.factors"] },
  "what_if_we_do": { primary: "branch.compare", supporting: ["orchestrate.monte_carlo", "branch.scenario", "branch.merge"] },
  "how_will_competitor_respond": { primary: "orchestrate.game_theory", supporting: ["agent.create", "analyze.sensitivity"] },
  "how_does_opinion_spread": { primary: "orchestrate.abm", supporting: ["population.sample"] },
  "why_did_we_predict": { primary: "analyze.factors", supporting: ["analyze.uncertainty"] },
  "which_segment_responds_best": { primary: "population.segment", supporting: [] },
  "talk_to_customer": { primary: "agent.converse", supporting: [] },
};
