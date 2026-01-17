// Model Router
// Selects appropriate model (Haiku/Sonnet/Opus) based on task complexity and agent tier

import { CompiledPrompt } from "./prompt-compiler";
import { type Agent, type AgentTier } from "./agent-store";

export type ModelTier = "haiku" | "sonnet" | "opus";

export interface ModelConfig {
  tier: ModelTier;
  modelId: string;
  maxConcurrency: number;
  costPer1kInputTokens: number;
  costPer1kOutputTokens: number;
  avgResponseTimeMs: number;
  maxOutputTokens: number;
}

// Model configurations
export const MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
  haiku: {
    tier: "haiku",
    modelId: "claude-3-5-haiku-20241022",
    maxConcurrency: 100,
    costPer1kInputTokens: 0.0008,
    costPer1kOutputTokens: 0.004,
    avgResponseTimeMs: 500,
    maxOutputTokens: 1024,
  },
  sonnet: {
    tier: "sonnet",
    modelId: "claude-sonnet-4-20250514",
    maxConcurrency: 50,
    costPer1kInputTokens: 0.003,
    costPer1kOutputTokens: 0.015,
    avgResponseTimeMs: 1500,
    maxOutputTokens: 2048,
  },
  opus: {
    tier: "opus",
    modelId: "claude-opus-4-20250514",
    maxConcurrency: 10,
    costPer1kInputTokens: 0.015,
    costPer1kOutputTokens: 0.075,
    avgResponseTimeMs: 5000,
    maxOutputTokens: 4096,
  },
};

export interface RoutingOptions {
  // Force a specific model tier
  forceTier?: ModelTier;
  // Budget constraint (max cost per call)
  maxCostPerCall?: number;
  // Latency constraint (max ms per call)
  maxLatencyMs?: number;
  // Quality requirement (0-1, higher = better model)
  qualityRequirement?: number;
  // Domain context
  domain?: "enterprise" | "defense" | "consumer";
  // Is this a strategic reasoning task (game theory)?
  isStrategic?: boolean;
}

export interface RoutingResult {
  tier: ModelTier;
  config: ModelConfig;
  reason: string;
  estimatedCost: number;
  estimatedLatencyMs: number;
}

// Estimate token count from prompt (rough approximation)
function estimateTokens(prompt: CompiledPrompt): { input: number; output: number } {
  const totalChars = prompt.systemPrompt.length + prompt.userPrompt.length;
  // Rough estimate: ~4 chars per token
  const inputTokens = Math.ceil(totalChars / 4);
  // Output is typically 50-200 tokens for agent responses
  const outputTokens = 150;

  return { input: inputTokens, output: outputTokens };
}

// Calculate estimated cost for a model
function calculateCost(
  config: ModelConfig,
  tokens: { input: number; output: number }
): number {
  return (
    (tokens.input / 1000) * config.costPer1kInputTokens +
    (tokens.output / 1000) * config.costPer1kOutputTokens
  );
}

// Route a single prompt to appropriate model
export function routePrompt(
  prompt: CompiledPrompt,
  options: RoutingOptions = {}
): RoutingResult {
  // If forced, use that tier
  if (options.forceTier) {
    const config = MODEL_CONFIGS[options.forceTier];
    const tokens = estimateTokens(prompt);
    return {
      tier: options.forceTier,
      config,
      reason: "Forced tier selection",
      estimatedCost: calculateCost(config, tokens),
      estimatedLatencyMs: config.avgResponseTimeMs,
    };
  }

  const tokens = estimateTokens(prompt);

  // Strategic tasks always use Opus
  if (options.isStrategic) {
    const config = MODEL_CONFIGS.opus;
    return {
      tier: "opus",
      config,
      reason: "Strategic reasoning requires Opus",
      estimatedCost: calculateCost(config, tokens),
      estimatedLatencyMs: config.avgResponseTimeMs,
    };
  }

  // Defense domain defaults to Sonnet minimum
  if (options.domain === "defense" && prompt.complexity < 0.3) {
    const config = MODEL_CONFIGS.sonnet;
    return {
      tier: "sonnet",
      config,
      reason: "Defense domain requires minimum Sonnet",
      estimatedCost: calculateCost(config, tokens),
      estimatedLatencyMs: config.avgResponseTimeMs,
    };
  }

  // Route based on complexity score
  let selectedTier: ModelTier;
  let reason: string;

  if (prompt.complexity < 0.25) {
    selectedTier = "haiku";
    reason = "Simple binary/scale question - Haiku sufficient";
  } else if (prompt.complexity < 0.55) {
    selectedTier = "sonnet";
    reason = "Moderate complexity - Sonnet for balanced quality/cost";
  } else {
    selectedTier = "opus";
    reason = "High complexity - Opus for best quality";
  }

  // Check budget constraint
  if (options.maxCostPerCall !== undefined) {
    const config = MODEL_CONFIGS[selectedTier];
    const cost = calculateCost(config, tokens);

    if (cost > options.maxCostPerCall) {
      // Try to downgrade
      if (selectedTier === "opus") {
        const sonnetCost = calculateCost(MODEL_CONFIGS.sonnet, tokens);
        if (sonnetCost <= options.maxCostPerCall) {
          selectedTier = "sonnet";
          reason = "Downgraded to Sonnet due to budget constraint";
        } else {
          selectedTier = "haiku";
          reason = "Downgraded to Haiku due to budget constraint";
        }
      } else if (selectedTier === "sonnet") {
        selectedTier = "haiku";
        reason = "Downgraded to Haiku due to budget constraint";
      }
    }
  }

  // Check latency constraint
  if (options.maxLatencyMs !== undefined) {
    const config = MODEL_CONFIGS[selectedTier];
    if (config.avgResponseTimeMs > options.maxLatencyMs) {
      if (selectedTier === "opus") {
        if (MODEL_CONFIGS.sonnet.avgResponseTimeMs <= options.maxLatencyMs) {
          selectedTier = "sonnet";
          reason = "Downgraded to Sonnet due to latency constraint";
        } else {
          selectedTier = "haiku";
          reason = "Downgraded to Haiku due to latency constraint";
        }
      } else if (selectedTier === "sonnet") {
        selectedTier = "haiku";
        reason = "Downgraded to Haiku due to latency constraint";
      }
    }
  }

  // Check quality requirement (can upgrade)
  if (options.qualityRequirement !== undefined && options.qualityRequirement > 0.7) {
    if (selectedTier === "haiku") {
      selectedTier = "sonnet";
      reason = "Upgraded to Sonnet due to quality requirement";
    } else if (selectedTier === "sonnet" && options.qualityRequirement > 0.9) {
      selectedTier = "opus";
      reason = "Upgraded to Opus due to high quality requirement";
    }
  }

  const config = MODEL_CONFIGS[selectedTier];
  return {
    tier: selectedTier,
    config,
    reason,
    estimatedCost: calculateCost(config, tokens),
    estimatedLatencyMs: config.avgResponseTimeMs,
  };
}

// Batch routing for multiple prompts
export function routeBatch(
  prompts: CompiledPrompt[],
  options: RoutingOptions = {}
): {
  routes: RoutingResult[];
  summary: {
    byTier: Record<ModelTier, number>;
    totalEstimatedCost: number;
    totalEstimatedLatencyMs: number;
    parallelLatencyMs: number;
  };
} {
  const routes = prompts.map((p) => routePrompt(p, options));

  // Aggregate by tier
  const byTier: Record<ModelTier, number> = { haiku: 0, sonnet: 0, opus: 0 };
  let totalEstimatedCost = 0;
  let totalEstimatedLatencyMs = 0;

  for (const route of routes) {
    byTier[route.tier]++;
    totalEstimatedCost += route.estimatedCost;
    totalEstimatedLatencyMs += route.estimatedLatencyMs;
  }

  // Calculate parallel execution time
  // Time = max(batch_time_per_tier) where batch_time = ceil(count/concurrency) * latency
  const tierLatencies = (Object.keys(byTier) as ModelTier[]).map((tier) => {
    const count = byTier[tier];
    const config = MODEL_CONFIGS[tier];
    const batches = Math.ceil(count / config.maxConcurrency);
    return batches * config.avgResponseTimeMs;
  });
  const parallelLatencyMs = Math.max(...tierLatencies, 0);

  return {
    routes,
    summary: {
      byTier,
      totalEstimatedCost,
      totalEstimatedLatencyMs,
      parallelLatencyMs,
    },
  };
}

// Estimate costs for a simulation run
export function estimateSimulationCost(params: {
  sampleSize: number;
  useArchetypes: boolean;
  archetypeCount?: number;
  avgComplexity: number;
  domain?: "enterprise" | "defense" | "consumer";
}): {
  estimatedCost: number;
  estimatedLatencyMs: number;
  breakdown: {
    haiku: { count: number; cost: number };
    sonnet: { count: number; cost: number };
    opus: { count: number; cost: number };
  };
} {
  const effectiveCount = params.useArchetypes
    ? Math.min(params.archetypeCount || 50, params.sampleSize)
    : params.sampleSize;

  // Estimate tier distribution based on complexity
  let haikuFraction: number;
  let sonnetFraction: number;
  let opusFraction: number;

  if (params.avgComplexity < 0.25) {
    haikuFraction = 0.9;
    sonnetFraction = 0.1;
    opusFraction = 0;
  } else if (params.avgComplexity < 0.55) {
    haikuFraction = 0.3;
    sonnetFraction = 0.65;
    opusFraction = 0.05;
  } else {
    haikuFraction = 0.1;
    sonnetFraction = 0.5;
    opusFraction = 0.4;
  }

  // Defense domain shifts toward higher tiers
  if (params.domain === "defense") {
    haikuFraction = Math.max(0, haikuFraction - 0.2);
    sonnetFraction += 0.15;
    opusFraction += 0.05;
  }

  const haikuCount = Math.round(effectiveCount * haikuFraction);
  const sonnetCount = Math.round(effectiveCount * sonnetFraction);
  const opusCount = effectiveCount - haikuCount - sonnetCount;

  // Estimate 500 input tokens, 150 output tokens per call
  const tokens = { input: 500, output: 150 };

  const haikuCost = haikuCount * calculateCost(MODEL_CONFIGS.haiku, tokens);
  const sonnetCost = sonnetCount * calculateCost(MODEL_CONFIGS.sonnet, tokens);
  const opusCost = opusCount * calculateCost(MODEL_CONFIGS.opus, tokens);

  // Parallel latency
  const haikuTime = Math.ceil(haikuCount / MODEL_CONFIGS.haiku.maxConcurrency) * MODEL_CONFIGS.haiku.avgResponseTimeMs;
  const sonnetTime = Math.ceil(sonnetCount / MODEL_CONFIGS.sonnet.maxConcurrency) * MODEL_CONFIGS.sonnet.avgResponseTimeMs;
  const opusTime = Math.ceil(opusCount / MODEL_CONFIGS.opus.maxConcurrency) * MODEL_CONFIGS.opus.avgResponseTimeMs;

  return {
    estimatedCost: haikuCost + sonnetCost + opusCost,
    estimatedLatencyMs: Math.max(haikuTime, sonnetTime, opusTime),
    breakdown: {
      haiku: { count: haikuCount, cost: haikuCost },
      sonnet: { count: sonnetCount, cost: sonnetCost },
      opus: { count: opusCount, cost: opusCost },
    },
  };
}

// ============================================================
// AGENT-TIER BASED ROUTING
// ============================================================

/**
 * Route model selection based on agent tier
 *
 * Tier mapping:
 * - VIP (Tier 1): Always use Opus for highest quality
 * - Archetype (Tier 2): Use Sonnet/Haiku based on complexity
 * - Statistical (Tier 3): No LLM call - use distribution lookup
 */
export interface AgentRoutingResult {
  requiresLLM: boolean;
  tier?: ModelTier;
  config?: ModelConfig;
  reason: string;
}

export function routeByAgentTier(
  agent: Agent,
  options?: {
    isStrategic?: boolean;
    forceUpgrade?: boolean;
    complexity?: number;
  }
): AgentRoutingResult {
  // Statistical agents don't use LLM
  if (agent.tier === "statistical") {
    return {
      requiresLLM: false,
      reason: "Statistical agent - using pre-computed distribution lookup",
    };
  }

  // VIP agents always use Opus for highest fidelity
  if (agent.tier === "vip") {
    return {
      requiresLLM: true,
      tier: "opus",
      config: MODEL_CONFIGS.opus,
      reason: "VIP agent - using Opus for highest quality reasoning",
    };
  }

  // Archetype agents use Sonnet by default, Haiku for simple tasks
  if (agent.tier === "archetype") {
    // Strategic reasoning always uses Sonnet minimum
    if (options?.isStrategic) {
      return {
        requiresLLM: true,
        tier: "sonnet",
        config: MODEL_CONFIGS.sonnet,
        reason: "Archetype with strategic reasoning - using Sonnet",
      };
    }

    // Simple binary questions can use Haiku
    const complexity = options?.complexity ?? 0.5;
    if (complexity < 0.3 && !options?.forceUpgrade) {
      return {
        requiresLLM: true,
        tier: "haiku",
        config: MODEL_CONFIGS.haiku,
        reason: "Archetype with simple question - using Haiku for efficiency",
      };
    }

    // Default to Sonnet for balanced quality/cost
    return {
      requiresLLM: true,
      tier: "sonnet",
      config: MODEL_CONFIGS.sonnet,
      reason: "Archetype agent - using Sonnet for balanced quality",
    };
  }

  // Fallback to Sonnet
  return {
    requiresLLM: true,
    tier: "sonnet",
    config: MODEL_CONFIGS.sonnet,
    reason: "Unknown agent tier - defaulting to Sonnet",
  };
}

/**
 * Batch route agents by tier
 * Returns agents grouped by their LLM tier for efficient parallel execution
 */
export function groupAgentsByTier(agents: Agent[]): {
  opus: Agent[];
  sonnet: Agent[];
  haiku: Agent[];
  statistical: Agent[];
} {
  const groups = {
    opus: [] as Agent[],
    sonnet: [] as Agent[],
    haiku: [] as Agent[],
    statistical: [] as Agent[],
  };

  for (const agent of agents) {
    const routing = routeByAgentTier(agent);
    if (!routing.requiresLLM) {
      groups.statistical.push(agent);
    } else if (routing.tier === "opus") {
      groups.opus.push(agent);
    } else if (routing.tier === "haiku") {
      groups.haiku.push(agent);
    } else {
      groups.sonnet.push(agent);
    }
  }

  return groups;
}

/**
 * Estimate cost for agent-tier-aware simulation
 */
export function estimateAgentTierCost(agents: Agent[]): {
  totalCost: number;
  breakdown: {
    vip: { count: number; cost: number };
    archetype: { count: number; cost: number };
    statistical: { count: number; cost: number };
  };
  estimatedLatencyMs: number;
} {
  const groups = groupAgentsByTier(agents);
  const tokens = { input: 500, output: 150 };

  const opusCost = groups.opus.length * calculateCost(MODEL_CONFIGS.opus, tokens);
  const sonnetCost = groups.sonnet.length * calculateCost(MODEL_CONFIGS.sonnet, tokens);
  const haikuCost = groups.haiku.length * calculateCost(MODEL_CONFIGS.haiku, tokens);
  const statisticalCost = groups.statistical.length * 0.0001; // ~$0.0001 per statistical lookup

  // Parallel latency calculation
  const opusTime =
    Math.ceil(groups.opus.length / MODEL_CONFIGS.opus.maxConcurrency) *
    MODEL_CONFIGS.opus.avgResponseTimeMs;
  const sonnetTime =
    Math.ceil(groups.sonnet.length / MODEL_CONFIGS.sonnet.maxConcurrency) *
    MODEL_CONFIGS.sonnet.avgResponseTimeMs;
  const haikuTime =
    Math.ceil(groups.haiku.length / MODEL_CONFIGS.haiku.maxConcurrency) *
    MODEL_CONFIGS.haiku.avgResponseTimeMs;
  // Statistical lookups are instant
  const statisticalTime = groups.statistical.length * 0.1; // ~0.1ms per lookup

  return {
    totalCost: opusCost + sonnetCost + haikuCost + statisticalCost,
    breakdown: {
      vip: { count: groups.opus.length, cost: opusCost },
      archetype: { count: groups.sonnet.length + groups.haiku.length, cost: sonnetCost + haikuCost },
      statistical: { count: groups.statistical.length, cost: statisticalCost },
    },
    estimatedLatencyMs: Math.max(opusTime, sonnetTime, haikuTime, statisticalTime),
  };
}
