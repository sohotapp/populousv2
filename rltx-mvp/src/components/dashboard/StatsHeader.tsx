"use client";

import { SparklineCard } from "./SparklineCard";
import type { AnalyticsMetrics } from "@/stores/analytics";

interface StatsHeaderProps {
  metrics: AnalyticsMetrics | null;
  isLoading: boolean;
  onCardClick?: (metric: string) => void;
}

export function StatsHeader({ metrics, isLoading, onCardClick }: StatsHeaderProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4">
      {/* Total Runs */}
      <SparklineCard
        title="Total Runs"
        value={metrics?.totalRuns ?? 0}
        change={metrics?.runsChange}
        changeLabel="vs last 14 days"
        data={metrics?.runsHistory ?? []}
        color="hsl(210, 60%, 55%)"
        format="number"
        isLoading={isLoading}
        onClick={() => onCardClick?.("runs")}
      />

      {/* Success Rate */}
      <SparklineCard
        title="Success Rate"
        value={metrics?.successRate ?? 0}
        change={metrics?.successRateChange}
        changeLabel="vs last 14 days"
        data={metrics?.successHistory ?? []}
        color="hsl(145, 55%, 50%)"
        format="percent"
        isLoading={isLoading}
        onClick={() => onCardClick?.("success")}
      />

      {/* Avg Execution Time */}
      <SparklineCard
        title="Avg Time"
        value={metrics?.avgExecutionTime?.toFixed(1) ?? "0"}
        change={metrics?.avgTimeChange}
        changeLabel="vs last 14 days"
        data={metrics?.timeHistory ?? []}
        color="hsl(35, 70%, 55%)"
        format="time"
        isLoading={isLoading}
        onClick={() => onCardClick?.("time")}
      />

      {/* Total Cost */}
      <SparklineCard
        title="This Month"
        value={metrics?.totalCost?.toFixed(2) ?? "0.00"}
        change={metrics?.costChange}
        changeLabel="spend"
        data={metrics?.costHistory ?? []}
        color="hsl(280, 50%, 55%)"
        format="currency"
        isLoading={isLoading}
        onClick={() => onCardClick?.("cost")}
      />
    </div>
  );
}
