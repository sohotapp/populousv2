"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface Distribution {
  type: "normal" | "lognormal" | "uniform" | "empirical" | "mixture";
  parameters: Record<string, number>;
  samples?: number[];
  stats?: {
    mean: number;
    std: number;
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
}

interface DistributionChartProps {
  distribution: Distribution;
  title?: string;
  color?: string;
  showStats?: boolean;
  height?: number;
}

export function DistributionChart({
  distribution,
  title,
  color = "#8b5cf6",
  showStats = true,
  height = 200,
}: DistributionChartProps) {
  // Generate histogram data from samples
  const histogramData = useMemo(() => {
    const samples = distribution.samples || [];
    if (samples.length === 0) {
      // Generate from parameters if no samples
      return generateFromParameters(distribution);
    }

    const binCount = Math.min(50, Math.ceil(Math.sqrt(samples.length)));
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const binWidth = (max - min) / binCount;

    const bins: { x: number; y: number; range: string }[] = [];

    for (let i = 0; i < binCount; i++) {
      const binStart = min + i * binWidth;
      const binEnd = binStart + binWidth;
      const count = samples.filter((s) => s >= binStart && s < binEnd).length;
      const density = count / samples.length / binWidth;

      bins.push({
        x: (binStart + binEnd) / 2,
        y: density,
        range: `${binStart.toFixed(2)} - ${binEnd.toFixed(2)}`,
      });
    }

    return bins;
  }, [distribution]);

  const stats = distribution.stats;

  return (
    <div className="bg-[hsl(0,0%,10%)] rounded-md p-4">
      {title && (
        <h4 className="text-sm font-medium text-[hsl(0,0%,93%)] mb-2">{title}</h4>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={histogramData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.8} />
              <stop offset="95%" stopColor={color} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="x"
            tick={{ fill: "hsl(0,0%,50%)", fontSize: 10 }}
            tickFormatter={(v) => typeof v === "number" ? v.toFixed(1) : v}
            axisLine={{ stroke: "hsl(0,0%,15%)" }}
            tickLine={{ stroke: "hsl(0,0%,15%)" }}
          />
          <YAxis
            tick={{ fill: "hsl(0,0%,50%)", fontSize: 10 }}
            tickFormatter={(v) => v.toFixed(2)}
            axisLine={{ stroke: "hsl(0,0%,15%)" }}
            tickLine={{ stroke: "hsl(0,0%,15%)" }}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(0,0%,10%)",
              border: "1px solid hsl(0,0%,15%)",
              borderRadius: "6px",
              fontSize: "12px",
            }}
            labelFormatter={(label) => `Value: ${Number(label).toFixed(2)}`}
            formatter={(value: number) => [`Density: ${value.toFixed(4)}`, ""]}
          />
          {stats && (
            <>
              <ReferenceLine
                x={stats.p5}
                stroke="hsl(0,70%,55%)"
                strokeDasharray="3 3"
                label={{ value: "P5", fill: "hsl(0,70%,55%)", fontSize: 10 }}
              />
              <ReferenceLine
                x={stats.mean}
                stroke="hsl(142,70%,45%)"
                strokeWidth={2}
                label={{ value: "Mean", fill: "hsl(142,70%,45%)", fontSize: 10 }}
              />
              <ReferenceLine
                x={stats.p95}
                stroke="hsl(0,70%,55%)"
                strokeDasharray="3 3"
                label={{ value: "P95", fill: "hsl(0,70%,55%)", fontSize: 10 }}
              />
            </>
          )}
          <Area
            type="monotone"
            dataKey="y"
            stroke={color}
            strokeWidth={2}
            fill={`url(#gradient-${color})`}
          />
        </AreaChart>
      </ResponsiveContainer>

      {showStats && stats && (
        <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
          <StatBox label="Mean" value={stats.mean} />
          <StatBox label="Std Dev" value={stats.std} />
          <StatBox label="P5" value={stats.p5} color="text-red-400" />
          <StatBox label="P95" value={stats.p95} color="text-red-400" />
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  color = "text-[hsl(0,0%,70%)]",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-[hsl(0,0%,12%)] rounded px-2 py-1">
      <div className="text-[hsl(0,0%,50%)] text-[10px]">{label}</div>
      <div className={`font-mono ${color}`}>
        {typeof value === "number" ? value.toFixed(2) : value}
      </div>
    </div>
  );
}

// Generate histogram from distribution parameters
function generateFromParameters(distribution: Distribution) {
  const { type, parameters } = distribution;
  const points: { x: number; y: number; range: string }[] = [];

  if (type === "normal") {
    const mean = parameters.mean || 0;
    const std = parameters.std || 1;
    const min = mean - 4 * std;
    const max = mean + 4 * std;
    const step = (max - min) / 50;

    for (let x = min; x <= max; x += step) {
      const y = normalPDF(x, mean, std);
      points.push({ x, y, range: x.toFixed(2) });
    }
  } else if (type === "lognormal") {
    const shape = parameters.shape || 0.5;
    const loc = parameters.loc || 0;
    const scale = parameters.scale || 1;
    const min = loc;
    const max = loc + scale * 10;
    const step = (max - min) / 50;

    for (let x = min + 0.01; x <= max; x += step) {
      const y = lognormalPDF(x - loc, shape, scale);
      points.push({ x, y, range: x.toFixed(2) });
    }
  } else {
    // Default uniform-ish
    for (let i = 0; i < 50; i++) {
      points.push({ x: i, y: 0.02, range: i.toString() });
    }
  }

  return points;
}

function normalPDF(x: number, mean: number, std: number): number {
  const exponent = -Math.pow(x - mean, 2) / (2 * std * std);
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
}

function lognormalPDF(x: number, shape: number, scale: number): number {
  if (x <= 0) return 0;
  const logX = Math.log(x / scale);
  return (
    (1 / (x * shape * Math.sqrt(2 * Math.PI))) *
    Math.exp(-(logX * logX) / (2 * shape * shape))
  );
}

// Confidence interval display component
interface ConfidenceDisplayProps {
  mean: number;
  lower: number;
  upper: number;
  confidence?: number;
  label?: string;
}

export function ConfidenceDisplay({
  mean,
  lower,
  upper,
  confidence = 90,
  label = "Estimate",
}: ConfidenceDisplayProps) {
  const range = upper - lower;
  const meanPosition = ((mean - lower) / range) * 100;

  return (
    <div className="bg-[hsl(0,0%,10%)] rounded-md p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-[hsl(0,0%,50%)]">{label}</span>
        <span className="text-xs text-[hsl(0,0%,50%)]">{confidence}% CI</span>
      </div>

      <div className="text-2xl font-mono font-bold text-[hsl(0,0%,93%)] mb-3">
        {mean.toFixed(2)}
      </div>

      <div className="relative h-8 bg-[hsl(0,0%,12%)] rounded overflow-hidden">
        {/* Confidence interval bar */}
        <div
          className="absolute h-full bg-foreground/20"
          style={{ left: "0%", width: "100%" }}
        />

        {/* Mean marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-[hsl(142,70%,45%)]"
          style={{ left: `${meanPosition}%` }}
        />

        {/* Labels */}
        <div className="absolute bottom-0 left-0 text-[10px] text-[hsl(0,0%,50%)] px-1">
          {lower.toFixed(2)}
        </div>
        <div className="absolute bottom-0 right-0 text-[10px] text-[hsl(0,0%,50%)] px-1">
          {upper.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

// Multi-distribution comparison
interface DistributionComparisonProps {
  distributions: {
    name: string;
    distribution: Distribution;
    color: string;
  }[];
  title?: string;
}

export function DistributionComparison({
  distributions,
  title,
}: DistributionComparisonProps) {
  return (
    <div className="bg-[hsl(0,0%,10%)] rounded-md p-4">
      {title && (
        <h4 className="text-sm font-medium text-[hsl(0,0%,93%)] mb-4">{title}</h4>
      )}

      <div className="space-y-4">
        {distributions.map((d, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-sm text-[hsl(0,0%,70%)]">{d.name}</span>
              {d.distribution.stats && (
                <span className="text-xs text-[hsl(0,0%,50%)] ml-auto">
                  Mean: {d.distribution.stats.mean.toFixed(2)}
                </span>
              )}
            </div>
            <DistributionChart
              distribution={d.distribution}
              color={d.color}
              showStats={false}
              height={100}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
