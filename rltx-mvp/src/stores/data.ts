import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface DataField {
  name: string;
  type: string;
  nullable: boolean;
}

export interface DataSchema {
  fields: DataField[];
}

export interface DatasetMetadata {
  dataId: string;
  filename: string;
  type: "pdf" | "csv" | "docx" | "json" | "xlsx" | "txt";
  schema: DataSchema;
  rowCount: number;
  preview: unknown[];
  size: number;
  uploadedAt: string;
}

interface DataState {
  datasets: DatasetMetadata[];
  isLoading: boolean;
  error: string | null;
  selectedDataId: string | null;

  // Actions
  fetchDatasets: () => Promise<void>;
  uploadFile: (file: File) => Promise<DatasetMetadata>;
  deleteDataset: (dataId: string) => Promise<void>;
  selectDataset: (dataId: string | null) => void;
  getDataset: (dataId: string) => DatasetMetadata | undefined;
  getDataContent: (dataId: string) => Promise<unknown>;
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      datasets: [],
      isLoading: false,
      error: null,
      selectedDataId: null,

      fetchDatasets: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch("/api/data/upload");

          if (!response.ok) {
            throw new Error(`Failed to fetch datasets: ${response.status}`);
          }

          const { data } = await response.json();
          set({ datasets: data, isLoading: false });
        } catch (error) {
          console.error("Fetch datasets error:", error);
          set({
            error: error instanceof Error ? error.message : "Failed to fetch datasets",
            isLoading: false,
          });
        }
      },

      uploadFile: async (file: File) => {
        set({ isLoading: true, error: null });

        try {
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch("/api/data/upload", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Upload failed: ${response.status}`);
          }

          const dataset: DatasetMetadata = await response.json();

          set((state) => ({
            datasets: [dataset, ...state.datasets],
            isLoading: false,
          }));

          return dataset;
        } catch (error) {
          console.error("Upload error:", error);
          set({
            error: error instanceof Error ? error.message : "Upload failed",
            isLoading: false,
          });
          throw error;
        }
      },

      deleteDataset: async (dataId: string) => {
        try {
          const response = await fetch(`/api/data/upload?id=${dataId}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            throw new Error(`Delete failed: ${response.status}`);
          }

          set((state) => ({
            datasets: state.datasets.filter((d) => d.dataId !== dataId),
            selectedDataId:
              state.selectedDataId === dataId ? null : state.selectedDataId,
          }));
        } catch (error) {
          console.error("Delete error:", error);
          set({
            error: error instanceof Error ? error.message : "Delete failed",
          });
          throw error;
        }
      },

      selectDataset: (dataId: string | null) => {
        set({ selectedDataId: dataId });
      },

      getDataset: (dataId: string) => {
        return get().datasets.find((d) => d.dataId === dataId);
      },

      getDataContent: async (dataId: string) => {
        try {
          const response = await fetch(`/api/data/upload?id=${dataId}`);

          if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status}`);
          }

          const data = await response.json();
          return data.content;
        } catch (error) {
          console.error("Get data content error:", error);
          throw error;
        }
      },
    }),
    {
      name: "rltx-data-store",
      partialize: (state) => ({
        // Only persist dataset metadata, not content
        datasets: state.datasets,
      }),
    }
  )
);

// Utility function to format file size
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Utility function to format relative time
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Get icon name for file type
export function getFileTypeIcon(type: DatasetMetadata["type"]): string {
  switch (type) {
    case "csv":
      return "Table";
    case "json":
      return "Braces";
    case "pdf":
      return "FileText";
    case "docx":
      return "FileText";
    case "xlsx":
      return "Table";
    case "txt":
      return "FileText";
    default:
      return "File";
  }
}

// Get color for file type
export function getFileTypeColor(type: DatasetMetadata["type"]): string {
  switch (type) {
    case "csv":
      return "#22c55e"; // Green
    case "json":
      return "#f59e0b"; // Amber
    case "pdf":
      return "#ef4444"; // Red
    case "docx":
      return "#3b82f6"; // Blue
    case "xlsx":
      return "#22c55e"; // Green
    case "txt":
      return "#6b7280"; // Gray
    default:
      return "#6b7280";
  }
}
