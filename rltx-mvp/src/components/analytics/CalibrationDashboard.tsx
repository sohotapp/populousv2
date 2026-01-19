"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  RefreshCw,
  Loader2,
  Calendar,
  CheckCircle,
  AlertTriangle,
  BarChart2,
  Clock,
} from "lucide-react";

// Design tokens
const colors = {
  bgBase: "hsl(0, 0%, 7%)",
  bgElevated: "hsl(0, 0%, 9%)",
  bgSurface: "hsl(0, 0%, 10%)",
  bgHover: "hsl(0, 0%, 12%)",
  bgActive: "hsl(0, 0%, 14%)",
  textPrimary: "hsl(0, 0%, 93%)",
  textSecondary: "hsl(0, 0%, 70%)",
  textTertiary: "hsl(0, 0%, 50%)",
  textQuaternary: "hsl(0, 0%, 35%)",
  borderSubtle: "hsl(0, 0%, 12%)",
  borderDefault: "hsl(0, 0%, 15%)",
  statusSuccess: "hsl(142, 70%, 45%)",
  statusWarning: "hsl(38, 90%, 50%)",
  statusError: "hsl(0, 70%, 55%)",
  statusInfo: "hsl(210, 70%, 55%)",
};

interface TrendPoint {
  date: string;
  accuracy: number;
  count: number;
}

interface BacktestResult {
  eventId: string;
  eventDescription: string;
  eventDate: string;
  predictedOutcome: number;
  actualOutcome: number;
  accuracyScore: number;
  calibrationScore: number;
  brierScore: number;
}

interface CalibrationData {
  vertical: string;
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    totalBacktests: number;
    averageAccuracy: number;
    averageBrierScore: number;
    recentTrend: number;
  };
  trend: TrendPoint[];
  history: BacktestResult[];
}

export function CalibrationDashboard() {
  const [data, setData] = useState<CalibrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [vertical, setVertical] = useState("enterprise");
  const [days, setDays] = useState(90);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/simulation/backtest?vertical=${vertical}&days=${days}`
      );
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Failed to fetch calibration data:", error);
    } finally {
      setLoading(false);
    }
  }, [vertical, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate accuracy level
  const getAccuracyLevel = (accuracy: number): { label: string; color: string } => {
    if (accuracy >= 0.85) return { label: "Excellent", color: colors.statusSuccess };
    if (accuracy >= 0.7) return { label: "Good", color: colors.statusInfo };
    if (accuracy >= 0.5) return { label: "Fair", color: colors.statusWarning };
    return { label: "Poor", color: colors.statusError };
  };

  // Format percentage
  const formatPercent = (value: number): string => {
    return `${Math.round(value * 100)}%`;
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.iconSecondary }} />
      </div>
    );
  }

  const accuracyLevel = data ? getAccuracyLevel(data.summary.averageAccuracy) : null;

  return (
    <div className="space-y-6 p-6" style={{ background: colors.bgBase }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold" style={{ color: colors.textPrimary }}>
            Calibration & Accuracy
          </h1>
          <p className="text-[13px] mt-1" style={{ color: colors.textTertiary }}>
            Track simulation accuracy against historical outcomes
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Vertical selector */}
          <select
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
            className="h-8 px-3 text-[12px] rounded outline-none"
            style={{
              background: colors.bgSurface,
              border: `1px solid ${colors.borderDefault}`,
              color: colors.textPrimary,
            }}
          >
            <option value="enterprise">Enterprise</option>
            <option value="political">Political</option>
            <option value="defense">Defense</option>
            <option value="consumer">Consumer</option>
          </select>

          {/* Time range selector */}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-8 px-3 text-[12px] rounded outline-none"
            style={{
              background: colors.bgSurface,
              border: `1px solid ${colors.borderDefault}`,
              color: colors.textPrimary,
            }}
          >
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 6 months</option>
            <option value={365}>Last year</option>
          </select>

          {/* Refresh button */}
          <button
            onClick={fetchData}
            className="h-8 px-3 text-[12px] rounded flex items-center gap-1.5"
            style={{
              background: colors.bgSurface,
              border: `1px solid ${colors.borderDefault}`,
              color: colors.textSecondary,
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* Overall Accuracy */}
        <div
          className="p-4 rounded-lg"
          style={{ background: colors.bgSurface, border: `1px solid ${colors.borderSubtle}` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4" style={{ color: accuracyLevel?.color }} />
            <span className="text-[11px] uppercase" style={{ color: colors.textQuaternary }}>
              Overall Accuracy
            </span>
          </div>
          <div className="text-[28px] font-semibold" style={{ color: accuracyLevel?.color }}>
            {data ? formatPercent(data.summary.averageAccuracy) : "—"}
          </div>
          <div className="text-[11px] mt-1" style={{ color: colors.textTertiary }}>
            {accuracyLevel?.label || "No data"}
          </div>
        </div>

        {/* Brier Score */}
        <div
          className="p-4 rounded-lg"
          style={{ background: colors.bgSurface, border: `1px solid ${colors.borderSubtle}` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4" style={{ color: colors.statusInfo }} />
            <span className="text-[11px] uppercase" style={{ color: colors.textQuaternary }}>
              Brier Score
            </span>
          </div>
          <div className="text-[28px] font-semibold" style={{ color: colors.textPrimary }}>
            {data ? data.summary.averageBrierScore.toFixed(3) : "—"}
          </div>
          <div className="text-[11px] mt-1" style={{ color: colors.textTertiary }}>
            Lower is better (0 = perfect)
          </div>
        </div>

        {/* Trend */}
        <div
          className="p-4 rounded-lg"
          style={{ background: colors.bgSurface, border: `1px solid ${colors.borderSubtle}` }}
        >
          <div className="flex items-center gap-2 mb-2">
            {data && data.summary.recentTrend >= 0 ? (
              <TrendingUp className="w-4 h-4" style={{ color: colors.statusSuccess }} />
            ) : (
              <TrendingDown className="w-4 h-4" style={{ color: colors.statusError }} />
            )}
            <span className="text-[11px] uppercase" style={{ color: colors.textQuaternary }}>
              Recent Trend
            </span>
          </div>
          <div
            className="text-[28px] font-semibold"
            style={{
              color: data && data.summary.recentTrend >= 0
                ? colors.statusSuccess
                : colors.statusError,
            }}
          >
            {data
              ? `${data.summary.recentTrend >= 0 ? "+" : ""}${formatPercent(data.summary.recentTrend)}`
              : "—"}
          </div>
          <div className="text-[11px] mt-1" style={{ color: colors.textTertiary }}>
            vs. previous period
          </div>
        </div>

        {/* Total Backtests */}
        <div
          className="p-4 rounded-lg"
          style={{ background: colors.bgSurface, border: `1px solid ${colors.borderSubtle}` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 className="w-4 h-4" style={{ color: colors.textSecondary }} />
            <span className="text-[11px] uppercase" style={{ color: colors.textQuaternary }}>
              Total Backtests
            </span>
          </div>
          <div className="text-[28px] font-semibold" style={{ color: colors.textPrimary }}>
            {data?.summary.totalBacktests || 0}
          </div>
          <div className="text-[11px] mt-1" style={{ color: colors.textTertiary }}>
            validation events tested
          </div>
        </div>
      </div>

      {/* Accuracy Trend Chart */}
      {data && data.trend.length > 0 && (
        <div
          className="p-4 rounded-lg"
          style={{ background: colors.bgSurface, border: `1px solid ${colors.borderSubtle}` }}
        >
          <h3 className="text-[13px] font-medium mb-4" style={{ color: colors.textPrimary }}>
            Accuracy Over Time
          </h3>
          <div className="h-48 flex items-end gap-1">
            {data.trend.map((point, i) => {
              const height = Math.max(10, point.accuracy * 100);
              const level = getAccuracyLevel(point.accuracy);
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${height}%`,
                      background: level.color,
                      opacity: 0.8,
                    }}
                    title={`${formatDate(point.date)}: ${formatPercent(point.accuracy)} (${point.count} tests)`}
                  />
                  <span className="text-[9px]" style={{ color: colors.textQuaternary }}>
                    {formatDate(point.date)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-4 mt-4">
            {[
              { label: "Excellent (85%+)", color: colors.statusSuccess },
              { label: "Good (70%+)", color: colors.statusInfo },
              { label: "Fair (50%+)", color: colors.statusWarning },
              { label: "Poor (<50%)", color: colors.statusError },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded"
                  style={{ background: item.color }}
                />
                <span className="text-[10px]" style={{ color: colors.textTertiary }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Backtests */}
      {data && data.history.length > 0 && (
        <div
          className="p-4 rounded-lg"
          style={{ background: colors.bgSurface, border: `1px solid ${colors.borderSubtle}` }}
        >
          <h3 className="text-[13px] font-medium mb-4" style={{ color: colors.textPrimary }}>
            Recent Validation Results
          </h3>
          <div className="space-y-2">
            {data.history.map((result) => {
              const level = getAccuracyLevel(result.accuracyScore);
              return (
                <div
                  key={result.eventId}
                  className="flex items-center gap-4 p-3 rounded"
                  style={{ background: colors.bgHover }}
                >
                  {/* Status icon */}
                  {result.accuracyScore >= 0.7 ? (
                    <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: colors.statusSuccess }} />
                  ) : (
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: colors.statusWarning }} />
                  )}

                  {/* Event info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] truncate" style={{ color: colors.textPrimary }}>
                      {result.eventDescription || `Event ${result.eventId.slice(0, 8)}`}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="w-3 h-3" style={{ color: colors.textQuaternary }} />
                      <span className="text-[10px]" style={{ color: colors.textTertiary }}>
                        {formatDate(result.eventDate)}
                      </span>
                    </div>
                  </div>

                  {/* Predicted vs Actual */}
                  <div className="text-right">
                    <div className="text-[11px]" style={{ color: colors.textTertiary }}>
                      Predicted: {formatPercent(result.predictedOutcome)}
                    </div>
                    <div className="text-[11px]" style={{ color: colors.textTertiary }}>
                      Actual: {formatPercent(result.actualOutcome)}
                    </div>
                  </div>

                  {/* Accuracy score */}
                  <div
                    className="px-2 py-1 rounded text-[11px] font-medium"
                    style={{
                      background: level.color + "20",
                      color: level.color,
                    }}
                  >
                    {formatPercent(result.accuracyScore)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {data && data.history.length === 0 && (
        <div
          className="p-8 rounded-lg text-center"
          style={{ background: colors.bgSurface, border: `1px dashed ${colors.borderDefault}` }}
        >
          <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: colors.iconSecondary }} />
          <h3 className="text-[14px] font-medium mb-1" style={{ color: colors.textPrimary }}>
            No backtest data yet
          </h3>
          <p className="text-[12px]" style={{ color: colors.textTertiary }}>
            Create validation events and run backtests to track accuracy over time.
          </p>
        </div>
      )}
    </div>
  );
}
