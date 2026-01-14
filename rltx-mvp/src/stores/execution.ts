import { create } from "zustand";
import { io, Socket } from "socket.io-client";

// WebSocket event types (matching rltx-engine)
interface ExecutionPlan {
  levels: string[][];
  totalNodes: number;
  estimatedDurationMs: number;
  estimatedCostDollars: number;
}

interface Distribution {
  type: "normal" | "lognormal" | "uniform" | "empirical" | "mixture";
  parameters: Record<string, number>;
  samples?: number[];
  stats?: {
    mean: number;
    std: number;
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
}

interface NodeTiming {
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

interface ExecutionResults {
  recommendation?: {
    action: string;
    confidence: number;
    confidenceInterval?: [number, number];
    reasoning: string;
  };
  outputs: Record<string, unknown>;
  distributions?: Record<string, Distribution>;
}

// Server to client events
interface ServerToClientEvents {
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
    timing: NodeTiming;
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

// Client to server events
interface ClientToServerEvents {
  "execution:join": { executionId: string };
  "execution:leave": { executionId: string };
  "execution:pause": { executionId: string };
  "execution:resume": { executionId: string };
  "execution:cancel": { executionId: string };
}

type TypedSocket = Socket;

export type NodeState = "idle" | "pending" | "running" | "completed" | "failed";

export interface NodeExecutionState {
  state: NodeState;
  progress?: number;
  progressMessage?: string;
  output?: unknown;
  distribution?: Distribution;
  error?: string;
  timing?: NodeTiming;
  streamOutput?: string;
}

interface ExecutionStore {
  // Connection state
  socket: TypedSocket | null;
  isConnected: boolean;
  engineUrl: string;

  // Execution state
  currentExecutionId: string | null;
  executionStatus: "idle" | "running" | "paused" | "completed" | "failed";
  executionPlan: ExecutionPlan | null;
  currentPhase: { phase: string; level: number; totalLevels: number } | null;
  nodeStates: Record<string, NodeExecutionState>;
  results: ExecutionResults | null;
  error: string | null;

  // Distributions for visualization
  distributions: Record<string, Distribution>;

  // Actions
  connect: (url?: string) => void;
  disconnect: () => void;
  joinExecution: (executionId: string) => void;
  leaveExecution: () => void;
  pauseExecution: () => void;
  resumeExecution: () => void;
  cancelExecution: () => void;
  resetExecution: () => void;

  // Callbacks for canvas integration
  onNodeStateChange?: (nodeId: string, state: NodeState) => void;
  setNodeStateCallback: (callback: (nodeId: string, state: NodeState) => void) => void;
}

export const useExecutionStore = create<ExecutionStore>((set, get) => ({
  // Initial state
  socket: null,
  isConnected: false,
  engineUrl: process.env.NEXT_PUBLIC_ENGINE_URL || "http://localhost:3001",

  currentExecutionId: null,
  executionStatus: "idle",
  executionPlan: null,
  currentPhase: null,
  nodeStates: {},
  results: null,
  error: null,
  distributions: {},

  onNodeStateChange: undefined,

  setNodeStateCallback: (callback) => {
    set({ onNodeStateChange: callback });
  },

  connect: (url?: string) => {
    const { socket, engineUrl } = get();
    if (socket?.connected) return;

    const targetUrl = url || engineUrl;
    console.log(`[WS] Connecting to ${targetUrl}...`);

    const newSocket = io(targetUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    }) as TypedSocket;

    // Connection events
    newSocket.on("connect", () => {
      console.log("[WS] Connected to engine");
      set({ isConnected: true });
    });

    newSocket.on("disconnect", () => {
      console.log("[WS] Disconnected from engine");
      set({ isConnected: false });
    });

    // Execution events
    newSocket.on("execution:started", (data: ServerToClientEvents["execution:started"]) => {
      console.log("[WS] Execution started:", data.executionId);
      set({
        currentExecutionId: data.executionId,
        executionStatus: "running",
        executionPlan: data.plan,
        nodeStates: {},
        results: null,
        error: null,
      });
    });

    newSocket.on("execution:phase", (data: ServerToClientEvents["execution:phase"]) => {
      console.log(`[WS] Phase: ${data.phase} (${data.level}/${data.totalLevels})`);
      set({
        currentPhase: {
          phase: data.phase,
          level: data.level,
          totalLevels: data.totalLevels,
        },
      });
    });

    // Node events
    newSocket.on("node:started", (data: ServerToClientEvents["node:started"]) => {
      console.log(`[WS] Node started: ${data.nodeId}`);
      const { nodeStates, onNodeStateChange } = get();
      set({
        nodeStates: {
          ...nodeStates,
          [data.nodeId]: { state: "running", progress: 0 },
        },
      });
      onNodeStateChange?.(data.nodeId, "running");
    });

    newSocket.on("node:progress", (data: ServerToClientEvents["node:progress"]) => {
      const { nodeStates } = get();
      const existing = nodeStates[data.nodeId] || { state: "running" };
      set({
        nodeStates: {
          ...nodeStates,
          [data.nodeId]: {
            ...existing,
            progress: data.progress,
            progressMessage: data.message,
          },
        },
      });
    });

    newSocket.on("node:output_stream", (data: ServerToClientEvents["node:output_stream"]) => {
      const { nodeStates } = get();
      const existing = nodeStates[data.nodeId] || { state: "running" };
      const currentStream = existing.streamOutput || "";
      set({
        nodeStates: {
          ...nodeStates,
          [data.nodeId]: {
            ...existing,
            streamOutput: data.isPartial ? currentStream + data.chunk : data.chunk,
          },
        },
      });
    });

    newSocket.on("node:completed", (data: ServerToClientEvents["node:completed"]) => {
      console.log(`[WS] Node completed: ${data.nodeId}`);
      const { nodeStates, distributions, onNodeStateChange } = get();

      const newDistributions = { ...distributions };
      if (data.distribution) {
        newDistributions[data.nodeId] = data.distribution;
      }

      set({
        nodeStates: {
          ...nodeStates,
          [data.nodeId]: {
            state: "completed",
            progress: 100,
            output: data.output,
            distribution: data.distribution,
            timing: data.timing,
          },
        },
        distributions: newDistributions,
      });
      onNodeStateChange?.(data.nodeId, "completed");
    });

    newSocket.on("node:failed", (data: ServerToClientEvents["node:failed"]) => {
      console.log(`[WS] Node failed: ${data.nodeId}`, data.error);
      const { nodeStates, onNodeStateChange } = get();
      set({
        nodeStates: {
          ...nodeStates,
          [data.nodeId]: {
            state: "failed",
            error: data.error,
          },
        },
      });
      onNodeStateChange?.(data.nodeId, "failed");
    });

    // Execution completion events
    newSocket.on("execution:completed", (data: ServerToClientEvents["execution:completed"]) => {
      console.log("[WS] Execution completed:", data.executionId);
      const newDistributions = { ...get().distributions };
      if (data.results.distributions) {
        Object.assign(newDistributions, data.results.distributions);
      }
      set({
        executionStatus: "completed",
        results: data.results,
        distributions: newDistributions,
      });
    });

    newSocket.on("execution:failed", (data: ServerToClientEvents["execution:failed"]) => {
      console.log("[WS] Execution failed:", data.error);
      set({
        executionStatus: "failed",
        error: data.error,
      });
    });

    set({ socket: newSocket, engineUrl: targetUrl });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  joinExecution: (executionId: string) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit("execution:join", { executionId });
      set({ currentExecutionId: executionId });
    }
  },

  leaveExecution: () => {
    const { socket, currentExecutionId } = get();
    if (socket?.connected && currentExecutionId) {
      socket.emit("execution:leave", { executionId: currentExecutionId });
    }
    set({ currentExecutionId: null });
  },

  pauseExecution: () => {
    const { socket, currentExecutionId } = get();
    if (socket?.connected && currentExecutionId) {
      socket.emit("execution:pause", { executionId: currentExecutionId });
      set({ executionStatus: "paused" });
    }
  },

  resumeExecution: () => {
    const { socket, currentExecutionId } = get();
    if (socket?.connected && currentExecutionId) {
      socket.emit("execution:resume", { executionId: currentExecutionId });
      set({ executionStatus: "running" });
    }
  },

  cancelExecution: () => {
    const { socket, currentExecutionId } = get();
    if (socket?.connected && currentExecutionId) {
      socket.emit("execution:cancel", { executionId: currentExecutionId });
      set({ executionStatus: "idle", currentExecutionId: null });
    }
  },

  resetExecution: () => {
    set({
      currentExecutionId: null,
      executionStatus: "idle",
      executionPlan: null,
      currentPhase: null,
      nodeStates: {},
      results: null,
      error: null,
      distributions: {},
    });
  },
}));
