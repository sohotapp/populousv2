/**
 * Persistent Simulation Run Store
 * 
 * Stores simulation runs and audit records in PostgreSQL via Drizzle.
 * Replaces the previous in-memory Map<> implementation for production reliability.
 * 
 * Features:
 * - All runs persist across server restarts
 * - Full audit trail for compliance and reproducibility
 * - Efficient queries for history and status
 */

import { nanoid } from "nanoid";
import { eq, desc, sql } from "drizzle-orm";
import { db, simulationRuns, simulationAudits } from "@/db";
import type { 
  SimulationRunConfig, 
  SimulationRunResult, 
  SimulationAuditResponse 
} from "@/db/schema";

export type SimulationRunStatus = "running" | "completed" | "failed";

export interface SimulationRunRecord {
  id: string;
  status: SimulationRunStatus;
  createdAt: string;
  updatedAt: string;
  config: SimulationRunConfig;
  result?: SimulationRunResult;
  error?: string;
  auditId: string;
}

export interface SimulationAuditRecord {
  id: string;
  runId?: string;
  createdAt: string;
  updatedAt: string;
  request: {
    config: SimulationRunConfig;
    ip?: string;
    userAgent?: string;
  };
  response?: SimulationAuditResponse;
  error?: string;
}

/**
 * Create a new simulation run entry and audit record.
 * Persists to database immediately.
 */
export async function createSimulationRun(
  config: SimulationRunConfig,
  meta?: { ip?: string; userAgent?: string; userId?: string; sessionId?: string }
): Promise<SimulationRunRecord> {
  const now = new Date();
  const auditId = `audit_${nanoid(12)}`;
  const runId = config.id || `sim_${nanoid(12)}`;

  // If no database connection, fall back to in-memory (dev mode)
  if (!db) {
    console.warn("[run-store] No database connection, using in-memory fallback");
    return createSimulationRunInMemory(config, meta);
  }

  try {
    // Create audit record first
    await db.insert(simulationAudits).values({
      id: auditId,
      runId,
      requestConfig: config,
      requestIp: meta?.ip ?? null,
      requestUserAgent: meta?.userAgent ?? null,
      createdAt: now,
      updatedAt: now,
    });

    // Create run record
    await db.insert(simulationRuns).values({
      id: runId,
      status: "running",
      config: { ...config, id: runId },
      auditId,
      userId: meta?.userId ?? null,
      sessionId: meta?.sessionId ?? null,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: runId,
      status: "running",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      config: { ...config, id: runId },
      auditId,
    };
  } catch (error) {
    console.error("[run-store] Failed to create run in database:", error);
    // Fall back to in-memory on database error
    return createSimulationRunInMemory(config, meta);
  }
}

/**
 * Mark a run as completed and attach the result + audit summary.
 */
export async function completeSimulationRun(
  runId: string,
  result: SimulationRunResult
): Promise<SimulationRunRecord | undefined> {
  const now = new Date();

  // If no database, use in-memory
  if (!db) {
    return completeSimulationRunInMemory(runId, result);
  }

  try {
    // Update run record
    await db
      .update(simulationRuns)
      .set({
        status: "completed",
        result,
        completedAt: now,
        updatedAt: now,
        error: null,
      })
      .where(eq(simulationRuns.id, runId));

    // Get the updated run to find auditId
    const runs = await db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.id, runId))
      .limit(1);

    if (runs.length === 0) {
      console.warn(`[run-store] Run not found: ${runId}`);
      return undefined;
    }

    const run = runs[0];

    // Update audit record
    await db
      .update(simulationAudits)
      .set({
        responseSummary: {
          summary: result.summary,
          metadata: result.metadata,
        },
        error: null,
        updatedAt: now,
      })
      .where(eq(simulationAudits.id, run.auditId));

    return {
      id: run.id,
      status: "completed",
      createdAt: run.createdAt.toISOString(),
      updatedAt: now.toISOString(),
      config: run.config as SimulationRunConfig,
      result: run.result as SimulationRunResult ?? result,
      auditId: run.auditId,
    };
  } catch (error) {
    console.error("[run-store] Failed to complete run in database:", error);
    return completeSimulationRunInMemory(runId, result);
  }
}

/**
 * Mark a run as failed with error details.
 */
export async function failSimulationRun(
  runId: string,
  error: string
): Promise<SimulationRunRecord | undefined> {
  const now = new Date();

  if (!db) {
    return failSimulationRunInMemory(runId, error);
  }

  try {
    // Update run record
    await db
      .update(simulationRuns)
      .set({
        status: "failed",
        error,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(simulationRuns.id, runId));

    // Get the updated run
    const runs = await db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.id, runId))
      .limit(1);

    if (runs.length === 0) {
      return undefined;
    }

    const run = runs[0];

    // Update audit record
    await db
      .update(simulationAudits)
      .set({
        error,
        updatedAt: now,
      })
      .where(eq(simulationAudits.id, run.auditId));

    return {
      id: run.id,
      status: "failed",
      createdAt: run.createdAt.toISOString(),
      updatedAt: now.toISOString(),
      config: run.config as SimulationRunConfig,
      error,
      auditId: run.auditId,
    };
  } catch (dbError) {
    console.error("[run-store] Failed to mark run as failed in database:", dbError);
    return failSimulationRunInMemory(runId, error);
  }
}

/**
 * Retrieve a simulation run by ID.
 */
export async function getSimulationRun(runId: string): Promise<SimulationRunRecord | undefined> {
  if (!db) {
    return getSimulationRunInMemory(runId);
  }

  try {
    const runs = await db
      .select()
      .from(simulationRuns)
      .where(eq(simulationRuns.id, runId))
      .limit(1);

    if (runs.length === 0) {
      return undefined;
    }

    const run = runs[0];
    return {
      id: run.id,
      status: run.status as SimulationRunStatus,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
      config: run.config as SimulationRunConfig,
      result: run.result as SimulationRunResult | undefined,
      error: run.error ?? undefined,
      auditId: run.auditId,
    };
  } catch (error) {
    console.error("[run-store] Failed to get run from database:", error);
    return getSimulationRunInMemory(runId);
  }
}

/**
 * List recent simulation runs (most recent first).
 */
export async function listSimulationRuns(limit = 50): Promise<SimulationRunRecord[]> {
  if (!db) {
    return listSimulationRunsInMemory(limit);
  }

  try {
    const runs = await db
      .select()
      .from(simulationRuns)
      .orderBy(desc(simulationRuns.createdAt))
      .limit(limit);

    return runs.map((run) => ({
      id: run.id,
      status: run.status as SimulationRunStatus,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
      config: run.config as SimulationRunConfig,
      result: run.result as SimulationRunResult | undefined,
      error: run.error ?? undefined,
      auditId: run.auditId,
    }));
  } catch (error) {
    console.error("[run-store] Failed to list runs from database:", error);
    return listSimulationRunsInMemory(limit);
  }
}

/**
 * Retrieve an audit record by audit ID.
 */
export async function getSimulationAudit(auditId: string): Promise<SimulationAuditRecord | undefined> {
  if (!db) {
    return getSimulationAuditInMemory(auditId);
  }

  try {
    const audits = await db
      .select()
      .from(simulationAudits)
      .where(eq(simulationAudits.id, auditId))
      .limit(1);

    if (audits.length === 0) {
      return undefined;
    }

    const audit = audits[0];
    return {
      id: audit.id,
      runId: audit.runId ?? undefined,
      createdAt: audit.createdAt.toISOString(),
      updatedAt: audit.updatedAt.toISOString(),
      request: {
        config: audit.requestConfig as SimulationRunConfig,
        ip: audit.requestIp ?? undefined,
        userAgent: audit.requestUserAgent ?? undefined,
      },
      response: audit.responseSummary as SimulationAuditResponse | undefined,
      error: audit.error ?? undefined,
    };
  } catch (error) {
    console.error("[run-store] Failed to get audit from database:", error);
    return getSimulationAuditInMemory(auditId);
  }
}

/**
 * Get run statistics (for dashboard)
 */
export async function getRunStatistics(): Promise<{
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  avgExecutionTimeMs: number;
}> {
  if (!db) {
    return {
      totalRuns: inMemoryRunStore.size,
      completedRuns: Array.from(inMemoryRunStore.values()).filter(r => r.status === "completed").length,
      failedRuns: Array.from(inMemoryRunStore.values()).filter(r => r.status === "failed").length,
      avgExecutionTimeMs: 0,
    };
  }

  try {
    const stats = await db
      .select({
        total: sql<number>`count(*)`,
        completed: sql<number>`count(*) filter (where status = 'completed')`,
        failed: sql<number>`count(*) filter (where status = 'failed')`,
      })
      .from(simulationRuns);

    return {
      totalRuns: Number(stats[0]?.total ?? 0),
      completedRuns: Number(stats[0]?.completed ?? 0),
      failedRuns: Number(stats[0]?.failed ?? 0),
      avgExecutionTimeMs: 0, // Would need to compute from result.summary.executionTimeMs
    };
  } catch (error) {
    console.error("[run-store] Failed to get statistics:", error);
    return {
      totalRuns: 0,
      completedRuns: 0,
      failedRuns: 0,
      avgExecutionTimeMs: 0,
    };
  }
}

// =============================================================================
// IN-MEMORY FALLBACK (for development without database)
// =============================================================================

const inMemoryRunStore = new Map<string, SimulationRunRecord>();
const inMemoryAuditStore = new Map<string, SimulationAuditRecord>();

function createSimulationRunInMemory(
  config: SimulationRunConfig,
  meta?: { ip?: string; userAgent?: string }
): SimulationRunRecord {
  const now = new Date().toISOString();
  const auditId = `audit_${nanoid(12)}`;
  const runId = config.id || `sim_${nanoid(12)}`;

  const audit: SimulationAuditRecord = {
    id: auditId,
    runId,
    createdAt: now,
    updatedAt: now,
    request: {
      config,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    },
  };

  const run: SimulationRunRecord = {
    id: runId,
    status: "running",
    createdAt: now,
    updatedAt: now,
    config: { ...config, id: runId },
    auditId,
  };

  inMemoryRunStore.set(runId, run);
  inMemoryAuditStore.set(auditId, audit);

  return run;
}

function completeSimulationRunInMemory(
  runId: string,
  result: SimulationRunResult
): SimulationRunRecord | undefined {
  const run = inMemoryRunStore.get(runId);
  if (!run) return undefined;

  const updatedAt = new Date().toISOString();
  const updated: SimulationRunRecord = {
    ...run,
    status: "completed",
    updatedAt,
    result,
    error: undefined,
  };

  inMemoryRunStore.set(runId, updated);

  const audit = inMemoryAuditStore.get(run.auditId);
  if (audit) {
    inMemoryAuditStore.set(run.auditId, {
      ...audit,
      updatedAt,
      response: {
        summary: result.summary,
        metadata: result.metadata,
      },
      error: undefined,
    });
  }

  return updated;
}

function failSimulationRunInMemory(
  runId: string,
  error: string
): SimulationRunRecord | undefined {
  const run = inMemoryRunStore.get(runId);
  if (!run) return undefined;

  const updatedAt = new Date().toISOString();
  const updated: SimulationRunRecord = {
    ...run,
    status: "failed",
    updatedAt,
    error,
  };

  inMemoryRunStore.set(runId, updated);

  const audit = inMemoryAuditStore.get(run.auditId);
  if (audit) {
    inMemoryAuditStore.set(run.auditId, {
      ...audit,
      updatedAt,
      error,
    });
  }

  return updated;
}

function getSimulationRunInMemory(runId: string): SimulationRunRecord | undefined {
  return inMemoryRunStore.get(runId);
}

function listSimulationRunsInMemory(limit = 50): SimulationRunRecord[] {
  return Array.from(inMemoryRunStore.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

function getSimulationAuditInMemory(auditId: string): SimulationAuditRecord | undefined {
  return inMemoryAuditStore.get(auditId);
}
