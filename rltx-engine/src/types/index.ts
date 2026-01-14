// ============ WORKFLOW TYPES ============

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    primitiveId: string;
    label: string;
    icon: string;
    color: string;
    config: Record<string, unknown>;
    state: NodeState;
    output?: unknown;
    error?: string;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export type NodeState = "idle" | "pending" | "running" | "completed" | "failed";

// ============ EXECUTION TYPES ============

export interface Execution {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  nodeStates: Record<string, NodeExecutionState>;
  results?: ExecutionResults;
  startedBy: string;
  startedAt?: Date;
  completedAt?: Date;
}

export type ExecutionStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface NodeExecutionState {
  status: NodeState;
  output?: unknown;
  error?: string;
  progress?: number;
  timing?: {
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
  };
}

export interface ExecutionResults {
  recommendation?: {
    action: string;
    confidence: number;
    confidenceInterval?: [number, number];
    reasoning: string;
  };
  outputs: Record<string, unknown>;
  distributions?: Record<string, Distribution>;
}

// ============ DISTRIBUTION TYPES ============

export interface Distribution {
  type: "normal" | "lognormal" | "uniform" | "empirical" | "mixture";
  parameters: Record<string, number>;
  samples?: number[];
  stats?: DistributionStats;
}

export interface DistributionStats {
  mean: number;
  std: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

// ============ PRIMITIVE TYPES ============

export interface Primitive {
  id: string;
  name: string;
  description: string;
  category: PrimitiveCategory;
  icon: string;
  color: string;
  inputs: Port[];
  outputs: Port[];
  config: ConfigSchema;
  executor: ExecutorType;
  estimatedCost: { dollars: number };
  estimatedTime: { p50: number; p95: number };
}

export type PrimitiveCategory =
  | "data"
  | "reason"
  | "simulate"
  | "optimize"
  | "human"
  | "output"
  | "control";

export type ExecutorType = "llm" | "compute" | "external" | "human" | "internal";

export interface Port {
  id: string;
  name: string;
  type: "any" | "string" | "number" | "object" | "array" | "boolean" | "distribution";
  required: boolean;
  description?: string;
}

export interface ConfigSchema {
  type: "object";
  properties: Record<string, ConfigProperty>;
  required?: string[];
}

export interface ConfigProperty {
  type: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
}

// ============ DAG TYPES ============

export interface DAGNode {
  id: string;
  primitiveId: string;
  config: Record<string, unknown>;
  dependencies: string[]; // Node IDs this depends on
  dependents: string[]; // Node IDs that depend on this
  level: number; // Execution level (0 = no dependencies)
}

export interface ExecutionPlan {
  levels: string[][]; // Node IDs grouped by execution level
  totalNodes: number;
  estimatedDurationMs: number;
  estimatedCostDollars: number;
}

// ============ WEBSOCKET EVENTS ============

export interface ServerToClientEvents {
  "execution:started": {
    executionId: string;
    workflowId: string;
    plan: ExecutionPlan;
  };
  "execution:phase": {
    executionId: string;
    phase: string;
    level: number;
    totalLevels: number;
  };
  "node:started": {
    executionId: string;
    nodeId: string;
    primitiveId: string;
  };
  "node:progress": {
    executionId: string;
    nodeId: string;
    progress: number;
    message?: string;
  };
  "node:output_stream": {
    executionId: string;
    nodeId: string;
    chunk: string;
    isPartial: boolean;
  };
  "node:completed": {
    executionId: string;
    nodeId: string;
    output: unknown;
    distribution?: Distribution;
    timing: {
      startedAt: string;
      completedAt: string;
      durationMs: number;
    };
  };
  "node:failed": {
    executionId: string;
    nodeId: string;
    error: string;
    recoverable: boolean;
  };
  "execution:completed": {
    executionId: string;
    results: ExecutionResults;
  };
  "execution:failed": {
    executionId: string;
    error: string;
    failedNodeId?: string;
  };
}

export interface ClientToServerEvents {
  "execution:join": { executionId: string };
  "execution:leave": { executionId: string };
  "execution:pause": { executionId: string };
  "execution:resume": { executionId: string };
  "execution:cancel": { executionId: string };
}

// ============ API TYPES ============

export interface StartExecutionRequest {
  workflowId: string;
  graph: WorkflowGraph;
  options?: {
    maxParallelism?: number;
    enableCheckpoints?: boolean;
    domain?: "enterprise" | "defense";
  };
  startedBy: string;
}

export interface StartExecutionResponse {
  executionId: string;
  workflowId: string;
  status: ExecutionStatus;
  plan: ExecutionPlan;
  websocketRoom: string;
}
