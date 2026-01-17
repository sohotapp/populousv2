import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { primitives, categories } from "@/lib/primitives";
import { nanoid } from "nanoid";
import {
  CANONICAL_PATTERNS,
  detectPattern,
  generatePatternPromptSection,
  generateFewShotExamples,
} from "@/lib/composition";
import {
  selectPattern,
  playbookPatterns,
  playbookToReactFlow,
  type PlaybookPattern,
  type PatternType,
} from "@/lib/primitives/presets";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Primitive ID mapping from old IDs to new spec-compliant IDs
const PRIMITIVE_ID_MAP: Record<string, string> = {
  // Data/Population
  "data.input": "population.sample",
  "data.population.sample": "population.sample",
  "data.population.filter": "population.filter",
  "data.population.segment": "population.segment",
  // Simulation/Orchestration
  "sim.montecarlo.oasis": "orchestrate.monte_carlo",
  "sim.montecarlo": "orchestrate.monte_carlo",
  "game.equilibrium": "orchestrate.game_theory",
  "sim.abm": "orchestrate.abm",
  "sim.scenario": "branch.scenario",
  "sim.sensitivity": "analyze.sensitivity",
  // Reasoning/Analysis
  "reason.analyze": "analyze.factors",
  "reason.compare": "branch.compare",
  "reason.critique": "analyze.uncertainty",
  "reason.steelman": "analyze.factors",
  // Control/Branch
  "branch.counterfactual": "branch.scenario",
  "control.merge": "branch.merge",
  // Output
  "output.report": "aggregate.distribution",
  "output.chart": "aggregate.distribution",
  "output.recommendation": "aggregate.consensus",
};

// Conversation history message type
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  hasWorkflow?: boolean;
}

// Current workflow state from canvas
interface CurrentWorkflowState {
  nodes: Array<{
    id: string;
    primitiveId?: string;
    label?: string;
    config?: unknown;
  }>;
  edges: Array<{
    source: string;
    target: string;
  }>;
}

// Intent types for multi-turn conversation
type ConversationIntent =
  | 'create'      // Create new workflow from scratch
  | 'refine'      // Modify existing workflow (add/remove nodes)
  | 'configure'   // Update node parameters
  | 'clarify'     // Ask clarifying question before proceeding
  | 'explain'     // Explain simulation capabilities
  | 'run'         // User wants to run the simulation
  | 'question';   // General question about the workflow

// Detect the user's intent based on message and context
function detectIntent(
  message: string,
  hasCurrentWorkflow: boolean,
  conversationHistory: ConversationMessage[]
): ConversationIntent {
  const lowerMessage = message.toLowerCase();

  // Run intent
  if (lowerMessage.match(/\b(run|execute|start|go|simulate)\b/i) && hasCurrentWorkflow) {
    return 'run';
  }

  // Refinement triggers
  const refineTriggers = [
    /\b(add|include|also|plus)\b.*\b(node|analysis|segment|step)/i,
    /\b(remove|delete|drop)\b.*\b(node|step)/i,
    /\b(change|update|modify)\b.*\b(the|this|that)\b/i,
    /\bcan you (add|include|change|update)/i,
    /\blet'?s (add|include|change)/i,
    /\bwhat if we (add|include)/i,
    /\bactually,?\s*(add|change|remove)/i,
  ];

  if (hasCurrentWorkflow && refineTriggers.some(t => t.test(lowerMessage))) {
    return 'refine';
  }

  // Configuration triggers
  const configTriggers = [
    /\b(set|make|change)\b.*\b(sample size|population|threshold)/i,
    /\b(sample|survey)\b.*\b(\d+|thousand|hundred)/i,
    /\b(use|target)\b.*\b(millennials|gen ?[xyz]|boomers|demographic)/i,
    /\bhow many\b.*\b(agents?|samples?|people)/i,
  ];

  if (hasCurrentWorkflow && configTriggers.some(t => t.test(lowerMessage))) {
    return 'configure';
  }

  // Question/explanation triggers
  const questionTriggers = [
    /^(what|how|why|can|does|is|are|will|would|could|should)/i,
    /\?$/,
    /\bexplain\b/i,
    /\bwhat does.*mean/i,
    /\bhow does.*work/i,
  ];

  if (questionTriggers.some(t => t.test(lowerMessage)) && !lowerMessage.includes('simulate') && !lowerMessage.includes('would customers')) {
    // Check if it's a simulation question or a meta question
    if (lowerMessage.match(/\b(this|the|my)\s+(simulation|workflow|node)/i)) {
      return 'question';
    }
  }

  // Default to create for new workflow requests
  return 'create';
}

// Build enhanced system prompt for multi-turn conversation
function buildMultiTurnSystemPrompt(
  currentWorkflow: CurrentWorkflowState | null,
  intent: ConversationIntent
) {
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

  // Build current workflow context if it exists
  let workflowContext = '';
  if (currentWorkflow && currentWorkflow.nodes.length > 0) {
    const nodeDescriptions = currentWorkflow.nodes.map((n, i) =>
      `  ${i + 1}. ${n.label || n.primitiveId} (${n.primitiveId})`
    ).join('\n');

    workflowContext = `
CURRENT WORKFLOW ON CANVAS:
The user already has a workflow with these nodes:
${nodeDescriptions}

When refining, preserve existing node IDs where possible and only add/modify what's needed.
`;
  }

  // Intent-specific instructions
  const intentInstructions: Record<ConversationIntent, string> = {
    create: `
INTENT: CREATE NEW WORKFLOW
Generate a complete workflow from scratch based on the user's request.
Always include the "workflow" field in your response.
`,
    refine: `
INTENT: REFINE EXISTING WORKFLOW
The user wants to modify their existing workflow.
- To ADD nodes: Include only the new nodes in the response with new unique IDs
- To REMOVE nodes: Set "removeNodes" array with IDs to remove
- To RECONNECT: Include new edges that should replace or augment existing ones
- Explain what you're changing
`,
    configure: `
INTENT: CONFIGURE NODES
The user wants to change parameters on existing nodes.
Return a "configUpdates" array with: [{nodeId, config: {key: value}}]
Explain what the change will affect.
`,
    clarify: `
INTENT: CLARIFY BEFORE PROCEEDING
Ask a clarifying question to better understand what the user needs.
Do NOT generate a workflow yet. Just ask 1-2 focused questions.
Set "needsClarification": true in your response.
`,
    explain: `
INTENT: EXPLAIN CAPABILITIES
Explain what RLTX can do and how simulations work.
Be helpful and suggest example use cases.
`,
    run: `
INTENT: USER WANTS TO RUN
The user wants to execute the current workflow.
Confirm the workflow is ready and let them know they can click "Run Simulation".
`,
    question: `
INTENT: ANSWER QUESTION
The user has a question about their workflow or simulation.
Provide a clear, helpful answer.
`,
  };

  return `You are RLTX, an expert AI assistant for multi-agent behavioral simulation.
You help analysts build and refine simulation workflows through natural conversation.

${intentInstructions[intent]}
${workflowContext}

CONVERSATION STYLE:
- Be conversational and helpful, like a knowledgeable colleague
- When unsure, ask clarifying questions rather than guessing
- Explain your reasoning briefly
- If the user's request is ambiguous, offer 2-3 options

CORE CAPABILITY:
RLTX simulates how populations of people (consumers, voters, adversaries) would respond to scenarios
using LLM-powered agents. Each agent represents a realistic persona and responds authentically.

${patternSection}

AVAILABLE PRIMITIVES:
${categorizedPrimitives}

KEY PATTERNS:
1. Consumer Survey: population.sample → orchestrate.monte_carlo → population.segment → aggregate.distribution
2. Competitive Analysis: population.sample → orchestrate.game_theory → branch.scenario
3. Change Impact: population.sample → branch.scenario → orchestrate.monte_carlo (parallel) → branch.merge
4. Wargame: agent.vip → orchestrate.game_theory → branch.scenario

RESPONSE FORMAT (JSON):
{
  "message": "Your conversational response explaining what you're doing",
  "intent": "create|refine|configure|clarify|explain|question",
  "needsClarification": false,
  "clarifyingQuestions": ["optional question 1", "optional question 2"],
  "workflow": { /* only for create intent */ },
  "addNodes": [ /* only for refine intent - nodes to add */ ],
  "removeNodes": ["nodeId1"], /* only for refine intent - nodes to remove */
  "addEdges": [ /* edges to add */ ],
  "removeEdges": ["edgeId1"], /* edges to remove */
  "configUpdates": [{nodeId: "...", config: {...}}] /* only for configure intent */
}

IMPORTANT:
- For CREATE: Include full "workflow" object with nodes and edges
- For REFINE: Include only the delta (addNodes, removeNodes, addEdges)
- For CONFIGURE: Include only configUpdates
- For CLARIFY: Set needsClarification: true and include clarifyingQuestions
- Always include a helpful "message" field`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      message,
      workflowId,
      conversationHistory = [],
      currentWorkflow = null
    } = body as {
      message: string;
      workflowId?: string;
      conversationHistory?: ConversationMessage[];
      currentWorkflow?: CurrentWorkflowState | null;
    };

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Detect intent based on message and context
    const hasWorkflow = currentWorkflow !== null && currentWorkflow.nodes.length > 0;
    const intent = detectIntent(message, hasWorkflow, conversationHistory);

    console.log("[Compose API] Detected intent:", intent, "hasWorkflow:", hasWorkflow);

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      // Return enhanced mock response for demo
      return NextResponse.json(getMockResponse(message, intent, currentWorkflow, conversationHistory));
    }

    // Build the conversation messages for Claude
    const systemPrompt = buildMultiTurnSystemPrompt(currentWorkflow, intent);

    // Build messages array with history
    const claudeMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add conversation history (limit to last 10 turns for context window)
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      claudeMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current message
    claudeMessages.push({
      role: 'user',
      content: message,
    });

    // Call Anthropic API
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: claudeMessages,
    });

    // Parse response
    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    let parsed;
    try {
      // Strip markdown code blocks if present
      let jsonText = content.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }
      parsed = JSON.parse(jsonText);
    } catch (e) {
      console.error("[Compose API] JSON parse error:", e);
      // Return as plain conversational message
      return NextResponse.json({
        message: content.text,
        intent: 'explain',
        workflow: null,
      });
    }

    // Transform workflow if present (for create intent)
    if (parsed.workflow) {
      const transformedWorkflow = transformWorkflow(parsed.workflow);
      return NextResponse.json({
        message: parsed.message,
        intent: parsed.intent || intent,
        workflow: transformedWorkflow,
        needsClarification: parsed.needsClarification || false,
        clarifyingQuestions: parsed.clarifyingQuestions || [],
      });
    }

    // Transform addNodes if present (for refine intent)
    if (parsed.addNodes && Array.isArray(parsed.addNodes)) {
      const transformedNodes = parsed.addNodes.map((node: { primitiveId: string; label: string; config?: Record<string, unknown> }, index: number) => {
        const specPrimitiveId = PRIMITIVE_ID_MAP[node.primitiveId] || node.primitiveId;
        const primitive = primitives[specPrimitiveId];
        const id = `${specPrimitiveId.replace(/\./g, "-")}-${nanoid(6)}`;
        const categoryKey = primitive?.category || "agent";
        const categoryDef = categories[categoryKey as keyof typeof categories];

        return {
          id,
          type: "primitive",
          position: {
            x: 400 + (index % 2) * 280,
            y: 200 + Math.floor(index / 2) * 160,
          },
          data: {
            primitiveId: specPrimitiveId,
            label: node.label,
            icon: primitive?.icon || "Database",
            color: categoryDef?.color || "hsl(0, 0%, 50%)",
            config: node.config || {},
            state: "idle",
          },
        };
      });

      return NextResponse.json({
        message: parsed.message,
        intent: 'refine',
        addNodes: transformedNodes,
        removeNodes: parsed.removeNodes || [],
        addEdges: parsed.addEdges || [],
        removeEdges: parsed.removeEdges || [],
        needsClarification: parsed.needsClarification || false,
      });
    }

    return NextResponse.json({
      ...parsed,
      intent: parsed.intent || intent,
    });
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
    const specPrimitiveId = PRIMITIVE_ID_MAP[node.primitiveId] || node.primitiveId;
    const primitive = primitives[specPrimitiveId];
    const id = `${specPrimitiveId.replace(/\./g, "-")}-${nanoid(6)}`;
    nodeIds.push(id);

    const categoryKey = primitive?.category || "agent";
    const categoryDef = categories[categoryKey as keyof typeof categories];

    return {
      id,
      type: "primitive",
      position: {
        x: 100 + (index % 3) * 280,
        y: 100 + Math.floor(index / 3) * 160,
      },
      data: {
        primitiveId: specPrimitiveId,
        label: node.label,
        icon: primitive?.icon || "Database",
        color: categoryDef?.color || "hsl(0, 0%, 50%)",
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
    style: { stroke: "hsl(0, 0%, 25%)", strokeWidth: 1.5 },
  }));

  return {
    id: nanoid(),
    name: workflow.name,
    nodeCount: nodes.length,
    nodes,
    edges,
  };
}

// Generate explanation message for pattern
function getPatternMessage(patternType: PatternType, pattern: PlaybookPattern): string {
  const messages: Record<PatternType, string> = {
    consumer_survey:
      "I'll simulate how your target population would respond to this question using agent-based modeling. Each agent represents a realistic persona and will respond authentically based on their demographics and psychology.",
    change_impact:
      "I'll analyze how this change would affect behavior across different scenarios. The simulation will test multiple variations and compare outcomes to identify tipping points and segment-specific impacts.",
    competitive_response:
      "I'll model competitive dynamics using game theory to predict how rivals will respond, then simulate how customers will react to the resulting market conditions.",
    wargame:
      "I'll run a strategic wargame simulation modeling adversarial dynamics between actors. Each actor is given realistic objectives and constraints, and the simulation finds equilibrium strategies.",
    dynamics:
      "I'll simulate how this spreads through a population over time using agent-based modeling. The simulation models social network effects and identifies tipping points.",
    counterfactual:
      "I'll compare these options by simulating how the population would respond to each. Each option is tested against the same representative sample.",
    congressional_vote:
      "I'll simulate how Congress would vote on this legislation using senator personas with realistic voting records. Each senator is modeled based on their party, state, and historical positions.",
    conversational:
      `I'm RLTX, your simulation assistant. I help you build multi-agent behavioral simulations through natural conversation.

**What would you like to explore?**
• Consumer behavior - "Would customers buy a subscription at $25/month?"
• Market dynamics - "How will competitors respond if we launch a free tier?"
• Policy analysis - "How would Congress vote on a TikTok ban?"
• Strategic scenarios - "How would China respond to increased US naval presence?"

Just describe what you want to understand, and I'll help you build a simulation.`,
  };
  return messages[patternType] || pattern.description;
}

// Transform playbook pattern to compose workflow response format
function playbookToComposeWorkflow(
  pattern: PlaybookPattern,
  question: string
) {
  const nodeIdMap: Record<string, string> = {};

  const nodes = pattern.structure.nodes.map((node, index) => {
    const specPrimitiveId = node.primitive;
    const id = `${specPrimitiveId.replace(/\./g, "-")}-${nanoid(6)}`;
    nodeIdMap[node.id] = id;

    const primitive = primitives[specPrimitiveId];
    const categoryKey = primitive?.category || "agent";
    const categoryDef = categories[categoryKey as keyof typeof categories];

    const config = { ...node.config };
    if (specPrimitiveId === "orchestrate.monte_carlo") {
      if (!config.question || config.question === "A company is offering a new subscription service for $15 per month. Given your needs, interests, and budget, would you subscribe?") {
        config.question = question;
      }
    }

    return {
      id,
      type: "primitive",
      position: node.position || { x: 100 + (index % 3) * 280, y: 100 + Math.floor(index / 3) * 160 },
      data: {
        primitiveId: specPrimitiveId,
        label: node.name,
        icon: primitive?.icon || "Workflow",
        color: categoryDef?.color || "hsl(0, 0%, 50%)",
        config,
        state: "idle",
      },
    };
  });

  const edges = pattern.structure.edges.map((edge, index) => ({
    id: `edge-${index}`,
    source: nodeIdMap[edge.from],
    target: nodeIdMap[edge.to],
    animated: true,
    style: { stroke: "hsl(0, 0%, 25%)", strokeWidth: 1.5 },
  }));

  return {
    id: nanoid(),
    name: pattern.name,
    nodeCount: nodes.length,
    nodes,
    edges,
  };
}

// Enhanced mock response for demo mode with multi-turn support
function getMockResponse(
  message: string,
  intent: ConversationIntent,
  currentWorkflow: CurrentWorkflowState | null,
  conversationHistory: ConversationMessage[]
) {
  const lowerMessage = message.toLowerCase();

  // Handle different intents
  switch (intent) {
    case 'run':
      return {
        message: "Your simulation is ready to run. Click the **Run Simulation** button to start. The simulation will survey your population of agents and aggregate their responses into a probability distribution.\n\nEstimated time: ~30 seconds for 1,000 agents.",
        intent: 'run',
        workflow: null,
      };

    case 'refine':
      // Handle specific refinement requests
      if (lowerMessage.includes('segment') || lowerMessage.includes('breakdown') || lowerMessage.includes('demographic')) {
        return {
          message: "I'll add demographic segmentation to analyze responses by age, income, and location. This will help identify which segments are most and least favorable.",
          intent: 'refine',
          addNodes: [{
            id: `population-segment-${nanoid(6)}`,
            type: "primitive",
            position: { x: 450, y: 300 },
            data: {
              primitiveId: "population.segment",
              label: "Demographic Breakdown",
              icon: "PieChart",
              color: "hsl(220, 70%, 50%)",
              config: {
                segmentBy: ["age", "income", "location"],
              },
              state: "idle",
            },
          }],
          removeNodes: [],
          addEdges: [],
        };
      }

      if (lowerMessage.includes('competitor') || lowerMessage.includes('game theory')) {
        return {
          message: "I'll add competitive dynamics modeling using game theory. This will simulate how competitors might respond to your move and find the equilibrium outcome.",
          intent: 'refine',
          addNodes: [{
            id: `orchestrate-game_theory-${nanoid(6)}`,
            type: "primitive",
            position: { x: 450, y: 200 },
            data: {
              primitiveId: "orchestrate.game_theory",
              label: "Competitor Response",
              icon: "Target",
              color: "hsl(25, 70%, 50%)",
              config: {
                actors: ["Your Company", "Main Competitor"],
                strategies: [["Launch", "Wait"], ["Match Price", "Undercut", "Ignore"]],
              },
              state: "idle",
            },
          }],
          removeNodes: [],
          addEdges: [],
        };
      }

      if (lowerMessage.includes('scenario') || lowerMessage.includes('what if') || lowerMessage.includes('alternative')) {
        return {
          message: "I'll add scenario branching to compare different outcomes. This will run parallel simulations for each scenario and merge the results for comparison.",
          intent: 'refine',
          addNodes: [{
            id: `branch-scenario-${nanoid(6)}`,
            type: "primitive",
            position: { x: 450, y: 250 },
            data: {
              primitiveId: "branch.scenario",
              label: "Scenario Analysis",
              icon: "GitBranch",
              color: "hsl(330, 70%, 50%)",
              config: {
                scenarios: ["Optimistic", "Base Case", "Pessimistic"],
              },
              state: "idle",
            },
          }],
          removeNodes: [],
          addEdges: [],
        };
      }

      return {
        message: "I can help you refine the workflow. What would you like to add or change?\n\n• **Add segmentation** - Break down results by demographics\n• **Add competitor analysis** - Model competitive response\n• **Add scenarios** - Compare different conditions\n• **Change sample size** - Increase/decrease agent count",
        intent: 'clarify',
        needsClarification: true,
        workflow: null,
      };

    case 'configure':
      // Handle configuration changes
      if (lowerMessage.match(/\b(\d+)\b.*\b(sample|agent|people)/i)) {
        const sizeMatch = lowerMessage.match(/\b(\d+)\b/);
        const newSize = sizeMatch ? parseInt(sizeMatch[1], 10) : 1000;
        return {
          message: `I'll update the sample size to ${newSize.toLocaleString()} agents. Larger samples give more precise results but take longer to run.\n\n• 500 agents: ~15 seconds, ±4% margin\n• 1,000 agents: ~30 seconds, ±3% margin\n• 5,000 agents: ~2 minutes, ±1.4% margin`,
          intent: 'configure',
          configUpdates: [{
            nodeId: currentWorkflow?.nodes.find(n => n.primitiveId === 'population.sample')?.id || 'sample-node',
            config: { sampleSize: newSize },
          }],
        };
      }

      if (lowerMessage.match(/\b(millennial|gen ?z|boomer|gen ?x)/i)) {
        const ageFilters: Record<string, string[]> = {
          'millennial': ['25-34', '35-44'],
          'gen z': ['18-24'],
          'genz': ['18-24'],
          'boomer': ['55-64', '65+'],
          'gen x': ['45-54'],
          'genx': ['45-54'],
        };

        const matched = Object.entries(ageFilters).find(([key]) =>
          lowerMessage.includes(key)
        );

        if (matched) {
          return {
            message: `I'll filter the population to focus on ${matched[0]} respondents (ages ${matched[1].join(', ')}). This will give you insights specific to this demographic.`,
            intent: 'configure',
            configUpdates: [{
              nodeId: currentWorkflow?.nodes.find(n => n.primitiveId === 'population.sample')?.id || 'sample-node',
              config: {
                filters: { age: matched[1] }
              },
            }],
          };
        }
      }

      return {
        message: "What would you like to configure?\n\n• **Sample size** - \"Use 5000 agents\"\n• **Demographics** - \"Focus on millennials\" or \"Target high income\"\n• **Population** - \"Use US voters\" or \"Enterprise decision makers\"",
        intent: 'clarify',
        needsClarification: true,
        workflow: null,
      };

    case 'question':
      // Handle questions about the workflow
      if (lowerMessage.includes('how') && lowerMessage.includes('work')) {
        return {
          message: "Your simulation works in 3 stages:\n\n1. **Sample Population** - Creates synthetic agents with realistic demographics and psychology\n2. **Monte Carlo Survey** - Each agent answers your question based on their persona\n3. **Aggregate Results** - Responses are combined into a probability distribution\n\nEach agent is powered by an LLM with a detailed persona, so responses reflect realistic human variation.",
          intent: 'explain',
          workflow: null,
        };
      }

      if (lowerMessage.includes('accurate') || lowerMessage.includes('reliable')) {
        return {
          message: "RLTX simulations are calibrated using **Semantic Similarity Rating (SSR)**, which achieves ~90% correlation with real human surveys. Key factors:\n\n• Larger samples = more precise results\n• Consumer surveys are most accurate\n• Political simulations use real voting records\n• Strategic simulations model game-theoretic equilibria\n\nResults include 95% confidence intervals to show uncertainty.",
          intent: 'explain',
          workflow: null,
        };
      }

      return {
        message: "I'm here to help. What would you like to know about your simulation? I can explain:\n\n• How the simulation methodology works\n• What each node does\n• How to interpret results\n• How to refine for better insights",
        intent: 'explain',
        workflow: null,
      };

    case 'create':
    default:
      // Use the canonical selectPattern function
      const patternType = selectPattern(message);
      const pattern = playbookPatterns[patternType];

      console.log("[Compose API] Pattern detected:", patternType);

      // Handle conversational pattern - no workflow
      if (patternType === "conversational") {
        return {
          message: getPatternMessage("conversational", playbookPatterns.conversational),
          intent: 'explain',
          pattern: "conversational",
          workflow: null,
        };
      }

      if (!pattern) {
        const fallbackPattern = playbookPatterns.consumer_survey;
        return {
          message: getPatternMessage("consumer_survey", fallbackPattern),
          intent: 'create',
          pattern: "consumer_survey",
          workflow: playbookToComposeWorkflow(fallbackPattern, message),
        };
      }

      return {
        message: getPatternMessage(patternType, pattern),
        intent: 'create',
        pattern: patternType,
        workflow: playbookToComposeWorkflow(pattern, message),
      };
  }
}
