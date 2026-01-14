"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Zap, Clock, DollarSign } from "lucide-react";
import { getPresetsForPrimitive, type Preset } from "@/lib/primitives/presets";

interface PresetSelectorProps {
  primitiveId: string;
  onApplyPreset: (config: Record<string, unknown>) => void;
}

export function PresetSelector({ primitiveId, onApplyPreset }: PresetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadedPresets = getPresetsForPrimitive(primitiveId);
    setPresets(loadedPresets);
  }, [primitiveId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (presets.length === 0) {
    return null;
  }

  const handleSelect = (preset: Preset) => {
    onApplyPreset(preset.config);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all"
        style={{
          background: "hsl(0, 0%, 10%)",
          color: "hsl(0, 0%, 70%)",
          border: "1px solid hsl(0, 0%, 15%)",
        }}
      >
        <Zap className="w-3 h-3" style={{ color: "hsl(45, 80%, 50%)" }} />
        <span>Presets</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-8 z-50 w-72 rounded-md shadow-lg overflow-hidden"
          style={{
            background: "hsl(0, 0%, 10%)",
            border: "1px solid hsl(0, 0%, 15%)",
          }}
        >
          <div
            className="px-3 py-2"
            style={{ borderBottom: "1px solid hsl(0, 0%, 12%)" }}
          >
            <p
              className="text-xs font-medium"
              style={{ color: "hsl(0, 0%, 50%)" }}
            >
              Quick Configuration Presets
            </p>
          </div>

          <div className="max-h-64 overflow-auto">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleSelect(preset)}
                className="w-full text-left px-3 py-2.5 transition-colors hover:bg-[hsl(0,0%,12%)]"
                style={{ borderBottom: "1px solid hsl(0, 0%, 10%)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-medium truncate"
                      style={{ color: "hsl(0, 0%, 93%)" }}
                    >
                      {preset.name}
                    </p>
                    <p
                      className="text-xs mt-0.5 line-clamp-2"
                      style={{ color: "hsl(0, 0%, 50%)" }}
                    >
                      {preset.description}
                    </p>
                  </div>
                </div>

                {/* Tags and estimates */}
                <div className="flex items-center gap-3 mt-2">
                  {preset.estimatedCost && (
                    <span
                      className="flex items-center gap-1 text-xs"
                      style={{ color: "hsl(142, 60%, 50%)" }}
                    >
                      <DollarSign className="w-3 h-3" />
                      {preset.estimatedCost}
                    </span>
                  )}
                  {preset.estimatedTime && (
                    <span
                      className="flex items-center gap-1 text-xs"
                      style={{ color: "hsl(200, 60%, 50%)" }}
                    >
                      <Clock className="w-3 h-3" />
                      {preset.estimatedTime}
                    </span>
                  )}
                </div>

                {/* Tags */}
                {preset.tags && preset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {preset.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 rounded text-xs"
                        style={{
                          background: "hsl(0, 0%, 8%)",
                          color: "hsl(0, 0%, 45%)",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
