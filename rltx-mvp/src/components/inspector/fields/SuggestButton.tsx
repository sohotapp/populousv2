"use client";

import { useState, useCallback } from "react";
import { Sparkles, Check, X, Loader2 } from "lucide-react";

interface SuggestButtonProps {
  primitiveId: string;
  fieldKey: string;
  currentConfig: Record<string, unknown>;
  workflowContext?: {
    question?: string;
    domain?: string;
    attachedData?: {
      schema: { fields: Array<{ name: string; type: string }> };
      sampleRows: unknown[];
      filename?: string;
    };
  };
  onApply: (value: unknown) => void;
}

interface SuggestionResult {
  suggestion: unknown;
  reasoning: string;
  alternatives?: unknown[];
  confidence: number;
}

export function SuggestButton({
  primitiveId,
  fieldKey,
  currentConfig,
  workflowContext = {},
  onApply,
}: SuggestButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSuggest = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuggestion(null);

    try {
      const response = await fetch("/api/config/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primitiveId,
          fieldKey,
          currentConfig,
          workflowContext,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get suggestion");
      }

      const result: SuggestionResult = await response.json();
      setSuggestion(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suggestion failed");
    } finally {
      setIsLoading(false);
    }
  }, [primitiveId, fieldKey, currentConfig, workflowContext]);

  const handleApply = useCallback(() => {
    if (suggestion) {
      onApply(suggestion.suggestion);
      setSuggestion(null);
    }
  }, [suggestion, onApply]);

  const handleDismiss = useCallback(() => {
    setSuggestion(null);
    setError(null);
  }, []);

  // Show loading spinner
  if (isLoading) {
    return (
      <div
        className="p-1 rounded"
        style={{ color: "hsl(230, 60%, 60%)" }}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      </div>
    );
  }

  // Show suggestion result
  if (suggestion) {
    return (
      <div className="relative">
        <div
          className="absolute right-0 top-6 z-50 w-64 rounded-md shadow-lg"
          style={{
            background: "hsl(0, 0%, 12%)",
            border: "1px solid hsl(0, 0%, 18%)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: "1px solid hsl(0, 0%, 15%)" }}
          >
            <span
              className="text-xs font-medium flex items-center gap-1.5"
              style={{ color: "hsl(230, 60%, 60%)" }}
            >
              <Sparkles className="w-3 h-3" />
              AI Suggestion
            </span>
            <button
              onClick={handleDismiss}
              className="p-0.5 rounded transition-colors hover:bg-[hsl(0,0%,15%)]"
              style={{ color: "hsl(0, 0%, 45%)" }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3 space-y-2">
            {/* Suggestion value */}
            <div
              className="p-2 rounded text-xs"
              style={{
                background: "hsl(0, 0%, 8%)",
                color: "hsl(0, 0%, 93%)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {typeof suggestion.suggestion === "object"
                ? JSON.stringify(suggestion.suggestion, null, 2)
                : String(suggestion.suggestion)}
            </div>

            {/* Reasoning */}
            <p
              className="text-xs leading-relaxed"
              style={{ color: "hsl(0, 0%, 60%)" }}
            >
              {suggestion.reasoning}
            </p>

            {/* Confidence */}
            <div className="flex items-center gap-2">
              <div
                className="flex-1 h-1 rounded-full overflow-hidden"
                style={{ background: "hsl(0, 0%, 15%)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${suggestion.confidence * 100}%`,
                    background:
                      suggestion.confidence > 0.7
                        ? "hsl(142, 70%, 45%)"
                        : suggestion.confidence > 0.4
                        ? "hsl(45, 80%, 50%)"
                        : "hsl(0, 70%, 50%)",
                  }}
                />
              </div>
              <span
                className="text-xs"
                style={{ color: "hsl(0, 0%, 45%)" }}
              >
                {Math.round(suggestion.confidence * 100)}%
              </span>
            </div>

            {/* Alternatives */}
            {suggestion.alternatives && suggestion.alternatives.length > 0 && (
              <div className="pt-2" style={{ borderTop: "1px solid hsl(0, 0%, 15%)" }}>
                <p
                  className="text-xs mb-1"
                  style={{ color: "hsl(0, 0%, 45%)" }}
                >
                  Alternatives:
                </p>
                <div className="flex flex-wrap gap-1">
                  {suggestion.alternatives.map((alt, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        onApply(alt);
                        setSuggestion(null);
                      }}
                      className="px-2 py-0.5 rounded text-xs transition-colors hover:bg-[hsl(0,0%,15%)]"
                      style={{
                        background: "hsl(0, 0%, 10%)",
                        color: "hsl(0, 0%, 70%)",
                      }}
                    >
                      {typeof alt === "object" ? JSON.stringify(alt) : String(alt)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex justify-end gap-2 px-3 py-2"
            style={{ borderTop: "1px solid hsl(0, 0%, 15%)" }}
          >
            <button
              onClick={handleDismiss}
              className="px-2 py-1 text-xs rounded transition-colors"
              style={{ color: "hsl(0, 0%, 50%)" }}
            >
              Dismiss
            </button>
            <button
              onClick={handleApply}
              className="px-2 py-1 text-xs rounded font-medium flex items-center gap-1 transition-colors"
              style={{
                background: "hsl(0, 0%, 93%)",
                color: "hsl(0, 0%, 7%)",
              }}
            >
              <Check className="w-3 h-3" />
              Apply
            </button>
          </div>
        </div>

        {/* Trigger button (dimmed when showing popup) */}
        <button
          onClick={handleSuggest}
          className="p-1 rounded transition-colors"
          style={{ color: "hsl(230, 60%, 60%)" }}
          title="AI Suggestion"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Show error
  if (error) {
    return (
      <div className="relative">
        <button
          onClick={handleDismiss}
          className="p-1 rounded transition-colors"
          style={{ color: "hsl(0, 70%, 55%)" }}
          title={error}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Default state - show suggest button
  return (
    <button
      onClick={handleSuggest}
      className="p-1 rounded transition-all hover:bg-[hsl(0,0%,12%)]"
      style={{ color: "hsl(0, 0%, 35%)" }}
      title="Suggest with AI"
    >
      <Sparkles className="w-3.5 h-3.5" />
    </button>
  );
}
