"use client";

import { useState, useMemo } from "react";
import { Search, Database, ChevronRight, Building2, Users, Calculator, Headphones, UserSearch } from "lucide-react";
import {
  MERGE_INTEGRATIONS,
  CATEGORY_LABELS,
  type MergeCategory,
  type MergeIntegration,
} from "@/lib/merge/client";

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

// Category icons
const categoryIcons: Record<MergeCategory, typeof Database> = {
  crm: Building2,
  hris: Users,
  accounting: Calculator,
  ticketing: Headphones,
  ats: UserSearch,
};

// Simple Icons CDN for brand logos
function IntegrationLogo({ integration, className }: { integration: MergeIntegration; className?: string }) {
  const [error, setError] = useState(false);

  if (error) {
    const Icon = categoryIcons[integration.category] || Database;
    return <Icon className={className} style={{ color: colors.iconTertiary }} />;
  }

  return (
    <img
      src={`https://cdn.simpleicons.org/${integration.logo}/ededed`}
      alt={integration.name}
      className={className}
      onError={() => setError(true)}
    />
  );
}

interface IntegrationBrowserProps {
  onSelect: (integration: MergeIntegration) => void;
  selectedId?: string;
  allowedCategories?: MergeCategory[];
}

export function IntegrationBrowser({
  onSelect,
  selectedId,
  allowedCategories,
}: IntegrationBrowserProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<MergeCategory | null>(null);

  // Get categories to show
  const categories = useMemo(() => {
    const cats = allowedCategories || (Object.keys(MERGE_INTEGRATIONS) as MergeCategory[]);
    return cats.map((cat) => ({
      id: cat,
      label: CATEGORY_LABELS[cat],
      count: MERGE_INTEGRATIONS[cat].length,
      icon: categoryIcons[cat],
    }));
  }, [allowedCategories]);

  // Get all integrations flat
  const allIntegrations = useMemo(() => {
    const cats = allowedCategories || (Object.keys(MERGE_INTEGRATIONS) as MergeCategory[]);
    return cats.flatMap((cat) => MERGE_INTEGRATIONS[cat]);
  }, [allowedCategories]);

  // Filter integrations
  const filteredIntegrations = useMemo(() => {
    let integrations = allIntegrations;

    if (activeCategory) {
      integrations = integrations.filter((i) => i.category === activeCategory);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      integrations = integrations.filter(
        (i) =>
          i.name.toLowerCase().includes(searchLower) ||
          i.category.toLowerCase().includes(searchLower)
      );
    }

    return integrations;
  }, [allIntegrations, search, activeCategory]);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
        <div
          className="flex items-center gap-2 px-2 py-1.5 rounded"
          style={{ background: colors.bgSurface }}
        >
          <Search className="w-3 h-3" style={{ color: colors.iconTertiary }} />
          <input
            type="text"
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[12px]"
            style={{ color: colors.textPrimary }}
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 mt-3 overflow-x-auto">
          <button
            onClick={() => setActiveCategory(null)}
            className="px-2 py-1 rounded text-[11px] transition-colors whitespace-nowrap"
            style={{
              background: activeCategory === null ? colors.bgHover : "transparent",
              color: activeCategory === null ? colors.textSecondary : colors.textQuaternary,
            }}
          >
            All ({allIntegrations.length})
          </button>
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors whitespace-nowrap"
                style={{
                  background: activeCategory === cat.id ? colors.bgHover : "transparent",
                  color: activeCategory === cat.id ? colors.textSecondary : colors.textQuaternary,
                }}
              >
                <Icon className="w-3 h-3" />
                {cat.label} ({cat.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Integration list */}
      <div className="flex-1 overflow-y-auto py-1">
        {filteredIntegrations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Database className="w-5 h-5 mb-3" style={{ color: colors.iconEmpty }} />
            <p className="text-[12px]" style={{ color: colors.textQuaternary }}>
              No integrations found
            </p>
          </div>
        ) : (
          filteredIntegrations.map((integration) => {
            const isSelected = selectedId === integration.id;

            return (
              <button
                key={integration.id}
                onClick={() => onSelect(integration)}
                className="group flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors"
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
                {/* Logo */}
                <IntegrationLogo integration={integration} className="w-5 h-5 flex-shrink-0" />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium" style={{ color: colors.textPrimary }}>
                      {integration.name}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        background: colors.bgSurface,
                        color: colors.textTertiary,
                      }}
                    >
                      {CATEGORY_LABELS[integration.category]}
                    </span>
                  </div>
                </div>

                {/* Arrow on hover */}
                <ChevronRight
                  className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  style={{ color: colors.iconSecondary }}
                />
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-3 text-center"
        style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
      >
        <p className="text-[11px]" style={{ color: colors.textQuaternary }}>
          Powered by Merge.dev • Unified API
        </p>
      </div>
    </div>
  );
}
