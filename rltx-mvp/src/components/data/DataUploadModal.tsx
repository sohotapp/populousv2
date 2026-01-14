"use client";

import { useState, useCallback, useRef } from "react";
import { X, Upload, FileText, Table, Braces, AlertCircle, Check, FileSpreadsheet, File, Loader2 } from "lucide-react";
import { useDataStore, formatFileSize, type DatasetMetadata } from "@/stores/data";

// Design tokens - Linear grayscale only
const colors = {
  bgBase: "hsl(0, 0%, 7%)",
  bgSurface: "hsl(0, 0%, 10%)",
  bgElevated: "hsl(0, 0%, 9%)",
  bgInput: "hsl(0, 0%, 8%)",
  bgHover: "hsl(0, 0%, 12%)",
  bgDrop: "hsl(0, 0%, 11%)",
  borderSubtle: "hsl(0, 0%, 12%)",
  borderDefault: "hsl(0, 0%, 15%)",
  borderHover: "hsl(0, 0%, 20%)",
  borderFocus: "hsl(0, 0%, 25%)",
  textPrimary: "hsl(0, 0%, 93%)",
  textSecondary: "hsl(0, 0%, 70%)",
  textTertiary: "hsl(0, 0%, 50%)",
  textQuaternary: "hsl(0, 0%, 35%)",
  iconSecondary: "hsl(0, 0%, 45%)",
  iconEmpty: "hsl(0, 0%, 20%)",
  statusSuccess: "hsl(142, 70%, 45%)",
  statusError: "hsl(0, 70%, 55%)",
};

// File type colors
const fileTypeColors: Record<string, string> = {
  csv: "hsl(142, 70%, 45%)",
  xlsx: "hsl(142, 70%, 45%)",
  json: "hsl(35, 90%, 55%)",
  pdf: "hsl(0, 70%, 55%)",
  docx: "hsl(210, 70%, 55%)",
  txt: "hsl(0, 0%, 50%)",
};

interface DataUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (dataset: DatasetMetadata) => void;
}

export function DataUploadModal({ isOpen, onClose, onUploadComplete }: DataUploadModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadedDataset, setUploadedDataset] = useState<DatasetMetadata | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile } = useDataStore();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    setUploadState("uploading");
    setErrorMessage(null);

    try {
      const dataset = await uploadFile(file);
      setUploadedDataset(dataset);
      setUploadState("success");
      onUploadComplete?.(dataset);
    } catch (error) {
      setUploadState("error");
      setErrorMessage(error instanceof Error ? error.message : "Upload failed");
    }
  }, [uploadFile, onUploadComplete]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleUpload(files[0]);
    }
  }, [handleUpload]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleUpload(files[0]);
    }
  }, [handleUpload]);

  const handleClose = () => {
    setUploadState("idle");
    setUploadedDataset(null);
    setErrorMessage(null);
    onClose();
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case "csv":
      case "xlsx":
        return <FileSpreadsheet className="w-5 h-5" />;
      case "json":
        return <Braces className="w-5 h-5" />;
      case "pdf":
      case "docx":
        return <FileText className="w-5 h-5" />;
      default:
        return <File className="w-5 h-5" />;
    }
  };

  const getFileTypeColor = (type: string) => fileTypeColors[type] || colors.textTertiary;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
      />

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
              <Upload className="w-5 h-5" style={{ color: colors.iconSecondary }} />
            </div>
            <div>
              <h2 className="font-semibold text-sm" style={{ color: colors.textPrimary }}>
                Upload File
              </h2>
              <p className="text-xs" style={{ color: colors.textTertiary }}>
                Import data from a file
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded transition-colors hover:bg-[hsl(0,0%,15%)]"
            style={{ color: colors.textTertiary }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {uploadState === "idle" && (
            <>
              {/* Drop zone */}
              <div
                className="relative rounded-lg transition-all cursor-pointer"
                style={{
                  border: `2px dashed ${isDragging ? colors.borderHover : colors.borderDefault}`,
                  background: isDragging ? colors.bgDrop : "transparent",
                  padding: "40px 24px",
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center text-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                    style={{ background: colors.bgHover }}
                  >
                    <Upload
                      className="w-6 h-6"
                      style={{ color: isDragging ? colors.iconSecondary : colors.iconEmpty }}
                    />
                  </div>
                  <p
                    className="font-medium text-sm mb-1"
                    style={{ color: isDragging ? colors.textPrimary : colors.textSecondary }}
                  >
                    Drop a file here or click to browse
                  </p>
                  <p className="text-xs" style={{ color: colors.textQuaternary }}>
                    CSV, JSON, PDF, DOCX, XLSX, TXT
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".csv,.json,.pdf,.docx,.doc,.xlsx,.xls,.txt"
                onChange={handleFileSelect}
              />

              {/* Supported formats */}
              <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                {["CSV", "JSON", "XLSX", "PDF"].map((format) => (
                  <span
                    key={format}
                    className="px-2 py-0.5 rounded text-xs"
                    style={{ background: colors.bgHover, color: colors.textTertiary }}
                  >
                    {format}
                  </span>
                ))}
              </div>
            </>
          )}

          {uploadState === "uploading" && (
            <div className="flex flex-col items-center py-10">
              <Loader2
                className="w-8 h-8 animate-spin mb-4"
                style={{ color: colors.iconSecondary }}
              />
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                Processing file...
              </p>
              <p className="text-xs mt-1" style={{ color: colors.textQuaternary }}>
                Analyzing schema and extracting data
              </p>
            </div>
          )}

          {uploadState === "success" && uploadedDataset && (
            <div className="space-y-4">
              {/* Success message */}
              <div
                className="flex items-center gap-2 p-3 rounded-md"
                style={{ background: "hsla(142, 70%, 45%, 0.1)" }}
              >
                <Check className="w-4 h-4" style={{ color: colors.statusSuccess }} />
                <span className="text-sm" style={{ color: colors.statusSuccess }}>
                  File uploaded successfully
                </span>
              </div>

              {/* File info */}
              <div
                className="p-4 rounded-md"
                style={{
                  background: colors.bgSurface,
                  border: `1px solid ${colors.borderSubtle}`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="p-2.5 rounded-md"
                    style={{ background: `${getFileTypeColor(uploadedDataset.type)}15` }}
                  >
                    <span style={{ color: getFileTypeColor(uploadedDataset.type) }}>
                      {getFileIcon(uploadedDataset.type)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium text-sm truncate"
                      style={{ color: colors.textPrimary }}
                    >
                      {uploadedDataset.filename}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: colors.textTertiary }}>
                      {formatFileSize(uploadedDataset.size)} • {uploadedDataset.rowCount.toLocaleString()} rows • {uploadedDataset.schema.fields.length} fields
                    </p>
                  </div>
                </div>

                {/* Schema preview */}
                {uploadedDataset.schema.fields.length > 0 && (
                  <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
                    <p className="text-xs mb-2" style={{ color: colors.textTertiary }}>
                      Detected fields
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {uploadedDataset.schema.fields.slice(0, 6).map((field) => (
                        <span
                          key={field.name}
                          className="px-2 py-1 rounded text-xs"
                          style={{
                            background: colors.bgHover,
                            color: colors.textSecondary,
                          }}
                        >
                          {field.name}
                          <span className="ml-1.5" style={{ color: colors.textQuaternary }}>
                            {field.type}
                          </span>
                        </span>
                      ))}
                      {uploadedDataset.schema.fields.length > 6 && (
                        <span
                          className="px-2 py-1 rounded text-xs"
                          style={{ color: colors.textQuaternary }}
                        >
                          +{uploadedDataset.schema.fields.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {uploadState === "error" && (
            <div className="space-y-4">
              {/* Error message */}
              <div
                className="flex items-center gap-2 p-3 rounded-md"
                style={{ background: "hsla(0, 70%, 55%, 0.1)" }}
              >
                <AlertCircle className="w-4 h-4" style={{ color: colors.statusError }} />
                <span className="text-sm" style={{ color: colors.statusError }}>
                  {errorMessage || "Upload failed"}
                </span>
              </div>

              <p className="text-xs text-center" style={{ color: colors.textQuaternary }}>
                Please check the file format and try again
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
        >
          {uploadState === "idle" && (
            <>
              <button
                onClick={handleClose}
                className="px-3 py-1.5 rounded text-sm transition-colors"
                style={{ color: colors.textSecondary }}
              >
                Cancel
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-colors"
                style={{
                  background: colors.textPrimary,
                  color: colors.bgBase,
                }}
              >
                <Upload className="w-4 h-4" />
                Select File
              </button>
            </>
          )}

          {uploadState === "uploading" && (
            <div className="w-full flex justify-center">
              <button
                onClick={handleClose}
                className="px-3 py-1.5 rounded text-sm transition-colors"
                style={{ color: colors.textTertiary }}
              >
                Cancel
              </button>
            </div>
          )}

          {uploadState === "success" && (
            <>
              <button
                onClick={() => {
                  setUploadState("idle");
                  setUploadedDataset(null);
                }}
                className="px-3 py-1.5 rounded text-sm transition-colors"
                style={{
                  color: colors.textSecondary,
                  border: `1px solid ${colors.borderDefault}`,
                }}
              >
                Upload Another
              </button>
              <button
                onClick={handleClose}
                className="flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-colors"
                style={{
                  background: colors.statusSuccess,
                  color: colors.textPrimary,
                }}
              >
                <Check className="w-4 h-4" />
                Done
              </button>
            </>
          )}

          {uploadState === "error" && (
            <>
              <button
                onClick={handleClose}
                className="px-3 py-1.5 rounded text-sm transition-colors"
                style={{ color: colors.textSecondary }}
              >
                Cancel
              </button>
              <button
                onClick={() => setUploadState("idle")}
                className="flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-colors"
                style={{
                  background: colors.textPrimary,
                  color: colors.bgBase,
                }}
              >
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
