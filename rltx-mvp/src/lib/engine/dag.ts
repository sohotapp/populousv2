// DAG Analysis and Topological Sorting for workflow execution

import type { Node, Edge } from "@xyflow/react";

export interface ExecutionLevel {
  level: number;
  nodeIds: string[];
}

export interface ExecutionPlan {
  levels: ExecutionLevel[];
  totalNodes: number;
  parallelizable: number;
  estimatedDurationMs: number;
  estimatedCostDollars: number;
}

export interface NodeDependencies {
  nodeId: string;
  dependsOn: string[]; // Upstream node IDs
  feedsInto: string[]; // Downstream node IDs
}

/**
 * Build adjacency lists for the DAG
 */
export function buildAdjacencyLists(
  nodes: Node[],
  edges: Edge[]
): {
  inbound: Map<string, string[]>;
  outbound: Map<string, string[]>;
} {
  const inbound = new Map<string, string[]>();
  const outbound = new Map<string, string[]>();

  // Initialize all nodes
  for (const node of nodes) {
    inbound.set(node.id, []);
    outbound.set(node.id, []);
  }

  // Build adjacency from edges
  for (const edge of edges) {
    const sourceOutbound = outbound.get(edge.source) || [];
    sourceOutbound.push(edge.target);
    outbound.set(edge.source, sourceOutbound);

    const targetInbound = inbound.get(edge.target) || [];
    targetInbound.push(edge.source);
    inbound.set(edge.target, targetInbound);
  }

  return { inbound, outbound };
}

/**
 * Perform topological sort using Kahn's algorithm
 * Returns nodes grouped by execution level (nodes in same level can run in parallel)
 */
export function topologicalSort(nodes: Node[], edges: Edge[]): string[][] {
  if (nodes.length === 0) return [];

  const { inbound, outbound } = buildAdjacencyLists(nodes, edges);

  // Track in-degree for each node
  const inDegree = new Map<string, number>();
  for (const node of nodes) {
    inDegree.set(node.id, inbound.get(node.id)?.length || 0);
  }

  // Collect nodes with no dependencies (in-degree = 0)
  const levels: string[][] = [];
  const processed = new Set<string>();

  while (processed.size < nodes.length) {
    // Find all nodes with in-degree 0 that haven't been processed
    const currentLevel: string[] = [];

    for (const node of nodes) {
      if (!processed.has(node.id) && (inDegree.get(node.id) || 0) === 0) {
        currentLevel.push(node.id);
      }
    }

    if (currentLevel.length === 0) {
      // Cycle detected - no nodes have in-degree 0
      throw new Error("Workflow contains a cycle - cannot execute");
    }

    // Add current level and mark nodes as processed
    levels.push(currentLevel);

    for (const nodeId of currentLevel) {
      processed.add(nodeId);

      // Decrease in-degree of all dependent nodes
      const dependents = outbound.get(nodeId) || [];
      for (const dependent of dependents) {
        const currentDegree = inDegree.get(dependent) || 0;
        inDegree.set(dependent, currentDegree - 1);
      }
    }
  }

  return levels;
}

/**
 * Get all dependencies for a specific node
 */
export function getNodeDependencies(
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
): NodeDependencies {
  const { inbound, outbound } = buildAdjacencyLists(nodes, edges);

  return {
    nodeId,
    dependsOn: inbound.get(nodeId) || [],
    feedsInto: outbound.get(nodeId) || [],
  };
}

/**
 * Get inputs for a node from completed upstream outputs
 */
export function resolveNodeInputs(
  nodeId: string,
  edges: Edge[],
  completedOutputs: Map<string, Record<string, unknown>>
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};

  // Find all edges pointing to this node
  const incomingEdges = edges.filter((e) => e.target === nodeId);

  for (const edge of incomingEdges) {
    const sourceOutputs = completedOutputs.get(edge.source);
    if (!sourceOutputs) continue;

    // Map source output to target input based on handle IDs
    const sourceHandle = edge.sourceHandle || "result";
    const targetHandle = edge.targetHandle || "data";

    // Get the output value from source
    const outputValue = sourceOutputs[sourceHandle] ?? sourceOutputs.result ?? Object.values(sourceOutputs)[0];

    inputs[targetHandle] = outputValue;
  }

  return inputs;
}

/**
 * Create execution plan with estimated time and cost
 */
export function createExecutionPlan(
  nodes: Node[],
  edges: Edge[],
  primitives: Record<string, { estimatedTime?: { p50: number; p95: number }; estimatedCost?: { dollars: number } }>
): ExecutionPlan {
  const levels = topologicalSort(nodes, edges);

  let totalDurationMs = 0;
  let totalCostDollars = 0;
  let parallelizable = 0;

  for (const level of levels) {
    let maxDurationInLevel = 0;
    let levelCost = 0;

    for (const nodeId of level) {
      const node = nodes.find((n) => n.id === nodeId);
      const primitiveId = (node?.data as { primitiveId?: string })?.primitiveId;
      const primitive = primitiveId ? primitives[primitiveId] : undefined;

      const duration = primitive?.estimatedTime?.p50 || 1000;
      const cost = primitive?.estimatedCost?.dollars || 0;

      maxDurationInLevel = Math.max(maxDurationInLevel, duration);
      levelCost += cost;
    }

    // Parallel nodes: take max duration (they run simultaneously)
    totalDurationMs += maxDurationInLevel;
    totalCostDollars += levelCost;

    if (level.length > 1) {
      parallelizable += level.length - 1;
    }
  }

  return {
    levels: levels.map((nodeIds, index) => ({ level: index, nodeIds })),
    totalNodes: nodes.length,
    parallelizable,
    estimatedDurationMs: totalDurationMs,
    estimatedCostDollars: totalCostDollars,
  };
}

/**
 * Validate DAG structure
 */
export function validateDag(nodes: Node[], edges: Edge[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for cycles
  try {
    topologicalSort(nodes, edges);
  } catch (e) {
    errors.push((e as Error).message);
  }

  // Check for orphaned edges (edges to/from non-existent nodes)
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge references non-existent source node: ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge references non-existent target node: ${edge.target}`);
    }
  }

  // Check for self-loops
  for (const edge of edges) {
    if (edge.source === edge.target) {
      errors.push(`Self-loop detected on node: ${edge.source}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
