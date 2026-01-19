"use client";

import { useState, useEffect } from "react";
import {
  X,
  Check,
  AlertCircle,
  ArrowRight,
  Loader2,
  Sparkles,
  RefreshCw,
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

// Standard RLTX traits
const RLTX_TRAITS = [
  { value: "age", label: "Age", category: "Demographics" },
  { value: "gender", label: "Gender", category: "Demographics" },
  { value: "income", label: "Income", category: "Demographics" },
  { value: "education", label: "Education", category: "Demographics" },
  { value: "location", label: "Location Type", category: "Demographics" },
  { value: "region", label: "Region", category: "Demographics" },
  { value: "employment", label: "Employment Status", category: "Demographics" },
  { value: "household_size", label: "Household Size", category: "Demographics" },
  { value: "industry", label: "Industry", category: "Professional" },
  { value: "role", label: "Role/Title", category: "Professional" },
  { value: "company_size", label: "Company Size", category: "Professional" },
  { value: "years_experience", label: "Years Experience", category: "Professional" },
  { value: "risk_tolerance", label: "Risk Tolerance", category: "Psychographics" },
  { value: "price_sensitivity", label: "Price Sensitivity", category: "Psychographics" },
  { value: "brand_loyalty", label: "Brand Loyalty", category: "Psychographics" },
  { value: "tech_adoption", label: "Tech Adoption", category: "Psychographics" },
];

// Transform types
const TRANSFORM_TYPES = [
  { value: "direct", label: "Direct (no transform)" },
  { value: "date_to_age", label: "Date → Age Bucket" },
  { value: "income_to_bracket", label: "Income → Bracket" },
  { value: "map_values", label: "Value Mapping" },
  { value: "lowercase", label: "Lowercase" },
  { value: "uppercase", label: "Uppercase" },
  { value: "boolean_to_string", label: "Boolean → Yes/No" },
];

interface SourceField {
  name: string;
  type: string;
  sample?: unknown;
}

interface FieldMapping {
  sourceField: string;
  targetTrait: string | null;
  transformType: string;
  confidence: number;
  userConfirmed: boolean;
  sampleOutput?: unknown[];
}

interface FieldMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceId: string;
  sourceName: string;
  streamName: string;
  fields: SourceField[];
  onSave: (mappings: FieldMapping[]) => void;
}

export function FieldMappingModal({
  isOpen,
  onClose,
  sourceId,
  sourceName,
  streamName,
  fields,
  onSave,
}: FieldMappingModalProps) {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [isAutoMapping, setIsAutoMapping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize mappings from fields
  useEffect(() => {
    if (fields.length > 0 && mappings.length === 0) {
      setMappings(
        fields.map((field) => ({
          sourceField: field.name,
          targetTrait: null,
          transformType: "direct",
          confidence: 0,
          userConfirmed: false,
        }))
      );
    }
  }, [fields, mappings.length]);

  // Auto-suggest mappings using semantic similarity
  const handleAutoMap = async () => {
    setIsAutoMapping(true);
    try {
      const response = await fetch("/api/sources/suggest-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });

      if (response.ok) {
        const suggestions = await response.json();
        setMappings((prev) =>
          prev.map((mapping) => {
            const suggestion = suggestions.find(
              (s: { sourceField: string }) => s.sourceField === mapping.sourceField
            );
            if (suggestion && suggestion.suggestedTrait) {
              return {
                ...mapping,
                targetTrait: suggestion.suggestedTrait,
                transformType: suggestion.suggestedTransform || "direct",
                confidence: suggestion.confidence || 0,
                userConfirmed: false,
              };
            }
            return mapping;
          })
        );
      }
    } catch (error) {
      console.error("Auto-mapping failed:", error);
    } finally {
      setIsAutoMapping(false);
    }
  };

  // Update a single mapping
  const updateMapping = (
    sourceField: string,
    updates: Partial<FieldMapping>
  ) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.sourceField === sourceField
          ? { ...m, ...updates, userConfirmed: true }
          : m
      )
    );
  };

  // Confirm a suggested mapping
  const confirmMapping = (sourceField: string) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.sourceField === sourceField ? { ...m, userConfirmed: true } : m
      )
    );
  };

  // Clear a mapping
  const clearMapping = (sourceField: string) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.sourceField === sourceField
          ? { ...m, targetTrait: null, confidence: 0, userConfirmed: false }
          : m
      )
    );
  };

  // Save mappings
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Filter to only confirmed mappings with targets
      const confirmedMappings = mappings.filter(
        (m) => m.targetTrait && m.userConfirmed
      );
      await onSave(confirmedMappings);
      onClose();
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Get field sample value
  const getFieldSample = (fieldName: string): string => {
    const field = fields.find((f) => f.name === fieldName);
    if (!field?.sample) return "—";
    const sample = field.sample;
    if (typeof sample === "object") return JSON.stringify(sample).slice(0, 50);
    return String(sample).slice(0, 50);
  };

  // Count mapped fields
  const mappedCount = mappings.filter((m) => m.targetTrait).length;
  const confirmedCount = mappings.filter((m) => m.userConfirmed && m.targetTrait).length;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)" }}
    >
      <div
        className="w-full max-w-4xl max-h-[85vh] rounded-xl overflow-hidden flex flex-col"
        style={{ background: colors.bgElevated, border: `1px solid ${colors.borderDefault}` }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
        >
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: colors.textPrimary }}>
              Map Fields to RLTX Traits
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: colors.textTertiary }}>
              {sourceName} → {streamName} • {fields.length} fields
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
          >
            <X className="w-5 h-5" style={{ color: colors.textSecondary }} />
          </button>
        </div>

        {/* Toolbar */}
        <div
          className="px-6 py-3 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={handleAutoMap}
              disabled={isAutoMapping}
              className="px-3 py-1.5 text-[12px] rounded-lg flex items-center gap-1.5 transition-colors"
              style={{
                background: colors.statusInfo,
                color: "white",
                opacity: isAutoMapping ? 0.7 : 1,
              }}
            >
              {isAutoMapping ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Auto-Suggest Mappings
            </button>
            <span className="text-[11px]" style={{ color: colors.textTertiary }}>
              {mappedCount} of {fields.length} mapped • {confirmedCount} confirmed
            </span>
          </div>
          <button
            onClick={() => setMappings(fields.map((f) => ({
              sourceField: f.name,
              targetTrait: null,
              transformType: "direct",
              confidence: 0,
              userConfirmed: false,
            })))}
            className="px-2.5 py-1 text-[11px] rounded flex items-center gap-1"
            style={{ color: colors.textTertiary }}
          >
            <RefreshCw className="w-3 h-3" />
            Reset All
          </button>
        </div>

        {/* Mapping Table */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            {mappings.map((mapping) => {
              const field = fields.find((f) => f.name === mapping.sourceField);
              const hasMapping = !!mapping.targetTrait;
              const isConfirmed = mapping.userConfirmed && hasMapping;
              const isSuggested = hasMapping && !mapping.userConfirmed;

              return (
                <div
                  key={mapping.sourceField}
                  className="p-3 rounded-lg transition-colors"
                  style={{
                    background: isConfirmed
                      ? `${colors.statusSuccess}10`
                      : isSuggested
                        ? `${colors.statusWarning}10`
                        : colors.bgSurface,
                    border: `1px solid ${
                      isConfirmed
                        ? colors.statusSuccess + "40"
                        : isSuggested
                          ? colors.statusWarning + "40"
                          : colors.borderSubtle
                    }`,
                  }}
                >
                  <div className="flex items-center gap-4">
                    {/* Source Field */}
                    <div className="w-48 flex-shrink-0">
                      <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
                        {mapping.sourceField}
                      </div>
                      <div className="text-[10px]" style={{ color: colors.textQuaternary }}>
                        {field?.type || "unknown"} • {getFieldSample(mapping.sourceField)}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: colors.textQuaternary }} />

                    {/* Target Trait Select */}
                    <select
                      value={mapping.targetTrait || ""}
                      onChange={(e) =>
                        updateMapping(mapping.sourceField, {
                          targetTrait: e.target.value || null,
                        })
                      }
                      className="flex-1 h-8 px-2 text-[12px] rounded outline-none"
                      style={{
                        background: colors.bgBase,
                        border: `1px solid ${colors.borderDefault}`,
                        color: colors.textPrimary,
                      }}
                    >
                      <option value="">— Skip this field —</option>
                      {["Demographics", "Professional", "Psychographics"].map((category) => (
                        <optgroup key={category} label={category}>
                          {RLTX_TRAITS.filter((t) => t.category === category).map((trait) => (
                            <option key={trait.value} value={trait.value}>
                              {trait.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    {/* Transform Select */}
                    <select
                      value={mapping.transformType}
                      onChange={(e) =>
                        updateMapping(mapping.sourceField, {
                          transformType: e.target.value,
                        })
                      }
                      disabled={!hasMapping}
                      className="w-40 h-8 px-2 text-[12px] rounded outline-none disabled:opacity-50"
                      style={{
                        background: colors.bgBase,
                        border: `1px solid ${colors.borderDefault}`,
                        color: colors.textPrimary,
                      }}
                    >
                      {TRANSFORM_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>

                    {/* Confidence / Actions */}
                    <div className="w-24 flex items-center justify-end gap-2">
                      {isSuggested && (
                        <>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              background: colors.statusWarning + "20",
                              color: colors.statusWarning,
                            }}
                          >
                            {Math.round(mapping.confidence * 100)}%
                          </span>
                          <button
                            onClick={() => confirmMapping(mapping.sourceField)}
                            className="p-1 rounded hover:bg-white/10"
                            title="Confirm mapping"
                          >
                            <Check className="w-4 h-4" style={{ color: colors.statusSuccess }} />
                          </button>
                          <button
                            onClick={() => clearMapping(mapping.sourceField)}
                            className="p-1 rounded hover:bg-white/10"
                            title="Clear mapping"
                          >
                            <X className="w-4 h-4" style={{ color: colors.statusError }} />
                          </button>
                        </>
                      )}
                      {isConfirmed && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"
                          style={{
                            background: colors.statusSuccess + "20",
                            color: colors.statusSuccess,
                          }}
                        >
                          <Check className="w-3 h-3" />
                          Confirmed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex items-center justify-between flex-shrink-0"
          style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" style={{ color: colors.statusWarning }} />
            <span className="text-[11px]" style={{ color: colors.textTertiary }}>
              Only confirmed mappings will be saved
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[12px] rounded-lg"
              style={{ color: colors.textSecondary }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={confirmedCount === 0 || isSaving}
              className="px-4 py-2 text-[12px] rounded-lg flex items-center gap-2 disabled:opacity-50"
              style={{ background: colors.statusInfo, color: "white" }}
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Save {confirmedCount} Mapping{confirmedCount !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
