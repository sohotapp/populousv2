"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";

interface JsonEditorProps {
  value: unknown;
  onChange: (value: unknown) => void;
  placeholder?: string;
  maxHeight?: number;
  label?: string;
}

export function JsonEditor({
  value,
  onChange,
  placeholder = "Enter JSON...",
  maxHeight = 200,
  label,
}: JsonEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const stringValue = value ? JSON.stringify(value, null, 2) : "";

  const handleEdit = useCallback(() => {
    setEditValue(stringValue);
    setIsEditing(true);
    setError(null);
  }, [stringValue]);

  const handleSave = useCallback(() => {
    try {
      const parsed = JSON.parse(editValue);
      onChange(parsed);
      setIsEditing(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }, [editValue, onChange]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditValue("");
    setError(null);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(stringValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [stringValue]);

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center justify-between">
          <label
            className="text-xs font-medium"
            style={{ color: "hsl(0, 0%, 50%)" }}
          >
            {label}
          </label>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="p-1 rounded transition-colors"
              style={{ color: "hsl(0, 0%, 45%)" }}
              title="Copy JSON"
            >
              {copied ? (
                <Check className="w-3 h-3" style={{ color: "hsl(142, 70%, 45%)" }} />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded transition-colors"
              style={{ color: "hsl(0, 0%, 45%)" }}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      )}

      {isExpanded && (
        <div
          className="rounded-md overflow-hidden"
          style={{
            background: "hsl(0, 0%, 8%)",
            border: `1px solid ${error ? "hsl(0, 70%, 45%)" : "hsl(0, 0%, 12%)"}`,
          }}
        >
          {isEditing ? (
            <div>
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full p-2 text-xs resize-none focus:outline-none"
                style={{
                  background: "transparent",
                  color: "hsl(0, 0%, 70%)",
                  fontFamily: "var(--font-mono)",
                  maxHeight: `${maxHeight}px`,
                  minHeight: "80px",
                }}
                placeholder={placeholder}
                spellCheck={false}
              />
              {error && (
                <div
                  className="px-2 py-1 text-xs"
                  style={{ color: "hsl(0, 70%, 55%)", background: "hsla(0, 70%, 45%, 0.1)" }}
                >
                  {error}
                </div>
              )}
              <div
                className="flex justify-end gap-2 p-2"
                style={{ borderTop: "1px solid hsl(0, 0%, 12%)" }}
              >
                <button
                  onClick={handleCancel}
                  className="px-2 py-1 text-xs rounded transition-colors"
                  style={{ color: "hsl(0, 0%, 50%)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-2 py-1 text-xs rounded transition-colors"
                  style={{
                    background: "hsl(0, 0%, 93%)",
                    color: "hsl(0, 0%, 7%)",
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div
              className="p-2 cursor-pointer hover:bg-[hsl(0,0%,10%)] transition-colors"
              onClick={handleEdit}
              style={{ maxHeight: `${maxHeight}px`, overflow: "auto" }}
            >
              {stringValue ? (
                <pre
                  className="text-xs whitespace-pre-wrap"
                  style={{
                    color: "hsl(0, 0%, 70%)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {stringValue}
                </pre>
              ) : (
                <span
                  className="text-xs"
                  style={{ color: "hsl(0, 0%, 35%)" }}
                >
                  {placeholder}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
