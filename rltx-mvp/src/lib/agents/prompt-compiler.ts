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

// Build the persona system prompt
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

  // Add traits if available
  if (agent.traits) {
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
  lines.push("- Consider their financial situation, values, and constraints");
  lines.push("- Be realistic about cognitive biases and emotional factors");
  lines.push("- If uncertain, lean toward status quo / loss aversion (as real humans do)");

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
