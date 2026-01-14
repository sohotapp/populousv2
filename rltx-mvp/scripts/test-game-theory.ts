/**
 * End-to-end test for Game Theory strategic simulation
 *
 * Run with: npx tsx scripts/test-game-theory.ts
 * Requires: ANTHROPIC_API_KEY environment variable
 */

import { executeGameTheory, StrategicActor, GameScenario } from "../src/lib/agents/game-theory";

async function runTest() {
  console.log("=".repeat(60));
  console.log("RLTX Game Theory Strategic Simulation Test");
  console.log("=".repeat(60));

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("\nERROR: ANTHROPIC_API_KEY environment variable not set");
    console.error("Set it with: export ANTHROPIC_API_KEY=sk-ant-...");
    process.exit(1);
  }

  // Define strategic actors
  const actors: StrategicActor[] = [
    {
      id: "company_a",
      name: "TechCorp",
      role: "Market leader in cloud services",
      objectives: [
        "Maintain market leadership and 45% market share",
        "Maximize long-term profitability",
        "Protect enterprise customer base",
      ],
      constraints: [
        "Cannot price below cost (regulatory scrutiny)",
        "Must maintain service quality standards",
        "Has existing enterprise contracts with pricing commitments",
      ],
      context: "Currently holds 45% market share with strong enterprise presence. Known for reliability but higher prices.",
    },
    {
      id: "company_b",
      name: "CloudStart",
      role: "Fast-growing challenger",
      objectives: [
        "Grow market share from 20% to 30%",
        "Establish credibility with enterprise customers",
        "Achieve profitability within 2 years",
      ],
      constraints: [
        "Limited cash reserves - can't sustain prolonged price war",
        "Smaller support team than TechCorp",
        "Less brand recognition in enterprise segment",
      ],
      context: "Aggressive startup with 20% share, known for innovation and competitive pricing. Recently raised Series C.",
    },
    {
      id: "company_c",
      name: "MegaCloud",
      role: "Big tech entrant",
      objectives: [
        "Enter cloud market and capture 15% share within 1 year",
        "Cross-sell to existing platform users",
        "Disrupt current pricing norms",
      ],
      constraints: [
        "New to cloud infrastructure - limited track record",
        "Antitrust concerns limit aggressive moves",
        "Must balance cloud investment with core business",
      ],
      context: "Major tech company entering cloud market with deep pockets but no cloud track record. Has 500M platform users.",
    },
  ];

  // Define scenario
  const scenario: GameScenario = {
    description: `The cloud infrastructure market is entering a critical phase. MegaCloud has just announced entry into the market with aggressive introductory pricing. TechCorp and CloudStart must decide how to respond. All three companies must now choose their strategic positioning.`,
    context: `Current market shares: TechCorp 45%, CloudStart 20%, Others 35% (soon to include MegaCloud). Recent trends show enterprise migration to cloud accelerating. Price sensitivity increasing among SMB customers but enterprise values reliability. Analysts predict 25% annual market growth.`,
    possibleActions: {
      company_a: [
        "Match MegaCloud pricing (sacrifice margins)",
        "Maintain premium pricing (focus on enterprise value)",
        "Selective discounts (match on SMB, hold enterprise)",
        "Announce new features/bundling (differentiate)",
      ],
      company_b: [
        "Undercut MegaCloud (aggressive price war)",
        "Hold current pricing (rely on existing momentum)",
        "Partner with TechCorp (alliance against newcomer)",
        "Target enterprise accounts (move upmarket)",
      ],
      company_c: [
        "Maintain aggressive pricing (buy market share)",
        "Moderate pricing (sustainable entry)",
        "Focus on platform integration (leverage existing users)",
        "Target specific verticals (avoid direct competition)",
      ],
    },
    domain: "enterprise",
  };

  console.log("\n1. SCENARIO");
  console.log("-".repeat(40));
  console.log(scenario.description);
  console.log("\nContext:", scenario.context);

  console.log("\n2. STRATEGIC ACTORS");
  console.log("-".repeat(40));
  actors.forEach((actor) => {
    console.log(`\n${actor.name} (${actor.role})`);
    console.log(`  Context: ${actor.context}`);
    console.log(`  Objectives:`);
    actor.objectives.forEach((obj) => console.log(`    - ${obj}`));
    console.log(`  Available actions:`);
    scenario.possibleActions[actor.id].forEach((action) => console.log(`    - ${action}`));
  });

  console.log("\n3. RUNNING STRATEGIC SIMULATION");
  console.log("-".repeat(40));
  console.log("Using Claude Opus 4 for strategic reasoning...\n");

  const startTime = Date.now();

  const result = await executeGameTheory({
    actors,
    scenario,
    maxRounds: 4,
    model: "claude-opus-4-20250514",
    onRoundComplete: (round) => {
      console.log(`\n=== ROUND ${round.round} ===`);
      round.actions.forEach((action) => {
        const actor = actors.find((a) => a.id === action.actorId);
        console.log(`\n${actor?.name}:`);
        console.log(`  Action: ${action.action}`);
        console.log(`  Confidence: ${action.confidence > 0.7 ? "HIGH" : action.confidence > 0.5 ? "MEDIUM" : "LOW"}`);
        console.log(`  Reasoning: ${action.reasoning}`);
        if (Object.keys(action.anticipatedResponses).length > 0) {
          console.log(`  Anticipated responses:`);
          Object.entries(action.anticipatedResponses).forEach(([otherId, expected]) => {
            const other = actors.find((a) => a.id === otherId);
            console.log(`    - ${other?.name}: ${expected}`);
          });
        }
      });

      if (round.converged) {
        console.log(`\n✓ CONVERGED: ${round.convergenceReason}`);
      }
    },
  });

  const totalTime = Date.now() - startTime;

  console.log("\n\n4. EQUILIBRIUM ANALYSIS");
  console.log("-".repeat(40));

  if (result.equilibrium) {
    console.log("\n✓ Equilibrium reached!");
    console.log(`\nEquilibrium actions:`);
    Object.entries(result.equilibrium.actions).forEach(([actorId, action]) => {
      const actor = actors.find((a) => a.id === actorId);
      console.log(`  ${actor?.name}: ${action}`);
    });
    console.log(`\nStability: ${result.equilibrium.isStable ? "Stable" : "Unstable"}`);
    console.log(`Reason: ${result.equilibrium.stabilityReason}`);
  } else {
    console.log("\n✗ No equilibrium reached within max rounds");
    console.log("The game may have a mixed strategy equilibrium or require more rounds.");
  }

  console.log("\n5. SIMULATION SUMMARY");
  console.log("-".repeat(40));
  console.log(`Total rounds: ${result.metadata.totalRounds}`);
  console.log(`Converged: ${result.metadata.converged ? "Yes" : "No"}`);
  if (result.metadata.convergenceRound) {
    console.log(`Convergence round: ${result.metadata.convergenceRound}`);
  }
  console.log(`Model used: ${result.metadata.modelUsed}`);
  console.log(`Total time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`LLM latency: ${(result.metadata.totalLatencyMs / 1000).toFixed(1)}s`);

  console.log("\n" + "=".repeat(60));
  console.log("TEST COMPLETED SUCCESSFULLY");
  console.log("=".repeat(60));

  return {
    converged: result.metadata.converged,
    rounds: result.metadata.totalRounds,
    equilibrium: result.equilibrium?.actions || null,
    timeMs: totalTime,
  };
}

// Run the test
runTest()
  .then((result) => {
    console.log("\nFinal result:", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nTest failed:", error);
    process.exit(1);
  });
