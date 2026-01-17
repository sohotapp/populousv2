"use client";

import { useMemo } from "react";
import { useCanvasStore } from "@/stores/canvas";
import type { ExecutionProgress } from "@/hooks/useWorkflow";
import {
  Play,
  Square,
  Loader2,
  Check,
  X,
  Activity,
  RotateCcw,
  Users,
  Clock,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExecutionPanelProps {
  progress: ExecutionProgress;
  onCancel?: () => void;
  onReset?: () => void;
  onRun?: () => void;
  isExecuting?: boolean;
  className?: string;
}

export function ExecutionPanel({
  progress,
  onCancel,
  onReset,
  onRun,
  isExecuting = false,
  className,
}: ExecutionPanelProps) {
  const nodes = useCanvasStore((s) => s.nodes);

  // Calculate overall progress
  const progressPercent = useMemo(() => {
    if (progress.totalNodes === 0) return 0;
    const nodeProgress = (progress.completedNodes / progress.totalNodes) * 100;
    const currentProgress = progress.currentNodeProgress / progress.totalNodes;
    return Math.min(100, nodeProgress + currentProgress);
  }, [progress.completedNodes, progress.totalNodes, progress.currentNodeProgress]);

  // Calculate elapsed time
  const elapsedTime = useMemo(() => {
    if (!progress.startedAt) return null;
    const endTime = progress.completedAt || new Date();
    const elapsed = endTime.getTime() - progress.startedAt.getTime();
    return formatDuration(elapsed);
  }, [progress.startedAt, progress.completedAt]);

  // Get current node info
  const currentNode = useMemo(() => {
    if (!progress.currentNodeId) return null;
    return nodes.find((n) => n.id === progress.currentNodeId);
  }, [nodes, progress.currentNodeId]);

  return (
    <div className={cn("h-full flex flex-col bg-[hsl(0,0%,7%)]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 flex-shrink-0">
        <span className="text-[hsl(0,0%,65%)] text-[13px] font-medium">
          Execution
        </span>
        <div className="flex items-center gap-2">
          <StatusBadge status={progress.status} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 relative">
        {/* Running State */}
        {progress.status === "running" && (
          <div className="space-y-4">
            {/* Overall Progress */}
            <div className="pb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] text-[hsl(0,0%,60%)]">
                  {progress.completedNodes}/{progress.totalNodes} nodes
                </span>
                {elapsedTime && (
                  <span className="text-[11px] text-[hsl(0,0%,45%)] tabular-nums flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {elapsedTime}
                  </span>
                )}
              </div>
              <div className="h-1.5 bg-[hsl(0,0%,12%)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[hsl(210,60%,55%)] transition-all duration-200 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Live Agent Count - Key feature for simulations */}
            {progress.totalAgents && progress.agentCount !== undefined && (
              <div className="p-3 rounded-md bg-[hsl(0,0%,10%)] border border-[hsl(0,0%,15%)]">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-[hsl(210,60%,55%)]" />
                  <span className="text-[12px] font-medium text-[hsl(0,0%,75%)]">
                    Agent Simulation
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[24px] font-semibold text-[hsl(0,0%,90%)] tabular-nums">
                    {progress.agentCount.toLocaleString()}
                  </span>
                  <span className="text-[14px] text-[hsl(0,0%,50%)]">
                    / {progress.totalAgents.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-[hsl(0,0%,40%)] ml-1">agents</span>
                </div>
                <div className="mt-2 h-1 bg-[hsl(0,0%,15%)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[hsl(142,50%,45%)] transition-all duration-100"
                    style={{ width: `${(progress.agentCount / progress.totalAgents) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Current Node */}
            {currentNode && (
              <div className="p-2.5 rounded-md bg-[hsl(0,0%,10%)]">
                <div className="flex items-center gap-2 mb-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-[hsl(210,60%,55%)]" />
                  <span className="text-[12px] font-medium text-[hsl(0,0%,80%)] truncate">
                    {(currentNode.data as { label?: string })?.label || "Processing"}
                  </span>
                </div>
                {progress.currentNodeMessage && (
                  <p className="text-[11px] text-[hsl(0,0%,50%)] truncate pl-5">
                    {progress.currentNodeMessage}
                  </p>
                )}
                {progress.currentNodeProgress > 0 && (
                  <div className="mt-2 pl-5">
                    <div className="h-0.5 bg-[hsl(0,0%,18%)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[hsl(210,50%,55%)] transition-all duration-100"
                        style={{ width: `${progress.currentNodeProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={onCancel}
                className="flex-1 h-8 text-[12px] text-[hsl(0,0%,55%)] hover:text-[hsl(0,50%,60%)] hover:bg-[hsl(0,0%,10%)] rounded-md flex items-center justify-center gap-1.5 transition-colors duration-100 border border-[hsl(0,0%,15%)]"
              >
                <Square className="w-3 h-3" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Completed State */}
        {progress.status === "completed" && (
          <div className="space-y-4">
            {/* Success Banner */}
            <div className="p-3 rounded-md bg-[hsl(142,30%,12%)] border border-[hsl(142,30%,20%)]">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[hsl(142,60%,50%)]" />
                <span className="text-[13px] font-medium text-[hsl(142,50%,70%)]">
                  Execution Complete
                </span>
              </div>
              {elapsedTime && (
                <p className="text-[11px] text-[hsl(142,30%,50%)] mt-1 pl-6">
                  Completed in {elapsedTime}
                </p>
              )}
            </div>

            {/* Results Summary */}
            {progress.results?.summary != null && typeof progress.results.summary === "object" && (
              <ResultsSummary results={progress.results.summary as Record<string, unknown>} />
            )}

            {/* Reset Button */}
            <button
              onClick={onReset}
              className="w-full h-8 text-[12px] text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,75%)] hover:bg-[hsl(0,0%,10%)] rounded-md flex items-center justify-center gap-1.5 transition-colors duration-100 border border-[hsl(0,0%,15%)]"
            >
              <RotateCcw className="w-3 h-3" />
              Run Again
            </button>
          </div>
        )}

        {/* Error State */}
        {progress.status === "error" && (
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-[hsl(0,30%,12%)] border border-[hsl(0,30%,20%)]">
              <div className="flex items-center gap-2">
                <X className="w-4 h-4 text-[hsl(0,60%,55%)]" />
                <span className="text-[13px] font-medium text-[hsl(0,50%,65%)]">
                  Execution Failed
                </span>
              </div>
              {progress.error && (
                <p className="text-[11px] text-[hsl(0,30%,55%)] mt-1.5 pl-6 leading-relaxed">
                  {progress.error}
                </p>
              )}
            </div>

            <button
              onClick={onReset}
              className="w-full h-8 text-[12px] text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,75%)] hover:bg-[hsl(0,0%,10%)] rounded-md flex items-center justify-center gap-1.5 transition-colors duration-100 border border-[hsl(0,0%,15%)]"
            >
              <RotateCcw className="w-3 h-3" />
              Try Again
            </button>
          </div>
        )}

        {/* Idle State */}
        {progress.status === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ top: '-10%' }}>
            <Activity className="w-8 h-8 text-[hsl(0,0%,20%)] mb-3" />
            <p className="text-[13px] text-[hsl(0,0%,45%)]">
              No execution running
            </p>
            <p className="text-[11px] text-[hsl(0,0%,30%)] mt-1 mb-4">
              Run workflow to see results
            </p>
            {onRun && nodes.length > 0 && (
              <button
                onClick={onRun}
                disabled={isExecuting}
                className="h-8 px-4 text-[12px] font-medium bg-[hsl(0,0%,90%)] text-[hsl(0,0%,7%)] hover:bg-[hsl(0,0%,100%)] rounded-md flex items-center gap-1.5 transition-colors duration-100 disabled:opacity-50"
              >
                <Play className="w-3 h-3" />
                Run Simulation
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string; label: string }> = {
    idle: {
      color: "text-[hsl(0,0%,50%)]",
      bg: "bg-[hsl(0,0%,12%)]",
      label: "Ready",
    },
    running: {
      color: "text-[hsl(210,70%,60%)]",
      bg: "bg-[hsl(210,50%,15%)]",
      label: "Running",
    },
    completed: {
      color: "text-[hsl(142,60%,55%)]",
      bg: "bg-[hsl(142,30%,15%)]",
      label: "Complete",
    },
    error: {
      color: "text-[hsl(0,60%,55%)]",
      bg: "bg-[hsl(0,30%,15%)]",
      label: "Failed",
    },
  };

  const { color, bg, label } = config[status] || config.idle;

  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", color, bg)}>
      {label}
    </span>
  );
}

function ResultsSummary({ results }: { results: Record<string, unknown> }) {
  // results is already the summary object
  const yesRate = typeof results.yesRate === "number" ? results.yesRate : null;
  const confidenceInterval = results.confidenceInterval as { lower?: number; upper?: number } | undefined;
  const topSegment = results.topSegment as string | undefined;
  const keyDriver = results.keyDriver as string | undefined;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[hsl(0,0%,40%)] uppercase tracking-wide">
        Results Summary
      </p>

      {/* Primary Metric */}
      {yesRate !== null && (
        <div className="p-3 rounded-md bg-[hsl(0,0%,10%)]">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-[hsl(210,60%,55%)]" />
            <span className="text-[11px] text-[hsl(0,0%,50%)]">Response Rate</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-semibold text-[hsl(0,0%,95%)] tabular-nums">
              {Math.round(yesRate * 100)}%
            </span>
            {confidenceInterval && (
              <span className="text-[12px] text-[hsl(0,0%,45%)]">
                ±{Math.round((confidenceInterval.upper! - confidenceInterval.lower!) / 2 * 100)}%
              </span>
            )}
          </div>
          {confidenceInterval && (
            <div className="mt-2">
              <div className="h-1.5 bg-[hsl(0,0%,15%)] rounded-full relative">
                <div
                  className="absolute h-full bg-[hsl(210,40%,45%)] rounded-full"
                  style={{
                    left: `${confidenceInterval.lower! * 100}%`,
                    width: `${(confidenceInterval.upper! - confidenceInterval.lower!) * 100}%`,
                  }}
                />
                <div
                  className="absolute w-0.5 h-3 bg-[hsl(0,0%,80%)] rounded -top-[3px]"
                  style={{ left: `${yesRate * 100}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[9px] text-[hsl(0,0%,40%)] tabular-nums">
                <span>{Math.round(confidenceInterval.lower! * 100)}%</span>
                <span>{Math.round(confidenceInterval.upper! * 100)}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Key Insights */}
      {(topSegment || keyDriver) && (
        <div className="space-y-2">
          {topSegment && (
            <div className="p-2.5 rounded-md bg-[hsl(0,0%,10%)]">
              <p className="text-[10px] text-[hsl(0,0%,45%)] mb-0.5">Top Segment</p>
              <p className="text-[12px] text-[hsl(0,0%,75%)]">{topSegment}</p>
            </div>
          )}
          {keyDriver && (
            <div className="p-2.5 rounded-md bg-[hsl(0,0%,10%)]">
              <p className="text-[10px] text-[hsl(0,0%,45%)] mb-0.5">Key Driver</p>
              <p className="text-[12px] text-[hsl(0,0%,75%)]">{keyDriver}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
