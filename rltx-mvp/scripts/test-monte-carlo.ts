/**
 * End-to-end test for Monte Carlo agent simulation
 *
 * Run with: npx tsx scripts/test-monte-carlo.ts
 * Requires: ANTHROPIC_API_KEY environment variable
 */

import Anthropic from "@anthropic-ai/sdk";
import { samplePopulation } from "../src/lib/population/sampler";
import { compilePromptBatch, ScenarioContext } from "../src/lib/agents/prompt-compiler";
import { parseResponse, aggregateResponses, ParseOptions } from "../src/lib/agents/response-parser";
import { routeBatch } from "../src/lib/agents/model-router";

// Simple batch execution without full parallel infrastructure
async function executeSimpleBatch(
  client: Anthropic,
  prompts: Array<{ system: string; user: string; model: string }>,
  maxConcurrent: number = 10
): Promise<string[]> {
  const results: string[] = new Array(prompts.length).fill("");
  let completed = 0;

  // Process in batches
  for (let i = 0; i < prompts.length; i += maxConcurrent) {
    const batch = prompts.slice(i, Math.min(i + maxConcurrent, prompts.length));

    const batchResults = await Promise.all(
      batch.map(async (prompt, batchIdx) => {
        try {
          const response = await client.messages.create({
            model: prompt.model,
            max_tokens: 512,
            system: prompt.system,
            messages: [{ role: "user", content: prompt.user }],
          });

          const textContent = response.content.find((c) => c.type === "text");
          return textContent && "text" in textContent ? textContent.text : "";
        } catch (error) {
          console.error(`Error on agent ${i + batchIdx}:`, (error as Error).message);
          return "";
        }
      })
    );

    // Store results
    batchResults.forEach((result, batchIdx) => {
      results[i + batchIdx] = result;
    });

    completed += batch.length;
    console.log(`  Progress: ${completed}/${prompts.length} agents completed`);
  }

  return results;
}

async function runTest() {
  console.log("=".repeat(60));
  console.log("RLTX Monte Carlo Agent Simulation Test");
  console.log("=".repeat(60));

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("\nERROR: ANTHROPIC_API_KEY environment variable not set");
    console.error("Set it with: export ANTHROPIC_API_KEY=sk-ant-...");
    process.exit(1);
  }

  const client = new Anthropic();

  // Test configuration
  const config = {
    populationId: "us_adults",
    sampleSize: 100,  // Small for testing
    useArchetypes: true,
    archetypeCount: 10,  // Reduces to 10 actual LLM calls
  };

  // Scenario
  const scenario: ScenarioContext = {
    scenario: "A new streaming service called StreamX is launching with exclusive content including popular movies, original series, and live sports. The service offers a 7-day free trial.",
    question: "Would you subscribe to StreamX at $15/month after the free trial ends?",
    questionType: "binary",
    domain: "consumer",
  };

  console.log("\n1. CONFIGURATION");
  console.log("-".repeat(40));
  console.log(`Population: ${config.populationId}`);
  console.log(`Sample size: ${config.sampleSize}`);
  console.log(`Use archetypes: ${config.useArchetypes}`);
  console.log(`Archetype count: ${config.archetypeCount}`);

  console.log("\n2. SCENARIO");
  console.log("-".repeat(40));
  console.log(`Question type: ${scenario.questionType}`);
  console.log(`Scenario: ${scenario.scenario.slice(0, 100)}...`);
  console.log(`Question: ${scenario.question}`);

  // Step 1: Sample population
  console.log("\n3. SAMPLING POPULATION");
  console.log("-".repeat(40));
  const samplingResult = samplePopulation({
    populationId: config.populationId,
    sampleSize: config.sampleSize,
    useArchetypes: config.useArchetypes,
    archetypeCount: config.archetypeCount,
  });

  console.log(`Generated ${samplingResult.agents.length} agent profiles`);
  console.log(`Effective sample size: ${samplingResult.metadata.effectiveSampleSize}`);

  // Show sample agent profiles
  console.log("\nSample agent profiles:");
  samplingResult.agents.slice(0, 3).forEach((agent, i) => {
    console.log(`  ${i + 1}. ${agent.description.slice(0, 80)}...`);
    console.log(`     Weight: ${(agent.weight * 100).toFixed(1)}%`);
  });

  // Step 2: Compile prompts
  console.log("\n4. COMPILING PROMPTS");
  console.log("-".repeat(40));
  const compiledPrompts = compilePromptBatch(samplingResult.agents, scenario);
  console.log(`Compiled ${compiledPrompts.length} prompts`);

  // Show sample prompt
  console.log("\nSample prompt (agent 1):");
  console.log("  System (first 200 chars):", compiledPrompts[0].prompt.systemPrompt.slice(0, 200) + "...");
  console.log("  User (first 200 chars):", compiledPrompts[0].prompt.userPrompt.slice(0, 200) + "...");
  console.log("  Complexity score:", compiledPrompts[0].prompt.complexity.toFixed(2));

  // Step 3: Route to models
  console.log("\n5. MODEL ROUTING");
  console.log("-".repeat(40));
  const { routes, summary } = routeBatch(
    compiledPrompts.map((p) => p.prompt),
    { domain: "consumer" }
  );

  console.log(`Model distribution:`);
  console.log(`  Haiku: ${summary.byTier.haiku}`);
  console.log(`  Sonnet: ${summary.byTier.sonnet}`);
  console.log(`  Opus: ${summary.byTier.opus}`);
  console.log(`Estimated cost: $${summary.totalEstimatedCost.toFixed(4)}`);
  console.log(`Estimated latency: ${Math.round(summary.parallelLatencyMs / 1000)}s`);

  // Step 4: Execute agents
  console.log("\n6. EXECUTING AGENTS");
  console.log("-".repeat(40));

  const startTime = Date.now();

  // Prepare prompts for execution
  const executionPrompts = compiledPrompts.map((cp, i) => ({
    system: cp.prompt.systemPrompt,
    user: cp.prompt.userPrompt,
    model: routes[i].config.modelId,
  }));

  const rawResponses = await executeSimpleBatch(client, executionPrompts, 5);

  const executionTime = Date.now() - startTime;
  console.log(`\nExecution completed in ${(executionTime / 1000).toFixed(1)}s`);

  // Step 5: Parse responses
  console.log("\n7. PARSING RESPONSES");
  console.log("-".repeat(40));

  const parseOptions: ParseOptions = {
    questionType: "binary",
  };

  const parsedResponses = rawResponses.map((raw) => parseResponse(raw, parseOptions));
  const successfulCount = parsedResponses.filter((r) => r.success).length;

  console.log(`Successful parses: ${successfulCount}/${parsedResponses.length}`);

  // Show sample responses
  console.log("\nSample parsed responses:");
  parsedResponses.slice(0, 3).forEach((resp, i) => {
    if (resp.success) {
      console.log(`  ${i + 1}. Answer: ${resp.value}, Confidence: ${resp.confidence}`);
      console.log(`     Reasoning: ${resp.reasoning.slice(0, 80)}...`);
    } else {
      console.log(`  ${i + 1}. PARSE FAILED: ${resp.errors?.join(", ")}`);
    }
  });

  // Step 6: Aggregate results
  console.log("\n8. AGGREGATING RESULTS");
  console.log("-".repeat(40));

  const weights = samplingResult.agents.map((a) => a.weight);
  const aggregated = aggregateResponses(parsedResponses, weights);

  console.log(`\nOVERALL RESULTS:`);
  console.log(`  Would subscribe (YES): ${((aggregated.distribution.yes || 0) * 100).toFixed(1)}%`);
  console.log(`  Would NOT subscribe (NO): ${((aggregated.distribution.no || 0) * 100).toFixed(1)}%`);
  console.log(`\nConfidence breakdown:`);
  console.log(`  High confidence: ${(aggregated.confidenceBreakdown.high * 100).toFixed(1)}%`);
  console.log(`  Medium confidence: ${(aggregated.confidenceBreakdown.medium * 100).toFixed(1)}%`);
  console.log(`  Low confidence: ${(aggregated.confidenceBreakdown.low * 100).toFixed(1)}%`);
  console.log(`\nStatistics:`);
  console.log(`  Weighted mean: ${(aggregated.weightedMean * 100).toFixed(1)}%`);
  console.log(`  Standard deviation: ${(aggregated.std * 100).toFixed(1)}%`);
  console.log(`  Sample size: ${aggregated.sampleSize}`);
  console.log(`  Successful parses: ${aggregated.successfulParses}`);

  // Segment analysis
  console.log("\n9. SEGMENT ANALYSIS");
  console.log("-".repeat(40));

  // Group by demographics
  const segments: Record<string, { yes: number; no: number; total: number }> = {};

  parsedResponses.forEach((resp, i) => {
    if (!resp.success) return;
    const agent = samplingResult.agents[i];
    const ageKey = `age_${agent.demographics.age}`;
    const incomeKey = `income_${agent.demographics.income}`;

    [ageKey, incomeKey].forEach((key) => {
      if (!segments[key]) segments[key] = { yes: 0, no: 0, total: 0 };
      segments[key].total += agent.weight;
      if (resp.value === true) segments[key].yes += agent.weight;
      else segments[key].no += agent.weight;
    });
  });

  console.log("\nSubscription rate by demographic:");
  Object.entries(segments)
    .sort((a, b) => b[1].yes / b[1].total - a[1].yes / a[1].total)
    .forEach(([key, data]) => {
      if (data.total > 0) {
        const rate = (data.yes / data.total) * 100;
        console.log(`  ${key}: ${rate.toFixed(1)}% (n=${(data.total * 100).toFixed(0)}%)`);
      }
    });

  console.log("\n" + "=".repeat(60));
  console.log("TEST COMPLETED SUCCESSFULLY");
  console.log("=".repeat(60));

  return {
    yesRate: aggregated.distribution.yes || 0,
    noRate: aggregated.distribution.no || 0,
    sampleSize: aggregated.sampleSize,
    executionTimeMs: executionTime,
    costEstimate: summary.totalEstimatedCost,
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
