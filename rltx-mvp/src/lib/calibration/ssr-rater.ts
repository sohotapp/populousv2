// SSR (Semantic Similarity Rating) Calibration
// Converts free-text LLM responses into calibrated probability distributions
//
// The SSR algorithm:
// 1. Define anchor statements for each rating category
// 2. Embed the response and all anchors using OpenAI embeddings
// 3. Compute cosine similarity between response and each anchor
// 4. Convert similarities to probability mass function (PMF)
// 5. Average across multiple anchor sets for stability
//
// Research shows this achieves KS similarity >0.85 to human distributions
// (vs ~0.26 for direct LLM ratings that cluster around neutral)

import { embed, embedBatch, cosineSimilarity, getEmbeddingsClient } from "./embeddings";
import {
  AnchorSet,
  VOTE_ANCHORS,
  POLICY_SUPPORT_ANCHORS,
  CANDIDATE_SUPPORT_ANCHORS,
  flattenAnchors,
} from "./anchors/political";

// =============================================================================
// TYPES
// =============================================================================

export type PMF = Record<string, number>; // Probability mass function

export interface SSRResult {
  pmf: PMF;
  topCategory: string;
  confidence: number;
  similarities: Record<string, number>;
  reasoning: string;
}

export interface SSRConfig {
  temperature?: number; // Sharpness of distribution (default 1.0)
  minProbability?: number; // Minimum probability mass per category (default 0.01)
  anchorSets?: AnchorSet[]; // Custom anchor sets to use
}

// =============================================================================
// ANCHOR EMBEDDING CACHE
// Pre-embed all anchor statements on first use
// =============================================================================

const anchorEmbeddingCache = new Map<string, Map<string, number[]>>();

async function getAnchorEmbeddings(anchorSet: AnchorSet): Promise<Map<string, number[]>> {
  const cacheKey = anchorSet.id;

  if (anchorEmbeddingCache.has(cacheKey)) {
    return anchorEmbeddingCache.get(cacheKey)!;
  }

  console.log(`[SSR] Computing embeddings for anchor set: ${anchorSet.id}`);

  // Flatten all anchor texts
  const flat = flattenAnchors(anchorSet);
  const texts = flat.map((f) => f.text);

  // Batch embed all anchors
  const embeddings = await embedBatch(texts);

  // Store in cache
  anchorEmbeddingCache.set(cacheKey, embeddings);

  return embeddings;
}

// =============================================================================
// SSR RATER CLASS
// =============================================================================

export class SSRRater {
  private config: Required<SSRConfig>;
  private embeddingsClient = getEmbeddingsClient();

  constructor(config: SSRConfig = {}) {
    this.config = {
      temperature: config.temperature ?? 1.0,
      minProbability: config.minProbability ?? 0.01,
      anchorSets: config.anchorSets ?? [VOTE_ANCHORS],
    };
  }

  /**
   * Rate a free-text response and convert to probability distribution
   */
  async rate(response: string): Promise<SSRResult> {
    // Embed the response
    const responseEmbedding = await embed(response);

    // Process each anchor set
    const allResults: SSRResult[] = [];

    for (const anchorSet of this.config.anchorSets) {
      const result = await this.rateWithAnchorSet(
        response,
        responseEmbedding,
        anchorSet
      );
      allResults.push(result);
    }

    // Average across anchor sets for stability
    if (allResults.length === 1) {
      return allResults[0];
    }

    return this.averageResults(allResults);
  }

  /**
   * Rate against a specific anchor set
   */
  private async rateWithAnchorSet(
    response: string,
    responseEmbedding: number[],
    anchorSet: AnchorSet
  ): Promise<SSRResult> {
    // Get anchor embeddings (cached)
    const anchorEmbeddings = await getAnchorEmbeddings(anchorSet);

    // Compute similarity to each category
    const categorySimilarities: Record<string, number[]> = {};
    for (const category of anchorSet.scale) {
      categorySimilarities[category] = [];
    }

    // Flatten anchors and compute similarities
    const flat = flattenAnchors(anchorSet);
    for (const { category, text } of flat) {
      const anchorEmb = anchorEmbeddings.get(text);
      if (anchorEmb) {
        const sim = cosineSimilarity(responseEmbedding, anchorEmb);
        categorySimilarities[category].push(sim);
      }
    }

    // Average similarities within each category
    const avgSimilarities: Record<string, number> = {};
    for (const [category, sims] of Object.entries(categorySimilarities)) {
      avgSimilarities[category] =
        sims.length > 0
          ? sims.reduce((a, b) => a + b, 0) / sims.length
          : 0;
    }

    // Convert similarities to PMF
    const pmf = this.similarityToPMF(avgSimilarities);

    // Find top category
    let topCategory = anchorSet.scale[0];
    let maxProb = 0;
    for (const [category, prob] of Object.entries(pmf)) {
      if (prob > maxProb) {
        maxProb = prob;
        topCategory = category;
      }
    }

    // Compute confidence (how peaked is the distribution)
    const entropy = this.computeEntropy(pmf);
    const maxEntropy = Math.log(Object.keys(pmf).length);
    const confidence = 1 - entropy / maxEntropy;

    return {
      pmf,
      topCategory,
      confidence,
      similarities: avgSimilarities,
      reasoning: response.slice(0, 200),
    };
  }

  /**
   * Convert similarity scores to probability mass function
   */
  private similarityToPMF(similarities: Record<string, number>): PMF {
    const pmf: PMF = {};

    // Get values and apply temperature
    const values = Object.values(similarities);
    const minSim = Math.min(...values);

    // Subtract minimum to create contrast (key insight from SSR research)
    const adjusted: Record<string, number> = {};
    for (const [category, sim] of Object.entries(similarities)) {
      adjusted[category] = Math.max(0, sim - minSim);
    }

    // Apply temperature scaling (higher temp = more uniform, lower = more peaked)
    const scaled: Record<string, number> = {};
    for (const [category, val] of Object.entries(adjusted)) {
      scaled[category] = Math.exp(val / this.config.temperature);
    }

    // Normalize to sum to 1
    const total = Object.values(scaled).reduce((a, b) => a + b, 0);
    for (const [category, val] of Object.entries(scaled)) {
      pmf[category] = Math.max(this.config.minProbability, val / total);
    }

    // Re-normalize after applying minimum
    const newTotal = Object.values(pmf).reduce((a, b) => a + b, 0);
    for (const category of Object.keys(pmf)) {
      pmf[category] /= newTotal;
    }

    return pmf;
  }

  /**
   * Compute Shannon entropy of distribution
   */
  private computeEntropy(pmf: PMF): number {
    let entropy = 0;
    for (const p of Object.values(pmf)) {
      if (p > 0) {
        entropy -= p * Math.log(p);
      }
    }
    return entropy;
  }

  /**
   * Average results across multiple anchor sets
   */
  private averageResults(results: SSRResult[]): SSRResult {
    const categories = Object.keys(results[0].pmf);
    const avgPmf: PMF = {};
    const avgSimilarities: Record<string, number> = {};

    for (const category of categories) {
      avgPmf[category] = 0;
      avgSimilarities[category] = 0;
    }

    // Sum up values
    for (const result of results) {
      for (const category of categories) {
        avgPmf[category] += result.pmf[category] ?? 0;
        avgSimilarities[category] += result.similarities[category] ?? 0;
      }
    }

    // Average
    const n = results.length;
    for (const category of categories) {
      avgPmf[category] /= n;
      avgSimilarities[category] /= n;
    }

    // Re-normalize PMF
    const total = Object.values(avgPmf).reduce((a, b) => a + b, 0);
    for (const category of categories) {
      avgPmf[category] /= total;
    }

    // Find top category
    let topCategory = categories[0];
    let maxProb = 0;
    for (const [category, prob] of Object.entries(avgPmf)) {
      if (prob > maxProb) {
        maxProb = prob;
        topCategory = category;
      }
    }

    // Average confidence
    const avgConfidence =
      results.reduce((sum, r) => sum + r.confidence, 0) / n;

    return {
      pmf: avgPmf,
      topCategory,
      confidence: avgConfidence,
      similarities: avgSimilarities,
      reasoning: results[0].reasoning,
    };
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Create a vote rater (yes/no/undecided)
 */
export function createVoteRater(config?: SSRConfig): SSRRater {
  return new SSRRater({
    ...config,
    anchorSets: [VOTE_ANCHORS],
  });
}

/**
 * Create a policy support rater (5-point scale)
 */
export function createPolicyRater(config?: SSRConfig): SSRRater {
  return new SSRRater({
    ...config,
    anchorSets: [POLICY_SUPPORT_ANCHORS],
  });
}

/**
 * Create a candidate support rater
 */
export function createCandidateRater(config?: SSRConfig): SSRRater {
  return new SSRRater({
    ...config,
    anchorSets: [CANDIDATE_SUPPORT_ANCHORS],
  });
}

// =============================================================================
// BINARY VOTE CONVERSION
// Convert 5-point scale to binary yes/no with probability
// =============================================================================

export interface BinaryVote {
  vote: "yes" | "no";
  probability: number;
  confidence: number;
}

export function pmfToBinaryVote(pmf: PMF): BinaryVote {
  // Map scale to yes/no
  // strong_yes, lean_yes → yes
  // strong_no, lean_no → no
  // undecided → split proportionally

  const yesWeight =
    (pmf.strong_yes ?? 0) +
    (pmf.lean_yes ?? 0) +
    (pmf.undecided ?? 0) * 0.5;

  const noWeight =
    (pmf.strong_no ?? 0) +
    (pmf.lean_no ?? 0) +
    (pmf.undecided ?? 0) * 0.5;

  const total = yesWeight + noWeight;
  const pYes = total > 0 ? yesWeight / total : 0.5;

  // Confidence based on how far from 0.5
  const confidence = Math.abs(pYes - 0.5) * 2;

  return {
    vote: pYes >= 0.5 ? "yes" : "no",
    probability: pYes,
    confidence,
  };
}

// =============================================================================
// AGGREGATE PMFs
// Combine multiple agent PMFs into overall distribution
// =============================================================================

export interface AggregatedResult {
  distribution: PMF;
  binaryOutcome: BinaryVote;
  breakdown: {
    yesCount: number;
    noCount: number;
    undecidedCount: number;
  };
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  swingVotes: Array<{
    agentId: string;
    probability: number;
    reasoning: string;
  }>;
}

export function aggregatePMFs(
  results: Array<{ agentId: string; result: SSRResult }>
): AggregatedResult {
  const n = results.length;
  if (n === 0) {
    return {
      distribution: {},
      binaryOutcome: { vote: "yes", probability: 0.5, confidence: 0 },
      breakdown: { yesCount: 0, noCount: 0, undecidedCount: 0 },
      confidenceInterval: { lower: 0, upper: 1 },
      swingVotes: [],
    };
  }

  // Initialize with first result's categories
  const distribution: PMF = {};
  const categories = Object.keys(results[0].result.pmf);
  for (const cat of categories) {
    distribution[cat] = 0;
  }

  // Sum up probabilities
  const binaryVotes: BinaryVote[] = [];
  const swingVotes: AggregatedResult["swingVotes"] = [];

  let yesCount = 0;
  let noCount = 0;
  let undecidedCount = 0;

  for (const { agentId, result } of results) {
    // Add to distribution
    for (const [cat, prob] of Object.entries(result.pmf)) {
      distribution[cat] = (distribution[cat] ?? 0) + prob;
    }

    // Get binary vote
    const binary = pmfToBinaryVote(result.pmf);
    binaryVotes.push(binary);

    // Count
    if (binary.probability > 0.6) {
      yesCount++;
    } else if (binary.probability < 0.4) {
      noCount++;
    } else {
      undecidedCount++;
      swingVotes.push({
        agentId,
        probability: binary.probability,
        reasoning: result.reasoning,
      });
    }
  }

  // Average distribution
  for (const cat of categories) {
    distribution[cat] /= n;
  }

  // Overall binary outcome
  const overallPYes =
    binaryVotes.reduce((sum, v) => sum + v.probability, 0) / n;

  // Confidence interval (Wilson score)
  const z = 1.96;
  const p = overallPYes;
  const denominator = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denominator;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;

  return {
    distribution,
    binaryOutcome: {
      vote: overallPYes >= 0.5 ? "yes" : "no",
      probability: overallPYes,
      confidence: Math.abs(overallPYes - 0.5) * 2,
    },
    breakdown: {
      yesCount,
      noCount,
      undecidedCount,
    },
    confidenceInterval: {
      lower: Math.max(0, center - margin),
      upper: Math.min(1, center + margin),
    },
    swingVotes: swingVotes.sort(
      (a, b) => Math.abs(0.5 - a.probability) - Math.abs(0.5 - b.probability)
    ),
  };
}
