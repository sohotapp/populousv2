import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { primitives } from "@/lib/primitives";
import { nanoid } from "nanoid";
import {
  CANONICAL_PATTERNS,
  detectPattern,
  generatePatternPromptSection,
  generateFewShotExamples,
} from "@/lib/composition";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Build system prompt with primitives and canonical patterns
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

  const patternSection = generatePatternPromptSection();
  const fewShotExamples = generateFewShotExamples();

  return `You are RLTX, an expert AI workflow composer for multi-agent behavioral simulation.
You help analysts and decision-makers build sophisticated simulation workflows to predict human behavior.

CORE CAPABILITY:
RLTX simulates how populations of people (consumers, voters, adversaries) would respond to scenarios
using LLM-powered agents. Each agent is given a realistic persona and asked to respond authentically.

${patternSection}

AVAILABLE PRIMITIVES BY CATEGORY:

${categorizedPrimitives}

WORKFLOW DESIGN PRINCIPLES:
1. DATA nodes fetch and prepare inputs (populations, context)
2. REASON nodes analyze and synthesize using Claude
3. SIMULATE nodes run agent-based simulations:
   - sim.montecarlo.oasis: Survey population of agents
   - game.equilibrium: Model strategic actors (competitors, adversaries)
   - sim.abm: Model opinion/adoption dynamics over time
4. HUMAN nodes collect input or approvals
5. OUTPUT nodes generate recommendations and reports
6. CONTROL nodes handle branching, loops, and merging

PATTERN-BASED COMPOSITION:
When a user's request matches a canonical pattern:
1. Identify which pattern applies based on trigger phrases
2. Use the pattern's template structure
3. Parameterize it with user-specific context
4. Include the "pattern" field in your response

${fewShotExamples}

RESPONSE FORMAT (JSON only):
{
  "message": "Brief explanation of what the simulation will reveal",
  "pattern": "pattern_id_if_applicable",
  "workflow": {
    "name": "Descriptive workflow name",
    "nodes": [
      {"primitiveId": "data.input", "label": "Define Context", "config": {"dataType": "json"}},
      {"primitiveId": "data.population.sample", "label": "Sample Population", "config": {"populationId": "us_consumers", "sampleSize": 1000}},
      {"primitiveId": "sim.montecarlo.oasis", "label": "Agent Survey", "config": {"rollouts": 100, "question": "..."}}
    ],
    "edges": [
      {"source": 0, "target": 1},
      {"source": 1, "target": 2}
    ]
  }
}

IMPORTANT:
- Edges use node array indices (0-indexed)
- Include relevant config values for each primitive
- Create logical data flow - every non-source node needs incoming edge
- Use parallel branches when appropriate (multiple edges from same source)
- Behavioral simulations should use data.population.sample + sim.montecarlo.oasis
- Strategic/adversarial simulations should use game.equilibrium
- Include segment analysis for consumer surveys
- Always specify populationId and sampleSize for population sampling`;
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

// Mock response for demo without API key - uses canonical patterns
function getMockResponse(message: string) {
  const lowerMessage = message.toLowerCase();

  // Pattern 1: Consumer Survey - "would customers", "what percent", "how do people"
  if (
    lowerMessage.includes("would customer") ||
    lowerMessage.includes("what percent") ||
    lowerMessage.includes("how many would") ||
    lowerMessage.includes("consumer") ||
    lowerMessage.includes("would user") ||
    lowerMessage.includes("customer willingness") ||
    lowerMessage.includes("adoption rate")
  ) {
    return {
      message:
        "I'll simulate how your target population would respond to this question using agent-based modeling. Each agent represents a realistic persona and will respond authentically based on their demographics and psychology.",
      pattern: "consumer_survey",
      workflow: transformWorkflow({
        name: "Consumer Survey Simulation",
        nodes: [
          { primitiveId: "data.input", label: "Survey Context", config: { dataType: "json" } },
          { primitiveId: "data.population.sample", label: "Sample Population", config: { populationId: "us_consumers", sampleSize: 1000, useArchetypes: true } },
          { primitiveId: "sim.montecarlo.oasis", label: "Survey Simulation", config: { rollouts: 100, question: message, responseFormat: "yes_no_maybe" } },
          { primitiveId: "reason.analyze", label: "Segment Analysis", config: { focus: "demographic segments, willingness drivers, barriers" } },
          { primitiveId: "output.report", label: "Survey Results", config: { format: "detailed", includeSegments: true } },
        ],
        edges: [
          { source: 0, target: 1 },
          { source: 1, target: 2 },
          { source: 2, target: 3 },
          { source: 3, target: 4 },
        ],
      }),
    };
  }

  // Pattern 2: Change Impact - "what if we", "impact of", "effect of"
  if (
    lowerMessage.includes("what if we") ||
    lowerMessage.includes("impact of") ||
    lowerMessage.includes("effect of") ||
    lowerMessage.includes("if we increase") ||
    lowerMessage.includes("if we decrease") ||
    lowerMessage.includes("price elasticity") ||
    lowerMessage.includes("sensitivity")
  ) {
    return {
      message:
        "I'll analyze how this change would affect behavior across different scenarios. The simulation will test multiple variations and compare outcomes to identify tipping points and segment-specific impacts.",
      pattern: "change_impact",
      workflow: transformWorkflow({
        name: "Change Impact Analysis",
        nodes: [
          { primitiveId: "data.input", label: "Change Context", config: { dataType: "json" } },
          { primitiveId: "data.population.sample", label: "Sample Population", config: { populationId: "us_consumers", sampleSize: 1000, useArchetypes: true } },
          { primitiveId: "sim.scenario", label: "Generate Scenarios", config: { count: 5, baseVariable: "change_percent", range: [-30, -15, 0, 15, 30] } },
          { primitiveId: "branch.counterfactual", label: "Parallel Simulations", config: { parallelExecution: true } },
          { primitiveId: "sim.montecarlo.oasis", label: "Behavior Simulation", config: { rollouts: 100, question: message } },
          { primitiveId: "control.merge", label: "Combine Results", config: { strategy: "object" } },
          { primitiveId: "reason.compare", label: "Impact Comparison", config: { criteria: "adoption rate, revenue impact, segment shifts" } },
          { primitiveId: "output.chart", label: "Impact Visualization", config: { chartType: "sensitivity", interactive: true } },
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
      }),
    };
  }

  // Pattern 3: Competitive Response - "competitor", "how will they respond"
  if (
    lowerMessage.includes("competitor") ||
    lowerMessage.includes("how will they respond") ||
    lowerMessage.includes("competitive") ||
    lowerMessage.includes("rival") ||
    lowerMessage.includes("pricing war") ||
    lowerMessage.includes("market share")
  ) {
    return {
      message:
        "I'll model competitive dynamics using game theory to predict how rivals will respond, then simulate how customers will react to the resulting market conditions. Each competitor is modeled as a strategic actor with their own objectives.",
      pattern: "competitive_response",
      workflow: transformWorkflow({
        name: "Competitive Response Analysis",
        nodes: [
          { primitiveId: "data.input", label: "Competitive Context", config: { dataType: "json" } },
          { primitiveId: "game.equilibrium", label: "Competitor Response Model", config: { equilibriumType: "nash", useAgentNegotiation: true } },
          { primitiveId: "sim.scenario", label: "Market Scenarios", config: { count: 4, includeWorstCase: true } },
          { primitiveId: "data.population.sample", label: "Sample Customers", config: { populationId: "us_consumers", sampleSize: 500 } },
          { primitiveId: "branch.counterfactual", label: "Scenario Branches", config: { parallelExecution: true } },
          { primitiveId: "sim.montecarlo.oasis", label: "Customer Choice Simulation", config: { rollouts: 100, question: "Which provider would you choose?" } },
          { primitiveId: "control.merge", label: "Consolidate Outcomes", config: { strategy: "object" } },
          { primitiveId: "reason.analyze", label: "Strategic Analysis", config: { focus: "optimal timing, risk factors, competitive moats" } },
          { primitiveId: "output.recommendation", label: "Strategic Recommendation", config: { style: "bluf", includeConfidence: true } },
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
      }),
    };
  }

  // Pattern 4: Wargame - "adversary", "nation state", "escalation"
  if (
    lowerMessage.includes("adversary") ||
    lowerMessage.includes("nation") ||
    lowerMessage.includes("escalation") ||
    lowerMessage.includes("wargame") ||
    lowerMessage.includes("geopolitical") ||
    lowerMessage.includes("military") ||
    lowerMessage.includes("deterrence") ||
    lowerMessage.includes("conflict")
  ) {
    return {
      message:
        "I'll run a strategic wargame simulation modeling adversarial dynamics between actors. Each actor is given realistic objectives and constraints, and the simulation finds equilibrium strategies through iterated best-response.",
      pattern: "wargame",
      workflow: transformWorkflow({
        name: "Strategic Wargame Simulation",
        nodes: [
          { primitiveId: "data.input", label: "Strategic Context", config: { dataType: "json" } },
          { primitiveId: "game.equilibrium", label: "Strategic Simulation", config: { equilibriumType: "nash", domain: "defense", maxRounds: 5, useAgentNegotiation: true } },
          { primitiveId: "reason.analyze", label: "Equilibrium Analysis", config: { focus: "stability, escalation risk, off-ramps" } },
          { primitiveId: "sim.scenario", label: "Escalation Scenarios", config: { count: 4, includeWorstCase: true } },
          { primitiveId: "reason.critique", label: "Red Team Analysis", config: { perspective: "adversary" } },
          { primitiveId: "control.merge", label: "Consolidate Analysis", config: { strategy: "object" } },
          { primitiveId: "output.report", label: "Strategic Assessment", config: { format: "detailed" } },
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
      }),
    };
  }

  // Pattern 5: Opinion Dynamics - "spread", "viral", "adoption over time"
  if (
    lowerMessage.includes("spread") ||
    lowerMessage.includes("viral") ||
    lowerMessage.includes("adoption over time") ||
    lowerMessage.includes("diffusion") ||
    lowerMessage.includes("network effect") ||
    lowerMessage.includes("word of mouth")
  ) {
    return {
      message:
        "I'll simulate how this spreads through a population over time using agent-based modeling. The simulation models social network effects and identifies tipping points and key influencer segments.",
      pattern: "opinion_dynamics",
      workflow: transformWorkflow({
        name: "Opinion Dynamics Simulation",
        nodes: [
          { primitiveId: "data.input", label: "Diffusion Context", config: { dataType: "json" } },
          { primitiveId: "data.population.sample", label: "Sample Network", config: { populationId: "us_adults", sampleSize: 5000, includeNetworkStructure: true } },
          { primitiveId: "sim.abm", label: "Agent-Based Model", config: { timeSteps: 52, interactionModel: "bass_diffusion", seedPercentage: 2 } },
          { primitiveId: "reason.analyze", label: "Diffusion Analysis", config: { focus: "adoption curve, tipping points, influencer segments" } },
          { primitiveId: "sim.sensitivity", label: "Factor Sensitivity", config: { range: 50 } },
          { primitiveId: "output.chart", label: "Adoption Curve", config: { chartType: "line", interactive: true } },
          { primitiveId: "output.report", label: "Diffusion Report", config: { format: "detailed" } },
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
      }),
    };
  }

  // Pattern 6: Counterfactual - "compare a vs b", "which option"
  if (
    lowerMessage.includes("compare") ||
    lowerMessage.includes("which option") ||
    lowerMessage.includes("a/b") ||
    lowerMessage.includes("versus") ||
    lowerMessage.includes(" vs ") ||
    lowerMessage.includes("trade-off") ||
    lowerMessage.includes("which is better")
  ) {
    return {
      message:
        "I'll compare these options by simulating how the population would respond to each. Each option is tested against the same representative sample to ensure fair comparison.",
      pattern: "counterfactual",
      workflow: transformWorkflow({
        name: "Counterfactual Comparison",
        nodes: [
          { primitiveId: "data.input", label: "Options Context", config: { dataType: "json" } },
          { primitiveId: "data.population.sample", label: "Sample Population", config: { populationId: "us_consumers", sampleSize: 1000, useArchetypes: true } },
          { primitiveId: "branch.counterfactual", label: "Option Branches", config: { parallelExecution: true } },
          { primitiveId: "sim.montecarlo.oasis", label: "Option A Simulation", config: { rollouts: 100 } },
          { primitiveId: "sim.montecarlo.oasis", label: "Option B Simulation", config: { rollouts: 100 } },
          { primitiveId: "control.merge", label: "Combine Results", config: { strategy: "object" } },
          { primitiveId: "reason.compare", label: "Head-to-Head Analysis", config: { criteria: "adoption, revenue, satisfaction" } },
          { primitiveId: "reason.steelman", label: "Best Case for Runner-Up", config: {} },
          { primitiveId: "output.recommendation", label: "Final Recommendation", config: { style: "bluf", includeConfidence: true } },
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
      }),
    };
  }

  // Default - Consumer Survey pattern for general questions
  return {
    message:
      "I'll simulate how people would respond to this question using agent-based modeling. Each agent represents a realistic persona with demographics and psychology.",
    pattern: "consumer_survey",
    workflow: transformWorkflow({
      name: "Behavioral Simulation",
      nodes: [
        { primitiveId: "data.input", label: "Context", config: { dataType: "json" } },
        { primitiveId: "data.population.sample", label: "Sample Population", config: { populationId: "us_adults", sampleSize: 1000, useArchetypes: true } },
        { primitiveId: "sim.montecarlo.oasis", label: "Agent Survey", config: { rollouts: 100, question: message } },
        { primitiveId: "reason.analyze", label: "Response Analysis", config: { focus: "key drivers, segment differences" } },
        { primitiveId: "output.report", label: "Results", config: { format: "detailed" } },
      ],
      edges: [
        { source: 0, target: 1 },
        { source: 1, target: 2 },
        { source: 2, target: 3 },
        { source: 3, target: 4 },
      ],
    }),
  };
}
