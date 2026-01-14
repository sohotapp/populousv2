import { EventEmitter } from "events";
import type {
  WorkflowGraph,
  DAGNode,
  ExecutionPlan,
  NodeExecutionState,
  ExecutionResults,
  Distribution,
  ServerToClientEvents,
} from "../types/index.js";
import { DAGScheduler } from "./dag.js";
import { primitives } from "../primitives/index.js";
import { LLMExecutor } from "../executors/llm.js";
import { InternalExecutor } from "../executors/internal.js";
import { ExternalExecutor } from "../executors/external.js";
import { ComputeExecutor } from "../executors/compute.js";

type EmitFunction = <K extends keyof ServerToClientEvents>(
  event: K,
  data: ServerToClientEvents[K]
) => void;

export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  maxParallelism: number;
  nodeOutputs: Map<string, unknown>;
  nodeStates: Map<string, NodeExecutionState>;
  emit: EmitFunction;
}

/**
 * Execution Engine - Orchestrates DAG execution with parallel processing
 */
export class ExecutionEngine extends EventEmitter {
  private scheduler: DAGScheduler;
  private context: ExecutionContext;
  private plan: ExecutionPlan;
  private completedNodes: Set<string> = new Set();
  private failedNodes: Set<string> = new Set();
  private cancelled = false;
  private paused = false;

  // Executors for different primitive types
  private llmExecutor: LLMExecutor;
  private internalExecutor: InternalExecutor;
  private externalExecutor: ExternalExecutor;
  private computeExecutor: ComputeExecutor;

  constructor(
    graph: WorkflowGraph,
    executionId: string,
    workflowId: string,
    emit: EmitFunction,
    options: { maxParallelism?: number } = {}
  ) {
    super();
    this.scheduler = new DAGScheduler(graph);
    this.plan = this.scheduler.createExecutionPlan();

    this.context = {
      executionId,
      workflowId,
      maxParallelism: options.maxParallelism || 4,
      nodeOutputs: new Map(),
      nodeStates: new Map(),
      emit,
    };

    // Initialize executors
    this.llmExecutor = new LLMExecutor();
    this.internalExecutor = new InternalExecutor();
    this.externalExecutor = new ExternalExecutor();
    this.computeExecutor = new ComputeExecutor();
  }

  /**
   * Get execution plan for estimation
   */
  getPlan(): ExecutionPlan {
    return this.plan;
  }

  /**
   * Run the complete workflow
   */
  async run(): Promise<ExecutionResults> {
    const { executionId, workflowId, emit } = this.context;

    // Emit start event
    emit("execution:started", {
      executionId,
      workflowId,
      plan: this.plan,
    });

    try {
      // Execute level by level
      for (let level = 0; level < this.plan.levels.length; level++) {
        if (this.cancelled) {
          throw new Error("Execution cancelled");
        }

        while (this.paused) {
          await this.sleep(1000);
        }

        const nodeIds = this.plan.levels[level];

        emit("execution:phase", {
          executionId,
          phase: `Level ${level + 1}`,
          level: level + 1,
          totalLevels: this.plan.levels.length,
        });

        // Execute all nodes at this level in parallel (up to maxParallelism)
        await this.executeLevel(nodeIds);

        // Check if any node failed
        if (this.failedNodes.size > 0) {
          const failedId = Array.from(this.failedNodes)[0];
          const state = this.context.nodeStates.get(failedId);
          throw new Error(`Node ${failedId} failed: ${state?.error}`);
        }
      }

      // Gather results
      const results = this.gatherResults();

      emit("execution:completed", {
        executionId,
        results,
      });

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      emit("execution:failed", {
        executionId,
        error: errorMessage,
        failedNodeId: Array.from(this.failedNodes)[0],
      });
      throw error;
    }
  }

  /**
   * Execute all nodes at a given level with parallelism control
   */
  private async executeLevel(nodeIds: string[]): Promise<void> {
    const { maxParallelism } = this.context;

    // Split into batches based on parallelism
    const batches: string[][] = [];
    for (let i = 0; i < nodeIds.length; i += maxParallelism) {
      batches.push(nodeIds.slice(i, i + maxParallelism));
    }

    // Execute each batch
    for (const batch of batches) {
      await Promise.all(batch.map((nodeId) => this.executeNode(nodeId)));
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(nodeId: string): Promise<void> {
    const { executionId, emit, nodeOutputs, nodeStates } = this.context;
    const dagNode = this.scheduler.getNode(nodeId);
    const workflowNode = this.scheduler.getWorkflowNode(nodeId);

    if (!dagNode || !workflowNode) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const primitive = primitives[dagNode.primitiveId];
    if (!primitive) {
      throw new Error(`Unknown primitive: ${dagNode.primitiveId}`);
    }

    const startedAt = new Date().toISOString();

    // Update state to running
    nodeStates.set(nodeId, {
      status: "running",
      timing: { startedAt },
    });

    emit("node:started", {
      executionId,
      nodeId,
      primitiveId: dagNode.primitiveId,
    });

    try {
      // Gather inputs from dependencies
      const inputs = this.gatherInputs(nodeId);

      // Execute based on executor type
      const output = await this.executeWithExecutor(
        primitive.executor,
        nodeId,
        dagNode,
        workflowNode.data.config,
        inputs
      );

      const completedAt = new Date().toISOString();
      const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

      // Store output
      nodeOutputs.set(nodeId, output);
      this.completedNodes.add(nodeId);

      // Check if output contains distribution
      const distribution = this.extractDistribution(output);

      // Update state
      nodeStates.set(nodeId, {
        status: "completed",
        output,
        timing: { startedAt, completedAt, durationMs },
      });

      emit("node:completed", {
        executionId,
        nodeId,
        output,
        distribution,
        timing: { startedAt, completedAt, durationMs },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      nodeStates.set(nodeId, {
        status: "failed",
        error: errorMessage,
        timing: { startedAt },
      });

      this.failedNodes.add(nodeId);

      emit("node:failed", {
        executionId,
        nodeId,
        error: errorMessage,
        recoverable: false,
      });

      throw error;
    }
  }

  /**
   * Execute node with appropriate executor
   */
  private async executeWithExecutor(
    executorType: string,
    nodeId: string,
    dagNode: DAGNode,
    config: Record<string, unknown>,
    inputs: Record<string, unknown>
  ): Promise<unknown> {
    const progressCallback = (progress: number, message?: string) => {
      this.context.emit("node:progress", {
        executionId: this.context.executionId,
        nodeId,
        progress,
        message,
      });
    };

    const streamCallback = (chunk: string, isPartial: boolean) => {
      this.context.emit("node:output_stream", {
        executionId: this.context.executionId,
        nodeId,
        chunk,
        isPartial,
      });
    };

    switch (executorType) {
      case "llm":
        return this.llmExecutor.execute(
          dagNode.primitiveId,
          config,
          inputs,
          { onProgress: progressCallback, onStream: streamCallback }
        );

      case "internal":
        return this.internalExecutor.execute(
          dagNode.primitiveId,
          config,
          inputs
        );

      case "external":
        return this.externalExecutor.execute(
          dagNode.primitiveId,
          config,
          inputs,
          { onProgress: progressCallback }
        );

      case "compute":
        return this.computeExecutor.execute(
          dagNode.primitiveId,
          config,
          inputs,
          { onProgress: progressCallback }
        );

      default:
        throw new Error(`Unknown executor type: ${executorType}`);
    }
  }

  /**
   * Gather inputs from dependency node outputs
   */
  private gatherInputs(nodeId: string): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};
    const edges = this.scheduler.getIncomingEdges(nodeId);

    for (const edge of edges) {
      const sourceOutput = this.context.nodeOutputs.get(edge.source);
      const targetHandle = edge.targetHandle || "input";

      // If source has a handle, extract that specific output
      if (edge.sourceHandle && typeof sourceOutput === "object" && sourceOutput !== null) {
        inputs[targetHandle] = (sourceOutput as Record<string, unknown>)[edge.sourceHandle];
      } else {
        inputs[targetHandle] = sourceOutput;
      }
    }

    return inputs;
  }

  /**
   * Extract distribution from output if present
   */
  private extractDistribution(output: unknown): Distribution | undefined {
    if (typeof output === "object" && output !== null) {
      const obj = output as Record<string, unknown>;
      if (obj.distribution && typeof obj.distribution === "object") {
        return obj.distribution as Distribution;
      }
      if (obj.outcomeDistribution && typeof obj.outcomeDistribution === "object") {
        return obj.outcomeDistribution as Distribution;
      }
    }
    return undefined;
  }

  /**
   * Gather final results from all outputs
   */
  private gatherResults(): ExecutionResults {
    const outputs: Record<string, unknown> = {};
    const distributions: Record<string, Distribution> = {};

    for (const [nodeId, output] of this.context.nodeOutputs) {
      outputs[nodeId] = output;

      const dist = this.extractDistribution(output);
      if (dist) {
        distributions[nodeId] = dist;
      }
    }

    // Look for recommendation output
    let recommendation: ExecutionResults["recommendation"];
    for (const [nodeId, output] of this.context.nodeOutputs) {
      const node = this.scheduler.getNode(nodeId);
      if (node?.primitiveId === "output.recommendation" && typeof output === "object" && output !== null) {
        const rec = output as Record<string, unknown>;
        recommendation = {
          action: String(rec.action || ""),
          confidence: Number(rec.confidence || 0),
          confidenceInterval: rec.confidenceInterval as [number, number] | undefined,
          reasoning: String(rec.reasoning || ""),
        };
        break;
      }
    }

    return {
      recommendation,
      outputs,
      distributions: Object.keys(distributions).length > 0 ? distributions : undefined,
    };
  }

  /**
   * Pause execution
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resume execution
   */
  resume(): void {
    this.paused = false;
  }

  /**
   * Cancel execution
   */
  cancel(): void {
    this.cancelled = true;
  }

  /**
   * Get current state
   */
  getState(): Record<string, NodeExecutionState> {
    return Object.fromEntries(this.context.nodeStates);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
