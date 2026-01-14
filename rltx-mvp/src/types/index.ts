export interface Primitive {
  id: string;
  name: string;
  description: string;
  category: "data" | "reason" | "simulate" | "optimize" | "human" | "output" | "control";
  icon: string;
  color: string;
  inputs: Port[];
  outputs: Port[];
  config: ConfigSchema;
  executor: "llm" | "compute" | "external" | "human" | "internal";
  estimatedCost: { dollars: number };
  estimatedTime: { p50: number; p95: number };
}

export interface Port {
  id: string;
  name: string;
  type: "any" | "string" | "number" | "object" | "array" | "boolean" | "distribution";
  required: boolean;
  description?: string;
}

// Distribution type for uncertainty propagation
export interface Distribution {
  type: "normal" | "triangular" | "uniform" | "empirical";
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  mode?: number;
  samples?: number[];
  percentiles?: Record<string, number>;
  confidence?: number;
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

export interface CanvasNode {
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
    timing?: {
      startedAt: string;
      completedAt: string;
      durationMs: number;
    };
  };
}

export interface CanvasEdge {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
  animated?: boolean;
}

export type NodeState = "idle" | "pending" | "running" | "completed" | "failed";

export interface Workflow {
  id: string;
  name: string;
  question: string;
  description?: string;
  graph: {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
  };
  status: "draft" | "ready" | "archived";
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Execution {
  id: string;
  workflowId: string;
  status: "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";
  nodeResults?: Record<string, NodeResult>;
  results?: ExecutionResults;
  startedBy: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface NodeResult {
  state: NodeState;
  output?: unknown;
  error?: string;
  timing?: {
    startedAt: string;
    completedAt: string;
    durationMs: number;
  };
}

export interface ExecutionResults {
  recommendation?: {
    action: string;
    confidence: number;
    reasoning: string;
  };
  outputs: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  workflow?: {
    id: string;
    name: string;
    nodeCount: number;
    nodes: CanvasNode[];
    edges: CanvasEdge[];
  };
  timestamp: string;
}
