import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

interface SuggestRequest {
  primitiveId: string;
  fieldKey: string;
  currentConfig: Record<string, unknown>;
  nodeInputs?: Record<string, { type: string; preview?: unknown }>;
  workflowContext: {
    question?: string;
    domain?: "enterprise" | "defense" | "policy" | "consumer";
    attachedData?: {
      schema: { fields: Array<{ name: string; type: string }> };
      sampleRows: unknown[];
      filename?: string;
    };
  };
}

interface SuggestResponse {
  suggestion: unknown;
  reasoning: string;
  alternatives?: unknown[];
  confidence: number;
}

// Primitive field metadata for context
const FIELD_METADATA: Record<string, Record<string, { description: string; examples: unknown[] }>> = {
  "sim.montecarlo.oasis": {
    populationId: {
      description: "Target demographic population to simulate",
      examples: ["us_consumers", "enterprise_decision_makers", "defense_stakeholders"],
    },
    sampleSize: {
      description: "Number of synthetic agents to simulate. Higher = more confidence but higher cost",
      examples: [200, 1000, 5000],
    },
    question: {
      description: "The survey question each synthetic agent will answer",
      examples: [
        "Would you pay $50/month for this productivity tool?",
        "How likely are you to switch from your current provider? (1-10)",
      ],
    },
    archetypeCount: {
      description: "Number of distinct persona archetypes to generate",
      examples: [20, 50, 100],
    },
  },
  "game.equilibrium": {
    actors: {
      description: "The strategic actors/players in the game. Each needs name, objectives, and capabilities",
      examples: [
        [
          { name: "Incumbent", objectives: ["maintain market share", "maximize margins"], capabilities: ["brand recognition", "existing customer base"] },
          { name: "Disruptor", objectives: ["gain market share", "establish brand"], capabilities: ["lower costs", "innovative product"] },
        ],
      ],
    },
    equilibriumType: {
      description: "Type of game-theoretic equilibrium to compute",
      examples: ["nash", "stackelberg", "pareto"],
    },
    maxRounds: {
      description: "Maximum negotiation/strategy rounds to simulate",
      examples: [3, 5, 10],
    },
  },
  "reason.analyze": {
    focus: {
      description: "Specific aspects to focus analysis on",
      examples: [
        "market dynamics, competitive positioning, risk factors",
        "financial implications, ROI projections, break-even analysis",
        "strategic opportunities, threats, recommendations",
      ],
    },
  },
  "reason.compare": {
    criteria: {
      description: "Evaluation criteria for comparison",
      examples: [
        "cost, speed, effectiveness",
        "cost, implementation complexity, time to value, risk level, scalability",
      ],
    },
  },
  "defense.threat-assessment": {
    adversary: {
      description: "The threat actor or adversary to assess",
      examples: ["nation-state actor", "cyber criminal group", "insider threat"],
    },
    threatLevel: {
      description: "Assumed threat severity level",
      examples: ["low", "medium", "high", "critical"],
    },
    focus: {
      description: "Focus area of the threat assessment",
      examples: ["capabilities", "intentions", "vulnerabilities"],
    },
  },
  "defense.red-team": {
    adversaryProfile: {
      description: "Type of adversary to emulate",
      examples: ["near-peer", "regional-power", "non-state", "cyber-criminal"],
    },
    aggressiveness: {
      description: "How aggressive the red team analysis should be",
      examples: ["conservative", "moderate", "aggressive", "opportunistic"],
    },
  },
  "output.report": {
    format: {
      description: "Report format and detail level",
      examples: ["executive", "detailed", "technical", "briefing"],
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const body: SuggestRequest = await request.json();
    const { primitiveId, fieldKey, currentConfig, nodeInputs, workflowContext } = body;

    // Get field metadata
    const primitiveFields = FIELD_METADATA[primitiveId] || {};
    const fieldMeta = primitiveFields[fieldKey] || { description: "Configuration field", examples: [] };

    // Build context-aware prompt
    const systemPrompt = `You are an AI assistant helping configure decision analysis workflows.
You suggest optimal configuration values based on the user's context and goals.
Be concise and practical. Return JSON with your suggestion.`;

    const contextParts: string[] = [];

    if (workflowContext.question) {
      contextParts.push(`User's main question/goal: "${workflowContext.question}"`);
    }

    if (workflowContext.domain) {
      contextParts.push(`Domain: ${workflowContext.domain}`);
    }

    if (workflowContext.attachedData) {
      const { schema, sampleRows, filename } = workflowContext.attachedData;
      contextParts.push(`Attached data file: ${filename || "unknown"}`);
      contextParts.push(`Data schema: ${JSON.stringify(schema.fields.map(f => `${f.name}:${f.type}`))}`);
      if (sampleRows.length > 0) {
        contextParts.push(`Sample data (first row): ${JSON.stringify(sampleRows[0])}`);
      }
    }

    if (nodeInputs && Object.keys(nodeInputs).length > 0) {
      contextParts.push(`Connected inputs: ${JSON.stringify(nodeInputs)}`);
    }

    if (Object.keys(currentConfig).length > 0) {
      contextParts.push(`Current config: ${JSON.stringify(currentConfig)}`);
    }

    const userPrompt = `Suggest a value for the "${fieldKey}" field in the "${primitiveId}" primitive.

Field description: ${fieldMeta.description}
Example values: ${JSON.stringify(fieldMeta.examples)}

${contextParts.length > 0 ? "Context:\n" + contextParts.join("\n") : "No additional context provided."}

Return a JSON object with:
- suggestion: the recommended value (matching the field's expected type)
- reasoning: 1-2 sentence explanation of why this value is optimal
- alternatives: array of 2-3 alternative values if applicable
- confidence: number 0-1 indicating how confident you are

Return ONLY the JSON object, no markdown or explanation.`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 500,
      messages: [
        { role: "user", content: userPrompt },
      ],
      system: systemPrompt,
    });

    // Extract text response
    const textContent = response.content.find(c => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from AI");
    }

    // Parse JSON response
    let result: SuggestResponse;
    try {
      // Try to extract JSON from response (handle potential markdown wrapping)
      let jsonStr = textContent.text.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      }
      result = JSON.parse(jsonStr);
    } catch {
      // If JSON parsing fails, construct a basic response
      result = {
        suggestion: fieldMeta.examples[0] || null,
        reasoning: "Based on common usage patterns for this field type.",
        confidence: 0.5,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Config suggestion error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Suggestion failed" },
      { status: 500 }
    );
  }
}

// Batch suggestion endpoint - suggest all fields at once
export async function PUT(request: NextRequest) {
  try {
    const body: Omit<SuggestRequest, "fieldKey"> & { fieldKeys: string[] } = await request.json();
    const { primitiveId, fieldKeys, currentConfig, nodeInputs, workflowContext } = body;

    const primitiveFields = FIELD_METADATA[primitiveId] || {};

    const systemPrompt = `You are an AI assistant helping configure decision analysis workflows.
You suggest optimal configuration values based on the user's context and goals.
Be concise and practical. Return JSON with suggestions for multiple fields.`;

    const contextParts: string[] = [];

    if (workflowContext.question) {
      contextParts.push(`User's main question/goal: "${workflowContext.question}"`);
    }

    if (workflowContext.domain) {
      contextParts.push(`Domain: ${workflowContext.domain}`);
    }

    if (workflowContext.attachedData) {
      const { schema, sampleRows, filename } = workflowContext.attachedData;
      contextParts.push(`Attached data file: ${filename || "unknown"}`);
      contextParts.push(`Data schema: ${JSON.stringify(schema.fields.map(f => `${f.name}:${f.type}`))}`);
      if (sampleRows.length > 0) {
        contextParts.push(`Sample data (first row): ${JSON.stringify(sampleRows[0])}`);
      }
    }

    if (nodeInputs && Object.keys(nodeInputs).length > 0) {
      contextParts.push(`Connected inputs: ${JSON.stringify(nodeInputs)}`);
    }

    const fieldsInfo = fieldKeys.map(key => {
      const meta = primitiveFields[key] || { description: "Configuration field", examples: [] };
      return `- ${key}: ${meta.description} (examples: ${JSON.stringify(meta.examples)})`;
    }).join("\n");

    const userPrompt = `Suggest values for these fields in the "${primitiveId}" primitive:

${fieldsInfo}

${contextParts.length > 0 ? "Context:\n" + contextParts.join("\n") : "No additional context provided."}

Current config: ${JSON.stringify(currentConfig)}

Return a JSON object where keys are field names and values are objects with:
- suggestion: the recommended value
- reasoning: brief explanation
- confidence: number 0-1

Return ONLY the JSON object.`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1000,
      messages: [
        { role: "user", content: userPrompt },
      ],
      system: systemPrompt,
    });

    const textContent = response.content.find(c => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from AI");
    }

    let result: Record<string, SuggestResponse>;
    try {
      let jsonStr = textContent.text.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      }
      result = JSON.parse(jsonStr);
    } catch {
      // Fallback to empty suggestions
      result = {};
      fieldKeys.forEach(key => {
        const meta = primitiveFields[key];
        result[key] = {
          suggestion: meta?.examples[0] || null,
          reasoning: "Default suggestion",
          confidence: 0.3,
        };
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Batch config suggestion error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Batch suggestion failed" },
      { status: 500 }
    );
  }
}
