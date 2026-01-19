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

// ============ TIERED AGENT SYSTEM ============

/**
 * VIP Agents - High-fidelity named individuals from nyne.ai
 * Tier 1: Full LLM reasoning with Claude Opus
 * ~2,000 agents with rich behavioral profiles
 */
export const vipAgents = pgTable("vip_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  nyneId: text("nyne_id").unique(), // External ID from nyne.ai
  name: text("name").notNull(),

  // Classification (new fields for strategic collection)
  vertical: text("vertical").notNull(), // 'enterprise', 'political', 'defense'
  tier: text("tier").notNull().default("A"), // 'A', 'B', 'C'
  domain: text("domain").notNull(), // 'tech_ceo', 'ai_lab', 'congress', 'cabinet', etc.
  role: text("role").notNull(), // 'Senator', 'CEO', 'General', etc.
  affiliation: text("affiliation"), // Party, company, organization
  priorityRank: integer("priority_rank"), // Collection priority within vertical

  // Identity
  biography: text("biography"),
  communicationStyle: text("communication_style"),
  sampleContent: jsonb("sample_content").$type<string[]>(), // Representative quotes/posts

  // Psychographic profile (inferred from nyne.ai)
  bigFive: jsonb("big_five").$type<BigFiveTraits>(),
  moralFoundations: jsonb("moral_foundations").$type<MoralFoundations>(),
  psychographics: jsonb("psychographics").$type<VIPPsychographics>(),

  // Topic interests and positions
  topicInterests: jsonb("topic_interests").$type<TopicInterest[]>(),
  knownPositions: jsonb("known_positions").$type<KnownPosition[]>(),

  // Network relationships
  network: jsonb("network").$type<AgentNetwork>(),

  // Raw nyne.ai data (preserved for reprocessing)
  nyneRawInterests: jsonb("nyne_raw_interests").$type<Record<string, unknown>>(),
  nyneRawNewsfeed: jsonb("nyne_raw_newsfeed").$type<Record<string, unknown>>(),
  nyneRawEnrichment: jsonb("nyne_raw_enrichment").$type<Record<string, unknown>>(),
  nyneRawSocial: jsonb("nyne_raw_social").$type<Record<string, unknown>>(),

  // Collection tracking
  collectionStatus: text("collection_status").default("pending"), // 'pending', 'partial', 'complete', 'error'
  creditsUsed: integer("credits_used").default(0),

  // For semantic search via Pinecone
  embeddingId: text("embedding_id"), // Pinecone vector ID

  // Metadata
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Validation Events - Historical events for backtesting simulation accuracy
 */
export const validationEvents = pgTable("validation_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: text("event_type").notNull(), // 'election', 'vote', 'market', 'announcement', 'policy'
  eventDate: timestamp("event_date").notNull(),
  description: text("description"),
  vertical: text("vertical").notNull(), // 'enterprise', 'political', 'defense'

  // The scenario that was presented
  scenario: jsonb("scenario").$type<Record<string, unknown>>(),

  // What actually happened
  actualOutcome: jsonb("actual_outcome").$type<Record<string, unknown>>(),

  // What the simulation predicted (filled in after backtest)
  predictedOutcome: jsonb("predicted_outcome").$type<Record<string, unknown>>(),
  simulationId: uuid("simulation_id").references(() => simulations.id),

  // Accuracy metrics
  accuracyScore: real("accuracy_score"), // Overall accuracy 0-1
  calibrationScore: real("calibration_score"), // How well-calibrated distributions were
  brierScore: real("brier_score"), // Brier score for probabilistic predictions

  // Source
  groundTruthSource: text("ground_truth_source"), // URL or reference
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Collection Log - Track nyne.ai API calls and credit usage
 */
export const collectionLog = pgTable("collection_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  vipId: uuid("vip_id").references(() => vipAgents.id),
  vipName: text("vip_name").notNull(),

  // API details
  apiEndpoint: text("api_endpoint").notNull(), // 'interests', 'newsfeed', 'enrichment', 'social'
  creditsUsed: integer("credits_used").notNull(),

  // Result
  status: text("status").notNull(), // 'success', 'error', 'rate_limited', 'not_found'
  errorMessage: text("error_message"),
  responseHash: text("response_hash"), // For deduplication
  responseSize: integer("response_size"), // Bytes

  // Timing
  requestDurationMs: integer("request_duration_ms"),
  collectedAt: timestamp("collected_at").defaultNow().notNull(),
});

/**
 * Agent Archetypes - Statistical clusters for efficient simulation
 * Tier 2: Lighter LLM calls with GPT-4o-mini
 * ~10,000 archetypes representing demographic/psychographic clusters
 */
export const agentArchetypes = pgTable("agent_archetypes", {
  id: uuid("id").primaryKey().defaultRandom(),
  demographicHash: text("demographic_hash").unique().notNull(), // Fast lookup key

  // Demographics (from US Census)
  demographics: jsonb("demographics").notNull().$type<ArchetypeDemographics>(),

  // Psychographic traits
  traits: jsonb("traits").notNull().$type<ArchetypeTraits>(),

  // Population weighting for representative sampling
  populationWeight: real("population_weight").notNull(),

  // Pre-computed response distributions for common questions
  // Maps question type -> response distribution
  responseDistributions: jsonb("response_distributions").$type<Record<string, ResponseDistribution>>(),

  // Number of statistical agents using this archetype
  agentCount: integer("agent_count").default(0),

  // Human-readable description
  description: text("description"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Statistical Agents - Lightweight agents for large-scale simulation
 * Tier 3: No LLM calls, uses lookup from archetype distributions
 * ~1,000,000 agents for population-level simulations
 */
export const statisticalAgents = pgTable("statistical_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  archetypeId: uuid("archetype_id").references(() => agentArchetypes.id).notNull(),

  // Individual variation from archetype (for diversity)
  traitVariation: jsonb("trait_variation").$type<Partial<ArchetypeTraits>>(),

  // Sampling weight
  weight: real("weight").default(1.0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ TIERED AGENT TYPES ============

export interface VIPPsychographics {
  riskTolerance: number; // 0-1
  decisionStyle: "analytical" | "intuitive" | "consensus";
  influenceability: number; // 0-1
  publicPrivateGap: number; // How different public vs private stance (0-1)
  values?: string[];
  communicationStyle?: string;
}

// Big Five personality traits (OCEAN model)
export interface BigFiveTraits {
  openness: number; // 0-1: Curiosity, creativity, preference for variety
  conscientiousness: number; // 0-1: Organization, dependability, self-discipline
  extraversion: number; // 0-1: Sociability, assertiveness, positive emotions
  agreeableness: number; // 0-1: Cooperation, trust, altruism
  neuroticism: number; // 0-1: Anxiety, moodiness, emotional instability
}

// Moral Foundations Theory (Jonathan Haidt)
export interface MoralFoundations {
  care: number; // 0-1: Concern for others' wellbeing
  fairness: number; // 0-1: Justice, rights, autonomy
  loyalty: number; // 0-1: Patriotism, self-sacrifice for group
  authority: number; // 0-1: Respect for tradition, hierarchy
  sanctity: number; // 0-1: Purity, disgust, sacredness
  liberty: number; // 0-1: Freedom from oppression
}

// Topic interest with engagement weight
export interface TopicInterest {
  topic: string;
  weight: number; // 0-1 interest level
  category: string; // 'technology', 'politics', 'business', etc.
  source: string; // Where this was observed
}

export interface KnownPosition {
  topic: string;
  stance: number; // -1 (strongly against) to +1 (strongly for)
  confidence: number; // 0-1
  source: string; // Where this was observed
  date?: string;
}

export interface AgentNetwork {
  influences: string[]; // IDs of agents who influence this one
  influencedBy: string[]; // IDs of agents this one influences
  affiliations?: string[]; // Groups/organizations
}

export interface ArchetypeDemographics {
  age: "18-24" | "25-34" | "35-44" | "45-54" | "55-64" | "65+";
  gender: "male" | "female" | "other";
  income: "under_25k" | "25k_50k" | "50k_75k" | "75k_100k" | "100k_150k" | "150k_plus";
  education: "no_hs" | "hs" | "some_college" | "bachelors" | "graduate";
  location: "urban" | "suburban" | "rural";
  region: "northeast" | "midwest" | "south" | "west";
  employment?: "employed" | "unemployed" | "retired" | "student";
}

export interface ArchetypeTraits {
  riskTolerance: number; // 0-1
  priceSensitivity: number; // 0-1
  brandLoyalty: number; // 0-1
  techAdoption: number; // 0-1
  politicalLeaning?: number; // -1 (very liberal) to +1 (very conservative)
}

export interface ResponseDistribution {
  type: "categorical" | "likert" | "binary";
  options: string[];
  probabilities: number[]; // Same length as options, sums to 1
  calibrationSource?: string; // Where this was calibrated from
}

// ============ COMPANY AGENTS ============

/**
 * Company Agents - Organizations as first-class simulation actors
 * Enables M&A simulations, enterprise sales modeling, market response
 * 500 companies: Fortune 100 + Defense + Strategic Startups
 */
export const companyAgents = pgTable("company_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  nyneId: text("nyne_id").unique(),

  // Identity
  name: text("name").notNull(),
  companyDomain: text("company_domain"), // company domain for lookup
  ticker: text("ticker"), // Stock ticker if public

  // Classification
  vertical: text("vertical").notNull(), // 'enterprise', 'defense', 'startup'
  tier: text("tier").notNull().default("A"), // 'A', 'B', 'C'
  sector: text("sector").notNull(), // 'tech', 'finance', 'healthcare', 'defense', 'retail'
  subsector: text("subsector"), // 'cloud', 'ai', 'semiconductors'
  priorityRank: integer("priority_rank"),

  // Firmographics
  size: text("size"), // 'startup', 'smb', 'mid_market', 'enterprise', 'mega'
  employeeCount: integer("employee_count"),
  annualRevenue: decimal("annual_revenue", { precision: 15, scale: 2 }),
  founded: integer("founded"), // Year
  hqLocation: text("hq_location"),

  // Organizational Profile
  companyDescription: text("company_description"),
  techStack: jsonb("tech_stack").$type<string[]>(), // From Feature Checker
  painPoints: jsonb("pain_points").$type<CompanyNeed[]>(), // From Needs API
  fundingHistory: jsonb("funding_history").$type<FundingRound[]>(),

  // Behavioral Profile (inferred)
  riskTolerance: real("risk_tolerance"), // 0-1
  innovationScore: real("innovation_score"), // 0-1
  regulatoryExposure: real("regulatory_exposure"), // 0-1
  aiAdoptionStage: text("ai_adoption_stage"), // 'exploring', 'piloting', 'scaling', 'mature'

  // Network
  keyExecutives: jsonb("key_executives").$type<string[]>(), // VIP IDs
  competitors: jsonb("competitors").$type<string[]>(), // Company IDs
  partners: jsonb("partners").$type<string[]>(), // Company IDs
  investors: jsonb("investors").$type<string[]>(), // VIP/Company IDs

  // Raw nyne.ai data
  nyneRawEnrichment: jsonb("nyne_raw_enrichment").$type<Record<string, unknown>>(),
  nyneRawNeeds: jsonb("nyne_raw_needs").$type<Record<string, unknown>>(),
  nyneRawFeatures: jsonb("nyne_raw_features").$type<Record<string, unknown>>(),
  nyneRawFunding: jsonb("nyne_raw_funding").$type<Record<string, unknown>>(),

  // Collection tracking
  collectionStatus: text("collection_status").default("pending"),
  creditsUsed: integer("credits_used").default(0),

  // Metadata
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * VIP-Company Relations - Links between executives and organizations
 * Enables network influence modeling and organizational behavior
 */
export const vipCompanyRelations = pgTable("vip_company_relations", {
  id: uuid("id").primaryKey().defaultRandom(),
  vipId: uuid("vip_id").references(() => vipAgents.id).notNull(),
  companyId: uuid("company_id").references(() => companyAgents.id).notNull(),

  // Relationship type
  relationType: text("relation_type").notNull(), // 'executive', 'board', 'investor', 'advisor', 'founder'
  role: text("role"), // 'CEO', 'Board Member', 'GP'

  // Relationship strength
  influence: real("influence"), // 0-1: How much does VIP influence company decisions
  tenure: text("tenure"), // 'current', 'former', 'incoming'
  startDate: text("start_date"),
  endDate: text("end_date"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ COMPANY TYPES ============

export interface CompanyNeed {
  painPoint: string;
  severity: number; // 0-1
  source: string; // 'sec_filing', 'news', 'inferred'
  category: string; // 'operational', 'regulatory', 'competitive', 'technology'
}

export interface FundingRound {
  round: string; // 'seed', 'series_a', 'series_b', etc.
  amount: number;
  date: string;
  investors: string[];
  valuation?: number;
}

// ============ SIMULATION RUNS (Persistent Store) ============

/**
 * Simulation Runs - Persisted record of every simulation execution
 * Replaces the in-memory Map<> store for production reliability
 */
export const simulationRuns = pgTable("simulation_runs", {
  id: text("id").primaryKey(), // e.g., "sim_abc123"
  status: text("status").notNull().default("running"), // 'running', 'completed', 'failed'
  
  // Configuration (the input to the simulation)
  config: jsonb("config").notNull().$type<SimulationRunConfig>(),
  
  // Result (populated on completion)
  result: jsonb("result").$type<SimulationRunResult>(),
  
  // Error details (populated on failure)
  error: text("error"),
  
  // Audit reference
  auditId: text("audit_id").notNull(),
  
  // User/session tracking
  userId: text("user_id"), // Clerk user ID if authenticated
  sessionId: text("session_id"),
  
  // Timing
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Simulation Audits - Detailed audit trail for reproducibility and compliance
 * Links to simulation_runs via auditId
 */
export const simulationAudits = pgTable("simulation_audits", {
  id: text("id").primaryKey(), // e.g., "audit_xyz789"
  runId: text("run_id").references(() => simulationRuns.id),
  
  // Request details
  requestConfig: jsonb("request_config").notNull().$type<SimulationRunConfig>(),
  requestIp: text("request_ip"),
  requestUserAgent: text("request_user_agent"),
  
  // Response summary (populated on completion)
  responseSummary: jsonb("response_summary").$type<SimulationAuditResponse>(),
  
  // Error details (populated on failure)
  error: text("error"),
  
  // Metadata for reproducibility
  modelVersions: jsonb("model_versions").$type<Record<string, string>>(),
  dataVersions: jsonb("data_versions").$type<Record<string, string>>(),
  configHash: text("config_hash"), // SHA256 of config for deduplication
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============ SIMULATION RUN TYPES ============

export interface SimulationRunConfig {
  id?: string;
  query: string;
  scenario?: string;
  question?: string;
  questionType?: "binary" | "scale" | "choice" | "open" | "numeric";
  options?: string[];
  world?: {
    hypotheticalEvents?: string[];
    marketConditions?: {
      economy: "growth" | "stable" | "recession";
      sentiment: "bullish" | "neutral" | "bearish";
      volatility: "low" | "medium" | "high";
    };
    timeHorizon?: string;
  };
  population?: {
    mode: "vip" | "archetype" | "population";
    sampleSize: number;
    useArchetypes?: boolean;
    archetypeCount?: number;
    filters?: Record<string, string[]>;
    vipIds?: string[];
  };
  psychographics?: {
    bigFive?: Record<string, number>;
    values?: Record<string, number>;
    biases?: Record<string, number>;
    traits?: Record<string, number>;
  };
  agents?: {
    biases?: Record<string, number>;
    interactionMode?: string;
  };
  execution?: {
    pilotMode?: boolean;
    pilotSize?: number;
    confidenceTarget?: number;
    maxConcurrency?: number;
    timeout?: number;
  };
  counterfactuals?: Array<{
    id: string;
    label: string;
    worldModification?: Record<string, unknown>;
  }>;
}

export interface SimulationRunResult {
  id: string;
  query: string;
  timestamp: string;
  auditId?: string;
  summary: {
    primaryMetric: number;
    primaryMetricLabel: string;
    confidenceInterval: { lower: number; upper: number };
    sampleSize: number;
    effectiveSampleSize: number;
    executionTimeMs: number;
  };
  distribution: {
    type: string;
    values: Array<{ label: string; value: number }>;
    raw?: Record<string, number>;
  };
  segments: Array<{
    name: string;
    filters: Record<string, string>;
    value: number;
    count: number;
    delta: number;
    significance: boolean;
  }>;
  drivers: Array<{
    factor: string;
    importance: number;
    direction: "positive" | "negative";
    effect: number;
  }>;
  counterfactuals: Array<{
    id: string;
    label: string;
    outcome: number;
    delta: number;
    significance: boolean;
  }>;
  accuracy: {
    ssrCalibration: number;
    sampleQuality: number;
    responseQuality: number;
    diversityIndex: number;
  };
  metadata: {
    populationId: string;
    agentsGenerated: number;
    agentsExecuted: number;
    archetypesUsed: boolean;
    modelTierDistribution: Record<string, number>;
    avgLatencyMs: number;
  };
}

export interface SimulationAuditResponse {
  summary: SimulationRunResult["summary"];
  metadata?: SimulationRunResult["metadata"];
}
