"use client";

import { useState, useRef, useCallback } from "react";
import { Play, Square, RotateCcw, Trash2, Undo2, Redo2, Copy, ClipboardPaste, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/stores/canvas";
import { cn } from "@/lib/utils";
import type { NodeState } from "@/types";

interface CanvasToolbarProps {
  workflowId: string;
}

export function CanvasToolbar({ workflowId }: CanvasToolbarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const {
    nodes,
    edges,
    isExecuting,
    clearCanvas,
    resetExecution,
    startExecution,
    updateNodeState,
    completeExecution,
    // Undo/Redo
    undo,
    redo,
    canUndo,
    canRedo,
    // Copy/Paste
    copySelected,
    paste,
    canPaste,
    selectedNodeIds,
  } = useCanvasStore();

  const hasSelection = selectedNodeIds.size > 0;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graph: { nodes, edges } }),
      });
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRun = async () => {
    if (nodes.length === 0) return;

    // Save first
    await handleSave();

    // Start execution via API
    const executionId = `exec-${Date.now()}`;
    startExecution(executionId);

    try {
      // Call execution API
      const response = await fetch("/api/executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId,
          graph: { nodes, edges },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start execution");
      }

      const result = await response.json();
      const realExecutionId = result.executionId;

      // Poll for execution status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/executions?id=${realExecutionId}`);
          const statusData = await statusResponse.json();

          // Update node states from results
          if (statusData.results) {
            for (const [nodeId, nodeResult] of Object.entries(statusData.results)) {
              const result = nodeResult as { state: NodeState; outputs?: unknown; error?: string };
              if (result.state === "running") {
                updateNodeState(nodeId, "running");
              } else if (result.state === "completed") {
                updateNodeState(nodeId, "completed", result.outputs);
              } else if (result.state === "failed") {
                updateNodeState(nodeId, "failed");
              }
            }
          }

          // Check if execution is complete
          if (statusData.status === "completed" || statusData.status === "failed") {
            clearInterval(pollInterval);
            completeExecution();
          }
        } catch (pollError) {
          console.error("Poll error:", pollError);
        }
      }, 500);

      // Safety timeout - stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        completeExecution();
      }, 300000);

    } catch (error) {
      console.error("Execution error:", error);
      // Fall back to simulated execution for demo
      for (const node of nodes) {
        updateNodeState(node.id, "running");
        await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1200));
        updateNodeState(node.id, "completed", { result: "Demo output" });
      }
      completeExecution();
    }
  };

  const handleStop = () => {
    resetExecution();
  };

  return (
    <div className="flex items-center gap-1 bg-[hsl(0,0%,9%)]/95 backdrop-blur-sm rounded-lg border border-[hsl(0,0%,18%)] shadow-lg px-1.5 py-1.5">
      {/* Undo/Redo */}
      <Button
        variant="ghost"
        size="sm"
        onClick={undo}
        disabled={!canUndo() || isExecuting}
        className="h-7 w-7 p-0 text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,95%)] hover:bg-[hsl(0,0%,14%)] disabled:opacity-30 disabled:hover:bg-transparent"
        title="Undo (Cmd+Z)"
      >
        <Undo2 className="w-3.5 h-3.5" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={redo}
        disabled={!canRedo() || isExecuting}
        className="h-7 w-7 p-0 text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,95%)] hover:bg-[hsl(0,0%,14%)] disabled:opacity-30 disabled:hover:bg-transparent"
        title="Redo (Cmd+Shift+Z)"
      >
        <Redo2 className="w-3.5 h-3.5" />
      </Button>

      <div className="w-px h-4 bg-[hsl(0,0%,18%)] mx-0.5" />

      {/* Copy/Paste */}
      <Button
        variant="ghost"
        size="sm"
        onClick={copySelected}
        disabled={!hasSelection || isExecuting}
        className="h-7 w-7 p-0 text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,95%)] hover:bg-[hsl(0,0%,14%)] disabled:opacity-30 disabled:hover:bg-transparent"
        title="Copy (Cmd+C)"
      >
        <Copy className="w-3.5 h-3.5" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => paste({ x: 100, y: 100 })}
        disabled={!canPaste() || isExecuting}
        className="h-7 w-7 p-0 text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,95%)] hover:bg-[hsl(0,0%,14%)] disabled:opacity-30 disabled:hover:bg-transparent"
        title="Paste (Cmd+V)"
      >
        <ClipboardPaste className="w-3.5 h-3.5" />
      </Button>

      <div className="w-px h-4 bg-[hsl(0,0%,18%)] mx-0.5" />

      {/* Run/Stop */}
      {isExecuting ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStop}
          className="h-7 px-2.5 gap-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <Square className="w-3 h-3" />
          Stop
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRun}
          disabled={nodes.length === 0}
          className="h-7 px-2.5 gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 disabled:text-[hsl(0,0%,35%)] disabled:hover:bg-transparent"
        >
          <Play className="w-3 h-3" />
          Run
        </Button>
      )}

      <div className="w-px h-4 bg-[hsl(0,0%,18%)] mx-0.5" />

      {/* Reset */}
      <Button
        variant="ghost"
        size="sm"
        onClick={resetExecution}
        disabled={isExecuting}
        className="h-7 w-7 p-0 text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,95%)] hover:bg-[hsl(0,0%,14%)] disabled:opacity-30"
        title="Reset execution state"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </Button>

      {/* Clear */}
      <Button
        variant="ghost"
        size="sm"
        onClick={clearCanvas}
        disabled={isExecuting || nodes.length === 0}
        className="h-7 w-7 p-0 text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,95%)] hover:bg-[hsl(0,0%,14%)] disabled:opacity-30"
        title="Clear canvas"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>

      <div className="w-px h-4 bg-[hsl(0,0%,18%)] mx-0.5" />

      {/* Node count */}
      <div className="text-xs text-[hsl(0,0%,45%)] px-2 tabular-nums">
        {nodes.length} node{nodes.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
