/**
 * Game Theory Module
 * Implements LLM-powered strategic actors with iterated best-response
 */

import Anthropic from "@anthropic-ai/sdk";

export interface StrategicActor {
  id: string;
  name: string;
  role: string;
  objectives: string[];
  constraints: string[];
  context?: string;
}

export interface GameScenario {
  description: string;
  context: string;
  possibleActions: Record<string, string[]>; // actorId -> possible actions
  payoffDescription?: string;
  domain?: "enterprise" | "defense" | "consumer";
}

export interface ActorAction {
  actorId: string;
  action: string;
  confidence: number;
  reasoning: string;
  anticipatedResponses: Record<string, string>; // other actorId -> expected action
}

export interface GameRound {
  round: number;
  actions: ActorAction[];
  converged: boolean;
  convergenceReason?: string;
}

export interface GameResult {
  rounds: GameRound[];
  equilibrium?: {
    actions: Record<string, string>;
    isStable: boolean;
    stabilityReason: string;
  };
  reasoning: {
    actorId: string;
    fullReasoning: string;
  }[];
  metadata: {
    totalRounds: number;
    converged: boolean;
    convergenceRound?: number;
    modelUsed: string;
    totalLatencyMs: number;
  };
}

// Build the strategic actor's system prompt
function buildActorSystemPrompt(actor: StrategicActor, scenario: GameScenario): string {
  const lines: string[] = [
    `You are simulating a strategic actor: ${actor.name}`,
    "",
    `ROLE: ${actor.role}`,
    "",
    "YOUR OBJECTIVES (in order of priority):",
    ...actor.objectives.map((obj, i) => `${i + 1}. ${obj}`),
    "",
    "YOUR CONSTRAINTS:",
    ...actor.constraints.map((c) => `- ${c}`),
    "",
  ];

  if (actor.context) {
    lines.push("YOUR SITUATION:");
    lines.push(actor.context);
    lines.push("");
  }

  lines.push("GAME CONTEXT:");
  lines.push(scenario.description);
  lines.push("");

  if (scenario.context) {
    lines.push("CURRENT SITUATION:");
    lines.push(scenario.context);
    lines.push("");
  }

  lines.push("STRATEGIC REASONING INSTRUCTIONS:");
  lines.push("1. Consider what actions are available to you and other actors");
  lines.push("2. Reason about what each other actor is likely to do given THEIR objectives");
  lines.push("3. Consider how your action affects your objectives AND how others will respond");
  lines.push("4. Choose the action that best serves your objectives given others' likely responses");
  lines.push("5. Be realistic about your constraints and limitations");
  lines.push("");

  if (scenario.domain === "defense") {
    lines.push("DOMAIN NOTE: This is a defense/security scenario. Consider:");
    lines.push("- National interests and security implications");
    lines.push("- Escalation risks and deterrence");
    lines.push("- Alliance commitments and credibility");
    lines.push("- Intelligence and information asymmetry");
  } else if (scenario.domain === "enterprise") {
    lines.push("DOMAIN NOTE: This is a business/enterprise scenario. Consider:");
    lines.push("- Market dynamics and competitive positioning");
    lines.push("- Shareholder value and fiduciary duty");
    lines.push("- Regulatory constraints");
    lines.push("- Long-term vs short-term tradeoffs");
  }

  return lines.join("\n");
}

// Build the user prompt for a strategic decision
function buildActorDecisionPrompt(
  actor: StrategicActor,
  scenario: GameScenario,
  otherActors: StrategicActor[],
  previousRound?: GameRound
): string {
  const myActions = scenario.possibleActions[actor.id] || [];
  const lines: string[] = [];

  lines.push("AVAILABLE ACTIONS FOR YOU:");
  myActions.forEach((action, i) => {
    lines.push(`${i + 1}. ${action}`);
  });
  lines.push("");

  lines.push("OTHER ACTORS IN THIS SCENARIO:");
  otherActors.forEach((other) => {
    const theirActions = scenario.possibleActions[other.id] || [];
    lines.push(`- ${other.name} (${other.role}): Can choose from [${theirActions.join(", ")}]`);
  });
  lines.push("");

  if (previousRound) {
    lines.push("PREVIOUS ROUND RESULTS:");
    previousRound.actions.forEach((action) => {
      lines.push(`- ${action.actorId}: Chose "${action.action}"`);
    });
    lines.push("");
    lines.push("Consider whether to maintain your previous strategy or adjust based on what happened.");
    lines.push("");
  }

  lines.push("YOUR TASK:");
  lines.push("Decide what action to take. Think step by step:");
  lines.push("1. What are the other actors likely to do?");
  lines.push("2. What's my best response to their likely actions?");
  lines.push("3. How confident am I in this analysis?");
  lines.push("");

  lines.push("RESPOND IN THIS EXACT FORMAT:");
  lines.push("Action: [one of your available actions]");
  lines.push("Confidence: [high/medium/low]");
  lines.push("");
  lines.push("Anticipated Responses:");
  otherActors.forEach((other) => {
    lines.push(`- ${other.id}: [their likely action]`);
  });
  lines.push("");
  lines.push("Reasoning: [2-4 sentences explaining your strategic logic]");

  return lines.join("\n");
}

// Parse actor's response
function parseActorResponse(
  response: string,
  actorId: string,
  possibleActions: string[],
  otherActorIds: string[]
): ActorAction | null {
  // Extract action
  const actionMatch = response.match(/Action:\s*(.+?)(?:\n|$)/i);
  if (!actionMatch) return null;

  let action = actionMatch[1].trim();
  // Try to match to valid actions
  const normalizedAction = action.toLowerCase();
  const matchedAction = possibleActions.find(
    (a) => a.toLowerCase() === normalizedAction ||
           normalizedAction.includes(a.toLowerCase()) ||
           a.toLowerCase().includes(normalizedAction)
  );
  if (matchedAction) {
    action = matchedAction;
  }

  // Extract confidence
  const confidenceMatch = response.match(/Confidence:\s*(.+?)(?:\n|$)/i);
  let confidence = 0.7;
  if (confidenceMatch) {
    const confStr = confidenceMatch[1].toLowerCase();
    if (confStr.includes("high")) confidence = 0.9;
    else if (confStr.includes("low")) confidence = 0.5;
  }

  // Extract anticipated responses
  const anticipatedResponses: Record<string, string> = {};
  for (const otherId of otherActorIds) {
    const pattern = new RegExp(`-?\\s*${otherId}:\\s*(.+?)(?:\\n|$)`, "i");
    const match = response.match(pattern);
    if (match) {
      anticipatedResponses[otherId] = match[1].trim();
    }
  }

  // Extract reasoning (use multiline approach instead of dotAll flag)
  const reasoningMatch = response.match(/Reasoning:\s*([\s\S]+)$/i);
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : "";

  return {
    actorId,
    action,
    confidence,
    reasoning,
    anticipatedResponses,
  };
}

// Check if the game has converged
function checkConvergence(
  currentRound: GameRound,
  previousRound: GameRound | undefined,
  rounds: GameRound[]
): { converged: boolean; reason?: string } {
  // Need at least 2 rounds to check convergence
  if (!previousRound) {
    return { converged: false };
  }

  // Check if all actions are the same as previous round
  const currentActions = new Map(currentRound.actions.map((a) => [a.actorId, a.action] as [string, string]));
  const previousActions = new Map(previousRound.actions.map((a) => [a.actorId, a.action] as [string, string]));

  let allSame = true;
  const currentEntries = Array.from(currentActions.entries());
  for (const [actorId, action] of currentEntries) {
    if (previousActions.get(actorId) !== action) {
      allSame = false;
      break;
    }
  }

  if (allSame) {
    return {
      converged: true,
      reason: "All actors maintained their previous actions (Nash equilibrium reached)",
    };
  }

  // Check for cycle detection (actions repeating every N rounds)
  if (rounds.length >= 4) {
    const lastFour = rounds.slice(-4);
    const pattern1 = JSON.stringify(lastFour[0].actions.map((a) => a.action));
    const pattern3 = JSON.stringify(lastFour[2].actions.map((a) => a.action));

    if (pattern1 === pattern3) {
      return {
        converged: true,
        reason: "Detected oscillating pattern (mixed strategy equilibrium)",
      };
    }
  }

  return { converged: false };
}

// Main game execution function
export async function executeGameTheory(config: {
  actors: StrategicActor[];
  scenario: GameScenario;
  maxRounds?: number;
  model?: string;
  onRoundComplete?: (round: GameRound) => void;
  abortSignal?: AbortSignal;
}): Promise<GameResult> {
  const {
    actors,
    scenario,
    maxRounds = 5,
    model = "claude-opus-4-20250514", // Opus for strategic reasoning
    onRoundComplete,
    abortSignal,
  } = config;

  const client = new Anthropic();
  const rounds: GameRound[] = [];
  const fullReasoningLog: { actorId: string; fullReasoning: string }[] = [];

  const startTime = Date.now();

  for (let roundNum = 1; roundNum <= maxRounds; roundNum++) {
    if (abortSignal?.aborted) {
      break;
    }

    const previousRound = rounds[rounds.length - 1];
    const roundActions: ActorAction[] = [];

    // Each actor makes their decision (could parallelize for independent actors)
    for (const actor of actors) {
      const otherActors = actors.filter((a) => a.id !== actor.id);

      const systemPrompt = buildActorSystemPrompt(actor, scenario);
      const userPrompt = buildActorDecisionPrompt(actor, scenario, otherActors, previousRound);

      try {
        const response = await client.messages.create({
          model,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        });

        const textContent = response.content.find((c) => c.type === "text");
        const responseText = textContent && "text" in textContent ? textContent.text : "";

        // Log full reasoning
        fullReasoningLog.push({
          actorId: actor.id,
          fullReasoning: `Round ${roundNum}:\n${responseText}`,
        });

        // Parse response
        const possibleActions = scenario.possibleActions[actor.id] || [];
        const otherIds = otherActors.map((a) => a.id);
        const parsed = parseActorResponse(responseText, actor.id, possibleActions, otherIds);

        if (parsed) {
          roundActions.push(parsed);
        } else {
          // Fallback: random action if parsing fails
          roundActions.push({
            actorId: actor.id,
            action: possibleActions[0] || "unknown",
            confidence: 0.3,
            reasoning: "Failed to parse response",
            anticipatedResponses: {},
          });
        }
      } catch (error) {
        console.error(`Error getting response for actor ${actor.id}:`, error);
        const possibleActions = scenario.possibleActions[actor.id] || [];
        roundActions.push({
          actorId: actor.id,
          action: possibleActions[0] || "unknown",
          confidence: 0.3,
          reasoning: `Error: ${(error as Error).message}`,
          anticipatedResponses: {},
        });
      }
    }

    // Create round result
    const currentRound: GameRound = {
      round: roundNum,
      actions: roundActions,
      converged: false,
    };

    // Check convergence
    const convergence = checkConvergence(currentRound, previousRound, rounds);
    currentRound.converged = convergence.converged;
    currentRound.convergenceReason = convergence.reason;

    rounds.push(currentRound);
    onRoundComplete?.(currentRound);

    if (currentRound.converged) {
      break;
    }
  }

  const totalTime = Date.now() - startTime;
  const lastRound = rounds[rounds.length - 1];
  const converged = lastRound?.converged || false;

  // Build equilibrium if converged
  let equilibrium: GameResult["equilibrium"];
  if (converged && lastRound) {
    const actions: Record<string, string> = {};
    lastRound.actions.forEach((a) => {
      actions[a.actorId] = a.action;
    });

    equilibrium = {
      actions,
      isStable: true,
      stabilityReason: lastRound.convergenceReason || "Equilibrium reached",
    };
  }

  return {
    rounds,
    equilibrium,
    reasoning: fullReasoningLog,
    metadata: {
      totalRounds: rounds.length,
      converged,
      convergenceRound: converged ? rounds.length : undefined,
      modelUsed: model,
      totalLatencyMs: totalTime,
    },
  };
}

// Preset actors for common scenarios
export const PRESET_ACTORS = {
  competitor: (name: string, context: string): StrategicActor => ({
    id: `competitor_${name.toLowerCase().replace(/\s+/g, "_")}`,
    name,
    role: "Competitor company",
    objectives: [
      "Maximize market share",
      "Maintain profitability",
      "Protect competitive position",
    ],
    constraints: [
      "Limited by current market position",
      "Must consider shareholder expectations",
      "Regulatory compliance required",
    ],
    context,
  }),

  nationState: (name: string, context: string): StrategicActor => ({
    id: `state_${name.toLowerCase().replace(/\s+/g, "_")}`,
    name,
    role: "Nation state actor",
    objectives: [
      "Protect national security",
      "Advance national interests",
      "Maintain international standing",
    ],
    constraints: [
      "Domestic political considerations",
      "Alliance commitments",
      "International law and norms",
      "Resource limitations",
    ],
    context,
  }),

  regulator: (name: string, context: string): StrategicActor => ({
    id: `regulator_${name.toLowerCase().replace(/\s+/g, "_")}`,
    name,
    role: "Regulatory authority",
    objectives: [
      "Protect public interest",
      "Ensure market fairness",
      "Enforce compliance",
    ],
    constraints: [
      "Legal authority limitations",
      "Political pressure",
      "Resource constraints",
      "Precedent considerations",
    ],
    context,
  }),
};
