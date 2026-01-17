// Stratified population sampler for generating synthetic agents
// Implements weighted sampling to match population distributions
// Supports conditional distributions for realistic demographic correlations

import {
  PopulationDefinition,
  DemographicDistribution,
  getPopulation,
  DEMOGRAPHIC_LABELS,
} from "./base-populations";

import { US_CENSUS_2022, sampleConditional } from "./seed-data/us-census-2022";

export interface AgentProfile {
  id: string;
  demographics: {
    age: string;
    gender: string;
    income: string;
    education: string;
    location: string;
    region: string;
    employment?: string;
    householdSize?: string;
  };
  traits?: {
    riskTolerance?: string;
    priceSensitivity?: string;
    brandLoyalty?: string;
    techAdoption?: string;
  };
  // Weight for aggregation (for archetype sampling)
  weight: number;
  // Human-readable description
  description: string;
}

export interface SamplingOptions {
  // Population to sample from
  populationId: string;
  // Number of agents to generate
  sampleSize: number;
  // Use archetype clustering to reduce LLM calls
  useArchetypes?: boolean;
  // Number of archetypes (if useArchetypes is true)
  archetypeCount?: number;
  // Optional filters to apply before sampling
  filters?: {
    age?: string[];
    income?: string[];
    education?: string[];
    location?: string[];
    region?: string[];
  };
  // Seed for reproducibility
  seed?: number;
  // Use conditional distributions for realistic correlations (default: true)
  useConditionals?: boolean;
}

export interface SamplingResult {
  agents: AgentProfile[];
  metadata: {
    populationId: string;
    totalRequested: number;
    totalGenerated: number;
    useArchetypes: boolean;
    archetypeCount?: number;
    effectiveSampleSize: number; // After weighting
    filtersApplied: boolean;
    useConditionals: boolean; // Whether conditional distributions were used
  };
}

// Seeded random number generator for reproducibility
class SeededRandom {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Date.now();
  }

  next(): number {
    // LCG parameters from Numerical Recipes
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }
}

// Sample from a discrete distribution
function sampleDistribution(
  dist: DemographicDistribution,
  rng: SeededRandom,
  allowedValues?: string[]
): string {
  // Filter if needed
  let entries = Object.entries(dist);
  if (allowedValues && allowedValues.length > 0) {
    entries = entries.filter(([key]) => allowedValues.includes(key));
    // Renormalize
    const total = entries.reduce((sum, [, prob]) => sum + prob, 0);
    entries = entries.map(([key, prob]) => [key, prob / total]);
  }

  const r = rng.next();
  let cumulative = 0;
  for (const [value, prob] of entries) {
    cumulative += prob as number;
    if (r <= cumulative) {
      return value;
    }
  }
  // Fallback to last value
  return entries[entries.length - 1][0];
}

// Generate human-readable description from demographics
function generateDescription(
  demographics: AgentProfile["demographics"],
  traits?: AgentProfile["traits"]
): string {
  const parts: string[] = [];

  // Age and gender
  const ageLabel = DEMOGRAPHIC_LABELS.age?.[demographics.age] || demographics.age;
  parts.push(`${ageLabel} ${demographics.gender}`);

  // Location and region
  const locationLabel = DEMOGRAPHIC_LABELS.location?.[demographics.location] || demographics.location;
  const regionLabel = DEMOGRAPHIC_LABELS.region?.[demographics.region] || demographics.region;
  parts.push(`living in a ${locationLabel} in the ${regionLabel}`);

  // Income and education
  const incomeLabel = DEMOGRAPHIC_LABELS.income?.[demographics.income] || demographics.income;
  const educationLabel = DEMOGRAPHIC_LABELS.education?.[demographics.education] || demographics.education;
  parts.push(`with ${educationLabel} education and household income ${incomeLabel}`);

  // Employment if available
  if (demographics.employment) {
    const employmentLabel = DEMOGRAPHIC_LABELS.employment?.[demographics.employment] || demographics.employment;
    parts.push(`currently ${employmentLabel}`);
  }

  // Traits if available
  if (traits) {
    const traitParts: string[] = [];
    if (traits.riskTolerance) {
      traitParts.push(DEMOGRAPHIC_LABELS.riskTolerance?.[traits.riskTolerance] || traits.riskTolerance);
    }
    if (traits.priceSensitivity) {
      traitParts.push(DEMOGRAPHIC_LABELS.pricesSensitivity?.[traits.priceSensitivity] || traits.priceSensitivity);
    }
    if (traits.brandLoyalty) {
      traitParts.push(DEMOGRAPHIC_LABELS.brandLoyalty?.[traits.brandLoyalty] || traits.brandLoyalty);
    }
    if (traits.techAdoption) {
      traitParts.push(DEMOGRAPHIC_LABELS.techAdoption?.[traits.techAdoption] || traits.techAdoption);
    }
    if (traitParts.length > 0) {
      parts.push(`who is ${traitParts.join(", ")}`);
    }
  }

  return parts.join(", ");
}

// Generate a single agent profile (independent sampling - no correlations)
function generateAgentIndependent(
  population: PopulationDefinition,
  rng: SeededRandom,
  filters?: SamplingOptions["filters"],
  weight = 1.0
): AgentProfile {
  const demographics: AgentProfile["demographics"] = {
    age: sampleDistribution(population.distributions.age, rng, filters?.age),
    gender: sampleDistribution(population.distributions.gender, rng),
    income: sampleDistribution(population.distributions.income, rng, filters?.income),
    education: sampleDistribution(population.distributions.education, rng, filters?.education),
    location: sampleDistribution(population.distributions.location, rng, filters?.location),
    region: sampleDistribution(population.distributions.region, rng, filters?.region),
  };

  if (population.distributions.employment) {
    demographics.employment = sampleDistribution(population.distributions.employment, rng);
  }
  if (population.distributions.householdSize) {
    demographics.householdSize = sampleDistribution(population.distributions.householdSize, rng);
  }

  let traits: AgentProfile["traits"] | undefined;
  if (population.traits) {
    traits = {};
    if (population.traits.riskTolerance) {
      traits.riskTolerance = sampleDistribution(population.traits.riskTolerance, rng);
    }
    if (population.traits.pricesSensitivity) {
      traits.priceSensitivity = sampleDistribution(population.traits.pricesSensitivity, rng);
    }
    if (population.traits.brandLoyalty) {
      traits.brandLoyalty = sampleDistribution(population.traits.brandLoyalty, rng);
    }
    if (population.traits.techAdoption) {
      traits.techAdoption = sampleDistribution(population.traits.techAdoption, rng);
    }
  }

  const id = `agent_${Math.random().toString(36).substring(2, 11)}`;

  return {
    id,
    demographics,
    traits,
    weight,
    description: generateDescription(demographics, traits),
  };
}

// Generate agent with conditional distributions for realistic correlations
// Uses P(income|education), P(techAdoption|age), P(riskTolerance|age,income), etc.
function generateAgentConditional(
  population: PopulationDefinition,
  rng: SeededRandom,
  filters?: SamplingOptions["filters"],
  weight = 1.0
): AgentProfile {
  const rngFn = () => rng.next();

  // Step 1: Sample independent demographics first
  const age = sampleDistribution(population.distributions.age, rng, filters?.age);
  const gender = sampleDistribution(population.distributions.gender, rng);
  const education = sampleDistribution(population.distributions.education, rng, filters?.education);
  const location = sampleDistribution(population.distributions.location, rng, filters?.location);
  const region = sampleDistribution(population.distributions.region, rng, filters?.region);

  // Step 2: Sample income conditionally on education (primary driver)
  // Blend P(income|education) with filters if present
  let income: string;
  if (filters?.income && filters.income.length > 0) {
    // If filtered, sample from filtered distribution
    income = sampleDistribution(population.distributions.income, rng, filters.income);
  } else {
    // Use conditional distribution P(income|education)
    income = sampleConditional(
      US_CENSUS_2022.conditionals.incomeGivenEducation,
      education,
      rngFn
    );
  }

  // Step 3: Sample employment conditionally on age
  let employment: string | undefined;
  if (population.distributions.employment) {
    employment = sampleConditional(
      US_CENSUS_2022.conditionals.employmentGivenAge,
      age,
      rngFn
    );
  }

  const householdSize = population.distributions.householdSize
    ? sampleDistribution(population.distributions.householdSize, rng)
    : undefined;

  const demographics: AgentProfile["demographics"] = {
    age,
    gender,
    income,
    education,
    location,
    region,
    employment,
    householdSize,
  };

  // Step 4: Sample traits conditionally
  let traits: AgentProfile["traits"] | undefined;
  if (population.traits) {
    traits = {};

    // Tech adoption conditional on age
    if (population.traits.techAdoption) {
      traits.techAdoption = sampleConditional(
        US_CENSUS_2022.conditionals.techAdoptionGivenAge,
        age,
        rngFn
      );
    }

    // Risk tolerance: blend age and income conditionals (50/50 weight)
    if (population.traits.riskTolerance) {
      // Sample from both conditionals and randomly pick one
      const riskFromAge = sampleConditional(
        US_CENSUS_2022.conditionals.riskToleranceGivenAge,
        age,
        rngFn
      );
      const riskFromIncome = sampleConditional(
        US_CENSUS_2022.conditionals.riskToleranceGivenIncome,
        income,
        rngFn
      );
      // Use age-based 60% of time, income-based 40%
      traits.riskTolerance = rng.next() < 0.6 ? riskFromAge : riskFromIncome;
    }

    // Price sensitivity and brand loyalty remain independent
    if (population.traits.pricesSensitivity) {
      traits.priceSensitivity = sampleDistribution(population.traits.pricesSensitivity, rng);
    }
    if (population.traits.brandLoyalty) {
      traits.brandLoyalty = sampleDistribution(population.traits.brandLoyalty, rng);
    }
  }

  const id = `agent_${Math.random().toString(36).substring(2, 11)}`;

  return {
    id,
    demographics,
    traits,
    weight,
    description: generateDescription(demographics, traits),
  };
}

// Generate a single agent profile (dispatches to conditional or independent)
function generateAgent(
  population: PopulationDefinition,
  rng: SeededRandom,
  filters?: SamplingOptions["filters"],
  weight = 1.0,
  useConditionals = true
): AgentProfile {
  if (useConditionals) {
    return generateAgentConditional(population, rng, filters, weight);
  }
  return generateAgentIndependent(population, rng, filters, weight);
}

// Generate archetype key from demographics for clustering
function getArchetypeKey(agent: AgentProfile): string {
  const d = agent.demographics;
  const t = agent.traits;
  // Cluster by: age, income, location, risk tolerance, price sensitivity
  return [
    d.age,
    d.income,
    d.location,
    t?.riskTolerance || "moderate",
    t?.priceSensitivity || "moderate",
  ].join("|");
}

// Cluster agents into archetypes to reduce LLM calls
function clusterIntoArchetypes(
  agents: AgentProfile[],
  maxArchetypes: number
): AgentProfile[] {
  // Group by archetype key
  const clusters = new Map<string, AgentProfile[]>();

  for (const agent of agents) {
    const key = getArchetypeKey(agent);
    const existing = clusters.get(key) || [];
    existing.push(agent);
    clusters.set(key, existing);
  }

  // If we have fewer clusters than max, return representatives
  if (clusters.size <= maxArchetypes) {
    return Array.from(clusters.entries()).map(([, group]) => {
      const representative = group[0];
      return {
        ...representative,
        weight: group.length / agents.length,
        id: `archetype_${Math.random().toString(36).substring(2, 11)}`,
      };
    });
  }

  // Otherwise, merge smallest clusters until we hit the limit
  // Sort by size (ascending) and merge smallest with most similar
  const sortedClusters = Array.from(clusters.entries())
    .map(([key, group]) => ({ key, group, size: group.length }))
    .sort((a, b) => a.size - b.size);

  while (sortedClusters.length > maxArchetypes) {
    // Remove smallest cluster
    const smallest = sortedClusters.shift()!;

    // Find most similar remaining cluster (by key similarity)
    let bestMatch = 0;
    let bestScore = -1;
    const smallestKeyParts = smallest.key.split("|");

    for (let i = 0; i < sortedClusters.length; i++) {
      const targetKeyParts = sortedClusters[i].key.split("|");
      let score = 0;
      for (let j = 0; j < smallestKeyParts.length; j++) {
        if (smallestKeyParts[j] === targetKeyParts[j]) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = i;
      }
    }

    // Merge into best match
    sortedClusters[bestMatch].group.push(...smallest.group);
    sortedClusters[bestMatch].size += smallest.size;

    // Re-sort
    sortedClusters.sort((a, b) => a.size - b.size);
  }

  // Return representatives with weights
  return sortedClusters.map(({ group }) => {
    const representative = group[0];
    return {
      ...representative,
      weight: group.length / agents.length,
      id: `archetype_${Math.random().toString(36).substring(2, 11)}`,
    };
  });
}

// Main sampling function
export function samplePopulation(options: SamplingOptions): SamplingResult {
  const {
    populationId,
    sampleSize,
    useArchetypes = false,
    archetypeCount = 50,
    filters,
    seed,
    useConditionals = true,
  } = options;

  const population = getPopulation(populationId);
  const rng = new SeededRandom(seed);

  // Generate raw agents
  const rawAgents: AgentProfile[] = [];
  for (let i = 0; i < sampleSize; i++) {
    rawAgents.push(generateAgent(population, rng, filters, 1.0, useConditionals));
  }

  let finalAgents: AgentProfile[];
  let effectiveSampleSize: number;

  if (useArchetypes && sampleSize > archetypeCount) {
    // Cluster into archetypes
    finalAgents = clusterIntoArchetypes(rawAgents, archetypeCount);
    effectiveSampleSize = sampleSize; // Weights sum to original sample
  } else {
    // Use all agents with equal weight
    finalAgents = rawAgents.map((a) => ({ ...a, weight: 1 / sampleSize }));
    effectiveSampleSize = sampleSize;
  }

  return {
    agents: finalAgents,
    metadata: {
      populationId,
      totalRequested: sampleSize,
      totalGenerated: finalAgents.length,
      useArchetypes,
      archetypeCount: useArchetypes ? archetypeCount : undefined,
      effectiveSampleSize,
      filtersApplied: !!filters && Object.keys(filters).length > 0,
      useConditionals,
    },
  };
}

// Helper: Sample a smaller representative set for quick testing
export function sampleQuick(
  populationId: string,
  size: number = 100
): AgentProfile[] {
  const result = samplePopulation({
    populationId,
    sampleSize: size,
    useArchetypes: true,
    archetypeCount: Math.min(50, size),
  });
  return result.agents;
}

// Helper: Calculate filter impact on population
export function calculateFilteredPopulationSize(
  populationId: string,
  filters: SamplingOptions["filters"]
): number {
  const population = getPopulation(populationId);
  let fraction = 1.0;

  if (filters?.age && filters.age.length > 0) {
    fraction *= filters.age.reduce(
      (sum, age) => sum + (population.distributions.age[age] || 0),
      0
    );
  }
  if (filters?.income && filters.income.length > 0) {
    fraction *= filters.income.reduce(
      (sum, inc) => sum + (population.distributions.income[inc] || 0),
      0
    );
  }
  if (filters?.education && filters.education.length > 0) {
    fraction *= filters.education.reduce(
      (sum, edu) => sum + (population.distributions.education[edu] || 0),
      0
    );
  }
  if (filters?.location && filters.location.length > 0) {
    fraction *= filters.location.reduce(
      (sum, loc) => sum + (population.distributions.location[loc] || 0),
      0
    );
  }
  if (filters?.region && filters.region.length > 0) {
    fraction *= filters.region.reduce(
      (sum, reg) => sum + (population.distributions.region[reg] || 0),
      0
    );
  }

  return Math.round(population.totalSize * fraction);
}
