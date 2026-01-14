"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronRight,
  BarChart3,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DistributionChart } from "@/components/visualization/DistributionChart";

interface ExecutionRecord {
  id: string;
  workflowId: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  nodeCount: number;
  results?: {
    recommendation?: {
      action: string;
      confidence: number;
      reasoning: string;
    };
    distributions?: Record<string, unknown>;
  };
  error?: string;
}

interface ExecutionHistoryProps {
  workflowId: string;
  onSelectExecution?: (executionId: string) => void;
}

export function ExecutionHistory({
  workflowId,
  onSelectExecution,
}: ExecutionHistoryProps) {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionRecord | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch execution history
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/executions?workflowId=${workflowId}`);
        if (res.ok) {
          const data = await res.json();
          setExecutions(data.executions || []);
        }
      } catch (error) {
        console.error("Failed to fetch execution history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [workflowId]);

  const handleViewDetails = (execution: ExecutionRecord) => {
    setSelectedExecution(execution);
    setShowDetails(true);
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="p-6 text-center text-zinc-500">
        <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No execution history</p>
        <p className="text-xs mt-1">Run the workflow to see results here</p>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-zinc-800">
        {executions.map((execution) => (
          <ExecutionRow
            key={execution.id}
            execution={execution}
            onViewDetails={() => handleViewDetails(execution)}
            onSelect={() => onSelectExecution?.(execution.id)}
          />
        ))}
      </div>

      {/* Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Execution Details</DialogTitle>
          </DialogHeader>
          {selectedExecution && (
            <ExecutionDetails execution={selectedExecution} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExecutionRow({
  execution,
  onViewDetails,
  onSelect,
}: {
  execution: ExecutionRecord;
  onViewDetails: () => void;
  onSelect: () => void;
}) {
  const statusConfig = {
    running: {
      icon: <Loader2 className="w-4 h-4 animate-spin" />,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    completed: {
      icon: <CheckCircle className="w-4 h-4" />,
      color: "text-green-400",
      bg: "bg-green-500/10",
    },
    failed: {
      icon: <XCircle className="w-4 h-4" />,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
  };

  const config = statusConfig[execution.status];

  return (
    <div className="p-3 hover:bg-zinc-900/50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded ${config.bg} ${config.color}`}>
            {config.icon}
          </div>
          <div>
            <div className="text-sm text-zinc-200">
              {execution.results?.recommendation?.action || "Execution"}
            </div>
            <div className="text-xs text-zinc-500 flex items-center gap-2">
              <Clock className="w-3 h-3" />
              {format(new Date(execution.startedAt), "MMM d, h:mm a")}
              {execution.durationMs && (
                <span>({(execution.durationMs / 1000).toFixed(1)}s)</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {execution.results?.recommendation && (
            <div className="text-xs text-zinc-400 mr-2">
              {(execution.results.recommendation.confidence * 100).toFixed(0)}%
              confidence
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewDetails}
            className="h-7 w-7 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExecutionDetails({ execution }: { execution: ExecutionRecord }) {
  return (
    <div className="space-y-6">
      {/* Status & Timing */}
      <div className="grid grid-cols-2 gap-4">
        <InfoCard
          label="Status"
          value={execution.status}
          className={
            execution.status === "completed"
              ? "text-green-400"
              : execution.status === "failed"
              ? "text-red-400"
              : "text-blue-400"
          }
        />
        <InfoCard
          label="Duration"
          value={
            execution.durationMs
              ? `${(execution.durationMs / 1000).toFixed(2)}s`
              : "In progress"
          }
        />
        <InfoCard
          label="Started"
          value={format(new Date(execution.startedAt), "PPpp")}
        />
        <InfoCard label="Nodes Executed" value={execution.nodeCount.toString()} />
      </div>

      {/* Recommendation */}
      {execution.results?.recommendation && (
        <div className="bg-zinc-900 rounded-lg p-4">
          <h4 className="font-medium text-zinc-200 mb-3">Recommendation</h4>
          <div className="text-lg font-semibold text-white mb-2">
            {execution.results.recommendation.action}
          </div>
          <p className="text-sm text-zinc-400 mb-3">
            {execution.results.recommendation.reasoning}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-sm">Confidence:</span>
            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500"
                style={{
                  width: `${execution.results.recommendation.confidence * 100}%`,
                }}
              />
            </div>
            <span className="text-zinc-300 text-sm">
              {(execution.results.recommendation.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {/* Distributions */}
      {execution.results?.distributions &&
        Object.keys(execution.results.distributions).length > 0 && (
          <div>
            <h4 className="font-medium text-zinc-200 mb-3">Distributions</h4>
            <div className="space-y-3">
              {Object.entries(execution.results.distributions).map(
                ([key, dist]) => (
                  <DistributionChart
                    key={key}
                    distribution={dist as never}
                    title={key}
                  />
                )
              )}
            </div>
          </div>
        )}

      {/* Error */}
      {execution.error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <h4 className="font-medium text-red-400 mb-2">Error</h4>
          <p className="text-sm text-red-300">{execution.error}</p>
        </div>
      )}
    </div>
  );
}

function InfoCard({
  label,
  value,
  className = "text-zinc-200",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="bg-zinc-900 rounded-lg p-3">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className={`text-sm font-medium ${className}`}>{value}</div>
    </div>
  );
}
