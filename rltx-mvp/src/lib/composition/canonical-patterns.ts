/**
 * Canonical Workflow Patterns for RLTX
 *
 * These 6 patterns cover the majority of behavioral simulation use cases.
 * The composition layer detects which pattern applies and parameterizes it
 * rather than generating workflows from scratch.
 */

export interface PatternConfig {
  // User-provided context
  context: Record<string, unknown>;
  // Pattern-specific parameters
  params: Record<string, unknown>;
}

export interface PatternTemplate {
  id: string;
  name: string;
  description: string;
  domain: "enterprise" | "defense" | "policy" | "general";
  triggerPhrases: string[];
  structure: {
    nodes: Array<{
      primitiveId: string;
      label: string;
      configTemplate: Record<string, unknown>;
    }>;
    edges: Array<{ source: number; target: number }>;
  };
  parameterSchema: {
    required: string[];
    optional: string[];
    examples: Record<string, unknown>;
  };
}

/**
 * PATTERN 1: Consumer Survey
 * "Would customers buy X?", "What percent would Y?", "How do people feel about Z?"
 *
 * Flow: sample population → monte_carlo agent survey → segment analysis
 */
export const CONSUMER_SURVEY: PatternTemplate = {
  id: "consumer_survey",
  name: "Consumer Survey Simulation",
  description: "Simulate how a population would respond to a product, price, feature, or policy change",
  domain: "enterprise",
  triggerPhrases: [
    "would customers",
    "what percent",
    "how many would",
    "how do people",
    "consumer response",
    "customer willingness",
    "would users",
    "market acceptance",
    "adoption rate",
  ],
  structure: {
    nodes: [
      {
        primitiveId: "data.input",
        label: "Survey Context",
        configTemplate: { dataType: "json" },
      },
      {
        primitiveId: "data.population.sample",
        label: "Sample Population",
        configTemplate: {
          populationId: "{{populationId}}",
          sampleSize: "{{sampleSize}}",
          useArchetypes: true,
        },
      },
      {
        primitiveId: "sim.montecarlo.oasis",
        label: "Survey Simulation",
        configTemplate: {
          rollouts: "{{rollouts}}",
          question: "{{question}}",
          responseFormat: "{{responseFormat}}",
        },
      },
      {
        primitiveId: "reason.analyze",
        label: "Segment Analysis",
        configTemplate: {
          focus: "demographic segments, willingness drivers, barriers",
        },
      },
      {
        primitiveId: "output.report",
        label: "Survey Results",
        configTemplate: {
          format: "detailed",
          includeSegments: true,
        },
      },
    ],
    edges: [
      { source: 0, target: 1 },
      { source: 1, target: 2 },
      { source: 2, target: 3 },
      { source: 3, target: 4 },
    ],
  },
  parameterSchema: {
    required: ["question", "populationId"],
    optional: ["sampleSize", "rollouts", "responseFormat", "segments"],
    examples: {
      question: "Would you subscribe to a premium feature for $15/month?",
      populationId: "us_consumers",
      sampleSize: 1000,
      rollouts: 100,
      responseFormat: "yes_no_maybe",
    },
  },
};

/**
 * PATTERN 2: Change Impact Analysis
 * "What if we change X?", "Impact of Y", "Effect of Z on behavior"
 *
 * Flow: sample → generate scenarios → monte_carlo × N → compare outcomes
 */
export const CHANGE_IMPACT: PatternTemplate = {
  id: "change_impact",
  name: "Change Impact Analysis",
  description: "Analyze how a change (price, policy, feature) affects population behavior across scenarios",
  domain: "enterprise",
  triggerPhrases: [
    "what if we",
    "impact of",
    "effect of",
    "how would changing",
    "if we increase",
    "if we decrease",
    "sensitivity to",
    "price elasticity",
    "behavior change",
  ],
  structure: {
    nodes: [
      {
        primitiveId: "data.input",
        label: "Change Context",
        configTemplate: { dataType: "json" },
      },
      {
        primitiveId: "data.population.sample",
        label: "Sample Population",
        configTemplate: {
          populationId: "{{populationId}}",
          sampleSize: "{{sampleSize}}",
          useArchetypes: true,
        },
      },
      {
        primitiveId: "sim.scenario",
        label: "Generate Scenarios",
        configTemplate: {
          count: "{{scenarioCount}}",
          baseVariable: "{{changeVariable}}",
          range: "{{changeRange}}",
        },
      },
      {
        primitiveId: "branch.counterfactual",
        label: "Parallel Simulations",
        configTemplate: { parallelExecution: true },
      },
      {
        primitiveId: "sim.montecarlo.oasis",
        label: "Behavior Simulation",
        configTemplate: {
          rollouts: "{{rollouts}}",
          question: "{{question}}",
        },
      },
      {
        primitiveId: "control.merge",
        label: "Combine Results",
        configTemplate: { strategy: "object" },
      },
      {
        primitiveId: "reason.compare",
        label: "Impact Comparison",
        configTemplate: {
          criteria: "adoption rate, revenue impact, segment shifts",
        },
      },
      {
        primitiveId: "output.chart",
        label: "Impact Visualization",
        configTemplate: {
          chartType: "sensitivity",
          interactive: true,
        },
      },
    ],
    edges: [
      { source: 0, target: 1 },
      { source: 0, target: 2 },
      { source: 1, target: 3 },
      { source: 2, target: 3 },
      { source: 3, target: 4 },
      { source: 4, target: 5 },
      { source: 5, target: 6 },
      { source: 6, target: 7 },
    ],
  },
  parameterSchema: {
    required: ["changeVariable", "question", "populationId"],
    optional: ["scenarioCount", "changeRange", "sampleSize", "rollouts"],
    examples: {
      changeVariable: "price",
      question: "Would you subscribe at this price point?",
      populationId: "us_consumers",
      scenarioCount: 5,
      changeRange: [-30, -15, 0, 15, 30],
    },
  },
};

/**
 * PATTERN 3: Competitive Response
 * "How will competitors respond?", "Competitive dynamics", "Market response"
 *
 * Flow: game_theory equilibrium → scenario planning → monte_carlo customer impact → merge
 */
export const COMPETITIVE_RESPONSE: PatternTemplate = {
  id: "competitive_response",
  name: "Competitive Response Analysis",
  description: "Model how competitors will respond to your move and how customers react to the resulting market",
  domain: "enterprise",
  triggerPhrases: [
    "competitor",
    "how will they respond",
    "competitive response",
    "competitive dynamics",
    "market dynamics",
    "pricing war",
    "competitive reaction",
    "rival",
    "market share battle",
  ],
  structure: {
    nodes: [
      {
        primitiveId: "data.input",
        label: "Competitive Context",
        configTemplate: { dataType: "json" },
      },
      {
        primitiveId: "game.equilibrium",
        label: "Competitor Equilibrium",
        configTemplate: {
          equilibriumType: "nash",
          actors: "{{actors}}",
          useAgentNegotiation: true,
        },
      },
      {
        primitiveId: "sim.scenario",
        label: "Market Scenarios",
        configTemplate: {
          count: "{{scenarioCount}}",
          includeWorstCase: true,
        },
      },
      {
        primitiveId: "data.population.sample",
        label: "Sample Customers",
        configTemplate: {
          populationId: "{{populationId}}",
          sampleSize: "{{sampleSize}}",
        },
      },
      {
        primitiveId: "branch.counterfactual",
        label: "Scenario Branches",
        configTemplate: { parallelExecution: true },
      },
      {
        primitiveId: "sim.montecarlo.oasis",
        label: "Customer Response",
        configTemplate: {
          rollouts: "{{rollouts}}",
          question: "{{customerQuestion}}",
        },
      },
      {
        primitiveId: "control.merge",
        label: "Consolidate Outcomes",
        configTemplate: { strategy: "object" },
      },
      {
        primitiveId: "reason.analyze",
        label: "Strategic Analysis",
        configTemplate: {
          focus: "optimal strategy, risk factors, timing",
        },
      },
      {
        primitiveId: "output.recommendation",
        label: "Strategic Recommendation",
        configTemplate: {
          style: "bluf",
          includeConfidence: true,
        },
      },
    ],
    edges: [
      { source: 0, target: 1 },
      { source: 0, target: 3 },
      { source: 1, target: 2 },
      { source: 2, target: 4 },
      { source: 3, target: 4 },
      { source: 4, target: 5 },
      { source: 5, target: 6 },
      { source: 6, target: 7 },
      { source: 7, target: 8 },
    ],
  },
  parameterSchema: {
    required: ["actors", "customerQuestion"],
    optional: ["populationId", "scenarioCount", "sampleSize", "rollouts"],
    examples: {
      actors: [
        { name: "Our Company", role: "market leader", objectives: ["maintain share"] },
        { name: "Competitor A", role: "challenger", objectives: ["grow share"] },
      ],
      customerQuestion: "Which provider would you choose given these options?",
      populationId: "enterprise_decision_makers",
    },
  },
};

/**
 * PATTERN 4: Wargame / Adversarial Simulation
 * "Adversary behavior", "Nation state response", "Escalation dynamics"
 *
 * Flow: define strategic actors → game_theory simulation → analysis
 */
export const WARGAME: PatternTemplate = {
  id: "wargame",
  name: "Strategic Wargame",
  description: "Simulate adversarial dynamics between strategic actors (nations, organizations, threat actors)",
  domain: "defense",
  triggerPhrases: [
    "adversary",
    "nation state",
    "escalation",
    "deterrence",
    "wargame",
    "conflict",
    "geopolitical",
    "military",
    "threat actor",
    "red team",
  ],
  structure: {
    nodes: [
      {
        primitiveId: "data.input",
        label: "Strategic Context",
        configTemplate: { dataType: "json" },
      },
      {
        primitiveId: "game.equilibrium",
        label: "Strategic Simulation",
        configTemplate: {
          equilibriumType: "nash",
          domain: "defense",
          actors: "{{actors}}",
          maxRounds: "{{maxRounds}}",
          useAgentNegotiation: true,
        },
      },
      {
        primitiveId: "reason.analyze",
        label: "Equilibrium Analysis",
        configTemplate: {
          focus: "stability, escalation risk, off-ramps",
        },
      },
      {
        primitiveId: "sim.scenario",
        label: "Escalation Scenarios",
        configTemplate: {
          count: 4,
          includeWorstCase: true,
        },
      },
      {
        primitiveId: "reason.critique",
        label: "Red Team Analysis",
        configTemplate: {
          perspective: "adversary",
        },
      },
      {
        primitiveId: "control.merge",
        label: "Consolidate Analysis",
        configTemplate: { strategy: "object" },
      },
      {
        primitiveId: "output.report",
        label: "Strategic Assessment",
        configTemplate: {
          format: "detailed",
          classification: "{{classification}}",
        },
      },
    ],
    edges: [
      { source: 0, target: 1 },
      { source: 1, target: 2 },
      { source: 1, target: 3 },
      { source: 2, target: 5 },
      { source: 3, target: 4 },
      { source: 4, target: 5 },
      { source: 5, target: 6 },
    ],
  },
  parameterSchema: {
    required: ["actors", "scenario"],
    optional: ["maxRounds", "classification", "constraints"],
    examples: {
      actors: [
        { name: "Blue Force", role: "defender", objectives: ["maintain stability", "deter aggression"] },
        { name: "Red Force", role: "adversary", objectives: ["expand influence", "test resolve"] },
      ],
      scenario: "Regional tension over disputed territory",
      maxRounds: 5,
    },
  },
};

/**
 * PATTERN 4B: Deterrence Analysis
 * "Deterrence credibility", "Coercion", "Signaling", "Extended deterrence"
 *
 * Flow: threat assessment → credibility analysis → adversary calculus → escalation modeling → course of action
 */
export const DETERRENCE_ANALYSIS: PatternTemplate = {
  id: "deterrence_analysis",
  name: "Deterrence Analysis",
  description: "Analyze deterrence effectiveness, credibility of threats, and adversary decision calculus",
  domain: "defense",
  triggerPhrases: [
    "deterrence",
    "credibility",
    "coercion",
    "signaling",
    "extended deterrence",
    "nuclear deterrence",
    "conventional deterrence",
    "compellence",
    "reassurance",
    "commitment",
    "resolve",
  ],
  structure: {
    nodes: [
      {
        primitiveId: "data.input",
        label: "Deterrence Context",
        configTemplate: { dataType: "json" },
      },
      {
        primitiveId: "defense.threat-assessment",
        label: "Threat Assessment",
        configTemplate: {
          threatLevel: "{{threatLevel}}",
          focus: "capabilities",
          domain: "{{domain}}",
        },
      },
      {
        primitiveId: "reason.analyze",
        label: "Credibility Analysis",
        configTemplate: {
          focus: "signaling effectiveness, commitment mechanisms, reputation effects",
        },
      },
      {
        primitiveId: "game.equilibrium",
        label: "Adversary Decision Calculus",
        configTemplate: {
          equilibriumType: "nash",
          actors: "{{actors}}",
          useAgentNegotiation: true,
        },
      },
      {
        primitiveId: "defense.escalation-ladder",
        label: "Escalation Dynamics",
        configTemplate: {
          maxLevels: "{{maxLevels}}",
          domain: "{{domain}}",
          includeNuclear: "{{includeNuclear}}",
        },
      },
      {
        primitiveId: "defense.course-of-action",
        label: "Deterrence Posture Options",
        configTemplate: {
          maxCourses: 3,
          evaluationCriteria: "credibility,cost,escalation-risk",
          format: "structured",
        },
      },
    ],
    edges: [
      { source: 0, target: 1 },
      { source: 0, target: 2 },
      { source: 1, target: 3 },
      { source: 2, target: 3 },
      { source: 3, target: 4 },
      { source: 4, target: 5 },
    ],
  },
  parameterSchema: {
    required: ["actors", "deterrentCapability"],
    optional: ["threatLevel", "domain", "maxLevels", "includeNuclear"],
    examples: {
      actors: [
        { name: "Defender", role: "deterrer", objectives: ["prevent aggression", "maintain stability"] },
        { name: "Challenger", role: "potential aggressor", objectives: ["change status quo", "avoid costs"] },
      ],
      deterrentCapability: "extended conventional deterrence",
      threatLevel: "high",
      domain: "military",
      maxLevels: 4,
      includeNuclear: false,
    },
  },
};

/**
 * PATTERN 5: Opinion Dynamics / Diffusion
 * "How will opinion spread?", "Viral adoption", "Information diffusion"
 *
 * Flow: sample network → ABM simulation → factor analysis
 */
export const OPINION_DYNAMICS: PatternTemplate = {
  id: "opinion_dynamics",
  name: "Opinion Dynamics Simulation",
  description: "Model how opinions, products, or information spread through a population over time",
  domain: "policy",
  triggerPhrases: [
    "spread",
    "viral",
    "adoption over time",
    "diffusion",
    "opinion dynamics",
    "social contagion",
    "network effects",
    "word of mouth",
    "information spread",
  ],
  structure: {
    nodes: [
      {
        primitiveId: "data.input",
        label: "Diffusion Context",
        configTemplate: { dataType: "json" },
      },
      {
        primitiveId: "data.population.sample",
        label: "Sample Network",
        configTemplate: {
          populationId: "{{populationId}}",
          sampleSize: "{{sampleSize}}",
          includeNetworkStructure: true,
        },
      },
      {
        primitiveId: "sim.abm",
        label: "Agent-Based Model",
        configTemplate: {
          timeSteps: "{{timeSteps}}",
          interactionModel: "{{interactionModel}}",
          seedPercentage: "{{seedPercentage}}",
        },
      },
      {
        primitiveId: "reason.analyze",
        label: "Diffusion Analysis",
        configTemplate: {
          focus: "adoption curve, tipping points, influencer segments",
        },
      },
      {
        primitiveId: "sim.sensitivity",
        label: "Factor Sensitivity",
        configTemplate: {
          range: 50,
          factors: "{{factors}}",
        },
      },
      {
        primitiveId: "output.chart",
        label: "Adoption Curve",
        configTemplate: {
          chartType: "timeseries",
          interactive: true,
        },
      },
      {
        primitiveId: "output.report",
        label: "Diffusion Report",
        configTemplate: {
          format: "detailed",
        },
      },
    ],
    edges: [
      { source: 0, target: 1 },
      { source: 1, target: 2 },
      { source: 2, target: 3 },
      { source: 2, target: 4 },
      { source: 3, target: 6 },
      { source: 4, target: 5 },
      { source: 5, target: 6 },
    ],
  },
  parameterSchema: {
    required: ["diffusionTarget", "populationId"],
    optional: ["timeSteps", "interactionModel", "seedPercentage", "factors"],
    examples: {
      diffusionTarget: "New mobile payment app",
      populationId: "us_adults",
      timeSteps: 52,
      interactionModel: "bass_diffusion",
      seedPercentage: 2,
    },
  },
};

/**
 * PATTERN 6: Counterfactual Comparison
 * "Compare option A vs B", "Which approach is better?", "A/B decision"
 *
 * Flow: sample → parallel scenarios × N → monte_carlo × N → compare
 */
export const COUNTERFACTUAL: PatternTemplate = {
  id: "counterfactual",
  name: "Counterfactual Comparison",
  description: "Compare multiple options by simulating population response to each",
  domain: "general",
  triggerPhrases: [
    "compare",
    "which option",
    "a/b test",
    "counterfactual",
    "alternative approach",
    "option comparison",
    "which is better",
    "trade-off between",
    "vs",
    "versus",
  ],
  structure: {
    nodes: [
      {
        primitiveId: "data.input",
        label: "Options Context",
        configTemplate: { dataType: "json" },
      },
      {
        primitiveId: "data.population.sample",
        label: "Sample Population",
        configTemplate: {
          populationId: "{{populationId}}",
          sampleSize: "{{sampleSize}}",
          useArchetypes: true,
        },
      },
      {
        primitiveId: "branch.counterfactual",
        label: "Option Branches",
        configTemplate: {
          branches: "{{options}}",
          parallelExecution: true,
        },
      },
      {
        primitiveId: "sim.montecarlo.oasis",
        label: "Option A Simulation",
        configTemplate: {
          rollouts: "{{rollouts}}",
          scenario: "{{optionA}}",
        },
      },
      {
        primitiveId: "sim.montecarlo.oasis",
        label: "Option B Simulation",
        configTemplate: {
          rollouts: "{{rollouts}}",
          scenario: "{{optionB}}",
        },
      },
      {
        primitiveId: "control.merge",
        label: "Combine Results",
        configTemplate: { strategy: "object" },
      },
      {
        primitiveId: "reason.compare",
        label: "Head-to-Head Analysis",
        configTemplate: {
          criteria: "{{comparisonCriteria}}",
        },
      },
      {
        primitiveId: "reason.steelman",
        label: "Best Case for Runner-Up",
        configTemplate: {},
      },
      {
        primitiveId: "output.recommendation",
        label: "Final Recommendation",
        configTemplate: {
          style: "bluf",
          includeConfidence: true,
        },
      },
    ],
    edges: [
      { source: 0, target: 1 },
      { source: 1, target: 2 },
      { source: 2, target: 3 },
      { source: 2, target: 4 },
      { source: 3, target: 5 },
      { source: 4, target: 5 },
      { source: 5, target: 6 },
      { source: 6, target: 7 },
      { source: 7, target: 8 },
    ],
  },
  parameterSchema: {
    required: ["optionA", "optionB", "comparisonCriteria"],
    optional: ["populationId", "sampleSize", "rollouts", "additionalOptions"],
    examples: {
      optionA: "Launch with freemium model",
      optionB: "Launch with paid-only model",
      comparisonCriteria: "adoption rate, revenue, customer satisfaction",
      populationId: "us_consumers",
    },
  },
};

// All canonical patterns
export const CANONICAL_PATTERNS: PatternTemplate[] = [
  CONSUMER_SURVEY,
  CHANGE_IMPACT,
  COMPETITIVE_RESPONSE,
  WARGAME,
  DETERRENCE_ANALYSIS,
  OPINION_DYNAMICS,
  COUNTERFACTUAL,
];

/**
 * Detect which pattern best matches a user query
 */
export function detectPattern(query: string): PatternTemplate | null {
  const normalizedQuery = query.toLowerCase();

  let bestMatch: PatternTemplate | null = null;
  let bestScore = 0;

  for (const pattern of CANONICAL_PATTERNS) {
    let score = 0;

    for (const phrase of pattern.triggerPhrases) {
      if (normalizedQuery.includes(phrase)) {
        // Longer phrases get higher scores
        score += phrase.split(" ").length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = pattern;
    }
  }

  // Require at least one trigger phrase match
  return bestScore > 0 ? bestMatch : null;
}

/**
 * Generate system prompt section for patterns
 */
export function generatePatternPromptSection(): string {
  const lines: string[] = [
    "CANONICAL WORKFLOW PATTERNS",
    "=" .repeat(50),
    "",
    "RLTX has 6 canonical patterns for behavioral simulation. When a user's request matches a pattern,",
    "use the pattern's template structure and parameterize it based on their specific context.",
    "",
  ];

  for (const pattern of CANONICAL_PATTERNS) {
    lines.push(`### ${pattern.name} (${pattern.id})`);
    lines.push(`Domain: ${pattern.domain}`);
    lines.push(`Description: ${pattern.description}`);
    lines.push(`Trigger phrases: ${pattern.triggerPhrases.slice(0, 5).join(", ")}...`);
    lines.push(`Required parameters: ${pattern.parameterSchema.required.join(", ")}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate few-shot examples for the composition prompt
 */
export function generateFewShotExamples(): string {
  return `
FEW-SHOT EXAMPLES
=================

Example 1: Consumer Survey Pattern
User: "Would enterprise customers pay $50/month for our new analytics dashboard?"
Pattern detected: consumer_survey
{
  "message": "I'll simulate how enterprise decision-makers would respond to your $50/month analytics dashboard pricing.",
  "pattern": "consumer_survey",
  "workflow": {
    "name": "Enterprise Dashboard Pricing Survey",
    "nodes": [
      {"primitiveId": "data.input", "label": "Pricing Context", "config": {"dataType": "json"}},
      {"primitiveId": "data.population.sample", "label": "Sample Enterprise Buyers", "config": {"populationId": "enterprise_decision_makers", "sampleSize": 500, "useArchetypes": true}},
      {"primitiveId": "sim.montecarlo.oasis", "label": "Pricing Survey", "config": {"rollouts": 100, "question": "Would you subscribe to this analytics dashboard at $50/month?", "responseFormat": "yes_no_maybe"}},
      {"primitiveId": "reason.analyze", "label": "Segment Analysis", "config": {"focus": "company size segments, budget authority, current tools"}},
      {"primitiveId": "output.report", "label": "Survey Results", "config": {"format": "detailed", "includeSegments": true}}
    ],
    "edges": [{"source": 0, "target": 1}, {"source": 1, "target": 2}, {"source": 2, "target": 3}, {"source": 3, "target": 4}]
  }
}

Example 2: Change Impact Pattern
User: "What if we increase our prices by 20%? How would that affect customer retention?"
Pattern detected: change_impact
{
  "message": "I'll analyze how a 20% price increase would affect customer retention across different price sensitivity scenarios.",
  "pattern": "change_impact",
  "workflow": {
    "name": "Price Increase Impact Analysis",
    "nodes": [
      {"primitiveId": "data.input", "label": "Pricing Change Context", "config": {"dataType": "json"}},
      {"primitiveId": "data.population.sample", "label": "Sample Current Customers", "config": {"populationId": "us_consumers", "sampleSize": 1000, "useArchetypes": true}},
      {"primitiveId": "sim.scenario", "label": "Price Scenarios", "config": {"count": 5, "baseVariable": "price_change_percent", "range": [0, 5, 10, 15, 20]}},
      {"primitiveId": "branch.counterfactual", "label": "Parallel Simulations", "config": {"parallelExecution": true}},
      {"primitiveId": "sim.montecarlo.oasis", "label": "Retention Simulation", "config": {"rollouts": 100, "question": "Would you continue your subscription at this new price?"}},
      {"primitiveId": "control.merge", "label": "Combine Results", "config": {"strategy": "object"}},
      {"primitiveId": "reason.compare", "label": "Impact Comparison", "config": {"criteria": "retention rate, revenue change, at-risk segments"}},
      {"primitiveId": "output.chart", "label": "Price Sensitivity Curve", "config": {"chartType": "sensitivity", "interactive": true}}
    ],
    "edges": [{"source": 0, "target": 1}, {"source": 0, "target": 2}, {"source": 1, "target": 3}, {"source": 2, "target": 3}, {"source": 3, "target": 4}, {"source": 4, "target": 5}, {"source": 5, "target": 6}, {"source": 6, "target": 7}]
  }
}

Example 3: Competitive Response Pattern
User: "How will our competitors respond if we launch a free tier?"
Pattern detected: competitive_response
{
  "message": "I'll model competitive dynamics to predict how rivals will respond to your free tier launch, then simulate how customers will react to the resulting market.",
  "pattern": "competitive_response",
  "workflow": {
    "name": "Free Tier Competitive Analysis",
    "nodes": [
      {"primitiveId": "data.input", "label": "Competitive Context", "config": {"dataType": "json"}},
      {"primitiveId": "game.equilibrium", "label": "Competitor Response Model", "config": {"equilibriumType": "nash", "actors": [{"name": "Our Company", "role": "market leader"}, {"name": "Competitor A", "role": "challenger"}, {"name": "Competitor B", "role": "niche player"}], "useAgentNegotiation": true}},
      {"primitiveId": "sim.scenario", "label": "Market Scenarios", "config": {"count": 4, "includeWorstCase": true}},
      {"primitiveId": "data.population.sample", "label": "Sample Customers", "config": {"populationId": "us_consumers", "sampleSize": 500}},
      {"primitiveId": "branch.counterfactual", "label": "Scenario Branches", "config": {"parallelExecution": true}},
      {"primitiveId": "sim.montecarlo.oasis", "label": "Customer Choice Simulation", "config": {"rollouts": 100, "question": "Which provider would you choose?"}},
      {"primitiveId": "control.merge", "label": "Consolidate Outcomes", "config": {"strategy": "object"}},
      {"primitiveId": "reason.analyze", "label": "Strategic Analysis", "config": {"focus": "optimal timing, risk factors, competitive moats"}},
      {"primitiveId": "output.recommendation", "label": "Strategic Recommendation", "config": {"style": "bluf", "includeConfidence": true}}
    ],
    "edges": [{"source": 0, "target": 1}, {"source": 0, "target": 3}, {"source": 1, "target": 2}, {"source": 2, "target": 4}, {"source": 3, "target": 4}, {"source": 4, "target": 5}, {"source": 5, "target": 6}, {"source": 6, "target": 7}, {"source": 7, "target": 8}]
  }
}

Example 4: Wargame Pattern
User: "How might China respond to increased US naval presence in the South China Sea?"
Pattern detected: wargame
{
  "message": "I'll run a strategic wargame simulation modeling how China might respond to increased US naval presence, including escalation dynamics and equilibrium analysis.",
  "pattern": "wargame",
  "workflow": {
    "name": "South China Sea Strategic Simulation",
    "nodes": [
      {"primitiveId": "data.input", "label": "Strategic Context", "config": {"dataType": "json"}},
      {"primitiveId": "game.equilibrium", "label": "Strategic Wargame", "config": {"equilibriumType": "nash", "domain": "defense", "actors": [{"name": "United States", "role": "status quo power", "objectives": ["maintain freedom of navigation", "deter aggression", "support allies"]}, {"name": "China", "role": "revisionist power", "objectives": ["assert territorial claims", "limit US influence", "avoid direct conflict"]}], "maxRounds": 5, "useAgentNegotiation": true}},
      {"primitiveId": "reason.analyze", "label": "Equilibrium Analysis", "config": {"focus": "stability, escalation risk, off-ramps"}},
      {"primitiveId": "sim.scenario", "label": "Escalation Scenarios", "config": {"count": 4, "includeWorstCase": true}},
      {"primitiveId": "reason.critique", "label": "Red Team Analysis", "config": {"perspective": "adversary"}},
      {"primitiveId": "control.merge", "label": "Consolidate Analysis", "config": {"strategy": "object"}},
      {"primitiveId": "output.report", "label": "Strategic Assessment", "config": {"format": "detailed"}}
    ],
    "edges": [{"source": 0, "target": 1}, {"source": 1, "target": 2}, {"source": 1, "target": 3}, {"source": 2, "target": 5}, {"source": 3, "target": 4}, {"source": 4, "target": 5}, {"source": 5, "target": 6}]
  }
}
`;
}
