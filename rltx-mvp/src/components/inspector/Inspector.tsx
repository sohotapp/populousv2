"use client";

import {
  Settings,
  Trash2,
  X,
  ChevronDown,
  Clock,
  DollarSign,
  Copy,
  Check,
  Sparkles,
  // Agent icons
  UserPlus,
  Brain,
  MessageSquare,
  // Population icons
  Users,
  Filter,
  PieChart,
  // Orchestrate icons
  Shuffle,
  Target,
  Network,
  // Aggregate icons
  BarChart3,
  Scale,
  CheckCircle2,
  // Branch icons
  GitBranch,
  GitCompare,
  GitMerge,
  // Analyze icons
  TrendingUp,
  Sliders,
  HelpCircle,
  // Utility icons
  Loader2,
  Database,
  ArrowRight,
  History,
  type LucideIcon,
} from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { useCanvasStore } from "@/stores/canvas";
import {
  specPrimitives,
  categories,
  type PrimitiveCategory,
} from "@/lib/primitives/spec-primitives";
import { getPresetsForPrimitive } from "@/lib/primitives/presets";
import { cn } from "@/lib/utils";
import type { NodeState } from "@/types";

// Icon mapping for all spec primitives
const iconMap: Record<string, LucideIcon> = {
  UserPlus,
  Brain,
  MessageSquare,
  Users,
  Filter,
  PieChart,
  Shuffle,
  Target,
  Network,
  BarChart3,
  Scale,
  CheckCircle2,
  GitBranch,
  GitCompare,
  GitMerge,
  TrendingUp,
  Sliders,
  HelpCircle,
  Database,
};

// Type colors for port indicators (monochrome)
const typeColors: Record<string, string> = {
  any: "bg-[hsl(0,0%,50%)]",
  string: "bg-[hsl(0,0%,60%)]",
  number: "bg-[hsl(0,0%,55%)]",
  boolean: "bg-[hsl(0,0%,45%)]",
  object: "bg-[hsl(0,0%,65%)]",
  array: "bg-[hsl(0,0%,60%)]",
};

// Tab IDs from spec
type InspectorTab = "config" | "inputs" | "output" | "sensitivity" | "provenance";

interface InspectorProps {
  className?: string;
}

export function Inspector({ className }: InspectorProps) {
  const { nodes, selectedNodeId, updateNodeData, deleteNode, setSelectedNode } =
    useCanvasStore();
  const [activeTab, setActiveTab] = useState<InspectorTab>("config");

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode) {
    return (
      <div className={cn("flex flex-col bg-[hsl(0,0%,7%)]", className)}>
        <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0">
          <span className="text-[hsl(0,0%,65%)] text-[13px] font-medium">
            Inspector
          </span>
        </div>
        <div className="flex-1 relative">
          <EmptyState />
        </div>
      </div>
    );
  }

  const nodeData = selectedNode.data as {
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

  const primitive = specPrimitives[nodeData.primitiveId];
  const category = primitive?.category as PrimitiveCategory | undefined;
  const categoryDef = category ? categories[category] : undefined;

  const handleConfigChange = (key: string, value: unknown) => {
    updateNodeData(selectedNode.id, {
      config: { ...nodeData.config, [key]: value },
    });
  };

  const handleLabelChange = (label: string) => {
    updateNodeData(selectedNode.id, { label });
  };

  const configSchema = primitive?.config?.properties || {};
  const IconComponent = iconMap[nodeData.icon] || Database;

  // Tab configuration
  const tabs: { id: InspectorTab; label: string; disabled?: boolean }[] = [
    { id: "config", label: "Config" },
    { id: "inputs", label: "Inputs" },
    { id: "output", label: "Output", disabled: nodeData.state !== "completed" },
    { id: "sensitivity", label: "Sensitivity", disabled: nodeData.state !== "completed" },
    { id: "provenance", label: "Provenance" },
  ];

  return (
    <div className={cn("flex flex-col bg-[hsl(0,0%,7%)]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {/* Category accent */}
          <div
            className="w-0.5 h-5 rounded-full"
            style={{ backgroundColor: categoryDef?.color || "hsl(0,0%,40%)" }}
          />
          <IconComponent className="w-4 h-4 text-[hsl(0,0%,45%)] flex-shrink-0" />
          <span className="text-[13px] font-medium text-[hsl(0,0%,75%)] truncate">
            {primitive?.name || "Node"}
          </span>
        </div>
        <button
          className="h-6 w-6 flex items-center justify-center rounded text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,70%)] hover:bg-[hsl(0,0%,10%)] transition-colors duration-100"
          onClick={() => setSelectedNode(null)}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab Bar - Linear style segmented control */}
      <div className="px-3 pb-2 flex-shrink-0">
        <div className="flex p-0.5 bg-[hsl(0,0%,10%)] rounded-md">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={cn(
                "flex-1 px-2 py-1 text-[11px] font-medium rounded transition-all duration-100",
                activeTab === tab.id
                  ? "bg-[hsl(0,0%,14%)] text-[hsl(0,0%,95%)]"
                  : "text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,70%)]",
                tab.disabled && "opacity-40 cursor-not-allowed"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-3">
        {activeTab === "config" && (
          <ConfigTab
            nodeData={nodeData}
            primitive={primitive}
            configSchema={configSchema}
            handleConfigChange={handleConfigChange}
            handleLabelChange={handleLabelChange}
          />
        )}

        {activeTab === "inputs" && (
          <InputsTab primitive={primitive} />
        )}

        {activeTab === "output" && (
          <OutputTab nodeData={nodeData} primitive={primitive} />
        )}

        {activeTab === "sensitivity" && (
          <SensitivityTab nodeData={nodeData} />
        )}

        {activeTab === "provenance" && (
          <ProvenanceTab nodeData={nodeData} />
        )}
      </div>

      {/* Footer */}
      <div className="px-3 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <StateIndicator state={nodeData.state} />
          <button
            className="h-7 px-2 text-[11px] text-[hsl(0,0%,40%)] hover:text-[hsl(0,60%,60%)] hover:bg-[hsl(0,0%,10%)] rounded flex items-center gap-1.5 transition-colors duration-100"
            onClick={() => deleteNode(selectedNode.id)}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB COMPONENTS
// ============================================================

function ConfigTab({
  nodeData,
  primitive,
  configSchema,
  handleConfigChange,
  handleLabelChange,
}: {
  nodeData: {
    primitiveId: string;
    label: string;
    config: Record<string, unknown>;
  };
  primitive: (typeof specPrimitives)[string] | undefined;
  configSchema: Record<string, unknown>;
  handleConfigChange: (key: string, value: unknown) => void;
  handleLabelChange: (label: string) => void;
}) {
  const presets = getPresetsForPrimitive(nodeData.primitiveId);

  return (
    <div className="space-y-4 pb-4">
      {/* Name */}
      <div>
        <label className="text-[11px] font-medium text-[hsl(0,0%,50%)] uppercase tracking-wider block mb-2">
          Name
        </label>
        <Input
          value={nodeData.label}
          onChange={(e) => handleLabelChange(e.target.value)}
          className="h-8 text-sm bg-[hsl(0,0%,10%)] border-[hsl(0,0%,18%)] text-[hsl(0,0%,95%)] focus-visible:ring-0 focus-visible:border-[hsl(0,0%,30%)]"
        />
        {primitive?.description && (
          <p className="text-[11px] text-[hsl(0,0%,45%)] mt-2 leading-relaxed">
            {primitive.description}
          </p>
        )}
      </div>

      {/* Cost/Time Meta */}
      <div className="flex items-center gap-4">
        {primitive?.estimatedTime && (
          <div className="flex items-center gap-1.5 text-[11px] text-[hsl(0,0%,40%)]">
            <Clock className="w-3 h-3" />
            <span className="tabular-nums">
              ~{Math.round(primitive.estimatedTime.p50 / 1000)}s
            </span>
          </div>
        )}
        {primitive?.estimatedCost && (
          <div className="flex items-center gap-1.5 text-[11px] text-[hsl(0,0%,40%)]">
            <DollarSign className="w-3 h-3" />
            <span className="tabular-nums">
              ${primitive.estimatedCost.dollars.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Presets */}
      {presets.length > 0 && (
        <div>
          <label className="text-[11px] font-medium text-[hsl(0,0%,50%)] uppercase tracking-wider block mb-2">
            Presets
          </label>
          <div className="space-y-1">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  Object.entries(preset.config).forEach(([key, value]) => {
                    handleConfigChange(key, value);
                  });
                }}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-[hsl(0,0%,10%)] transition-colors duration-100"
              >
                <span className="text-[12px] text-[hsl(0,0%,70%)] block">
                  {preset.name}
                </span>
                <span className="text-[10px] text-[hsl(0,0%,40%)]">
                  {preset.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Configuration Fields */}
      {Object.keys(configSchema).length > 0 && (
        <div>
          <label className="text-[11px] font-medium text-[hsl(0,0%,50%)] uppercase tracking-wider block mb-2">
            Parameters
          </label>
          <div className="space-y-2.5">
            {Object.entries(configSchema).map(
              ([key, schema]: [string, unknown]) => (
                <ConfigField
                  key={key}
                  name={key}
                  schema={schema as Record<string, unknown>}
                  value={nodeData.config[key]}
                  onChange={(value) => handleConfigChange(key, value)}
                  required={primitive?.config?.required?.includes(key)}
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InputsTab({
  primitive,
}: {
  primitive: (typeof specPrimitives)[string] | undefined;
}) {
  if (!primitive?.inputs || primitive.inputs.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-[12px] text-[hsl(0,0%,45%)]">
          This primitive has no inputs
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-4">
      <p className="text-[11px] text-[hsl(0,0%,45%)] mb-3">
        Connect these inputs from other nodes
      </p>
      {primitive.inputs.map((input) => (
        <div
          key={input.id}
          className="flex items-center justify-between p-2 rounded bg-[hsl(0,0%,10%)]"
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                typeColors[input.type] || typeColors.any
              )}
            />
            <span className="text-[12px] text-[hsl(0,0%,70%)]">
              {input.name}
            </span>
            {input.required && (
              <span className="text-[9px] text-amber-400 font-medium">
                required
              </span>
            )}
          </div>
          <span className="text-[10px] text-[hsl(0,0%,35%)] font-mono">
            {input.type}
          </span>
        </div>
      ))}
    </div>
  );
}

function OutputTab({
  nodeData,
  primitive,
}: {
  nodeData: {
    output?: unknown;
    error?: string;
    state: NodeState;
  };
  primitive: (typeof specPrimitives)[string] | undefined;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(nodeData.output, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (nodeData.state !== "completed") {
    return (
      <div className="py-8 text-center">
        <p className="text-[12px] text-[hsl(0,0%,45%)]">
          Run the workflow to see output
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Output ports */}
      {primitive?.outputs && primitive.outputs.length > 0 && (
        <div>
          <label className="text-[11px] font-medium text-[hsl(0,0%,50%)] uppercase tracking-wider block mb-2">
            Output Ports
          </label>
          <div className="space-y-1">
            {primitive.outputs.map((output) => (
              <div
                key={output.id}
                className="flex items-center justify-between p-2 rounded bg-[hsl(0,0%,10%)]"
              >
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-3 h-3 text-[hsl(0,0%,45%)]" />
                  <span className="text-[12px] text-[hsl(0,0%,70%)]">
                    {output.name}
                  </span>
                </div>
                <span className="text-[10px] text-[hsl(0,0%,35%)] font-mono">
                  {output.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Output data */}
      {nodeData.output !== undefined && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-medium text-[hsl(0,0%,50%)] uppercase tracking-wider">
              Result Data
            </label>
            <button
              onClick={handleCopy}
              className="text-[10px] text-[hsl(0,0%,40%)] hover:text-[hsl(0,0%,70%)] flex items-center gap-1 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-2.5 h-2.5" />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre className="text-[11px] bg-[hsl(0,0%,10%)] p-2 rounded overflow-auto max-h-48 text-[hsl(0,0%,70%)] font-mono leading-relaxed">
            {JSON.stringify(nodeData.output, null, 2)}
          </pre>
        </div>
      )}

      {/* Error display */}
      {nodeData.error && (
        <div className="p-2 rounded bg-[hsl(0,50%,15%)]">
          <span className="text-[11px] text-[hsl(0,70%,65%)] font-medium">
            Error
          </span>
          <p className="text-[11px] text-[hsl(0,50%,60%)] mt-1 leading-relaxed">
            {nodeData.error}
          </p>
        </div>
      )}
    </div>
  );
}

function SensitivityTab({
  nodeData,
}: {
  nodeData: {
    output?: unknown;
    state: NodeState;
  };
}) {
  if (nodeData.state !== "completed") {
    return (
      <div className="py-8 text-center">
        <p className="text-[12px] text-[hsl(0,0%,45%)]">
          Run the workflow to see sensitivity analysis
        </p>
      </div>
    );
  }

  // Placeholder for sensitivity analysis
  return (
    <div className="space-y-4 pb-4">
      <p className="text-[11px] text-[hsl(0,0%,45%)]">
        Sensitivity analysis shows how changes in inputs affect this node&apos;s output.
      </p>

      <div className="p-4 rounded bg-[hsl(0,0%,10%)] text-center">
        <Sliders className="w-6 h-6 mx-auto mb-2 text-[hsl(0,0%,30%)]" />
        <p className="text-[12px] text-[hsl(0,0%,50%)]">
          Sensitivity data will appear here after running analyze.sensitivity
        </p>
      </div>
    </div>
  );
}

function ProvenanceTab({
  nodeData,
}: {
  nodeData: {
    timing?: {
      startedAt: string;
      completedAt: string;
      durationMs: number;
    };
    state: NodeState;
  };
}) {
  return (
    <div className="space-y-4 pb-4">
      <p className="text-[11px] text-[hsl(0,0%,45%)]">
        Track the execution history and data lineage for this node.
      </p>

      {/* Execution timing */}
      {nodeData.timing && (
        <div>
          <label className="text-[11px] font-medium text-[hsl(0,0%,50%)] uppercase tracking-wider block mb-2">
            Last Execution
          </label>
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-[hsl(0,0%,45%)]">Started</span>
              <span className="text-[hsl(0,0%,70%)] font-mono">
                {new Date(nodeData.timing.startedAt).toLocaleTimeString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(0,0%,45%)]">Completed</span>
              <span className="text-[hsl(0,0%,70%)] font-mono">
                {new Date(nodeData.timing.completedAt).toLocaleTimeString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[hsl(0,0%,45%)]">Duration</span>
              <span className="text-[hsl(0,0%,70%)] font-mono">
                {formatDuration(nodeData.timing.durationMs)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder for full provenance */}
      <div className="p-4 rounded bg-[hsl(0,0%,10%)] text-center">
        <History className="w-6 h-6 mx-auto mb-2 text-[hsl(0,0%,30%)]" />
        <p className="text-[12px] text-[hsl(0,0%,50%)]">
          Full execution trace and data lineage will appear here
        </p>
      </div>
    </div>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function ConfigField({
  name,
  schema,
  value,
  onChange,
  required,
}: {
  name: string;
  schema: Record<string, unknown>;
  value: unknown;
  onChange: (value: unknown) => void;
  required?: boolean;
}) {
  const title = (schema.title as string) || name;

  // Enum (select)
  if (schema.enum) {
    return (
      <div className="space-y-1.5">
        <label className="text-[11px] text-[hsl(0,0%,55%)]">
          {title}
          {required && <span className="text-amber-400 ml-0.5">*</span>}
        </label>
        <div className="relative">
          <select
            value={(value as string) || (schema.default as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-8 px-2.5 text-[12px] bg-[hsl(0,0%,10%)] border border-[hsl(0,0%,18%)] rounded text-[hsl(0,0%,95%)] appearance-none focus:ring-0 focus:border-[hsl(0,0%,30%)]"
          >
            <option value="">Select...</option>
            {(schema.enum as string[]).map((opt: string) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(0,0%,40%)] pointer-events-none" />
        </div>
      </div>
    );
  }

  // Boolean (toggle)
  if (schema.type === "boolean") {
    return (
      <div className="flex items-center justify-between py-1">
        <label className="text-[11px] text-[hsl(0,0%,55%)]">
          {title}
          {required && <span className="text-amber-400 ml-0.5">*</span>}
        </label>
        <button
          onClick={() => onChange(!value)}
          className={cn(
            "w-8 h-4 rounded-full transition-colors relative",
            value ? "bg-[hsl(0,0%,95%)]" : "bg-[hsl(0,0%,20%)]"
          )}
        >
          <div
            className={cn(
              "absolute top-0.5 w-3 h-3 rounded-full transition-transform",
              value
                ? "translate-x-4 bg-[hsl(0,0%,7%)]"
                : "translate-x-0.5 bg-[hsl(0,0%,50%)]"
            )}
          />
        </button>
      </div>
    );
  }

  // Number
  if (schema.type === "number") {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] text-[hsl(0,0%,55%)]">
            {title}
            {required && <span className="text-amber-400 ml-0.5">*</span>}
          </label>
          {(schema.minimum !== undefined || schema.maximum !== undefined) && (
            <span className="text-[10px] text-[hsl(0,0%,35%)] tabular-nums">
              {String(schema.minimum ?? "–")}–{String(schema.maximum ?? "–")}
            </span>
          )}
        </div>
        <Input
          type="number"
          value={(value as number) ?? (schema.default as number) ?? ""}
          onChange={(e) => onChange(Number(e.target.value))}
          min={schema.minimum as number}
          max={schema.maximum as number}
          className="h-8 text-[12px] bg-[hsl(0,0%,10%)] border-[hsl(0,0%,18%)] text-[hsl(0,0%,95%)] focus-visible:ring-0 focus-visible:border-[hsl(0,0%,30%)] tabular-nums"
        />
      </div>
    );
  }

  // String (default)
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] text-[hsl(0,0%,55%)]">
        {title}
        {required && <span className="text-amber-400 ml-0.5">*</span>}
      </label>
      <Input
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          (schema.description as string) || `Enter ${title.toLowerCase()}...`
        }
        className="h-8 text-[12px] bg-[hsl(0,0%,10%)] border-[hsl(0,0%,18%)] text-[hsl(0,0%,95%)] placeholder:text-[hsl(0,0%,35%)] focus-visible:ring-0 focus-visible:border-[hsl(0,0%,30%)]"
      />
    </div>
  );
}

function StateIndicator({ state }: { state: NodeState }) {
  const styles: Record<
    NodeState,
    { dot: string; text: string; label: string }
  > = {
    idle: {
      dot: "bg-[hsl(0,0%,40%)]",
      text: "text-[hsl(0,0%,50%)]",
      label: "Idle",
    },
    pending: {
      dot: "bg-amber-400/50",
      text: "text-amber-400/70",
      label: "Pending",
    },
    running: {
      dot: "bg-blue-400 animate-pulse",
      text: "text-blue-400",
      label: "Running",
    },
    completed: {
      dot: "bg-emerald-400",
      text: "text-emerald-400",
      label: "Completed",
    },
    failed: { dot: "bg-red-400", text: "text-red-400", label: "Failed" },
  };

  const style = styles[state];

  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("w-1.5 h-1.5 rounded-full", style.dot)} />
      <span className={cn("text-[11px]", style.text)}>{style.label}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
      style={{ top: "-10%" }}
    >
      <p className="text-[13px] text-[hsl(0,0%,45%)]">No node selected</p>
      <p className="text-[11px] text-[hsl(0,0%,30%)] mt-1">
        Click a node to configure
      </p>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
