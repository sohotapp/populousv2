"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useCanvasStore } from "@/stores/canvas";

// SSE Event types from our streaming endpoint
export interface ExecutionEvent {
  type:
    | "execution:started"
    | "node:started"
    | "node:progress"
    | "node:completed"
    | "node:error"
    | "execution:completed"
    | "execution:error";
  executionId: string;
  nodeId?: string;
  progress?: number;
  message?: string;
  result?: unknown;
  error?: string;
  timestamp: string;
}

// Composed workflow structure
export interface ComposedWorkflow {
  id: string;
  name: string;
  nodeCount: number;
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: {
      primitiveId: string;
      label: string;
      icon: string;
      color: string;
      config: Record<string, unknown>;
      state: string;
    };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    animated: boolean;
    style: { stroke: string; strokeWidth: number };
  }>;
}

// Execution progress tracking
export interface ExecutionProgress {
  executionId: string;
  status: "idle" | "running" | "completed" | "error";
  totalNodes: number;
  completedNodes: number;
  currentNodeId: string | null;
  currentNodeProgress: number;
  currentNodeMessage: string;
  agentCount?: number;
  totalAgents?: number;
  results: Record<string, unknown>;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface UseWorkflowReturn {
  // Composition
  compose: (question: string, workflowId?: string) => Promise<ComposedWorkflow | null>;
  isComposing: boolean;
  composedWorkflow: ComposedWorkflow | null;
  composeError: string | null;

  // Execution
  execute: () => Promise<void>;
  cancelExecution: () => void;
  isExecuting: boolean;
  executionProgress: ExecutionProgress;

  // Workflow management
  loadWorkflow: (workflow: ComposedWorkflow) => void;
  clearWorkflow: () => void;
}

const initialProgress: ExecutionProgress = {
  executionId: "",
  status: "idle",
  totalNodes: 0,
  completedNodes: 0,
  currentNodeId: null,
  currentNodeProgress: 0,
  currentNodeMessage: "",
  results: {},
  error: null,
  startedAt: null,
  completedAt: null,
};

export function useWorkflow(): UseWorkflowReturn {
  // Composition state
  const [isComposing, setIsComposing] = useState(false);
  const [composedWorkflow, setComposedWorkflow] = useState<ComposedWorkflow | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<ExecutionProgress>(initialProgress);

  // Connection ref - supports both AbortController (streaming fetch) and EventSource (legacy)
  const eventSourceRef = useRef<AbortController | EventSource | null>(null);

  // Canvas store
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const loadWorkflowToCanvas = useCanvasStore((s) => s.loadWorkflow);
  const updateNodeState = useCanvasStore((s) => s.updateNodeState);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      const current = eventSourceRef.current;
      if (current) {
        if ("abort" in current) {
          (current as AbortController).abort();
        } else if ("close" in current) {
          (current as EventSource).close();
        }
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Compose workflow from natural language
  const compose = useCallback(async (question: string, workflowId?: string): Promise<ComposedWorkflow | null> => {
    setIsComposing(true);
    setComposeError(null);

    try {
      const response = await fetch("/api/chat/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          workflowId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to compose workflow");
      }

      const data = await response.json();

      if (data.workflow) {
        setComposedWorkflow(data.workflow);
        return data.workflow;
      }

      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setComposeError(message);
      return null;
    } finally {
      setIsComposing(false);
    }
  }, []);

  // Handle SSE events
  const handleExecutionEvent = useCallback((event: ExecutionEvent) => {
    setExecutionProgress((prev) => {
      switch (event.type) {
        case "execution:started":
          return {
            ...prev,
            executionId: event.executionId,
            status: "running",
            startedAt: new Date(),
            error: null,
          };

        case "node:started":
          if (event.nodeId) {
            updateNodeState(event.nodeId, "running");
          }
          return {
            ...prev,
            currentNodeId: event.nodeId || null,
            currentNodeProgress: 0,
            currentNodeMessage: event.message || "Starting...",
          };

        case "node:progress": {
          // Extract agent counts from progress message if present
          let agentCount = prev.agentCount;
          let totalAgents = prev.totalAgents;

          if (event.message) {
            const agentMatch = event.message.match(/(\d+)\s*\/\s*(\d+)\s*agents?/i);
            if (agentMatch) {
              agentCount = parseInt(agentMatch[1], 10);
              totalAgents = parseInt(agentMatch[2], 10);
            }
            // Also try "Processing agent X/Y"
            const processingMatch = event.message.match(/agent\s*(\d+)\s*\/\s*(\d+)/i);
            if (processingMatch) {
              agentCount = parseInt(processingMatch[1], 10);
              totalAgents = parseInt(processingMatch[2], 10);
            }
          }

          // Update node progress on canvas
          if (event.nodeId && event.progress !== undefined) {
            updateNodeState(event.nodeId, "running", undefined, event.progress);
          }

          return {
            ...prev,
            currentNodeProgress: event.progress || 0,
            currentNodeMessage: event.message || "",
            agentCount,
            totalAgents,
          };
        }

        case "node:completed":
          if (event.nodeId) {
            updateNodeState(event.nodeId, "completed", event.result);
          }
          return {
            ...prev,
            completedNodes: prev.completedNodes + 1,
            currentNodeProgress: 100,
            results: event.result
              ? { ...prev.results, [event.nodeId || "unknown"]: event.result }
              : prev.results,
          };

        case "node:error":
          if (event.nodeId) {
            updateNodeState(event.nodeId, "failed");
          }
          return {
            ...prev,
            error: event.error || "Node execution failed",
          };

        case "execution:completed":
          return {
            ...prev,
            status: "completed",
            completedAt: new Date(),
            results: event.result ? { ...prev.results, summary: event.result } : prev.results,
          };

        case "execution:error":
          return {
            ...prev,
            status: "error",
            error: event.error || "Execution failed",
            completedAt: new Date(),
          };

        default:
          return prev;
      }
    });
  }, [updateNodeState]);

  // Start execution with SSE streaming (uses streaming POST response)
  const execute = useCallback(async () => {
    if (nodes.length === 0) {
      setExecutionProgress((prev) => ({
        ...prev,
        error: "No nodes to execute",
      }));
      return;
    }

    // Reset progress
    setExecutionProgress({
      ...initialProgress,
      totalNodes: nodes.length,
      status: "running",
      startedAt: new Date(),
    });
    setIsExecuting(true);

    // Reset all node states
    nodes.forEach((node) => {
      updateNodeState(node.id, "pending");
    });

    // AbortController for cancellation
    const abortController = new AbortController();
    // Store abort controller in ref so cancelExecution can use it
    eventSourceRef.current = abortController;

    try {
      // Start execution via POST with streaming response
      const response = await fetch("/api/executions/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: composedWorkflow?.id || "workflow",
          nodes,
          edges,
          streamResponse: true, // Request streaming response directly
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to start execution");
      }

      // Read SSE stream from response body
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      // Process stream
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          setIsExecuting(false);
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages from buffer
        const messages = buffer.split("\n\n");
        buffer = messages.pop() || ""; // Keep incomplete message in buffer

        for (const message of messages) {
          if (!message.trim()) continue;

          // Parse SSE data line
          const dataMatch = message.match(/^data:\s*(.+)$/m);
          if (dataMatch) {
            try {
              const data: ExecutionEvent = JSON.parse(dataMatch[1]);
              handleExecutionEvent(data);

              // Check for completion
              if (data.type === "execution:completed" || data.type === "execution:error") {
                setIsExecuting(false);
              }
            } catch (e) {
              console.error("Failed to parse SSE event:", e, message);
            }
          }
        }
      }
    } catch (error) {
      // Ignore abort errors (user cancelled)
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      const message = error instanceof Error ? error.message : "Unknown error";
      setExecutionProgress((prev) => ({
        ...prev,
        status: "error",
        error: message,
      }));
      setIsExecuting(false);
    }
  }, [nodes, edges, composedWorkflow, handleExecutionEvent, updateNodeState]);

  // Cancel execution
  const cancelExecution = useCallback(() => {
    const current = eventSourceRef.current;
    if (current) {
      // Handle both AbortController (new) and EventSource (legacy)
      if ("abort" in current) {
        (current as AbortController).abort();
      } else if ("close" in current) {
        (current as EventSource).close();
      }
      eventSourceRef.current = null;
    }
    setIsExecuting(false);
    setExecutionProgress((prev) => ({
      ...prev,
      status: "idle",
      error: "Execution cancelled",
    }));

    // Reset node states
    nodes.forEach((node) => {
      updateNodeState(node.id, "idle");
    });
  }, [nodes, updateNodeState]);

  // Load workflow into canvas
  const loadWorkflow = useCallback((workflow: ComposedWorkflow) => {
    setComposedWorkflow(workflow);
    loadWorkflowToCanvas(
      workflow.nodes as Parameters<typeof loadWorkflowToCanvas>[0],
      workflow.edges as Parameters<typeof loadWorkflowToCanvas>[1]
    );
  }, [loadWorkflowToCanvas]);

  // Clear workflow
  const clearWorkflow = useCallback(() => {
    setComposedWorkflow(null);
    setExecutionProgress(initialProgress);
  }, []);

  return {
    // Composition
    compose,
    isComposing,
    composedWorkflow,
    composeError,

    // Execution
    execute,
    cancelExecution,
    isExecuting,
    executionProgress,

    // Workflow management
    loadWorkflow,
    clearWorkflow,
  };
}
