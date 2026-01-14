import type { Primitive } from "@/types";

export type { Primitive };

export interface PrimitiveCategory {
  name: string;
  color: string;
}

export const primitiveCategories: Record<string, PrimitiveCategory> = {
  data: { name: "Data", color: "#3b82f6" },
  reason: { name: "Reason", color: "#8b5cf6" },
  simulate: { name: "Simulate", color: "#f59e0b" },
  human: { name: "Human", color: "#ec4899" },
  output: { name: "Output", color: "#22c55e" },
  control: { name: "Control", color: "#6b7280" },
};

export const primitives: Record<string, Primitive> = {
  // ========== DATA PRIMITIVES ==========
  "data.api.fetch": {
    id: "data.api.fetch",
    name: "API Fetch",
    description: "Connect to external REST endpoints",
    category: "data",
    icon: "Globe",
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
    description: "Define structured input parameters",
    category: "data",
    icon: "Database",
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

  "data.doc.parse": {
    id: "data.doc.parse",
    name: "Document Parse",
    description: "Extract structured data from PDF/DOCX files",
    category: "data",
    icon: "FileText",
    color: "#3b82f6",
    inputs: [{ id: "file", name: "File", type: "any", required: true }],
    outputs: [{ id: "content", name: "Content", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        extractTables: { type: "boolean", title: "Extract Tables", default: true },
        extractImages: { type: "boolean", title: "Extract Images", default: false },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 0.50 },
    estimatedTime: { p50: 5000, p95: 15000 },
  },

  "data.db.query": {
    id: "data.db.query",
    name: "Database Query",
    description: "Execute SQL queries against connected databases",
    category: "data",
    icon: "Database",
    color: "#3b82f6",
    inputs: [],
    outputs: [{ id: "results", name: "Results", type: "array", required: true }],
    config: {
      type: "object",
      properties: {
        query: { type: "string", title: "SQL Query" },
        connection: { type: "string", title: "Connection", enum: ["primary", "analytics", "warehouse"], default: "primary" },
      },
      required: ["query"],
    },
    executor: "external",
    estimatedCost: { dollars: 0.01 },
    estimatedTime: { p50: 2000, p95: 10000 },
  },

  "data.crm.salesforce": {
    id: "data.crm.salesforce",
    name: "Salesforce Query",
    description: "Query Salesforce CRM data via SOQL",
    category: "data",
    icon: "Database",
    color: "#3b82f6",
    inputs: [],
    outputs: [{ id: "records", name: "Records", type: "array", required: true }],
    config: {
      type: "object",
      properties: {
        soqlQuery: { type: "string", title: "SOQL Query" },
        objectType: { type: "string", title: "Object Type", enum: ["Account", "Contact", "Opportunity", "Lead", "Custom"], default: "Account" },
      },
      required: ["soqlQuery"],
    },
    executor: "external",
    estimatedCost: { dollars: 0.02 },
    estimatedTime: { p50: 3000, p95: 8000 },
  },

  "data.population.sample": {
    id: "data.population.sample",
    name: "Population Sample",
    description: "Sample agents from a demographic population using stratified sampling",
    category: "data",
    icon: "Users",
    color: "#3b82f6",
    inputs: [],
    outputs: [
      { id: "agents", name: "Agent Profiles", type: "array", required: true },
      { id: "archetypes", name: "Archetypes", type: "array", required: false },
      { id: "metadata", name: "Sampling Metadata", type: "object", required: true },
    ],
    config: {
      type: "object",
      properties: {
        populationId: {
          type: "string",
          title: "Population",
          enum: ["us_adults", "us_voters", "us_consumers", "enterprise_decision_makers"],
          default: "us_adults",
        },
        sampleSize: { type: "number", title: "Sample Size", default: 1000, minimum: 10, maximum: 10000 },
        useArchetypes: { type: "boolean", title: "Use Archetypes", default: true },
        archetypeCount: { type: "number", title: "Archetype Count", default: 50, minimum: 5, maximum: 200 },
        stratifyBy: { type: "string", title: "Stratify By", default: "age,income,region" },
      },
      required: ["populationId", "sampleSize"],
    },
    executor: "compute",
    estimatedCost: { dollars: 0.01 },
    estimatedTime: { p50: 500, p95: 2000 },
  },

  // ========== REASON PRIMITIVES ==========
  "reason.analyze": {
    id: "reason.analyze",
    name: "Deep Analysis",
    description: "Multi-dimensional reasoning with Claude",
    category: "reason",
    icon: "Brain",
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
    estimatedCost: { dollars: 2.50 },
    estimatedTime: { p50: 15000, p95: 45000 },
  },

  "reason.compare": {
    id: "reason.compare",
    name: "Compare Options",
    description: "Systematic multi-criteria evaluation",
    category: "reason",
    icon: "Scale",
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
    estimatedCost: { dollars: 1.50 },
    estimatedTime: { p50: 10000, p95: 30000 },
  },

  "reason.summarize": {
    id: "reason.summarize",
    name: "Summarize",
    description: "Distill insights into executive briefings",
    category: "reason",
    icon: "FileText",
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
    estimatedCost: { dollars: 0.50 },
    estimatedTime: { p50: 5000, p95: 15000 },
  },

  "reason.critique": {
    id: "reason.critique",
    name: "Pre-Mortem",
    description: "Identify failure modes before execution",
    category: "reason",
    icon: "AlertTriangle",
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
    estimatedCost: { dollars: 2.00 },
    estimatedTime: { p50: 12000, p95: 35000 },
  },

  "reason.steelman": {
    id: "reason.steelman",
    name: "Steelman",
    description: "Construct the strongest possible case",
    category: "reason",
    icon: "Shield",
    color: "#22c55e",
    inputs: [{ id: "option", name: "Option", type: "object", required: true }],
    outputs: [{ id: "case", name: "Case", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        audience: { type: "string", title: "Target Audience" },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 1.50 },
    estimatedTime: { p50: 10000, p95: 25000 },
  },

  // ========== SIMULATE PRIMITIVES ==========
  "sim.scenario": {
    id: "sim.scenario",
    name: "Scenario Analysis",
    description: "Model alternative future states",
    category: "simulate",
    icon: "GitBranch",
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
    estimatedCost: { dollars: 2.00 },
    estimatedTime: { p50: 15000, p95: 40000 },
  },

  "sim.sensitivity": {
    id: "sim.sensitivity",
    name: "Sensitivity Analysis",
    description: "Quantify variable impact on outcomes",
    category: "simulate",
    icon: "BarChart3",
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
    estimatedCost: { dollars: 1.50 },
    estimatedTime: { p50: 10000, p95: 25000 },
  },

  // ========== DEEP SIMULATION PRIMITIVES ==========
  "decompose.question": {
    id: "decompose.question",
    name: "Question Decomposition",
    description: "Structure complex queries into sub-questions",
    category: "reason",
    icon: "Network",
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
        questionTypes: { type: "string", title: "Question Types", default: "factual,causal,counterfactual" },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 1.50 },
    estimatedTime: { p50: 10000, p95: 25000 },
  },

  "sim.montecarlo.oasis": {
    id: "sim.montecarlo.oasis",
    name: "Population Simulation",
    description: "Monte Carlo with synthetic agent populations",
    category: "simulate",
    icon: "Users",
    color: "#f59e0b",
    inputs: [
      { id: "scenario", name: "Scenario", type: "object", required: true },
      { id: "distributions", name: "Input Distributions", type: "object", required: true },
    ],
    outputs: [
      { id: "outcomeDistribution", name: "Outcome Distribution", type: "object", required: true },
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
    },
    executor: "compute",
    estimatedCost: { dollars: 15.00 },
    estimatedTime: { p50: 120000, p95: 300000 },
  },

  "game.equilibrium": {
    id: "game.equilibrium",
    name: "Game Equilibrium",
    description: "Compute strategic equilibria between actors",
    category: "simulate",
    icon: "Target",
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
    estimatedCost: { dollars: 8.00 },
    estimatedTime: { p50: 60000, p95: 180000 },
  },

  "sim.abm": {
    id: "sim.abm",
    name: "Agent-Based Model",
    description: "Simulate opinion/adoption dynamics through agent interactions over time",
    category: "simulate",
    icon: "Network",
    color: "#f59e0b",
    inputs: [
      { id: "agents", name: "Agent Population", type: "array", required: true },
      { id: "initialState", name: "Initial State", type: "object", required: false },
    ],
    outputs: [
      { id: "timeseries", name: "State Over Time", type: "array", required: true },
      { id: "finalState", name: "Final State", type: "object", required: true },
      { id: "tippingPoints", name: "Tipping Points", type: "array", required: false },
    ],
    config: {
      type: "object",
      properties: {
        timeSteps: { type: "number", title: "Time Steps", default: 52, minimum: 1, maximum: 365 },
        interactionModel: {
          type: "string",
          title: "Interaction Model",
          enum: ["bass_diffusion", "threshold", "social_influence", "complex_contagion"],
          default: "bass_diffusion",
        },
        seedPercentage: { type: "number", title: "Initial Adoption %", default: 2, minimum: 0.1, maximum: 50 },
        networkTopology: {
          type: "string",
          title: "Network Topology",
          enum: ["random", "small_world", "scale_free", "spatial"],
          default: "small_world",
        },
        updateRule: {
          type: "string",
          title: "Update Rule",
          enum: ["synchronous", "asynchronous", "random_sequential"],
          default: "asynchronous",
        },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 5.00 },
    estimatedTime: { p50: 30000, p95: 90000 },
  },

  "branch.counterfactual": {
    id: "branch.counterfactual",
    name: "Counterfactual Branch",
    description: "Parallel what-if scenario exploration",
    category: "control",
    icon: "GitFork",
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
    estimatedCost: { dollars: 20.00 },
    estimatedTime: { p50: 180000, p95: 420000 },
  },

  "causal.explain": {
    id: "causal.explain",
    name: "Causal Analysis",
    description: "Trace outcome drivers through causal inference",
    category: "reason",
    icon: "Workflow",
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
    estimatedCost: { dollars: 3.00 },
    estimatedTime: { p50: 20000, p95: 45000 },
  },

  "uncertainty.aggregate": {
    id: "uncertainty.aggregate",
    name: "Uncertainty Aggregation",
    description: "Propagate confidence bounds through model",
    category: "simulate",
    icon: "TrendingUp",
    color: "#7c3aed",
    inputs: [
      { id: "distributions", name: "Input Distributions", type: "array", required: true },
      { id: "correlations", name: "Correlation Matrix", type: "object", required: false },
    ],
    outputs: [
      { id: "aggregatedDistribution", name: "Final Distribution", type: "object", required: true },
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
    estimatedCost: { dollars: 2.00 },
    estimatedTime: { p50: 15000, p95: 40000 },
  },

  // ========== OPTIMIZE PRIMITIVES ==========
  "opt.pareto": {
    id: "opt.pareto",
    name: "Pareto Optimization",
    description: "Multi-objective optimization to find efficient frontier",
    category: "simulate",
    icon: "TrendingUp",
    color: "#06b6d4",
    inputs: [
      { id: "objectives", name: "Objectives", type: "array", required: true },
      { id: "constraints", name: "Constraints", type: "object", required: false },
    ],
    outputs: [
      { id: "frontier", name: "Pareto Frontier", type: "array", required: true },
      { id: "tradeoffs", name: "Trade-off Analysis", type: "object", required: true },
    ],
    config: {
      type: "object",
      properties: {
        iterations: { type: "number", title: "Iterations", default: 1000, minimum: 100, maximum: 10000 },
        populationSize: { type: "number", title: "Population Size", default: 100, minimum: 10, maximum: 500 },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 5.00 },
    estimatedTime: { p50: 45000, p95: 120000 },
  },

  // ========== HUMAN PRIMITIVES ==========
  "human.input": {
    id: "human.input",
    name: "Human Input",
    description: "Collect structured input from user during execution",
    category: "human",
    icon: "Users",
    color: "#ec4899",
    inputs: [],
    outputs: [{ id: "response", name: "Response", type: "any", required: true }],
    config: {
      type: "object",
      properties: {
        prompt: { type: "string", title: "Prompt" },
        inputType: { type: "string", title: "Input Type", enum: ["text", "number", "select", "multiselect"], default: "text" },
        options: { type: "string", title: "Options (comma-separated)" },
        timeout: { type: "number", title: "Timeout (minutes)", default: 60, minimum: 1, maximum: 1440 },
      },
      required: ["prompt"],
    },
    executor: "human",
    estimatedCost: { dollars: 0 },
    estimatedTime: { p50: 60000, p95: 300000 },
  },

  "human.approve": {
    id: "human.approve",
    name: "Approval Gate",
    description: "Require human approval before proceeding",
    category: "human",
    icon: "Shield",
    color: "#ec4899",
    inputs: [{ id: "context", name: "Context", type: "object", required: true }],
    outputs: [
      { id: "approved", name: "Approved", type: "boolean", required: true },
      { id: "feedback", name: "Feedback", type: "string", required: false },
    ],
    config: {
      type: "object",
      properties: {
        approvers: { type: "string", title: "Approvers (comma-separated)" },
        requireAll: { type: "boolean", title: "Require All Approvers", default: false },
        timeout: { type: "number", title: "Timeout (hours)", default: 24, minimum: 1, maximum: 168 },
      },
    },
    executor: "human",
    estimatedCost: { dollars: 0 },
    estimatedTime: { p50: 3600000, p95: 86400000 },
  },

  // ========== OUTPUT PRIMITIVES ==========
  "output.recommendation": {
    id: "output.recommendation",
    name: "Recommendation",
    description: "Actionable decision with confidence score",
    category: "output",
    icon: "CheckCircle",
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
    description: "Board-ready documentation with citations",
    category: "output",
    icon: "FileStack",
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
    estimatedCost: { dollars: 1.00 },
    estimatedTime: { p50: 20000, p95: 60000 },
  },

  "output.chart": {
    id: "output.chart",
    name: "Visualization",
    description: "Generate interactive charts and visualizations",
    category: "output",
    icon: "BarChart3",
    color: "#22c55e",
    inputs: [{ id: "data", name: "Data", type: "any", required: true }],
    outputs: [{ id: "chart", name: "Chart Config", type: "object", required: true }],
    config: {
      type: "object",
      properties: {
        chartType: { type: "string", title: "Chart Type", enum: ["bar", "line", "scatter", "pie", "tornado", "sankey"], default: "bar" },
        title: { type: "string", title: "Title" },
        interactive: { type: "boolean", title: "Interactive", default: true },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 0.10 },
    estimatedTime: { p50: 2000, p95: 5000 },
  },

  // ========== CONTROL PRIMITIVES ==========
  "control.condition": {
    id: "control.condition",
    name: "Condition",
    description: "Branch execution based on condition evaluation",
    category: "control",
    icon: "GitBranch",
    color: "#6b7280",
    inputs: [{ id: "value", name: "Value", type: "any", required: true }],
    outputs: [
      { id: "true", name: "True", type: "any", required: false },
      { id: "false", name: "False", type: "any", required: false },
    ],
    config: {
      type: "object",
      properties: {
        operator: { type: "string", title: "Operator", enum: ["equals", "notEquals", "greaterThan", "lessThan", "contains", "isEmpty"], default: "equals" },
        compareValue: { type: "string", title: "Compare Value" },
      },
      required: ["operator"],
    },
    executor: "internal",
    estimatedCost: { dollars: 0 },
    estimatedTime: { p50: 10, p95: 50 },
  },

  "control.loop": {
    id: "control.loop",
    name: "Loop",
    description: "Iterate over array items and process each",
    category: "control",
    icon: "Workflow",
    color: "#6b7280",
    inputs: [{ id: "items", name: "Items", type: "array", required: true }],
    outputs: [{ id: "results", name: "Results", type: "array", required: true }],
    config: {
      type: "object",
      properties: {
        parallel: { type: "boolean", title: "Parallel Execution", default: false },
        maxConcurrency: { type: "number", title: "Max Concurrency", default: 5, minimum: 1, maximum: 20 },
      },
    },
    executor: "internal",
    estimatedCost: { dollars: 0 },
    estimatedTime: { p50: 100, p95: 500 },
  },
  "control.merge": {
    id: "control.merge",
    name: "Merge",
    description: "Consolidate multiple data streams",
    category: "control",
    icon: "Merge",
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

  // ========== DEFENSE PRIMITIVES ==========
  "defense.threat-assessment": {
    id: "defense.threat-assessment",
    name: "Threat Assessment",
    description: "Analyze adversarial capabilities, intentions, and likely courses of action",
    category: "reason",
    icon: "AlertTriangle",
    color: "#ef4444",
    inputs: [
      { id: "threat-data", name: "Threat Data", type: "object", required: true },
      { id: "context", name: "Strategic Context", type: "object", required: false },
    ],
    outputs: [
      { id: "assessment", name: "Threat Assessment", type: "object", required: true },
      { id: "indicators", name: "Warning Indicators", type: "array", required: true },
    ],
    config: {
      type: "object",
      properties: {
        threatLevel: {
          type: "string",
          title: "Initial Threat Level",
          enum: ["low", "moderate", "elevated", "high", "critical"],
          default: "moderate",
        },
        focus: {
          type: "string",
          title: "Assessment Focus",
          enum: ["capabilities", "intentions", "timeline", "vulnerabilities"],
          default: "capabilities",
        },
        domain: {
          type: "string",
          title: "Threat Domain",
          enum: ["military", "cyber", "economic", "political", "hybrid"],
          default: "military",
        },
        timeHorizon: {
          type: "string",
          title: "Time Horizon",
          enum: ["immediate", "near-term", "mid-term", "long-term"],
          default: "near-term",
        },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 3.00 },
    estimatedTime: { p50: 20000, p95: 50000 },
  },

  "defense.escalation-ladder": {
    id: "defense.escalation-ladder",
    name: "Escalation Ladder",
    description: "Model escalation dynamics and de-escalation pathways between strategic actors",
    category: "simulate",
    icon: "TrendingUp",
    color: "#f59e0b",
    inputs: [
      { id: "baseline", name: "Baseline Scenario", type: "object", required: true },
      { id: "actors", name: "Strategic Actors", type: "array", required: true },
    ],
    outputs: [
      { id: "escalation-paths", name: "Escalation Pathways", type: "array", required: true },
      { id: "risk-assessment", name: "Escalation Risk", type: "object", required: true },
      { id: "off-ramps", name: "De-escalation Options", type: "array", required: true },
    ],
    config: {
      type: "object",
      properties: {
        maxLevels: {
          type: "number",
          title: "Max Escalation Levels",
          default: 5,
          minimum: 2,
          maximum: 10,
        },
        domain: {
          type: "string",
          title: "Escalation Domain",
          enum: ["military", "cyber", "economic", "information", "hybrid"],
          default: "military",
        },
        includeNuclear: {
          type: "boolean",
          title: "Include Nuclear Scenarios",
          default: false,
        },
        thresholdAnalysis: {
          type: "boolean",
          title: "Analyze Red Lines",
          default: true,
        },
      },
    },
    executor: "compute",
    estimatedCost: { dollars: 8.00 },
    estimatedTime: { p50: 60000, p95: 150000 },
  },

  "defense.red-team": {
    id: "defense.red-team",
    name: "Red Team Analysis",
    description: "Adversarial perspective analysis to identify vulnerabilities and blind spots",
    category: "reason",
    icon: "Eye",
    color: "#ef4444",
    inputs: [
      { id: "plan", name: "Blue Force Plan", type: "object", required: true },
      { id: "context", name: "Operational Context", type: "object", required: false },
    ],
    outputs: [
      { id: "vulnerabilities", name: "Identified Vulnerabilities", type: "array", required: true },
      { id: "counter-moves", name: "Adversary Counter-Moves", type: "array", required: true },
      { id: "recommendations", name: "Hardening Recommendations", type: "object", required: true },
    ],
    config: {
      type: "object",
      properties: {
        adversaryProfile: {
          type: "string",
          title: "Adversary Profile",
          enum: ["peer_competitor", "regional_power", "non_state_actor", "cyber_threat", "insider"],
          default: "peer_competitor",
        },
        assumedCapabilities: {
          type: "string",
          title: "Assumed Capabilities",
          enum: ["limited", "moderate", "advanced", "state_of_art"],
          default: "advanced",
        },
        aggressiveness: {
          type: "string",
          title: "Adversary Aggressiveness",
          enum: ["cautious", "opportunistic", "aggressive", "desperate"],
          default: "opportunistic",
        },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 4.00 },
    estimatedTime: { p50: 25000, p95: 60000 },
  },

  "defense.course-of-action": {
    id: "defense.course-of-action",
    name: "Course of Action",
    description: "Generate and evaluate military/strategic courses of action",
    category: "output",
    icon: "Target",
    color: "#06b6d4",
    inputs: [
      { id: "analysis", name: "Situation Analysis", type: "object", required: true },
      { id: "constraints", name: "Constraints & Rules", type: "object", required: false },
      { id: "objectives", name: "Strategic Objectives", type: "array", required: true },
    ],
    outputs: [
      { id: "courses", name: "Courses of Action", type: "array", required: true },
      { id: "recommendation", name: "Recommended COA", type: "object", required: true },
      { id: "comparison", name: "COA Comparison Matrix", type: "object", required: true },
    ],
    config: {
      type: "object",
      properties: {
        maxCourses: {
          type: "number",
          title: "Number of COAs",
          default: 3,
          minimum: 2,
          maximum: 5,
        },
        evaluationCriteria: {
          type: "string",
          title: "Evaluation Criteria",
          default: "feasibility,acceptability,suitability,distinguishability",
        },
        includeRisks: {
          type: "boolean",
          title: "Include Risk Assessment",
          default: true,
        },
        format: {
          type: "string",
          title: "Output Format",
          enum: ["military", "policy", "executive"],
          default: "military",
        },
      },
    },
    executor: "llm",
    estimatedCost: { dollars: 5.00 },
    estimatedTime: { p50: 30000, p95: 75000 },
  },
};

export function getPrimitivesByCategory(): Record<string, Primitive[]> {
  const categories: Record<string, Primitive[]> = {};

  Object.values(primitives).forEach((primitive) => {
    if (!categories[primitive.category]) {
      categories[primitive.category] = [];
    }
    categories[primitive.category].push(primitive);
  });

  return categories;
}

export function getPrimitive(id: string): Primitive | undefined {
  return primitives[id];
}

export const categoryLabels: Record<string, string> = {
  data: "Data",
  reason: "Reason",
  simulate: "Simulate",
  optimize: "Optimize",
  human: "Human",
  output: "Output",
  control: "Control",
};

export const categoryColors: Record<string, string> = {
  data: "#3b82f6",
  reason: "#8b5cf6",
  simulate: "#f59e0b",
  optimize: "#06b6d4",
  human: "#ec4899",
  output: "#22c55e",
  control: "#6b7280",
};
