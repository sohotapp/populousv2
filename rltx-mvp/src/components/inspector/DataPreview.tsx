"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Database, Table, FileText, Braces, ExternalLink } from "lucide-react";
import { useDataStore, type DatasetMetadata } from "@/stores/data";

interface DataPreviewProps {
  dataId: string;
  inputName?: string;
}

export function DataPreview({ dataId, inputName }: DataPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [dataset, setDataset] = useState<DatasetMetadata | null>(null);
  const { getDataset, datasets } = useDataStore();

  useEffect(() => {
    const data = getDataset(dataId);
    if (data) {
      setDataset(data);
    } else {
      // Try to find in datasets array
      const found = datasets.find((d) => d.dataId === dataId);
      setDataset(found || null);
    }
  }, [dataId, getDataset, datasets]);

  if (!dataset) {
    return (
      <div
        className="p-3 rounded-md"
        style={{
          background: "hsl(0, 0%, 8%)",
          border: "1px solid hsl(0, 0%, 12%)",
        }}
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4" style={{ color: "hsl(0, 0%, 35%)" }} />
          <span className="text-xs" style={{ color: "hsl(0, 0%, 50%)" }}>
            Data not found: {dataId}
          </span>
        </div>
      </div>
    );
  }

  const getTypeIcon = () => {
    switch (dataset.type) {
      case "csv":
      case "xlsx":
        return <Table className="w-4 h-4" />;
      case "json":
        return <Braces className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeColor = () => {
    switch (dataset.type) {
      case "csv":
        return "hsl(142, 70%, 45%)";
      case "json":
        return "hsl(45, 80%, 50%)";
      case "pdf":
        return "hsl(0, 70%, 55%)";
      case "xlsx":
        return "hsl(142, 70%, 45%)";
      default:
        return "hsl(0, 0%, 50%)";
    }
  };

  return (
    <div
      className="rounded-md overflow-hidden"
      style={{
        background: "hsl(0, 0%, 8%)",
        border: "1px solid hsl(0, 0%, 12%)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[hsl(0,0%,10%)] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <button
          className="p-0.5"
          style={{ color: "hsl(0, 0%, 45%)" }}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        <div
          className="p-1 rounded"
          style={{ background: `${getTypeColor()}20` }}
        >
          <span style={{ color: getTypeColor() }}>{getTypeIcon()}</span>
        </div>

        <div className="flex-1 min-w-0">
          {inputName && (
            <span
              className="text-xs uppercase tracking-wide mr-2"
              style={{ color: "hsl(0, 0%, 45%)" }}
            >
              {inputName}:
            </span>
          )}
          <span
            className="text-xs font-medium truncate"
            style={{ color: "hsl(0, 0%, 93%)" }}
          >
            {dataset.filename}
          </span>
        </div>

        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{
            background: `${getTypeColor()}20`,
            color: getTypeColor(),
          }}
        >
          {dataset.type.toUpperCase()}
        </span>
      </div>

      {/* Content */}
      {isExpanded && (
        <div
          className="px-3 pb-3 space-y-3"
          style={{ borderTop: "1px solid hsl(0, 0%, 12%)" }}
        >
          {/* Stats */}
          <div className="flex items-center gap-4 pt-2">
            <div>
              <p
                className="text-xs uppercase tracking-wide"
                style={{ color: "hsl(0, 0%, 40%)", fontSize: "10px" }}
              >
                Rows
              </p>
              <p
                className="text-sm font-medium"
                style={{ color: "hsl(0, 0%, 70%)" }}
              >
                {dataset.rowCount.toLocaleString()}
              </p>
            </div>
            <div>
              <p
                className="text-xs uppercase tracking-wide"
                style={{ color: "hsl(0, 0%, 40%)", fontSize: "10px" }}
              >
                Fields
              </p>
              <p
                className="text-sm font-medium"
                style={{ color: "hsl(0, 0%, 70%)" }}
              >
                {dataset.schema.fields.length}
              </p>
            </div>
          </div>

          {/* Schema */}
          {dataset.schema.fields.length > 0 && (
            <div>
              <p
                className="text-xs uppercase tracking-wide mb-1.5"
                style={{ color: "hsl(0, 0%, 40%)", fontSize: "10px" }}
              >
                Schema
              </p>
              <div className="flex flex-wrap gap-1">
                {dataset.schema.fields.slice(0, 6).map((field) => (
                  <span
                    key={field.name}
                    className="px-1.5 py-0.5 rounded text-xs"
                    style={{
                      background: "hsl(0, 0%, 12%)",
                      color: "hsl(0, 0%, 70%)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {field.name}
                    <span
                      style={{ color: "hsl(0, 0%, 45%)", marginLeft: "4px" }}
                    >
                      {field.type}
                    </span>
                  </span>
                ))}
                {dataset.schema.fields.length > 6 && (
                  <span
                    className="px-1.5 py-0.5 text-xs"
                    style={{ color: "hsl(0, 0%, 45%)" }}
                  >
                    +{dataset.schema.fields.length - 6} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Preview */}
          {dataset.preview.length > 0 && (
            <div>
              <p
                className="text-xs uppercase tracking-wide mb-1.5"
                style={{ color: "hsl(0, 0%, 40%)", fontSize: "10px" }}
              >
                Preview (first 3 rows)
              </p>
              <div
                className="rounded overflow-auto"
                style={{
                  background: "hsl(0, 0%, 6%)",
                  border: "1px solid hsl(0, 0%, 10%)",
                  maxHeight: "100px",
                }}
              >
                <pre
                  className="p-2 text-xs"
                  style={{
                    color: "hsl(0, 0%, 60%)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {JSON.stringify(dataset.preview.slice(0, 3), null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Data ID */}
          <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid hsl(0, 0%, 12%)" }}>
            <code
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: "hsl(0, 0%, 10%)",
                color: "hsl(0, 0%, 50%)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {dataId}
            </code>
            <button
              className="p-1 rounded transition-colors hover:bg-[hsl(0,0%,12%)]"
              style={{ color: "hsl(0, 0%, 45%)" }}
              title="View full data"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
