"use client";

import { useState, useCallback } from "react";
import { X, Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import type { ConnectorDefinition } from "@/stores/sources";
import { ConnectorLogo } from "../icons/ConnectorLogos";

// Design tokens from design.md
const colors = {
  bgBase: "hsl(0, 0%, 7%)",
  bgSurface: "hsl(0, 0%, 10%)",
  bgElevated: "hsl(0, 0%, 9%)",
  bgInput: "hsl(0, 0%, 8%)",
  bgHover: "hsl(0, 0%, 12%)",
  borderSubtle: "hsl(0, 0%, 12%)",
  borderDefault: "hsl(0, 0%, 15%)",
  borderHover: "hsl(0, 0%, 20%)",
  borderFocus: "hsl(0, 0%, 25%)",
  textPrimary: "hsl(0, 0%, 93%)",
  textSecondary: "hsl(0, 0%, 70%)",
  textTertiary: "hsl(0, 0%, 50%)",
  textQuaternary: "hsl(0, 0%, 35%)",
  textPlaceholder: "hsl(0, 0%, 40%)",
  statusSuccess: "hsl(142, 70%, 45%)",
  statusError: "hsl(0, 70%, 55%)",
};

interface SourceConfigModalProps {
  connector: ConnectorDefinition;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; config: Record<string, string> }) => Promise<void>;
}

export function SourceConfigModal({ connector, isOpen, onClose, onSubmit }: SourceConfigModalProps) {
  const [name, setName] = useState(`${connector.name} Connection`);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleConfigChange = (fieldName: string, value: string) => {
    setConfig((prev) => ({ ...prev, [fieldName]: value }));
    // Clear error when user starts typing
    if (errors[fieldName]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  const togglePasswordVisibility = (fieldName: string) => {
    setShowPasswords((prev) => ({ ...prev, [fieldName]: !prev[fieldName] }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    for (const field of connector.configFields) {
      if (field.required && !config[field.name]?.trim()) {
        newErrors[field.name] = `${field.label} is required`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTestConnection = async () => {
    if (!validateForm()) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      // Simulate test connection
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 90% success rate for demo
      if (Math.random() > 0.1) {
        setTestResult({ success: true, message: "Connection successful" });
      } else {
        setTestResult({ success: false, message: "Authentication failed. Please check your credentials." });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Connection test failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ name, config });
      onClose();
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : "Failed to create source" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-md mx-4 rounded-xl overflow-hidden animate-fade-in"
        style={{
          background: colors.bgElevated,
          border: `1px solid ${colors.borderDefault}`,
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.6)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-md"
              style={{ background: colors.bgHover }}
            >
              <ConnectorLogo connectorId={connector.id} className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-sm" style={{ color: colors.textPrimary }}>
                Connect {connector.name}
              </h2>
              <p className="text-xs" style={{ color: colors.textTertiary }}>
                Enter your credentials
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded transition-colors hover:bg-[hsl(0,0%,15%)]"
            style={{ color: colors.textTertiary }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Source name */}
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: colors.textSecondary }}
            >
              Connection Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-sm transition-all outline-none"
              style={{
                background: colors.bgInput,
                border: `1px solid ${errors.name ? colors.statusError : colors.borderDefault}`,
                color: colors.textPrimary,
              }}
              placeholder="My Salesforce Data"
            />
            {errors.name && (
              <p className="text-xs mt-1" style={{ color: colors.statusError }}>
                {errors.name}
              </p>
            )}
          </div>

          {/* Config fields */}
          {connector.configFields.map((field) => (
            <div key={field.name}>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: colors.textSecondary }}
              >
                {field.label}
                {field.required && <span style={{ color: colors.statusError }}> *</span>}
              </label>

              {field.type === "checkbox" ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config[field.name] === "true"}
                    onChange={(e) => handleConfigChange(field.name, e.target.checked ? "true" : "false")}
                    className="w-4 h-4 rounded border-2 bg-transparent checked:bg-white checked:border-white"
                  />
                  <span className="text-sm" style={{ color: colors.textSecondary }}>
                    {field.helpText || "Enable"}
                  </span>
                </label>
              ) : field.type === "select" ? (
                <select
                  value={config[field.name] || ""}
                  onChange={(e) => handleConfigChange(field.name, e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm transition-all outline-none appearance-none cursor-pointer"
                  style={{
                    background: colors.bgInput,
                    border: `1px solid ${errors[field.name] ? colors.statusError : colors.borderDefault}`,
                    color: colors.textPrimary,
                  }}
                >
                  <option value="">Select...</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="relative">
                  <input
                    type={field.type === "password" && !showPasswords[field.name] ? "password" : "text"}
                    value={config[field.name] || ""}
                    onChange={(e) => handleConfigChange(field.name, e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm transition-all outline-none pr-10"
                    style={{
                      background: colors.bgInput,
                      border: `1px solid ${errors[field.name] ? colors.statusError : colors.borderDefault}`,
                      color: colors.textPrimary,
                    }}
                    placeholder={field.placeholder}
                  />
                  {field.type === "password" && (
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(field.name)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded"
                      style={{ color: colors.textTertiary }}
                    >
                      {showPasswords[field.name] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              )}
              {errors[field.name] && (
                <p className="text-xs mt-1" style={{ color: colors.statusError }}>
                  {errors[field.name]}
                </p>
              )}
              {field.helpText && !errors[field.name] && (
                <p className="text-xs mt-1" style={{ color: colors.textQuaternary }}>
                  {field.helpText}
                </p>
              )}
            </div>
          ))}

          {/* Test result */}
          {testResult && (
            <div
              className="flex items-center gap-2 p-3 rounded-md"
              style={{
                background: testResult.success
                  ? "hsla(142, 70%, 45%, 0.1)"
                  : "hsla(0, 70%, 55%, 0.1)",
              }}
            >
              {testResult.success ? (
                <CheckCircle className="w-4 h-4" style={{ color: colors.statusSuccess }} />
              ) : (
                <AlertCircle className="w-4 h-4" style={{ color: colors.statusError }} />
              )}
              <span
                className="text-sm"
                style={{ color: testResult.success ? colors.statusSuccess : colors.statusError }}
              >
                {testResult.message}
              </span>
            </div>
          )}

          {/* Submit error */}
          {errors.submit && (
            <div
              className="flex items-center gap-2 p-3 rounded-md"
              style={{ background: "hsla(0, 70%, 55%, 0.1)" }}
            >
              <AlertCircle className="w-4 h-4" style={{ color: colors.statusError }} />
              <span className="text-sm" style={{ color: colors.statusError }}>
                {errors.submit}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
        >
          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors"
            style={{
              background: "transparent",
              color: colors.textSecondary,
              border: `1px solid ${colors.borderDefault}`,
              opacity: isTesting ? 0.6 : 1,
            }}
          >
            {isTesting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Test Connection
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-sm transition-colors"
              style={{
                background: "transparent",
                color: colors.textSecondary,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-colors"
              style={{
                background: colors.textPrimary,
                color: colors.bgBase,
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
