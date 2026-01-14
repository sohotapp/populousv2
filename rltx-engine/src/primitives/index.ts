import type { Primitive } from "../types/index.js";

export const primitives: Record<string, Primitive> = {
  // ========== DATA PRIMITIVES ==========
  "data.api.fetch": {
    id: "data.api.fetch",
    name: "API Fetch",
    description: "Fetch data from REST API",
    category: "data",
    icon: "link",
    color: "#3b82f6",
    inputs: [],
    outputs: [{ id: "response", name: "Response", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        url: { type: "string", title: "URL", description: "API endpoint URL" },
        method: { type: "string", title: "Method", enum: ["GET", "POST"], default: "GET" },
      },
      required: ["url"],
    },
    executor: "external",
    estimatedCost: { dollars: 0.01 },
    estimatedTime: { p50: 1000, p95: 5000 },
  },

  "data.input": {
    id: "data.input",
    name: "Data Input",
    description: "Manual data entry point",
    category: "data",
    icon: "input",
    color: "#3b82f6",
    inputs: [],
    outputs: [{ id: "data", name: "Data", type: "any", required: true }],
    config: {
      type: "object",
      properties: {
        dataType: { type: "string", title: "Data Type", enum: ["text", "number", "json"], default: "text" },
        value: { type: "string", title: "Value" },
      },
    },
    executor: "internal",
    estimatedCost: { dollars: 0 },
    estimatedTime: { p50: 10, p95: 50 },
  },

  // ========== REASON PRIMITIVES ==========
  "reason.analyze": {
    id: "reason.analyze",
    name: "Deep Analysis",
    description: "Use Claude for complex reasoning and analysis",
    category: "reason",
    icon: "brain",
    color: "#8b5cf6",
    inputs: [
      { id: "data", name: "Data", type: "any", required: true },
      { id: "context", name: "Context", type: "string", required: false },
    ],
    outputs: [{ id: "analysis", name: "Analysis", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        prompt: { type: "string", title: "Analysis Prompt", description: "What to analyze" },
        focus: { type: "string", title: "Focus Area" },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 2.5 },
    estimatedTime: { p50: 15000, p95: 45000 },
  },

  "reason.compare": {
    id: "reason.compare",
    name: "Compare Options",
    description: "Compare multiple options with pros and cons",
    category: "reason",
    icon: "scale",
    color: "#8b5cf6",
    inputs: [{ id: "options", name: "Options", type: "array", required: true }],
    outputs: [{ id: "comparison", name: "Comparison", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        criteria: { type: "string", title: "Comparison Criteria" },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 1.5 },
    estimatedTime: { p50: 10000, p95: 30000 },
  },

  "reason.summarize": {
    id: "reason.summarize",
    name: "Summarize",
    description: "Create a concise summary of content",
    category: "reason",
    icon: "text",
    color: "#8b5cf6",
    inputs: [{ id: "content", name: "Content", type: "any", required: true }],
    outputs: [{ id: "summary", name: "Summary", type: "string", required: true }],
    config: {
      type: "object",
      properties: {
        length: { type: "string", title: "Length", enum: ["brief", "medium", "detailed"], default: "medium" },
        style: { type: "string", title: "Style", enum: ["bullets", "paragraph", "executive"], default: "paragraph" },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 0.5 },
    estimatedTime: { p50: 5000, p95: 15000 },
  },

  "reason.critique": {
    id: "reason.critique",
    name: "Pre-Mortem",
    description: "Analyze what could go wrong with a plan",
    category: "reason",
    icon: "search",
    color: "#ef4444",
    inputs: [{ id: "plan", name: "Plan", type: "object", required: true }],
    outputs: [{ id: "critique", name: "Critique", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        perspective: { type: "string", title: "Perspective", enum: ["skeptic", "competitor", "regulator"], default: "skeptic" },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 2.0 },
    estimatedTime: { p50: 12000, p95: 35000 },
  },

  // ========== NEW SIMULATION PRIMITIVES ==========
  "decompose.question": {
    id: "decompose.question",
    name: "Question Decomposition",
    description: "Break complex question into analyzable sub-questions",
    category: "reason",
    icon: "split",
    color: "#8b5cf6",
    inputs: [
      { id: "question", name: "Main Question", type: "string", required: true },
      { id: "context", name: "Context", type: "object", required: false },
    ],
    outputs: [
      { id: "subQuestions", name: "Sub-Questions", type: "array", required: true },
      { id: "dependencies", name: "Dependencies", type: "object", required: true },
    ],
    config: {
      type: "object",
      properties: {
        maxDepth: { type: "number", title: "Max Decomposition Depth", default: 2 },
        questionTypes: {
          type: "string",
          title: "Question Types",
          default: "factual,causal,counterfactual,normative",
        },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 1.5 },
    estimatedTime: { p50: 10000, p95: 25000 },
  },

  "sim.montecarlo.oasis": {
    id: "sim.montecarlo.oasis",
    name: "Population Simulation",
    description: "Run Monte Carlo with LLM-powered agent populations",
    category: "simulate",
    icon: "dice",
    color: "#f59e0b",
    inputs: [
      { id: "scenario", name: "Scenario", type: "object", required: true },
      { id: "distributions", name: "Input Distributions", type: "object", required: true },
    ],
    outputs: [
      { id: "outcomeDistribution", name: "Outcome Distribution", type: "distribution", required: true },
      { id: "samples", name: "Raw Samples", type: "array", required: true },
    ],
    config: {
      type: "object",
      properties: {
        populationSize: { type: "number", title: "Agent Population", default: 1000, minimum: 100, maximum: 100000 },
        rollouts: { type: "number", title: "Simulation Runs", default: 1000, minimum: 100, maximum: 10000 },
        domain: { type: "string", title: "Domain", enum: ["enterprise", "defense", "consumer"], default: "enterprise" },
        llmAgentRatio: { type: "number", title: "LLM Agent Ratio", default: 0.1, minimum: 0.01, maximum: 1.0 },
      },
      required: ["populationSize", "rollouts"],
    },
    executor: "compute",
    estimatedCost: { dollars: 15.0 },
    estimatedTime: { p50: 120000, p95: 300000 },
  },

  "sim.scenario": {
    id: "sim.scenario",
    name: "Scenario Analysis",
    description: "Generate and evaluate multiple scenarios",
    category: "simulate",
    icon: "tree",
    color: "#f59e0b",
    inputs: [{ id: "baseCase", name: "Base Case", type: "object", required: true }],
    outputs: [{ id: "scenarios", name: "Scenarios", type: "array", required: true }],
    config: {
      type: "object",
      properties: {
        count: { type: "number", title: "Number of Scenarios", default: 3, minimum: 2, maximum: 5 },
        includeWorstCase: { type: "boolean", title: "Include Worst Case", default: true },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 2.0 },
    estimatedTime: { p50: 15000, p95: 40000 },
  },

  "sim.sensitivity": {
    id: "sim.sensitivity",
    name: "Sensitivity Analysis",
    description: "Find key drivers that affect outcomes",
    category: "simulate",
    icon: "chart",
    color: "#f59e0b",
    inputs: [{ id: "model", name: "Model", type: "object", required: true }],
    outputs: [{ id: "drivers", name: "Drivers", type: "array", required: true }],
    config: {
      type: "object",
      properties: {
        range: { type: "number", title: "Variation Range (%)", default: 20, minimum: 5, maximum: 50 },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 1.5 },
    estimatedTime: { p50: 10000, p95: 25000 },
  },

  "game.equilibrium": {
    id: "game.equilibrium",
    name: "Game Equilibrium",
    description: "Find strategic equilibrium among multiple actors",
    category: "simulate",
    icon: "target",
    color: "#06b6d4",
    inputs: [
      { id: "players", name: "Players", type: "array", required: true },
      { id: "payoffs", name: "Payoff Data", type: "object", required: true },
    ],
    outputs: [
      { id: "equilibrium", name: "Equilibrium", type: "object", required: true },
      { id: "strategies", name: "Optimal Strategies", type: "object", required: true },
    ],
    config: {
      type: "object",
      properties: {
        equilibriumType: { type: "string", title: "Equilibrium Type", enum: ["nash", "correlated", "stackelberg"], default: "nash" },
        useAgentNegotiation: { type: "boolean", title: "Use AI Agent Negotiation", default: true },
        maxIterations: { type: "number", title: "Max Iterations", default: 100 },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 8.0 },
    estimatedTime: { p50: 60000, p95: 180000 },
  },

  "branch.counterfactual": {
    id: "branch.counterfactual",
    name: "Counterfactual Branch",
    description: "Explore what-if scenarios in parallel",
    category: "control",
    icon: "branch",
    color: "#10b981",
    inputs: [
      { id: "baseScenario", name: "Base Scenario", type: "object", required: true },
      { id: "results", name: "Base Results", type: "object", required: true },
    ],
    outputs: [
      { id: "branches", name: "Branch Results", type: "array", required: true },
      { id: "comparison", name: "Branch Comparison", type: "object", required: true },
    ],
    config: {
      type: "object",
      properties: {
        branches: { type: "string", title: "Branch Definitions (JSON)", default: "[]" },
        parallelExecution: { type: "boolean", title: "Run Branches in Parallel", default: true },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 20.0 },
    estimatedTime: { p50: 180000, p95: 420000 },
  },

  "causal.explain": {
    id: "causal.explain",
    name: "Causal Analysis",
    description: "Trace why outcomes happened through causal inference",
    category: "reason",
    icon: "link",
    color: "#f43f5e",
    inputs: [
      { id: "simulationResults", name: "Simulation Results", type: "object", required: true },
      { id: "variables", name: "Variables of Interest", type: "array", required: true },
    ],
    outputs: [
      { id: "causalGraph", name: "Causal Graph", type: "object", required: true },
      { id: "effects", name: "Causal Effects", type: "array", required: true },
      { id: "sensitivity", name: "Sensitivity Analysis", type: "object", required: true },
    ],
    config: {
      type: "object",
      properties: {
        method: { type: "string", title: "Inference Method", enum: ["regression", "do-calculus", "llm-reasoning"], default: "llm-reasoning" },
        includeTornadoChart: { type: "boolean", title: "Generate Tornado Chart", default: true },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 3.0 },
    estimatedTime: { p50: 20000, p95: 45000 },
  },

  "uncertainty.aggregate": {
    id: "uncertainty.aggregate",
    name: "Uncertainty Aggregation",
    description: "Propagate and combine uncertainties through the DAG",
    category: "simulate",
    icon: "chart-bar",
    color: "#7c3aed",
    inputs: [
      { id: "distributions", name: "Input Distributions", type: "array", required: true },
      { id: "correlations", name: "Correlation Matrix", type: "object", required: false },
    ],
    outputs: [
      { id: "aggregatedDistribution", name: "Final Distribution", type: "distribution", required: true },
      { id: "uncertaintyBreakdown", name: "Uncertainty Breakdown", type: "object", required: true },
    ],
    config: {
      type: "object",
      properties: {
        aggregationMethod: { type: "string", title: "Method", enum: ["monte-carlo-propagation", "analytical", "moment-matching"], default: "monte-carlo-propagation" },
        separateEpistemic: { type: "boolean", title: "Separate Epistemic vs Aleatory", default: true },
        calibrationAdjustment: { type: "boolean", title: "Apply Historical Calibration", default: true },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 2.0 },
    estimatedTime: { p50: 15000, p95: 40000 },
  },

  // ========== OUTPUT PRIMITIVES ==========
  "output.recommendation": {
    id: "output.recommendation",
    name: "Recommendation",
    description: "Generate final recommendation with confidence",
    category: "output",
    icon: "target",
    color: "#22c55e",
    inputs: [{ id: "analysis", name: "Analysis", type: "object", required: true }],
    outputs: [{ id: "recommendation", name: "Recommendation", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        style: { type: "string", title: "Style", enum: ["bluf", "detailed"], default: "bluf" },
        includeConfidence: { type: "boolean", title: "Include Confidence", default: true },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 0.75 },
    estimatedTime: { p50: 8000, p95: 20000 },
  },

  "output.report": {
    id: "output.report",
    name: "Evidence Pack",
    description: "Generate board-ready report document",
    category: "output",
    icon: "file",
    color: "#22c55e",
    inputs: [
      { id: "recommendation", name: "Recommendation", type: "object", required: true },
      { id: "evidence", name: "Evidence", type: "array", required: false },
    ],
    outputs: [{ id: "report", name: "Report", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        format: { type: "string", title: "Format", enum: ["executive", "detailed"], default: "executive" },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 1.0 },
    estimatedTime: { p50: 20000, p95: 60000 },
  },

  // ========== CONTROL PRIMITIVES ==========
  "control.merge": {
    id: "control.merge",
    name: "Merge",
    description: "Combine multiple inputs into one",
    category: "control",
    icon: "merge",
    color: "#6b7280",
    inputs: [
      { id: "input1", name: "Input 1", type: "any", required: true },
      { id: "input2", name: "Input 2", type: "any", required: false },
      { id: "input3", name: "Input 3", type: "any", required: false },
    ],
    outputs: [{ id: "merged", name: "Merged", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        strategy: { type: "string", title: "Merge Strategy", enum: ["object", "array"], default: "object" },
      },
    },
    executor: "internal",
    estimatedCost: { dollars: 0 },
    estimatedTime: { p50: 10, p95: 50 },
  },
};

export function getPrimitive(id: string): Primitive | undefined {
  return primitives[id];
}

export function getPrimitivesByCategory(): Record<string, Primitive[]> {
  const categories: Record<string, Primitive[]> = {};
  for (const primitive of Object.values(primitives)) {
    if (!categories[primitive.category]) {
      categories[primitive.category] = [];
    }
    categories[primitive.category].push(primitive);
  }
  return categories;
}
