"use client";

import { useState, useEffect } from "react";
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
  Loader2,
  Zap,
  Target,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalyticsMetrics } from "@/stores/analytics";

type Period = "7d" | "30d" | "90d";

// ============================================
// DESIGN.MD CONSTANTS
// ============================================
const COLORS = {
  bgBase: "hsl(0, 0%, 7%)",
  bgElevated: "hsl(0, 0%, 9%)",
  bgHover: "hsl(0, 0%, 12%)",
  borderSubtle: "hsl(0, 0%, 12%)",
  borderDefault: "hsl(0, 0%, 15%)",
  textPrimary: "hsl(0, 0%, 93%)",
  textSecondary: "hsl(0, 0%, 70%)",
  textTertiary: "hsl(0, 0%, 50%)",
  textQuaternary: "hsl(0, 0%, 35%)",
  success: "hsl(142, 70%, 45%)",
  warning: "hsl(38, 90%, 50%)",
  error: "hsl(0, 70%, 55%)",
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("30d");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsMetrics | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : 90;
        const response = await fetch(`/api/analytics?period=${periodDays}`);
        if (!response.ok) throw new Error("Failed to fetch");
        const apiData = await response.json();
        setData(apiData);
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [period]);

  const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : 90;

  return (
    <div className="min-h-screen bg-[hsl(0,0%,7%)]">
      {/* Header - design.md: 14px height, border-subtle */}
      <header className="h-14 border-b border-[hsl(0,0%,12%)] flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,85%)] transition-colors duration-100"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          {/* design.md: 13px font, medium weight */}
          <h1 className="text-[13px] font-medium text-[hsl(0,0%,93%)]">Analytics</h1>
        </div>

        {/* Period Selector - design.md: ghost buttons, 100ms transition */}
        <div className="flex items-center gap-1 p-1 bg-[hsl(0,0%,9%)] rounded-md border border-[hsl(0,0%,12%)]">
          {(["7d", "30d", "90d"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1 text-[11px] font-medium rounded transition-colors duration-100",
                period === p
                  ? "bg-[hsl(0,0%,14%)] text-[hsl(0,0%,93%)]"
                  : "text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,70%)]"
              )}
            >
              {p === "7d" ? "7 days" : p === "30d" ? "30 days" : "90 days"}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-4 h-4 animate-spin text-[hsl(0,0%,50%)]" />
        </div>
      ) : data ? (
        <div className="max-w-6xl mx-auto px-6 py-6">
          {/* ============================================ */}
          {/* PRIMARY METRICS ROW */}
          {/* ============================================ */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <MetricCard
              label="Decisions"
              value={data.totalRuns.toString()}
              change={data.runsChange}
            />
            <MetricCard
              label="Success Rate"
              value={`${data.successRate}%`}
              change={data.successRateChange}
            />
            <MetricCard
              label="Avg Time"
              value={`${data.avgExecutionTime}s`}
              change={data.avgTimeChange}
              invertTrend
            />
            <MetricCard
              label="Total Cost"
              value={`$${data.totalCost.toFixed(2)}`}
              change={data.costChange}
            />
          </div>

          {/* ============================================ */}
          {/* DECISION QUALITY & COST EFFICIENCY */}
          {/* ============================================ */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Decision Quality */}
            <SectionCard title="Decision Quality" icon={<Target className="w-3.5 h-3.5" />}>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-[24px] font-semibold text-[hsl(0,0%,93%)] tabular-nums">
                  {Math.round(data.decisionQuality.avgConfidence * 100)}%
                </span>
                <span className="text-[11px] text-[hsl(0,0%,50%)]">avg confidence</span>
              </div>
              {/* Confidence Distribution */}
              <div className="space-y-2">
                {data.decisionQuality.confidenceDistribution.map((bucket) => (
                  <div key={bucket.bucket} className="flex items-center gap-3">
                    <span className="text-[11px] text-[hsl(0,0%,50%)] w-14">{bucket.bucket}</span>
                    <div className="flex-1 h-1.5 bg-[hsl(0,0%,12%)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[hsl(0,0%,40%)] rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, (bucket.count / Math.max(1, data.totalRuns)) * 100 * 5)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-[hsl(0,0%,50%)] tabular-nums w-6 text-right">
                      {bucket.count}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-[hsl(0,0%,12%)]">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[hsl(0,0%,50%)]">High confidence (80%+)</span>
                  <span className="text-[hsl(0,0%,70%)] tabular-nums">{data.decisionQuality.highConfidenceRate}%</span>
                </div>
              </div>
            </SectionCard>

            {/* Model Tier Usage */}
            <SectionCard title="Model Usage" icon={<Zap className="w-3.5 h-3.5" />}>
              <div className="space-y-3">
                <ModelTierRow
                  name="Haiku"
                  count={data.modelTierUsage.haiku.count}
                  cost={data.modelTierUsage.haiku.cost}
                  total={
                    data.modelTierUsage.haiku.count +
                    data.modelTierUsage.sonnet.count +
                    data.modelTierUsage.opus.count
                  }
                  color="hsl(142, 50%, 45%)"
                />
                <ModelTierRow
                  name="Sonnet"
                  count={data.modelTierUsage.sonnet.count}
                  cost={data.modelTierUsage.sonnet.cost}
                  total={
                    data.modelTierUsage.haiku.count +
                    data.modelTierUsage.sonnet.count +
                    data.modelTierUsage.opus.count
                  }
                  color="hsl(210, 50%, 55%)"
                />
                <ModelTierRow
                  name="Opus"
                  count={data.modelTierUsage.opus.count}
                  cost={data.modelTierUsage.opus.cost}
                  total={
                    data.modelTierUsage.haiku.count +
                    data.modelTierUsage.sonnet.count +
                    data.modelTierUsage.opus.count
                  }
                  color="hsl(280, 50%, 55%)"
                />
              </div>
              <div className="mt-4 pt-3 border-t border-[hsl(0,0%,12%)]">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[hsl(0,0%,50%)]">Cost per decision</span>
                  <span className="text-[hsl(0,0%,70%)] tabular-nums">${data.costEfficiency.costPerDecision.toFixed(2)}</span>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* ============================================ */}
          {/* UNCERTAINTY & SIMULATION INSIGHTS */}
          {/* ============================================ */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Uncertainty Analysis */}
            <SectionCard title="Uncertainty Analysis" icon={<AlertTriangle className="w-3.5 h-3.5" />}>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-[24px] font-semibold text-[hsl(0,0%,93%)] tabular-nums">
                  {Math.round(data.uncertaintyAnalysis.avgUncertainty * 100)}%
                </span>
                <span className="text-[11px] text-[hsl(0,0%,50%)]">avg uncertainty</span>
              </div>
              {/* Epistemic vs Aleatory */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 flex-1 bg-[hsl(0,0%,12%)] rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-[hsl(210,50%,45%)]"
                      style={{ width: `${data.uncertaintyAnalysis.epistemicRatio}%` }}
                    />
                    <div
                      className="h-full bg-[hsl(38,70%,50%)]"
                      style={{ width: `${data.uncertaintyAnalysis.aleatoryRatio}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm bg-[hsl(210,50%,45%)]" />
                    <span className="text-[hsl(0,0%,50%)]">Epistemic</span>
                    <span className="text-[hsl(0,0%,70%)] tabular-nums">{data.uncertaintyAnalysis.epistemicRatio}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm bg-[hsl(38,70%,50%)]" />
                    <span className="text-[hsl(0,0%,50%)]">Aleatory</span>
                    <span className="text-[hsl(0,0%,70%)] tabular-nums">{data.uncertaintyAnalysis.aleatoryRatio}%</span>
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-[hsl(0,0%,12%)]">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[hsl(0,0%,50%)]">High uncertainty decisions</span>
                  <span className="text-[hsl(0,0%,70%)] tabular-nums">{data.uncertaintyAnalysis.highUncertaintyDecisions}</span>
                </div>
              </div>
            </SectionCard>

            {/* Simulation Insights */}
            <SectionCard title="Simulation Insights" icon={<Activity className="w-3.5 h-3.5" />}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[20px] font-semibold text-[hsl(0,0%,93%)] tabular-nums">
                    {data.simulationInsights.totalSimulations}
                  </div>
                  <div className="text-[11px] text-[hsl(0,0%,50%)]">total simulations</div>
                </div>
                <div>
                  <div className="text-[20px] font-semibold text-[hsl(0,0%,93%)] tabular-nums">
                    {data.simulationInsights.equilibriumRate}%
                  </div>
                  <div className="text-[11px] text-[hsl(0,0%,50%)]">equilibrium rate</div>
                </div>
                <div>
                  <div className="text-[20px] font-semibold text-[hsl(0,0%,93%)] tabular-nums">
                    {data.simulationInsights.avgRoundsToConverge.toFixed(1)}
                  </div>
                  <div className="text-[11px] text-[hsl(0,0%,50%)]">avg rounds</div>
                </div>
                <div>
                  <div className="text-[20px] font-semibold text-[hsl(0,0%,93%)] tabular-nums">
                    {data.simulationInsights.avgAgentsPerSim}
                  </div>
                  <div className="text-[11px] text-[hsl(0,0%,50%)]">avg agents</div>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* ============================================ */}
          {/* CHARTS ROW */}
          {/* ============================================ */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Executions Over Time */}
            <SectionCard title="Executions Over Time">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.runsHistory}>
                    <defs>
                      <linearGradient id="execGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(0, 0%, 45%)" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="hsl(0, 0%, 45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 12%)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "hsl(0, 0%, 40%)" }}
                      tickFormatter={(v) => formatDate(v, periodDays)}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "hsl(0, 0%, 40%)" }}
                      width={28}
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
            </SectionCard>

            {/* Success Rate Over Time */}
            <SectionCard title="Success Rate">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.successHistory}>
                    <defs>
                      <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(142, 50%, 45%)" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="hsl(142, 50%, 45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 12%)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "hsl(0, 0%, 40%)" }}
                      tickFormatter={(v) => formatDate(v, periodDays)}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "hsl(0, 0%, 40%)" }}
                      width={28}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={<CustomTooltip suffix="%" />} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(142, 50%, 50%)"
                      strokeWidth={1.5}
                      fill="url(#successGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          {/* ============================================ */}
          {/* CAUSAL DRIVERS & PRIMITIVE PERFORMANCE */}
          {/* ============================================ */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Top Causal Drivers */}
            <SectionCard title="Top Causal Drivers">
              {data.topCausalDrivers.length > 0 ? (
                <div className="space-y-2.5">
                  {data.topCausalDrivers.map((driver, i) => (
                    <div key={driver.variable} className="flex items-center gap-3">
                      <span className="text-[11px] text-[hsl(0,0%,35%)] w-4 tabular-nums">{i + 1}</span>
                      <span className="text-[13px] text-[hsl(0,0%,85%)] flex-1 truncate">{driver.variable}</span>
                      <div className="w-20 h-1.5 bg-[hsl(0,0%,12%)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[hsl(0,0%,50%)] rounded-full"
                          style={{ width: `${Math.min(100, driver.avgEffect * 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-[hsl(0,0%,50%)] tabular-nums w-10 text-right">
                        {driver.avgEffect.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No causal data yet" />
              )}
            </SectionCard>

            {/* Primitive Performance */}
            <SectionCard title="Primitive Performance">
              {data.primitivePerformance.length > 0 ? (
                <div className="space-y-2.5">
                  {data.primitivePerformance.slice(0, 5).map((prim) => (
                    <div key={prim.name} className="flex items-center gap-3">
                      <span className="text-[13px] text-[hsl(0,0%,85%)] flex-1 truncate">{prim.name}</span>
                      <span className="text-[11px] text-[hsl(0,0%,50%)] tabular-nums">{prim.count}x</span>
                      <span className="text-[11px] text-[hsl(0,0%,50%)] tabular-nums w-12 text-right">{prim.avgTime}s</span>
                      <span className={cn(
                        "text-[11px] tabular-nums w-10 text-right",
                        prim.successRate >= 90 ? "text-[hsl(142,50%,50%)]" :
                        prim.successRate >= 70 ? "text-[hsl(0,0%,70%)]" :
                        "text-[hsl(0,70%,55%)]"
                      )}>
                        {prim.successRate}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No primitive data yet" />
              )}
            </SectionCard>
          </div>

          {/* ============================================ */}
          {/* COST OVER TIME */}
          {/* ============================================ */}
          <SectionCard title="Cost Over Time">
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.costHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 12%)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "hsl(0, 0%, 40%)" }}
                    tickFormatter={(v) => formatDate(v, periodDays)}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "hsl(0, 0%, 40%)" }}
                    width={36}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip content={<CustomTooltip prefix="$" />} />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                    {data.costHistory.map((_, index) => (
                      <Cell key={index} fill="hsl(0, 0%, 30%)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}

// ============================================
// COMPONENTS
// ============================================

function MetricCard({
  label,
  value,
  change,
  invertTrend = false,
}: {
  label: string;
  value: string;
  change: number;
  invertTrend?: boolean;
}) {
  const isPositive = invertTrend ? change < 0 : change > 0;
  const isNegative = invertTrend ? change > 0 : change < 0;

  return (
    // design.md: bg-elevated hsl(0,0%,9%), border-subtle hsl(0,0%,12%), radius 6px
    <div className="bg-[hsl(0,0%,9%)] border border-[hsl(0,0%,12%)] rounded-md p-4">
      {/* design.md: 11px uppercase tracking-wide for labels */}
      <p className="text-[11px] text-[hsl(0,0%,50%)] uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        {/* design.md: 20px for large values */}
        <span className="text-[20px] font-semibold text-[hsl(0,0%,93%)] tabular-nums">{value}</span>
        <span
          className={cn(
            "flex items-center gap-0.5 text-[11px] font-medium",
            isPositive && "text-emerald-400",
            isNegative && "text-rose-400",
            !isPositive && !isNegative && "text-[hsl(0,0%,50%)]"
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
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    // design.md: bg-elevated, border-subtle, radius 6px, padding 16px (space-4)
    <div className="bg-[hsl(0,0%,9%)] border border-[hsl(0,0%,12%)] rounded-md p-4">
      {/* design.md: 11px uppercase tracking-wide, text-tertiary */}
      <div className="flex items-center gap-2 mb-4">
        {icon && <span className="text-[hsl(0,0%,45%)]">{icon}</span>}
        <h3 className="text-[11px] font-medium text-[hsl(0,0%,50%)] uppercase tracking-wide">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function ModelTierRow({
  name,
  count,
  cost,
  total,
  color,
}: {
  name: string;
  count: number;
  cost: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-[hsl(0,0%,85%)]">{name}</span>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-[hsl(0,0%,50%)] tabular-nums">{count}</span>
          <span className="text-[hsl(0,0%,50%)] tabular-nums">${cost.toFixed(2)}</span>
        </div>
      </div>
      <div className="h-1.5 bg-[hsl(0,0%,12%)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-24">
      <p className="text-[11px] text-[hsl(0,0%,35%)]">{message}</p>
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
    // design.md: bg-elevated, border-default, radius 4px
    <div className="bg-[hsl(0,0%,10%)] border border-[hsl(0,0%,15%)] rounded px-3 py-2">
      <p className="text-[11px] text-[hsl(0,0%,50%)] mb-0.5">{label}</p>
      <p className="text-[13px] font-medium text-[hsl(0,0%,93%)] tabular-nums">
        {prefix}
        {typeof payload[0].value === "number"
          ? payload[0].value.toFixed(suffix === "%" ? 0 : 2)
          : payload[0].value}
        {suffix}
      </p>
    </div>
  );
}

function formatDate(dateStr: string, periodDays: number): string {
  const date = new Date(dateStr);
  if (periodDays <= 7) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
