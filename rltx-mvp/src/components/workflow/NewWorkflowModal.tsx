"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronDown, Check, Loader2, ArrowRight } from "lucide-react";
import { playbookPatterns, type PatternType } from "@/lib/primitives/presets";

// =============================================================================
// DESIGN.MD VERBATIM - Exact values, no deviations
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
  borderFocus: "hsl(0, 0%, 25%)",
  textPrimary: "hsl(0, 0%, 93%)",
  textSecondary: "hsl(0, 0%, 70%)",
  textTertiary: "hsl(0, 0%, 50%)",
  textQuaternary: "hsl(0, 0%, 35%)",
  iconSecondary: "hsl(0, 0%, 45%)",
  iconTertiary: "hsl(0, 0%, 30%)",
};

// =============================================================================
// PATTERN CONFIGURATION - Minimal, focused
// =============================================================================

const PATTERNS: { id: PatternType; name: string; hint: string }[] = [
  { id: "consumer_survey", name: "Consumer Survey", hint: "Would customers..." },
  { id: "change_impact", name: "Change Impact", hint: "What if we..." },
  { id: "competitive_response", name: "Competitive Response", hint: "How would competitors..." },
  { id: "counterfactual", name: "Counterfactual", hint: "Compare options..." },
  { id: "wargame", name: "Strategic Wargame", hint: "Adversarial dynamics..." },
  { id: "dynamics", name: "Opinion Dynamics", hint: "How ideas spread..." },
];

// Simple pattern detection - no visual feedback, just auto-select
function detectPattern(text: string): PatternType {
  const lower = text.toLowerCase();
  if (lower.includes("competitor") || lower.includes("rival")) return "competitive_response";
  if (lower.includes("what if") || lower.includes("increase") || lower.includes("decrease")) return "change_impact";
  if (lower.includes("compare") || lower.includes("versus") || lower.includes(" vs ")) return "counterfactual";
  if (lower.includes("spread") || lower.includes("viral") || lower.includes("adoption")) return "dynamics";
  if (lower.includes("adversary") || lower.includes("conflict") || lower.includes("military")) return "wargame";
  return "consumer_survey";
}

// =============================================================================
// TYPES
// =============================================================================

interface NewWorkflowModalProps {
  onClose: () => void;
  onCreate: (config: {
    name: string;
    question: string;
    pattern: PatternType;
    analysisDepth: "quick" | "standard" | "simulation";
  }) => void;
  creating?: boolean;
}

// =============================================================================
// COMPONENT - Linear style: minimal chrome, typography-driven
// =============================================================================

export function NewWorkflowModal({ onClose, onCreate, creating = false }: NewWorkflowModalProps) {
  const [question, setQuestion] = useState("");
  const [selectedPattern, setSelectedPattern] = useState<PatternType>("consumer_survey");
  const [showPatternMenu, setShowPatternMenu] = useState(false);
  const [hasManuallySelectedPattern, setHasManuallySelectedPattern] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-detect pattern (silent, no UI feedback)
  useEffect(() => {
    if (!hasManuallySelectedPattern && question.length > 15) {
      const detected = detectPattern(question);
      setSelectedPattern(detected);
    }
  }, [question, hasManuallySelectedPattern]);

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowPatternMenu(false);
      }
    };
    if (showPatternMenu) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showPatternMenu]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showPatternMenu) {
          setShowPatternMenu(false);
        } else {
          onClose();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && question.trim()) {
        handleCreate();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [question, selectedPattern, showPatternMenu, onClose]);

  const handleCreate = useCallback(() => {
    if (!question.trim()) return;
    // Generate name from question
    const name = question
      .replace(/^(should we|can we|what if|how do we|would it be|is it|would customers|would users)\s+/i, "")
      .replace(/\?+$/, "")
      .trim()
      .slice(0, 50);
    const capitalized = name.charAt(0).toUpperCase() + name.slice(1);

    onCreate({
      name: capitalized || question.slice(0, 50),
      question: question.trim(),
      pattern: selectedPattern,
      analysisDepth: "standard",
    });
  }, [question, selectedPattern, onCreate]);

  const handlePatternSelect = (pattern: PatternType) => {
    setSelectedPattern(pattern);
    setHasManuallySelectedPattern(true);
    setShowPatternMenu(false);
  };

  const currentPattern = PATTERNS.find((p) => p.id === selectedPattern)!;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "rgba(0, 0, 0, 0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg"
        style={{
          background: colors.bgElevated,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: "8px",
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.6)",
          animation: "slideUp 150ms ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - minimal */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
        >
          <h2 className="text-[15px] font-semibold" style={{ color: colors.textPrimary }}>
            New workflow
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded transition-colors"
            style={{ color: colors.iconSecondary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.bgHover;
              e.currentTarget.style.color = colors.textSecondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = colors.iconSecondary;
            }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Content - focused on the question */}
        <div className="p-4">
          {/* Question textarea - the main focus */}
          <textarea
            ref={textareaRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What decision do you want to simulate?"
            rows={4}
            className="w-full resize-none outline-none"
            style={{
              background: colors.bgSurface,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: "6px",
              padding: "12px",
              fontSize: "13px",
              lineHeight: "1.5",
              color: colors.textPrimary,
              transition: "border-color 100ms",
            }}
            onFocus={(e) => (e.target.style.borderColor = colors.borderFocus)}
            onBlur={(e) => (e.target.style.borderColor = colors.borderDefault)}
          />

          {/* Pattern selector - subtle, inline */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px]" style={{ color: colors.textQuaternary }}>
              Pattern
            </span>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowPatternMenu(!showPatternMenu)}
                className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors"
                style={{
                  background: showPatternMenu ? colors.bgHover : "transparent",
                  color: colors.textSecondary,
                }}
                onMouseEnter={(e) => {
                  if (!showPatternMenu) e.currentTarget.style.background = colors.bgHover;
                }}
                onMouseLeave={(e) => {
                  if (!showPatternMenu) e.currentTarget.style.background = "transparent";
                }}
              >
                <span className="text-[12px]">{currentPattern.name}</span>
                <ChevronDown size={12} strokeWidth={1.5} style={{ color: colors.iconTertiary }} />
              </button>

              {/* Dropdown menu */}
              {showPatternMenu && (
                <div
                  className="absolute left-0 top-full mt-1 py-1 min-w-[200px] z-10"
                  style={{
                    background: colors.bgSurface,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: "6px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
                  }}
                >
                  {PATTERNS.map((pattern) => (
                    <button
                      key={pattern.id}
                      onClick={() => handlePatternSelect(pattern.id)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors"
                      style={{
                        background: selectedPattern === pattern.id ? colors.bgHover : "transparent",
                        color: selectedPattern === pattern.id ? colors.textPrimary : colors.textSecondary,
                      }}
                      onMouseEnter={(e) => {
                        if (selectedPattern !== pattern.id) {
                          e.currentTarget.style.background = colors.bgHover;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedPattern !== pattern.id) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      <div>
                        <div className="text-[12px]">{pattern.name}</div>
                        <div className="text-[11px]" style={{ color: colors.textQuaternary }}>
                          {pattern.hint}
                        </div>
                      </div>
                      {selectedPattern === pattern.id && (
                        <Check size={14} strokeWidth={1.5} style={{ color: colors.textTertiary }} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer - clean, action-focused */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
        >
          <div className="text-[11px]" style={{ color: colors.textQuaternary }}>
            <kbd
              className="px-1.5 py-0.5 rounded text-[10px]"
              style={{ background: colors.bgHover, fontFamily: "monospace" }}
            >
              ⌘↵
            </kbd>
            <span className="ml-2">to create</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-[13px] font-medium transition-colors"
              style={{ color: colors.textTertiary }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.bgHover;
                e.currentTarget.style.color = colors.textSecondary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = colors.textTertiary;
              }}
            >
              Cancel
            </button>

            <button
              onClick={handleCreate}
              disabled={!question.trim() || creating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[13px] font-medium transition-all"
              style={{
                background: question.trim() && !creating ? colors.textPrimary : colors.bgHover,
                color: question.trim() && !creating ? colors.bgBase : colors.textQuaternary,
                cursor: question.trim() && !creating ? "pointer" : "not-allowed",
              }}
              onMouseEnter={(e) => {
                if (question.trim() && !creating) {
                  e.currentTarget.style.background = "hsl(0, 0%, 100%)";
                }
              }}
              onMouseLeave={(e) => {
                if (question.trim() && !creating) {
                  e.currentTarget.style.background = colors.textPrimary;
                }
              }}
            >
              {creating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <>
                  Create
                  <ArrowRight size={14} strokeWidth={1.5} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
