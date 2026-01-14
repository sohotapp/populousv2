"use client";

import { useState, useMemo } from "react";
import { Search, Database, ChevronRight } from "lucide-react";
import { CONNECTOR_CATALOG, getConnectorCategories, type ConnectorDefinition } from "@/stores/sources";
import { ConnectorLogo } from "../icons/ConnectorLogos";

// Design tokens - Linear grayscale only
const colors = {
  bgBase: "hsl(0, 0%, 7%)",
  bgSurface: "hsl(0, 0%, 10%)",
  bgHover: "hsl(0, 0%, 12%)",
  bgActive: "hsl(0, 0%, 14%)",
  borderSubtle: "hsl(0, 0%, 12%)",
  borderDefault: "hsl(0, 0%, 15%)",
  textPrimary: "hsl(0, 0%, 93%)",
  textSecondary: "hsl(0, 0%, 70%)",
  textTertiary: "hsl(0, 0%, 50%)",
  textQuaternary: "hsl(0, 0%, 35%)",
  iconSecondary: "hsl(0, 0%, 45%)",
  iconTertiary: "hsl(0, 0%, 30%)",
  iconEmpty: "hsl(0, 0%, 20%)",
};

interface ConnectorBrowserProps {
  onSelect: (connector: ConnectorDefinition) => void;
  selectedId?: string;
}

export function ConnectorBrowser({ onSelect, selectedId }: ConnectorBrowserProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => getConnectorCategories(), []);

  const filteredConnectors = useMemo(() => {
    let connectors = CONNECTOR_CATALOG;

    if (activeCategory) {
      connectors = connectors.filter((c) => c.category === activeCategory);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      connectors = connectors.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.description.toLowerCase().includes(searchLower)
      );
    }

    return connectors.sort((a, b) => b.popularity - a.popularity);
  }, [search, activeCategory]);

  return (
    <div className="flex flex-col h-full">
      {/* Search - matches DataPanel style */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
        <div
          className="flex items-center gap-2 px-2 py-1.5 rounded"
          style={{ background: colors.bgSurface }}
        >
          <Search className="w-3 h-3" style={{ color: colors.iconTertiary }} />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[12px]"
            style={{ color: colors.textPrimary }}
          />
        </div>

        {/* Category tabs - minimal */}
        <div className="flex gap-1 mt-3 overflow-x-auto">
          <button
            onClick={() => setActiveCategory(null)}
            className="px-2 py-1 rounded text-[11px] transition-colors whitespace-nowrap"
            style={{
              background: activeCategory === null ? colors.bgHover : "transparent",
              color: activeCategory === null ? colors.textSecondary : colors.textQuaternary,
            }}
          >
            All ({CONNECTOR_CATALOG.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="px-2 py-1 rounded text-[11px] transition-colors whitespace-nowrap"
              style={{
                background: activeCategory === cat.id ? colors.bgHover : "transparent",
                color: activeCategory === cat.id ? colors.textSecondary : colors.textQuaternary,
              }}
            >
              {cat.label} ({cat.count})
            </button>
          ))}
        </div>
      </div>

      {/* Connector list - flat Linear style */}
      <div className="flex-1 overflow-y-auto py-1">
        {filteredConnectors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Database className="w-5 h-5 mb-3" style={{ color: colors.iconEmpty }} />
            <p className="text-[12px]" style={{ color: colors.textQuaternary }}>
              No connectors found
            </p>
          </div>
        ) : (
          filteredConnectors.map((connector) => {
            const isSelected = selectedId === connector.id;

            return (
              <button
                key={connector.id}
                onClick={() => onSelect(connector)}
                className="group flex items-center gap-3 w-full px-4 py-2 text-left transition-colors"
                style={{
                  background: isSelected ? colors.bgHover : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = colors.bgHover;
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                {/* Logo - no background box */}
                <ConnectorLogo connectorId={connector.id} className="w-4 h-4 flex-shrink-0" />

                {/* Info - single line */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-[12px] truncate" style={{ color: colors.textPrimary }}>
                    {connector.name}
                  </span>
                  <span className="text-[11px] truncate" style={{ color: colors.textQuaternary }}>
                    {connector.description}
                  </span>
                </div>

                {/* Arrow on hover */}
                <ChevronRight
                  className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  style={{ color: colors.iconSecondary }}
                />
              </button>
            );
          })
        )}

        {/* Footer note */}
        {!search && !activeCategory && (
          <p className="text-center text-[11px] py-4" style={{ color: colors.textQuaternary }}>
            400+ connectors via Airbyte
          </p>
        )}
      </div>
    </div>
  );
}
