"use client";

import { useEffect, useState } from "react";
import {
  Trash2,
  FileText,
  Table,
  Braces,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Database,
} from "lucide-react";
import {
  useDataStore,
  formatFileSize,
  formatRelativeTime,
  getFileTypeColor,
  type DatasetMetadata,
} from "@/stores/data";
import { DataUploadModal } from "./DataUploadModal";

// Design tokens from design.md
const colors = {
  bgBase: "hsl(0, 0%, 7%)",
  bgHover: "hsl(0, 0%, 12%)",
  borderSubtle: "hsl(0, 0%, 12%)",
  borderDefault: "hsl(0, 0%, 15%)",
  textPrimary: "hsl(0, 0%, 93%)",
  textSecondary: "hsl(0, 0%, 70%)",
  textTertiary: "hsl(0, 0%, 50%)",
  textQuaternary: "hsl(0, 0%, 35%)",
  iconEmpty: "hsl(0, 0%, 20%)",
  iconSecondary: "hsl(0, 0%, 45%)",
};

interface DataBrowserProps {
  onSelectDataset?: (dataset: DatasetMetadata) => void;
  selectable?: boolean;
  onUploadClick?: () => void;
}

export function DataBrowser({ onSelectDataset, selectable = false, onUploadClick }: DataBrowserProps) {
  const { datasets, isLoading, fetchDatasets, deleteDataset, selectedDataId, selectDataset } = useDataStore();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const handleCopyId = (dataId: string) => {
    navigator.clipboard.writeText(dataId);
    setCopiedId(dataId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (e: React.MouseEvent, dataId: string) => {
    e.stopPropagation();
    if (confirm("Delete this dataset?")) {
      await deleteDataset(dataId);
    }
  };

  const handleSelect = (dataset: DatasetMetadata) => {
    if (selectable) {
      selectDataset(dataset.dataId);
      onSelectDataset?.(dataset);
    } else {
      setExpandedId(expandedId === dataset.dataId ? null : dataset.dataId);
    }
  };

  const getIcon = (type: DatasetMetadata["type"]) => {
    switch (type) {
      case "csv":
      case "xlsx":
        return <Table className="w-4 h-4" />;
      case "json":
        return <Braces className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  // Handle opening upload modal - use callback if provided, otherwise internal state
  const handleUploadOpen = () => {
    if (onUploadClick) {
      onUploadClick();
    } else {
      setIsUploadOpen(true);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Content - no internal header, relies on parent page header */}
      <div className="flex-1 overflow-auto">
        {isLoading && datasets.length === 0 ? (
          // Loading state - matches other views' loading spinner placement
          <div
            className="flex items-center justify-center"
            style={{ padding: "48px 24px" }}
          >
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: colors.textTertiary, borderTopColor: "transparent" }}
            />
          </div>
        ) : datasets.length === 0 ? (
          // Empty state - EXACTLY matches EmptyState component in page.tsx
          // design.md: padding 48px 24px, centered
          <div
            className="flex flex-col items-center justify-center text-center"
            style={{ padding: "48px 24px" }}
          >
            {/* design.md: icon color hsl(0,0%,20%), margin-bottom 16px */}
            <Database
              className="w-6 h-6"
              style={{ color: colors.iconEmpty, marginBottom: "16px" }}
            />
            {/* design.md: 13px, font-weight 500, hsl(0,0%,50%) - use h2 like EmptyState */}
            <h2
              className="text-[13px] font-medium"
              style={{ color: colors.textTertiary }}
            >
              No datasets yet
            </h2>
            {/* design.md: 13px, hsl(0,0%,35%), margin-top 4px, max-w-xs like EmptyState */}
            <p
              className="text-[13px] max-w-xs"
              style={{ color: colors.textQuaternary, marginTop: "4px" }}
            >
              Upload CSV, JSON, or PDF files to use in workflows
            </p>
          </div>
        ) : (
          // List view - has its own padding for the cards
          <div className="p-4 space-y-2">
            {datasets.map((dataset) => {
              const isExpanded = expandedId === dataset.dataId;
              const isSelected = selectedDataId === dataset.dataId;

              return (
                <div
                  key={dataset.dataId}
                  className="rounded-md transition-all"
                  style={{
                    background: isSelected ? "hsl(0, 0%, 12%)" : "hsl(0, 0%, 7%)",
                    border: `1px solid ${isSelected ? "hsl(0, 0%, 20%)" : "hsl(0, 0%, 12%)"}`,
                  }}
                >
                  {/* Card header */}
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer"
                    onClick={() => handleSelect(dataset)}
                  >
                    {/* Expand icon (when not selectable) */}
                    {!selectable && (
                      <button
                        className="p-0.5"
                        style={{ color: "hsl(0, 0%, 45%)" }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    )}

                    {/* Type icon */}
                    <div
                      className="p-1.5 rounded"
                      style={{ background: `${getFileTypeColor(dataset.type)}20` }}
                    >
                      <span style={{ color: getFileTypeColor(dataset.type) }}>
                        {getIcon(dataset.type)}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-medium truncate"
                        style={{ color: "hsl(0, 0%, 93%)", fontSize: "13px" }}
                      >
                        {dataset.filename}
                      </p>
                      <p style={{ color: "hsl(0, 0%, 50%)", fontSize: "11px" }}>
                        {formatFileSize(dataset.size)} • {dataset.rowCount} rows • {formatRelativeTime(dataset.uploadedAt)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyId(dataset.dataId);
                        }}
                        className="p-1.5 rounded transition-colors"
                        style={{ color: "hsl(0, 0%, 45%)" }}
                        title="Copy data ID"
                      >
                        {copiedId === dataset.dataId ? (
                          <Check className="w-3.5 h-3.5" style={{ color: "hsl(142, 70%, 45%)" }} />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, dataset.dataId)}
                        className="p-1.5 rounded transition-colors"
                        style={{ color: "hsl(0, 0%, 45%)" }}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div
                      className="px-3 pb-3"
                      style={{ borderTop: "1px solid hsl(0, 0%, 12%)" }}
                    >
                      {/* Schema */}
                      <div className="pt-3">
                        <p
                          className="mb-2 uppercase tracking-wide"
                          style={{ color: "hsl(0, 0%, 45%)", fontSize: "10px", letterSpacing: "0.05em" }}
                        >
                          Schema
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {dataset.schema.fields.map((field) => (
                            <span
                              key={field.name}
                              className="px-2 py-0.5 rounded"
                              style={{
                                background: "hsl(0, 0%, 10%)",
                                color: "hsl(0, 0%, 70%)",
                                fontSize: "11px",
                              }}
                            >
                              {field.name}
                              <span style={{ color: "hsl(0, 0%, 45%)", marginLeft: "4px" }}>
                                {field.type}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Preview */}
                      {dataset.preview.length > 0 && (
                        <div className="pt-3 mt-3" style={{ borderTop: "1px solid hsl(0, 0%, 12%)" }}>
                          <p
                            className="mb-2 uppercase tracking-wide"
                            style={{ color: "hsl(0, 0%, 45%)", fontSize: "10px", letterSpacing: "0.05em" }}
                          >
                            Preview (first {Math.min(3, dataset.preview.length)} rows)
                          </p>
                          <div
                            className="rounded overflow-auto"
                            style={{
                              background: "hsl(0, 0%, 8%)",
                              border: "1px solid hsl(0, 0%, 12%)",
                              maxHeight: "120px",
                            }}
                          >
                            <pre
                              className="p-2 text-xs"
                              style={{ color: "hsl(0, 0%, 70%)", fontFamily: "var(--font-mono)" }}
                            >
                              {JSON.stringify(dataset.preview.slice(0, 3), null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Data ID */}
                      <div className="pt-3 mt-3" style={{ borderTop: "1px solid hsl(0, 0%, 12%)" }}>
                        <p
                          className="mb-1 uppercase tracking-wide"
                          style={{ color: "hsl(0, 0%, 45%)", fontSize: "10px", letterSpacing: "0.05em" }}
                        >
                          Data ID
                        </p>
                        <code
                          className="px-2 py-1 rounded text-xs"
                          style={{
                            background: "hsl(0, 0%, 10%)",
                            color: "hsl(0, 0%, 70%)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {dataset.dataId}
                        </code>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Modal - only render if no external handler provided */}
      {!onUploadClick && (
        <DataUploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
        />
      )}
    </div>
  );
}
