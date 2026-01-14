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
  AlertCircle,
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
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCanvasStore } from "@/stores/canvas";
import { primitives } from "@/lib/primitives";
import { cn } from "@/lib/utils";
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

// Type colors for port indicators
const typeColors: Record<string, string> = {
  any: "bg-[hsl(0,0%,50%)]",
  string: "bg-blue-400",
  number: "bg-purple-400",
  boolean: "bg-pink-400",
  object: "bg-amber-400",
  array: "bg-emerald-400",
  distribution: "bg-violet-400",
};

interface InspectorProps {
  className?: string;
}

export function Inspector({ className }: InspectorProps) {
  const { nodes, selectedNodeId, updateNodeData, deleteNode, setSelectedNode } =
    useCanvasStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode) {
    return (
      <div className={cn("flex flex-col bg-[hsl(0,0%,7%)]", className)}>
        <EmptyState />
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
  };

  const primitive = primitives[nodeData.primitiveId];

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

  return (
    <div className={cn("flex flex-col bg-[hsl(0,0%,7%)]", className)}>
      {/* Header - seamless, no border */}
      <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3">
        {/* Name Section */}
        <div className="pb-4">
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

          {/* Cost/Time Meta */}
          <div className="flex items-center gap-4 mt-3">
            {primitive?.estimatedTime && (
              <div className="flex items-center gap-1.5 text-[11px] text-[hsl(0,0%,40%)]">
                <Clock className="w-3 h-3" />
                <span className="tabular-nums">~{Math.round(primitive.estimatedTime.p50 / 1000)}s</span>
              </div>
            )}
            {primitive?.estimatedCost && (
              <div className="flex items-center gap-1.5 text-[11px] text-[hsl(0,0%,40%)]">
                <DollarSign className="w-3 h-3" />
                <span className="tabular-nums">${primitive.estimatedCost.dollars.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Configuration Section */}
        {Object.keys(configSchema).length > 0 && (
          <div className="pb-4">
            <span className="text-[11px] font-medium text-[hsl(0,0%,40%)] uppercase tracking-wide block mb-2">
              Configuration
            </span>
            <div className="space-y-2.5">
              {Object.entries(configSchema).map(([key, schema]: [string, unknown]) => (
                <ConfigField
                  key={key}
                  name={key}
                  schema={schema as Record<string, unknown>}
                  value={nodeData.config[key]}
                  onChange={(value) => handleConfigChange(key, value)}
                  required={primitive?.config?.required?.includes(key)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Inputs Section */}
        {primitive?.inputs && primitive.inputs.length > 0 && (
          <div className="pb-4">
            <span className="text-[11px] font-medium text-[hsl(0,0%,40%)] uppercase tracking-wide block mb-2">
              Inputs
            </span>
            <div className="space-y-1">
              {primitive.inputs.map((input) => (
                <div
                  key={input.id}
                  className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-[hsl(0,0%,10%)] transition-colors duration-100"
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full", typeColors[input.type] || typeColors.any)} />
                    <span className="text-[12px] text-[hsl(0,0%,70%)]">{input.name}</span>
                    {input.required && (
                      <span className="text-[9px] text-[hsl(35,80%,50%)] font-medium">required</span>
                    )}
                  </div>
                  <span className="text-[10px] text-[hsl(0,0%,35%)] font-mono">{input.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outputs Section */}
        {primitive?.outputs && primitive.outputs.length > 0 && (
          <div className="pb-4">
            <span className="text-[11px] font-medium text-[hsl(0,0%,40%)] uppercase tracking-wide block mb-2">
              Outputs
            </span>
            <div className="space-y-1">
              {primitive.outputs.map((output) => (
                <div
                  key={output.id}
                  className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-[hsl(0,0%,10%)] transition-colors duration-100"
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full", typeColors[output.type] || typeColors.any)} />
                    <span className="text-[12px] text-[hsl(0,0%,70%)]">{output.name}</span>
                  </div>
                  <span className="text-[10px] text-[hsl(0,0%,35%)] font-mono">{output.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Section */}
        <div className="pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[hsl(0,0%,40%)] uppercase tracking-wide">
              Status
            </span>
            <StateIndicator state={nodeData.state} />
          </div>

          {nodeData.output !== undefined && (
            <OutputDisplay output={nodeData.output} />
          )}

          {nodeData.error && (
            <div className="mt-2 p-2 rounded bg-[hsl(0,50%,15%)]">
              <span className="text-[11px] text-[hsl(0,70%,65%)] font-medium">Error</span>
              <p className="text-[11px] text-[hsl(0,50%,60%)] mt-1 leading-relaxed">
                {nodeData.error}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 pb-3">
        <button
          className="w-full h-7 text-[12px] text-[hsl(0,0%,40%)] hover:text-[hsl(0,60%,60%)] hover:bg-[hsl(0,0%,10%)] rounded flex items-center justify-center gap-1.5 transition-colors duration-100"
          onClick={() => deleteNode(selectedNode.id)}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}

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
              value ? "translate-x-4 bg-[hsl(0,0%,7%)]" : "translate-x-0.5 bg-[hsl(0,0%,50%)]"
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
              {schema.minimum ?? "–"}–{schema.maximum ?? "–"}
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
        placeholder={(schema.description as string) || `Enter ${title.toLowerCase()}...`}
        className="h-8 text-[12px] bg-[hsl(0,0%,10%)] border-[hsl(0,0%,18%)] text-[hsl(0,0%,95%)] placeholder:text-[hsl(0,0%,35%)] focus-visible:ring-0 focus-visible:border-[hsl(0,0%,30%)]"
      />
    </div>
  );
}

function OutputDisplay({ output }: { output: unknown }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(output, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[hsl(0,0%,45%)]">Output</span>
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
      <pre className="text-[11px] bg-[hsl(0,0%,10%)] p-2 rounded overflow-auto max-h-32 text-[hsl(0,0%,70%)] font-mono leading-relaxed">
        {JSON.stringify(output, null, 2)}
      </pre>
    </div>
  );
}

function StateIndicator({ state }: { state: NodeState }) {
  const styles: Record<NodeState, { dot: string; text: string; label: string }> = {
    idle: { dot: "bg-[hsl(0,0%,40%)]", text: "text-[hsl(0,0%,50%)]", label: "Idle" },
    pending: { dot: "bg-amber-400/50", text: "text-amber-400/70", label: "Pending" },
    running: { dot: "bg-blue-400 animate-pulse", text: "text-blue-400", label: "Running" },
    completed: { dot: "bg-emerald-400", text: "text-emerald-400", label: "Completed" },
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
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <Settings className="w-8 h-8 text-[hsl(0,0%,20%)] mb-3" />
      <p className="text-[13px] font-medium text-[hsl(0,0%,55%)] mb-1">No node selected</p>
      <p className="text-[11px] text-[hsl(0,0%,35%)] max-w-[160px] leading-relaxed">
        Select a node to view its configuration
      </p>
    </div>
  );
}
