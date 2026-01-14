import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  real,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";

// ============ USERS ============

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============ WORKFLOWS ============

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  question: text("question").notNull(),
  description: text("description"),
  graph: jsonb("graph").notNull().$type<WorkflowGraph>(),
  status: text("status").notNull().default("draft"),
  createdBy: text("created_by").notNull(), // Clerk user ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============ EXECUTIONS ============

export const executions = pgTable("executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .references(() => workflows.id)
    .notNull(),
  status: text("status").notNull().default("pending"),
  nodeResults: jsonb("node_results").$type<Record<string, NodeResult>>(),
  results: jsonb("results").$type<ExecutionResults>(),
  startedBy: text("started_by").notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ CONVERSATIONS ============

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").references(() => workflows.id),
  userId: text("user_id").notNull(),
  messages: jsonb("messages").$type<ChatMessage[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============ SIMULATIONS ============

export const simulations = pgTable("simulations", {
  id: uuid("id").primaryKey().defaultRandom(),
  executionId: uuid("execution_id")
    .references(() => executions.id)
    .notNull(),
  nodeId: text("node_id").notNull(),
  simulationType: text("simulation_type").notNull(), // 'monte_carlo', 'game_theory', 'counterfactual'
  config: jsonb("config").notNull().$type<SimulationConfig>(),
  domain: text("domain").notNull().default("enterprise"), // 'enterprise', 'defense'
  agentPopulationId: text("agent_population_id"),
  environmentConfig: jsonb("environment_config").$type<Record<string, unknown>>(),
  status: text("status").notNull().default("pending"),
  progress: real("progress").default(0),
  rawResults: jsonb("raw_results").$type<Record<string, unknown>>(),
  distributions: jsonb("distributions").$type<Record<string, Distribution>>(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  computeCostDollars: decimal("compute_cost_dollars", { precision: 10, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ DISTRIBUTIONS ============

export const distributions = pgTable("distributions", {
  id: uuid("id").primaryKey().defaultRandom(),
  executionId: uuid("execution_id")
    .references(() => executions.id)
    .notNull(),
  nodeId: text("node_id").notNull(),
  variableName: text("variable_name").notNull(),
  distributionType: text("distribution_type").notNull(), // 'normal', 'lognormal', 'empirical', 'mixture'
  parameters: jsonb("parameters").notNull().$type<Record<string, number>>(),
  mean: real("mean"),
  std: real("std"),
  p5: real("p5"),
  p25: real("p25"),
  p50: real("p50"),
  p75: real("p75"),
  p95: real("p95"),
  correlations: jsonb("correlations").$type<Record<string, number>>(),
  uncertaintyType: text("uncertainty_type"), // 'aleatory', 'epistemic', 'mixed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ COUNTERFACTUAL BRANCHES ============

export const counterfactualBranches = pgTable("counterfactual_branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  executionId: uuid("execution_id")
    .references(() => executions.id)
    .notNull(),
  parentBranchId: uuid("parent_branch_id"),
  name: text("name").notNull(),
  description: text("description"),
  assumptions: jsonb("assumptions").notNull().$type<Record<string, unknown>>(),
  probability: real("probability"),
  status: text("status").notNull().default("pending"),
  results: jsonb("results").$type<Record<string, unknown>>(),
  outcomeDistributionId: uuid("outcome_distribution_id").references(() => distributions.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ GAME EQUILIBRIA ============

export const gameEquilibria = pgTable("game_equilibria", {
  id: uuid("id").primaryKey().defaultRandom(),
  simulationId: uuid("simulation_id")
    .references(() => simulations.id)
    .notNull(),
  players: jsonb("players").notNull().$type<GamePlayer[]>(),
  actions: jsonb("actions").notNull().$type<Record<string, string[]>>(),
  payoffMatrix: jsonb("payoff_matrix").notNull().$type<Record<string, unknown>>(),
  equilibriumType: text("equilibrium_type"), // 'nash', 'correlated', 'approximate'
  equilibriumStrategies: jsonb("equilibrium_strategies").notNull().$type<Record<string, Record<string, number>>>(),
  equilibriumPayoffs: jsonb("equilibrium_payoffs").notNull().$type<Record<string, number>>(),
  stabilityScore: real("stability_score"),
  isParetoOptimal: boolean("is_pareto_optimal"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ CAUSAL EDGES ============

export const causalEdges = pgTable("causal_edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  executionId: uuid("execution_id")
    .references(() => executions.id)
    .notNull(),
  sourceVariable: text("source_variable").notNull(),
  targetVariable: text("target_variable").notNull(),
  causalEffect: real("causal_effect"),
  effectDistributionId: uuid("effect_distribution_id").references(() => distributions.id),
  method: text("method"), // 'simulation', 'regression', 'llm_inference'
  confidence: real("confidence"),
  evidence: jsonb("evidence").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ AGENT POPULATIONS ============

export const agentPopulations = pgTable("agent_populations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  domain: text("domain").notNull(), // 'enterprise', 'defense', 'consumer'
  size: integer("size").notNull(),
  profileTemplate: jsonb("profile_template").notNull().$type<Record<string, unknown>>(),
  demographicDistribution: jsonb("demographic_distribution").$type<Record<string, number>>(),
  llmConfig: jsonb("llm_config").$type<Record<string, unknown>>(),
  actionSpace: jsonb("action_space").$type<string[]>(),
  cachedProfilesUrl: text("cached_profiles_url"),
  orgId: uuid("org_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ TYPES ============

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    primitiveId: string;
    label: string;
    icon: string;
    color: string;
    config: Record<string, unknown>;
    state: "idle" | "pending" | "running" | "completed" | "failed";
    output?: unknown;
    error?: string;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
}

export interface NodeResult {
  state: "pending" | "running" | "completed" | "failed";
  output?: unknown;
  error?: string;
  timing?: {
    startedAt: string;
    completedAt: string;
    durationMs: number;
  };
}

export interface ExecutionResults {
  recommendation?: {
    action: string;
    confidence: number;
    reasoning: string;
  };
  outputs: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  workflow?: WorkflowGraph;
  timestamp: string;
}

// ============ SIMULATION TYPES ============

export interface SimulationConfig {
  populationSize?: number;
  rollouts?: number;
  domain?: "enterprise" | "defense" | "consumer";
  llmAgentRatio?: number;
  timeHorizon?: number;
  [key: string]: unknown;
}

export interface Distribution {
  type: "normal" | "lognormal" | "uniform" | "empirical" | "mixture";
  parameters: Record<string, number>;
  samples?: number[];
  stats?: {
    mean: number;
    std: number;
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
}

export interface GamePlayer {
  id: string;
  name: string;
  type: "firm" | "regulator" | "consumer_group" | "adversary";
  profile?: Record<string, unknown>;
}

export interface CausalEffect {
  variable: string;
  effect: number;
  direction: "positive" | "negative";
  confidence: number;
}

export interface UncertaintySummary {
  total: number;
  epistemic?: number;
  aleatory?: number;
  sources: Array<{
    source: string;
    contribution: number;
  }>;
}
