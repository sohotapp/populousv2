// Executor types and interfaces for RLTX primitive execution

export type ExecutorType = "llm" | "compute" | "external" | "human" | "internal";

export interface Distribution {
  type: "normal" | "lognormal" | "uniform" | "triangular" | "empirical" | "mixture";
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  mode?: number;
  samples?: number[];
  percentiles?: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
}

export interface ExecutorTiming {
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export interface ExecutorResult {
  outputs: Record<string, unknown>;
  distribution?: Distribution;
  timing: ExecutorTiming;
  metadata?: {
    tokensUsed?: number;
    cost?: number;
    model?: string;
  };
}

export interface ExecutorContext {
  nodeId: string;
  primitiveId: string;
  config: Record<string, unknown>;
  inputs: Record<string, unknown>;
  onProgress: (progress: number, message?: string) => void;
  onStream: (chunk: string) => void;
  abortSignal?: AbortSignal;
}

export interface ExecutorError {
  code: string;
  message: string;
  recoverable: boolean;
  details?: unknown;
}

export class ExecutionError extends Error {
  code: string;
  recoverable: boolean;
  details?: unknown;

  constructor(code: string, message: string, recoverable = false, details?: unknown) {
    super(message);
    this.name = "ExecutionError";
    this.code = code;
    this.recoverable = recoverable;
    this.details = details;
  }
}
