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

// ============ DATA SOURCES (Airbyte Integration) ============

export const dataSources = pgTable("data_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  connectorType: text("connector_type").notNull(), // 'salesforce', 'hubspot', 'postgres', etc.
  connectorImage: text("connector_image"), // Docker image or icon
  configEncrypted: text("config_encrypted"), // Encrypted credentials JSON
  status: text("status").notNull().default("pending"), // pending, connecting, ready, syncing, error
  errorMessage: text("error_message"),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncDurationMs: integer("last_sync_duration_ms"),
  recordCount: integer("record_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sourceSchemas = pgTable("source_schemas", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").references(() => dataSources.id).notNull(),
  streamName: text("stream_name").notNull(), // 'contacts', 'leads', etc.
  streamNamespace: text("stream_namespace"), // Schema/database name
  jsonSchema: jsonb("json_schema").notNull().$type<Record<string, unknown>>(),
  fields: jsonb("fields").notNull().$type<SourceField[]>(),
  sampleRecords: jsonb("sample_records").$type<Record<string, unknown>[]>(),
  discoveredAt: timestamp("discovered_at").defaultNow(),
  recordCount: integer("record_count"),
});

export const fieldMappings = pgTable("field_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").references(() => dataSources.id).notNull(),
  streamName: text("stream_name").notNull(),
  sourceField: text("source_field").notNull(), // Field path in source
  targetTrait: text("target_trait").notNull(), // RLTX trait (age, income_bracket, etc.)
  transformType: text("transform_type").notNull(), // 'direct', 'date_to_age', 'income_to_bracket', etc.
  transformConfig: jsonb("transform_config").$type<Record<string, unknown>>(),
  matchMethod: text("match_method").notNull(), // 'exact', 'fuzzy', 'semantic', 'ai', 'manual'
  confidence: real("confidence").notNull(),
  userConfirmed: boolean("user_confirmed").default(false),
  validationErrors: jsonb("validation_errors").$type<string[]>(),
  sampleOutput: jsonb("sample_output").$type<unknown[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const populationIndices = pgTable("population_indices", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").references(() => dataSources.id).notNull(),
  streamName: text("stream_name").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  filters: jsonb("filters").$type<Record<string, unknown>>(),
  distributions: jsonb("distributions").notNull().$type<Record<string, TraitDistribution>>(),
  segments: jsonb("segments").$type<PopulationSegment[]>(),
  totalRecords: integer("total_records").notNull(),
  completeRecords: integer("complete_records").notNull(),
  traitCoverage: jsonb("trait_coverage").$type<Record<string, number>>(),
  status: text("status").default("building"), // building, ready, stale
  builtAt: timestamp("built_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const syncedRecords = pgTable("synced_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").references(() => dataSources.id).notNull(),
  streamName: text("stream_name").notNull(),
  externalId: text("external_id").notNull(),
  rawData: jsonb("raw_data").notNull().$type<Record<string, unknown>>(),
  syncedAt: timestamp("synced_at").defaultNow(),
  checksum: text("checksum"),
});

export const indexedAgents = pgTable("indexed_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  populationId: uuid("population_id").references(() => populationIndices.id).notNull(),
  sourceRecordId: uuid("source_record_id").references(() => syncedRecords.id),
  traits: jsonb("traits").notNull().$type<AgentTraits>(),
  inferredTraits: jsonb("inferred_traits").$type<Partial<AgentTraits>>(),
  traitCompleteness: real("trait_completeness").notNull(),
  inferenceConfidence: real("inference_confidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const syncJobs = pgTable("sync_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").references(() => dataSources.id).notNull(),
  jobType: text("job_type").notNull(), // 'full', 'incremental'
  status: text("status").default("pending"), // pending, running, completed, failed
  recordsProcessed: integer("records_processed").default(0),
  recordsTotal: integer("records_total"),
  currentStream: text("current_stream"),
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details").$type<Record<string, unknown>>(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ DATA SOURCE TYPES ============

export interface SourceField {
  name: string;
  type: string; // 'string', 'number', 'date', 'boolean', 'object', 'array'
  nullable: boolean;
  sample?: unknown;
  suggestedTrait?: string;
  suggestedTransform?: string;
  confidence?: number;
}

export interface TraitDistribution {
  [value: string]: {
    count: number;
    percentage: number;
  };
}

export interface PopulationSegment {
  name: string;
  criteria: Record<string, unknown>;
  count: number;
  percentage: number;
}

export interface AgentTraits {
  // Demographics
  age?: number;
  gender?: "male" | "female" | "non-binary" | "other";
  income?: number;
  income_bracket?: "low" | "medium" | "high" | "affluent";
  education?: "high_school" | "some_college" | "bachelors" | "graduate" | "doctorate";
  occupation?: string;
  location_type?: "urban" | "suburban" | "rural";
  location_name?: string;
  household_composition?: string;
  // Psychographics
  values?: string[];
  risk_tolerance?: number;
  price_sensitivity?: number;
  information_seeking?: number;
  brand_loyalty?: number;
  // Custom
  [key: string]: unknown;
}

export interface ConnectorDefinition {
  id: string;
  name: string;
  icon: string;
  category: "crm" | "database" | "warehouse" | "files" | "api" | "marketing" | "analytics" | "other";
  description: string;
  popularity: number; // 1-5 stars
  authType: "oauth" | "api_key" | "basic" | "connection_string";
  configFields: ConfigField[];
}

export interface ConfigField {
  name: string;
  label: string;
  type: "text" | "password" | "select" | "checkbox";
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  helpText?: string;
}
