import Anthropic from "@anthropic-ai/sdk";

interface ExecutorCallbacks {
  onProgress?: (progress: number, message?: string) => void;
  onStream?: (chunk: string, isPartial: boolean) => void;
}

/**
 * LLM Executor - Handles Claude API calls for reasoning primitives
 */
export class LLMExecutor {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async execute(
    primitiveId: string,
    config: Record<string, unknown>,
    inputs: Record<string, unknown>,
    callbacks: ExecutorCallbacks = {}
  ): Promise<unknown> {
    const { onProgress, onStream } = callbacks;

    onProgress?.(10, "Preparing prompt...");

    // Build prompt based on primitive type
    const { systemPrompt, userPrompt } = this.buildPrompt(primitiveId, config, inputs);

    onProgress?.(20, "Calling Claude API...");

    try {
      // Use streaming for better UX
      let fullResponse = "";

      const stream = this.client.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          fullResponse += event.delta.text;
          onStream?.(event.delta.text, true);
        }
      }

      onStream?.(fullResponse, false);
      onProgress?.(90, "Processing response...");

      // Parse response based on primitive type
      const result = this.parseResponse(primitiveId, fullResponse);

      onProgress?.(100, "Complete");
      return result;
    } catch (error) {
      throw new Error(
        `LLM execution failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private buildPrompt(
    primitiveId: string,
    config: Record<string, unknown>,
    inputs: Record<string, unknown>
  ): { systemPrompt: string; userPrompt: string } {
    switch (primitiveId) {
      case "reason.analyze":
        return {
          systemPrompt: `You are an expert analyst. Analyze the provided data thoroughly and provide structured insights.
Always respond in valid JSON format with the following structure:
{
  "summary": "Brief summary of findings",
  "keyInsights": ["insight1", "insight2", ...],
  "risks": ["risk1", "risk2", ...],
  "opportunities": ["opp1", "opp2", ...],
  "recommendation": "Your recommendation",
  "confidence": 0.0-1.0
}`,
          userPrompt: `Analyze the following:
${config.prompt || "Provide a comprehensive analysis"}

Focus: ${config.focus || "General analysis"}

Data:
${JSON.stringify(inputs.data || inputs.input || inputs, null, 2)}

${inputs.context ? `Context: ${inputs.context}` : ""}`,
        };

      case "reason.compare":
        return {
          systemPrompt: `You are an expert at comparing options. Provide structured comparisons with pros, cons, and a clear recommendation.
Always respond in valid JSON format with the following structure:
{
  "options": [
    {
      "name": "Option name",
      "pros": ["pro1", "pro2"],
      "cons": ["con1", "con2"],
      "score": 0.0-1.0
    }
  ],
  "recommendation": "Best option name",
  "reasoning": "Why this option is best",
  "confidence": 0.0-1.0
}`,
          userPrompt: `Compare the following options:
${JSON.stringify(inputs.options || inputs, null, 2)}

Criteria: ${config.criteria || "Overall effectiveness"}`,
        };

      case "reason.summarize":
        return {
          systemPrompt: `You are an expert summarizer. Create clear, ${config.length || "medium"}-length summaries in ${config.style || "paragraph"} format.
If style is "bullets", use bullet points.
If style is "executive", focus on key decisions and actions.
Respond in JSON format: { "summary": "...", "keyPoints": ["point1", "point2"] }`,
          userPrompt: `Summarize the following content:
${JSON.stringify(inputs.content || inputs, null, 2)}`,
        };

      case "reason.critique":
        return {
          systemPrompt: `You are a ${config.perspective || "skeptic"} critic. Identify what could go wrong with the plan.
Respond in JSON format:
{
  "risks": [{"risk": "description", "likelihood": "high/medium/low", "impact": "high/medium/low", "mitigation": "suggestion"}],
  "blindSpots": ["blind spot 1", "blind spot 2"],
  "assumptions": ["assumption that could be wrong 1", ...],
  "overallAssessment": "summary",
  "confidence": 0.0-1.0
}`,
          userPrompt: `Critique this plan from a ${config.perspective || "skeptic"} perspective:
${JSON.stringify(inputs.plan || inputs, null, 2)}`,
        };

      case "decompose.question":
        return {
          systemPrompt: `You decompose complex questions into analyzable sub-questions.
Respond in JSON format:
{
  "subQuestions": [
    {"question": "sub-question text", "type": "factual|causal|counterfactual|normative", "priority": 1-5}
  ],
  "dependencies": {"q1": ["q2", "q3"]}, // which questions depend on others
  "suggestedOrder": ["q1", "q2", "q3"] // execution order
}`,
          userPrompt: `Decompose this question into analyzable sub-questions:

Main Question: ${inputs.question || inputs}

Context: ${JSON.stringify(inputs.context || {}, null, 2)}

Max depth: ${config.maxDepth || 2}
Question types to include: ${config.questionTypes || "factual,causal,counterfactual,normative"}`,
        };

      case "causal.explain":
        return {
          systemPrompt: `You are an expert in causal inference. Analyze simulation results to identify causal drivers.
Respond in JSON format:
{
  "causalGraph": {
    "nodes": [{"id": "var1", "name": "Variable 1"}],
    "edges": [{"source": "var1", "target": "var2", "strength": 0.5}]
  },
  "effects": [
    {"variable": "name", "effect": 0.35, "direction": "positive", "confidence": 0.8}
  ],
  "sensitivity": {
    "criticalVariables": ["var1", "var2"],
    "tornado": [{"variable": "var1", "lowImpact": -0.2, "highImpact": 0.3}]
  },
  "explanation": "narrative explanation"
}`,
          userPrompt: `Analyze the causal relationships in these simulation results:

Results: ${JSON.stringify(inputs.simulationResults || inputs, null, 2)}

Variables of interest: ${JSON.stringify(inputs.variables || [], null, 2)}

Method: ${config.method || "llm-reasoning"}`,
        };

      case "sim.scenario":
        return {
          systemPrompt: `You generate plausible scenarios for strategic analysis.
Respond in JSON format:
{
  "scenarios": [
    {
      "name": "Scenario name",
      "description": "Description",
      "probability": 0.0-1.0,
      "keyAssumptions": ["assumption 1"],
      "outcome": "Expected outcome",
      "implications": ["implication 1"]
    }
  ],
  "baseCase": "name of most likely scenario"
}`,
          userPrompt: `Generate ${config.count || 3} scenarios based on this base case:

${JSON.stringify(inputs.baseCase || inputs, null, 2)}

${config.includeWorstCase ? "Include a worst-case scenario." : ""}`,
        };

      case "sim.sensitivity":
        return {
          systemPrompt: `You identify key drivers and sensitivities in models.
Respond in JSON format:
{
  "drivers": [
    {
      "variable": "name",
      "impact": 0.0-1.0,
      "direction": "positive|negative",
      "elasticity": number,
      "uncertainty": "high|medium|low"
    }
  ],
  "criticalThresholds": [{"variable": "name", "threshold": value, "consequence": "what happens"}],
  "recommendations": ["recommendation 1"]
}`,
          userPrompt: `Analyze the sensitivity of this model:

${JSON.stringify(inputs.model || inputs, null, 2)}

Variation range: ±${config.range || 20}%`,
        };

      case "output.recommendation":
        return {
          systemPrompt: `You synthesize analysis into clear recommendations.
Respond in JSON format:
{
  "action": "Clear action to take",
  "confidence": 0.0-1.0,
  "confidenceInterval": [lower, upper],
  "reasoning": "Why this recommendation",
  "alternatives": ["alternative 1 if conditions change"],
  "monitoringTriggers": ["condition that should trigger re-evaluation"]
}`,
          userPrompt: `Based on this analysis, provide a ${config.style || "bluf"} recommendation:

${JSON.stringify(inputs.analysis || inputs, null, 2)}

${config.includeConfidence !== false ? "Include confidence level." : ""}`,
        };

      case "output.report":
        return {
          systemPrompt: `You create ${config.format || "executive"} reports for decision-makers.
Respond in JSON format:
{
  "title": "Report title",
  "executiveSummary": "1-2 paragraph summary",
  "sections": [
    {"heading": "Section name", "content": "Section content"}
  ],
  "recommendation": "Final recommendation",
  "appendix": ["Supporting detail 1"]
}`,
          userPrompt: `Create a ${config.format || "executive"} report based on:

Recommendation: ${JSON.stringify(inputs.recommendation || {}, null, 2)}

Evidence: ${JSON.stringify(inputs.evidence || [], null, 2)}`,
        };

      default:
        return {
          systemPrompt: "You are a helpful assistant. Respond in JSON format.",
          userPrompt: `Process this request:
Config: ${JSON.stringify(config, null, 2)}
Inputs: ${JSON.stringify(inputs, null, 2)}`,
        };
    }
  }

  private parseResponse(primitiveId: string, response: string): unknown {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Fall through to return raw response
      }
    }

    // Return structured response with raw text
    return {
      raw: response,
      parsed: false,
    };
  }
}
