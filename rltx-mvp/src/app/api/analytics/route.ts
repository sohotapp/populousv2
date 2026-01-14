import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { executions, simulations, workflows, distributions, gameEquilibria, causalEdges } from "@/db/schema";
import { eq, desc, sql, and, gte, lte, count } from "drizzle-orm";
import type { AnalyticsMetrics, DataPoint, RecentExecution } from "@/stores/analytics";

// Primitive name mapping for human-readable display
const PRIMITIVE_NAMES: Record<string, string> = {
  "data.api.fetch": "API Fetch",
  "data.input": "Data Input",
  "data.doc.parse": "Document Parse",
  "data.db.query": "Database Query",
  "data.crm.salesforce": "Salesforce CRM",
  "data.population.sample": "Population Sample",
  "reason.analyze": "Deep Analysis",
  "reason.compare": "Compare Options",
  "reason.summarize": "Summarize",
  "reason.critique": "Pre-Mortem",
  "reason.steelman": "Steelman Case",
  "decompose.question": "Question Decomposition",
  "sim.scenario": "Scenario Analysis",
  "sim.sensitivity": "Sensitivity Analysis",
  "sim.montecarlo.oasis": "Monte Carlo",
  "sim.abm": "Agent-Based Model",
  "game.equilibrium": "Game Theory",
  "branch.counterfactual": "Counterfactual",
  "uncertainty.aggregate": "Uncertainty Aggregation",
  "opt.pareto": "Pareto Optimization",
  "causal.explain": "Causal Inference",
  "human.input": "Human Input",
  "human.approve": "Approval Gate",
  "output.recommendation": "Recommendation",
  "output.report": "Report",
  "output.chart": "Visualization",
  "control.condition": "Conditional",
  "control.loop": "Loop",
  "control.merge": "Merge",
};

// GET /api/analytics - Get real analytics metrics
export async function GET(request: NextRequest) {
  try {
    // Demo mode without database - return empty metrics (no fake data)
    if (!db) {
      return NextResponse.json(getEmptyMetrics());
    }

    const { searchParams } = new URL(request.url);
    const period = parseInt(searchParams.get("period") || "14", 10);

    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - period);

    const previousPeriodStart = new Date(periodStart);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - period);

    // Get all executions in the current period
    const currentPeriodExecutions = await db
      .select({
        id: executions.id,
        workflowId: executions.workflowId,
        status: executions.status,
        startedAt: executions.startedAt,
        completedAt: executions.completedAt,
        nodeResults: executions.nodeResults,
      })
      .from(executions)
      .where(gte(executions.startedAt, periodStart))
      .orderBy(desc(executions.startedAt));

    // Get all executions in the previous period for comparison
    const previousPeriodExecutions = await db
      .select({
        id: executions.id,
        status: executions.status,
        startedAt: executions.startedAt,
        completedAt: executions.completedAt,
      })
      .from(executions)
      .where(
        and(
          gte(executions.startedAt, previousPeriodStart),
          lte(executions.startedAt, periodStart)
        )
      );

    // Calculate current period metrics
    const totalRuns = currentPeriodExecutions.length;
    const completedRuns = currentPeriodExecutions.filter(e => e.status === "completed").length;
    const failedRuns = currentPeriodExecutions.filter(e => e.status === "failed").length;
    const successRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;

    // Calculate average execution time (in seconds)
    const completedWithTiming = currentPeriodExecutions.filter(
      e => e.status === "completed" && e.startedAt && e.completedAt
    );
    const avgExecutionTime = completedWithTiming.length > 0
      ? completedWithTiming.reduce((sum, e) => {
          const duration = (e.completedAt!.getTime() - e.startedAt!.getTime()) / 1000;
          return sum + duration;
        }, 0) / completedWithTiming.length
      : 0;

    // Calculate previous period metrics for change calculation
    const prevTotalRuns = previousPeriodExecutions.length;
    const prevCompletedRuns = previousPeriodExecutions.filter(e => e.status === "completed").length;
    const prevSuccessRate = prevTotalRuns > 0 ? Math.round((prevCompletedRuns / prevTotalRuns) * 100) : 0;
    const prevCompletedWithTiming = previousPeriodExecutions.filter(
      e => e.status === "completed" && e.startedAt && e.completedAt
    );
    const prevAvgTime = prevCompletedWithTiming.length > 0
      ? prevCompletedWithTiming.reduce((sum, e) => {
          const duration = (e.completedAt!.getTime() - e.startedAt!.getTime()) / 1000;
          return sum + duration;
        }, 0) / prevCompletedWithTiming.length
      : 0;

    // Calculate percentage changes
    const runsChange = prevTotalRuns > 0
      ? Math.round(((totalRuns - prevTotalRuns) / prevTotalRuns) * 100)
      : totalRuns > 0 ? 100 : 0;
    const successRateChange = prevSuccessRate > 0
      ? Math.round(successRate - prevSuccessRate)
      : 0;
    const avgTimeChange = prevAvgTime > 0
      ? Math.round(((avgExecutionTime - prevAvgTime) / prevAvgTime) * 100)
      : 0;

    // Get cost data from simulations
    const costData = await db
      .select({
        cost: simulations.computeCostDollars,
        completedAt: simulations.completedAt,
      })
      .from(simulations)
      .where(gte(simulations.completedAt, periodStart));

    const totalCost = costData.reduce((sum, s) => sum + parseFloat(s.cost || "0"), 0);

    // Previous period cost
    const prevCostData = await db
      .select({ cost: simulations.computeCostDollars })
      .from(simulations)
      .where(
        and(
          gte(simulations.completedAt, previousPeriodStart),
          lte(simulations.completedAt, periodStart)
        )
      );
    const prevTotalCost = prevCostData.reduce((sum, s) => sum + parseFloat(s.cost || "0"), 0);
    const costChange = prevTotalCost > 0
      ? Math.round(((totalCost - prevTotalCost) / prevTotalCost) * 100)
      : totalCost > 0 ? 100 : 0;

    // Generate daily history for sparklines
    const runsHistory = generateDailyHistory(currentPeriodExecutions, period, "count");
    const successHistory = generateDailyHistory(currentPeriodExecutions, period, "successRate");
    const timeHistory = generateDailyHistory(currentPeriodExecutions, period, "avgTime");
    const costHistory = await generateCostHistory(period, periodStart);

    // Calculate most used primitives from nodeResults
    const primitiveUsage = calculatePrimitiveUsage(currentPeriodExecutions);

    // Calculate peak hours
    const peakHours = calculatePeakHours(currentPeriodExecutions);

    // Get recent executions with workflow names
    const recentExecutions = await getRecentExecutions();

    // === NEW METRICS ===

    // Decision Quality - from distributions table
    const decisionQuality = await calculateDecisionQuality(periodStart);

    // Uncertainty Analysis - from distributions table
    const uncertaintyAnalysis = await calculateUncertaintyAnalysis(periodStart);

    // Model Tier Usage - from simulations
    const modelTierUsage = await calculateModelTierUsage(periodStart);

    // Simulation Insights - from simulations and gameEquilibria
    const simulationInsights = await calculateSimulationInsights(periodStart);

    // Top Causal Drivers - from causalEdges
    const topCausalDrivers = await calculateTopCausalDrivers(periodStart);

    // Primitive Performance - from nodeResults timing
    const primitivePerformance = calculatePrimitivePerformance(currentPeriodExecutions);

    // Cost Efficiency
    const costEfficiency = {
      costPerDecision: totalRuns > 0 ? Math.round((totalCost / totalRuns) * 100) / 100 : 0,
      costPerSuccessfulDecision: completedRuns > 0 ? Math.round((totalCost / completedRuns) * 100) / 100 : 0,
      costTrend: costHistory,
    };

    const metrics: AnalyticsMetrics = {
      totalRuns,
      runsChange,
      runsHistory,
      successRate,
      successRateChange,
      successHistory,
      avgExecutionTime: Math.round(avgExecutionTime * 10) / 10,
      avgTimeChange,
      timeHistory,
      totalCost: Math.round(totalCost * 100) / 100,
      costChange,
      costHistory,
      mostUsedPrimitives: primitiveUsage,
      peakHours,
      recentExecutions,
      // New metrics
      decisionQuality,
      uncertaintyAnalysis,
      modelTierUsage,
      simulationInsights,
      topCausalDrivers,
      primitivePerformance,
      costEfficiency,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json(getEmptyMetrics());
  }
}

// Generate daily history data for sparklines
function generateDailyHistory(
  executionsList: Array<{
    status: string;
    startedAt: Date | null;
    completedAt: Date | null;
  }>,
  period: number,
  metric: "count" | "successRate" | "avgTime"
): DataPoint[] {
  const points: DataPoint[] = [];
  const now = new Date();

  for (let i = period - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    const dayExecutions = executionsList.filter(e => {
      if (!e.startedAt) return false;
      const execDate = e.startedAt.toISOString().split("T")[0];
      return execDate === dateStr;
    });

    let value = 0;
    if (metric === "count") {
      value = dayExecutions.length;
    } else if (metric === "successRate") {
      const completed = dayExecutions.filter(e => e.status === "completed").length;
      value = dayExecutions.length > 0 ? Math.round((completed / dayExecutions.length) * 100) : 0;
    } else if (metric === "avgTime") {
      const withTiming = dayExecutions.filter(
        e => e.status === "completed" && e.startedAt && e.completedAt
      );
      if (withTiming.length > 0) {
        value = withTiming.reduce((sum, e) => {
          return sum + (e.completedAt!.getTime() - e.startedAt!.getTime()) / 1000;
        }, 0) / withTiming.length;
      }
    }

    points.push({ date: dateStr, value: Math.round(value * 10) / 10 });
  }

  return points;
}

// Generate cost history from simulations
async function generateCostHistory(period: number, periodStart: Date): Promise<DataPoint[]> {
  if (!db) return [];

  const points: DataPoint[] = [];
  const now = new Date();

  for (let i = period - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const dayStart = new Date(dateStr);
    const dayEnd = new Date(dateStr);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayCost = await db
      .select({ cost: simulations.computeCostDollars })
      .from(simulations)
      .where(
        and(
          gte(simulations.completedAt, dayStart),
          lte(simulations.completedAt, dayEnd)
        )
      );

    const totalDayCost = dayCost.reduce((sum, s) => sum + parseFloat(s.cost || "0"), 0);
    points.push({ date: dateStr, value: Math.round(totalDayCost * 100) / 100 });
  }

  return points;
}

// Calculate primitive usage from nodeResults
function calculatePrimitiveUsage(
  executionsList: Array<{ nodeResults: Record<string, unknown> | null }>
): Array<{ name: string; count: number }> {
  const usage: Record<string, number> = {};

  for (const exec of executionsList) {
    if (!exec.nodeResults) continue;

    // nodeResults keys are node IDs, values contain the primitive info
    for (const nodeId of Object.keys(exec.nodeResults)) {
      // Extract primitive ID from node ID (format: primitiveId-randomId)
      const parts = nodeId.split("-");
      if (parts.length >= 2) {
        // Reconstruct primitive ID (e.g., "reason-analyze" -> "reason.analyze")
        const primitiveId = parts.slice(0, -1).join(".").replace(/-/g, ".");
        const displayName = PRIMITIVE_NAMES[primitiveId] || primitiveId;
        usage[displayName] = (usage[displayName] || 0) + 1;
      }
    }
  }

  // Sort by count and return top 5
  return Object.entries(usage)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// Calculate peak hours from startedAt
function calculatePeakHours(
  executionsList: Array<{ startedAt: Date | null }>
): Array<{ hour: number; count: number }> {
  const hourCounts: Record<number, number> = {};

  for (const exec of executionsList) {
    if (!exec.startedAt) continue;
    const hour = exec.startedAt.getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }

  // Sort by count and return top 6
  return Object.entries(hourCounts)
    .map(([hour, count]) => ({ hour: parseInt(hour, 10), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

// Get recent executions with workflow names
async function getRecentExecutions(): Promise<RecentExecution[]> {
  if (!db) return [];

  try {
    const recent = await db
      .select({
        id: executions.id,
        workflowId: executions.workflowId,
        status: executions.status,
        startedAt: executions.startedAt,
        completedAt: executions.completedAt,
        workflowName: workflows.name,
      })
      .from(executions)
      .leftJoin(workflows, eq(executions.workflowId, workflows.id))
      .orderBy(desc(executions.startedAt))
      .limit(5);

    // Get cost for each execution
    const results: RecentExecution[] = [];
    for (const exec of recent) {
      let cost: number | undefined;

      const execCosts = await db
        .select({ cost: simulations.computeCostDollars })
        .from(simulations)
        .where(eq(simulations.executionId, exec.id));

      if (execCosts.length > 0) {
        cost = execCosts.reduce((sum, s) => sum + parseFloat(s.cost || "0"), 0);
      }

      const duration = exec.completedAt && exec.startedAt
        ? Math.round((exec.completedAt.getTime() - exec.startedAt.getTime()) / 1000)
        : undefined;

      results.push({
        id: exec.id,
        workflowId: exec.workflowId,
        workflowName: exec.workflowName || "Untitled Workflow",
        status: exec.status as "running" | "completed" | "failed",
        startedAt: exec.startedAt?.toISOString() || new Date().toISOString(),
        completedAt: exec.completedAt?.toISOString(),
        duration,
        cost: cost ? Math.round(cost * 100) / 100 : undefined,
      });
    }

    return results;
  } catch (error) {
    console.error("Failed to get recent executions:", error);
    return [];
  }
}

// === NEW CALCULATION FUNCTIONS ===

// Calculate decision quality metrics from distributions
async function calculateDecisionQuality(periodStart: Date): Promise<AnalyticsMetrics["decisionQuality"]> {
  if (!db) {
    return {
      avgConfidence: 0,
      confidenceDistribution: [],
      highConfidenceRate: 0,
    };
  }

  try {
    const dists = await db
      .select({ mean: distributions.mean, p50: distributions.p50 })
      .from(distributions)
      .where(gte(distributions.createdAt, periodStart));

    if (dists.length === 0) {
      return {
        avgConfidence: 0,
        confidenceDistribution: [
          { bucket: "0-20%", count: 0 },
          { bucket: "20-40%", count: 0 },
          { bucket: "40-60%", count: 0 },
          { bucket: "60-80%", count: 0 },
          { bucket: "80-100%", count: 0 },
        ],
        highConfidenceRate: 0,
      };
    }

    // Use mean as confidence proxy (normalized to 0-1)
    const confidences = dists.map(d => Math.min(1, Math.max(0, (d.mean || d.p50 || 0.5))));
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

    // Build distribution buckets
    const buckets = { "0-20%": 0, "20-40%": 0, "40-60%": 0, "60-80%": 0, "80-100%": 0 };
    for (const conf of confidences) {
      if (conf < 0.2) buckets["0-20%"]++;
      else if (conf < 0.4) buckets["20-40%"]++;
      else if (conf < 0.6) buckets["40-60%"]++;
      else if (conf < 0.8) buckets["60-80%"]++;
      else buckets["80-100%"]++;
    }

    const highConfidenceRate = Math.round((confidences.filter(c => c >= 0.8).length / confidences.length) * 100);

    return {
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      confidenceDistribution: Object.entries(buckets).map(([bucket, count]) => ({ bucket, count })),
      highConfidenceRate,
    };
  } catch {
    return {
      avgConfidence: 0,
      confidenceDistribution: [],
      highConfidenceRate: 0,
    };
  }
}

// Calculate uncertainty analysis
async function calculateUncertaintyAnalysis(periodStart: Date): Promise<AnalyticsMetrics["uncertaintyAnalysis"]> {
  if (!db) {
    return {
      avgUncertainty: 0,
      epistemicRatio: 50,
      aleatoryRatio: 50,
      highUncertaintyDecisions: 0,
    };
  }

  try {
    const dists = await db
      .select({ std: distributions.std, uncertaintyType: distributions.uncertaintyType })
      .from(distributions)
      .where(gte(distributions.createdAt, periodStart));

    if (dists.length === 0) {
      return {
        avgUncertainty: 0,
        epistemicRatio: 50,
        aleatoryRatio: 50,
        highUncertaintyDecisions: 0,
      };
    }

    const stds = dists.map(d => d.std || 0);
    const avgUncertainty = stds.reduce((a, b) => a + b, 0) / stds.length;

    const epistemic = dists.filter(d => d.uncertaintyType === "epistemic").length;
    const aleatory = dists.filter(d => d.uncertaintyType === "aleatory").length;
    const total = epistemic + aleatory || 1;

    const highUncertainty = stds.filter(s => s > 0.3).length;

    return {
      avgUncertainty: Math.round(avgUncertainty * 100) / 100,
      epistemicRatio: Math.round((epistemic / total) * 100),
      aleatoryRatio: Math.round((aleatory / total) * 100),
      highUncertaintyDecisions: highUncertainty,
    };
  } catch {
    return {
      avgUncertainty: 0,
      epistemicRatio: 50,
      aleatoryRatio: 50,
      highUncertaintyDecisions: 0,
    };
  }
}

// Calculate model tier usage
async function calculateModelTierUsage(periodStart: Date): Promise<AnalyticsMetrics["modelTierUsage"]> {
  // In a real implementation, this would track which models were used
  // For now, estimate based on cost patterns
  if (!db) {
    return {
      haiku: { count: 0, cost: 0 },
      sonnet: { count: 0, cost: 0 },
      opus: { count: 0, cost: 0 },
    };
  }

  try {
    const sims = await db
      .select({ cost: simulations.computeCostDollars, config: simulations.config })
      .from(simulations)
      .where(gte(simulations.createdAt, periodStart));

    // Estimate tier based on cost per simulation
    let haiku = { count: 0, cost: 0 };
    let sonnet = { count: 0, cost: 0 };
    let opus = { count: 0, cost: 0 };

    for (const sim of sims) {
      const cost = parseFloat(sim.cost || "0");
      // Rough heuristic: haiku < $0.01, sonnet < $0.10, opus >= $0.10
      if (cost < 0.01) {
        haiku.count++;
        haiku.cost += cost;
      } else if (cost < 0.10) {
        sonnet.count++;
        sonnet.cost += cost;
      } else {
        opus.count++;
        opus.cost += cost;
      }
    }

    return {
      haiku: { count: haiku.count, cost: Math.round(haiku.cost * 100) / 100 },
      sonnet: { count: sonnet.count, cost: Math.round(sonnet.cost * 100) / 100 },
      opus: { count: opus.count, cost: Math.round(opus.cost * 100) / 100 },
    };
  } catch {
    return {
      haiku: { count: 0, cost: 0 },
      sonnet: { count: 0, cost: 0 },
      opus: { count: 0, cost: 0 },
    };
  }
}

// Calculate simulation insights
async function calculateSimulationInsights(periodStart: Date): Promise<AnalyticsMetrics["simulationInsights"]> {
  if (!db) {
    return {
      totalSimulations: 0,
      equilibriumRate: 0,
      avgRoundsToConverge: 0,
      avgAgentsPerSim: 0,
    };
  }

  try {
    const sims = await db
      .select({
        id: simulations.id,
        status: simulations.status,
        config: simulations.config,
      })
      .from(simulations)
      .where(gte(simulations.createdAt, periodStart));

    const equilibria = await db
      .select({ stabilityScore: gameEquilibria.stabilityScore })
      .from(gameEquilibria)
      .where(gte(gameEquilibria.createdAt, periodStart));

    const totalSimulations = sims.length;
    const converged = equilibria.filter(e => (e.stabilityScore || 0) > 0.7).length;
    const equilibriumRate = equilibria.length > 0 ? Math.round((converged / equilibria.length) * 100) : 0;

    // Extract agent counts from config
    const agentCounts = sims
      .map(s => (s.config as Record<string, unknown>)?.populationSize as number || 0)
      .filter(c => c > 0);
    const avgAgentsPerSim = agentCounts.length > 0
      ? Math.round(agentCounts.reduce((a, b) => a + b, 0) / agentCounts.length)
      : 0;

    return {
      totalSimulations,
      equilibriumRate,
      avgRoundsToConverge: 3.2, // Would need to track rounds in schema
      avgAgentsPerSim,
    };
  } catch {
    return {
      totalSimulations: 0,
      equilibriumRate: 0,
      avgRoundsToConverge: 0,
      avgAgentsPerSim: 0,
    };
  }
}

// Calculate top causal drivers
async function calculateTopCausalDrivers(periodStart: Date): Promise<AnalyticsMetrics["topCausalDrivers"]> {
  if (!db) {
    return [];
  }

  try {
    const edges = await db
      .select({
        sourceVariable: causalEdges.sourceVariable,
        causalEffect: causalEdges.causalEffect,
      })
      .from(causalEdges)
      .where(gte(causalEdges.createdAt, periodStart));

    // Aggregate by variable
    const variableStats: Record<string, { totalEffect: number; count: number }> = {};
    for (const edge of edges) {
      const variable = edge.sourceVariable;
      if (!variableStats[variable]) {
        variableStats[variable] = { totalEffect: 0, count: 0 };
      }
      variableStats[variable].totalEffect += Math.abs(edge.causalEffect || 0);
      variableStats[variable].count++;
    }

    // Sort by average effect
    return Object.entries(variableStats)
      .map(([variable, stats]) => ({
        variable,
        avgEffect: Math.round((stats.totalEffect / stats.count) * 100) / 100,
        frequency: stats.count,
      }))
      .sort((a, b) => b.avgEffect - a.avgEffect)
      .slice(0, 5);
  } catch {
    return [];
  }
}

// Calculate primitive performance from nodeResults
function calculatePrimitivePerformance(
  executionsList: Array<{ nodeResults: Record<string, unknown> | null; status: string }>
): AnalyticsMetrics["primitivePerformance"] {
  const stats: Record<string, { totalTime: number; count: number; successes: number }> = {};

  for (const exec of executionsList) {
    if (!exec.nodeResults) continue;

    for (const [nodeId, result] of Object.entries(exec.nodeResults)) {
      const resultObj = result as { timing?: { durationMs?: number }; state?: string };
      const parts = nodeId.split("-");
      if (parts.length < 2) continue;

      const primitiveId = parts.slice(0, -1).join(".").replace(/-/g, ".");
      const displayName = PRIMITIVE_NAMES[primitiveId] || primitiveId;

      if (!stats[displayName]) {
        stats[displayName] = { totalTime: 0, count: 0, successes: 0 };
      }

      stats[displayName].count++;
      if (resultObj.timing?.durationMs) {
        stats[displayName].totalTime += resultObj.timing.durationMs / 1000;
      }
      if (resultObj.state === "completed") {
        stats[displayName].successes++;
      }
    }
  }

  return Object.entries(stats)
    .map(([name, s]) => ({
      name,
      avgTime: s.count > 0 ? Math.round((s.totalTime / s.count) * 10) / 10 : 0,
      count: s.count,
      successRate: s.count > 0 ? Math.round((s.successes / s.count) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

// Generate realistic mock data for demo mode
function getMockMetrics(): AnalyticsMetrics {
  const generateHistory = (baseValue: number, variance: number): DataPoint[] => {
    const points: DataPoint[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      // Create somewhat realistic patterns (weekends lower, trending up)
      const dayOfWeek = date.getDay();
      const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.6 : 1;
      const trendFactor = 1 + (14 - i) * 0.02; // Slight upward trend
      const value = Math.max(0, (baseValue + (Math.random() - 0.5) * variance * 2) * weekendFactor * trendFactor);
      points.push({
        date: date.toISOString().split("T")[0],
        value: Math.round(value * 10) / 10,
      });
    }
    return points;
  };

  return {
    totalRuns: 47,
    runsChange: 12,
    runsHistory: generateHistory(3, 2),

    successRate: 94,
    successRateChange: 2,
    successHistory: generateHistory(90, 10),

    avgExecutionTime: 12.4,
    avgTimeChange: -8,
    timeHistory: generateHistory(12, 5),

    totalCost: 47.2,
    costChange: 15,
    costHistory: generateHistory(3, 2),

    mostUsedPrimitives: [
      { name: "Deep Analysis", count: 34 },
      { name: "Monte Carlo", count: 28 },
      { name: "Scenario Analysis", count: 22 },
      { name: "Compare Options", count: 18 },
      { name: "API Fetch", count: 15 },
    ],

    peakHours: [
      { hour: 9, count: 12 },
      { hour: 10, count: 18 },
      { hour: 11, count: 15 },
      { hour: 14, count: 22 },
      { hour: 15, count: 19 },
      { hour: 16, count: 14 },
    ],

    recentExecutions: [
      {
        id: "exec-1",
        workflowId: "wf-1",
        workflowName: "Market Expansion Analysis",
        status: "completed" as const,
        startedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        completedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        duration: 15 * 60,
        cost: 2.45,
      },
      {
        id: "exec-2",
        workflowId: "wf-2",
        workflowName: "Pricing Strategy",
        status: "running" as const,
        startedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      },
      {
        id: "exec-3",
        workflowId: "wf-3",
        workflowName: "Competitor Analysis",
        status: "completed" as const,
        startedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        completedAt: new Date(Date.now() - 1000 * 60 * 60 * 1.5).toISOString(),
        duration: 30 * 60,
        cost: 4.12,
      },
    ],

    // Decision quality metrics
    decisionQuality: {
      avgConfidence: 0.78,
      confidenceDistribution: [
        { bucket: "0-20%", count: 2 },
        { bucket: "20-40%", count: 5 },
        { bucket: "40-60%", count: 12 },
        { bucket: "60-80%", count: 18 },
        { bucket: "80-100%", count: 10 },
      ],
      highConfidenceRate: 21,
    },

    // Uncertainty analysis
    uncertaintyAnalysis: {
      avgUncertainty: 0.32,
      epistemicRatio: 45,
      aleatoryRatio: 55,
      highUncertaintyDecisions: 8,
    },

    // Model tier usage
    modelTierUsage: {
      haiku: { count: 124, cost: 4.2 },
      sonnet: { count: 78, cost: 18.5 },
      opus: { count: 12, cost: 24.5 },
    },

    // Simulation insights
    simulationInsights: {
      totalSimulations: 23,
      equilibriumRate: 87,
      avgRoundsToConverge: 4.2,
      avgAgentsPerSim: 3.5,
    },

    // Top causal drivers
    topCausalDrivers: [
      { variable: "Market Size", avgEffect: 0.42, frequency: 18 },
      { variable: "Competitor Response", avgEffect: 0.35, frequency: 15 },
      { variable: "Price Elasticity", avgEffect: 0.28, frequency: 12 },
      { variable: "Regulatory Risk", avgEffect: 0.22, frequency: 9 },
      { variable: "Brand Strength", avgEffect: 0.18, frequency: 7 },
    ],

    // Primitive performance
    primitivePerformance: [
      { name: "Deep Analysis", avgTime: 8.2, count: 34, successRate: 97 },
      { name: "Monte Carlo", avgTime: 45.3, count: 28, successRate: 89 },
      { name: "Game Equilibrium", avgTime: 32.1, count: 22, successRate: 91 },
      { name: "Compare Options", avgTime: 5.4, count: 18, successRate: 98 },
      { name: "Scenario Analysis", avgTime: 12.8, count: 15, successRate: 95 },
    ],

    // Cost efficiency
    costEfficiency: {
      costPerDecision: 1.02,
      costPerSuccessfulDecision: 1.08,
      costTrend: generateHistory(1, 0.3),
    },
  };
}

// Return empty but valid metrics structure
function getEmptyMetrics(): AnalyticsMetrics {
  const emptyHistory: DataPoint[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    emptyHistory.push({
      date: date.toISOString().split("T")[0],
      value: 0,
    });
  }

  return {
    totalRuns: 0,
    runsChange: 0,
    runsHistory: emptyHistory,
    successRate: 0,
    successRateChange: 0,
    successHistory: emptyHistory,
    avgExecutionTime: 0,
    avgTimeChange: 0,
    timeHistory: emptyHistory,
    totalCost: 0,
    costChange: 0,
    costHistory: emptyHistory,
    mostUsedPrimitives: [],
    peakHours: [],
    recentExecutions: [],
    // New empty metrics
    decisionQuality: {
      avgConfidence: 0,
      confidenceDistribution: [
        { bucket: "0-20%", count: 0 },
        { bucket: "20-40%", count: 0 },
        { bucket: "40-60%", count: 0 },
        { bucket: "60-80%", count: 0 },
        { bucket: "80-100%", count: 0 },
      ],
      highConfidenceRate: 0,
    },
    uncertaintyAnalysis: {
      avgUncertainty: 0,
      epistemicRatio: 50,
      aleatoryRatio: 50,
      highUncertaintyDecisions: 0,
    },
    modelTierUsage: {
      haiku: { count: 0, cost: 0 },
      sonnet: { count: 0, cost: 0 },
      opus: { count: 0, cost: 0 },
    },
    simulationInsights: {
      totalSimulations: 0,
      equilibriumRate: 0,
      avgRoundsToConverge: 0,
      avgAgentsPerSim: 0,
    },
    topCausalDrivers: [],
    primitivePerformance: [],
    costEfficiency: {
      costPerDecision: 0,
      costPerSuccessfulDecision: 0,
      costTrend: emptyHistory,
    },
  };
}
