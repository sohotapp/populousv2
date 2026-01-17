"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { X, Search, ChevronRight, Loader2, Check, ExternalLink } from "lucide-react";
import { useMergeLink } from "@mergeapi/react-merge-link";
import type { MergeCategory, MergeIntegration } from "@/lib/merge/client";
import { MERGE_INTEGRATIONS } from "@/lib/merge/client";
import { CONNECTOR_CATALOG, type ConnectorDefinition } from "@/stores/sources";

// =============================================================================
// DESIGN TOKENS - DESIGN.md VERBATIM
// =============================================================================

const colors = {
  // Backgrounds
  bgBase: "hsl(0, 0%, 7%)",
  bgElevated: "hsl(0, 0%, 9%)",
  bgSurface: "hsl(0, 0%, 10%)",
  bgHover: "hsl(0, 0%, 12%)",
  bgActive: "hsl(0, 0%, 14%)",
  // Borders
  borderSubtle: "hsl(0, 0%, 12%)",
  borderDefault: "hsl(0, 0%, 15%)",
  borderHover: "hsl(0, 0%, 20%)",
  // Text
  textPrimary: "hsl(0, 0%, 93%)",
  textSecondary: "hsl(0, 0%, 70%)",
  textTertiary: "hsl(0, 0%, 50%)",
  textQuaternary: "hsl(0, 0%, 35%)",
  // Icons
  iconSecondary: "hsl(0, 0%, 45%)",
  iconTertiary: "hsl(0, 0%, 30%)",
  // Status
  statusSuccess: "hsl(142, 70%, 45%)",
};

// =============================================================================
// UNIFIED CONNECTOR TYPE
// =============================================================================

interface UnifiedConnector {
  id: string;
  name: string;
  description: string;
  category: string;
  type: "merge" | "database";
  // Merge-specific
  mergeSlug?: string;
  mergeCategory?: MergeCategory;
  // Database-specific
  connector?: ConnectorDefinition;
}

// Build unified connector list
function buildUnifiedConnectors(): UnifiedConnector[] {
  const connectors: UnifiedConnector[] = [];

  // Add Merge CRM connectors
  const crmIntegrations = MERGE_INTEGRATIONS.crm || [];
  for (const integration of crmIntegrations) {
    connectors.push({
      id: `merge-${integration.slug}`,
      name: integration.name,
      description: "CRM",
      category: "CRM",
      type: "merge",
      mergeSlug: integration.slug,
      mergeCategory: "crm",
    });
  }

  // Add Merge HRIS connectors
  const hrisIntegrations = MERGE_INTEGRATIONS.hris || [];
  for (const integration of hrisIntegrations) {
    connectors.push({
      id: `merge-${integration.slug}`,
      name: integration.name,
      description: "HRIS",
      category: "HRIS",
      type: "merge",
      mergeSlug: integration.slug,
      mergeCategory: "hris",
    });
  }

  // Add database connectors from catalog
  for (const connector of CONNECTOR_CATALOG) {
    connectors.push({
      id: connector.id,
      name: connector.name,
      description: connector.description,
      category: getCategoryLabel(connector.category),
      type: "database",
      connector,
    });
  }

  return connectors;
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    database: "Database",
    warehouse: "Data Warehouse",
    files: "Files",
    marketing: "Marketing",
    analytics: "Analytics",
    api: "API",
    other: "Other",
  };
  return labels[category] || category;
}

// Simple Icons CDN for real logos
function getLogoUrl(id: string): string {
  const slugMap: Record<string, string> = {
    // CRM
    salesforce: "salesforce",
    hubspot: "hubspot",
    pipedrive: "pipedrive",
    close: "close",
    copper: "copper",
    freshsales: "freshworks",
    "zoho-crm": "zoho",
    "dynamics-365": "dynamics365",
    // HRIS
    workday: "workday",
    bamboohr: "bamboo",
    gusto: "gusto",
    rippling: "rippling",
    adp: "adp",
    // Databases
    postgres: "postgresql",
    mysql: "mysql",
    mongodb: "mongodb",
    // Warehouses
    snowflake: "snowflake",
    bigquery: "googlebigquery",
    redshift: "amazonaws",
    // Files
    "google-sheets": "googlesheets",
    s3: "amazons3",
    // Marketing
    mailchimp: "mailchimp",
    klaviyo: "klaviyo",
    // Analytics
    mixpanel: "mixpanel",
    amplitude: "amplitude",
    segment: "segment",
    // Other
    zendesk: "zendesk",
    intercom: "intercom",
    stripe: "stripe",
  };

  const slug = slugMap[id] || id;
  return `https://cdn.simpleicons.org/${slug}/b3b3b3`;
}

// =============================================================================
// COMPONENT
// =============================================================================

interface DataSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMergeConnect: (result: {
    linkedAccountId: string;
    integrationSlug: string;
    integrationName: string;
    category: MergeCategory;
    agentCount: number;
  }) => void;
  onDatabaseConnect: (connector: ConnectorDefinition) => void;
}

export function DataSourceModal({
  isOpen,
  onClose,
  onMergeConnect,
  onDatabaseConnect,
}: DataSourceModalProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedMerge, setSelectedMerge] = useState<UnifiedConnector | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "connecting" | "syncing" | "done">("idle");
  const [syncResult, setSyncResult] = useState<{ agentCount: number } | null>(null);

  // Build connector list
  const allConnectors = useMemo(() => buildUnifiedConnectors(), []);

  // Categories for tabs
  const categories = useMemo(() => {
    const cats = new Map<string, number>();
    for (const c of allConnectors) {
      cats.set(c.category, (cats.get(c.category) || 0) + 1);
    }
    return Array.from(cats.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        // Fixed order: CRM, HRIS first, then rest
        const order = ["CRM", "HRIS", "Database", "Data Warehouse", "Files"];
        const aIdx = order.indexOf(a.name);
        const bIdx = order.indexOf(b.name);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [allConnectors]);

  // Filter connectors
  const filteredConnectors = useMemo(() => {
    let result = allConnectors;

    if (activeCategory) {
      result = result.filter((c) => c.category === activeCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
      );
    }

    return result;
  }, [allConnectors, activeCategory, search]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setActiveCategory(null);
      setSelectedMerge(null);
      setLinkToken(null);
      setSyncStatus("idle");
      setSyncResult(null);
    }
  }, [isOpen]);

  // Generate Merge link token
  const generateLinkToken = useCallback(async (connector: UnifiedConnector) => {
    if (!connector.mergeSlug || !connector.mergeCategory) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/merge/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endUserEmailAddress: "user@rltx.com",
          endUserOrganizationName: "RLTX User",
          categories: [connector.mergeCategory],
          integration: connector.mergeSlug,
        }),
      });

      if (!response.ok) throw new Error("Failed to initialize");

      const data = await response.json();
      setLinkToken(data.linkToken);
      return data.linkToken;
    } catch (error) {
      console.error("Link token error:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle OAuth success
  const handleMergeSuccess = useCallback(
    async (publicToken: string) => {
      if (!selectedMerge) return;

      setSyncStatus("connecting");

      try {
        // Exchange token
        const callbackResponse = await fetch("/api/merge/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicToken }),
        });

        if (!callbackResponse.ok) throw new Error("Connection failed");

        const callbackData = await callbackResponse.json();
        const linkedAccountId = callbackData.linkedAccountId;

        setSyncStatus("syncing");

        // Sync data
        const syncResponse = await fetch("/api/merge/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            linkedAccountId,
            dataTypes: selectedMerge.mergeCategory === "hris" ? ["employees"] : ["contacts", "leads"],
          }),
        });

        if (!syncResponse.ok) throw new Error("Sync failed");

        const syncData = await syncResponse.json();
        setSyncResult({ agentCount: syncData.summary.totalAgents });
        setSyncStatus("done");

        // Notify parent
        onMergeConnect({
          linkedAccountId,
          integrationSlug: selectedMerge.mergeSlug!,
          integrationName: selectedMerge.name,
          category: selectedMerge.mergeCategory!,
          agentCount: syncData.summary.totalAgents,
        });
      } catch (error) {
        console.error("Merge flow error:", error);
        setSyncStatus("idle");
        setSelectedMerge(null);
      }
    },
    [selectedMerge, onMergeConnect]
  );

  // Merge Link hook
  const { open: openMergeLink, isReady: isMergeLinkReady } = useMergeLink({
    linkToken: linkToken || "",
    onSuccess: handleMergeSuccess,
    onExit: () => {
      if (syncStatus === "idle") {
        setSelectedMerge(null);
        setLinkToken(null);
      }
    },
  });

  // Handle connector click
  const handleConnectorClick = async (connector: UnifiedConnector) => {
    if (connector.type === "merge") {
      setSelectedMerge(connector);
      const token = await generateLinkToken(connector);
      if (token) {
        setTimeout(() => {
          if (isMergeLinkReady) openMergeLink();
        }, 300);
      }
    } else if (connector.type === "database" && connector.connector) {
      onDatabaseConnect(connector.connector);
    }
  };

  // Handle done
  const handleDone = () => {
    onClose();
  };

  if (!isOpen) return null;

  // Show sync status view
  if (selectedMerge && syncStatus !== "idle") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div
          className="relative w-full max-w-md mx-4 rounded-lg overflow-hidden"
          style={{
            background: colors.bgSurface,
            border: `1px solid ${colors.borderDefault}`,
            boxShadow: "0 16px 48px rgba(0, 0, 0, 0.6)",
          }}
        >
          <div className="p-6 text-center">
            {syncStatus === "connecting" && (
              <>
                <Loader2
                  className="w-8 h-8 animate-spin mx-auto mb-4"
                  style={{ color: colors.iconSecondary }}
                />
                <p className="text-[13px]" style={{ color: colors.textSecondary }}>
                  Connecting to {selectedMerge.name}...
                </p>
              </>
            )}

            {syncStatus === "syncing" && (
              <>
                <Loader2
                  className="w-8 h-8 animate-spin mx-auto mb-4"
                  style={{ color: colors.iconSecondary }}
                />
                <p className="text-[13px]" style={{ color: colors.textSecondary }}>
                  Syncing data from {selectedMerge.name}...
                </p>
                <p className="text-[11px] mt-1" style={{ color: colors.textQuaternary }}>
                  Transforming records to agent profiles
                </p>
              </>
            )}

            {syncStatus === "done" && syncResult && (
              <>
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: `${colors.statusSuccess}15` }}
                >
                  <Check className="w-6 h-6" style={{ color: colors.statusSuccess }} />
                </div>
                <p className="text-[13px] font-medium" style={{ color: colors.textPrimary }}>
                  {selectedMerge.name} connected
                </p>
                <p className="text-[13px] mt-1" style={{ color: colors.textSecondary }}>
                  {syncResult.agentCount.toLocaleString()} agents imported
                </p>
                <button
                  onClick={handleDone}
                  className="mt-6 px-4 py-2 rounded text-[13px] font-medium"
                  style={{ background: colors.textPrimary, color: colors.bgBase }}
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal - 8px radius per DESIGN.md */}
      <div
        className="relative w-full max-w-2xl mx-4 rounded-lg overflow-hidden flex flex-col"
        style={{
          background: colors.bgSurface,
          border: `1px solid ${colors.borderDefault}`,
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.6)",
          height: "560px",
        }}
      >
        {/* Header - minimal */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
        >
          <div>
            <h2 className="text-[13px] font-semibold" style={{ color: colors.textPrimary }}>
              Connect Data Source
            </h2>
            <p className="text-[11px]" style={{ color: colors.textTertiary }}>
              CRM, HRIS, databases, and more
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded transition-colors"
            style={{ color: colors.textTertiary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.bgHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search + Categories */}
        <div className="px-4 pt-3 pb-2" style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
          {/* Search - 13px font per DESIGN.md */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded"
            style={{ background: colors.bgBase, border: `1px solid ${colors.borderDefault}` }}
          >
            <Search className="w-4 h-4" style={{ color: colors.iconTertiary }} />
            <input
              type="text"
              placeholder="Search connectors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-[13px]"
              style={{ color: colors.textPrimary }}
            />
          </div>

          {/* Category tabs - 11px labels per DESIGN.md */}
          <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory(null)}
              className="px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors"
              style={{
                background: activeCategory === null ? colors.bgHover : "transparent",
                color: activeCategory === null ? colors.textSecondary : colors.textQuaternary,
              }}
            >
              All ({allConnectors.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className="px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors"
                style={{
                  background: activeCategory === cat.name ? colors.bgHover : "transparent",
                  color: activeCategory === cat.name ? colors.textSecondary : colors.textQuaternary,
                }}
              >
                {cat.name} ({cat.count})
              </button>
            ))}
          </div>
        </div>

        {/* Connector list - flat style per DESIGN.md */}
        <div className="flex-1 overflow-y-auto">
          {filteredConnectors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-[13px]" style={{ color: colors.textQuaternary }}>
                No connectors found
              </p>
            </div>
          ) : (
            <div className="py-1">
              {filteredConnectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => handleConnectorClick(connector)}
                  disabled={isLoading && selectedMerge?.id === connector.id}
                  className="group flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors"
                  style={{ background: "transparent" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.bgHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Logo - real brand logo */}
                  <img
                    src={getLogoUrl(connector.mergeSlug || connector.id)}
                    alt=""
                    className="w-5 h-5 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />

                  {/* Name + description - typography per DESIGN.md */}
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-[13px]" style={{ color: colors.textPrimary }}>
                      {connector.name}
                    </span>
                    <span className="text-[11px]" style={{ color: colors.textQuaternary }}>
                      {connector.description}
                    </span>
                  </div>

                  {/* OAuth badge for Merge connectors */}
                  {connector.type === "merge" && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        background: colors.bgActive,
                        color: colors.textTertiary,
                      }}
                    >
                      OAuth
                    </span>
                  )}

                  {/* Loading or arrow */}
                  {isLoading && selectedMerge?.id === connector.id ? (
                    <Loader2
                      className="w-4 h-4 animate-spin"
                      style={{ color: colors.iconSecondary }}
                    />
                  ) : (
                    <ChevronRight
                      className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: colors.iconSecondary }}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer - minimal per DESIGN.md */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
        >
          <p className="text-[11px]" style={{ color: colors.textQuaternary }}>
            CRM/HRIS via Merge.dev
          </p>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-[13px] transition-colors"
            style={{ color: colors.textTertiary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = colors.textSecondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = colors.textTertiary;
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
