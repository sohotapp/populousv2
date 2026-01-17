/**
 * RLTX Playbook Patterns & Presets
 *
 * This file contains:
 * 1. Canonical Playbook Patterns (6 from spec) - Complete workflow templates
 * 2. Primitive Presets - Pre-configured settings for individual primitives
 *
 * These patterns are used by the composition system to build workflows.
 */

import type { Node, Edge } from "@xyflow/react";

// ============================================================
// TYPES
// ============================================================

export interface PlaybookPattern {
  id: string;
  name: string;
  description: string;
  questionTypes: string[];
  keywords: string[];
  structure: {
    nodes: PlaybookNode[];
    edges: PlaybookEdge[];
  };
  executionPlan: {
    estimatedAgents: number;
    estimatedLLMCalls: number;
    parallelizable: boolean;
    estimatedTimeSeconds: number;
    estimatedCostUSD: number;
  };
  requiredInputs: string[];
  defaultValues: Record<string, unknown>;
  warnings: string[];
}

export interface PlaybookNode {
  id: string;
  primitive: string;
  name: string;
  config: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface PlaybookEdge {
  from: string;
  to: string;
  outputMapping?: Record<string, string>;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  estimatedCost?: string;
  estimatedTime?: string;
  tags?: string[];
}

// ============================================================
// CANONICAL PLAYBOOK PATTERNS (6 from spec)
// ============================================================

export const playbookPatterns: Record<string, PlaybookPattern> = {
  // ========== PATTERN 1: CONSUMER SURVEY ==========
  consumer_survey: {
    id: "consumer_survey",
    name: "Consumer Survey",
    description: "Simulates consumer response to products, pricing, or features. Use for any 'would customers buy X?' question.",
    questionTypes: ["consumer_survey"],
    keywords: ["would customers buy", "what percent would", "how do people feel", "would you recommend", "aggregate consumer opinion"],
    structure: {
      nodes: [
        {
          id: "sample",
          primitive: "population.sample",
          name: "Sample US Consumers",
          config: {
            population_spec: { base: "us_adults", size: 10000 },
            strategy: "stratified",
          },
          position: { x: 250, y: 100 },
        },
        {
          id: "simulate",
          primitive: "orchestrate.monte_carlo",
          name: "Purchase Intent Simulation",
          config: {
            question: "A company is offering a new subscription service for $15 per month. Given your needs, interests, and budget, would you subscribe?",
            context: {
              scenario: "You are considering whether to sign up for a new subscription service.",
            },
            output_format: {
              type: "categorical",
              options: ["definitely_would", "probably_would", "might_or_might_not", "probably_would_not", "definitely_would_not"],
            },
            reasoning_depth: "standard",
          },
          position: { x: 250, y: 250 },
        },
        {
          id: "segment",
          primitive: "population.segment",
          name: "Segment Analysis",
          config: {
            segment_by: ["income_bracket", "age_group"],
          },
          position: { x: 100, y: 400 },
        },
        {
          id: "factors",
          primitive: "analyze.factors",
          name: "Key Drivers Analysis",
          config: {
            analysis_type: "both",
          },
          position: { x: 400, y: 400 },
        },
      ],
      edges: [
        { from: "sample", to: "simulate" },
        { from: "simulate", to: "segment" },
        { from: "simulate", to: "factors" },
      ],
    },
    executionPlan: {
      estimatedAgents: 10000,
      estimatedLLMCalls: 10000,
      parallelizable: true,
      estimatedTimeSeconds: 120,
      estimatedCostUSD: 15.0,
    },
    requiredInputs: [],
    defaultValues: {},
    warnings: [],
  },

  // ========== PATTERN 2: CHANGE IMPACT ==========
  change_impact: {
    id: "change_impact",
    name: "Price/Feature Change Impact",
    description: "Compares outcomes before and after a change. Use for 'what if we raise/lower price?' or 'what if we add/remove feature?' questions.",
    questionTypes: ["change_impact"],
    keywords: ["what if we raise", "what if we lower", "what if we add", "what if we remove", "impact of changing", "a/b comparison"],
    structure: {
      nodes: [
        {
          id: "sample",
          primitive: "population.sample",
          name: "Sample Existing Customers",
          config: {
            population_spec: { base: "us_consumers", size: 10000 },
            strategy: "stratified",
          },
          position: { x: 250, y: 50 },
        },
        {
          id: "scenario_control",
          primitive: "branch.scenario",
          name: "Control: Current Price",
          config: {
            scenario_name: "current_price",
            description: "Status quo - no price change",
            probability: 0.0,
            modifications: {},
          },
          position: { x: 100, y: 200 },
        },
        {
          id: "scenario_increase",
          primitive: "branch.scenario",
          name: "Treatment: Price Increase",
          config: {
            scenario_name: "price_increase_20pct",
            description: "Price increases by 20%",
            probability: 1.0,
            modifications: {
              context_changes: { price_change: "+20%" },
            },
          },
          position: { x: 400, y: 200 },
        },
        {
          id: "sim_control",
          primitive: "orchestrate.monte_carlo",
          name: "Retention at Current Price",
          config: {
            question: "You are currently subscribed at ${{current_price}}/month. The price will stay the same. Will you continue your subscription?",
            output_format: { type: "binary", options: ["continue", "cancel"] },
            reasoning_depth: "standard",
          },
          position: { x: 100, y: 350 },
        },
        {
          id: "sim_increase",
          primitive: "orchestrate.monte_carlo",
          name: "Retention at New Price",
          config: {
            question: "You are currently subscribed at ${{current_price}}/month. The price will increase to ${{new_price}}/month (a 20% increase). Will you continue?",
            output_format: { type: "binary", options: ["continue", "cancel"] },
            reasoning_depth: "standard",
          },
          position: { x: 400, y: 350 },
        },
        {
          id: "compare",
          primitive: "branch.compare",
          name: "Compare Scenarios",
          config: {
            metrics: ["retention_rate", "churn_rate"],
            calculate_lift: true,
          },
          position: { x: 250, y: 500 },
        },
        {
          id: "factors",
          primitive: "analyze.factors",
          name: "Churn Drivers Analysis",
          config: {
            analysis_type: "both",
            focus_on: "cancel",
          },
          position: { x: 250, y: 650 },
        },
      ],
      edges: [
        { from: "sample", to: "scenario_control" },
        { from: "sample", to: "scenario_increase" },
        { from: "sample", to: "sim_control" },
        { from: "sample", to: "sim_increase" },
        { from: "scenario_control", to: "sim_control" },
        { from: "scenario_increase", to: "sim_increase" },
        { from: "sim_control", to: "compare" },
        { from: "sim_increase", to: "compare" },
        { from: "compare", to: "factors" },
      ],
    },
    executionPlan: {
      estimatedAgents: 20000,
      estimatedLLMCalls: 20000,
      parallelizable: true,
      estimatedTimeSeconds: 180,
      estimatedCostUSD: 30.0,
    },
    requiredInputs: ["current_price"],
    defaultValues: { current_price: 39.99 },
    warnings: ["Consider also modeling competitive response scenarios"],
  },

  // ========== PATTERN 3: COMPETITIVE RESPONSE ==========
  competitive_response: {
    id: "competitive_response",
    name: "Competitive Response",
    description: "Models competitor behavior and resulting consumer impact. Use for 'what will competitor do if we X?' questions.",
    questionTypes: ["competitive_response"],
    keywords: ["competitor", "competition", "rival", "market response", "how will they respond"],
    structure: {
      nodes: [
        {
          id: "create_us",
          primitive: "agent.create",
          name: "Create Our Company",
          config: {
            name: "Our Company",
            traits: { role: "market_leader", market_share: 0.55 },
            objectives: ["Increase revenue per customer", "Maintain market share above 50%"],
            information: "Implementing 20% price increase next quarter",
          },
          position: { x: 100, y: 50 },
        },
        {
          id: "create_competitor",
          primitive: "agent.create",
          name: "Create Competitor",
          config: {
            name: "Main Competitor",
            traits: { role: "challenger", market_share: 0.30 },
            objectives: ["Grow market share to 40%", "Establish as viable alternative"],
            information: "Aware that market leader is raising prices 20%",
          },
          position: { x: 400, y: 50 },
        },
        {
          id: "game",
          primitive: "orchestrate.game_theory",
          name: "Competitive Dynamics",
          config: {
            game_type: "sequential",
            move_order: ["Our Company", "Main Competitor"],
            max_iterations: 3,
            convergence_threshold: 0.1,
          },
          position: { x: 250, y: 200 },
        },
        {
          id: "sample_consumers",
          primitive: "population.sample",
          name: "Sample Consumers",
          config: {
            population_spec: { base: "us_consumers", size: 10000 },
            strategy: "stratified",
          },
          position: { x: 600, y: 200 },
        },
        {
          id: "scenario_match",
          primitive: "branch.scenario",
          name: "Competitor Matches Price",
          config: {
            scenario_name: "competitor_matches",
            description: "Competitor also raises prices by ~20%",
            probability: 0.35,
          },
          position: { x: 100, y: 350 },
        },
        {
          id: "scenario_hold",
          primitive: "branch.scenario",
          name: "Competitor Holds Price",
          config: {
            scenario_name: "competitor_holds",
            description: "Competitor maintains current pricing",
            probability: 0.4,
          },
          position: { x: 300, y: 350 },
        },
        {
          id: "scenario_undercut",
          primitive: "branch.scenario",
          name: "Competitor Undercuts",
          config: {
            scenario_name: "competitor_undercuts",
            description: "Competitor lowers prices to steal share",
            probability: 0.25,
          },
          position: { x: 500, y: 350 },
        },
        {
          id: "sim_match",
          primitive: "orchestrate.monte_carlo",
          name: "Consumer Response - Match",
          config: {
            question: "Your provider is raising prices 20%. Competitor is also raising prices similarly. Would you stay, switch, or cancel?",
            output_format: { type: "categorical", options: ["stay_with_a", "switch_to_b", "cancel_both"] },
          },
          position: { x: 100, y: 500 },
        },
        {
          id: "sim_hold",
          primitive: "orchestrate.monte_carlo",
          name: "Consumer Response - Hold",
          config: {
            question: "Your provider is raising prices 20%. Competitor is keeping prices the same. Would you stay, switch, or cancel?",
            output_format: { type: "categorical", options: ["stay_with_a", "switch_to_b", "cancel_both"] },
          },
          position: { x: 300, y: 500 },
        },
        {
          id: "sim_undercut",
          primitive: "orchestrate.monte_carlo",
          name: "Consumer Response - Undercut",
          config: {
            question: "Your provider is raising prices 20%. Competitor is lowering prices 10%. Would you stay, switch, or cancel?",
            output_format: { type: "categorical", options: ["stay_with_a", "switch_to_b", "cancel_both"] },
          },
          position: { x: 500, y: 500 },
        },
        {
          id: "merge",
          primitive: "branch.merge",
          name: "Merge Scenario Results",
          config: { merge_strategy: "weighted_average" },
          position: { x: 300, y: 650 },
        },
        {
          id: "factors",
          primitive: "analyze.factors",
          name: "Key Drivers Analysis",
          config: { analysis_type: "both" },
          position: { x: 300, y: 800 },
        },
      ],
      edges: [
        { from: "create_us", to: "game" },
        { from: "create_competitor", to: "game" },
        { from: "game", to: "scenario_match" },
        { from: "game", to: "scenario_hold" },
        { from: "game", to: "scenario_undercut" },
        { from: "sample_consumers", to: "sim_match" },
        { from: "sample_consumers", to: "sim_hold" },
        { from: "sample_consumers", to: "sim_undercut" },
        { from: "scenario_match", to: "sim_match" },
        { from: "scenario_hold", to: "sim_hold" },
        { from: "scenario_undercut", to: "sim_undercut" },
        { from: "sim_match", to: "merge" },
        { from: "sim_hold", to: "merge" },
        { from: "sim_undercut", to: "merge" },
        { from: "merge", to: "factors" },
      ],
    },
    executionPlan: {
      estimatedAgents: 30000,
      estimatedLLMCalls: 30010,
      parallelizable: true,
      estimatedTimeSeconds: 240,
      estimatedCostUSD: 50.0,
    },
    requiredInputs: ["current_price", "competitor_current_price"],
    defaultValues: { current_price: 49.99, competitor_current_price: 44.99 },
    warnings: ["Game theory probabilities will override scenario probabilities"],
  },

  // ========== PATTERN 4: WARGAME / ADVERSARIAL ==========
  wargame: {
    id: "wargame",
    name: "Wargame / Adversarial",
    description: "Models strategic interactions between multiple actors. Use for defense, geopolitical, and adversarial scenarios.",
    questionTypes: ["wargame"],
    keywords: ["adversary", "country", "military", "escalation", "geopolitical", "sanction", "strategic response"],
    structure: {
      nodes: [
        {
          id: "create_blue",
          primitive: "agent.create",
          name: "Create Blue/US",
          config: {
            name: "United States",
            traits: { role: "status_quo_power", alliance_network: "extensive" },
            objectives: ["Maintain technological superiority", "Avoid direct conflict"],
            constraints: ["Economic interdependence", "Alliance partner concerns"],
          },
          position: { x: 100, y: 50 },
        },
        {
          id: "create_red",
          primitive: "agent.create",
          name: "Create Red/Adversary",
          config: {
            name: "Adversary",
            traits: { role: "revisionist_power", military_modernization: "rapid" },
            objectives: ["Reduce technological dependence", "Maintain economic growth"],
            constraints: ["Economic interdependence", "International reputation"],
          },
          position: { x: 300, y: 50 },
        },
        {
          id: "create_gray",
          primitive: "agent.create",
          name: "Create Gray/Neutral",
          config: {
            name: "Third Party",
            traits: { role: "contested_territory", economic_importance: "critical" },
            objectives: ["Maintain de facto independence", "Avoid conflict"],
          },
          position: { x: 500, y: 50 },
        },
        {
          id: "game",
          primitive: "orchestrate.game_theory",
          name: "Strategic Interaction",
          config: {
            game_type: "sequential",
            max_iterations: 5,
            convergence_threshold: 0.2,
          },
          position: { x: 300, y: 250 },
        },
        {
          id: "sensitivity",
          primitive: "analyze.sensitivity",
          name: "Sensitivity Analysis",
          config: {
            parameters_to_vary: [
              { parameter: "restriction_scope", variations: ["narrow", "moderate", "comprehensive"] },
            ],
            method: "estimate",
          },
          position: { x: 100, y: 450 },
        },
        {
          id: "uncertainty",
          primitive: "analyze.uncertainty",
          name: "Uncertainty Analysis",
          config: {},
          position: { x: 300, y: 450 },
        },
        {
          id: "factors",
          primitive: "analyze.factors",
          name: "Key Factors",
          config: { analysis_type: "both" },
          position: { x: 500, y: 450 },
        },
      ],
      edges: [
        { from: "create_blue", to: "game" },
        { from: "create_red", to: "game" },
        { from: "create_gray", to: "game" },
        { from: "game", to: "sensitivity" },
        { from: "game", to: "uncertainty" },
        { from: "game", to: "factors" },
      ],
    },
    executionPlan: {
      estimatedAgents: 3,
      estimatedLLMCalls: 50,
      parallelizable: false,
      estimatedTimeSeconds: 300,
      estimatedCostUSD: 25.0,
    },
    requiredInputs: ["restriction_scope"],
    defaultValues: { restriction_scope: "moderate" },
    warnings: [
      "Wargame results are highly sensitive to actor objective specifications",
      "Consider running multiple iterations with varied assumptions",
    ],
  },

  // ========== PATTERN 5: OPINION/INFORMATION SPREAD ==========
  dynamics: {
    id: "dynamics",
    name: "Opinion/Information Spread",
    description: "Models how information, opinions, or adoption spreads over time. Use for viral spread, adoption curves, and sentiment evolution.",
    questionTypes: ["dynamics"],
    keywords: ["spread", "viral", "adoption", "over time", "evolve", "dynamic", "diffusion"],
    structure: {
      nodes: [
        {
          id: "sample",
          primitive: "population.sample",
          name: "Sample Population with Network",
          config: {
            population_spec: { base: "us_adults", size: 5000 },
            strategy: "stratified",
          },
          position: { x: 250, y: 50 },
        },
        {
          id: "abm",
          primitive: "orchestrate.abm",
          name: "Spread Simulation",
          config: {
            environment: {
              initial_state: { news_content: "Product news", news_severity: "moderate" },
              network: { type: "small_world" },
              globals: { media_amplification: 0.3, time_decay: 0.1 },
            },
            agent_step: {
              perception: { sees_neighbors: true, sees_globals: true, perception_radius: 2 },
              decision_question: "Some connections are sharing news. Based on your relationship with the brand, will you share, engage but not share, or ignore?",
              action_effects: { type: "broadcast", description: "If share, news reaches all connections" },
            },
            timesteps: 20,
            stop_conditions: [{ condition: "saturation", threshold: 0.8 }],
            agent_activation: "random_subset",
            activation_rate: 0.3,
          },
          position: { x: 250, y: 250 },
        },
        {
          id: "factors",
          primitive: "analyze.factors",
          name: "Spread Drivers Analysis",
          config: { analysis_type: "both" },
          position: { x: 250, y: 450 },
        },
      ],
      edges: [
        { from: "sample", to: "abm" },
        { from: "abm", to: "factors" },
      ],
    },
    executionPlan: {
      estimatedAgents: 5000,
      estimatedLLMCalls: 30000,
      parallelizable: true,
      estimatedTimeSeconds: 600,
      estimatedCostUSD: 45.0,
    },
    requiredInputs: ["news_content", "seed_size"],
    defaultValues: { seed_size: 50 },
    warnings: ["ABM results are sensitive to network structure", "Consider running multiple seeds for robustness"],
  },

  // ========== PATTERN 6: MULTI-SCENARIO COMPARISON ==========
  counterfactual: {
    id: "counterfactual",
    name: "Multi-Scenario Comparison",
    description: "Compares multiple options or scenarios side by side. Use for 'compare A vs B vs C' or 'what's the best approach?' questions.",
    questionTypes: ["counterfactual"],
    keywords: ["compare", "vs", "versus", "or", "option", "best", "which one"],
    structure: {
      nodes: [
        {
          id: "sample",
          primitive: "population.sample",
          name: "Sample Consumers",
          config: {
            population_spec: { base: "us_adults", size: 10000 },
            strategy: "stratified",
          },
          position: { x: 300, y: 50 },
        },
        {
          id: "scenario_low",
          primitive: "branch.scenario",
          name: "Option A",
          config: {
            scenario_name: "option_a",
            description: "First option",
            probability: 0.33,
          },
          position: { x: 100, y: 200 },
        },
        {
          id: "scenario_mid",
          primitive: "branch.scenario",
          name: "Option B",
          config: {
            scenario_name: "option_b",
            description: "Second option",
            probability: 0.34,
          },
          position: { x: 300, y: 200 },
        },
        {
          id: "scenario_high",
          primitive: "branch.scenario",
          name: "Option C",
          config: {
            scenario_name: "option_c",
            description: "Third option",
            probability: 0.33,
          },
          position: { x: 500, y: 200 },
        },
        {
          id: "sim_low",
          primitive: "orchestrate.monte_carlo",
          name: "Response to A",
          config: {
            question: "Given option A, would you subscribe?",
            output_format: { type: "categorical", options: ["definitely_yes", "probably_yes", "maybe", "probably_no", "definitely_no"] },
          },
          position: { x: 100, y: 350 },
        },
        {
          id: "sim_mid",
          primitive: "orchestrate.monte_carlo",
          name: "Response to B",
          config: {
            question: "Given option B, would you subscribe?",
            output_format: { type: "categorical", options: ["definitely_yes", "probably_yes", "maybe", "probably_no", "definitely_no"] },
          },
          position: { x: 300, y: 350 },
        },
        {
          id: "sim_high",
          primitive: "orchestrate.monte_carlo",
          name: "Response to C",
          config: {
            question: "Given option C, would you subscribe?",
            output_format: { type: "categorical", options: ["definitely_yes", "probably_yes", "maybe", "probably_no", "definitely_no"] },
          },
          position: { x: 500, y: 350 },
        },
        {
          id: "compare",
          primitive: "branch.compare",
          name: "Compare Options",
          config: {
            metrics: ["conversion_rate", "revenue_per_100_prospects", "definitely_yes_rate"],
            calculate_lift: true,
          },
          position: { x: 300, y: 500 },
        },
        {
          id: "factors",
          primitive: "analyze.factors",
          name: "Decision Drivers",
          config: { analysis_type: "both" },
          position: { x: 300, y: 650 },
        },
      ],
      edges: [
        { from: "sample", to: "scenario_low" },
        { from: "sample", to: "scenario_mid" },
        { from: "sample", to: "scenario_high" },
        { from: "scenario_low", to: "sim_low" },
        { from: "scenario_mid", to: "sim_mid" },
        { from: "scenario_high", to: "sim_high" },
        { from: "sample", to: "sim_low" },
        { from: "sample", to: "sim_mid" },
        { from: "sample", to: "sim_high" },
        { from: "sim_low", to: "compare" },
        { from: "sim_mid", to: "compare" },
        { from: "sim_high", to: "compare" },
        { from: "compare", to: "factors" },
      ],
    },
    executionPlan: {
      estimatedAgents: 30000,
      estimatedLLMCalls: 30000,
      parallelizable: true,
      estimatedTimeSeconds: 200,
      estimatedCostUSD: 45.0,
    },
    requiredInputs: [],
    defaultValues: {},
    warnings: [],
  },

  // ========== PATTERN 7: CONGRESSIONAL VOTE ==========
  congressional_vote: {
    id: "congressional_vote",
    name: "Congressional Vote Simulation",
    description: "Simulates how US Congress would vote on legislation. Uses senator personas with voting records and SSR calibration for realistic vote predictions.",
    questionTypes: ["congressional_vote", "political"],
    keywords: ["congress", "senate", "vote", "legislation", "bill", "tiktok", "ban", "law", "house", "representative", "senator"],
    structure: {
      nodes: [
        {
          id: "scenario",
          primitive: "branch.scenario",
          name: "Define Legislation",
          config: {
            scenario_name: "tiktok_ban",
            description: "TikTok divestiture bill before the Senate",
          },
          position: { x: 250, y: 50 },
        },
        {
          id: "vote_simulation",
          primitive: "orchestrate.congressional_vote",
          name: "Senate Vote Simulation",
          config: {
            sampleSize: 100,
            scenario: "tiktok_ban",
            withChinaRetaliation: false,
          },
          position: { x: 250, y: 200 },
        },
        {
          id: "segment",
          primitive: "population.segment",
          name: "Party Analysis",
          config: {
            segment_by: ["party", "state", "ideology"],
          },
          position: { x: 100, y: 350 },
        },
        {
          id: "factors",
          primitive: "analyze.factors",
          name: "Vote Driver Analysis",
          config: {
            analysis_type: "both",
          },
          position: { x: 400, y: 350 },
        },
      ],
      edges: [
        { from: "scenario", to: "vote_simulation" },
        { from: "vote_simulation", to: "segment" },
        { from: "vote_simulation", to: "factors" },
      ],
    },
    executionPlan: {
      estimatedAgents: 100,
      estimatedLLMCalls: 100,
      parallelizable: true,
      estimatedTimeSeconds: 60,
      estimatedCostUSD: 3.0,
    },
    requiredInputs: [],
    defaultValues: {
      scenario: "tiktok_ban",
      withChinaRetaliation: false,
    },
    warnings: [
      "Vote predictions are calibrated using SSR but actual outcomes depend on many factors",
      "Senator personas are based on voting records and may not capture recent position changes",
    ],
  },

  // ========== PATTERN 8: CONVERSATIONAL ==========
  conversational: {
    id: "conversational",
    name: "Getting Started",
    description: "Help users understand what RLTX can do and guide them to useful simulations.",
    questionTypes: ["help", "greeting"],
    keywords: ["help", "hello", "hey", "what can you do", "how does this work"],
    structure: {
      nodes: [], // No nodes for conversational pattern
      edges: [],
    },
    executionPlan: {
      estimatedAgents: 0,
      estimatedLLMCalls: 0,
      parallelizable: false,
      estimatedTimeSeconds: 0,
      estimatedCostUSD: 0,
    },
    requiredInputs: [],
    defaultValues: {},
    warnings: [],
  },
};

// ============================================================
// PATTERN SELECTION LOGIC (from spec)
// ============================================================

export type PatternType =
  | "consumer_survey"
  | "change_impact"
  | "competitive_response"
  | "wargame"
  | "dynamics"
  | "counterfactual"
  | "congressional_vote"
  | "conversational";

export function selectPattern(question: string): PatternType {
  const q = question.toLowerCase();

  // Handle conversational/help queries first
  // These should return a helpful message, not a default workflow
  if (
    q.includes("help") ||
    q.includes("what can you do") ||
    q.includes("what do you do") ||
    (q.includes("can you") && !q.includes("customer") && !q.includes("consumer")) ||
    (q.includes("do something") && !q.includes("would")) ||
    q.includes("hello") ||
    q.includes("hey") ||
    q.includes("hi ") ||
    q === "hi" ||
    q.length < 10 // Very short queries are likely greetings
  ) {
    return "conversational";
  }

  // Check for congressional/political vote keywords
  if (
    q.includes("congress") ||
    q.includes("senate") ||
    q.includes("senator") ||
    q.includes("house vote") ||
    q.includes("legislation") ||
    q.includes("tiktok ban") ||
    (q.includes("vote") && (q.includes("bill") || q.includes("law")))
  ) {
    return "congressional_vote";
  }

  // Check for competitive keywords
  if (
    q.includes("competitor") ||
    q.includes("competition") ||
    q.includes("rival") ||
    q.includes("market response")
  ) {
    return "competitive_response";
  }

  // Check for wargame keywords
  if (
    q.includes("adversary") ||
    q.includes("country") ||
    q.includes("military") ||
    q.includes("escalat") ||
    q.includes("geopolit") ||
    q.includes("sanction")
  ) {
    return "wargame";
  }

  // Check for dynamics keywords
  if (
    q.includes("spread") ||
    q.includes("viral") ||
    q.includes("adoption") ||
    q.includes("over time") ||
    q.includes("evolve") ||
    q.includes("dynamic")
  ) {
    return "dynamics";
  }

  // Check for comparison keywords
  if (
    q.includes("compare") ||
    q.includes("vs") ||
    q.includes("versus") ||
    q.includes("or") ||
    (q.includes("option") && q.includes("best"))
  ) {
    return "counterfactual";
  }

  // Check for change impact keywords
  if (
    q.includes("what if") ||
    q.includes("what happens") ||
    q.includes("impact of") ||
    q.includes("effect of") ||
    q.includes("change") ||
    q.includes("increase") ||
    q.includes("decrease")
  ) {
    return "change_impact";
  }

  // Default to consumer survey
  return "consumer_survey";
}

// ============================================================
// COMPOSITION VALIDATION (from spec)
// ============================================================

export const requiredPrimitivesByPattern: Record<PatternType, string[]> = {
  consumer_survey: ["population.sample", "orchestrate.monte_carlo", "analyze.factors"],
  change_impact: ["population.sample", "branch.scenario", "orchestrate.monte_carlo", "branch.compare"],
  competitive_response: ["agent.create", "orchestrate.game_theory", "population.sample", "orchestrate.monte_carlo"],
  wargame: ["agent.create", "orchestrate.game_theory"],
  dynamics: ["population.sample", "orchestrate.abm"],
  counterfactual: ["population.sample", "branch.scenario", "orchestrate.monte_carlo", "branch.compare"],
  congressional_vote: ["orchestrate.congressional_vote", "analyze.factors"],
  conversational: [], // No required primitives for conversational pattern
};

// ============================================================
// PRIMITIVE PRESETS (for individual nodes)
// ============================================================

export const PRIMITIVE_PRESETS: Record<string, Preset[]> = {
  // Population presets
  "population.sample": [
    {
      id: "quick-us-sample",
      name: "Quick US Sample",
      description: "Fast 1000 agent sample for initial testing",
      config: {
        population_spec: { base: "us_adults", size: 1000 },
        strategy: "stratified",
      },
      estimatedCost: "$0.05",
      estimatedTime: "5 seconds",
      tags: ["quick", "testing"],
    },
    {
      id: "high-confidence-sample",
      name: "High Confidence Sample",
      description: "10,000 agent sample for statistically significant results",
      config: {
        population_spec: { base: "us_adults", size: 10000 },
        strategy: "stratified",
      },
      estimatedCost: "$0.50",
      estimatedTime: "30 seconds",
      tags: ["research", "statistical"],
    },
    {
      id: "enterprise-sample",
      name: "Enterprise Decision Makers",
      description: "B2B decision maker population",
      config: {
        population_spec: { base: "enterprise_decision_makers", size: 2000 },
        strategy: "stratified",
      },
      estimatedCost: "$0.20",
      estimatedTime: "15 seconds",
      tags: ["b2b", "enterprise"],
    },
  ],

  // Monte Carlo presets
  "orchestrate.monte_carlo": [
    {
      id: "binary-quick",
      name: "Quick Binary Survey",
      description: "Yes/No question for fast validation",
      config: {
        output_format: { type: "binary", options: ["yes", "no"] },
        reasoning_depth: "shallow",
        use_archetypes: true,
      },
      estimatedCost: "$5.00",
      estimatedTime: "1 minute",
      tags: ["quick", "validation"],
    },
    {
      id: "likert-standard",
      name: "Standard Likert",
      description: "5-point scale for nuanced responses",
      config: {
        output_format: { type: "likert", scale: 5 },
        reasoning_depth: "standard",
        use_archetypes: true,
      },
      estimatedCost: "$15.00",
      estimatedTime: "3 minutes",
      tags: ["research", "detailed"],
    },
  ],

  // Game theory presets
  "orchestrate.game_theory": [
    {
      id: "two-player-quick",
      name: "Two-Player Quick",
      description: "Fast equilibrium for two competitors",
      config: {
        game_type: "sequential",
        max_iterations: 3,
        convergence_threshold: 0.1,
      },
      estimatedCost: "$5.00",
      estimatedTime: "1 minute",
      tags: ["quick", "competitive"],
    },
    {
      id: "multi-actor-detailed",
      name: "Multi-Actor Detailed",
      description: "Complex multi-party strategic analysis",
      config: {
        game_type: "sequential",
        max_iterations: 8,
        convergence_threshold: 0.05,
      },
      estimatedCost: "$25.00",
      estimatedTime: "5 minutes",
      tags: ["detailed", "complex"],
    },
  ],

  // ABM presets
  "orchestrate.abm": [
    {
      id: "viral-spread-quick",
      name: "Quick Viral Spread",
      description: "Fast adoption/spread simulation",
      config: {
        timesteps: 10,
        agent_activation: "random_subset",
        activation_rate: 0.5,
      },
      estimatedCost: "$20.00",
      estimatedTime: "3 minutes",
      tags: ["quick", "spread"],
    },
    {
      id: "detailed-diffusion",
      name: "Detailed Diffusion",
      description: "Full diffusion model with network effects",
      config: {
        timesteps: 52,
        agent_activation: "random_subset",
        activation_rate: 0.3,
      },
      estimatedCost: "$45.00",
      estimatedTime: "10 minutes",
      tags: ["detailed", "research"],
    },
  ],

  // Analyze presets
  "analyze.factors": [
    {
      id: "quick-drivers",
      name: "Quick Key Drivers",
      description: "Top 5 factors driving the outcome",
      config: {
        analysis_type: "feature_importance",
        top_n: 5,
      },
      estimatedCost: "$1.00",
      estimatedTime: "30 seconds",
      tags: ["quick"],
    },
    {
      id: "comprehensive-analysis",
      name: "Comprehensive Analysis",
      description: "Full feature importance + reasoning themes",
      config: {
        analysis_type: "both",
        top_n: 10,
      },
      estimatedCost: "$2.00",
      estimatedTime: "1 minute",
      tags: ["detailed", "comprehensive"],
    },
  ],
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getPlaybookPattern(id: string): PlaybookPattern | undefined {
  return playbookPatterns[id];
}

export function getAllPlaybookPatterns(): PlaybookPattern[] {
  return Object.values(playbookPatterns);
}

export function getPresetsForPrimitive(primitiveId: string): Preset[] {
  return PRIMITIVE_PRESETS[primitiveId] || [];
}

export function applyPreset(
  currentConfig: Record<string, unknown>,
  preset: Preset
): Record<string, unknown> {
  return { ...currentConfig, ...preset.config };
}

export function findPreset(primitiveId: string, presetId: string): Preset | undefined {
  const presets = PRIMITIVE_PRESETS[primitiveId];
  return presets?.find((p) => p.id === presetId);
}

// Convert playbook pattern to ReactFlow nodes/edges
export function playbookToReactFlow(pattern: PlaybookPattern): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = pattern.structure.nodes.map((node) => ({
    id: node.id,
    type: "primitive",
    position: node.position || { x: 0, y: 0 },
    data: {
      primitive: node.primitive,
      name: node.name,
      config: node.config,
    },
  }));

  const edges: Edge[] = pattern.structure.edges.map((edge, index) => ({
    id: `e-${edge.from}-${edge.to}-${index}`,
    source: edge.from,
    target: edge.to,
    type: "default",
  }));

  return { nodes, edges };
}
