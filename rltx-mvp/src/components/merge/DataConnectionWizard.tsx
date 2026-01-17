"use client";

import { useState, useCallback, useEffect } from "react";
import { X, ChevronLeft, Check, Loader2, Database, Users, ArrowRight } from "lucide-react";
import { useMergeLink } from "@mergeapi/react-merge-link";
import { IntegrationBrowser } from "./IntegrationBrowser";
import type { MergeIntegration, MergeCategory } from "@/lib/merge/client";

// Design tokens - Linear grayscale only
const colors = {
  bgBase: "hsl(0, 0%, 7%)",
  bgSurface: "hsl(0, 0%, 10%)",
  bgElevated: "hsl(0, 0%, 9%)",
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
  statusSuccess: "hsl(142, 70%, 45%)",
  statusError: "hsl(0, 70%, 55%)",
};

type WizardStep = "select" | "connect" | "sync" | "done";

export interface MergeConnectionResult {
  linkedAccountId: string;
  agentCount: number;
  integrationSlug: string;
  integrationName: string;
  category: MergeCategory;
  averageCompleteness: number;
}

interface DataConnectionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (result: MergeConnectionResult) => void;
  allowedCategories?: MergeCategory[];
}

export function DataConnectionWizard({
  isOpen,
  onClose,
  onComplete,
  allowedCategories = ["crm", "hris"],
}: DataConnectionWizardProps) {
  const [step, setStep] = useState<WizardStep>("select");
  const [selectedIntegration, setSelectedIntegration] = useState<MergeIntegration | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linkedAccountId, setLinkedAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{
    totalAgents: number;
    averageCompleteness: number;
  } | null>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep("select");
      setSelectedIntegration(null);
      setLinkToken(null);
      setLinkedAccountId(null);
      setError(null);
      setSyncResult(null);
    }
  }, [isOpen]);

  // Generate link token when integration is selected
  const generateLinkToken = useCallback(async (integration: MergeIntegration) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/merge/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endUserEmailAddress: "user@rltx.com",
          endUserOrganizationName: "RLTX User",
          categories: [integration.category],
          integration: integration.slug,
        }),
      });

      if (!response.ok) throw new Error("Failed to initialize connection");

      const data = await response.json();
      setLinkToken(data.linkToken);
      return data.linkToken;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle successful OAuth
  const handleOAuthSuccess = useCallback(async (publicToken: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/merge/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken }),
      });

      if (!response.ok) throw new Error("Failed to complete connection");

      const data = await response.json();
      setLinkedAccountId(data.linkedAccountId);
      setStep("sync");

      // Auto-start sync
      await startSync(data.linkedAccountId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Start data sync
  const startSync = useCallback(async (accountId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/merge/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkedAccountId: accountId,
          dataTypes: selectedIntegration?.category === "hris" ? ["employees"] : ["contacts", "leads"],
        }),
      });

      if (!response.ok) throw new Error("Sync failed");

      const data = await response.json();
      setSyncResult({
        totalAgents: data.summary.totalAgents,
        averageCompleteness: data.summary.averageCompleteness,
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsLoading(false);
    }
  }, [selectedIntegration]);

  // Merge Link hook
  const { open: openMergeLink, isReady } = useMergeLink({
    linkToken: linkToken || "",
    onSuccess: handleOAuthSuccess,
    onExit: () => {
      if (step === "connect" && !linkedAccountId) {
        setStep("select");
        setLinkToken(null);
      }
    },
  });

  // Handle integration selection
  const handleIntegrationSelect = async (integration: MergeIntegration) => {
    setSelectedIntegration(integration);
    setStep("connect");

    const token = await generateLinkToken(integration);
    if (token) {
      // Open Merge Link after short delay
      setTimeout(() => {
        if (isReady) openMergeLink();
      }, 500);
    }
  };

  // Handle completion
  const handleComplete = () => {
    if (linkedAccountId && syncResult && selectedIntegration) {
      onComplete?.({
        linkedAccountId,
        agentCount: syncResult.totalAgents,
        integrationSlug: selectedIntegration.slug,
        integrationName: selectedIntegration.name,
        category: selectedIntegration.category,
        averageCompleteness: syncResult.averageCompleteness,
      });
    }
    onClose();
  };

  // Go back
  const handleBack = () => {
    if (step === "connect") {
      setStep("select");
      setSelectedIntegration(null);
      setLinkToken(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl mx-4 rounded-lg overflow-hidden flex flex-col"
        style={{
          background: colors.bgElevated,
          border: `1px solid ${colors.borderDefault}`,
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.6)",
          height: "600px",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
        >
          <div className="flex items-center gap-3">
            {step !== "select" && step !== "done" && (
              <button
                onClick={handleBack}
                className="p-1 rounded transition-colors"
                style={{ color: colors.textTertiary }}
                onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-[13px] font-medium" style={{ color: colors.textPrimary }}>
                {step === "done" ? "Connection Complete" : "Connect Data Source"}
              </h2>
              <p className="text-[11px]" style={{ color: colors.textTertiary }}>
                {step === "select" && "Choose an integration"}
                {step === "connect" && selectedIntegration?.name}
                {step === "sync" && "Syncing data..."}
                {step === "done" && "Ready for simulations"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: colors.textTertiary }}
            onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Step: Select Integration */}
          {step === "select" && (
            <IntegrationBrowser
              onSelect={handleIntegrationSelect}
              selectedId={selectedIntegration?.id}
              allowedCategories={allowedCategories}
            />
          )}

          {/* Step: Connect (OAuth) */}
          {step === "connect" && (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              {isLoading ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin mb-4" style={{ color: colors.iconSecondary }} />
                  <p className="text-[13px]" style={{ color: colors.textSecondary }}>
                    Initializing {selectedIntegration?.name} connection...
                  </p>
                </>
              ) : error ? (
                <>
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                    style={{ background: `${colors.statusError}20` }}
                  >
                    <X className="w-6 h-6" style={{ color: colors.statusError }} />
                  </div>
                  <p className="text-[13px] mb-2" style={{ color: colors.textPrimary }}>
                    Connection Failed
                  </p>
                  <p className="text-[12px] mb-4" style={{ color: colors.statusError }}>
                    {error}
                  </p>
                  <button
                    onClick={() => selectedIntegration && handleIntegrationSelect(selectedIntegration)}
                    className="px-4 py-2 rounded text-[13px] font-medium"
                    style={{ background: colors.textPrimary, color: colors.bgBase }}
                  >
                    Try Again
                  </button>
                </>
              ) : (
                <>
                  <Database className="w-8 h-8 mb-4" style={{ color: colors.iconSecondary }} />
                  <p className="text-[13px] mb-2" style={{ color: colors.textSecondary }}>
                    Waiting for authorization...
                  </p>
                  <p className="text-[11px]" style={{ color: colors.textQuaternary }}>
                    Complete the OAuth flow in the popup window
                  </p>
                  <button
                    onClick={() => isReady && openMergeLink()}
                    className="mt-4 px-4 py-2 rounded text-[13px] font-medium"
                    style={{ background: colors.bgHover, color: colors.textSecondary }}
                  >
                    Reopen Authorization Window
                  </button>
                </>
              )}
            </div>
          )}

          {/* Step: Sync */}
          {step === "sync" && (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mb-4" style={{ color: colors.iconSecondary }} />
              <p className="text-[13px] mb-2" style={{ color: colors.textSecondary }}>
                Syncing {selectedIntegration?.name} data...
              </p>
              <p className="text-[11px]" style={{ color: colors.textQuaternary }}>
                Fetching records and transforming to agent profiles
              </p>
            </div>
          )}

          {/* Step: Done */}
          {step === "done" && syncResult && (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                style={{ background: `${colors.statusSuccess}15` }}
              >
                <Check className="w-8 h-8" style={{ color: colors.statusSuccess }} />
              </div>

              <h3 className="text-[16px] font-medium mb-2" style={{ color: colors.textPrimary }}>
                {selectedIntegration?.name} Connected
              </h3>

              <p className="text-[13px] mb-6" style={{ color: colors.textSecondary }}>
                Your data has been synced and transformed into agent profiles
              </p>

              {/* Stats */}
              <div
                className="flex gap-8 p-4 rounded-lg mb-6"
                style={{ background: colors.bgSurface }}
              >
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Users className="w-4 h-4" style={{ color: colors.iconSecondary }} />
                    <span className="text-[20px] font-semibold" style={{ color: colors.textPrimary }}>
                      {syncResult.totalAgents.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px]" style={{ color: colors.textTertiary }}>
                    Agents Created
                  </p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="text-[20px] font-semibold" style={{ color: colors.textPrimary }}>
                      {syncResult.averageCompleteness}%
                    </span>
                  </div>
                  <p className="text-[11px]" style={{ color: colors.textTertiary }}>
                    Avg. Trait Coverage
                  </p>
                </div>
              </div>

              <p className="text-[11px] mb-4" style={{ color: colors.textQuaternary }}>
                These agents are now available for use in your simulations
              </p>
            </div>
          )}

          {/* Error display */}
          {error && step !== "connect" && (
            <div
              className="mx-4 mb-4 p-3 rounded text-[12px]"
              style={{ background: `${colors.statusError}10`, color: colors.statusError }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "done" && (
          <div
            className="flex items-center justify-end px-4 py-3 flex-shrink-0"
            style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
          >
            <button
              onClick={handleComplete}
              className="flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-medium"
              style={{ background: colors.textPrimary, color: colors.bgBase }}
            >
              Done <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
