/**
 * Simulation API Validation Schemas
 * 
 * Zod schemas for validating API requests and providing
 * structured, actionable error messages.
 */

import { z } from "zod";

// =============================================================================
// Psychographic Sub-Schemas
// =============================================================================

export const BigFiveProfileSchema = z.object({
  openness: z.number().min(0).max(1).optional(),
  conscientiousness: z.number().min(0).max(1).optional(),
  extraversion: z.number().min(0).max(1).optional(),
  agreeableness: z.number().min(0).max(1).optional(),
  neuroticism: z.number().min(0).max(1).optional(),
}).optional();

export const ValuesProfileSchema = z.object({
  selfDirection: z.number().min(0).max(1).optional(),
  stimulation: z.number().min(0).max(1).optional(),
  hedonism: z.number().min(0).max(1).optional(),
  achievement: z.number().min(0).max(1).optional(),
  power: z.number().min(0).max(1).optional(),
  security: z.number().min(0).max(1).optional(),
  conformity: z.number().min(0).max(1).optional(),
  tradition: z.number().min(0).max(1).optional(),
  benevolence: z.number().min(0).max(1).optional(),
  universalism: z.number().min(0).max(1).optional(),
}).optional();

export const CognitiveBiasesSchema = z.object({
  lossAversion: z.number().min(0).max(1).optional(),
  statusQuoBias: z.number().min(0).max(1).optional(),
  anchoringBias: z.number().min(0).max(1).optional(),
  confirmationBias: z.number().min(0).max(1).optional(),
  availabilityBias: z.number().min(0).max(1).optional(),
  socialProof: z.number().min(0).max(1).optional(),
  overconfidence: z.number().min(0).max(1).optional(),
}).optional();

export const BehavioralTraitsSchema = z.object({
  riskTolerance: z.number().min(0).max(1).optional(),
  priceElasticity: z.number().min(0).max(1).optional(),
  brandLoyalty: z.number().min(0).max(1).optional(),
  qualityOrientation: z.number().min(0).max(1).optional(),
  timeDiscountRate: z.number().min(0).max(1).optional(),
  authorityDeference: z.number().min(0).max(1).optional(),
}).optional();

export const PsychographicConfigSchema = z.object({
  bigFive: BigFiveProfileSchema,
  values: ValuesProfileSchema,
  biases: CognitiveBiasesSchema,
  traits: BehavioralTraitsSchema,
}).optional();

// =============================================================================
// World Configuration Schema
// =============================================================================

export const MarketConditionsSchema = z.object({
  economy: z.enum(["growth", "stable", "recession"]),
  sentiment: z.enum(["bullish", "neutral", "bearish"]),
  volatility: z.enum(["low", "medium", "high"]),
}).optional();

export const WorldConfigSchema = z.object({
  hypotheticalEvents: z.array(z.string().min(1, "Event cannot be empty")).default([]),
  marketConditions: MarketConditionsSchema,
  timeHorizon: z.string().optional(),
}).optional();

// =============================================================================
// Population Configuration Schema
// =============================================================================

export const DemographicsSchema = z.object({
  ageRange: z.tuple([z.number().min(0), z.number().max(120)]).optional(),
  incomeMin: z.number().min(0).optional(),
  incomeRange: z.tuple([z.number().min(0), z.number()]).optional(),
  region: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  industry: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  role: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  companySize: z.string().optional(),
  age: z.string().optional(),
  gender: z.string().optional(),
  education: z.string().optional(),
  income: z.string().optional(),
  location: z.string().optional(),
}).optional();

export const PopulationConfigSchema = z.object({
  mode: z.enum(["single_vip", "population", "vip", "archetype"]).default("population"),
  sampleSize: z.number().min(1).max(100000).default(1000),
  demographics: DemographicsSchema,
  archetypeMix: z.string().optional(),
}).optional();

// =============================================================================
// Agent Configuration Schema
// =============================================================================

export const AgentBiasesSchema = z.object({
  lossAversion: z.number().min(0).max(1).optional(),
  statusQuo: z.number().min(0).max(1).optional(),
  anchoring: z.number().min(0).max(1).optional(),
  socialProof: z.number().min(0).max(1).optional(),
}).optional();

export const AgentsConfigSchema = z.object({
  biases: AgentBiasesSchema,
  interactionMode: z.enum([
    "independent",
    "sequential",
    "deliberation",
    "single",
    "consensus",
    "cascade"
  ]).optional(),
}).optional();

// =============================================================================
// Execution Configuration Schema
// =============================================================================

export const ExecutionConfigSchema = z.object({
  pilotMode: z.boolean().default(false),
  confidenceLevel: z.union([z.literal(90), z.literal(95), z.literal(99)]).default(95),
  maxIterations: z.number().min(1).max(10).optional(),
}).optional();

// =============================================================================
// Counterfactual Schema
// =============================================================================

export const CounterfactualSchema = z.object({
  id: z.string().min(1, "Counterfactual ID is required"),
  label: z.string().min(1, "Counterfactual label is required"),
  event: z.string().min(1, "Counterfactual event description is required"),
});

// =============================================================================
// Main Request Schema
// =============================================================================

export const SimulationRequestSchema = z.object({
  id: z.string().optional(),
  
  // Required: the query
  query: z.string()
    .min(5, "Query must be at least 5 characters")
    .max(2000, "Query must be at most 2000 characters"),
  
  // Optional: structured question
  question: z.string().optional(),
  questionType: z.enum(["binary", "scale", "choice", "open", "numeric"]).optional(),
  options: z.array(z.string()).optional(),
  
  // World state
  world: WorldConfigSchema,
  
  // Population
  population: PopulationConfigSchema,
  
  // Psychographics
  psychographics: PsychographicConfigSchema,
  
  // Agents
  agents: AgentsConfigSchema,
  
  // Execution
  execution: ExecutionConfigSchema,
  
  // Counterfactuals
  counterfactuals: z.array(CounterfactualSchema).max(10, "Maximum 10 counterfactual scenarios").optional(),
});

export type SimulationRequest = z.infer<typeof SimulationRequestSchema>;

// =============================================================================
// Validation Helper Functions
// =============================================================================

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  success: boolean;
  data?: SimulationRequest;
  errors?: ValidationError[];
}

/**
 * Validate a simulation request and return structured errors
 */
export function validateSimulationRequest(body: unknown): ValidationResult {
  const result = SimulationRequestSchema.safeParse(body);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  // Transform Zod errors into structured field-level errors
  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    field: issue.path.join(".") || "root",
    message: issue.message,
    value: issue.path.length > 0 ? getNestedValue(body as Record<string, unknown>, issue.path) : undefined,
  }));
  
  return { success: false, errors };
}

/**
 * Get a nested value from an object by path
 */
function getNestedValue(obj: Record<string, unknown>, path: (string | number)[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

/**
 * Format validation errors for API response
 */
export function formatValidationErrors(errors: ValidationError[]): {
  error: string;
  details: ValidationError[];
  fields: Record<string, string>;
} {
  return {
    error: `Validation failed: ${errors.length} field(s) have issues`,
    details: errors,
    fields: errors.reduce((acc, err) => {
      acc[err.field] = err.message;
      return acc;
    }, {} as Record<string, string>),
  };
}
