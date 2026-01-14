"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Period = "7d" | "30d" | "90d";

interface MetricData {
  date: string;
  value: number;
}

interface AnalyticsData {
  executions: {
    total: number;
    change: number;
    data: MetricData[];
  };
  successRate: {
    value: number;
    change: number;
    data: MetricData[];
  };
  avgDuration: {
    value: number;
    change: number;
    data: MetricData[];
  };
  cost: {
    total: number;
    change: number;
    data: MetricData[];
  };
  topWorkflows: {
    name: string;
    runs: number;
    successRate: number;
    avgDuration: number;
  }[];
  topPrimitives: {
    name: string;
    uses: number;
    percentage: number;
  }[];
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("30d");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    // Fetch real analytics data from API
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : 90;
        const response = await fetch(`/api/analytics?period=${periodDays}`);

        if (!response.ok) {
          throw new Error("Failed to fetch analytics");
        }

        const apiData = await response.json();

        // Transform API data to page format
        const transformedData: AnalyticsData = {
          executions: {
            total: apiData.totalRuns,
            change: apiData.runsChange,
            data: apiData.runsHistory,
          },
          successRate: {
            value: apiData.successRate,
            change: apiData.successRateChange,
            data: apiData.successHistory,
          },
          avgDuration: {
            value: apiData.avgExecutionTime,
            change: apiData.avgTimeChange,
            data: apiData.timeHistory,
          },
          cost: {
            total: apiData.totalCost,
            change: apiData.costChange,
            data: apiData.costHistory,
          },
          topWorkflows: apiData.recentExecutions.slice(0, 5).map((exec: {
            workflowName: string;
            duration?: number;
            status: string;
          }) => ({
            name: exec.workflowName,
            runs: 1,
            successRate: exec.status === "completed" ? 100 : exec.status === "failed" ? 0 : 50,
            avgDuration: exec.duration ? Math.round(exec.duration) : 0,
          })),
          topPrimitives: apiData.mostUsedPrimitives.map((prim: { name: string; count: number }, idx: number, arr: { count: number }[]) => ({
            name: prim.name,
            uses: prim.count,
            percentage: arr[0]?.count > 0 ? Math.round((prim.count / arr[0].count) * 100) : 0,
          })),
        };

        setData(transformedData);
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
        // Set empty data on error
        setData(getEmptyData(period));
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [period]);

  const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : 90;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-medium text-foreground">Analytics</h1>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-md">
          {(["7d", "30d", "90d"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded transition-colors",
                period === p
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p === "7d" ? "7 days" : p === "30d" ? "30 days" : "90 days"}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <MetricCard
              label="Total Executions"
              value={data.executions.total.toString()}
              change={data.executions.change}
              period={period}
            />
            <MetricCard
              label="Success Rate"
              value={`${data.successRate.value}%`}
              change={data.successRate.change}
              period={period}
            />
            <MetricCard
              label="Avg Duration"
              value={`${data.avgDuration.value}s`}
              change={data.avgDuration.change}
              period={period}
              invertTrend
            />
            <MetricCard
              label="Total Cost"
              value={`$${data.cost.total.toFixed(2)}`}
              change={data.cost.change}
              period={period}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Executions Over Time */}
            <div className="border border-border rounded-md p-5">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Executions Over Time
              </h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.executions.data}>
                    <defs>
                      <linearGradient id="execGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(0, 0%, 45%)" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="hsl(0, 0%, 45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(0, 0%, 15%)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "hsl(0, 0%, 40%)" }}
                      tickFormatter={(v) => formatXAxisDate(v, periodDays)}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "hsl(0, 0%, 40%)" }}
                      width={30}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(0, 0%, 55%)"
                      strokeWidth={1.5}
                      fill="url(#execGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Success Rate Over Time */}
            <div className="border border-border rounded-md p-5">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Success Rate
              </h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.successRate.data}>
                    <defs>
                      <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(145, 40%, 45%)" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="hsl(145, 40%, 45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(0, 0%, 15%)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "hsl(0, 0%, 40%)" }}
                      tickFormatter={(v) => formatXAxisDate(v, periodDays)}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "hsl(0, 0%, 40%)" }}
                      width={30}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={<CustomTooltip suffix="%" />} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(145, 40%, 50%)"
                      strokeWidth={1.5}
                      fill="url(#successGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tables Row */}
          <div className="grid grid-cols-2 gap-6">
            {/* Top Workflows */}
            <div className="border border-border rounded-md">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Top Workflows
                </h3>
              </div>
              <div className="divide-y divide-border/50">
                {data.topWorkflows.map((wf, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-4">
                    <span className="text-xs text-muted-foreground/50 w-4 tabular-nums">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{wf.name}</p>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-muted-foreground">
                      <span className="tabular-nums">{wf.runs} runs</span>
                      <span className="tabular-nums">{wf.successRate}%</span>
                      <span className="tabular-nums w-12 text-right">{wf.avgDuration}s</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Primitives */}
            <div className="border border-border rounded-md">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Most Used Primitives
                </h3>
              </div>
              <div className="p-5">
                <div className="space-y-3">
                  {data.topPrimitives.map((prim, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground">{prim.name}</span>
                        <span className="text-muted-foreground tabular-nums">{prim.uses}</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-foreground/30 rounded-full"
                          style={{ width: `${prim.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="mt-6 border border-border rounded-md p-5">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Cost Over Time
            </h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.cost.data}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(0, 0%, 15%)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "hsl(0, 0%, 40%)" }}
                    tickFormatter={(v) => formatXAxisDate(v, periodDays)}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "hsl(0, 0%, 40%)" }}
                    width={40}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip content={<CustomTooltip prefix="$" />} />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                    {data.cost.data.map((_, index) => (
                      <Cell key={index} fill="hsl(0, 0%, 35%)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  change,
  period,
  invertTrend = false,
}: {
  label: string;
  value: string;
  change: number;
  period: Period;
  invertTrend?: boolean;
}) {
  const isPositive = invertTrend ? change < 0 : change > 0;
  const isNegative = invertTrend ? change > 0 : change < 0;

  return (
    <div className="border border-border rounded-md p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-foreground tabular-nums">{value}</span>
        <span
          className={cn(
            "flex items-center gap-0.5 text-xs font-medium",
            isPositive && "text-emerald-400",
            isNegative && "text-rose-400",
            !isPositive && !isNegative && "text-muted-foreground"
          )}
        >
          {change > 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : change < 0 ? (
            <TrendingDown className="w-3 h-3" />
          ) : (
            <Minus className="w-3 h-3" />
          )}
          {Math.abs(change)}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground/60 mt-1">vs previous {period}</p>
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  prefix = "",
  suffix = "",
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  prefix?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium text-foreground tabular-nums">
        {prefix}
        {typeof payload[0].value === "number"
          ? payload[0].value.toFixed(suffix === "%" ? 0 : 2)
          : payload[0].value}
        {suffix}
      </p>
    </div>
  );
}

function formatXAxisDate(dateStr: string, periodDays: number): string {
  const date = new Date(dateStr);
  if (periodDays <= 7) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  } else if (periodDays <= 30) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

// Generate empty data structure for error fallback
function getEmptyData(period: Period): AnalyticsData {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const emptyTimeSeries: MetricData[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    emptyTimeSeries.push({
      date: date.toISOString().split("T")[0],
      value: 0,
    });
  }

  return {
    executions: { total: 0, change: 0, data: emptyTimeSeries },
    successRate: { value: 0, change: 0, data: emptyTimeSeries },
    avgDuration: { value: 0, change: 0, data: emptyTimeSeries },
    cost: { total: 0, change: 0, data: emptyTimeSeries },
    topWorkflows: [],
    topPrimitives: [],
  };
}
