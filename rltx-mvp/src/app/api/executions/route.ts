import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { executions, workflows } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import type { Node, Edge } from "@xyflow/react";
import {
  executeWorkflow,
  createExecutionPlan,
  type NodeExecutionResult,
  type ExecutionCallbacks,
} from "@/lib/engine";
import { primitives } from "@/lib/primitives";
import { nanoid } from "nanoid";

// Railway engine URL (configurable via env)
const ENGINE_URL = process.env.RLTX_ENGINE_URL || "http://localhost:3001";

// In-memory execution state for local mode
const localExecutions = new Map<
  string,
  {
    id: string;
    workflowId: string;
    status: "pending" | "running" | "completed" | "failed";
    results: Map<string, NodeExecutionResult>;
    error?: string;
    createdAt: string;
    completedAt?: string;
  }
>();

// GET /api/executions - List executions (optionally filter by workflowId)
export async function GET(request: NextRequest) {
  try {
    // Demo mode without database
    if (!db) {
      return NextResponse.json({ executions: [] });
    }

    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get("workflowId");

    let query = db.select().from(executions);

    if (workflowId) {
      query = query.where(eq(executions.workflowId, workflowId)) as typeof query;
    }

    const results = await query.orderBy(desc(executions.startedAt));

    // Transform to expected format
    const transformed = results.map((exec) => ({
      id: exec.id,
      workflowId: exec.workflowId,
      status: exec.status,
      startedAt: exec.startedAt?.toISOString(),
      completedAt: exec.completedAt?.toISOString(),
      durationMs: exec.completedAt && exec.startedAt
        ? exec.completedAt.getTime() - exec.startedAt.getTime()
        : undefined,
      nodeCount: Object.keys(exec.nodeResults || {}).length,
      results: exec.nodeResults,
    }));

    return NextResponse.json({ executions: transformed });
  } catch (error) {
    console.error("Failed to fetch executions:", error);
    return NextResponse.json({ executions: [] });
  }
}

// POST /api/executions - Start a new execution via Railway engine
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflowId, graph } = body;

    if (!workflowId) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 }
      );
    }

    // In production, get user from auth
    const userId = "demo-user";

    // If graph is provided directly (from frontend), use it
    // Otherwise fetch from database
    let workflowGraph = graph;

    if (!workflowGraph && db) {
      const [workflow] = await db
        .select()
        .from(workflows)
        .where(eq(workflows.id, workflowId));

      if (!workflow) {
        return NextResponse.json(
          { error: "Workflow not found" },
          { status: 404 }
        );
      }

      workflowGraph = workflow.graph;
    }

    // If no graph available, return error
    if (!workflowGraph) {
      return NextResponse.json(
        { error: "Workflow graph is required" },
        { status: 400 }
      );
    }

    // Try to call Railway engine
    try {
      const engineResponse = await fetch(`${ENGINE_URL}/api/executions/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflowId,
          graph: workflowGraph,
          startedBy: userId,
          options: {
            maxParallelism: 4,
            enableCheckpoints: true,
          },
        }),
      });

      if (!engineResponse.ok) {
        throw new Error(`Engine returned ${engineResponse.status}`);
      }

      const engineResult = await engineResponse.json();

      // Store execution record in database if available
      if (db) {
        await db.insert(executions).values({
          id: engineResult.executionId,
          workflowId,
          status: "running",
          nodeResults: {},
          startedBy: userId,
          startedAt: new Date(),
        });
      }

      return NextResponse.json({
        ...engineResult,
        engineConnected: true,
        websocketUrl: `${ENGINE_URL.replace("http", "ws")}`,
      });
    } catch (engineError) {
      console.warn("Railway engine not available, using local execution:", engineError);

      // Fallback: Use local execution engine
      const executionId = `exec-${nanoid(12)}`;
      const nodes = workflowGraph?.nodes as Node[] || [];
      const edges = workflowGraph?.edges as Edge[] || [];

      // Create execution plan
      const plan = createExecutionPlan(nodes, edges, primitives);

      // Initialize local execution state
      localExecutions.set(executionId, {
        id: executionId,
        workflowId,
        status: "pending",
        results: new Map(),
        createdAt: new Date().toISOString(),
      });

      // Store in database if available
      if (db) {
        await db.insert(executions).values({
          id: executionId,
          workflowId,
          status: "running",
          nodeResults: {},
          startedBy: userId,
          startedAt: new Date(),
        });
      }

      // Start execution in background
      runLocalExecution(executionId, nodes, edges).catch((error) => {
        console.error(`Execution ${executionId} failed:`, error);
      });

      return NextResponse.json({
        executionId,
        workflowId,
        status: "running",
        plan: {
          levels: plan.levels.length,
          totalNodes: plan.totalNodes,
          estimatedDurationMs: plan.estimatedDurationMs,
          estimatedCostDollars: plan.estimatedCostDollars,
        },
        websocketRoom: `execution:${executionId}`,
        engineConnected: false,
        message: "Running with local execution engine",
      });
    }
  } catch (error) {
    console.error("Failed to start execution:", error);
    return NextResponse.json(
      { error: "Failed to start execution" },
      { status: 500 }
    );
  }
}

// Run execution using local engine
async function runLocalExecution(
  executionId: string,
  nodes: Node[],
  edges: Edge[]
): Promise<void> {
  const execution = localExecutions.get(executionId);
  if (!execution) return;

  execution.status = "running";

  const callbacks: ExecutionCallbacks = {
    onNodeStart: (nodeId) => {
      execution.results.set(nodeId, {
        nodeId,
        state: "running",
      });
    },
    onNodeProgress: (nodeId, progress, message) => {
      const existing = execution.results.get(nodeId);
      if (existing) {
        existing.state = "running";
      }
    },
    onNodeComplete: (result) => {
      execution.results.set(result.nodeId, result);
      // Update database if available
      updateExecutionResults(executionId, execution.results);
    },
    onNodeFailed: (nodeId, error) => {
      execution.results.set(nodeId, {
        nodeId,
        state: "failed",
        error,
      });
    },
    onExecutionComplete: () => {
      execution.status = "completed";
      execution.completedAt = new Date().toISOString();
      finalizeExecution(executionId, "completed", execution.results);
    },
    onExecutionFailed: (error) => {
      execution.status = "failed";
      execution.error = error;
      execution.completedAt = new Date().toISOString();
      finalizeExecution(executionId, "failed", execution.results, error);
    },
  };

  try {
    await executeWorkflow(nodes, edges, callbacks, {
      maxRetries: 2,
      stopOnError: false,
    });
  } catch (error) {
    execution.status = "failed";
    execution.error = error instanceof Error ? error.message : String(error);
    execution.completedAt = new Date().toISOString();
  }
}

// Update execution results in database
async function updateExecutionResults(
  executionId: string,
  results: Map<string, NodeExecutionResult>
): Promise<void> {
  if (!db) return;

  try {
    const nodeResults: Record<string, { state: string; outputs?: unknown; error?: string; timing?: unknown }> = {};
    results.forEach((result, nodeId) => {
      nodeResults[nodeId] = {
        state: result.state,
        outputs: result.outputs,
        error: result.error,
        timing: result.timing,
      };
    });

    await db
      .update(executions)
      .set({ nodeResults: nodeResults as typeof executions.$inferInsert.nodeResults })
      .where(eq(executions.id, executionId));
  } catch (error) {
    console.error("Failed to update execution results:", error);
  }
}

// Finalize execution in database
async function finalizeExecution(
  executionId: string,
  status: "completed" | "failed",
  results: Map<string, NodeExecutionResult>,
  _error?: string
): Promise<void> {
  if (!db) return;

  try {
    const nodeResults: Record<string, { state: string; outputs?: unknown; error?: string; timing?: unknown }> = {};
    results.forEach((result, nodeId) => {
      nodeResults[nodeId] = {
        state: result.state,
        outputs: result.outputs,
        error: result.error,
        timing: result.timing,
      };
    });

    await db
      .update(executions)
      .set({
        status,
        nodeResults: nodeResults as typeof executions.$inferInsert.nodeResults,
        completedAt: new Date(),
      })
      .where(eq(executions.id, executionId));
  } catch (dbError) {
    console.error("Failed to finalize execution:", dbError);
  }
}
