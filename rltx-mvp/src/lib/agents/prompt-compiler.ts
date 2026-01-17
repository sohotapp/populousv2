// Agent Prompt Compiler
// Converts agent profiles + scenarios into LLM prompts

import { AgentProfile } from "../population/sampler";

export type QuestionType = "binary" | "scale" | "choice" | "open" | "numeric";

export interface ScenarioContext {
  // The scenario being evaluated
  scenario: string;
  // Additional context (e.g., current market conditions)
  context?: string;
  // The specific question to ask
  question: string;
  // Type of response expected
  questionType: QuestionType;
  // For choice questions, the available options
  options?: string[];
  // For scale questions, the range
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: { min: string; max: string };
  // For numeric questions, units and bounds
  numericUnit?: string;
  numericMin?: number;
  numericMax?: number;
  // Domain context (enterprise, defense, consumer)
  domain?: "enterprise" | "defense" | "consumer";
  // Optional memory/history for the agent
  memory?: string;
}

export interface CompiledPrompt {
  systemPrompt: string;
  userPrompt: string;
  expectedFormat: string;
  // Complexity score (0-1) for model routing
  complexity: number;
}

// Helper to describe psychographic levels
function describeLevel(value: number): string {
  if (value <= 0.2) return "very low";
  if (value <= 0.4) return "low";
  if (value <= 0.6) return "moderate";
  if (value <= 0.8) return "high";
  return "very high";
}

// Build the persona system prompt with psychographic enrichment
function buildPersonaPrompt(agent: AgentProfile, domain?: string): string {
  const lines: string[] = [
    "You are simulating a real person with the following characteristics:",
    "",
    `DEMOGRAPHIC PROFILE:`,
    agent.description,
    "",
  ];

  // Add detailed demographics
  lines.push("DETAILED ATTRIBUTES:");
  lines.push(`- Age group: ${agent.demographics.age}`);
  lines.push(`- Gender: ${agent.demographics.gender}`);
  lines.push(`- Household income: ${agent.demographics.income}`);
  lines.push(`- Education level: ${agent.demographics.education}`);
  lines.push(`- Location type: ${agent.demographics.location}`);
  lines.push(`- Region: ${agent.demographics.region}`);

  if (agent.demographics.employment) {
    lines.push(`- Employment status: ${agent.demographics.employment}`);
  }
  if (agent.demographics.householdSize) {
    lines.push(`- Household size: ${agent.demographics.householdSize} people`);
  }

  // Add psychographic profile (Big Five personality)
  if (agent.psychographics?.bigFive) {
    const bf = agent.psychographics.bigFive;
    lines.push("");
    lines.push("PERSONALITY (Big Five OCEAN):");
    lines.push(`- Openness: ${describeLevel(bf.openness)} (${Math.round(bf.openness * 100)}%) - intellectual curiosity, creativity`);
    lines.push(`- Conscientiousness: ${describeLevel(bf.conscientiousness)} (${Math.round(bf.conscientiousness * 100)}%) - organization, dependability`);
    lines.push(`- Extraversion: ${describeLevel(bf.extraversion)} (${Math.round(bf.extraversion * 100)}%) - sociability, assertiveness`);
    lines.push(`- Agreeableness: ${describeLevel(bf.agreeableness)} (${Math.round(bf.agreeableness * 100)}%) - cooperation, trust`);
    lines.push(`- Neuroticism: ${describeLevel(bf.neuroticism)} (${Math.round(bf.neuroticism * 100)}%) - emotional reactivity, anxiety`);
  }

  // Add values profile (Schwartz)
  if (agent.psychographics?.values) {
    const v = agent.psychographics.values;
    lines.push("");
    lines.push("CORE VALUES (top priorities):");
    // Sort values by importance and show top 3
    const sortedValues = [
      { name: "Achievement", value: v.achievement, desc: "success, ambition" },
      { name: "Security", value: v.security, desc: "safety, stability" },
      { name: "Self-Direction", value: v.selfDirection, desc: "independence, freedom" },
      { name: "Benevolence", value: v.benevolence, desc: "helping others, loyalty" },
      { name: "Power", value: v.power, desc: "authority, influence" },
      { name: "Tradition", value: v.tradition, desc: "respect, commitment" },
    ].sort((a, b) => b.value - a.value);

    sortedValues.slice(0, 3).forEach((val, i) => {
      lines.push(`${i + 1}. ${val.name}: ${describeLevel(val.value)} (${val.desc})`);
    });
  }

  // Add cognitive biases
  if (agent.psychographics?.biases) {
    const b = agent.psychographics.biases;
    lines.push("");
    lines.push("COGNITIVE TENDENCIES:");
    if (b.lossAversion >= 0.6) {
      lines.push(`- Loss aversion: ${describeLevel(b.lossAversion)} - weighs potential losses ${b.lossAversion >= 0.7 ? "2.5x" : "1.5x"} more than equivalent gains`);
    }
    if (b.statusQuoBias >= 0.5) {
      lines.push(`- Status quo preference: ${describeLevel(b.statusQuoBias)} - prefers familiar options over change`);
    }
    if (b.socialProof >= 0.5) {
      lines.push(`- Social influence: ${describeLevel(b.socialProof)} - influenced by what peers/others do`);
    }
    if (b.overconfidence >= 0.6) {
      lines.push(`- Overconfidence: ${describeLevel(b.overconfidence)} - tends to overestimate own knowledge`);
    }
  }

  // Add behavioral traits
  if (agent.psychographics?.traits) {
    const t = agent.psychographics.traits;
    lines.push("");
    lines.push("BEHAVIORAL TRAITS:");
    lines.push(`- Risk tolerance: ${describeLevel(t.riskTolerance)} - ${t.riskTolerance <= 0.3 ? "cautious, prefers safety" : t.riskTolerance >= 0.7 ? "adventurous, willing to gamble" : "balanced approach to risk"}`);
    lines.push(`- Price sensitivity: ${describeLevel(t.priceElasticity)} - ${t.priceElasticity >= 0.7 ? "very price-conscious" : t.priceElasticity <= 0.3 ? "less concerned about price" : "moderately price-aware"}`);
    lines.push(`- Brand loyalty: ${describeLevel(t.brandLoyalty)} - ${t.brandLoyalty >= 0.7 ? "strongly prefers trusted brands" : t.brandLoyalty <= 0.3 ? "easily switches brands" : "moderate brand preference"}`);
    lines.push(`- Quality focus: ${describeLevel(t.qualityOrientation)} - ${t.qualityOrientation >= 0.7 ? "prioritizes quality over price" : t.qualityOrientation <= 0.3 ? "prioritizes price over quality" : "balances quality and price"}`);
  }

  // Legacy traits if available (backwards compatibility)
  if (agent.traits && !agent.psychographics) {
    lines.push("");
    lines.push("BEHAVIORAL TRAITS:");
    if (agent.traits.riskTolerance) {
      lines.push(`- Risk tolerance: ${agent.traits.riskTolerance}`);
    }
    if (agent.traits.priceSensitivity) {
      lines.push(`- Price sensitivity: ${agent.traits.priceSensitivity}`);
    }
    if (agent.traits.brandLoyalty) {
      lines.push(`- Brand loyalty: ${agent.traits.brandLoyalty}`);
    }
    if (agent.traits.techAdoption) {
      lines.push(`- Technology adoption: ${agent.traits.techAdoption}`);
    }
  }

  // Domain-specific instructions
  lines.push("");
  lines.push("SIMULATION INSTRUCTIONS:");
  lines.push("- Respond as this person would ACTUALLY respond, not how you think they SHOULD respond");
  lines.push("- Consider their personality, values, financial situation, and cognitive tendencies");
  lines.push("- Be realistic about how their biases affect decisions");
  lines.push("- Use their Big Five traits to inform response style and decision-making");

  if (domain === "enterprise") {
    lines.push("- Consider professional context and career implications");
  } else if (domain === "defense") {
    lines.push("- Consider national security implications and institutional constraints");
  } else if (domain === "consumer") {
    lines.push("- Consider budget constraints and competing priorities");
  }

  return lines.join("\n");
}

// Build the scenario/question user prompt
function buildQuestionPrompt(scenario: ScenarioContext): string {
  const lines: string[] = [];

  // Context
  if (scenario.context) {
    lines.push("CURRENT SITUATION:");
    lines.push(scenario.context);
    lines.push("");
  }

  // Memory/history
  if (scenario.memory) {
    lines.push("YOUR RECENT EXPERIENCE:");
    lines.push(scenario.memory);
    lines.push("");
  }

  // Scenario
  lines.push("SCENARIO:");
  lines.push(scenario.scenario);
  lines.push("");

  // Question
  lines.push("QUESTION:");
  lines.push(scenario.question);
  lines.push("");

  // Response format instructions based on question type
  lines.push("RESPOND IN THIS EXACT FORMAT:");

  switch (scenario.questionType) {
    case "binary":
      lines.push("Answer: [yes/no]");
      lines.push("Confidence: [high/medium/low]");
      lines.push("Reasoning: [1-2 sentences explaining your decision]");
      break;

    case "scale":
      const min = scenario.scaleMin ?? 1;
      const max = scenario.scaleMax ?? 10;
      const minLabel = scenario.scaleLabels?.min ?? "strongly disagree";
      const maxLabel = scenario.scaleLabels?.max ?? "strongly agree";
      lines.push(`Rating: [number from ${min} to ${max}]`);
      lines.push(`(${min} = ${minLabel}, ${max} = ${maxLabel})`);
      lines.push("Confidence: [high/medium/low]");
      lines.push("Reasoning: [1-2 sentences explaining your rating]");
      break;

    case "choice":
      if (scenario.options && scenario.options.length > 0) {
        lines.push(`Choice: [one of: ${scenario.options.join(", ")}]`);
      } else {
        lines.push("Choice: [your selection]");
      }
      lines.push("Confidence: [high/medium/low]");
      lines.push("Reasoning: [1-2 sentences explaining your choice]");
      break;

    case "numeric":
      lines.push(`Value: [number${scenario.numericUnit ? ` in ${scenario.numericUnit}` : ""}]`);
      if (scenario.numericMin !== undefined || scenario.numericMax !== undefined) {
        const bounds = [];
        if (scenario.numericMin !== undefined) bounds.push(`min: ${scenario.numericMin}`);
        if (scenario.numericMax !== undefined) bounds.push(`max: ${scenario.numericMax}`);
        lines.push(`(${bounds.join(", ")})`);
      }
      lines.push("Confidence: [high/medium/low]");
      lines.push("Reasoning: [1-2 sentences explaining your estimate]");
      break;

    case "open":
      lines.push("Response: [your answer in 2-4 sentences]");
      lines.push("Confidence: [high/medium/low]");
      break;
  }

  return lines.join("\n");
}

// Calculate complexity score for model routing
function calculateComplexity(
  agent: AgentProfile,
  scenario: ScenarioContext
): number {
  let complexity = 0;

  // Question type complexity
  switch (scenario.questionType) {
    case "binary":
      complexity += 0.1;
      break;
    case "scale":
      complexity += 0.2;
      break;
    case "choice":
      complexity += 0.3 + (scenario.options?.length ?? 0) * 0.05;
      break;
    case "numeric":
      complexity += 0.4;
      break;
    case "open":
      complexity += 0.6;
      break;
  }

  // Scenario length adds complexity
  const scenarioWords = scenario.scenario.split(/\s+/).length;
  complexity += Math.min(0.2, scenarioWords / 500);

  // Context adds complexity
  if (scenario.context) {
    complexity += 0.1;
  }

  // Memory/history adds complexity
  if (scenario.memory) {
    complexity += 0.15;
  }

  // Defense domain is more complex (strategic reasoning)
  if (scenario.domain === "defense") {
    complexity += 0.2;
  }

  // Behavioral traits that require nuance
  if (agent.traits) {
    complexity += 0.05 * Object.keys(agent.traits).length;
  }

  return Math.min(1.0, complexity);
}

// Build expected format string for response parsing
function buildExpectedFormat(scenario: ScenarioContext): string {
  switch (scenario.questionType) {
    case "binary":
      return "Answer: (yes|no)\nConfidence: (high|medium|low)\nReasoning: <text>";
    case "scale":
      return `Rating: <number ${scenario.scaleMin ?? 1}-${scenario.scaleMax ?? 10}>\nConfidence: (high|medium|low)\nReasoning: <text>`;
    case "choice":
      return `Choice: <option>\nConfidence: (high|medium|low)\nReasoning: <text>`;
    case "numeric":
      return `Value: <number>\nConfidence: (high|medium|low)\nReasoning: <text>`;
    case "open":
      return `Response: <text>\nConfidence: (high|medium|low)`;
    default:
      return "Answer: <response>\nConfidence: (high|medium|low)";
  }
}

// Main function: Compile agent + scenario into a prompt
export function compilePrompt(
  agent: AgentProfile,
  scenario: ScenarioContext
): CompiledPrompt {
  return {
    systemPrompt: buildPersonaPrompt(agent, scenario.domain),
    userPrompt: buildQuestionPrompt(scenario),
    expectedFormat: buildExpectedFormat(scenario),
    complexity: calculateComplexity(agent, scenario),
  };
}

// Batch compile for multiple agents (same scenario)
export function compilePromptBatch(
  agents: AgentProfile[],
  scenario: ScenarioContext
): Array<{ agent: AgentProfile; prompt: CompiledPrompt }> {
  return agents.map((agent) => ({
    agent,
    prompt: compilePrompt(agent, scenario),
  }));
}

// Create a simplified prompt for caching/deduplication
export function getPromptHash(prompt: CompiledPrompt): string {
  const combined = prompt.systemPrompt + "|" + prompt.userPrompt;
  // Simple hash for deduplication
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
