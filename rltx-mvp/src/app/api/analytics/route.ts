import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { executions, simulations, workflows } from "@/db/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
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
    // Demo mode without database - return empty but valid structure
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
  };
}
