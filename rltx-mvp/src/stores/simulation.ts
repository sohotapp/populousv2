import { create } from "zustand";
import { persist } from "zustand/middleware";

// Types
export interface SimulationTarget {
  id: string;
  type: "person" | "company" | "demographic";
  name: string;
  role?: string;
  company?: string;
  linkedinUrl?: string;
  status: "pending" | "cached" | "researching" | "complete" | "error";
  dataPoints?: number;
  cachedAt?: string;
}

export interface WorldConfig {
  hypotheticalEvents: string[];
  marketConditions: {
    economy: "growth" | "stable" | "recession";
    sentiment: "bullish" | "neutral" | "bearish";
    volatility: "low" | "medium" | "high";
  };
  timeHorizon: "1m" | "3m" | "6m" | "1y" | "2y";
}

export interface PopulationConfig {
  mode: "single_vip" | "population";
  sampleSize: number;
  demographics: {
    ageRange?: [number, number];
    incomeMin?: number;
    region?: string[];
    industry?: string[];
    role?: string[];
    companySize?: "startup" | "smb" | "enterprise";
  };
  archetypeMix: "census" | "uniform" | "custom";
}

export interface DistributionItem {
  label: string;
  value: number;
}

export interface SegmentResult {
  name: string;
  value: number;
  count: number;
  delta: number;
}

export interface DemographicBreakdown {
  category: string;
  items: Array<{
    label: string;
    value: number;
    count: number;
    delta: number;
  }>;
}

export interface DriverResult {
  factor: string;
  importance: number;
  direction: "positive" | "negative" | "mixed";
  description?: string;
}

export interface CounterfactualResult {
  scenario: string;
  outcome: number;
  delta: number;
  significance: boolean;
}

export interface SimulationResult {
  id: string;
  query: string;
  timestamp: string;

  summary: {
    primaryMetric: number;
    primaryMetricLabel: string;
    confidenceInterval: { lower: number; upper: number };
    sampleSize: number;
    executionTime: number;
  };

  distribution: {
    type: "binary" | "categorical" | "continuous";
    values: DistributionItem[];
  };

  segments?: SegmentResult[];
  demographics?: DemographicBreakdown[];
  drivers?: DriverResult[];
  counterfactuals?: CounterfactualResult[];

  accuracy: {
    ssrCalibration: number;
    sampleQuality: number;
    historicalFit: number;
  };

  workflow?: {
    nodes: unknown[];
    edges: unknown[];
  };
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  simulationId?: string;
}

interface SimulationState {
  // Chat state
  messages: Message[];
  currentQuery: string;
  isGenerating: boolean;

  // Research state
  isResearching: boolean;
  targets: SimulationTarget[];
  researchProgress: number;

  // Configuration
  worldConfig: WorldConfig;
  populationConfig: PopulationConfig;

  // Execution state
  isExecuting: boolean;
  executionProgress: number;
  currentSimulationId: string | null;

  // Results
  currentResult: SimulationResult | null;
  history: SimulationResult[];

  // UI state
  activeResultTab: "dashboard" | "distribution" | "segments" | "demographics" | "counterfactuals";
  showNodeGraph: boolean;
  showWorldConfig: boolean;
  showPopulationConfig: boolean;

  // Actions
  setQuery: (query: string) => void;
  addMessage: (message: Omit<Message, "id" | "timestamp">) => void;
  clearMessages: () => void;

  setWorldConfig: (config: Partial<WorldConfig>) => void;
  setPopulationConfig: (config: Partial<PopulationConfig>) => void;
  addHypotheticalEvent: (event: string) => void;
  removeHypotheticalEvent: (index: number) => void;

  startResearch: (targets: SimulationTarget[]) => void;
  updateTargetStatus: (id: string, status: SimulationTarget["status"], dataPoints?: number) => void;
  completeResearch: () => void;

  startExecution: (simulationId: string) => void;
  updateExecutionProgress: (progress: number) => void;
  setResult: (result: SimulationResult) => void;
  completeExecution: () => void;

  addToHistory: (result: SimulationResult) => void;
  loadFromHistory: (id: string) => void;
  clearHistory: () => void;

  setActiveTab: (tab: SimulationState["activeResultTab"]) => void;
  toggleNodeGraph: () => void;
  toggleWorldConfig: () => void;
  togglePopulationConfig: () => void;

  reset: () => void;
}

const defaultWorldConfig: WorldConfig = {
  hypotheticalEvents: [],
  marketConditions: {
    economy: "stable",
    sentiment: "neutral",
    volatility: "medium",
  },
  timeHorizon: "6m",
};

const defaultPopulationConfig: PopulationConfig = {
  mode: "population",
  sampleSize: 1000,
  demographics: {},
  archetypeMix: "census",
};

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set, get) => ({
      // Initial state
      messages: [],
      currentQuery: "",
      isGenerating: false,

      isResearching: false,
      targets: [],
      researchProgress: 0,

      worldConfig: defaultWorldConfig,
      populationConfig: defaultPopulationConfig,

      isExecuting: false,
      executionProgress: 0,
      currentSimulationId: null,

      currentResult: null,
      history: [],

      activeResultTab: "dashboard",
      showNodeGraph: false,
      showWorldConfig: false,
      showPopulationConfig: false,

      // Actions
      setQuery: (query) => set({ currentQuery: query }),

      addMessage: (message) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...message,
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date().toISOString(),
            },
          ],
        })),

      clearMessages: () => set({ messages: [] }),

      setWorldConfig: (config) =>
        set((state) => ({
          worldConfig: { ...state.worldConfig, ...config },
        })),

      setPopulationConfig: (config) =>
        set((state) => ({
          populationConfig: { ...state.populationConfig, ...config },
        })),

      addHypotheticalEvent: (event) =>
        set((state) => ({
          worldConfig: {
            ...state.worldConfig,
            hypotheticalEvents: [...state.worldConfig.hypotheticalEvents, event],
          },
        })),

      removeHypotheticalEvent: (index) =>
        set((state) => ({
          worldConfig: {
            ...state.worldConfig,
            hypotheticalEvents: state.worldConfig.hypotheticalEvents.filter((_, i) => i !== index),
          },
        })),

      startResearch: (targets) =>
        set({
          isResearching: true,
          targets,
          researchProgress: 0,
        }),

      updateTargetStatus: (id, status, dataPoints) =>
        set((state) => ({
          targets: state.targets.map((t) =>
            t.id === id ? { ...t, status, ...(dataPoints !== undefined && { dataPoints }) } : t
          ),
          researchProgress:
            (state.targets.filter((t) => t.status === "complete" || (t.id === id && status === "complete")).length /
              state.targets.length) *
            100,
        })),

      completeResearch: () =>
        set({
          isResearching: false,
          researchProgress: 100,
        }),

      startExecution: (simulationId) =>
        set({
          isExecuting: true,
          isGenerating: true,
          executionProgress: 0,
          currentSimulationId: simulationId,
        }),

      updateExecutionProgress: (progress) => set({ executionProgress: progress }),

      setResult: (result) =>
        set({
          currentResult: result,
          isExecuting: false,
          isGenerating: false,
          executionProgress: 100,
        }),

      completeExecution: () =>
        set({
          isExecuting: false,
          isGenerating: false,
          executionProgress: 100,
        }),

      addToHistory: (result) =>
        set((state) => ({
          history: [result, ...state.history.filter((r) => r.id !== result.id)].slice(0, 50),
        })),

      loadFromHistory: (id) => {
        const result = get().history.find((r) => r.id === id);
        if (result) {
          set({ currentResult: result });
        }
      },

      clearHistory: () => set({ history: [] }),

      setActiveTab: (tab) => set({ activeResultTab: tab }),

      toggleNodeGraph: () => set((state) => ({ showNodeGraph: !state.showNodeGraph })),

      toggleWorldConfig: () => set((state) => ({ showWorldConfig: !state.showWorldConfig })),

      togglePopulationConfig: () => set((state) => ({ showPopulationConfig: !state.showPopulationConfig })),

      reset: () =>
        set({
          messages: [],
          currentQuery: "",
          isGenerating: false,
          isResearching: false,
          targets: [],
          researchProgress: 0,
          worldConfig: defaultWorldConfig,
          populationConfig: defaultPopulationConfig,
          isExecuting: false,
          executionProgress: 0,
          currentSimulationId: null,
          currentResult: null,
          activeResultTab: "dashboard",
          showNodeGraph: false,
          showWorldConfig: false,
          showPopulationConfig: false,
        }),
    }),
    {
      name: "rltx-simulation-store",
      partialize: (state) => ({
        history: state.history,
        worldConfig: state.worldConfig,
        populationConfig: state.populationConfig,
      }),
    }
  )
);
