"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  X,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Target,
  Users,
  DollarSign,
  Shield,
  Zap,
  Clock,
  BarChart3,
  GitBranch,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { playbooks, type Playbook } from "@/lib/playbooks";

// ============ DESIGN TOKENS FROM DESIGN.MD ============
const colors = {
  // Backgrounds
  bgBase: "hsl(0, 0%, 7%)",
  bgElevated: "hsl(0, 0%, 9%)",
  bgSurface: "hsl(0, 0%, 10%)",
  bgHover: "hsl(0, 0%, 12%)",
  bgActive: "hsl(0, 0%, 14%)",

  // Text
  textPrimary: "hsl(0, 0%, 93%)",
  textSecondary: "hsl(0, 0%, 70%)",
  textTertiary: "hsl(0, 0%, 50%)",
  textQuaternary: "hsl(0, 0%, 35%)",

  // Icons
  iconPrimary: "hsl(0, 0%, 70%)",
  iconSecondary: "hsl(0, 0%, 45%)",
  iconTertiary: "hsl(0, 0%, 30%)",

  // Borders
  borderSubtle: "hsl(0, 0%, 12%)",
  borderDefault: "hsl(0, 0%, 15%)",
  borderHover: "hsl(0, 0%, 20%)",
  borderFocus: "hsl(0, 0%, 25%)",

  // Accent (for primary actions)
  accent: "hsl(0, 0%, 93%)",
  accentHover: "hsl(0, 0%, 100%)",
};

// Decision types with associated keywords for detection
const DECISION_TYPES = [
  {
    id: "strategy",
    label: "Strategy",
    icon: Target,
    color: "#8b5cf6",
    keywords: ["market", "expansion", "competitive", "growth", "acquisition", "merger", "strategic", "position", "entry"],
  },
  {
    id: "operational",
    label: "Operational",
    icon: Users,
    color: "#f59e0b",
    keywords: ["resource", "allocation", "process", "efficiency", "capacity", "supply", "logistics", "operations", "team"],
  },
  {
    id: "financial",
    label: "Financial",
    icon: DollarSign,
    color: "#22c55e",
    keywords: ["investment", "roi", "budget", "cost", "revenue", "pricing", "valuation", "npv", "profit", "margin"],
  },
  {
    id: "risk",
    label: "Risk",
    icon: Shield,
    color: "#ef4444",
    keywords: ["risk", "threat", "vulnerability", "mitigation", "compliance", "security", "defense", "adversary", "wargame"],
  },
] as const;

type DecisionType = typeof DECISION_TYPES[number]["id"];

// Analysis depth options
const ANALYSIS_DEPTHS = [
  {
    id: "quick",
    label: "Quick",
    description: "Fast analysis",
    estimate: "~2 min",
    icon: Zap,
  },
  {
    id: "standard",
    label: "Standard",
    description: "Balanced depth",
    estimate: "~10 min",
    icon: Clock,
  },
  {
    id: "simulation",
    label: "Simulation",
    description: "Monte Carlo",
    estimate: "~30 min",
    icon: BarChart3,
  },
  {
    id: "multi-party",
    label: "Multi-Party",
    description: "Game Theory",
    estimate: "~45 min",
    icon: GitBranch,
  },
] as const;

type AnalysisDepth = typeof ANALYSIS_DEPTHS[number]["id"];

interface NewWorkflowModalProps {
  onClose: () => void;
  onCreate: (config: {
    name: string;
    question: string;
    decisionType: DecisionType;
    analysisDepth: AnalysisDepth;
    playbook?: string;
  }) => void;
  creating?: boolean;
}

export function NewWorkflowModal({ onClose, onCreate, creating = false }: NewWorkflowModalProps) {
  const [question, setQuestion] = useState("");
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [decisionType, setDecisionType] = useState<DecisionType | null>(null);
  const [analysisDepth, setAnalysisDepth] = useState<AnalysisDepth>("standard");
  const [selectedPlaybook, setSelectedPlaybook] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [detectedContext, setDetectedContext] = useState<{
    type: DecisionType | null;
    confidence: number;
    keywords: string[];
  }>({ type: null, confidence: 0, keywords: [] });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Get relevant playbooks based on decision type
  const suggestedPlaybooks = useMemo(() => {
    if (!decisionType) return [];

    const categoryMap: Record<DecisionType, string[]> = {
      strategy: ["strategy"],
      operational: ["operational"],
      financial: ["financial"],
      risk: ["operational", "defense"],
    };

    const categories = categoryMap[decisionType] || [];
    return Object.values(playbooks)
      .filter((p) => p.type === "template" && categories.includes(p.category))
      .slice(0, 3);
  }, [decisionType]);

  const handleCreate = useCallback(() => {
    if (!question.trim()) return;

    onCreate({
      name: name.trim() || generateNameFromQuestion(question),
      question: question.trim(),
      decisionType: decisionType || "strategy",
      analysisDepth,
      playbook: selectedPlaybook || undefined,
    });
  }, [question, name, decisionType, analysisDepth, selectedPlaybook, onCreate]);

  const canCreate = question.trim().length > 0;

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Handle escape to close and keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      // Cmd/Ctrl + Enter to create
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && question.trim()) {
        handleCreate();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, question, handleCreate]);

  // Auto-detect context from question
  useEffect(() => {
    if (!question.trim()) {
      setDetectedContext({ type: null, confidence: 0, keywords: [] });
      return;
    }

    const lowerQuestion = question.toLowerCase();
    let bestMatch: { type: DecisionType; score: number; keywords: string[] } | null = null;

    for (const dt of DECISION_TYPES) {
      const matchedKeywords = dt.keywords.filter((kw) => lowerQuestion.includes(kw));
      const score = matchedKeywords.length;
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { type: dt.id, score, keywords: matchedKeywords };
      }
    }

    if (bestMatch) {
      const confidence = Math.min(bestMatch.score / 3, 1);
      setDetectedContext({
        type: bestMatch.type,
        confidence,
        keywords: bestMatch.keywords,
      });
      // Auto-select if not manually changed and confidence is high
      if (!decisionType && confidence >= 0.33) {
        setDecisionType(bestMatch.type);
      }
    } else {
      setDetectedContext({ type: null, confidence: 0, keywords: [] });
    }
  }, [question, decisionType]);

  // Auto-generate name from question (if not manually edited)
  useEffect(() => {
    if (!nameEdited && question.trim()) {
      // Generate a concise name from the question
      const generated = generateNameFromQuestion(question);
      setName(generated);
    }
  }, [question, nameEdited]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in"
      style={{ background: "rgba(0, 0, 0, 0.6)" }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="w-full max-w-xl animate-slide-up"
        style={{
          background: colors.bgElevated,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: "8px",
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - design.md: modal padding = 16px (space-4) */}
        <div
          className="flex items-center justify-between px-4 py-4"
          style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
        >
          <div>
            <h2 className="text-[15px] font-medium" style={{ color: colors.textPrimary }}>
              New Workflow
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: colors.textTertiary }}>
              Describe your decision or analysis question
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded transition-colors duration-100"
            style={{ color: colors.iconSecondary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.bgHover;
              e.currentTarget.style.color = colors.iconPrimary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = colors.iconSecondary;
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content - design.md: modal padding = 16px (space-4) */}
        <div className="px-4 py-4 space-y-4">
          {/* Question Textarea - Hero Element */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                className="text-[11px] font-medium uppercase tracking-wide"
                style={{ color: colors.textQuaternary }}
              >
                Question
              </label>
              {detectedContext.confidence > 0 && (
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px]"
                  style={{
                    background: colors.bgHover,
                    color: colors.textTertiary,
                  }}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Context detected</span>
                </div>
              )}
            </div>
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., Should we expand into the European market given competitor X's recent acquisition?"
              className="w-full resize-none outline-none transition-all duration-100"
              style={{
                background: "hsl(0, 0%, 8%)", // design.md: input bg
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: "6px",
                padding: "8px 10px", // design.md: input padding
                minHeight: "100px",
                fontSize: "13px", // design.md: body text = 13px
                lineHeight: "1.5",
                color: colors.textPrimary,
              }}
              onFocus={(e) => (e.target.style.borderColor = colors.borderFocus)}
              onBlur={(e) => (e.target.style.borderColor = colors.borderDefault)}
            />
            {/* Detected keywords */}
            {detectedContext.keywords.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px]" style={{ color: colors.textQuaternary }}>
                  Detected:
                </span>
                {detectedContext.keywords.slice(0, 4).map((kw) => (
                  <span
                    key={kw}
                    className="px-1.5 py-0.5 rounded text-[10px]"
                    style={{
                      background: colors.bgHover,
                      color: colors.textTertiary,
                    }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Name (auto-generated, collapsible) */}
          <div className="space-y-2">
            <label
              className="text-[11px] font-medium uppercase tracking-wide"
              style={{ color: colors.textQuaternary }}
            >
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameEdited(true);
              }}
              placeholder="Auto-generated from question..."
              className="w-full outline-none transition-all duration-100"
              style={{
                background: "hsl(0, 0%, 8%)", // design.md: input bg
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: "6px",
                padding: "8px 10px", // design.md: input padding
                fontSize: "13px",
                color: colors.textPrimary,
              }}
              onFocus={(e) => (e.target.style.borderColor = colors.borderFocus)}
              onBlur={(e) => (e.target.style.borderColor = colors.borderDefault)}
            />
          </div>

          {/* Decision Type Chips */}
          <div className="space-y-2">
            <label
              className="text-[11px] font-medium uppercase tracking-wide"
              style={{ color: colors.textQuaternary }}
            >
              Decision Type
            </label>
            <div className="flex gap-2 flex-wrap">
              {DECISION_TYPES.map((dt) => {
                const Icon = dt.icon;
                const isSelected = decisionType === dt.id;
                const isDetected = detectedContext.type === dt.id;

                return (
                  <button
                    key={dt.id}
                    onClick={() => setDecisionType(dt.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded transition-all duration-100"
                    style={{
                      background: isSelected ? colors.bgActive : colors.bgSurface,
                      border: `1px solid ${isSelected ? (isDetected ? dt.color : colors.borderHover) : colors.borderDefault}`,
                      color: isSelected ? colors.textPrimary : colors.textSecondary,
                      boxShadow: isSelected && isDetected ? `0 0 0 1px ${dt.color}40` : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = colors.bgHover;
                        e.currentTarget.style.borderColor = colors.borderHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = colors.bgSurface;
                        e.currentTarget.style.borderColor = colors.borderDefault;
                      }
                    }}
                  >
                    <Icon
                      className="w-3.5 h-3.5"
                      style={{ color: isSelected ? dt.color : colors.iconSecondary }}
                    />
                    <span className="text-[12px] font-medium">{dt.label}</span>
                    {isDetected && !isSelected && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: dt.color }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Analysis Depth Chips */}
          <div className="space-y-2">
            <label
              className="text-[11px] font-medium uppercase tracking-wide"
              style={{ color: colors.textQuaternary }}
            >
              Analysis Depth
            </label>
            <div className="flex gap-2 flex-wrap">
              {ANALYSIS_DEPTHS.map((depth) => {
                const Icon = depth.icon;
                const isSelected = analysisDepth === depth.id;

                return (
                  <button
                    key={depth.id}
                    onClick={() => setAnalysisDepth(depth.id)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded transition-all duration-100"
                    style={{
                      background: isSelected ? colors.bgActive : colors.bgSurface,
                      border: `1px solid ${isSelected ? colors.borderHover : colors.borderDefault}`,
                      color: isSelected ? colors.textPrimary : colors.textSecondary,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = colors.bgHover;
                        e.currentTarget.style.borderColor = colors.borderHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = colors.bgSurface;
                        e.currentTarget.style.borderColor = colors.borderDefault;
                      }
                    }}
                  >
                    <Icon
                      className="w-3.5 h-3.5"
                      style={{ color: isSelected ? colors.iconPrimary : colors.iconSecondary }}
                    />
                    <div className="text-left">
                      <div className="text-[12px] font-medium">{depth.label}</div>
                      <div
                        className="text-[10px]"
                        style={{ color: colors.textQuaternary }}
                      >
                        {depth.estimate}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Playbook Suggestions */}
          {suggestedPlaybooks.length > 0 && (
            <div className="space-y-2">
              <label
                className="text-[11px] font-medium uppercase tracking-wide"
                style={{ color: colors.textQuaternary }}
              >
                Suggested Templates
              </label>
              <div className="space-y-1.5">
                {suggestedPlaybooks.map((playbook) => (
                  <PlaybookSuggestion
                    key={playbook.id}
                    playbook={playbook}
                    isSelected={selectedPlaybook === playbook.id}
                    onClick={() =>
                      setSelectedPlaybook(
                        selectedPlaybook === playbook.id ? null : playbook.id
                      )
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Advanced Options (collapsed) */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-[11px] font-medium transition-colors duration-100"
              style={{ color: colors.textTertiary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = colors.textSecondary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = colors.textTertiary)}
            >
              {showAdvanced ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              Advanced Options
            </button>
            {showAdvanced && (
              <div
                className="mt-3 p-4 rounded-md space-y-4"
                style={{
                  background: colors.bgSurface,
                  border: `1px solid ${colors.borderSubtle}`,
                }}
              >
                {/* Output Format */}
                <div className="space-y-2">
                  <label
                    className="text-[11px] font-medium uppercase tracking-wide"
                    style={{ color: colors.textQuaternary }}
                  >
                    Output Format
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { id: "recommendation", label: "Recommendation" },
                      { id: "report", label: "Full Report" },
                      { id: "chart", label: "Visualization" },
                    ].map((format) => (
                      <button
                        key={format.id}
                        className="px-2.5 py-1 rounded text-[12px] transition-all duration-100"
                        style={{
                          background: colors.bgHover,
                          border: `1px solid ${colors.borderDefault}`,
                          color: colors.textSecondary,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = colors.borderHover;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = colors.borderDefault;
                        }}
                      >
                        {format.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Horizon */}
                <div className="space-y-2">
                  <label
                    className="text-[11px] font-medium uppercase tracking-wide"
                    style={{ color: colors.textQuaternary }}
                  >
                    Time Horizon
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {["1 month", "3 months", "1 year", "3 years", "5+ years"].map((horizon) => (
                      <button
                        key={horizon}
                        className="px-2.5 py-1 rounded text-[12px] transition-all duration-100"
                        style={{
                          background: colors.bgHover,
                          border: `1px solid ${colors.borderDefault}`,
                          color: colors.textSecondary,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = colors.borderHover;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = colors.borderDefault;
                        }}
                      >
                        {horizon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Constraints hint */}
                <div className="text-[11px]" style={{ color: colors.textQuaternary }}>
                  Additional constraints, data sources, and stakeholders can be configured in the workflow editor.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer - design.md: modal padding = 16px (space-4) */}
        <div
          className="flex items-center justify-between px-4 py-4"
          style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
        >
          <div className="text-[11px]" style={{ color: colors.textQuaternary }}>
            <kbd
              className="px-1.5 py-0.5 rounded"
              style={{ background: colors.bgHover, fontFamily: "monospace" }}
            >
              ⌘
            </kbd>
            <span className="mx-1">+</span>
            <kbd
              className="px-1.5 py-0.5 rounded"
              style={{ background: colors.bgHover, fontFamily: "monospace" }}
            >
              Enter
            </kbd>
            <span className="ml-2">to create</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-[13px] font-medium transition-colors duration-100"
              style={{
                color: colors.textSecondary,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.bgHover;
                e.currentTarget.style.color = colors.textPrimary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = colors.textSecondary;
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!canCreate || creating}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-[13px] font-medium transition-all duration-100"
              style={{
                background: canCreate ? colors.accent : colors.bgHover,
                color: canCreate ? colors.bgBase : colors.textQuaternary,
                opacity: creating ? 0.7 : 1,
                cursor: canCreate && !creating ? "pointer" : "not-allowed",
              }}
              onMouseEnter={(e) => {
                if (canCreate && !creating) {
                  e.currentTarget.style.background = colors.accentHover;
                }
              }}
              onMouseLeave={(e) => {
                if (canCreate && !creating) {
                  e.currentTarget.style.background = colors.accent;
                }
              }}
            >
              {creating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  Create
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Playbook suggestion component
function PlaybookSuggestion({
  playbook,
  isSelected,
  onClick,
}: {
  playbook: Playbook;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-md text-left transition-all duration-100"
      style={{
        background: isSelected ? colors.bgActive : colors.bgSurface,
        border: `1px solid ${isSelected ? colors.borderHover : colors.borderSubtle}`,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = colors.bgHover;
          e.currentTarget.style.borderColor = colors.borderDefault;
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = colors.bgSurface;
          e.currentTarget.style.borderColor = colors.borderSubtle;
        }
      }}
    >
      <div
        className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
        style={{
          background: `${playbook.color}15`,
          border: `1px solid ${playbook.color}30`,
        }}
      >
        <Target className="w-4 h-4" style={{ color: playbook.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium" style={{ color: colors.textPrimary }}>
          {playbook.name}
        </div>
        <div
          className="text-[11px] truncate"
          style={{ color: colors.textTertiary }}
        >
          {playbook.description}
        </div>
      </div>
      {isSelected && (
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: colors.accent }}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke={colors.bgBase}
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}

// Helper to generate a name from question
function generateNameFromQuestion(question: string): string {
  // Remove common question words and clean up
  const cleaned = question
    .replace(/^(should we|can we|what if|how do we|would it be|is it)\s+/i, "")
    .replace(/\?+$/, "")
    .trim();

  // Capitalize first letter and truncate if needed
  const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // Truncate to reasonable length
  if (capitalized.length > 50) {
    const truncated = capitalized.slice(0, 47);
    const lastSpace = truncated.lastIndexOf(" ");
    return lastSpace > 30 ? truncated.slice(0, lastSpace) + "..." : truncated + "...";
  }

  return capitalized;
}
