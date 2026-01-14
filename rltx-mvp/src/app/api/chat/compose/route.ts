import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { primitives, primitiveCategories } from "@/lib/primitives";
import { nanoid } from "nanoid";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Build system prompt with all primitives
function buildSystemPrompt() {
  const primitivesByCategory: Record<string, string[]> = {};

  for (const [id, p] of Object.entries(primitives)) {
    if (!primitivesByCategory[p.category]) {
      primitivesByCategory[p.category] = [];
    }
    primitivesByCategory[p.category].push(
      `  - ${id}: ${p.description} [inputs: ${p.inputs.map(i => i.name).join(", ") || "none"}, outputs: ${p.outputs.map(o => o.name).join(", ")}]`
    );
  }

  const categorizedPrimitives = Object.entries(primitivesByCategory)
    .map(([cat, prims]) => `${cat.toUpperCase()}:\n${prims.join("\n")}`)
    .join("\n\n");

  return `You are RLTX, an expert AI workflow composer for analytical decision-making. You help users build sophisticated multi-agent simulation workflows.

AVAILABLE PRIMITIVES BY CATEGORY:

${categorizedPrimitives}

WORKFLOW DESIGN PRINCIPLES:
1. DATA nodes fetch and prepare inputs
2. REASON nodes analyze and synthesize using Claude
3. SIMULATE nodes run Monte Carlo, scenarios, game theory
4. HUMAN nodes collect input or approvals
5. OUTPUT nodes generate recommendations and reports
6. CONTROL nodes handle branching, loops, and merging

When composing workflows:
- Start with data gathering (data.* primitives)
- Use reason.analyze for initial understanding
- Add simulations for uncertainty quantification
- Include reason.critique for pre-mortem analysis
- End with output.recommendation for actionable results
- Use control.merge when combining multiple analysis branches

RESPONSE FORMAT (JSON only):
{
  "message": "Brief explanation of the workflow and what it does",
  "workflow": {
    "name": "Descriptive workflow name",
    "nodes": [
      {"primitiveId": "data.input", "label": "Define Context", "config": {"dataType": "json"}},
      {"primitiveId": "reason.analyze", "label": "Initial Analysis", "config": {"focus": "key drivers"}}
    ],
    "edges": [
      {"source": 0, "target": 1}
    ]
  }
}

IMPORTANT:
- Edges use node array indices (0-indexed)
- Include relevant config values for each primitive
- Create logical data flow - every non-source node needs incoming edge
- Use parallel branches when appropriate (multiple edges from same source)
- Typical workflows have 4-10 nodes
- Always include uncertainty quantification for important decisions`;
}

const SYSTEM_PROMPT = buildSystemPrompt();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, workflowId } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      // Return mock response for demo
      return NextResponse.json(getMockResponse(message));
    }

    // Call Anthropic API
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
    });

    // Parse response
    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    let parsed;
    try {
      parsed = JSON.parse(content.text);
    } catch {
      // If JSON parsing fails, return as plain message
      return NextResponse.json({
        message: content.text,
        workflow: null,
      });
    }

    // Transform workflow if present
    if (parsed.workflow) {
      const transformedWorkflow = transformWorkflow(parsed.workflow);
      return NextResponse.json({
        message: parsed.message,
        workflow: transformedWorkflow,
      });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Compose error:", error);
    return NextResponse.json(
      { error: "Failed to compose workflow" },
      { status: 500 }
    );
  }
}

// Transform AI response into ReactFlow format
function transformWorkflow(workflow: {
  name: string;
  nodes: Array<{ primitiveId: string; label: string; config?: Record<string, unknown> }>;
  edges: Array<{ source: number; target: number }>;
}) {
  const nodeIds: string[] = [];

  const nodes = workflow.nodes.map((node, index) => {
    const primitive = primitives[node.primitiveId];
    const id = `${node.primitiveId.replace(/\./g, "-")}-${nanoid(6)}`;
    nodeIds.push(id);

    return {
      id,
      type: "primitive",
      position: {
        x: 100 + (index % 3) * 250,
        y: 100 + Math.floor(index / 3) * 150,
      },
      data: {
        primitiveId: node.primitiveId,
        label: node.label,
        icon: primitive?.icon || "📦",
        color: primitive?.color || "#6366f1",
        config: node.config || {},
        state: "idle",
      },
    };
  });

  const edges = workflow.edges.map((edge, index) => ({
    id: `edge-${index}`,
    source: nodeIds[edge.source],
    target: nodeIds[edge.target],
    animated: true,
    style: { stroke: "#6366f1", strokeWidth: 2 },
  }));

  return {
    id: nanoid(),
    name: workflow.name,
    nodeCount: nodes.length,
    nodes,
    edges,
  };
}

// Mock response for demo without API key
function getMockResponse(message: string) {
  const lowerMessage = message.toLowerCase();

  // Market expansion / growth analysis
  if (lowerMessage.includes("market") || lowerMessage.includes("expand") || lowerMessage.includes("growth")) {
    return {
      message:
        "I've composed a comprehensive market expansion analysis workflow. It gathers market data, analyzes the opportunity across multiple dimensions, runs Monte Carlo simulations for financial projections, evaluates risks through pre-mortem analysis, and generates an actionable recommendation with confidence intervals.",
      workflow: transformWorkflow({
        name: "Market Expansion Analysis",
        nodes: [
          { primitiveId: "data.input", label: "Define Expansion Context", config: { dataType: "json" } },
          { primitiveId: "data.api.fetch", label: "Fetch Market Data", config: { method: "GET" } },
          { primitiveId: "reason.analyze", label: "Market Opportunity Analysis", config: { focus: "market size, competition, barriers to entry" } },
          { primitiveId: "sim.scenario", label: "Scenario Planning", config: { count: 4, includeWorstCase: true } },
          { primitiveId: "sim.montecarlo.oasis", label: "Financial Projections", config: { rollouts: 1000, populationSize: 500 } },
          { primitiveId: "reason.critique", label: "Pre-Mortem Analysis", config: { perspective: "skeptic" } },
          { primitiveId: "control.merge", label: "Consolidate Analysis", config: { strategy: "object" } },
          { primitiveId: "output.recommendation", label: "Generate Recommendation", config: { style: "bluf", includeConfidence: true } },
        ],
        edges: [
          { source: 0, target: 1 },
          { source: 0, target: 2 },
          { source: 1, target: 2 },
          { source: 2, target: 3 },
          { source: 2, target: 4 },
          { source: 3, target: 6 },
          { source: 4, target: 5 },
          { source: 5, target: 6 },
          { source: 6, target: 7 },
        ],
      }),
    };
  }

  // Vendor/provider comparison
  if (lowerMessage.includes("compare") || lowerMessage.includes("vendor") || lowerMessage.includes("provider") || lowerMessage.includes("choose")) {
    return {
      message:
        "I've built a multi-criteria vendor comparison workflow. It defines your requirements, gathers data on each option in parallel, performs systematic comparison, simulates long-term outcomes, and generates a ranked recommendation.",
      workflow: transformWorkflow({
        name: "Vendor Comparison Analysis",
        nodes: [
          { primitiveId: "data.input", label: "Define Requirements", config: { dataType: "json" } },
          { primitiveId: "data.api.fetch", label: "Vendor A Data", config: { method: "GET" } },
          { primitiveId: "data.api.fetch", label: "Vendor B Data", config: { method: "GET" } },
          { primitiveId: "reason.analyze", label: "Feature Analysis", config: { focus: "capabilities, limitations, pricing" } },
          { primitiveId: "reason.compare", label: "Systematic Comparison", config: { criteria: "cost, features, support, scalability, security" } },
          { primitiveId: "sim.sensitivity", label: "Cost Sensitivity Analysis", config: { range: 25 } },
          { primitiveId: "reason.steelman", label: "Best Case for Runner-Up", config: {} },
          { primitiveId: "output.report", label: "Comparison Report", config: { format: "executive" } },
        ],
        edges: [
          { source: 0, target: 1 },
          { source: 0, target: 2 },
          { source: 1, target: 3 },
          { source: 2, target: 3 },
          { source: 3, target: 4 },
          { source: 4, target: 5 },
          { source: 4, target: 6 },
          { source: 5, target: 7 },
          { source: 6, target: 7 },
        ],
      }),
    };
  }

  // Investment / financial decision
  if (lowerMessage.includes("invest") || lowerMessage.includes("roi") || lowerMessage.includes("financial") || lowerMessage.includes("budget")) {
    return {
      message:
        "I've composed an investment analysis workflow with Monte Carlo simulation for uncertainty quantification. It analyzes the investment thesis, simulates financial outcomes, performs sensitivity analysis to identify key drivers, and generates a recommendation with confidence intervals.",
      workflow: transformWorkflow({
        name: "Investment Analysis",
        nodes: [
          { primitiveId: "data.input", label: "Investment Parameters", config: { dataType: "json" } },
          { primitiveId: "reason.analyze", label: "Investment Thesis Analysis", config: { focus: "value drivers, risks, timing" } },
          { primitiveId: "sim.montecarlo.oasis", label: "Return Distribution", config: { rollouts: 2000, populationSize: 1000 } },
          { primitiveId: "sim.sensitivity", label: "Key Driver Analysis", config: { range: 30 } },
          { primitiveId: "causal.explain", label: "Causal Analysis", config: { method: "llm-reasoning", includeTornadoChart: true } },
          { primitiveId: "uncertainty.aggregate", label: "Aggregate Uncertainty", config: { separateEpistemic: true } },
          { primitiveId: "output.chart", label: "Distribution Visualization", config: { chartType: "tornado", interactive: true } },
          { primitiveId: "output.recommendation", label: "Investment Recommendation", config: { style: "detailed", includeConfidence: true } },
        ],
        edges: [
          { source: 0, target: 1 },
          { source: 1, target: 2 },
          { source: 2, target: 3 },
          { source: 2, target: 4 },
          { source: 3, target: 5 },
          { source: 4, target: 5 },
          { source: 5, target: 6 },
          { source: 5, target: 7 },
        ],
      }),
    };
  }

  // Risk assessment
  if (lowerMessage.includes("risk") || lowerMessage.includes("threat") || lowerMessage.includes("security")) {
    return {
      message:
        "I've built a comprehensive risk assessment workflow. It decomposes risks into sub-categories, analyzes each dimension, runs adversarial scenarios, and generates a risk matrix with mitigation recommendations.",
      workflow: transformWorkflow({
        name: "Risk Assessment",
        nodes: [
          { primitiveId: "data.input", label: "Risk Context", config: { dataType: "json" } },
          { primitiveId: "decompose.question", label: "Risk Decomposition", config: { maxDepth: 2 } },
          { primitiveId: "reason.analyze", label: "Risk Analysis", config: { focus: "likelihood, impact, velocity" } },
          { primitiveId: "sim.scenario", label: "Risk Scenarios", config: { count: 5, includeWorstCase: true } },
          { primitiveId: "reason.critique", label: "Adversarial Analysis", config: { perspective: "competitor" } },
          { primitiveId: "control.merge", label: "Consolidate Risks", config: { strategy: "array" } },
          { primitiveId: "output.report", label: "Risk Report", config: { format: "detailed" } },
        ],
        edges: [
          { source: 0, target: 1 },
          { source: 1, target: 2 },
          { source: 2, target: 3 },
          { source: 2, target: 4 },
          { source: 3, target: 5 },
          { source: 4, target: 5 },
          { source: 5, target: 6 },
        ],
      }),
    };
  }

  // Strategy / planning
  if (lowerMessage.includes("strateg") || lowerMessage.includes("plan") || lowerMessage.includes("roadmap")) {
    return {
      message:
        "I've composed a strategic planning workflow with scenario analysis and game theory. It analyzes the strategic landscape, models competitor responses, evaluates multiple scenarios, and generates a strategic recommendation.",
      workflow: transformWorkflow({
        name: "Strategic Planning",
        nodes: [
          { primitiveId: "data.input", label: "Strategic Context", config: { dataType: "json" } },
          { primitiveId: "reason.analyze", label: "Landscape Analysis", config: { focus: "market position, capabilities, opportunities" } },
          { primitiveId: "game.equilibrium", label: "Competitive Dynamics", config: { equilibriumType: "nash", useAgentNegotiation: true } },
          { primitiveId: "sim.scenario", label: "Strategic Scenarios", config: { count: 4, includeWorstCase: true } },
          { primitiveId: "branch.counterfactual", label: "Strategy Branches", config: { parallelExecution: true } },
          { primitiveId: "reason.compare", label: "Strategy Comparison", config: { criteria: "risk-adjusted return, feasibility, time to value" } },
          { primitiveId: "output.recommendation", label: "Strategic Recommendation", config: { style: "bluf", includeConfidence: true } },
        ],
        edges: [
          { source: 0, target: 1 },
          { source: 1, target: 2 },
          { source: 1, target: 3 },
          { source: 2, target: 4 },
          { source: 3, target: 4 },
          { source: 4, target: 5 },
          { source: 5, target: 6 },
        ],
      }),
    };
  }

  // Default - general decision analysis
  return {
    message:
      "I've composed a general decision analysis workflow. It breaks down your question, analyzes it from multiple perspectives, identifies risks through pre-mortem analysis, and generates an actionable recommendation.",
    workflow: transformWorkflow({
      name: "Decision Analysis",
      nodes: [
        { primitiveId: "data.input", label: "Define Decision Context", config: { dataType: "json" } },
        { primitiveId: "decompose.question", label: "Break Down Question", config: { maxDepth: 2 } },
        { primitiveId: "reason.analyze", label: "Multi-Dimensional Analysis", config: { focus: "pros, cons, second-order effects" } },
        { primitiveId: "reason.critique", label: "Pre-Mortem Review", config: { perspective: "skeptic" } },
        { primitiveId: "sim.scenario", label: "Outcome Scenarios", config: { count: 3, includeWorstCase: true } },
        { primitiveId: "output.recommendation", label: "Final Recommendation", config: { style: "bluf", includeConfidence: true } },
      ],
      edges: [
        { source: 0, target: 1 },
        { source: 1, target: 2 },
        { source: 2, target: 3 },
        { source: 2, target: 4 },
        { source: 3, target: 5 },
        { source: 4, target: 5 },
      ],
    }),
  };
}
