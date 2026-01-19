/**
 * Backtest Workflow for Historical Validation
 * 
 * Runs simulations against historical events with known outcomes
 * to measure and track prediction accuracy over time.
 */

import { db, validationEvents, simulations } from "@/db";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { runSimulation, SimulationConfig, SimulationResult } from "@/lib/simulation/engine";

export interface ValidationEvent {
  id: string;
  eventType: string;
  eventDate: Date;
  description: string;
  vertical: string;
  scenario: Record<string, unknown>;
  actualOutcome: Record<string, unknown>;
  groundTruthSource?: string;
}

export interface BacktestResult {
  eventId: string;
  eventDescription: string;
  eventDate: string;
  predictedOutcome: number;
  actualOutcome: number;
  accuracyScore: number;
  calibrationScore: number;
  brierScore: number;
  simulationId: string;
  executionTimeMs: number;
}

export interface BacktestSummary {
  totalEvents: number;
  completedEvents: number;
  averageAccuracy: number;
  averageCalibration: number;
  averageBrierScore: number;
  results: BacktestResult[];
  executedAt: string;
}

/**
 * Run backtest against a set of historical validation events
 */
export async function runBacktest(
  eventIds: string[],
  config?: Partial<SimulationConfig>
): Promise<BacktestSummary> {
  if (!db) {
    throw new Error("Database connection required for backtest");
  }

  const results: BacktestResult[] = [];
  const startTime = Date.now();

  for (const eventId of eventIds) {
    try {
      const result = await runSingleBacktest(eventId, config);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      console.error(`[backtest] Failed for event ${eventId}:`, error);
    }
  }

  // Calculate summary statistics
  const completedResults = results.filter((r) => r.accuracyScore >= 0);
  const avgAccuracy = completedResults.length > 0
    ? completedResults.reduce((sum, r) => sum + r.accuracyScore, 0) / completedResults.length
    : 0;
  const avgCalibration = completedResults.length > 0
    ? completedResults.reduce((sum, r) => sum + r.calibrationScore, 0) / completedResults.length
    : 0;
  const avgBrier = completedResults.length > 0
    ? completedResults.reduce((sum, r) => sum + r.brierScore, 0) / completedResults.length
    : 0;

  return {
    totalEvents: eventIds.length,
    completedEvents: completedResults.length,
    averageAccuracy: avgAccuracy,
    averageCalibration: avgCalibration,
    averageBrierScore: avgBrier,
    results,
    executedAt: new Date().toISOString(),
  };
}

/**
 * Run backtest for a single validation event
 */
async function runSingleBacktest(
  eventId: string,
  config?: Partial<SimulationConfig>
): Promise<BacktestResult | null> {
  if (!db) return null;

  // Get the validation event
  const events = await db
    .select()
    .from(validationEvents)
    .where(eq(validationEvents.id, eventId))
    .limit(1);

  if (events.length === 0) {
    console.warn(`[backtest] Event not found: ${eventId}`);
    return null;
  }

  const event = events[0];
  const scenario = event.scenario as Record<string, unknown>;
  const actualOutcome = event.actualOutcome as Record<string, unknown>;

  // Build simulation config from event scenario
  const simConfig: SimulationConfig = {
    query: scenario.query as string || event.description || "",
    scenario: scenario.description as string || event.description || "",
    question: scenario.question as string,
    questionType: (scenario.questionType as SimulationConfig["questionType"]) || "binary",
    options: scenario.options as string[],
    world: {
      hypotheticalEvents: (scenario.events as string[]) || [],
      marketConditions: scenario.marketConditions as SimulationConfig["world"],
      timeHorizon: scenario.timeHorizon as string,
    },
    population: {
      mode: "population",
      sampleSize: config?.population?.sampleSize || 500,
      useArchetypes: true,
      archetypeCount: 50,
      filters: scenario.populationFilters as Record<string, string[]>,
    },
    execution: {
      pilotMode: false,
      confidenceTarget: 95,
    },
    ...config,
  };

  // Run simulation
  const startTime = Date.now();
  let simResult: SimulationResult;

  try {
    simResult = await runSimulation(simConfig);
  } catch (error) {
    console.error(`[backtest] Simulation failed for event ${eventId}:`, error);
    return null;
  }

  const executionTimeMs = Date.now() - startTime;

  // Extract predicted and actual outcomes
  const predictedOutcome = simResult.summary.primaryMetric;
  const actualOutcomeValue = extractOutcomeValue(actualOutcome);

  // Calculate accuracy metrics
  const accuracyScore = calculateAccuracyScore(predictedOutcome, actualOutcomeValue);
  const calibrationScore = calculateCalibrationScore(
    predictedOutcome,
    actualOutcomeValue,
    simResult.summary.confidenceInterval
  );
  const brierScore = calculateBrierScore(predictedOutcome, actualOutcomeValue);

  // Update the validation event with results
  await db
    .update(validationEvents)
    .set({
      predictedOutcome: {
        primaryMetric: predictedOutcome,
        distribution: simResult.distribution,
        confidenceInterval: simResult.summary.confidenceInterval,
      },
      accuracyScore,
      calibrationScore,
      brierScore,
      updatedAt: new Date(),
    })
    .where(eq(validationEvents.id, eventId));

  return {
    eventId,
    eventDescription: event.description || "",
    eventDate: event.eventDate.toISOString(),
    predictedOutcome,
    actualOutcome: actualOutcomeValue,
    accuracyScore,
    calibrationScore,
    brierScore,
    simulationId: simResult.id,
    executionTimeMs,
  };
}

/**
 * Extract numeric outcome value from actual outcome object
 */
function extractOutcomeValue(actualOutcome: Record<string, unknown>): number {
  // Try common field names
  if (typeof actualOutcome.value === "number") return actualOutcome.value;
  if (typeof actualOutcome.outcome === "number") return actualOutcome.outcome;
  if (typeof actualOutcome.result === "number") return actualOutcome.result;
  if (typeof actualOutcome.percentage === "number") return actualOutcome.percentage / 100;
  if (typeof actualOutcome.probability === "number") return actualOutcome.probability;

  // Try to parse from boolean
  if (typeof actualOutcome.occurred === "boolean") return actualOutcome.occurred ? 1 : 0;
  if (typeof actualOutcome.success === "boolean") return actualOutcome.success ? 1 : 0;

  // Default to 0.5 if we can't extract
  console.warn("[backtest] Could not extract outcome value, defaulting to 0.5");
  return 0.5;
}

/**
 * Calculate accuracy score (1 - absolute error)
 */
function calculateAccuracyScore(predicted: number, actual: number): number {
  const error = Math.abs(predicted - actual);
  return Math.max(0, 1 - error);
}

/**
 * Calculate calibration score (whether CI contains actual)
 */
function calculateCalibrationScore(
  predicted: number,
  actual: number,
  ci: { lower: number; upper: number }
): number {
  // Check if actual falls within confidence interval
  const inCI = actual >= ci.lower && actual <= ci.upper;
  
  // Also consider how close prediction is to actual
  const error = Math.abs(predicted - actual);
  const ciWidth = ci.upper - ci.lower;
  
  // Score: 1 if in CI and close, 0.5 if in CI but far, 0 if outside CI
  if (inCI) {
    return error < ciWidth / 2 ? 1 : 0.7;
  }
  
  // Outside CI: penalize based on distance
  const distanceFromCI = actual < ci.lower
    ? ci.lower - actual
    : actual - ci.upper;
  return Math.max(0, 0.5 - distanceFromCI);
}

/**
 * Calculate Brier score (lower is better)
 */
function calculateBrierScore(predicted: number, actual: number): number {
  // Brier score = (predicted - actual)^2
  // For binary outcomes, this is the mean squared error
  return Math.pow(predicted - actual, 2);
}

/**
 * Get validation events for a vertical
 */
export async function getValidationEvents(
  vertical: string,
  limit = 50
): Promise<ValidationEvent[]> {
  if (!db) return [];

  const events = await db
    .select()
    .from(validationEvents)
    .where(eq(validationEvents.vertical, vertical))
    .orderBy(desc(validationEvents.eventDate))
    .limit(limit);

  return events.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    eventDate: e.eventDate,
    description: e.description || "",
    vertical: e.vertical,
    scenario: (e.scenario as Record<string, unknown>) || {},
    actualOutcome: (e.actualOutcome as Record<string, unknown>) || {},
    groundTruthSource: e.groundTruthSource || undefined,
  }));
}

/**
 * Get backtest results for a time period
 */
export async function getBacktestHistory(
  startDate: Date,
  endDate: Date,
  vertical?: string
): Promise<BacktestResult[]> {
  if (!db) return [];

  const conditions = [
    gte(validationEvents.eventDate, startDate),
    lte(validationEvents.eventDate, endDate),
  ];

  if (vertical) {
    conditions.push(eq(validationEvents.vertical, vertical));
  }

  const events = await db
    .select()
    .from(validationEvents)
    .where(and(...conditions))
    .orderBy(desc(validationEvents.eventDate));

  return events
    .filter((e) => e.accuracyScore !== null)
    .map((e) => ({
      eventId: e.id,
      eventDescription: e.description || "",
      eventDate: e.eventDate.toISOString(),
      predictedOutcome: (e.predictedOutcome as Record<string, unknown>)?.primaryMetric as number || 0,
      actualOutcome: extractOutcomeValue((e.actualOutcome as Record<string, unknown>) || {}),
      accuracyScore: e.accuracyScore || 0,
      calibrationScore: e.calibrationScore || 0,
      brierScore: e.brierScore || 0,
      simulationId: e.simulationId || "",
      executionTimeMs: 0,
    }));
}

/**
 * Create a new validation event
 */
export async function createValidationEvent(
  event: Omit<ValidationEvent, "id">
): Promise<string> {
  if (!db) {
    throw new Error("Database connection required");
  }

  const result = await db
    .insert(validationEvents)
    .values({
      eventType: event.eventType,
      eventDate: event.eventDate,
      description: event.description,
      vertical: event.vertical,
      scenario: event.scenario,
      actualOutcome: event.actualOutcome,
      groundTruthSource: event.groundTruthSource,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: validationEvents.id });

  return result[0].id;
}

/**
 * Calculate aggregate accuracy metrics over time
 */
export async function getAccuracyTrend(
  vertical: string,
  windowDays = 30
): Promise<Array<{ date: string; accuracy: number; count: number }>> {
  if (!db) return [];

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - windowDays * 6); // 6 windows

  const events = await db
    .select()
    .from(validationEvents)
    .where(
      and(
        eq(validationEvents.vertical, vertical),
        gte(validationEvents.eventDate, startDate),
        lte(validationEvents.eventDate, endDate)
      )
    )
    .orderBy(validationEvents.eventDate);

  // Group by window
  const windows: Map<string, { sum: number; count: number }> = new Map();

  for (const event of events) {
    if (event.accuracyScore === null) continue;

    const windowStart = new Date(event.eventDate);
    windowStart.setDate(windowStart.getDate() - (windowStart.getDate() % windowDays));
    const windowKey = windowStart.toISOString().split("T")[0];

    const existing = windows.get(windowKey) || { sum: 0, count: 0 };
    existing.sum += event.accuracyScore;
    existing.count += 1;
    windows.set(windowKey, existing);
  }

  return Array.from(windows.entries())
    .map(([date, { sum, count }]) => ({
      date,
      accuracy: sum / count,
      count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
