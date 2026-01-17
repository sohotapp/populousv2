"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Database,
  Plus,
  RefreshCw,
  Trash2,
  FileText,
  Table,
  Braces,
  Copy,
  Check,
  Loader2,
  Upload,
  Link2,
  Search,
} from "lucide-react";
import {
  useDataStore,
  type DatasetMetadata,
} from "@/stores/data";
import {
  useSourcesStore,
  type DataSource,
  type ConnectorDefinition,
} from "@/stores/sources";
import { DataUploadModal } from "./DataUploadModal";
import { DataSourceModal } from "./DataSourceModal";
import { SourceConfigModal } from "../sources/SourceConfigModal";
import { ConnectorLogo } from "../icons/ConnectorLogos";
import type { MergeCategory } from "@/lib/merge/client";

// =============================================================================
// DESIGN TOKENS - DESIGN.md VERBATIM
// =============================================================================

const colors = {
  bgBase: "hsl(0, 0%, 7%)",
  bgElevated: "hsl(0, 0%, 9%)",
  bgSurface: "hsl(0, 0%, 10%)",
  bgHover: "hsl(0, 0%, 12%)",
  bgActive: "hsl(0, 0%, 14%)",
  borderSubtle: "hsl(0, 0%, 12%)",
  borderDefault: "hsl(0, 0%, 15%)",
  borderHover: "hsl(0, 0%, 20%)",
  textPrimary: "hsl(0, 0%, 93%)",
  textSecondary: "hsl(0, 0%, 70%)",
  textTertiary: "hsl(0, 0%, 50%)",
  textQuaternary: "hsl(0, 0%, 35%)",
  iconPrimary: "hsl(0, 0%, 70%)",
  iconSecondary: "hsl(0, 0%, 45%)",
  iconTertiary: "hsl(0, 0%, 30%)",
  iconEmpty: "hsl(0, 0%, 20%)",
  statusSuccess: "hsl(142, 70%, 45%)",
  statusError: "hsl(0, 70%, 55%)",
};

interface UnifiedDataItem {
  id: string;
  name: string;
  type: "upload" | "source";
  origin: string;
  recordCount: number;
  lastUpdated: string;
  status?: "ready" | "syncing" | "error";
  dataset?: DatasetMetadata;
  source?: DataSource;
}

interface DataPanelProps {
  onSelectDataset?: (dataset: DatasetMetadata) => void;
  selectable?: boolean;
}

export function DataPanel({ onSelectDataset, selectable = false }: DataPanelProps) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Database config modal state
  const [selectedDbConnector, setSelectedDbConnector] = useState<ConnectorDefinition | null>(null);

  const {
    datasets,
    isLoading: datasetsLoading,
    fetchDatasets,
    deleteDataset,
    selectedDataId,
    selectDataset,
  } = useDataStore();

  const {
    sources,
    isLoading: sourcesLoading,
    fetchSources,
    createSource,
    deleteSource,
    syncSource,
  } = useSourcesStore();

  // Only fetch if we don't have cached data - show cached immediately
  useEffect(() => {
    // Fetch in parallel, but only if needed
    const shouldFetchDatasets = datasets.length === 0;
    const shouldFetchSources = sources.length === 0;

    if (shouldFetchDatasets || shouldFetchSources) {
      Promise.all([
        shouldFetchDatasets ? fetchDatasets() : Promise.resolve(),
        shouldFetchSources ? fetchSources() : Promise.resolve(),
      ]);
    }
  }, []); // Only run once on mount

  // Background refresh after initial render (stale-while-revalidate pattern)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDatasets();
      fetchSources();
    }, 100); // Small delay to not block initial render
    return () => clearTimeout(timer);
  }, [fetchDatasets, fetchSources]);

  // Unified data list
  const unifiedData = useMemo((): UnifiedDataItem[] => {
    const items: UnifiedDataItem[] = [];

    for (const dataset of datasets) {
      items.push({
        id: `upload-${dataset.dataId}`,
        name: dataset.filename,
        type: "upload",
        origin: dataset.type,
        recordCount: dataset.rowCount,
        lastUpdated: dataset.uploadedAt,
        status: "ready",
        dataset,
      });
    }

    for (const source of sources) {
      items.push({
        id: `source-${source.id}`,
        name: source.name,
        type: "source",
        origin: source.connectorType,
        recordCount: source.recordCount,
        lastUpdated: source.lastSyncAt || source.createdAt,
        status: source.status === "ready" ? "ready" : source.status === "syncing" ? "syncing" : "error",
        source,
      });
    }

    items.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
    return items;
  }, [datasets, sources]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return unifiedData;
    const query = searchQuery.toLowerCase();
    return unifiedData.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.origin.toLowerCase().includes(query)
    );
  }, [unifiedData, searchQuery]);

  const isLoading = datasetsLoading || sourcesLoading;
  const isEmpty = filteredData.length === 0;

  const handleCopyId = (dataId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(dataId);
    setCopiedId(dataId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (item: UnifiedDataItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === "upload" && item.dataset) {
      await deleteDataset(item.dataset.dataId);
    } else if (item.type === "source" && item.source) {
      await deleteSource(item.source.id);
    }
  };

  const handleSync = async (item: UnifiedDataItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === "source" && item.source) {
      await syncSource(item.source.id);
    }
  };

  const handleItemClick = (item: UnifiedDataItem) => {
    if (selectable && item.type === "upload" && item.dataset) {
      selectDataset(item.dataset.dataId);
      onSelectDataset?.(item.dataset);
    }
  };

  // Handle Merge connection complete
  const handleMergeConnect = async (result: {
    linkedAccountId: string;
    integrationSlug: string;
    integrationName: string;
    category: MergeCategory;
    agentCount: number;
  }) => {
    try {
      await createSource({
        name: result.integrationName,
        connectorType: `merge-${result.integrationSlug}`,
        config: {
          linkedAccountId: result.linkedAccountId,
          category: result.category,
        },
        mergeLinkedAccountId: result.linkedAccountId,
        mergeCategory: result.category,
        recordCount: result.agentCount,
      });
      await fetchSources();
    } catch (error) {
      console.error("Failed to create source:", error);
    }
    setIsSourceModalOpen(false);
  };

  // Handle database connector selection
  const handleDatabaseConnect = (connector: ConnectorDefinition) => {
    setSelectedDbConnector(connector);
    setIsSourceModalOpen(false);
  };

  // Handle database config submit
  const handleDbConfigSubmit = async (data: { name: string; config: Record<string, string> }) => {
    if (!selectedDbConnector) return;
    try {
      await createSource({
        name: data.name,
        connectorType: selectedDbConnector.id,
        config: data.config,
      });
      await fetchSources();
      setSelectedDbConnector(null);
    } catch (error) {
      console.error("Failed to create source:", error);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header - DESIGN.md: 13px font, minimal chrome */}
      <header
        className="h-12 flex items-center justify-between px-6 flex-shrink-0"
        style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
      >
        <div className="flex items-baseline gap-2">
          <h1 className="text-[13px] font-medium" style={{ color: colors.textPrimary }}>
            Data Library
          </h1>
          {unifiedData.length > 0 && (
            <span className="text-[11px]" style={{ color: colors.textTertiary }}>
              {unifiedData.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: colors.iconTertiary }}
            />
            <input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 h-7 pl-8 pr-3 text-[13px] rounded outline-none transition-colors"
              style={{
                background: "transparent",
                border: `1px solid ${colors.borderDefault}`,
                color: colors.textPrimary,
              }}
              onFocus={(e) => (e.target.style.borderColor = colors.borderHover)}
              onBlur={(e) => (e.target.style.borderColor = colors.borderDefault)}
            />
          </div>

          {/* Add dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="h-7 flex items-center gap-1.5 px-3 rounded text-[13px] font-medium transition-colors"
              style={{
                background: "transparent",
                border: `1px solid ${colors.borderDefault}`,
                color: colors.textSecondary,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.borderHover;
              }}
              onMouseLeave={(e) => {
                if (!showAddMenu) e.currentTarget.style.borderColor = colors.borderDefault;
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>

            {showAddMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
                <div
                  className="absolute right-0 top-full mt-1 w-44 rounded z-20 py-1"
                  style={{
                    background: colors.bgSurface,
                    border: `1px solid ${colors.borderDefault}`,
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
                  }}
                >
                  <button
                    onClick={() => { setShowAddMenu(false); setIsUploadOpen(true); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] transition-colors text-left"
                    style={{ color: colors.textSecondary }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <Upload className="w-3.5 h-3.5" style={{ color: colors.iconSecondary }} />
                    Upload file
                  </button>
                  <button
                    onClick={() => { setShowAddMenu(false); setIsSourceModalOpen(true); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] transition-colors text-left"
                    style={{ color: colors.textSecondary }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <Link2 className="w-3.5 h-3.5" style={{ color: colors.iconSecondary }} />
                    Connect source
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading && isEmpty ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: colors.iconSecondary }} />
          </div>
        ) : isEmpty ? (
          <EmptyState
            hasSearch={searchQuery.length > 0}
            onUpload={() => setIsUploadOpen(true)}
            onConnect={() => setIsSourceModalOpen(true)}
          />
        ) : (
          <div className="py-1">
            {filteredData.map((item) => (
              <DataRow
                key={item.id}
                item={item}
                isSelected={item.type === "upload" && item.dataset?.dataId === selectedDataId}
                selectable={selectable}
                copiedId={copiedId}
                onClick={() => handleItemClick(item)}
                onCopyId={handleCopyId}
                onDelete={handleDelete}
                onSync={handleSync}
                formatTime={formatTime}
                formatCount={formatCount}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <DataUploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />

      <DataSourceModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        onMergeConnect={handleMergeConnect}
        onDatabaseConnect={handleDatabaseConnect}
      />

      {selectedDbConnector && (
        <SourceConfigModal
          connector={selectedDbConnector}
          isOpen={true}
          onClose={() => setSelectedDbConnector(null)}
          onSubmit={handleDbConfigSubmit}
        />
      )}
    </div>
  );
}

// =============================================================================
// EMPTY STATE - DESIGN.md Pattern
// =============================================================================

function EmptyState({
  hasSearch,
  onUpload,
  onConnect,
}: {
  hasSearch: boolean;
  onUpload: () => void;
  onConnect: () => void;
}) {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-[13px]" style={{ color: colors.textQuaternary }}>
          No results found
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Database className="w-6 h-6 mb-3" style={{ color: colors.iconEmpty }} />
      <p className="text-[13px] mb-1" style={{ color: colors.textTertiary }}>
        No data yet
      </p>
      <p className="text-[12px] mb-4" style={{ color: colors.textQuaternary }}>
        Upload files or connect to external sources
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onUpload}
          className="h-7 flex items-center gap-1.5 px-3 rounded text-[13px] font-medium transition-colors"
          style={{
            background: "transparent",
            border: `1px solid ${colors.borderDefault}`,
            color: colors.textSecondary,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.borderHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.borderDefault; }}
        >
          <Upload className="w-3.5 h-3.5" />
          Upload
        </button>
        <button
          onClick={onConnect}
          className="h-7 flex items-center gap-1.5 px-3 rounded text-[13px] font-medium transition-colors"
          style={{
            background: "transparent",
            border: `1px solid ${colors.borderDefault}`,
            color: colors.textSecondary,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.borderHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.borderDefault; }}
        >
          <Link2 className="w-3.5 h-3.5" />
          Connect
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// DATA ROW - DESIGN.md Hover Reveals Pattern
// =============================================================================

function DataRow({
  item,
  isSelected,
  selectable,
  copiedId,
  onClick,
  onCopyId,
  onDelete,
  onSync,
  formatTime,
  formatCount,
}: {
  item: UnifiedDataItem;
  isSelected: boolean;
  selectable: boolean;
  copiedId: string | null;
  onClick: () => void;
  onCopyId: (id: string, e: React.MouseEvent) => void;
  onDelete: (item: UnifiedDataItem, e: React.MouseEvent) => void;
  onSync: (item: UnifiedDataItem, e: React.MouseEvent) => void;
  formatTime: (time: string) => string;
  formatCount: (count: number) => string;
}) {
  const getIcon = () => {
    if (item.type === "upload") {
      switch (item.origin) {
        case "csv":
        case "xlsx":
          return <Table className="w-4 h-4" style={{ color: colors.iconSecondary }} />;
        case "json":
          return <Braces className="w-4 h-4" style={{ color: colors.iconSecondary }} />;
        default:
          return <FileText className="w-4 h-4" style={{ color: colors.iconSecondary }} />;
      }
    }
    // For sources, extract the base connector ID (remove "merge-" prefix if present)
    const connectorId = item.origin.replace("merge-", "");
    return <ConnectorLogo connectorId={connectorId} className="w-4 h-4" />;
  };

  return (
    <div
      className="group flex items-center gap-3 px-6 py-2 cursor-pointer transition-colors"
      style={{ background: isSelected ? colors.bgHover : "transparent" }}
      onClick={onClick}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = colors.bgHover; }}
      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Icon */}
      {getIcon()}

      {/* Name and metadata - DESIGN.md typography */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-[13px] truncate" style={{ color: colors.textPrimary }}>
          {item.name}
        </span>
        <span className="text-[11px] flex-shrink-0" style={{ color: colors.textQuaternary }}>
          {formatCount(item.recordCount)}
        </span>
        <span className="text-[11px] flex-shrink-0" style={{ color: colors.textQuaternary }}>
          {formatTime(item.lastUpdated)}
        </span>
        {item.status === "syncing" && (
          <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" style={{ color: colors.iconSecondary }} />
        )}
        {item.status === "error" && (
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: colors.statusError }} title="Sync error" />
        )}
      </div>

      {/* Actions - hover reveal per DESIGN.md */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {item.type === "source" && (
          <button
            onClick={(e) => onSync(item, e)}
            disabled={item.status === "syncing"}
            className="p-1.5 rounded transition-colors"
            style={{ color: colors.iconSecondary }}
            onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgActive; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            title="Sync"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${item.status === "syncing" ? "animate-spin" : ""}`} />
          </button>
        )}
        {item.type === "upload" && item.dataset && (
          <button
            onClick={(e) => onCopyId(item.dataset!.dataId, e)}
            className="p-1.5 rounded transition-colors"
            style={{ color: copiedId === item.dataset.dataId ? colors.statusSuccess : colors.iconSecondary }}
            onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgActive; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            title="Copy ID"
          >
            {copiedId === item.dataset.dataId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          onClick={(e) => onDelete(item, e)}
          className="p-1.5 rounded transition-colors"
          style={{ color: colors.iconSecondary }}
          onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgActive; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
