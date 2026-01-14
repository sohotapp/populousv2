"use client";

import { useState } from "react";
import {
  Table,
  ChevronDown,
  ChevronRight,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  Braces,
  List,
  Sparkles,
} from "lucide-react";
import type { SourceSchema, SourceField } from "@/stores/sources";

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
  statusSuccess: "hsl(142, 70%, 45%)",
  accentPurple: "hsl(270, 70%, 60%)",
};

const typeIcons: Record<string, typeof Type> = {
  string: Type,
  number: Hash,
  date: Calendar,
  timestamp: Calendar,
  boolean: ToggleLeft,
  object: Braces,
  array: List,
};

const typeColors: Record<string, string> = {
  string: "hsl(210, 70%, 55%)",
  number: "hsl(38, 90%, 50%)",
  date: "hsl(142, 70%, 45%)",
  timestamp: "hsl(142, 70%, 45%)",
  boolean: "hsl(270, 70%, 60%)",
  object: "hsl(0, 70%, 55%)",
  array: "hsl(330, 70%, 55%)",
};

interface SchemaExplorerProps {
  schemas: SourceSchema[];
  selectedStream?: string;
  onSelectStream: (streamName: string) => void;
  onSelectField?: (field: SourceField, streamName: string) => void;
}

export function SchemaExplorer({
  schemas,
  selectedStream,
  onSelectStream,
  onSelectField,
}: SchemaExplorerProps) {
  const [expandedStreams, setExpandedStreams] = useState<Set<string>>(
    new Set([selectedStream || schemas[0]?.streamName])
  );

  const toggleStream = (streamName: string) => {
    const newExpanded = new Set(expandedStreams);
    if (newExpanded.has(streamName)) {
      newExpanded.delete(streamName);
    } else {
      newExpanded.add(streamName);
    }
    setExpandedStreams(newExpanded);
    onSelectStream(streamName);
  };

  return (
    <div className="space-y-2">
      {schemas.map((schema) => {
        const isExpanded = expandedStreams.has(schema.streamName);
        const isSelected = selectedStream === schema.streamName;
        const suggestedCount = schema.fields.filter((f) => f.suggestedTrait).length;

        return (
          <div
            key={schema.streamName}
            className="rounded-md overflow-hidden"
            style={{
              background: colors.bgBase,
              border: `1px solid ${isSelected ? "hsl(0, 0%, 20%)" : colors.borderSubtle}`,
            }}
          >
            {/* Stream header */}
            <button
              onClick={() => toggleStream(schema.streamName)}
              className="w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-[hsl(0,0%,10%)]"
            >
              <span style={{ color: colors.iconSecondary }}>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>

              <div
                className="p-1.5 rounded"
                style={{ background: "hsla(142, 70%, 45%, 0.15)" }}
              >
                <Table className="w-4 h-4" style={{ color: colors.statusSuccess }} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="font-medium text-sm"
                    style={{ color: colors.textPrimary }}
                  >
                    {schema.streamName}
                  </span>
                  {suggestedCount > 0 && (
                    <span
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs"
                      style={{
                        background: "hsla(270, 70%, 60%, 0.15)",
                        color: colors.accentPurple,
                      }}
                    >
                      <Sparkles className="w-3 h-3" />
                      {suggestedCount} mappable
                    </span>
                  )}
                </div>
                <p className="text-xs" style={{ color: colors.textTertiary }}>
                  {schema.fields.length} fields • {schema.recordCount?.toLocaleString() || "?"} records
                </p>
              </div>
            </button>

            {/* Fields */}
            {isExpanded && (
              <div style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
                <div className="max-h-[300px] overflow-y-auto">
                  {schema.fields.map((field) => {
                    const TypeIcon = typeIcons[field.type] || Type;
                    const typeColor = typeColors[field.type] || colors.textTertiary;

                    return (
                      <div
                        key={field.name}
                        onClick={() => onSelectField?.(field, schema.streamName)}
                        className="flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors hover:bg-[hsl(0,0%,10%)]"
                        style={{
                          borderBottom: `1px solid ${colors.borderSubtle}`,
                        }}
                      >
                        {/* Type icon */}
                        <TypeIcon className="w-3.5 h-3.5" style={{ color: typeColor }} />

                        {/* Field name & type */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-sm font-mono"
                              style={{ color: colors.textPrimary }}
                            >
                              {field.name}
                            </span>
                            {field.nullable && (
                              <span
                                className="text-2xs"
                                style={{ color: colors.textQuaternary }}
                              >
                                nullable
                              </span>
                            )}
                          </div>
                          <span
                            className="text-xs"
                            style={{ color: typeColor }}
                          >
                            {field.type}
                          </span>
                        </div>

                        {/* Sample value */}
                        {field.sample !== undefined && (
                          <span
                            className="text-xs truncate max-w-[120px]"
                            style={{ color: colors.textTertiary }}
                          >
                            {String(field.sample)}
                          </span>
                        )}

                        {/* Suggested mapping */}
                        {field.suggestedTrait && (
                          <span
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs whitespace-nowrap"
                            style={{
                              background: "hsla(270, 70%, 60%, 0.15)",
                              color: colors.accentPurple,
                            }}
                          >
                            <Sparkles className="w-3 h-3" />
                            {field.suggestedTrait}
                            <span style={{ opacity: 0.7 }}>
                              {Math.round((field.confidence || 0) * 100)}%
                            </span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Sample data preview */}
                {schema.sampleRecords && schema.sampleRecords.length > 0 && (
                  <div
                    className="p-3"
                    style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
                  >
                    <p
                      className="text-xs font-medium mb-2 uppercase tracking-wide"
                      style={{ color: colors.textTertiary }}
                    >
                      Sample Data
                    </p>
                    <div
                      className="rounded overflow-auto"
                      style={{
                        background: colors.bgSurface,
                        border: `1px solid ${colors.borderSubtle}`,
                        maxHeight: "120px",
                      }}
                    >
                      <pre
                        className="p-2 text-xs"
                        style={{ color: colors.textSecondary, fontFamily: "var(--font-mono)" }}
                      >
                        {JSON.stringify(schema.sampleRecords[0], null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
