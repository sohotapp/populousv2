// Workflow Executor - Orchestrates execution of the entire workflow

import type { Node, Edge } from "@xyflow/react";
import { nanoid } from "nanoid";
import {
  topologicalSort,
  resolveNodeInputs,
  createExecutionPlan,
  validateDag,
  type ExecutionPlan,
} from "./dag";
import {
  getExecutor,
  ExecutorContext,
  ExecutorResult,
  ExecutionError,
  Distribution,
} from "../executors";
import { primitives } from "../primitives";

export type NodeState = "idle" | "pending" | "running" | "completed" | "failed";

export interface NodeExecutionResult {
  nodeId: string;
  state: NodeState;
  outputs?: Record<string, unknown>;
  distribution?: Distribution;
  error?: string;
  timing?: {
    startedAt: string;
    completedAt: string;
    durationMs: number;
  };
  streamOutput?: string;
}

export interface ExecutionCallbacks {
  onPlanCreated?: (plan: ExecutionPlan) => void;
  onLevelStart?: (level: number, totalLevels: number, nodeIds: string[]) => void;
  onNodeStart?: (nodeId: string, primitiveId: string) => void;
  onNodeProgress?: (nodeId: string, progress: number, message?: string) => void;
  onNodeStream?: (nodeId: string, chunk: string) => void;
  onNodeComplete?: (result: NodeExecutionResult) => void;
  onNodeFailed?: (nodeId: string, error: string, recoverable: boolean) => void;
  onExecutionComplete?: (results: Map<string, NodeExecutionResult>) => void;
  onExecutionFailed?: (error: string, failedNodeId?: string) => void;
}

export interface ExecutionOptions {
  maxRetries?: number;
  stopOnError?: boolean;
  abortSignal?: AbortSignal;
}

/**
 * Execute a workflow DAG
 */
export async function executeWorkflow(
  nodes: Node[],
  edges: Edge[],
  callbacks: ExecutionCallbacks,
  options: ExecutionOptions = {}
): Promise<Map<string, NodeExecutionResult>> {
  const { maxRetries = 3, stopOnError = true, abortSignal } = options;

  // Validate DAG first
  const validation = validateDag(nodes, edges);
  if (!validation.valid) {
    const errorMsg = `Invalid workflow: ${validation.errors.join(", ")}`;
    callbacks.onExecutionFailed?.(errorMsg);
    throw new Error(errorMsg);
  }

  // Create execution plan
  const plan = createExecutionPlan(nodes, edges, primitives);
  callbacks.onPlanCreated?.(plan);

  // Track outputs and results
  const completedOutputs = new Map<string, Record<string, unknown>>();
  const results = new Map<string, NodeExecutionResult>();

  // Initialize all nodes as pending
  for (const node of nodes) {
    results.set(node.id, { nodeId: node.id, state: "pending" });
  }

  try {
    // Execute level by level
    for (let levelIndex = 0; levelIndex < plan.levels.length; levelIndex++) {
      const level = plan.levels[levelIndex];
      callbacks.onLevelStart?.(levelIndex, plan.levels.length, level.nodeIds);

      // Check abort signal
      if (abortSignal?.aborted) {
        throw new ExecutionError("ABORTED", "Execution was cancelled", false);
      }

      // Execute all nodes in this level in parallel
      const levelPromises = level.nodeIds.map(async (nodeId) => {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) {
          throw new Error(`Node ${nodeId} not found`);
        }

        const primitiveId = (node.data as { primitiveId?: string })?.primitiveId;
        if (!primitiveId) {
          throw new Error(`Node ${nodeId} has no primitiveId`);
        }

        const config = (node.data as { config?: Record<string, unknown> })?.config || {};

        // Get executor for this primitive
        const executor = getExecutor(primitiveId);
        if (!executor) {
          // No executor - use mock execution
          return executeNodeMock(nodeId, primitiveId, callbacks);
        }

        // Resolve inputs from upstream nodes
        const inputs = resolveNodeInputs(nodeId, edges, completedOutputs);

        // Create execution context
        let streamOutput = "";
        const context: ExecutorContext = {
          nodeId,
          primitiveId,
          config,
          inputs,
          onProgress: (progress, message) => {
            callbacks.onNodeProgress?.(nodeId, progress, message);
          },
          onStream: (chunk) => {
            streamOutput += chunk;
            callbacks.onNodeStream?.(nodeId, chunk);
          },
          abortSignal,
        };

        // Notify node starting
        callbacks.onNodeStart?.(nodeId, primitiveId);
        results.set(nodeId, { nodeId, state: "running" });

        try {
          // Execute with retry
          const result = await executor.executeWithRetry(context, maxRetries);

          // Store outputs for downstream nodes
          completedOutputs.set(nodeId, result.outputs);

          // Create result
          const nodeResult: NodeExecutionResult = {
            nodeId,
            state: "completed",
            outputs: result.outputs,
            distribution: result.distribution,
            timing: result.timing,
            streamOutput: streamOutput || undefined,
          };

          results.set(nodeId, nodeResult);
          callbacks.onNodeComplete?.(nodeResult);

          return nodeResult;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const recoverable = error instanceof ExecutionError ? error.recoverable : false;

          const nodeResult: NodeExecutionResult = {
            nodeId,
            state: "failed",
            error: errorMsg,
          };

          results.set(nodeId, nodeResult);
          callbacks.onNodeFailed?.(nodeId, errorMsg, recoverable);

          if (stopOnError) {
            throw error;
          }

          return nodeResult;
        }
      });

      // Wait for all nodes in level to complete
      await Promise.all(levelPromises);
    }

    // Execution complete
    callbacks.onExecutionComplete?.(results);
    return results;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const failedNodeId = Array.from(results.entries())
      .find(([, r]) => r.state === "failed")?.[0];
    callbacks.onExecutionFailed?.(errorMsg, failedNodeId);
    throw error;
  }
}

/**
 * Mock execution for primitives without executors (development mode)
 */
async function executeNodeMock(
  nodeId: string,
  primitiveId: string,
  callbacks: ExecutionCallbacks
): Promise<NodeExecutionResult> {
  callbacks.onNodeStart?.(nodeId, primitiveId);

  // Simulate execution time
  const primitive = primitives[primitiveId];
  const duration = primitive?.estimatedTime?.p50 || 1000;

  // Progress updates
  for (let progress = 0; progress <= 100; progress += 20) {
    callbacks.onNodeProgress?.(nodeId, progress, `Processing... ${progress}%`);
    await sleep(duration / 5);
  }

  // Generate mock output based on primitive type
  const mockOutput = generateMockOutput(primitiveId);

  const result: NodeExecutionResult = {
    nodeId,
    state: "completed",
    outputs: mockOutput,
    timing: {
      startedAt: new Date(Date.now() - duration).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: duration,
    },
  };

  callbacks.onNodeComplete?.(result);
  return result;
}

function generateMockOutput(primitiveId: string): Record<string, unknown> {
  const category = primitiveId.split(".")[0];

  switch (category) {
    case "data":
      return {
        result: {
          data: [
            { id: 1, value: Math.random() * 100 },
            { id: 2, value: Math.random() * 100 },
          ],
          count: 2,
        },
      };
    case "reason":
      return {
        result: {
          analysis: "Mock analysis result",
          confidence: 0.75 + Math.random() * 0.2,
          keyFindings: ["Finding 1", "Finding 2"],
        },
      };
    case "sim":
      return {
        result: {
          scenarios: [
            { name: "Best case", probability: 0.3, outcome: 120 },
            { name: "Base case", probability: 0.5, outcome: 100 },
            { name: "Worst case", probability: 0.2, outcome: 70 },
          ],
        },
      };
    case "output":
      return {
        result: {
          recommendation: "Proceed with option A",
          confidence: 0.82,
          reasoning: "Based on the analysis...",
        },
      };
    case "human":
      return {
        result: {
          approved: true,
          feedback: "Looks good",
        },
      };
    default:
      return { result: { success: true } };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a new execution instance
 */
export function createExecution(workflowId: string): string {
  return `exec-${workflowId.slice(0, 8)}-${nanoid(8)}`;
}
