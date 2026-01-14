// LLM Executor - Handles all Claude-powered reasoning primitives

import Anthropic from "@anthropic-ai/sdk";
import { BaseExecutor } from "./base";
import {
  ExecutorContext,
  ExecutorResult,
  ExecutorType,
  ExecutionError,
  Distribution,
} from "./types";

// Prompt templates for each LLM primitive
const PROMPTS: Record<string, string> = {
  "reason.analyze": `You are performing deep multi-dimensional analysis.

INPUT DATA:
{data}

CONTEXT: {context}
FOCUS AREA: {focus}

Analyze thoroughly and provide your response in this exact JSON structure:
{
  "keyFindings": ["finding 1", "finding 2", ...],
  "risks": [{"risk": "description", "severity": "high|medium|low", "likelihood": 0.0-1.0}],
  "opportunities": ["opportunity 1", ...],
  "confidence": 0.0-1.0,
  "uncertainties": ["uncertainty 1", ...],
  "reasoning": "step by step reasoning",
  "recommendation": "primary recommendation"
}`,

  "reason.compare": `You are comparing multiple options systematically.

OPTIONS TO COMPARE:
{options}

COMPARISON CRITERIA: {criteria}

Evaluate each option and respond in this exact JSON structure:
{
  "options": [
    {
      "name": "option name",
      "scores": {"criterion1": 0-10, "criterion2": 0-10},
      "pros": ["pro 1", ...],
      "cons": ["con 1", ...],
      "overallScore": 0-100
    }
  ],
  "winner": "best option name",
  "winnerReasoning": "why this option wins",
  "tradeoffs": ["tradeoff 1", ...]
}`,

  "reason.summarize": `Summarize the following content.

CONTENT:
{content}

LENGTH: {length}
STYLE: {style}

Provide a {style} summary in {length} format.`,

  "reason.critique": `You are performing a pre-mortem analysis - identifying potential failure modes.

PLAN/PROPOSAL:
{plan}

PERSPECTIVE: {perspective}

Analyze from a {perspective} perspective and respond in this exact JSON structure:
{
  "criticalFlaws": [{"flaw": "description", "impact": "high|medium|low", "mitigation": "how to address"}],
  "blindSpots": ["blindspot 1", ...],
  "assumptions": [{"assumption": "what is assumed", "risk": "risk if wrong"}],
  "worstCaseScenario": "description of worst case",
  "overallRiskRating": "high|medium|low",
  "recommendation": "proceed|revise|abandon"
}`,

  "reason.steelman": `Construct the strongest possible case for the given option.

OPTION/POSITION:
{option}

TARGET AUDIENCE: {audience}

Build the most compelling argument and respond in this exact JSON structure:
{
  "coreArgument": "the central thesis",
  "supportingPoints": [{"point": "argument", "evidence": "supporting evidence"}],
  "anticipatedObjections": [{"objection": "possible counter", "rebuttal": "how to address"}],
  "emotionalAppeal": "appeal to audience values",
  "callToAction": "recommended action",
  "strengthScore": 0-100
}`,

  "sim.scenario": `Generate alternative future scenarios based on the base case.

BASE CASE:
{baseCase}

NUMBER OF SCENARIOS: {count}
INCLUDE WORST CASE: {includeWorstCase}

Generate distinct scenarios and respond in this exact JSON structure:
{
  "scenarios": [
    {
      "name": "scenario name",
      "type": "optimistic|realistic|pessimistic|black-swan",
      "probability": 0.0-1.0,
      "description": "what happens",
      "keyDrivers": ["driver 1", ...],
      "outcomes": {"metric1": "value", "metric2": "value"},
      "implications": ["implication 1", ...]
    }
  ],
  "keyUncertainties": ["uncertainty 1", ...],
  "recommendedHedges": ["hedge 1", ...]
}`,

  "sim.sensitivity": `Perform sensitivity analysis on the model.

MODEL:
{model}

VARIATION RANGE: {range}%

Analyze variable sensitivity and respond in this exact JSON structure:
{
  "drivers": [
    {
      "variable": "variable name",
      "baseValue": "current value",
      "sensitivity": 0.0-1.0,
      "direction": "positive|negative|mixed",
      "threshold": "value at which outcome changes significantly"
    }
  ],
  "topDrivers": ["most impactful variable", ...],
  "interactions": [{"variables": ["var1", "var2"], "effect": "description"}],
  "robustnessScore": 0-100
}`,

  "decompose.question": `Decompose this complex question into sub-questions.

MAIN QUESTION:
{question}

CONTEXT:
{context}

MAX DEPTH: {maxDepth}

Break down and respond in this exact JSON structure:
{
  "subQuestions": [
    {
      "id": "q1",
      "question": "sub-question text",
      "type": "factual|causal|counterfactual|evaluative",
      "dependencies": ["q0"],
      "estimatedDifficulty": "easy|medium|hard"
    }
  ],
  "dependencies": {"q2": ["q1"], "q3": ["q1", "q2"]},
  "recommendedOrder": ["q1", "q2", "q3"],
  "keyAssumptions": ["assumption 1", ...]
}`,

  "causal.explain": `Trace causal relationships in the simulation results.

SIMULATION RESULTS:
{simulationResults}

VARIABLES OF INTEREST:
{variables}

METHOD: {method}

Analyze causal relationships and respond in this exact JSON structure:
{
  "causalGraph": {
    "nodes": ["variable1", "variable2"],
    "edges": [{"from": "var1", "to": "var2", "strength": 0.0-1.0, "type": "direct|indirect"}]
  },
  "effects": [
    {
      "cause": "variable name",
      "effect": "outcome variable",
      "magnitude": 0.0-1.0,
      "confidence": 0.0-1.0,
      "mechanism": "how it works"
    }
  ],
  "sensitivity": {
    "topDrivers": ["driver 1", ...],
    "tornadoData": [{"variable": "name", "lowImpact": -10, "highImpact": 20}]
  }
}`,

  "output.recommendation": `Generate an actionable recommendation based on the analysis.

ANALYSIS:
{analysis}

STYLE: {style}
INCLUDE CONFIDENCE: {includeConfidence}

Provide recommendation in this exact JSON structure:
{
  "action": "recommended action",
  "confidence": 0.0-1.0,
  "confidenceInterval": [0.0, 1.0],
  "reasoning": "why this recommendation",
  "alternatives": [{"action": "alternative", "tradeoff": "what you lose"}],
  "nextSteps": ["step 1", "step 2"],
  "risks": ["risk if you follow this"],
  "timeline": "when to act"
}`,

  "output.report": `Generate board-ready documentation.

RECOMMENDATION:
{recommendation}

EVIDENCE:
{evidence}

FORMAT: {format}

Create a {format} report in this exact JSON structure:
{
  "title": "report title",
  "executiveSummary": "2-3 sentence summary",
  "sections": [
    {
      "heading": "section name",
      "content": "section content",
      "citations": ["source 1", ...]
    }
  ],
  "keyMetrics": [{"name": "metric", "value": "value", "trend": "up|down|stable"}],
  "appendix": ["supporting detail 1", ...]
}`,
};

export class LLMExecutor extends BaseExecutor {
  type: ExecutorType = "llm";
  primitiveIds = [
    "reason.analyze",
    "reason.compare",
    "reason.summarize",
    "reason.critique",
    "reason.steelman",
    "sim.scenario",
    "sim.sensitivity",
    "decompose.question",
    "causal.explain",
    "output.recommendation",
    "output.report",
  ];

  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new ExecutionError(
          "NO_API_KEY",
          "ANTHROPIC_API_KEY not configured",
          false
        );
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  async execute(ctx: ExecutorContext): Promise<ExecutorResult> {
    const startedAt = new Date();
    const promptTemplate = PROMPTS[ctx.primitiveId];

    if (!promptTemplate) {
      throw new ExecutionError(
        "UNKNOWN_PRIMITIVE",
        `No prompt template for ${ctx.primitiveId}`,
        false
      );
    }

    // Build prompt from template
    const prompt = this.buildPrompt(promptTemplate, ctx.inputs, ctx.config);

    ctx.onProgress(10, "Calling Claude...");

    try {
      const client = this.getClient();
      let fullResponse = "";

      // Use streaming for real-time output
      const stream = await client.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
        system: "You are RLTX, an AI assistant for analytical workflows. Always respond with valid JSON when the prompt requests a specific structure. Be thorough but concise.",
      });

      // Stream chunks to UI
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullResponse += event.delta.text;
          ctx.onStream(event.delta.text);
          ctx.onProgress(50, "Generating response...");
        }
      }

      ctx.onProgress(90, "Parsing response...");

      // Try to parse as JSON, fall back to text
      let parsedOutput: unknown;
      try {
        // Find JSON in response (sometimes wrapped in markdown)
        const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedOutput = JSON.parse(jsonMatch[0]);
        } else {
          parsedOutput = { text: fullResponse };
        }
      } catch {
        parsedOutput = { text: fullResponse };
      }

      ctx.onProgress(100, "Complete");

      // Extract confidence distribution if present
      const distribution = this.extractDistribution(parsedOutput);

      // Get final message for token usage
      const finalMessage = await stream.finalMessage();

      return {
        outputs: { result: parsedOutput },
        distribution,
        timing: this.createTiming(startedAt),
        metadata: {
          model: "claude-sonnet-4-20250514",
          tokensUsed: finalMessage?.usage?.output_tokens,
        },
      };
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        const recoverable = error.status ? (error.status === 429 || error.status >= 500) : false;
        throw new ExecutionError(
          `ANTHROPIC_${error.status || "UNKNOWN"}`,
          error.message,
          recoverable,
          error
        );
      }
      throw error;
    }
  }

  private buildPrompt(
    template: string,
    inputs: Record<string, unknown>,
    config: Record<string, unknown>
  ): string {
    let prompt = template;

    // Replace input placeholders
    for (const [key, value] of Object.entries(inputs)) {
      const placeholder = `{${key}}`;
      const stringValue = typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "");
      prompt = prompt.replace(new RegExp(placeholder, "g"), stringValue);
    }

    // Replace config placeholders
    for (const [key, value] of Object.entries(config)) {
      const placeholder = `{${key}}`;
      const stringValue = String(value ?? "");
      prompt = prompt.replace(new RegExp(placeholder, "g"), stringValue);
    }

    // Replace any remaining placeholders with empty string
    prompt = prompt.replace(/\{[^}]+\}/g, "");

    return prompt;
  }

  private extractDistribution(output: unknown): Distribution | undefined {
    if (typeof output !== "object" || output === null) return undefined;

    const obj = output as Record<string, unknown>;

    // Look for confidence score to create a distribution
    if (typeof obj.confidence === "number") {
      const conf = obj.confidence;
      return {
        type: "normal",
        mean: conf,
        std: 0.1, // Rough estimate of uncertainty
        percentiles: {
          p5: Math.max(0, conf - 0.15),
          p25: Math.max(0, conf - 0.08),
          p50: conf,
          p75: Math.min(1, conf + 0.08),
          p95: Math.min(1, conf + 0.15),
        },
      };
    }

    return undefined;
  }
}

// Export singleton instance
export const llmExecutor = new LLMExecutor();
