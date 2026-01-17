import { create } from "zustand";
import { persist } from "zustand/middleware";

// =============================================================================
// TYPES
// =============================================================================

export type ModelTier = "haiku" | "sonnet" | "opus";
export type AgentCountPreset = 100 | 500 | 1000 | 5000 | 10000;
export type AutoArchiveDays = 7 | 14 | 30 | 90 | "never";

export interface NotificationPreferences {
  simulationComplete: boolean;
  simulationFailed: boolean;
  dataSyncUpdates: boolean;
  weeklyDigest: boolean;
  thresholdAlerts: boolean;
}

export interface Settings {
  // Account
  name: string;
  email: string;

  // API Keys (stored encrypted in production)
  anthropicApiKey: string;
  mergeApiKey: string;
  openaiApiKey: string;

  // Defaults
  defaultModel: ModelTier;
  defaultAgentCount: AgentCountPreset;
  autoArchiveDays: AutoArchiveDays;

  // Notifications
  notifications: NotificationPreferences;
}

// =============================================================================
// STORE
// =============================================================================

interface SettingsState extends Settings {
  // Actions
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  updateNotificationPref: (key: keyof NotificationPreferences, value: boolean) => void;
  resetToDefaults: () => void;
  clearAllData: () => void;
  exportData: () => Promise<void>;
}

const defaultSettings: Settings = {
  name: "",
  email: "",
  anthropicApiKey: "",
  mergeApiKey: "",
  openaiApiKey: "",
  defaultModel: "sonnet",
  defaultAgentCount: 1000,
  autoArchiveDays: 30,
  notifications: {
    simulationComplete: true,
    simulationFailed: true,
    dataSyncUpdates: false,
    weeklyDigest: false,
    thresholdAlerts: true,
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

      updateSetting: (key, value) => {
        set({ [key]: value });
      },

      updateNotificationPref: (key, value) => {
        set((state) => ({
          notifications: {
            ...state.notifications,
            [key]: value,
          },
        }));
      },

      resetToDefaults: () => {
        set({
          defaultModel: defaultSettings.defaultModel,
          defaultAgentCount: defaultSettings.defaultAgentCount,
          autoArchiveDays: defaultSettings.autoArchiveDays,
          notifications: { ...defaultSettings.notifications },
        });
      },

      clearAllData: () => {
        // Clear all localStorage keys related to the app
        if (typeof window !== "undefined") {
          const keysToRemove = [
            "rltx-data-store",
            "rltx-sources-store",
            "rltx-inbox-store",
            "rltx-starred-workflows",
            "rltx-archived-workflows",
          ];
          keysToRemove.forEach((key) => localStorage.removeItem(key));
        }
      },

      exportData: async () => {
        // Export all workflow data as JSON
        try {
          const response = await fetch("/api/workflows");
          const workflows = await response.json();

          const exportData = {
            exportedAt: new Date().toISOString(),
            workflows: workflows.workflows || [],
            settings: {
              defaultModel: get().defaultModel,
              defaultAgentCount: get().defaultAgentCount,
              notifications: get().notifications,
            },
          };

          const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `rltx-export-${new Date().toISOString().split("T")[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error("Export failed:", error);
        }
      },
    }),
    {
      name: "rltx-settings-store",
      partialize: (state) => ({
        name: state.name,
        email: state.email,
        anthropicApiKey: state.anthropicApiKey,
        mergeApiKey: state.mergeApiKey,
        openaiApiKey: state.openaiApiKey,
        defaultModel: state.defaultModel,
        defaultAgentCount: state.defaultAgentCount,
        autoArchiveDays: state.autoArchiveDays,
        notifications: state.notifications,
      }),
    }
  )
);

// =============================================================================
// CONSTANTS FOR UI
// =============================================================================

export const MODEL_OPTIONS: { value: ModelTier; label: string; description: string }[] = [
  { value: "haiku", label: "Haiku", description: "Fastest, most economical" },
  { value: "sonnet", label: "Sonnet", description: "Balanced speed and quality" },
  { value: "opus", label: "Opus", description: "Highest quality, slower" },
];

export const AGENT_COUNT_OPTIONS: { value: AgentCountPreset; label: string }[] = [
  { value: 100, label: "100 agents" },
  { value: 500, label: "500 agents" },
  { value: 1000, label: "1,000 agents" },
  { value: 5000, label: "5,000 agents" },
  { value: 10000, label: "10,000 agents" },
];

export const AUTO_ARCHIVE_OPTIONS: { value: AutoArchiveDays; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: "never", label: "Never" },
];

export const KEYBOARD_SHORTCUTS = [
  { keys: "⌘K", description: "Command palette" },
  { keys: "⌘N", description: "New workflow" },
  { keys: "j / k", description: "Navigate list" },
  { keys: "Enter", description: "Open selected" },
  { keys: "s", description: "Star / unstar" },
  { keys: "e", description: "Archive" },
  { keys: "Esc", description: "Close / deselect" },
];
