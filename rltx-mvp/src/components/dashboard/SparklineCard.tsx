"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DataPoint } from "@/stores/analytics";

interface SparklineCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  data: DataPoint[];
  color?: string;
  format?: "number" | "percent" | "currency" | "time";
  onClick?: () => void;
  isLoading?: boolean;
}

export function SparklineCard({
  title,
  value,
  change,
  changeLabel,
  data,
  color = "hsl(0, 0%, 50%)",
  format = "number",
  onClick,
  isLoading = false,
}: SparklineCardProps) {
  // Determine trend direction
  const trend = useMemo(() => {
    if (change === undefined) return "neutral";
    if (change > 0) return "up";
    if (change < 0) return "down";
    return "neutral";
  }, [change]);

  // Format the change value
  const formattedChange = useMemo(() => {
    if (change === undefined) return null;
    const absChange = Math.abs(change);
    const sign = change > 0 ? "+" : "";
    return `${sign}${absChange}%`;
  }, [change]);

  // Normalize data for sparkline
  const chartData = useMemo(() => {
    return data.map((d) => ({ value: d.value }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="bg-[hsl(0,0%,9%)] rounded-lg p-4 border border-[hsl(0,0%,14%)]">
        <div className="animate-pulse">
          <div className="h-3 bg-[hsl(0,0%,15%)] rounded w-16 mb-2" />
          <div className="h-6 bg-[hsl(0,0%,15%)] rounded w-20 mb-3" />
          <div className="h-8 bg-[hsl(0,0%,12%)] rounded" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-[hsl(0,0%,9%)] rounded-lg p-4 border border-[hsl(0,0%,14%)] transition-colors duration-100",
        onClick && "cursor-pointer hover:bg-[hsl(0,0%,10%)] hover:border-[hsl(0,0%,18%)]"
      )}
      onClick={onClick}
    >
      {/* Title */}
      <div className="text-[11px] text-[hsl(0,0%,50%)] font-medium uppercase tracking-wide mb-1">
        {title}
      </div>

      {/* Value and Change */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-[20px] font-semibold text-[hsl(0,0%,95%)] tabular-nums">
          {format === "currency" && "$"}
          {value}
          {format === "percent" && "%"}
          {format === "time" && "s"}
        </span>

        {formattedChange !== null && (
          <div
            className={cn(
              "flex items-center gap-0.5 text-[11px] font-medium",
              trend === "up" && "text-emerald-400",
              trend === "down" && "text-rose-400",
              trend === "neutral" && "text-[hsl(0,0%,45%)]"
            )}
          >
            {trend === "up" && <TrendingUp className="w-3 h-3" />}
            {trend === "down" && <TrendingDown className="w-3 h-3" />}
            {trend === "neutral" && <Minus className="w-3 h-3" />}
            <span>{formattedChange}</span>
          </div>
        )}
      </div>

      {/* Sparkline */}
      <div className="h-8">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`gradient-${title.replace(/\s/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={["dataMin", "dataMax"]} hide />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#gradient-${title.replace(/\s/g, "-")})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Change Label */}
      {changeLabel && (
        <div className="text-[10px] text-[hsl(0,0%,40%)] mt-2">
          {changeLabel}
        </div>
      )}
    </div>
  );
}
