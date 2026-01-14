"use client";

import { useEffect } from "react";
import { useExecutionStore, NodeState } from "@/stores/execution";
import { useCanvasStore } from "@/stores/canvas";
import { DistributionChart, ConfidenceDisplay } from "@/components/visualization/DistributionChart";
import {
  Play,
  Pause,
  Square,
  Loader2,
  Check,
  X,
  Activity,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ExecutionPanel() {
  const {
    isConnected,
    executionStatus,
    executionPlan,
    currentPhase,
    nodeStates,
    results,
    error,
    distributions,
    connect,
    disconnect,
    pauseExecution,
    resumeExecution,
    cancelExecution,
    resetExecution,
    setNodeStateCallback,
  } = useExecutionStore();

  const { nodes, updateNodeState } = useCanvasStore();

  // Connect on mount and set up node state sync
  useEffect(() => {
    connect();

    // Set up callback to sync node states to canvas
    setNodeStateCallback((nodeId: string, state: NodeState) => {
      updateNodeState(nodeId, state);
    });

    return () => {
      disconnect();
    };
  }, [connect, disconnect, setNodeStateCallback, updateNodeState]);

  // Calculate progress
  const completedNodes = Object.values(nodeStates).filter(
    (s) => s.state === "completed"
  ).length;
  const totalNodes = executionPlan?.totalNodes || nodes.length;
  const progressPercent = totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 0;

  return (
    <div className="h-full flex flex-col bg-[hsl(0,0%,7%)]">
      {/* Header - seamless, no border */}
      <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0">
        <span className="text-[hsl(0,0%,65%)] text-[13px] font-medium">
          Execution
        </span>
        <div className="flex items-center gap-2">
          {/* Connection indicator - subtle dot */}
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                isConnected ? "bg-[hsl(140,50%,45%)]" : "bg-[hsl(0,0%,30%)]"
              )}
            />
            <span className="text-[10px] text-[hsl(0,0%,40%)]">
              {isConnected ? "Connected" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 relative">
        {/* Status indicator - inline, subtle */}
        {executionStatus !== "idle" && (
          <div className="pb-4">
            <div className="flex items-center gap-2 mb-2">
              <StatusIndicator status={executionStatus} />
              <span className="text-[12px] text-[hsl(0,0%,60%)]">
                {completedNodes}/{totalNodes} nodes
              </span>
            </div>

            {/* Progress bar - subtle */}
            <div className="h-1 bg-[hsl(0,0%,12%)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[hsl(0,0%,50%)] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {currentPhase && (
              <p className="text-[10px] text-[hsl(0,0%,35%)] mt-1.5">
                {currentPhase.phase}
              </p>
            )}
          </div>
        )}

        {/* Controls - subtle buttons */}
        {executionStatus === "running" && (
          <div className="flex gap-2 pb-4">
            <button
              onClick={pauseExecution}
              className="flex-1 h-7 text-[12px] text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,75%)] hover:bg-[hsl(0,0%,10%)] rounded flex items-center justify-center gap-1.5 transition-colors duration-100"
            >
              <Pause className="w-3 h-3" />
              Pause
            </button>
            <button
              onClick={cancelExecution}
              className="flex-1 h-7 text-[12px] text-[hsl(0,0%,55%)] hover:text-[hsl(0,50%,60%)] hover:bg-[hsl(0,0%,10%)] rounded flex items-center justify-center gap-1.5 transition-colors duration-100"
            >
              <Square className="w-3 h-3" />
              Cancel
            </button>
          </div>
        )}

        {executionStatus === "paused" && (
          <div className="flex gap-2 pb-4">
            <button
              onClick={resumeExecution}
              className="flex-1 h-7 text-[12px] text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,75%)] hover:bg-[hsl(0,0%,10%)] rounded flex items-center justify-center gap-1.5 transition-colors duration-100"
            >
              <Play className="w-3 h-3" />
              Resume
            </button>
            <button
              onClick={cancelExecution}
              className="flex-1 h-7 text-[12px] text-[hsl(0,0%,55%)] hover:text-[hsl(0,50%,60%)] hover:bg-[hsl(0,0%,10%)] rounded flex items-center justify-center gap-1.5 transition-colors duration-100"
            >
              <Square className="w-3 h-3" />
              Cancel
            </button>
          </div>
        )}

        {(executionStatus === "completed" || executionStatus === "failed") && (
          <div className="pb-4">
            <button
              onClick={resetExecution}
              className="w-full h-7 text-[12px] text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,75%)] hover:bg-[hsl(0,0%,10%)] rounded flex items-center justify-center gap-1.5 transition-colors duration-100"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        )}

        {/* Error Display - subtle */}
        {error && (
          <div className="pb-4">
            <div className="p-2.5 rounded bg-[hsl(0,40%,12%)]">
              <p className="text-[11px] text-[hsl(0,50%,60%)] font-medium mb-1">
                Execution failed
              </p>
              <p className="text-[11px] text-[hsl(0,40%,55%)] leading-relaxed">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Results Section */}
        {results?.recommendation && (
          <div className="pb-4">
            <p className="text-[11px] text-[hsl(0,0%,40%)] uppercase tracking-wide mb-2">
              Recommendation
            </p>
            <div className="p-3 rounded bg-[hsl(0,0%,10%)]">
              <p className="text-[14px] font-medium text-[hsl(0,0%,85%)] mb-1">
                {results.recommendation.action}
              </p>
              <p className="text-[12px] text-[hsl(0,0%,55%)] mb-3 leading-relaxed">
                {results.recommendation.reasoning}
              </p>
              {results.recommendation.confidenceInterval ? (
                <ConfidenceDisplay
                  mean={results.recommendation.confidence}
                  lower={results.recommendation.confidenceInterval[0]}
                  upper={results.recommendation.confidenceInterval[1]}
                  label="Confidence"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[hsl(0,0%,40%)]">Confidence</span>
                  <div className="flex-1 h-1 bg-[hsl(0,0%,15%)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[hsl(0,0%,50%)]"
                      style={{ width: `${results.recommendation.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-[hsl(0,0%,60%)] tabular-nums">
                    {(results.recommendation.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Distributions */}
        {Object.entries(distributions).length > 0 && (
          <div className="pb-4">
            <p className="text-[11px] text-[hsl(0,0%,40%)] uppercase tracking-wide mb-2">
              Distributions
            </p>
            <div className="space-y-2">
              {Object.entries(distributions).map(([nodeId, dist]) => (
                <DistributionChart
                  key={nodeId}
                  distribution={dist}
                  title={getNodeLabel(nodeId, nodes)}
                  showStats={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* Node States */}
        {Object.keys(nodeStates).length > 0 && (
          <div className="pb-4">
            <p className="text-[11px] text-[hsl(0,0%,40%)] uppercase tracking-wide mb-2">
              Nodes
            </p>
            <div className="space-y-1">
              {Object.entries(nodeStates).map(([nodeId, state]) => (
                <NodeStatusRow
                  key={nodeId}
                  label={getNodeLabel(nodeId, nodes)}
                  state={state}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {executionStatus === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ top: '-10%' }}>
            <p className="text-[13px] text-[hsl(0,0%,45%)]">
              No execution running
            </p>
            <p className="text-[11px] text-[hsl(0,0%,30%)] mt-1">
              Run workflow to see results
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusIndicator({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    idle: {
      color: "text-[hsl(0,0%,45%)]",
      icon: <Activity className="w-3 h-3" />,
      label: "Idle",
    },
    running: {
      color: "text-[hsl(210,60%,60%)]",
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      label: "Running",
    },
    paused: {
      color: "text-[hsl(40,60%,55%)]",
      icon: <Pause className="w-3 h-3" />,
      label: "Paused",
    },
    completed: {
      color: "text-[hsl(140,45%,55%)]",
      icon: <Check className="w-3 h-3" />,
      label: "Completed",
    },
    failed: {
      color: "text-[hsl(0,50%,55%)]",
      icon: <X className="w-3 h-3" />,
      label: "Failed",
    },
  };

  const { color, icon, label } = config[status] || config.idle;

  return (
    <div className={cn("flex items-center gap-1.5 text-[12px]", color)}>
      {icon}
      {label}
    </div>
  );
}

function NodeStatusRow({
  label,
  state,
}: {
  label: string;
  state: {
    state: string;
    progress?: number;
    progressMessage?: string;
    error?: string;
    timing?: { durationMs?: number };
  };
}) {
  const stateConfig: Record<string, { color: string; dotColor: string }> = {
    idle: { color: "text-[hsl(0,0%,50%)]", dotColor: "bg-[hsl(0,0%,35%)]" },
    pending: { color: "text-[hsl(0,0%,50%)]", dotColor: "bg-[hsl(0,0%,35%)]" },
    running: { color: "text-[hsl(210,60%,60%)]", dotColor: "bg-[hsl(210,60%,60%)]" },
    completed: { color: "text-[hsl(140,45%,55%)]", dotColor: "bg-[hsl(140,45%,55%)]" },
    failed: { color: "text-[hsl(0,50%,55%)]", dotColor: "bg-[hsl(0,50%,55%)]" },
  };

  const { color, dotColor } = stateConfig[state.state] || stateConfig.idle;

  return (
    <div className="py-1.5 px-2 rounded hover:bg-[hsl(0,0%,10%)] transition-colors duration-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            dotColor,
            state.state === "running" && "animate-pulse"
          )} />
          <span className={cn("text-[12px] truncate max-w-[160px]", color)}>
            {label}
          </span>
        </div>
        {state.timing?.durationMs && (
          <span className="text-[10px] text-[hsl(0,0%,40%)] tabular-nums">
            {(state.timing.durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>
      {state.state === "running" && state.progress !== undefined && (
        <div className="mt-1.5 ml-3.5">
          <div className="h-0.5 bg-[hsl(0,0%,15%)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[hsl(210,60%,60%)] transition-all duration-300"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </div>
      )}
      {state.error && (
        <p className="text-[10px] text-[hsl(0,50%,55%)] mt-1 ml-3.5 truncate">
          {state.error}
        </p>
      )}
    </div>
  );
}

// Helper to get node label from nodes array
function getNodeLabel(nodeId: string, nodes: { id: string; data: { label?: string } }[]): string {
  const node = nodes.find((n) => n.id === nodeId);
  return node?.data?.label || nodeId.split("-")[0];
}
