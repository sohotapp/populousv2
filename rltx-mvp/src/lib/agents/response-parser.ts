// Agent Response Parser
// Parses LLM responses into structured data for aggregation

import { QuestionType } from "./prompt-compiler";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ParsedResponse {
  // The parsed answer value
  value: string | number | boolean;
  // Normalized numeric value (0-1) for aggregation
  normalizedValue: number;
  // Confidence level
  confidence: ConfidenceLevel;
  // Numeric confidence (0-1) for weighting
  confidenceScore: number;
  // Reasoning text
  reasoning: string;
  // Whether parsing succeeded
  success: boolean;
  // Raw response for debugging
  raw: string;
  // Parse errors if any
  errors?: string[];
}

export interface ParseOptions {
  questionType: QuestionType;
  // For scale questions
  scaleMin?: number;
  scaleMax?: number;
  // For choice questions
  options?: string[];
  // For numeric questions
  numericMin?: number;
  numericMax?: number;
}

// Convert confidence text to score
function parseConfidence(text: string): { level: ConfidenceLevel; score: number } {
  const normalized = text.toLowerCase().trim();

  if (normalized.includes("high") || normalized.includes("very confident")) {
    return { level: "high", score: 0.9 };
  }
  if (normalized.includes("low") || normalized.includes("not confident") || normalized.includes("uncertain")) {
    return { level: "low", score: 0.5 };
  }
  // Default to medium
  return { level: "medium", score: 0.7 };
}

// Extract value using regex patterns
function extractField(text: string, field: string): string | null {
  // Try "Field: value" format
  const colonPattern = new RegExp(`${field}:\\s*(.+?)(?:\\n|$)`, "i");
  const colonMatch = text.match(colonPattern);
  if (colonMatch) {
    return colonMatch[1].trim();
  }

  // Try "Field - value" format
  const dashPattern = new RegExp(`${field}\\s*[-–]\\s*(.+?)(?:\\n|$)`, "i");
  const dashMatch = text.match(dashPattern);
  if (dashMatch) {
    return dashMatch[1].trim();
  }

  return null;
}

// Parse binary (yes/no) response
function parseBinary(text: string): Partial<ParsedResponse> {
  const answer = extractField(text, "Answer");

  if (!answer) {
    return { success: false, errors: ["Could not extract Answer field"] };
  }

  const normalized = answer.toLowerCase();
  let value: boolean;
  let normalizedValue: number;

  if (normalized.includes("yes") || normalized.includes("true") || normalized === "y") {
    value = true;
    normalizedValue = 1.0;
  } else if (normalized.includes("no") || normalized.includes("false") || normalized === "n") {
    value = false;
    normalizedValue = 0.0;
  } else {
    return { success: false, errors: [`Invalid binary answer: "${answer}"`] };
  }

  return { value, normalizedValue, success: true };
}

// Parse scale response
function parseScale(
  text: string,
  min: number = 1,
  max: number = 10
): Partial<ParsedResponse> {
  const rating = extractField(text, "Rating");

  if (!rating) {
    return { success: false, errors: ["Could not extract Rating field"] };
  }

  // Extract number from rating
  const numMatch = rating.match(/(\d+(?:\.\d+)?)/);
  if (!numMatch) {
    return { success: false, errors: [`Could not parse number from rating: "${rating}"`] };
  }

  const value = parseFloat(numMatch[1]);

  // Clamp to valid range
  const clampedValue = Math.max(min, Math.min(max, value));

  // Normalize to 0-1
  const normalizedValue = (clampedValue - min) / (max - min);

  return { value: clampedValue, normalizedValue, success: true };
}

// Parse choice response
function parseChoice(text: string, options?: string[]): Partial<ParsedResponse> {
  const choice = extractField(text, "Choice");

  if (!choice) {
    return { success: false, errors: ["Could not extract Choice field"] };
  }

  // If options provided, validate and find best match
  if (options && options.length > 0) {
    const normalizedChoice = choice.toLowerCase().trim();

    // Exact match
    const exactMatch = options.find(
      (opt) => opt.toLowerCase() === normalizedChoice
    );
    if (exactMatch) {
      const index = options.indexOf(exactMatch);
      return {
        value: exactMatch,
        normalizedValue: index / (options.length - 1),
        success: true,
      };
    }

    // Partial match
    const partialMatch = options.find(
      (opt) => normalizedChoice.includes(opt.toLowerCase()) ||
               opt.toLowerCase().includes(normalizedChoice)
    );
    if (partialMatch) {
      const index = options.indexOf(partialMatch);
      return {
        value: partialMatch,
        normalizedValue: index / (options.length - 1),
        success: true,
      };
    }

    return {
      success: false,
      errors: [`Choice "${choice}" not in valid options: ${options.join(", ")}`],
    };
  }

  // No options to validate against
  return { value: choice, normalizedValue: 0.5, success: true };
}

// Parse numeric response
function parseNumeric(
  text: string,
  min?: number,
  max?: number
): Partial<ParsedResponse> {
  const valueStr = extractField(text, "Value");

  if (!valueStr) {
    return { success: false, errors: ["Could not extract Value field"] };
  }

  // Extract number, handling commas and currency symbols
  const cleaned = valueStr.replace(/[$,]/g, "");
  const numMatch = cleaned.match(/-?(\d+(?:\.\d+)?)/);

  if (!numMatch) {
    return { success: false, errors: [`Could not parse number from value: "${valueStr}"`] };
  }

  const value = parseFloat(numMatch[1]);

  // Calculate normalized value if bounds provided
  let normalizedValue = 0.5;
  if (min !== undefined && max !== undefined && max > min) {
    normalizedValue = Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  return { value, normalizedValue, success: true };
}

// Parse open-ended response
function parseOpen(text: string): Partial<ParsedResponse> {
  const response = extractField(text, "Response");

  if (!response) {
    // Try to extract any substantive text as response
    const lines = text.split("\n").filter((l) => l.trim().length > 10);
    if (lines.length > 0) {
      return {
        value: lines[0].trim(),
        normalizedValue: 0.5,
        success: true,
      };
    }
    return { success: false, errors: ["Could not extract Response field"] };
  }

  return { value: response, normalizedValue: 0.5, success: true };
}

// Main parsing function
export function parseResponse(
  rawResponse: string,
  options: ParseOptions
): ParsedResponse {
  const errors: string[] = [];

  // Extract confidence first (common to all types)
  const confidenceStr = extractField(rawResponse, "Confidence") || "medium";
  const { level: confidence, score: confidenceScore } = parseConfidence(confidenceStr);

  // Extract reasoning
  const reasoning = extractField(rawResponse, "Reasoning") ||
                    extractField(rawResponse, "Explanation") ||
                    "";

  // Parse based on question type
  let parsed: Partial<ParsedResponse>;

  switch (options.questionType) {
    case "binary":
      parsed = parseBinary(rawResponse);
      break;
    case "scale":
      parsed = parseScale(rawResponse, options.scaleMin, options.scaleMax);
      break;
    case "choice":
      parsed = parseChoice(rawResponse, options.options);
      break;
    case "numeric":
      parsed = parseNumeric(rawResponse, options.numericMin, options.numericMax);
      break;
    case "open":
      parsed = parseOpen(rawResponse);
      break;
    default:
      parsed = { success: false, errors: [`Unknown question type: ${options.questionType}`] };
  }

  if (parsed.errors) {
    errors.push(...parsed.errors);
  }

  return {
    value: parsed.value ?? "",
    normalizedValue: parsed.normalizedValue ?? 0.5,
    confidence,
    confidenceScore,
    reasoning,
    success: parsed.success ?? false,
    raw: rawResponse,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Aggregate multiple parsed responses into a distribution
export interface AggregatedResult {
  // For binary: proportion yes
  // For scale/numeric: weighted mean
  // For choice: winner
  mean: number;
  std: number;
  // Distribution breakdown
  distribution: {
    yes?: number; // For binary
    no?: number;
    options?: Record<string, number>; // For choice
    histogram?: number[]; // For scale/numeric (10 buckets)
  };
  // Confidence-weighted metrics
  weightedMean: number;
  totalWeight: number;
  // Sample breakdown
  sampleSize: number;
  successfulParses: number;
  // Confidence breakdown
  confidenceBreakdown: {
    high: number;
    medium: number;
    low: number;
  };
}

export function aggregateResponses(
  responses: ParsedResponse[],
  weights?: number[]
): AggregatedResult {
  const successful = responses.filter((r) => r.success);
  const n = successful.length;

  if (n === 0) {
    return {
      mean: 0,
      std: 0,
      distribution: {},
      weightedMean: 0,
      totalWeight: 0,
      sampleSize: responses.length,
      successfulParses: 0,
      confidenceBreakdown: { high: 0, medium: 0, low: 0 },
    };
  }

  // Calculate weights
  const agentWeights = weights || successful.map(() => 1 / n);
  const confidenceWeights = successful.map(
    (r, i) => r.confidenceScore * (agentWeights[i] || 1 / n)
  );
  const totalWeight = confidenceWeights.reduce((a, b) => a + b, 0);

  // Calculate mean and weighted mean
  const values = successful.map((r) => r.normalizedValue);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const weightedMean = values.reduce(
    (sum, v, i) => sum + v * confidenceWeights[i],
    0
  ) / totalWeight;

  // Calculate standard deviation
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const std = Math.sqrt(variance);

  // Build distribution
  const distribution: AggregatedResult["distribution"] = {};

  // For binary questions
  const binaryYes = successful.filter((r) => r.value === true).length;
  if (binaryYes > 0 || successful.some((r) => r.value === false)) {
    distribution.yes = binaryYes / n;
    distribution.no = 1 - distribution.yes;
  }

  // For choice questions - count by option
  const choiceCounts: Record<string, number> = {};
  for (const r of successful) {
    if (typeof r.value === "string" && r.value.length > 0) {
      choiceCounts[r.value] = (choiceCounts[r.value] || 0) + 1;
    }
  }
  if (Object.keys(choiceCounts).length > 0) {
    distribution.options = {};
    for (const [key, count] of Object.entries(choiceCounts)) {
      distribution.options[key] = count / n;
    }
  }

  // For scale/numeric - build histogram
  const histogram = new Array(10).fill(0);
  for (const r of successful) {
    const bucket = Math.min(9, Math.floor(r.normalizedValue * 10));
    histogram[bucket]++;
  }
  distribution.histogram = histogram.map((count) => count / n);

  // Confidence breakdown
  const confidenceBreakdown = {
    high: successful.filter((r) => r.confidence === "high").length / n,
    medium: successful.filter((r) => r.confidence === "medium").length / n,
    low: successful.filter((r) => r.confidence === "low").length / n,
  };

  return {
    mean,
    std,
    distribution,
    weightedMean,
    totalWeight,
    sampleSize: responses.length,
    successfulParses: n,
    confidenceBreakdown,
  };
}
