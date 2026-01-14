"use client";

import { useState, useCallback } from "react";
import {
  ArrowRight,
  Sparkles,
  X,
  ChevronDown,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type { SourceSchema, FieldMapping, SourceField } from "@/stores/sources";
import { RLTX_TRAITS, TRANSFORM_TYPES } from "@/stores/sources";

// Design tokens from design.md
const colors = {
  bgBase: "hsl(0, 0%, 7%)",
  bgSurface: "hsl(0, 0%, 10%)",
  bgElevated: "hsl(0, 0%, 9%)",
  bgInput: "hsl(0, 0%, 8%)",
  bgHover: "hsl(0, 0%, 12%)",
  borderSubtle: "hsl(0, 0%, 12%)",
  borderDefault: "hsl(0, 0%, 15%)",
  textPrimary: "hsl(0, 0%, 93%)",
  textSecondary: "hsl(0, 0%, 70%)",
  textTertiary: "hsl(0, 0%, 50%)",
  textQuaternary: "hsl(0, 0%, 35%)",
  iconSecondary: "hsl(0, 0%, 45%)",
  statusSuccess: "hsl(142, 70%, 45%)",
  statusWarning: "hsl(38, 90%, 50%)",
  statusError: "hsl(0, 70%, 55%)",
  accentPurple: "hsl(270, 70%, 60%)",
};

interface MappingBuilderProps {
  schema: SourceSchema;
  mappings: FieldMapping[];
  onMappingsChange: (mappings: FieldMapping[]) => void;
  onSuggestMappings?: () => Promise<FieldMapping[]>;
  isLoadingSuggestions?: boolean;
}

export function MappingBuilder({
  schema,
  mappings,
  onMappingsChange,
  onSuggestMappings,
  isLoadingSuggestions,
}: MappingBuilderProps) {
  const [expandedMapping, setExpandedMapping] = useState<string | null>(null);

  // Get unmapped traits
  const mappedTraits = new Set(mappings.map((m) => m.targetTrait));
  const unmappedTraits = RLTX_TRAITS.filter((t) => !mappedTraits.has(t.name));

  // Get unmapped source fields
  const mappedFields = new Set(mappings.map((m) => m.sourceField));
  const unmappedFields = schema.fields.filter((f) => !mappedFields.has(f.name));

  const handleAddMapping = (sourceField: string, targetTrait: string) => {
    const field = schema.fields.find((f) => f.name === sourceField);
    const newMapping: FieldMapping = {
      id: `map_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sourceId: schema.sourceId,
      streamName: schema.streamName,
      sourceField,
      targetTrait,
      transformType: field?.suggestedTransform || "direct",
      matchMethod: "manual",
      confidence: 1.0,
      userConfirmed: true,
    };
    onMappingsChange([...mappings, newMapping]);
  };

  const handleRemoveMapping = (mappingId: string) => {
    onMappingsChange(mappings.filter((m) => m.id !== mappingId));
  };

  const handleUpdateMapping = (mappingId: string, updates: Partial<FieldMapping>) => {
    onMappingsChange(
      mappings.map((m) => (m.id === mappingId ? { ...m, ...updates } : m))
    );
  };

  const handleApplySuggestions = async () => {
    if (!onSuggestMappings) return;
    const suggestions = await onSuggestMappings();
    // Add suggestions that don't conflict with existing mappings
    const newMappings = suggestions.filter(
      (s) => !mappedFields.has(s.sourceField) && !mappedTraits.has(s.targetTrait)
    );
    onMappingsChange([...mappings, ...newMappings]);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return colors.statusSuccess;
    if (confidence >= 0.7) return colors.statusWarning;
    return colors.statusError;
  };

  return (
    <div className="space-y-4">
      {/* AI Suggestions button */}
      {onSuggestMappings && (
        <button
          onClick={handleApplySuggestions}
          disabled={isLoadingSuggestions}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md transition-colors"
          style={{
            background: "hsla(270, 70%, 60%, 0.15)",
            border: `1px solid hsla(270, 70%, 60%, 0.3)`,
            color: colors.accentPurple,
            opacity: isLoadingSuggestions ? 0.6 : 1,
          }}
        >
          {isLoadingSuggestions ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">
            {isLoadingSuggestions ? "Analyzing fields..." : "Auto-suggest mappings"}
          </span>
        </button>
      )}

      {/* Mappings list */}
      <div className="space-y-2">
        {mappings.map((mapping) => {
          const sourceField = schema.fields.find((f) => f.name === mapping.sourceField);
          const targetTrait = RLTX_TRAITS.find((t) => t.name === mapping.targetTrait);
          const isExpanded = expandedMapping === mapping.id;

          return (
            <div
              key={mapping.id}
              className="rounded-md overflow-hidden"
              style={{
                background: colors.bgBase,
                border: `1px solid ${colors.borderSubtle}`,
              }}
            >
              {/* Mapping row */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={() => setExpandedMapping(isExpanded ? null : mapping.id)}
              >
                {/* Source field */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-mono truncate"
                    style={{ color: colors.textPrimary }}
                  >
                    {mapping.sourceField}
                  </p>
                  <p className="text-xs" style={{ color: colors.textTertiary }}>
                    {sourceField?.type || "unknown"}
                  </p>
                </div>

                {/* Arrow with transform */}
                <div className="flex items-center gap-1">
                  <div
                    className="px-2 py-0.5 rounded text-2xs"
                    style={{
                      background: colors.bgHover,
                      color: colors.textSecondary,
                    }}
                  >
                    {TRANSFORM_TYPES.find((t) => t.id === mapping.transformType)?.label || mapping.transformType}
                  </div>
                  <ArrowRight className="w-4 h-4" style={{ color: colors.iconSecondary }} />
                </div>

                {/* Target trait */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: colors.textPrimary }}
                  >
                    {targetTrait?.label || mapping.targetTrait}
                  </p>
                  <p className="text-xs" style={{ color: colors.textTertiary }}>
                    RLTX trait
                  </p>
                </div>

                {/* Confidence */}
                <div className="flex items-center gap-2">
                  {mapping.userConfirmed ? (
                    <Check className="w-4 h-4" style={{ color: colors.statusSuccess }} />
                  ) : (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        background: `${getConfidenceColor(mapping.confidence)}20`,
                        color: getConfidenceColor(mapping.confidence),
                      }}
                    >
                      {Math.round(mapping.confidence * 100)}%
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveMapping(mapping.id);
                    }}
                    className="p-1 rounded transition-colors hover:bg-[hsl(0,0%,15%)]"
                    style={{ color: colors.textTertiary }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded config */}
              {isExpanded && (
                <div
                  className="px-3 pb-3 space-y-3"
                  style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
                >
                  {/* Transform selector */}
                  <div className="pt-3">
                    <label
                      className="block text-xs font-medium mb-1.5"
                      style={{ color: colors.textSecondary }}
                    >
                      Transform
                    </label>
                    <select
                      value={mapping.transformType}
                      onChange={(e) =>
                        handleUpdateMapping(mapping.id, { transformType: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-md text-sm transition-all outline-none appearance-none cursor-pointer"
                      style={{
                        background: colors.bgInput,
                        border: `1px solid ${colors.borderDefault}`,
                        color: colors.textPrimary,
                      }}
                    >
                      {TRANSFORM_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label} - {t.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sample output */}
                  {sourceField?.sample !== undefined && (
                    <div>
                      <label
                        className="block text-xs font-medium mb-1.5"
                        style={{ color: colors.textSecondary }}
                      >
                        Preview
                      </label>
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-md"
                        style={{
                          background: colors.bgSurface,
                          border: `1px solid ${colors.borderSubtle}`,
                        }}
                      >
                        <span className="text-sm font-mono" style={{ color: colors.textTertiary }}>
                          {String(sourceField.sample)}
                        </span>
                        <ArrowRight className="w-4 h-4" style={{ color: colors.iconSecondary }} />
                        <span className="text-sm font-mono" style={{ color: colors.textPrimary }}>
                          {mapping.transformType === "date_to_age"
                            ? `${new Date().getFullYear() - new Date(String(sourceField.sample)).getFullYear()} years old`
                            : mapping.transformType === "income_to_bracket"
                            ? Number(sourceField.sample) < 50000
                              ? "low"
                              : Number(sourceField.sample) < 100000
                              ? "medium"
                              : Number(sourceField.sample) < 200000
                              ? "high"
                              : "affluent"
                            : String(sourceField.sample)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Confirm button */}
                  {!mapping.userConfirmed && (
                    <button
                      onClick={() =>
                        handleUpdateMapping(mapping.id, { userConfirmed: true, confidence: 1.0 })
                      }
                      className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors"
                      style={{
                        background: "hsla(142, 70%, 45%, 0.15)",
                        color: colors.statusSuccess,
                      }}
                    >
                      <Check className="w-4 h-4" />
                      Confirm mapping
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add mapping */}
      {unmappedFields.length > 0 && unmappedTraits.length > 0 && (
        <div
          className="p-3 rounded-md"
          style={{
            background: colors.bgBase,
            border: `1px dashed ${colors.borderDefault}`,
          }}
        >
          <p
            className="text-xs font-medium mb-2"
            style={{ color: colors.textTertiary }}
          >
            Add mapping
          </p>
          <div className="flex items-center gap-2">
            <select
              id="source-field-select"
              className="flex-1 px-3 py-2 rounded-md text-sm transition-all outline-none appearance-none cursor-pointer"
              style={{
                background: colors.bgInput,
                border: `1px solid ${colors.borderDefault}`,
                color: colors.textPrimary,
              }}
              defaultValue=""
            >
              <option value="" disabled>
                Source field...
              </option>
              {unmappedFields.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name} ({f.type})
                </option>
              ))}
            </select>

            <ArrowRight className="w-4 h-4" style={{ color: colors.iconSecondary }} />

            <select
              id="target-trait-select"
              className="flex-1 px-3 py-2 rounded-md text-sm transition-all outline-none appearance-none cursor-pointer"
              style={{
                background: colors.bgInput,
                border: `1px solid ${colors.borderDefault}`,
                color: colors.textPrimary,
              }}
              defaultValue=""
            >
              <option value="" disabled>
                RLTX trait...
              </option>
              {unmappedTraits.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                const sourceSelect = document.getElementById("source-field-select") as HTMLSelectElement;
                const targetSelect = document.getElementById("target-trait-select") as HTMLSelectElement;
                if (sourceSelect.value && targetSelect.value) {
                  handleAddMapping(sourceSelect.value, targetSelect.value);
                  sourceSelect.value = "";
                  targetSelect.value = "";
                }
              }}
              className="p-2 rounded-md transition-colors"
              style={{
                background: colors.textPrimary,
                color: colors.bgBase,
              }}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Unmapped traits warning */}
      {unmappedTraits.filter((t) => t.required).length > 0 && (
        <div
          className="flex items-start gap-2 p-3 rounded-md"
          style={{
            background: "hsla(38, 90%, 50%, 0.1)",
            border: `1px solid hsla(38, 90%, 50%, 0.3)`,
          }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5" style={{ color: colors.statusWarning }} />
          <div>
            <p className="text-sm" style={{ color: colors.statusWarning }}>
              Required traits not mapped
            </p>
            <p className="text-xs mt-1" style={{ color: colors.textTertiary }}>
              {unmappedTraits
                .filter((t) => t.required)
                .map((t) => t.label)
                .join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div
        className="flex items-center justify-between p-3 rounded-md"
        style={{
          background: colors.bgSurface,
          border: `1px solid ${colors.borderSubtle}`,
        }}
      >
        <div>
          <p className="text-sm" style={{ color: colors.textSecondary }}>
            {mappings.length} mappings configured
          </p>
          <p className="text-xs" style={{ color: colors.textTertiary }}>
            {mappings.filter((m) => m.userConfirmed).length} confirmed •{" "}
            {mappings.filter((m) => !m.userConfirmed).length} pending review
          </p>
        </div>
        <div
          className="px-2 py-1 rounded text-xs font-medium"
          style={{
            background:
              mappings.length >= 4
                ? "hsla(142, 70%, 45%, 0.15)"
                : "hsla(38, 90%, 50%, 0.15)",
            color:
              mappings.length >= 4
                ? colors.statusSuccess
                : colors.statusWarning,
          }}
        >
          {mappings.length >= 4 ? "Ready" : "Need more mappings"}
        </div>
      </div>
    </div>
  );
}
