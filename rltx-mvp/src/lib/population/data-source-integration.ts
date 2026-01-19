/**
 * Data Source Integration for Population Sampling
 * 
 * Connects first-party data sources to the population sampler.
 * Extracts trait distributions from connected sources and uses them
 * to create more accurate agent populations.
 */

import { db, populationIndices, dataSources, fieldMappings, syncedRecords } from "@/db";
import { eq, and } from "drizzle-orm";
import type { TraitDistribution, AgentTraits } from "@/db/schema";

export interface DataSourceDistributions {
  sourceId: string;
  sourceName: string;
  streamName: string;
  distributions: Record<string, TraitDistribution>;
  totalRecords: number;
  completeRecords: number;
  traitCoverage: Record<string, number>;
  lastUpdated: string;
}

export interface FirstPartyPopulationConfig {
  sourceId: string;
  streamName: string;
  // Optional: blend with census data (0 = all first-party, 1 = all census)
  censusBlendRatio?: number;
  // Optional: minimum coverage threshold for using first-party data
  minCoverageThreshold?: number;
}

/**
 * Get available population indices from connected data sources
 */
export async function getAvailableDataSourcePopulations(): Promise<DataSourceDistributions[]> {
  if (!db) {
    console.warn("[data-source-integration] No database connection");
    return [];
  }

  try {
    const indices = await db
      .select({
        id: populationIndices.id,
        sourceId: populationIndices.sourceId,
        streamName: populationIndices.streamName,
        name: populationIndices.name,
        distributions: populationIndices.distributions,
        totalRecords: populationIndices.totalRecords,
        completeRecords: populationIndices.completeRecords,
        traitCoverage: populationIndices.traitCoverage,
        builtAt: populationIndices.builtAt,
        status: populationIndices.status,
      })
      .from(populationIndices)
      .where(eq(populationIndices.status, "ready"));

    // Get source names
    const results: DataSourceDistributions[] = [];
    for (const index of indices) {
      const sources = await db
        .select({ name: dataSources.name })
        .from(dataSources)
        .where(eq(dataSources.id, index.sourceId))
        .limit(1);

      results.push({
        sourceId: index.sourceId,
        sourceName: sources[0]?.name || "Unknown Source",
        streamName: index.streamName,
        distributions: (index.distributions as Record<string, TraitDistribution>) || {},
        totalRecords: index.totalRecords,
        completeRecords: index.completeRecords,
        traitCoverage: (index.traitCoverage as Record<string, number>) || {},
        lastUpdated: index.builtAt?.toISOString() || "",
      });
    }

    return results;
  } catch (error) {
    console.error("[data-source-integration] Failed to get populations:", error);
    return [];
  }
}

/**
 * Build trait distributions from synced records
 */
export async function buildDistributionsFromSource(
  sourceId: string,
  streamName: string
): Promise<Record<string, TraitDistribution>> {
  if (!db) {
    throw new Error("Database connection required");
  }

  // Get field mappings for this source
  const mappings = await db
    .select()
    .from(fieldMappings)
    .where(
      and(
        eq(fieldMappings.sourceId, sourceId),
        eq(fieldMappings.streamName, streamName)
      )
    );

  if (mappings.length === 0) {
    throw new Error(`No field mappings found for source ${sourceId}, stream ${streamName}`);
  }

  // Get synced records
  const records = await db
    .select()
    .from(syncedRecords)
    .where(
      and(
        eq(syncedRecords.sourceId, sourceId),
        eq(syncedRecords.streamName, streamName)
      )
    );

  if (records.length === 0) {
    throw new Error(`No synced records found for source ${sourceId}, stream ${streamName}`);
  }

  // Build distributions for each mapped trait
  const distributions: Record<string, TraitDistribution> = {};

  for (const mapping of mappings) {
    const traitName = mapping.targetTrait;
    const sourceField = mapping.sourceField;
    const transformType = mapping.transformType;

    // Count values
    const valueCounts: Record<string, number> = {};
    let totalCount = 0;

    for (const record of records) {
      const rawData = record.rawData as Record<string, unknown>;
      let value = getNestedValue(rawData, sourceField);

      // Apply transformation
      value = applyTransform(value, transformType, mapping.transformConfig as Record<string, unknown> | undefined);

      if (value !== null && value !== undefined && value !== "") {
        const strValue = String(value);
        valueCounts[strValue] = (valueCounts[strValue] || 0) + 1;
        totalCount++;
      }
    }

    // Convert to distribution
    if (totalCount > 0) {
      const distribution: TraitDistribution = {};
      for (const [value, count] of Object.entries(valueCounts)) {
        distribution[value] = {
          count,
          percentage: count / totalCount,
        };
      }
      distributions[traitName] = distribution;
    }
  }

  return distributions;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Apply transformation to raw value
 */
function applyTransform(
  value: unknown,
  transformType: string,
  config?: Record<string, unknown>
): unknown {
  if (value === null || value === undefined) return null;

  switch (transformType) {
    case "direct":
      return value;

    case "date_to_age": {
      // Convert date to age bucket
      const date = new Date(String(value));
      if (isNaN(date.getTime())) return null;
      const age = Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      return ageToAgeBucket(age);
    }

    case "income_to_bracket": {
      // Convert numeric income to bracket
      const income = Number(value);
      if (isNaN(income)) return null;
      return incomeToIncomeBucket(income);
    }

    case "map_values": {
      // Map source values to target values
      const mapping = (config?.mapping || {}) as Record<string, string>;
      return mapping[String(value)] || value;
    }

    case "lowercase":
      return String(value).toLowerCase();

    case "uppercase":
      return String(value).toUpperCase();

    case "boolean_to_string":
      return value ? "yes" : "no";

    default:
      return value;
  }
}

/**
 * Convert age to standard age bucket
 */
function ageToAgeBucket(age: number): string {
  if (age < 18) return "under_18";
  if (age < 25) return "18-24";
  if (age < 35) return "25-34";
  if (age < 45) return "35-44";
  if (age < 55) return "45-54";
  if (age < 65) return "55-64";
  return "65+";
}

/**
 * Convert income to standard income bucket
 */
function incomeToIncomeBucket(income: number): string {
  if (income < 25000) return "<25k";
  if (income < 50000) return "25-50k";
  if (income < 75000) return "50-75k";
  if (income < 100000) return "75-100k";
  if (income < 150000) return "100-150k";
  return ">150k";
}

/**
 * Blend first-party distributions with census data
 */
export function blendDistributions(
  firstParty: Record<string, TraitDistribution>,
  census: Record<string, Record<string, number>>,
  blendRatio: number = 0.5 // 0 = all first-party, 1 = all census
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};

  // Get all trait names from both sources
  const allTraits = new Set([...Object.keys(firstParty), ...Object.keys(census)]);

  for (const trait of allTraits) {
    const fpDist = firstParty[trait];
    const censusDist = census[trait];

    if (!fpDist && censusDist) {
      // Only census data available
      result[trait] = censusDist;
    } else if (fpDist && !censusDist) {
      // Only first-party data available
      result[trait] = {};
      for (const [value, data] of Object.entries(fpDist)) {
        result[trait][value] = data.percentage;
      }
    } else if (fpDist && censusDist) {
      // Blend both
      result[trait] = {};
      const allValues = new Set([...Object.keys(fpDist), ...Object.keys(censusDist)]);

      for (const value of allValues) {
        const fpProb = fpDist[value]?.percentage || 0;
        const censusProb = censusDist[value] || 0;
        result[trait][value] = fpProb * (1 - blendRatio) + censusProb * blendRatio;
      }

      // Normalize
      const total = Object.values(result[trait]).reduce((sum, p) => sum + p, 0);
      if (total > 0) {
        for (const value of Object.keys(result[trait])) {
          result[trait][value] /= total;
        }
      }
    }
  }

  return result;
}

/**
 * Convert TraitDistribution to simple probability distribution
 */
export function traitDistributionToProbs(
  dist: TraitDistribution
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [value, data] of Object.entries(dist)) {
    result[value] = data.percentage;
  }
  return result;
}

/**
 * Calculate trait coverage for a population index
 */
export function calculateTraitCoverage(
  distributions: Record<string, TraitDistribution>,
  requiredTraits: string[]
): Record<string, number> {
  const coverage: Record<string, number> = {};

  for (const trait of requiredTraits) {
    const dist = distributions[trait];
    if (dist) {
      // Calculate coverage as percentage of records with this trait
      const totalCount = Object.values(dist).reduce((sum, d) => sum + d.count, 0);
      coverage[trait] = totalCount > 0 ? 1 : 0;
    } else {
      coverage[trait] = 0;
    }
  }

  return coverage;
}

/**
 * Standard RLTX traits that can be mapped from data sources
 */
export const STANDARD_TRAITS = [
  // Demographics
  "age",
  "gender",
  "income",
  "education",
  "location",
  "region",
  "employment",
  "household_size",
  // Psychographics
  "risk_tolerance",
  "price_sensitivity",
  "brand_loyalty",
  "tech_adoption",
  // Custom
  "industry",
  "role",
  "company_size",
  "years_experience",
] as const;

export type StandardTrait = (typeof STANDARD_TRAITS)[number];

/**
 * Suggest field mappings based on field names and sample data
 */
export function suggestFieldMappings(
  fields: Array<{ name: string; type: string; sample?: unknown }>
): Array<{
  sourceField: string;
  suggestedTrait: StandardTrait | null;
  suggestedTransform: string;
  confidence: number;
}> {
  const suggestions: Array<{
    sourceField: string;
    suggestedTrait: StandardTrait | null;
    suggestedTransform: string;
    confidence: number;
  }> = [];

  const fieldPatterns: Array<{
    pattern: RegExp;
    trait: StandardTrait;
    transform: string;
    confidence: number;
  }> = [
    // Age patterns
    { pattern: /^(age|birth_?date|dob|date_?of_?birth)$/i, trait: "age", transform: "date_to_age", confidence: 0.9 },
    { pattern: /age/i, trait: "age", transform: "direct", confidence: 0.7 },

    // Gender patterns
    { pattern: /^(gender|sex)$/i, trait: "gender", transform: "lowercase", confidence: 0.95 },

    // Income patterns
    { pattern: /^(income|salary|annual_?income|household_?income)$/i, trait: "income", transform: "income_to_bracket", confidence: 0.9 },
    { pattern: /income/i, trait: "income", transform: "income_to_bracket", confidence: 0.7 },

    // Education patterns
    { pattern: /^(education|education_?level|degree)$/i, trait: "education", transform: "direct", confidence: 0.9 },

    // Location patterns
    { pattern: /^(city|location|location_?type)$/i, trait: "location", transform: "direct", confidence: 0.8 },
    { pattern: /^(state|region|country)$/i, trait: "region", transform: "direct", confidence: 0.8 },

    // Employment patterns
    { pattern: /^(employment|employment_?status|job_?status)$/i, trait: "employment", transform: "direct", confidence: 0.9 },

    // Industry patterns
    { pattern: /^(industry|sector|vertical)$/i, trait: "industry", transform: "direct", confidence: 0.9 },

    // Role patterns
    { pattern: /^(role|title|job_?title|position)$/i, trait: "role", transform: "direct", confidence: 0.85 },

    // Company size patterns
    { pattern: /^(company_?size|org_?size|employees)$/i, trait: "company_size", transform: "direct", confidence: 0.85 },
  ];

  for (const field of fields) {
    let bestMatch: {
      trait: StandardTrait | null;
      transform: string;
      confidence: number;
    } = { trait: null, transform: "direct", confidence: 0 };

    for (const pattern of fieldPatterns) {
      if (pattern.pattern.test(field.name) && pattern.confidence > bestMatch.confidence) {
        bestMatch = {
          trait: pattern.trait,
          transform: pattern.transform,
          confidence: pattern.confidence,
        };
      }
    }

    suggestions.push({
      sourceField: field.name,
      suggestedTrait: bestMatch.trait,
      suggestedTransform: bestMatch.transform,
      confidence: bestMatch.confidence,
    });
  }

  return suggestions;
}
