"use client";

import { useState, useEffect } from "react";
import {
  Users,
  BarChart3,
  PieChart,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  User,
  MapPin,
  Briefcase,
  DollarSign,
  GraduationCap,
  CheckCircle,
  Loader2,
} from "lucide-react";
import type { PopulationIndex, IndexedAgent, TraitDistribution } from "@/stores/sources";

// Design tokens from design.md
const colors = {
  bgBase: "hsl(0, 0%, 7%)",
  bgSurface: "hsl(0, 0%, 10%)",
  bgElevated: "hsl(0, 0%, 9%)",
  bgHover: "hsl(0, 0%, 12%)",
  borderSubtle: "hsl(0, 0%, 12%)",
  borderDefault: "hsl(0, 0%, 15%)",
  textPrimary: "hsl(0, 0%, 93%)",
  textSecondary: "hsl(0, 0%, 70%)",
  textTertiary: "hsl(0, 0%, 50%)",
  textQuaternary: "hsl(0, 0%, 35%)",
  iconSecondary: "hsl(0, 0%, 45%)",
  iconEmpty: "hsl(0, 0%, 20%)",
  statusSuccess: "hsl(142, 70%, 45%)",
  statusWarning: "hsl(38, 90%, 50%)",
  accentPurple: "hsl(270, 70%, 60%)",
  accentBlue: "hsl(210, 70%, 55%)",
};

// Distribution bar colors
const distributionColors = [
  "hsl(210, 70%, 55%)",
  "hsl(142, 70%, 45%)",
  "hsl(38, 90%, 50%)",
  "hsl(270, 70%, 60%)",
  "hsl(330, 70%, 55%)",
  "hsl(0, 70%, 55%)",
];

interface PopulationPreviewProps {
  population: PopulationIndex;
  onSampleAgents?: (count: number) => Promise<IndexedAgent[]>;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function PopulationPreview({
  population,
  onSampleAgents,
  onRefresh,
  isLoading,
}: PopulationPreviewProps) {
  const [expandedDistribution, setExpandedDistribution] = useState<string | null>("age");
  const [sampleAgents, setSampleAgents] = useState<IndexedAgent[]>([]);
  const [isSampling, setIsSampling] = useState(false);
  const [showAgents, setShowAgents] = useState(false);

  const handleSample = async () => {
    if (!onSampleAgents) return;
    setIsSampling(true);
    try {
      const agents = await onSampleAgents(5);
      setSampleAgents(agents);
      setShowAgents(true);
    } finally {
      setIsSampling(false);
    }
  };

  // Distribution visualization component
  const DistributionBar = ({
    name,
    distribution,
  }: {
    name: string;
    distribution: TraitDistribution;
  }) => {
    const isExpanded = expandedDistribution === name;
    const entries = Object.entries(distribution).sort((a, b) => b[1].percentage - a[1].percentage);
    const total = entries.reduce((sum, [, d]) => sum + d.count, 0);

    return (
      <div
        className="rounded-md overflow-hidden"
        style={{
          background: colors.bgBase,
          border: `1px solid ${colors.borderSubtle}`,
        }}
      >
        <button
          onClick={() => setExpandedDistribution(isExpanded ? null : name)}
          className="w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-[hsl(0,0%,10%)]"
        >
          <span style={{ color: colors.iconSecondary }}>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </span>
          <PieChart className="w-4 h-4" style={{ color: colors.accentBlue }} />
          <span className="flex-1 text-sm font-medium" style={{ color: colors.textPrimary }}>
            {name.replace(/_/g, " ")}
          </span>
          <span className="text-xs" style={{ color: colors.textTertiary }}>
            {entries.length} values
          </span>
        </button>

        {isExpanded && (
          <div className="px-3 pb-3 space-y-2">
            {/* Stacked bar */}
            <div className="flex h-2 rounded-full overflow-hidden" style={{ background: colors.bgHover }}>
              {entries.map(([value, data], i) => (
                <div
                  key={value}
                  className="h-full transition-all"
                  style={{
                    width: `${data.percentage * 100}%`,
                    background: distributionColors[i % distributionColors.length],
                  }}
                  title={`${value}: ${(data.percentage * 100).toFixed(1)}%`}
                />
              ))}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-2">
              {entries.map(([value, data], i) => (
                <div key={value} className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: distributionColors[i % distributionColors.length] }}
                  />
                  <span className="text-xs truncate" style={{ color: colors.textSecondary }}>
                    {value}
                  </span>
                  <span className="text-xs ml-auto" style={{ color: colors.textTertiary }}>
                    {(data.percentage * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div
        className="p-4 rounded-lg"
        style={{
          background: colors.bgElevated,
          border: `1px solid ${colors.borderDefault}`,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-md"
              style={{ background: "hsla(270, 70%, 60%, 0.15)" }}
            >
              <Users className="w-5 h-5" style={{ color: colors.accentPurple }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: colors.textPrimary }}>
                {population.name}
              </h3>
              <p className="text-xs" style={{ color: colors.textTertiary }}>
                {population.streamName}
              </p>
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-md transition-colors hover:bg-[hsl(0,0%,15%)]"
              style={{ color: colors.iconSecondary }}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-semibold" style={{ color: colors.textPrimary }}>
              {population.totalRecords.toLocaleString()}
            </p>
            <p className="text-xs" style={{ color: colors.textTertiary }}>
              Total records
            </p>
          </div>
          <div>
            <p className="text-2xl font-semibold" style={{ color: colors.statusSuccess }}>
              {population.completeRecords.toLocaleString()}
            </p>
            <p className="text-xs" style={{ color: colors.textTertiary }}>
              Complete agents
            </p>
          </div>
          <div>
            <p className="text-2xl font-semibold" style={{ color: colors.accentBlue }}>
              {Math.round((population.completeRecords / population.totalRecords) * 100)}%
            </p>
            <p className="text-xs" style={{ color: colors.textTertiary }}>
              Coverage
            </p>
          </div>
        </div>

        {/* Trait coverage */}
        {population.traitCoverage && (
          <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
            <p
              className="text-xs font-medium mb-2 uppercase tracking-wide"
              style={{ color: colors.textTertiary }}
            >
              Trait Coverage
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(population.traitCoverage)
                .sort((a, b) => b[1] - a[1])
                .map(([trait, coverage]) => (
                  <span
                    key={trait}
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      background: coverage >= 0.8 ? "hsla(142, 70%, 45%, 0.15)" : "hsla(38, 90%, 50%, 0.15)",
                      color: coverage >= 0.8 ? colors.statusSuccess : colors.statusWarning,
                    }}
                  >
                    {trait.replace(/_/g, " ")}: {Math.round(coverage * 100)}%
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Distributions */}
      <div>
        <h4
          className="text-xs font-medium mb-2 uppercase tracking-wide"
          style={{ color: colors.textTertiary }}
        >
          Distributions
        </h4>
        <div className="space-y-2">
          {Object.entries(population.distributions).map(([name, distribution]) => (
            <DistributionBar key={name} name={name} distribution={distribution} />
          ))}
        </div>
      </div>

      {/* Segments */}
      {population.segments && population.segments.length > 0 && (
        <div>
          <h4
            className="text-xs font-medium mb-2 uppercase tracking-wide"
            style={{ color: colors.textTertiary }}
          >
            Auto-detected Segments
          </h4>
          <div className="space-y-2">
            {population.segments.map((segment) => (
              <div
                key={segment.name}
                className="flex items-center justify-between p-3 rounded-md"
                style={{
                  background: colors.bgBase,
                  border: `1px solid ${colors.borderSubtle}`,
                }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                    {segment.name}
                  </p>
                  <p className="text-xs" style={{ color: colors.textTertiary }}>
                    {segment.count.toLocaleString()} agents ({(segment.percentage * 100).toFixed(1)}%)
                  </p>
                </div>
                <div
                  className="h-1.5 w-24 rounded-full overflow-hidden"
                  style={{ background: colors.bgHover }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${segment.percentage * 100}%`,
                      background: colors.accentPurple,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sample agents */}
      {onSampleAgents && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: colors.textTertiary }}
            >
              Sample Agents
            </h4>
            <button
              onClick={handleSample}
              disabled={isSampling}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
              style={{
                background: colors.bgHover,
                color: colors.textSecondary,
              }}
            >
              {isSampling ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Sample 5
            </button>
          </div>

          {showAgents && sampleAgents.length > 0 ? (
            <div className="space-y-2">
              {sampleAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="p-3 rounded-md"
                  style={{
                    background: colors.bgBase,
                    border: `1px solid ${colors.borderSubtle}`,
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: colors.bgHover }}
                    >
                      <User className="w-4 h-4" style={{ color: colors.iconSecondary }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                        {agent.traits.age} y/o {agent.traits.gender || "person"}
                      </p>
                      <p className="text-xs" style={{ color: colors.textTertiary }}>
                        {agent.traits.occupation}
                      </p>
                    </div>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        background: "hsla(142, 70%, 45%, 0.15)",
                        color: colors.statusSuccess,
                      }}
                    >
                      {Math.round(agent.traitCompleteness * 100)}%
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                      style={{ background: colors.bgHover, color: colors.textSecondary }}
                    >
                      <MapPin className="w-3 h-3" />
                      {agent.traits.location_name}
                    </span>
                    <span
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                      style={{ background: colors.bgHover, color: colors.textSecondary }}
                    >
                      <DollarSign className="w-3 h-3" />
                      {agent.traits.income_bracket}
                    </span>
                    {agent.traits.education && (
                      <span
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                        style={{ background: colors.bgHover, color: colors.textSecondary }}
                      >
                        <GraduationCap className="w-3 h-3" />
                        {agent.traits.education}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center p-8 rounded-md"
              style={{
                background: colors.bgBase,
                border: `1px dashed ${colors.borderDefault}`,
              }}
            >
              <Users className="w-6 h-6 mb-2" style={{ color: colors.iconEmpty }} />
              <p className="text-sm" style={{ color: colors.textTertiary }}>
                Click &quot;Sample 5&quot; to preview agents
              </p>
            </div>
          )}
        </div>
      )}

      {/* Status */}
      <div
        className="flex items-center gap-2 p-3 rounded-md"
        style={{
          background: "hsla(142, 70%, 45%, 0.1)",
          border: `1px solid hsla(142, 70%, 45%, 0.2)`,
        }}
      >
        <CheckCircle className="w-4 h-4" style={{ color: colors.statusSuccess }} />
        <span className="text-sm" style={{ color: colors.statusSuccess }}>
          Population ready for simulation
        </span>
        <span className="text-xs ml-auto" style={{ color: colors.textTertiary }}>
          Built {population.builtAt ? new Date(population.builtAt).toLocaleString() : "recently"}
        </span>
      </div>
    </div>
  );
}
