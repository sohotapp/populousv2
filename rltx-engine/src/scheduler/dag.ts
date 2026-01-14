import type {
  WorkflowGraph,
  WorkflowNode,
  WorkflowEdge,
  DAGNode,
  ExecutionPlan,
} from "../types/index.js";
import { primitives } from "../primitives/index.js";

/**
 * DAG Scheduler - Handles topological sorting and parallel execution planning
 */
export class DAGScheduler {
  private nodes: Map<string, DAGNode> = new Map();
  private graph: WorkflowGraph;

  constructor(graph: WorkflowGraph) {
    this.graph = graph;
    this.buildDAG();
  }

  /**
   * Build internal DAG representation from workflow graph
   */
  private buildDAG(): void {
    // Initialize all nodes
    for (const node of this.graph.nodes) {
      this.nodes.set(node.id, {
        id: node.id,
        primitiveId: node.data.primitiveId,
        config: node.data.config,
        dependencies: [],
        dependents: [],
        level: 0,
      });
    }

    // Build dependency relationships from edges
    for (const edge of this.graph.edges) {
      const sourceNode = this.nodes.get(edge.source);
      const targetNode = this.nodes.get(edge.target);

      if (sourceNode && targetNode) {
        targetNode.dependencies.push(edge.source);
        sourceNode.dependents.push(edge.target);
      }
    }

    // Calculate execution levels using topological sort
    this.calculateLevels();
  }

  /**
   * Calculate execution levels (Kahn's algorithm variant)
   * Nodes at level 0 have no dependencies and can run first
   * Nodes at level N depend on nodes at levels < N
   */
  private calculateLevels(): void {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];

    // Initialize in-degrees
    for (const [id, node] of this.nodes) {
      inDegree.set(id, node.dependencies.length);
      if (node.dependencies.length === 0) {
        queue.push(id);
        node.level = 0;
      }
    }

    // Process nodes level by level
    let currentLevel = 0;
    while (queue.length > 0) {
      const levelSize = queue.length;
      const nextQueue: string[] = [];

      for (let i = 0; i < levelSize; i++) {
        const nodeId = queue[i];
        const node = this.nodes.get(nodeId)!;
        node.level = currentLevel;

        // Reduce in-degree of dependents
        for (const dependentId of node.dependents) {
          const newDegree = (inDegree.get(dependentId) || 1) - 1;
          inDegree.set(dependentId, newDegree);

          if (newDegree === 0) {
            nextQueue.push(dependentId);
          }
        }
      }

      queue.length = 0;
      queue.push(...nextQueue);
      currentLevel++;
    }

    // Check for cycles (nodes with remaining in-degree > 0)
    for (const [id, degree] of inDegree) {
      if (degree > 0) {
        throw new Error(`Cycle detected in workflow graph involving node: ${id}`);
      }
    }
  }

  /**
   * Create execution plan with nodes grouped by level
   */
  createExecutionPlan(): ExecutionPlan {
    // Group nodes by level
    const levelMap = new Map<number, string[]>();
    let maxLevel = 0;

    for (const [id, node] of this.nodes) {
      maxLevel = Math.max(maxLevel, node.level);
      if (!levelMap.has(node.level)) {
        levelMap.set(node.level, []);
      }
      levelMap.get(node.level)!.push(id);
    }

    // Convert to array of levels
    const levels: string[][] = [];
    for (let i = 0; i <= maxLevel; i++) {
      levels.push(levelMap.get(i) || []);
    }

    // Estimate duration and cost
    let estimatedDurationMs = 0;
    let estimatedCostDollars = 0;

    for (const level of levels) {
      // Duration is max of all nodes in level (parallel execution)
      let maxLevelDuration = 0;
      for (const nodeId of level) {
        const node = this.nodes.get(nodeId)!;
        const primitive = primitives[node.primitiveId];
        if (primitive) {
          maxLevelDuration = Math.max(maxLevelDuration, primitive.estimatedTime.p50);
          estimatedCostDollars += primitive.estimatedCost.dollars;
        }
      }
      estimatedDurationMs += maxLevelDuration;
    }

    return {
      levels,
      totalNodes: this.nodes.size,
      estimatedDurationMs,
      estimatedCostDollars,
    };
  }

  /**
   * Get nodes at a specific execution level
   */
  getNodesAtLevel(level: number): DAGNode[] {
    const result: DAGNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.level === level) {
        result.push(node);
      }
    }
    return result;
  }

  /**
   * Get a specific node by ID
   */
  getNode(id: string): DAGNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get all dependencies for a node (input data sources)
   */
  getDependencies(nodeId: string): DAGNode[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    return node.dependencies
      .map((id) => this.nodes.get(id))
      .filter((n): n is DAGNode => n !== undefined);
  }

  /**
   * Get original workflow node by ID
   */
  getWorkflowNode(id: string): WorkflowNode | undefined {
    return this.graph.nodes.find((n) => n.id === id);
  }

  /**
   * Get edges targeting a specific node
   */
  getIncomingEdges(nodeId: string): WorkflowEdge[] {
    return this.graph.edges.filter((e) => e.target === nodeId);
  }

  /**
   * Check if all dependencies for a node are completed
   */
  areDependenciesComplete(
    nodeId: string,
    completedNodes: Set<string>
  ): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    return node.dependencies.every((depId) => completedNodes.has(depId));
  }

  /**
   * Get execution order as flat array (respecting levels)
   */
  getExecutionOrder(): string[] {
    const plan = this.createExecutionPlan();
    return plan.levels.flat();
  }

  /**
   * Debug: Print DAG structure
   */
  printDAG(): void {
    console.log("\n=== DAG Structure ===");
    const plan = this.createExecutionPlan();
    for (let i = 0; i < plan.levels.length; i++) {
      console.log(`Level ${i}:`);
      for (const nodeId of plan.levels[i]) {
        const node = this.nodes.get(nodeId)!;
        console.log(
          `  - ${nodeId} (${node.primitiveId}) deps: [${node.dependencies.join(", ")}]`
        );
      }
    }
    console.log(
      `\nTotal: ${plan.totalNodes} nodes, ~${Math.round(plan.estimatedDurationMs / 1000)}s, $${plan.estimatedCostDollars.toFixed(2)}`
    );
  }
}
