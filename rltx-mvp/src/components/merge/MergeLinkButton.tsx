"use client";

import { useState, useCallback } from "react";
import { useMergeLink } from "@mergeapi/react-merge-link";
import { Link2, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import type { MergeCategory } from "@/lib/merge/client";

// Design tokens - Linear grayscale only
const colors = {
  bgBase: "hsl(0, 0%, 7%)",
  bgSurface: "hsl(0, 0%, 10%)",
  bgHover: "hsl(0, 0%, 12%)",
  bgActive: "hsl(0, 0%, 14%)",
  borderSubtle: "hsl(0, 0%, 12%)",
  borderDefault: "hsl(0, 0%, 15%)",
  borderHover: "hsl(0, 0%, 20%)",
  textPrimary: "hsl(0, 0%, 93%)",
  textSecondary: "hsl(0, 0%, 70%)",
  textTertiary: "hsl(0, 0%, 50%)",
  iconSecondary: "hsl(0, 0%, 45%)",
  statusSuccess: "hsl(142, 70%, 45%)",
  statusError: "hsl(0, 70%, 55%)",
};

interface MergeLinkButtonProps {
  categories?: MergeCategory[];
  integration?: string;
  onSuccess: (linkedAccountId: string, integration: { name: string; slug: string; category: string }) => void;
  onError?: (error: string) => void;
  buttonText?: string;
  className?: string;
}

export function MergeLinkButton({
  categories,
  integration,
  onSuccess,
  onError,
  buttonText = "Connect Integration",
  className = "",
}: MergeLinkButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generate link token
  const generateLinkToken = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const response = await fetch("/api/merge/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endUserEmailAddress: "user@example.com", // Would come from auth context
          endUserOrganizationName: "RLTX User",
          categories,
          integration,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate link token");
      }

      const data = await response.json();
      setLinkToken(data.linkToken);
      return data.linkToken;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to initialize";
      setError(message);
      setStatus("error");
      onError?.(message);
      return null;
    }
  }, [categories, integration, onError]);

  // Handle successful connection
  const handleSuccess = useCallback(async (publicToken: string) => {
    setStatus("loading");

    try {
      const response = await fetch("/api/merge/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken }),
      });

      if (!response.ok) {
        throw new Error("Failed to complete connection");
      }

      const data = await response.json();
      setStatus("success");
      onSuccess(data.linkedAccountId, data.integration);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      setError(message);
      setStatus("error");
      onError?.(message);
    }
  }, [onSuccess, onError]);

  // Handle exit (user closed without completing)
  const handleExit = useCallback(() => {
    if (status !== "success") {
      setStatus("idle");
      setLinkToken(null);
    }
  }, [status]);

  // Merge Link hook
  const { open, isReady } = useMergeLink({
    linkToken: linkToken || "",
    onSuccess: handleSuccess,
    onExit: handleExit,
  });

  // Handle button click
  const handleClick = async () => {
    if (status === "loading") return;

    if (!linkToken) {
      const token = await generateLinkToken();
      if (token) {
        // Small delay to ensure token is set
        setTimeout(() => open(), 100);
      }
    } else if (isReady) {
      open();
    }
  };

  return (
    <div className={className}>
      <button
        onClick={handleClick}
        disabled={status === "loading"}
        className="flex items-center gap-2 px-3 py-1.5 rounded text-[13px] font-medium transition-all"
        style={{
          background: status === "success" ? "transparent" : colors.textPrimary,
          color: status === "success" ? colors.statusSuccess : colors.bgBase,
          border: status === "success" ? `1px solid ${colors.statusSuccess}` : "none",
          opacity: status === "loading" ? 0.7 : 1,
          cursor: status === "loading" ? "wait" : "pointer",
        }}
        onMouseEnter={(e) => {
          if (status !== "loading" && status !== "success") {
            e.currentTarget.style.background = "hsl(0, 0%, 100%)";
          }
        }}
        onMouseLeave={(e) => {
          if (status !== "loading" && status !== "success") {
            e.currentTarget.style.background = colors.textPrimary;
          }
        }}
      >
        {status === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {status === "success" && <CheckCircle className="w-3.5 h-3.5" />}
        {status === "error" && <AlertCircle className="w-3.5 h-3.5" />}
        {status === "idle" && <Link2 className="w-3.5 h-3.5" />}

        <span>
          {status === "loading" && "Connecting..."}
          {status === "success" && "Connected"}
          {status === "error" && "Retry"}
          {status === "idle" && buttonText}
        </span>
      </button>

      {error && (
        <p className="mt-2 text-[11px]" style={{ color: colors.statusError }}>
          {error}
        </p>
      )}
    </div>
  );
}
