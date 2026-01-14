"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Database,
  Plus,
  RefreshCw,
  Trash2,
  Settings,
  ExternalLink,
  Users,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import {
  useSourcesStore,
  getConnectorById,
  getStatusColor,
  getStatusLabel,
  type DataSource,
} from "@/stores/sources";
import { AddSourceWizard } from "@/components/sources/AddSourceWizard";

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
  statusError: "hsl(0, 70%, 55%)",
  accentPurple: "hsl(270, 70%, 60%)",
};

export default function SourcesPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const { sources, isLoading, fetchSources, deleteSource, syncSource } = useSourcesStore();

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleDelete = async (sourceId: string) => {
    if (confirm("Delete this data source? This cannot be undone.")) {
      await deleteSource(sourceId);
    }
  };

  const handleSync = async (sourceId: string) => {
    try {
      await syncSource(sourceId);
    } catch (error) {
      console.error("Sync error:", error);
    }
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return "Never";
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen" style={{ background: colors.bgBase }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: colors.bgBase,
          borderBottom: `1px solid ${colors.borderSubtle}`,
        }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="p-1.5 rounded-md transition-colors hover:bg-[hsl(0,0%,12%)]"
                style={{ color: colors.textTertiary }}
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                  Data Sources
                </h1>
                <p className="text-xs" style={{ color: colors.textTertiary }}>
                  Connect external data to power simulations
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsWizardOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={{
                background: colors.textPrimary,
                color: colors.bgBase,
              }}
            >
              <Plus className="w-4 h-4" />
              Add Source
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {isLoading && sources.length === 0 ? (
          // Loading state
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: colors.textTertiary }} />
          </div>
        ) : sources.length === 0 ? (
          // Empty state
          <div
            className="flex flex-col items-center justify-center text-center py-24 rounded-lg"
            style={{
              background: colors.bgSurface,
              border: `1px dashed ${colors.borderDefault}`,
            }}
          >
            <Database className="w-10 h-10 mb-4" style={{ color: colors.iconEmpty }} />
            <h2 className="text-base font-medium mb-1" style={{ color: colors.textSecondary }}>
              No data sources connected
            </h2>
            <p className="text-sm max-w-md mb-6" style={{ color: colors.textTertiary }}>
              Connect your CRM, database, or upload files to create simulation populations
              based on your real customer data.
            </p>
            <button
              onClick={() => setIsWizardOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              style={{
                background: colors.accentPurple,
                color: colors.textPrimary,
              }}
            >
              <Plus className="w-4 h-4" />
              Connect Your First Source
            </button>

            {/* Quick links */}
            <div className="flex items-center gap-4 mt-8">
              <span className="text-xs" style={{ color: colors.textQuaternary }}>
                Popular:
              </span>
              {["Salesforce", "HubSpot", "PostgreSQL", "CSV"].map((name) => (
                <button
                  key={name}
                  onClick={() => setIsWizardOpen(true)}
                  className="text-xs px-2 py-1 rounded transition-colors hover:bg-[hsl(0,0%,15%)]"
                  style={{ color: colors.textTertiary }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Sources list
          <div className="space-y-3">
            {sources.map((source) => {
              const connector = getConnectorById(source.connectorType);
              const statusColor = getStatusColor(source.status);

              return (
                <div
                  key={source.id}
                  className="rounded-lg overflow-hidden transition-all hover:border-[hsl(0,0%,20%)]"
                  style={{
                    background: colors.bgSurface,
                    border: `1px solid ${colors.borderSubtle}`,
                  }}
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Connector icon */}
                    <div
                      className="flex items-center justify-center w-12 h-12 rounded-lg text-xl"
                      style={{ background: colors.bgHover }}
                    >
                      {connector?.icon || "📊"}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3
                          className="font-medium text-sm truncate"
                          style={{ color: colors.textPrimary }}
                        >
                          {source.name}
                        </h3>
                        <span
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                          style={{ background: `${statusColor}20`, color: statusColor }}
                        >
                          {source.status === "syncing" && (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          )}
                          {source.status === "ready" && <CheckCircle className="w-3 h-3" />}
                          {source.status === "error" && <AlertCircle className="w-3 h-3" />}
                          {getStatusLabel(source.status)}
                        </span>
                      </div>
                      <div
                        className="flex items-center gap-3 text-xs mt-1"
                        style={{ color: colors.textTertiary }}
                      >
                        <span>{connector?.name || source.connectorType}</span>
                        <span>•</span>
                        <span>{source.recordCount.toLocaleString()} records</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(source.lastSyncAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSync(source.id)}
                        disabled={source.status === "syncing"}
                        className="p-2 rounded-md transition-colors hover:bg-[hsl(0,0%,15%)]"
                        style={{
                          color: colors.iconSecondary,
                          opacity: source.status === "syncing" ? 0.5 : 1,
                        }}
                        title="Sync now"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${source.status === "syncing" ? "animate-spin" : ""}`}
                        />
                      </button>
                      <button
                        className="p-2 rounded-md transition-colors hover:bg-[hsl(0,0%,15%)]"
                        style={{ color: colors.iconSecondary }}
                        title="Settings"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(source.id)}
                        className="p-2 rounded-md transition-colors hover:bg-[hsl(0,0%,15%)]"
                        style={{ color: colors.iconSecondary }}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Error message */}
                  {source.status === "error" && source.errorMessage && (
                    <div
                      className="px-4 py-3 flex items-center gap-2"
                      style={{
                        background: "hsla(0, 70%, 55%, 0.1)",
                        borderTop: `1px solid ${colors.borderSubtle}`,
                      }}
                    >
                      <AlertCircle className="w-4 h-4" style={{ color: colors.statusError }} />
                      <span className="text-xs" style={{ color: colors.statusError }}>
                        {source.errorMessage}
                      </span>
                    </div>
                  )}

                  {/* Quick actions */}
                  {source.status === "ready" && (
                    <div
                      className="flex items-center gap-4 px-4 py-3"
                      style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
                    >
                      <Link
                        href={`/sources/${source.id}/populations`}
                        className="flex items-center gap-2 text-xs transition-colors hover:text-[hsl(0,0%,93%)]"
                        style={{ color: colors.textTertiary }}
                      >
                        <Users className="w-3.5 h-3.5" />
                        View Populations
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                      <Link
                        href={`/sources/${source.id}/schema`}
                        className="flex items-center gap-2 text-xs transition-colors hover:text-[hsl(0,0%,93%)]"
                        style={{ color: colors.textTertiary }}
                      >
                        <Database className="w-3.5 h-3.5" />
                        View Schema
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Info section */}
        <div
          className="mt-12 p-6 rounded-lg"
          style={{
            background: colors.bgSurface,
            border: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <h3 className="font-medium text-sm mb-3" style={{ color: colors.textPrimary }}>
            Supported Connectors
          </h3>
          <p className="text-xs mb-4" style={{ color: colors.textTertiary }}>
            RLTX supports 600+ data connectors through PyAirbyte. Connect to your CRM,
            databases, data warehouses, and more.
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "Salesforce",
              "HubSpot",
              "PostgreSQL",
              "MySQL",
              "Snowflake",
              "BigQuery",
              "MongoDB",
              "Google Sheets",
              "Mixpanel",
              "Amplitude",
            ].map((name) => (
              <span
                key={name}
                className="px-2 py-1 rounded text-xs"
                style={{ background: colors.bgHover, color: colors.textSecondary }}
              >
                {name}
              </span>
            ))}
            <span className="px-2 py-1 text-xs" style={{ color: colors.textQuaternary }}>
              + 590 more
            </span>
          </div>
        </div>
      </main>

      {/* Wizard Modal */}
      <AddSourceWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onComplete={(sourceId, populationId) => {
          console.log("Source created:", sourceId, "Population:", populationId);
          fetchSources();
        }}
      />
    </div>
  );
}
