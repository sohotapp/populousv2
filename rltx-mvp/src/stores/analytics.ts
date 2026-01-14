import { create } from "zustand";

// Data point for sparklines
export interface DataPoint {
  date: string;
  value: number;
}

// Analytics metrics
export interface AnalyticsMetrics {
  // Execution metrics
  totalRuns: number;
  runsChange: number; // Percentage change from previous period
  runsHistory: DataPoint[];

  successRate: number;
  successRateChange: number;
  successHistory: DataPoint[];

  avgExecutionTime: number; // in seconds
  avgTimeChange: number;
  timeHistory: DataPoint[];

  // Cost metrics
  totalCost: number;
  costChange: number;
  costHistory: DataPoint[];

  // Usage metrics
  mostUsedPrimitives: { name: string; count: number }[];
  peakHours: { hour: number; count: number }[];

  // Recent activity
  recentExecutions: RecentExecution[];

  // === NEW: Decision Quality Metrics ===
  decisionQuality: {
    avgConfidence: number;
    confidenceDistribution: { bucket: string; count: number }[];
    highConfidenceRate: number; // % of decisions with confidence > 0.8
  };

  // === NEW: Uncertainty Analysis ===
  uncertaintyAnalysis: {
    avgUncertainty: number;
    epistemicRatio: number; // % epistemic vs aleatory
    aleatoryRatio: number;
    highUncertaintyDecisions: number;
  };

  // === NEW: Model Tier Usage ===
  modelTierUsage: {
    haiku: { count: number; cost: number };
    sonnet: { count: number; cost: number };
    opus: { count: number; cost: number };
  };

  // === NEW: Simulation Insights ===
  simulationInsights: {
    totalSimulations: number;
    equilibriumRate: number; // % that converged
    avgRoundsToConverge: number;
    avgAgentsPerSim: number;
  };

  // === NEW: Causal Drivers ===
  topCausalDrivers: {
    variable: string;
    avgEffect: number;
    frequency: number;
  }[];

  // === NEW: Primitive Performance ===
  primitivePerformance: {
    name: string;
    avgTime: number;
    count: number;
    successRate: number;
  }[];

  // === NEW: Cost Efficiency ===
  costEfficiency: {
    costPerDecision: number;
    costPerSuccessfulDecision: number;
    costTrend: DataPoint[];
  };
}

export interface RecentExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  duration?: number;
  cost?: number;
}

interface AnalyticsState {
  metrics: AnalyticsMetrics | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;

  // Actions
  fetchMetrics: (period?: number) => Promise<void>;
  setMetrics: (metrics: AnalyticsMetrics) => void;
  updateRecentExecution: (execution: RecentExecution) => void;
  addRecentExecution: (execution: RecentExecution) => void;
}

// Generate mock data for development
function generateMockMetrics(): AnalyticsMetrics {
  const generateHistory = (baseValue: number, variance: number): DataPoint[] => {
    const points: DataPoint[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      points.push({
        date: date.toISOString().split("T")[0],
        value: Math.max(0, baseValue + (Math.random() - 0.5) * variance * 2),
      });
    }
    return points;
  };

  return {
    totalRuns: 47,
    runsChange: 12,
    runsHistory: generateHistory(3, 2),

    successRate: 94,
    successRateChange: 2,
    successHistory: generateHistory(90, 10),

    avgExecutionTime: 12.4,
    avgTimeChange: -8,
    timeHistory: generateHistory(12, 5),

    totalCost: 47.2,
    costChange: 15,
    costHistory: generateHistory(3, 2),

    mostUsedPrimitives: [
      { name: "Deep Analysis", count: 34 },
      { name: "Monte Carlo", count: 28 },
      { name: "Scenario Analysis", count: 22 },
      { name: "Compare Options", count: 18 },
      { name: "API Fetch", count: 15 },
    ],

    peakHours: [
      { hour: 9, count: 12 },
      { hour: 10, count: 18 },
      { hour: 11, count: 15 },
      { hour: 14, count: 22 },
      { hour: 15, count: 19 },
      { hour: 16, count: 14 },
    ],

    recentExecutions: [
      {
        id: "exec-1",
        workflowId: "wf-1",
        workflowName: "Market Expansion Analysis",
        status: "completed",
        startedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        completedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        duration: 15 * 60,
        cost: 2.45,
      },
      {
        id: "exec-2",
        workflowId: "wf-2",
        workflowName: "Pricing Strategy",
        status: "running",
        startedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      },
      {
        id: "exec-3",
        workflowId: "wf-3",
        workflowName: "Competitor Analysis",
        status: "completed",
        startedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        completedAt: new Date(Date.now() - 1000 * 60 * 60 * 1.5).toISOString(),
        duration: 30 * 60,
        cost: 4.12,
      },
      {
        id: "exec-4",
        workflowId: "wf-4",
        workflowName: "Investment Decision",
        status: "failed",
        startedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
        completedAt: new Date(Date.now() - 1000 * 60 * 60 * 2.8).toISOString(),
        duration: 12 * 60,
      },
    ],

    // Decision quality metrics
    decisionQuality: {
      avgConfidence: 0.78,
      confidenceDistribution: [
        { bucket: "0-0.2", count: 2 },
        { bucket: "0.2-0.4", count: 5 },
        { bucket: "0.4-0.6", count: 12 },
        { bucket: "0.6-0.8", count: 18 },
        { bucket: "0.8-1.0", count: 10 },
      ],
      highConfidenceRate: 0.21,
    },

    // Uncertainty analysis
    uncertaintyAnalysis: {
      avgUncertainty: 0.32,
      epistemicRatio: 0.45,
      aleatoryRatio: 0.55,
      highUncertaintyDecisions: 8,
    },

    // Model tier usage
    modelTierUsage: {
      haiku: { count: 124, cost: 4.2 },
      sonnet: { count: 78, cost: 18.5 },
      opus: { count: 12, cost: 24.5 },
    },

    // Simulation insights
    simulationInsights: {
      totalSimulations: 23,
      equilibriumRate: 0.87,
      avgRoundsToConverge: 4.2,
      avgAgentsPerSim: 3.5,
    },

    // Top causal drivers
    topCausalDrivers: [
      { variable: "Market Size", avgEffect: 0.42, frequency: 18 },
      { variable: "Competitor Response", avgEffect: 0.35, frequency: 15 },
      { variable: "Price Elasticity", avgEffect: 0.28, frequency: 12 },
      { variable: "Regulatory Risk", avgEffect: 0.22, frequency: 9 },
    ],

    // Primitive performance
    primitivePerformance: [
      { name: "reason.analyze", avgTime: 8.2, count: 34, successRate: 0.97 },
      { name: "sim.montecarlo.oasis", avgTime: 45.3, count: 28, successRate: 0.89 },
      { name: "game.equilibrium", avgTime: 32.1, count: 22, successRate: 0.91 },
      { name: "reason.compare", avgTime: 5.4, count: 18, successRate: 0.98 },
    ],

    // Cost efficiency
    costEfficiency: {
      costPerDecision: 1.02,
      costPerSuccessfulDecision: 1.08,
      costTrend: generateHistory(1, 0.3),
    },
  };
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  metrics: null,
  isLoading: false,
  error: null,
  lastUpdated: null,

  fetchMetrics: async (period: number = 14) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/analytics?period=${period}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status}`);
      }

      const metrics: AnalyticsMetrics = await response.json();

      set({
        metrics,
        isLoading: false,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Analytics fetch error:", error);
      set({
        error: error instanceof Error ? error.message : "Failed to fetch analytics",
        isLoading: false,
      });
    }
  },

  setMetrics: (metrics) => {
    set({ metrics, lastUpdated: new Date().toISOString() });
  },

  updateRecentExecution: (execution) => {
    const state = get();
    if (!state.metrics) return;

    const updatedExecutions = state.metrics.recentExecutions.map((e) =>
      e.id === execution.id ? execution : e
    );

    set({
      metrics: {
        ...state.metrics,
        recentExecutions: updatedExecutions,
      },
    });
  },

  addRecentExecution: (execution) => {
    const state = get();
    if (!state.metrics) return;

    set({
      metrics: {
        ...state.metrics,
        recentExecutions: [execution, ...state.metrics.recentExecutions.slice(0, 9)],
      },
    });
  },
}));
