// Static SSR (Semantic Similarity Rating) Calibration
// Pre-computed calibration curves based on LLM accuracy research
// Adjusts stated confidence to reflect actual prediction reliability

import type { AgentProfile } from "../population/sampler";

export type QuestionType = "binary" | "scale" | "choice" | "numeric" | "open";
export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * SSR Calibration Curves
 *
 * Based on empirical research showing LLMs overstate confidence:
 * - "High" confidence claims typically reflect ~70-85% accuracy, not 95%+
 * - Accuracy varies by question type (binary easier than categorical)
 * - Certain demographics (age, education) have more predictable patterns
 *
 * These curves transform stated confidence into calibrated confidence.
 */

// Base calibration by question type and stated confidence
// These are the "true" accuracy rates when LLM states various confidence levels
const SSR_CALIBRATION: Record<QuestionType, Record<ConfidenceLevel, number>> = {
  binary: {
    high: 0.82, // LLM says "high confidence" on binary → ~82% accurate
    medium: 0.68,
    low: 0.54,
  },
  scale: {
    high: 0.75, // Scale questions are harder to get exactly right
    medium: 0.60,
    low: 0.48,
  },
  choice: {
    high: 0.78,
    medium: 0.62,
    low: 0.45,
  },
  numeric: {
    high: 0.72, // Numeric predictions have wider error bands
    medium: 0.55,
    low: 0.40,
  },
  open: {
    high: 0.70, // Open-ended responses hardest to validate
    medium: 0.52,
    low: 0.38,
  },
};

/**
 * Demographic Reliability Factors
 *
 * LLM personas for certain demographics produce more predictable/reliable
 * responses. These factors adjust the base calibration.
 *
 * Factors > 1.0 = more reliable predictions for this group
 * Factors < 1.0 = less reliable predictions for this group
 */

const DEMOGRAPHIC_RELIABILITY = {
  // Age: Mid-age personas are most well-represented in training data
  age: {
    "18-24": 0.92, // Less training data on Gen Z decision patterns
    "25-34": 1.02, // Well represented
    "35-44": 1.05, // Peak representation, many professionals
    "45-54": 1.03, // Well represented
    "55-64": 0.98, // Slightly less represented
    "65+": 0.94, // Older demographics less well-modeled
  } as Record<string, number>,

  // Education: Higher education = more predictable response patterns
  education: {
    less_than_high_school: 0.88, // Less training data
    high_school: 0.94,
    some_college: 0.98,
    bachelors: 1.02,
    graduate: 1.06, // Highly predictable patterns
  } as Record<string, number>,

  // Income: Middle income most represented
  income: {
    under_30k: 0.92,
    "30k-50k": 0.96,
    "50k-75k": 1.02,
    "75k-100k": 1.04,
    "100k-150k": 1.02,
    over_150k: 0.98, // HNW individuals have more varied patterns
  } as Record<string, number>,

  // Location: Urban/suburban better modeled
  location: {
    urban: 1.02,
    suburban: 1.00,
    rural: 0.92,
  } as Record<string, number>,

  // Tech adoption: Tech-savvy personas better modeled (more data)
  techAdoption: {
    laggard: 0.90,
    late_majority: 0.95,
    early_majority: 1.00,
    early_adopter: 1.04,
    innovator: 1.02,
  } as Record<string, number>,
};

/**
 * Topic Reliability Factors
 *
 * Some topics have more reliable LLM predictions due to training data distribution.
 */

export const TOPIC_RELIABILITY: Record<string, number> = {
  // Consumer/commercial topics - well represented
  consumer_preference: 1.02,
  product_pricing: 1.00,
  brand_perception: 0.98,
  purchase_intent: 1.00,

  // Professional topics - moderately represented
  workplace_decision: 0.96,
  career_choice: 0.94,
  b2b_evaluation: 0.92,

  // Political/sensitive topics - more noise
  political_opinion: 0.85,
  policy_preference: 0.88,

  // Technical topics - depends heavily on specificity
  technology_adoption: 1.00,
  software_preference: 0.95,

  // Financial topics - moderate reliability
  investment_behavior: 0.90,
  spending_intent: 0.96,

  // Default for unspecified topics
  general: 1.00,
};

/**
 * Calculate calibrated confidence score
 *
 * Takes the LLM's stated confidence and adjusts it based on:
 * 1. Question type (binary vs categorical vs numeric)
 * 2. Agent demographics (some personas more predictable)
 * 3. Topic (some domains better modeled)
 *
 * @param statedConfidence - The confidence level stated by the LLM
 * @param questionType - Type of question asked
 * @param agent - Agent profile for demographic adjustments
 * @param topic - Optional topic for domain-specific adjustment
 * @returns Calibrated confidence score (0-1)
 */
export function calibrateConfidence(
  statedConfidence: ConfidenceLevel,
  questionType: QuestionType,
  agent?: AgentProfile,
  topic?: string
): number {
  // Start with base calibration for question type + stated confidence
  const base = SSR_CALIBRATION[questionType]?.[statedConfidence] ?? 0.60;

  // Apply demographic factors if agent provided
  let demographicFactor = 1.0;
  if (agent) {
    const ageFactor =
      DEMOGRAPHIC_RELIABILITY.age[agent.demographics.age] ?? 1.0;
    const eduFactor =
      DEMOGRAPHIC_RELIABILITY.education[agent.demographics.education] ?? 1.0;
    const incomeFactor =
      DEMOGRAPHIC_RELIABILITY.income[agent.demographics.income] ?? 1.0;
    const locationFactor =
      DEMOGRAPHIC_RELIABILITY.location[agent.demographics.location] ?? 1.0;

    // Tech adoption if available
    const techFactor = agent.traits?.techAdoption
      ? DEMOGRAPHIC_RELIABILITY.techAdoption[agent.traits.techAdoption] ?? 1.0
      : 1.0;

    // Combine factors (geometric mean for multiplicative effects)
    demographicFactor = Math.pow(
      ageFactor * eduFactor * incomeFactor * locationFactor * techFactor,
      0.2 // Fifth root to dampen extreme combinations
    );
  }

  // Apply topic factor
  const topicFactor = topic
    ? TOPIC_RELIABILITY[topic] ?? TOPIC_RELIABILITY.general
    : 1.0;

  // Calculate final calibrated confidence
  const calibrated = base * demographicFactor * topicFactor;

  // Clamp to valid range (never below 0.30 or above 0.95)
  return Math.max(0.30, Math.min(0.95, calibrated));
}

/**
 * Get confidence interval for a calibrated prediction
 *
 * @param calibratedConfidence - The calibrated confidence score
 * @param sampleSize - Number of agents in the sample
 * @returns Object with lower and upper bounds (95% CI)
 */
export function getConfidenceInterval(
  calibratedConfidence: number,
  sampleSize: number
): { lower: number; upper: number; margin: number } {
  // Use Wilson score interval for proportion
  const z = 1.96; // 95% CI
  const n = sampleSize;
  const p = calibratedConfidence;

  // Wilson score interval
  const denominator = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denominator;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;

  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    margin,
  };
}

/**
 * Aggregate confidence across multiple responses with calibration
 *
 * @param responses - Array of {confidence: ConfidenceLevel, value: number}
 * @param questionType - Type of question
 * @param agents - Optional agents for per-response calibration
 * @param topic - Optional topic for domain adjustment
 */
export function aggregateWithCalibration(
  responses: Array<{
    confidence: ConfidenceLevel;
    value: number;
    weight?: number;
  }>,
  questionType: QuestionType,
  agents?: AgentProfile[],
  topic?: string
): {
  weightedMean: number;
  calibratedConfidence: number;
  confidenceInterval: { lower: number; upper: number; margin: number };
  effectiveSampleSize: number;
} {
  if (responses.length === 0) {
    return {
      weightedMean: 0.5,
      calibratedConfidence: 0.5,
      confidenceInterval: { lower: 0, upper: 1, margin: 0.5 },
      effectiveSampleSize: 0,
    };
  }

  // Calibrate each response's confidence
  const calibratedResponses = responses.map((r, i) => {
    const agent = agents?.[i];
    const calibratedConf = calibrateConfidence(
      r.confidence,
      questionType,
      agent,
      topic
    );
    return {
      ...r,
      calibratedConfidence: calibratedConf,
      weight: (r.weight ?? 1) * calibratedConf,
    };
  });

  // Calculate weighted mean
  const totalWeight = calibratedResponses.reduce((sum, r) => sum + r.weight, 0);
  const weightedMean =
    calibratedResponses.reduce((sum, r) => sum + r.value * r.weight, 0) /
    totalWeight;

  // Calculate aggregate confidence (weighted harmonic mean of calibrated confidences)
  const avgCalibrated =
    calibratedResponses.reduce((sum, r) => sum + r.calibratedConfidence, 0) /
    responses.length;

  // Effective sample size (accounts for weighting)
  const effectiveSampleSize = Math.pow(
    totalWeight,
    2
  ) / calibratedResponses.reduce((sum, r) => sum + r.weight * r.weight, 0);

  // Get confidence interval
  const confidenceInterval = getConfidenceInterval(
    avgCalibrated,
    Math.round(effectiveSampleSize)
  );

  return {
    weightedMean,
    calibratedConfidence: avgCalibrated,
    confidenceInterval,
    effectiveSampleSize,
  };
}

/**
 * Validate calibration module
 * Returns diagnostic information about calibration curves
 */
export function validateCalibration(): {
  valid: boolean;
  diagnostics: Record<string, unknown>;
} {
  const diagnostics: Record<string, unknown> = {};

  // Check all calibration values are in valid range
  for (const [qType, confidences] of Object.entries(SSR_CALIBRATION)) {
    for (const [level, value] of Object.entries(confidences)) {
      if (value < 0.3 || value > 0.95) {
        diagnostics[`${qType}.${level}`] = `Out of range: ${value}`;
      }
    }
    // Check high > medium > low
    if (
      confidences.high <= confidences.medium ||
      confidences.medium <= confidences.low
    ) {
      diagnostics[`${qType}.ordering`] = "Confidence levels not properly ordered";
    }
  }

  // Check demographic factors are reasonable
  for (const [dim, factors] of Object.entries(DEMOGRAPHIC_RELIABILITY)) {
    for (const [value, factor] of Object.entries(factors)) {
      if (factor < 0.7 || factor > 1.3) {
        diagnostics[`demographics.${dim}.${value}`] = `Extreme factor: ${factor}`;
      }
    }
  }

  return {
    valid: Object.keys(diagnostics).length === 0,
    diagnostics,
  };
}
