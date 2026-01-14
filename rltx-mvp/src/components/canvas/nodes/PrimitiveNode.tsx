"use client";

import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Loader2,
  Check,
  X,
  Clock,
  AlertCircle,
  // Data icons
  Globe,
  Database,
  FileText,
  Table,
  Cloud,
  // Reason icons
  Lightbulb,
  Scale,
  FileSearch,
  Shield,
  Share2,
  Workflow,
  // Simulate icons
  GitBranch,
  BarChart2,
  Users,
  Target,
  TrendingUp,
  Activity,
  // Human icons
  User,
  ShieldCheck,
  // Output icons
  CheckCircle,
  Layers,
  PieChart,
  // Control icons
  GitFork,
  Split,
  Repeat,
  GitMerge,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/stores/canvas";
import { primitives } from "@/lib/primitives";
import type { NodeState } from "@/types";

// Comprehensive icon mapping - Linear style (clean, minimal)
const iconMap: Record<string, LucideIcon> = {
  // Data
  Globe,
  Database,
  FileText,
  Table,
  Cloud,
  // Reason
  Brain: Lightbulb,
  Lightbulb,
  Scale,
  FileSearch,
  AlertTriangle: AlertCircle,
  Shield,
  Network: Share2,
  Workflow,
  // Simulate
  GitBranch,
  BarChart3: BarChart2,
  BarChart2,
  Users,
  Target,
  TrendingUp,
  Gauge: Activity,
  Activity,
  // Human
  UserCircle: User,
  User,
  ShieldCheck,
  // Output
  CheckCircle,
  FileStack: Layers,
  Layers,
  BarChart: PieChart,
  PieChart,
  // Control
  GitFork,
  Split,
  Repeat,
  Merge: GitMerge,
  GitMerge,
};

// Type colors for handles
const typeColors: Record<string, string> = {
  any: "hsl(0,0%,50%)",
  string: "hsl(200,70%,50%)",
  number: "hsl(280,70%,50%)",
  boolean: "hsl(340,70%,50%)",
  object: "hsl(40,70%,50%)",
  array: "hsl(160,70%,50%)",
  distribution: "hsl(260,70%,60%)",
};

// Semantic zoom thresholds
const ZOOM_COMPACT = 0.5;
const ZOOM_DETAILED = 1.0;

interface PrimitiveNodeData {
  primitiveId: string;
  label: string;
  icon: string;
  color: string;
  category?: string;
  config: Record<string, unknown>;
  state: NodeState;
  output?: unknown;
  error?: string;
  timing?: {
    startedAt: string;
    completedAt: string;
    durationMs: number;
  };
}

function PrimitiveNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as PrimitiveNodeData;
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const zoomLevel = useCanvasStore((s) => s.zoomLevel);
  const isSelected = selected || selectedNodeId === id;

  // Determine detail level based on zoom
  const detailLevel = useMemo(() => {
    if (zoomLevel < ZOOM_COMPACT) return "compact";
    if (zoomLevel < ZOOM_DETAILED) return "medium";
    return "detailed";
  }, [zoomLevel]);

  // Get primitive definition for inputs/outputs
  const primitive = useMemo(() => {
    return primitives[nodeData.primitiveId];
  }, [nodeData.primitiveId]);

  const inputs = primitive?.inputs || [];
  const outputs = primitive?.outputs || [];

  const stateStyles: Record<NodeState, { border: string; glow: string }> = {
    idle: { border: "border-[hsl(0,0%,18%)]", glow: "" },
    pending: { border: "border-[hsl(0,0%,22%)]", glow: "" },
    running: { border: "border-blue-500/50", glow: "shadow-[0_0_20px_rgba(59,130,246,0.15)]" },
    completed: { border: "border-emerald-500/40", glow: "" },
    failed: { border: "border-red-500/40", glow: "" },
  };

  const style = stateStyles[nodeData.state];
  const IconComponent = iconMap[nodeData.icon] || Database;

  // ==================== COMPACT VIEW (Zoomed Out) ====================
  if (detailLevel === "compact") {
    return (
      <div
        className={cn(
          "group relative rounded-lg border transition-all duration-200",
          "bg-[hsl(0,0%,9%)] w-12 h-12",
          style.border,
          style.glow,
          isSelected && "ring-1 ring-[hsl(0,0%,40%)] ring-offset-1 ring-offset-[hsl(0,0%,4%)]"
        )}
      >
        {/* Single input handle */}
        <Handle
          type="target"
          position={Position.Top}
          className="!w-2 !h-2 !rounded-full !border-2 !border-[hsl(0,0%,9%)] !-top-1 !bg-[hsl(0,0%,40%)]"
        />

        {/* Icon + State */}
        <div className="w-full h-full flex items-center justify-center relative">
          <IconComponent className="w-5 h-5 text-[hsl(0,0%,60%)]" />

          {/* State dot */}
          {nodeData.state !== "idle" && (
            <div className="absolute -top-0.5 -right-0.5">
              <CompactStateIndicator state={nodeData.state} />
            </div>
          )}
        </div>

        {/* Single output handle */}
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-2 !h-2 !rounded-full !border-2 !border-[hsl(0,0%,9%)] !-bottom-1 !bg-[hsl(0,0%,40%)]"
        />
      </div>
    );
  }

  // ==================== MEDIUM VIEW ====================
  if (detailLevel === "medium") {
    return (
      <div
        className={cn(
          "group relative rounded-lg border transition-all duration-200",
          "bg-[hsl(0,0%,9%)] min-w-[140px] max-w-[160px]",
          style.border,
          style.glow,
          isSelected && "ring-1 ring-[hsl(0,0%,40%)] ring-offset-1 ring-offset-[hsl(0,0%,4%)]"
        )}
      >
        {/* Single input handle */}
        <Handle
          type="target"
          position={Position.Top}
          className="!w-2 !h-2 !rounded-full !border-2 !border-[hsl(0,0%,9%)] !-top-1 !bg-[hsl(0,0%,40%)]"
        />

        {/* Content */}
        <div className="px-2.5 py-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-[hsl(0,0%,14%)]">
              <IconComponent className="w-3 h-3 text-[hsl(0,0%,60%)]" />
            </div>
            <span className="text-[12px] font-medium text-[hsl(0,0%,95%)] truncate flex-1">
              {nodeData.label}
            </span>
            <StateIndicator state={nodeData.state} size="sm" />
          </div>
        </div>

        {/* Single output handle */}
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-2 !h-2 !rounded-full !border-2 !border-[hsl(0,0%,9%)] !-bottom-1 !bg-[hsl(0,0%,40%)]"
        />
      </div>
    );
  }

  // ==================== DETAILED VIEW (Zoomed In) ====================
  return (
    <div
      className={cn(
        "group relative rounded-lg border transition-all duration-200",
        "bg-[hsl(0,0%,9%)] min-w-[200px] max-w-[240px]",
        style.border,
        style.glow,
        isSelected && "ring-1 ring-[hsl(0,0%,40%)] ring-offset-1 ring-offset-[hsl(0,0%,4%)]"
      )}
    >
      {/* Input Handles - positioned based on inputs array */}
      {inputs.map((input, index) => (
        <Handle
          key={input.id}
          id={input.id}
          type="target"
          position={Position.Top}
          className="!w-2 !h-2 !rounded-full !border-2 !border-[hsl(0,0%,9%)] !-top-1 transition-all"
          style={{
            backgroundColor: typeColors[input.type] || typeColors.any,
            left: inputs.length === 1 ? "50%" : `${((index + 1) / (inputs.length + 1)) * 100}%`,
          }}
          title={`${input.name} (${input.type})${input.required ? " - required" : ""}`}
        />
      ))}

      {/* Fallback single input handle if no inputs defined */}
      {inputs.length === 0 && (
        <Handle
          type="target"
          position={Position.Top}
          className={cn(
            "!w-2 !h-2 !rounded-full !border-2 !border-[hsl(0,0%,9%)] !-top-1 transition-all",
            "!bg-[hsl(0,0%,40%)] group-hover:!bg-[hsl(0,0%,55%)]"
          )}
        />
      )}

      {/* Content */}
      <div className="px-3 py-2.5">
        {/* Header Row */}
        <div className="flex items-center gap-2.5">
          {/* Icon */}
          <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 bg-[hsl(0,0%,14%)]">
            <IconComponent className="w-3.5 h-3.5 text-[hsl(0,0%,60%)]" />
          </div>

          {/* Label */}
          <div className="flex-1 min-w-0">
            <span className="text-[13px] font-medium text-[hsl(0,0%,95%)] truncate block">
              {nodeData.label}
            </span>
          </div>

          {/* State Indicator */}
          <StateIndicator state={nodeData.state} />
        </div>

        {/* IO Summary - show when has multiple inputs/outputs */}
        {(inputs.length > 1 || outputs.length > 1) && (
          <div className="mt-2 pt-2 border-t border-[hsl(0,0%,14%)]">
            <div className="flex items-center justify-between text-[10px] text-[hsl(0,0%,45%)]">
              <span>{inputs.length} input{inputs.length !== 1 ? "s" : ""}</span>
              <span>{outputs.length} output{outputs.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        )}

        {/* Status row for non-idle states */}
        {nodeData.state !== "idle" && nodeData.state !== "pending" && (
          <div className="mt-2 pt-2 border-t border-[hsl(0,0%,14%)]">
            {nodeData.state === "running" && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-[hsl(0,0%,18%)] rounded-full overflow-hidden">
                  <div className="h-full w-1/2 bg-blue-500/60 rounded-full animate-pulse" />
                </div>
                <span className="text-[10px] text-[hsl(0,0%,50%)] tabular-nums">Running</span>
              </div>
            )}

            {nodeData.state === "completed" && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-emerald-400/80">Completed</span>
                {nodeData.timing && (
                  <div className="flex items-center gap-1 text-[10px] text-[hsl(0,0%,45%)]">
                    <Clock className="w-2.5 h-2.5" />
                    <span className="tabular-nums">{formatDuration(nodeData.timing.durationMs)}</span>
                  </div>
                )}
              </div>
            )}

            {nodeData.state === "failed" && (
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                <span className="text-[10px] text-red-400 truncate">
                  {nodeData.error || "Failed"}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Output Handles - positioned based on outputs array */}
      {outputs.map((output, index) => (
        <Handle
          key={output.id}
          id={output.id}
          type="source"
          position={Position.Bottom}
          className="!w-2 !h-2 !rounded-full !border-2 !border-[hsl(0,0%,9%)] !-bottom-1 transition-all"
          style={{
            backgroundColor: typeColors[output.type] || typeColors.any,
            left: outputs.length === 1 ? "50%" : `${((index + 1) / (outputs.length + 1)) * 100}%`,
          }}
          title={`${output.name} (${output.type})`}
        />
      ))}

      {/* Fallback single output handle if no outputs defined */}
      {outputs.length === 0 && (
        <Handle
          type="source"
          position={Position.Bottom}
          className={cn(
            "!w-2 !h-2 !rounded-full !border-2 !border-[hsl(0,0%,9%)] !-bottom-1 transition-all",
            "!bg-[hsl(0,0%,40%)] group-hover:!bg-[hsl(0,0%,55%)]"
          )}
        />
      )}
    </div>
  );
}

function CompactStateIndicator({ state }: { state: NodeState }) {
  const colors: Record<NodeState, string> = {
    idle: "bg-[hsl(0,0%,40%)]",
    pending: "bg-amber-400/50",
    running: "bg-blue-400 animate-pulse",
    completed: "bg-emerald-400",
    failed: "bg-red-400",
  };

  return <div className={cn("w-2 h-2 rounded-full", colors[state])} />;
}

function StateIndicator({ state, size = "md" }: { state: NodeState; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const iconSize = size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3";

  switch (state) {
    case "running":
      return (
        <div className={cn(sizeClass, "rounded flex items-center justify-center bg-blue-500/10")}>
          <Loader2 className={cn(iconSize, "animate-spin text-blue-400")} />
        </div>
      );
    case "completed":
      return (
        <div className={cn(sizeClass, "rounded flex items-center justify-center bg-emerald-500/10")}>
          <Check className={cn(iconSize, "text-emerald-400")} />
        </div>
      );
    case "failed":
      return (
        <div className={cn(sizeClass, "rounded flex items-center justify-center bg-red-500/10")}>
          <X className={cn(iconSize, "text-red-400")} />
        </div>
      );
    case "pending":
      return (
        <div className={cn(sizeClass, "rounded flex items-center justify-center bg-[hsl(0,0%,14%)]")}>
          <div className="w-1.5 h-1.5 rounded-full bg-[hsl(0,0%,35%)]" />
        </div>
      );
    default:
      return null;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export const PrimitiveNode = memo(PrimitiveNodeComponent);
