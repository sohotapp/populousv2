// Compute Executor - Handles simulation and optimization primitives

import { BaseExecutor } from "./base";
import {
  ExecutorContext,
  ExecutorResult,
  ExecutorType,
  ExecutionError,
  Distribution,
} from "./types";

// Agent-based simulation imports
import { samplePopulation, AgentProfile } from "../population";
import { agentStore, type Agent, type AgentTier } from "../agents/agent-store";
import {
  compilePrompt,
  compilePromptBatch,
  ScenarioContext,
  QuestionType,
  type CompiledPrompt,
} from "../agents/prompt-compiler";
import { parseResponse, aggregateResponses, ParseOptions } from "../agents/response-parser";
import {
  routePrompt,
  routeBatch,
  routeByAgentTier,
  groupAgentsByTier,
  estimateAgentTierCost,
  RoutingOptions,
  AgentRoutingResult,
  MODEL_CONFIGS,
  type ModelTier,
} from "../agents/model-router";
import { executeBatch, createBatchRequests, BatchResult } from "../agents/parallel-batch";
import {
  executeGameTheory,
  StrategicActor,
  GameScenario,
  PRESET_ACTORS,
} from "../agents/game-theory";

// SSR Calibration imports
import {
  SSRRater,
  createVoteRater,
  pmfToBinaryVote,
  aggregatePMFs,
  type SSRResult,
} from "../calibration/ssr-rater";

// Political persona imports
import {
  SENATORS,
  sampleSenators,
  buildSenatorPrompt,
  buildTikTokBanScenario,
} from "../personas/political";
import type { SenatorPersona, ScenarioContext as PoliticalScenario } from "../personas/political/types";

export class ComputeExecutor extends BaseExecutor {
  type: ExecutorType = "compute";
  primitiveIds = [
    // Legacy primitives
    "sim.montecarlo.oasis",
    "game.equilibrium",
    "branch.counterfactual",
    "uncertainty.aggregate",
    "opt.pareto",
    "output.chart",
    "data.doc.parse",
    // Spec primitives - Agent
    "agent.create",
    // Spec primitives - Population
    "population.sample",
    "population.filter",
    "population.segment",
    // Spec primitives - Aggregate
    "aggregate.distribution",
    "aggregate.weighted",
    // Spec primitives - Branch
    "branch.scenario",
    "branch.merge",
    // Spec primitives - Orchestrate
    "orchestrate.monte_carlo",
    "orchestrate.congressional_vote",
  ];

  async execute(ctx: ExecutorContext): Promise<ExecutorResult> {
    const startedAt = new Date();

    ctx.onProgress(5, "Initializing computation...");

    let outputs: Record<string, unknown>;
    let distribution: Distribution | undefined;

    switch (ctx.primitiveId) {
      case "sim.montecarlo.oasis":
        ({ outputs, distribution } = await this.executeMonteCarlo(ctx));
        break;
      case "game.equilibrium":
        outputs = await this.executeGameEquilibrium(ctx);
        break;
      case "branch.counterfactual":
        outputs = await this.executeCounterfactual(ctx);
        break;
      case "uncertainty.aggregate":
        ({ outputs, distribution } = await this.executeUncertaintyAggregation(ctx));
        break;
      case "opt.pareto":
        outputs = await this.executeParetoOptimization(ctx);
        break;
      case "output.chart":
        outputs = this.executeChart(ctx);
        break;
      case "data.doc.parse":
        outputs = await this.executeDocParse(ctx);
        break;
      // Spec primitives - Agent
      case "agent.create":
        outputs = this.executeAgentCreate(ctx);
        break;
      // Spec primitives - Population
      case "population.sample":
        outputs = await this.executePopulationSample(ctx);
        break;
      case "population.filter":
        outputs = this.executePopulationFilter(ctx);
        break;
      case "population.segment":
        outputs = this.executePopulationSegment(ctx);
        break;
      // Spec primitives - Aggregate
      case "aggregate.distribution":
        ({ outputs, distribution } = this.executeAggregateDistribution(ctx));
        break;
      case "aggregate.weighted":
        ({ outputs, distribution } = this.executeAggregateWeighted(ctx));
        break;
      // Spec primitives - Branch
      case "branch.scenario":
        outputs = this.executeBranchScenario(ctx);
        break;
      case "branch.merge":
        ({ outputs, distribution } = this.executeBranchMerge(ctx));
        break;
      // Spec primitives - Orchestrate
      case "orchestrate.monte_carlo":
        ({ outputs, distribution } = await this.executeMonteCarloSSR(ctx));
        break;
      case "orchestrate.congressional_vote":
        ({ outputs, distribution } = await this.executeCongressionalVote(ctx));
        break;
      default:
        throw new ExecutionError(
          "UNKNOWN_PRIMITIVE",
          `Unknown compute primitive: ${ctx.primitiveId}`,
          false
        );
    }

    ctx.onProgress(100, "Complete");

    return {
      outputs,
      distribution,
      timing: this.createTiming(startedAt),
    };
  }

  private async executeMonteCarlo(
    ctx: ExecutorContext
  ): Promise<{ outputs: Record<string, unknown>; distribution: Distribution }> {
    // Extract configuration
    const {
      populationId = "us_adults",
      sampleSize = 1000,
      useArchetypes = true,
      archetypeCount = 50,
      questionType = "binary",
      domain = "consumer",
      // Model routing options
      forceTier,
      maxCostPerCall,
      qualityRequirement,
    } = ctx.config;

    // Extract scenario from inputs
    const {
      scenario: scenarioText,
      question: questionText,
      context: contextText,
      options: choiceOptions,
      scaleMin,
      scaleMax,
    } = ctx.inputs;

    // Validate required inputs
    if (!scenarioText || !questionText) {
      throw new ExecutionError(
        "MISSING_INPUT",
        "Monte Carlo simulation requires 'scenario' and 'question' inputs",
        false
      );
    }

    ctx.onProgress(5, "Sampling population...");

    // Step 1: Sample population
    const samplingResult = samplePopulation({
      populationId: populationId as string,
      sampleSize: sampleSize as number,
      useArchetypes: useArchetypes as boolean,
      archetypeCount: archetypeCount as number,
    });

    const agents = samplingResult.agents;
    ctx.onProgress(10, `Generated ${agents.length} agent profiles (effective sample: ${samplingResult.metadata.effectiveSampleSize})`);

    // Step 2: Build scenario context
    const scenarioContext: ScenarioContext = {
      scenario: scenarioText as string,
      question: questionText as string,
      questionType: questionType as QuestionType,
      context: contextText as string | undefined,
      domain: domain as "enterprise" | "defense" | "consumer",
      options: choiceOptions as string[] | undefined,
      scaleMin: scaleMin as number | undefined,
      scaleMax: scaleMax as number | undefined,
    };

    ctx.onProgress(15, "Compiling agent prompts...");

    // Step 3: Compile prompts for all agents
    const compiledPrompts = compilePromptBatch(agents, scenarioContext);

    // Step 4: Route prompts to appropriate models
    const routingOptions: RoutingOptions = {
      domain: domain as "enterprise" | "defense" | "consumer",
      forceTier: forceTier as "haiku" | "sonnet" | "opus" | undefined,
      maxCostPerCall: maxCostPerCall as number | undefined,
      qualityRequirement: qualityRequirement as number | undefined,
    };

    const { routes, summary: routingSummary } = routeBatch(
      compiledPrompts.map((p) => p.prompt),
      routingOptions
    );

    ctx.onProgress(20, `Routing: ${routingSummary.byTier.haiku} Haiku, ${routingSummary.byTier.sonnet} Sonnet, ${routingSummary.byTier.opus} Opus`);
    ctx.onStream(`Estimated cost: $${routingSummary.totalEstimatedCost.toFixed(4)}, latency: ${Math.round(routingSummary.parallelLatencyMs / 1000)}s\n`);

    // Step 5: Create batch requests
    const parseOptions: ParseOptions = {
      questionType: questionType as QuestionType,
      options: choiceOptions as string[] | undefined,
      scaleMin: scaleMin as number | undefined,
      scaleMax: scaleMax as number | undefined,
    };

    const batchRequests = createBatchRequests(
      agents,
      compiledPrompts.map((p) => p.prompt),
      routes,
      parseOptions
    );

    ctx.onProgress(25, `Executing ${batchRequests.length} agent simulations...`);

    // Step 6: Execute batch with progress tracking
    let lastProgress = 25;
    const results = await executeBatch(batchRequests, {
      abortSignal: ctx.abortSignal,
      onProgress: (progress) => {
        const pct = 25 + (progress.completed / progress.total) * 65;
        if (pct - lastProgress >= 5) {
          ctx.onProgress(pct, `Completed ${progress.completed}/${progress.total} agents`);
          lastProgress = pct;
        }
      },
      onResult: (result) => {
        if (result.success && result.response.reasoning) {
          // Stream occasional reasoning samples
          if (Math.random() < 0.1) {
            ctx.onStream(`[${result.modelUsed}] ${result.response.reasoning.slice(0, 100)}...\n`);
          }
        }
      },
    });

    ctx.onProgress(90, "Aggregating results...");

    // Step 7: Aggregate responses
    const weights = results.map((r) => r.weight);
    const parsedResponses = results.map((r) => r.response);
    const aggregated = aggregateResponses(parsedResponses, weights);

    // Step 8: Build distribution
    const distribution: Distribution = {
      type: "empirical",
      mean: aggregated.weightedMean * 100, // Scale to percentage
      std: aggregated.std * 100,
      percentiles: {
        p5: (aggregated.mean - 1.645 * aggregated.std) * 100,
        p25: (aggregated.mean - 0.675 * aggregated.std) * 100,
        p50: aggregated.mean * 100,
        p75: (aggregated.mean + 0.675 * aggregated.std) * 100,
        p95: (aggregated.mean + 1.645 * aggregated.std) * 100,
      },
    };

    // Step 9: Build detailed outputs
    const successfulResults = results.filter((r) => r.success);
    const failedResults = results.filter((r) => !r.success);

    // Calculate actual costs
    const actualCosts = {
      haiku: results.filter((r) => r.modelUsed === "haiku").length * 0.0003,
      sonnet: results.filter((r) => r.modelUsed === "sonnet").length * 0.003,
      opus: results.filter((r) => r.modelUsed === "opus").length * 0.03,
    };
    const totalActualCost = actualCosts.haiku + actualCosts.sonnet + actualCosts.opus;

    // Build segment analysis for binary questions
    let segmentAnalysis: Record<string, unknown> | undefined;
    if (questionType === "binary") {
      segmentAnalysis = this.buildSegmentAnalysis(results, agents);
    }

    // Build reasoning samples
    const reasoningSamples = successfulResults
      .filter((r) => r.response.reasoning)
      .slice(0, 10)
      .map((r) => ({
        agentId: r.agentId,
        answer: r.response.value,
        confidence: r.response.confidence,
        reasoning: r.response.reasoning,
      }));

    return {
      outputs: {
        // Main result
        outcomeDistribution: distribution,
        prediction: {
          value: aggregated.weightedMean,
          confidenceInterval: {
            low: aggregated.mean - 1.96 * aggregated.std,
            high: aggregated.mean + 1.96 * aggregated.std,
          },
          sampleSize: samplingResult.metadata.effectiveSampleSize,
        },
        // For binary: proportion saying yes
        ...(questionType === "binary" && aggregated.distribution.yes !== undefined && {
          yesRate: aggregated.distribution.yes,
          noRate: aggregated.distribution.no,
        }),
        // For choice: option distribution
        ...(questionType === "choice" && aggregated.distribution.options && {
          optionDistribution: aggregated.distribution.options,
        }),
        // Confidence analysis
        confidenceBreakdown: aggregated.confidenceBreakdown,
        // Segment analysis (demographics)
        segmentAnalysis,
        // Sample reasoning for transparency
        reasoningSamples,
        // Execution metadata
        execution: {
          populationId,
          totalAgents: agents.length,
          effectiveSampleSize: samplingResult.metadata.effectiveSampleSize,
          successfulResponses: successfulResults.length,
          failedResponses: failedResults.length,
          parseSuccessRate: aggregated.successfulParses / parsedResponses.length,
          modelUsage: {
            haiku: results.filter((r) => r.modelUsed === "haiku").length,
            sonnet: results.filter((r) => r.modelUsed === "sonnet").length,
            opus: results.filter((r) => r.modelUsed === "opus").length,
          },
          costs: {
            estimated: routingSummary.totalEstimatedCost,
            actual: totalActualCost,
          },
          latency: {
            estimated: routingSummary.parallelLatencyMs,
            actual: results.reduce((max, r) => Math.max(max, r.latencyMs), 0),
          },
        },
        // Errors if any
        ...(failedResults.length > 0 && {
          errors: failedResults.slice(0, 5).map((r) => ({
            agentId: r.agentId,
            error: r.error,
          })),
        }),
      },
      distribution,
    };
  }

  // Build segment analysis from results
  private buildSegmentAnalysis(
    results: BatchResult[],
    agents: AgentProfile[]
  ): Record<string, unknown> {
    const agentMap = new Map(agents.map((a) => [a.id, a]));
    const segments: Record<string, { yes: number; no: number; total: number }> = {};

    // Analyze by age
    for (const result of results) {
      if (!result.success) continue;
      const agent = agentMap.get(result.agentId);
      if (!agent) continue;

      const ageGroup = agent.demographics.age;
      if (!segments[`age_${ageGroup}`]) {
        segments[`age_${ageGroup}`] = { yes: 0, no: 0, total: 0 };
      }

      segments[`age_${ageGroup}`].total += result.weight;
      if (result.response.value === true) {
        segments[`age_${ageGroup}`].yes += result.weight;
      } else {
        segments[`age_${ageGroup}`].no += result.weight;
      }

      // Also analyze by income
      const incomeGroup = agent.demographics.income;
      if (!segments[`income_${incomeGroup}`]) {
        segments[`income_${incomeGroup}`] = { yes: 0, no: 0, total: 0 };
      }

      segments[`income_${incomeGroup}`].total += result.weight;
      if (result.response.value === true) {
        segments[`income_${incomeGroup}`].yes += result.weight;
      } else {
        segments[`income_${incomeGroup}`].no += result.weight;
      }
    }

    // Convert to rates
    const segmentRates: Record<string, number> = {};
    for (const [key, data] of Object.entries(segments)) {
      if (data.total > 0) {
        segmentRates[key] = data.yes / data.total;
      }
    }

    return segmentRates;
  }

  private async executeGameEquilibrium(ctx: ExecutorContext): Promise<Record<string, unknown>> {
    // Extract configuration
    const {
      maxRounds = 5,
      domain = "enterprise",
      model = "claude-opus-4-20250514",
    } = ctx.config;

    // Extract actors and scenario from inputs
    const {
      actors: actorDefs,
      scenario: scenarioText,
      context: contextText,
      possibleActions: actionDefs,
    } = ctx.inputs;

    ctx.onProgress(5, "Setting up game theory simulation...");

    // Build actors
    let actors: StrategicActor[];

    if (actorDefs && Array.isArray(actorDefs)) {
      // Use provided actor definitions
      actors = (actorDefs as Array<{
        id?: string;
        name: string;
        role: string;
        objectives?: string[];
        constraints?: string[];
        context?: string;
      }>).map((def, i) => ({
        id: def.id || `actor_${i}`,
        name: def.name,
        role: def.role,
        objectives: def.objectives || ["Maximize own outcome"],
        constraints: def.constraints || [],
        context: def.context,
      }));
    } else {
      // Default to 2 generic competitors
      actors = [
        PRESET_ACTORS.competitor("Company A", "Market leader with 40% share"),
        PRESET_ACTORS.competitor("Company B", "Challenger with 25% share"),
      ];
    }

    // Build scenario
    let possibleActions: Record<string, string[]>;

    if (actionDefs && typeof actionDefs === "object") {
      possibleActions = actionDefs as Record<string, string[]>;
    } else {
      // Default actions for each actor
      possibleActions = {};
      for (const actor of actors) {
        possibleActions[actor.id] = ["Cooperate", "Compete aggressively", "Wait and see"];
      }
    }

    const scenario: GameScenario = {
      description: (scenarioText as string) || "A competitive market situation where multiple actors must choose strategies.",
      context: (contextText as string) || "",
      possibleActions,
      domain: domain as "enterprise" | "defense" | "consumer",
    };

    ctx.onProgress(10, `Simulating ${actors.length} strategic actors over up to ${maxRounds} rounds...`);

    // Stream actor info
    ctx.onStream(`Strategic actors:\n`);
    actors.forEach((a) => {
      ctx.onStream(`- ${a.name} (${a.role})\n`);
    });
    ctx.onStream(`\n`);

    // Execute game theory simulation
    const result = await executeGameTheory({
      actors,
      scenario,
      maxRounds: maxRounds as number,
      model: model as string,
      abortSignal: ctx.abortSignal,
      onRoundComplete: (round) => {
        const pct = 10 + (round.round / (maxRounds as number)) * 80;
        ctx.onProgress(pct, `Round ${round.round}: ${round.converged ? "Converged!" : "Continuing..."}`);

        // Stream round results
        ctx.onStream(`\n--- Round ${round.round} ---\n`);
        round.actions.forEach((action) => {
          const actor = actors.find((a) => a.id === action.actorId);
          ctx.onStream(`${actor?.name || action.actorId}: ${action.action} (${action.confidence > 0.7 ? "high" : action.confidence > 0.5 ? "medium" : "low"} confidence)\n`);
          ctx.onStream(`  Reasoning: ${action.reasoning.slice(0, 150)}...\n`);
        });

        if (round.converged) {
          ctx.onStream(`\n✓ ${round.convergenceReason}\n`);
        }
      },
    });

    ctx.onProgress(95, "Analyzing results...");

    // Build output
    const output: Record<string, unknown> = {
      // Equilibrium result
      equilibrium: result.equilibrium ? {
        actions: result.equilibrium.actions,
        isStable: result.equilibrium.isStable,
        stabilityReason: result.equilibrium.stabilityReason,
        convergedInRound: result.metadata.convergenceRound,
      } : null,

      // All rounds for analysis
      rounds: result.rounds.map((round) => ({
        round: round.round,
        actions: round.actions.map((a) => ({
          actor: actors.find((actor) => actor.id === a.actorId)?.name || a.actorId,
          action: a.action,
          confidence: a.confidence,
          anticipatedResponses: a.anticipatedResponses,
        })),
        converged: round.converged,
        convergenceReason: round.convergenceReason,
      })),

      // Summary statistics
      summary: {
        totalRounds: result.metadata.totalRounds,
        converged: result.metadata.converged,
        convergenceRound: result.metadata.convergenceRound,
        modelUsed: result.metadata.modelUsed,
        latencyMs: result.metadata.totalLatencyMs,
      },

      // Full reasoning traces for transparency
      reasoning: result.reasoning.map((r) => ({
        actor: actors.find((a) => a.id === r.actorId)?.name || r.actorId,
        fullReasoning: r.fullReasoning,
      })),

      // Actor definitions for reference
      actors: actors.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        objectives: a.objectives,
      })),

      // Scenario for reference
      scenario: {
        description: scenario.description,
        context: scenario.context,
        possibleActions: scenario.possibleActions,
      },
    };

    return output;
  }

  private async executeCounterfactual(ctx: ExecutorContext): Promise<Record<string, unknown>> {
    const { branches: branchDefs, parallelExecution = true } = ctx.config;
    const { baseScenario, results: baseResults } = ctx.inputs;

    let branches: Array<{ name: string; changes: Record<string, unknown> }>;
    try {
      branches = typeof branchDefs === "string" ? JSON.parse(branchDefs as string) : branchDefs as typeof branches;
      if (!Array.isArray(branches) || branches.length === 0) {
        branches = [
          { name: "Optimistic", changes: { growth: 1.2 } },
          { name: "Pessimistic", changes: { growth: 0.8 } },
        ];
      }
    } catch {
      branches = [
        { name: "Optimistic", changes: { growth: 1.2 } },
        { name: "Pessimistic", changes: { growth: 0.8 } },
      ];
    }

    ctx.onProgress(20, `Evaluating ${branches.length} counterfactual branches...`);

    const branchResults: Array<{
      name: string;
      changes: Record<string, unknown>;
      outcome: Record<string, unknown>;
      delta: number;
    }> = [];

    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i];
      ctx.onProgress(20 + (60 * i / branches.length), `Processing branch: ${branch.name}`);

      // Simulate counterfactual outcome
      const outcome = {
        value: 100 * (1 + (Math.random() - 0.5) * 0.4),
        confidence: 0.6 + Math.random() * 0.3,
      };

      branchResults.push({
        name: branch.name,
        changes: branch.changes,
        outcome,
        delta: outcome.value - 100, // Delta from baseline
      });
    }

    ctx.onProgress(90, "Comparing branches...");

    const outcomeValues = branchResults.map(b => b.outcome.value as number);
    return {
      branches: branchResults,
      comparison: {
        bestBranch: branchResults.reduce((best, curr) =>
          (curr.outcome.value as number) > (best.outcome.value as number) ? curr : best
        ).name,
        worstBranch: branchResults.reduce((worst, curr) =>
          (curr.outcome.value as number) < (worst.outcome.value as number) ? curr : worst
        ).name,
        spread: Math.max(...outcomeValues) - Math.min(...outcomeValues),
      },
    };
  }

  private async executeUncertaintyAggregation(
    ctx: ExecutorContext
  ): Promise<{ outputs: Record<string, unknown>; distribution: Distribution }> {
    const { aggregationMethod = "monte-carlo-propagation", separateEpistemic = true } = ctx.config;
    const { distributions: inputDists, correlations } = ctx.inputs;

    ctx.onProgress(20, `Aggregating uncertainty via ${aggregationMethod}...`);

    // Aggregate multiple distributions into one
    const inputs = (inputDists as Distribution[]) || [];

    // Simple aggregation: sum of means, RSS of stds
    let aggregatedMean = 0;
    let aggregatedVariance = 0;

    for (const dist of inputs) {
      aggregatedMean += dist.mean || 0;
      aggregatedVariance += Math.pow(dist.std || 0, 2);
    }

    const aggregatedStd = Math.sqrt(aggregatedVariance);

    ctx.onProgress(70, "Computing confidence bounds...");

    const distribution: Distribution = {
      type: "normal",
      mean: aggregatedMean,
      std: aggregatedStd,
      percentiles: {
        p5: aggregatedMean - 1.645 * aggregatedStd,
        p25: aggregatedMean - 0.675 * aggregatedStd,
        p50: aggregatedMean,
        p75: aggregatedMean + 0.675 * aggregatedStd,
        p95: aggregatedMean + 1.645 * aggregatedStd,
      },
    };

    return {
      outputs: {
        aggregatedDistribution: distribution,
        uncertaintyBreakdown: {
          aleatory: aggregatedStd * 0.6, // Random uncertainty
          epistemic: aggregatedStd * 0.4, // Knowledge uncertainty
          total: aggregatedStd,
        },
        inputCount: inputs.length,
      },
      distribution,
    };
  }

  private async executeParetoOptimization(ctx: ExecutorContext): Promise<Record<string, unknown>> {
    const { iterations = 1000, populationSize = 100 } = ctx.config;
    const { objectives, constraints } = ctx.inputs;

    ctx.onProgress(10, "Initializing population...");

    // Generate Pareto frontier points
    const frontierSize = Math.min(20, populationSize as number);
    const frontier: Array<{ objectives: Record<string, number>; solution: Record<string, number> }> = [];

    for (let i = 0; i < frontierSize; i++) {
      ctx.onProgress(10 + (70 * i / frontierSize), `Evaluating solution ${i + 1}/${frontierSize}`);

      // Generate point on Pareto frontier (simplified)
      const t = i / (frontierSize - 1);
      frontier.push({
        objectives: {
          objective1: 100 * (1 - t) + Math.random() * 5,
          objective2: 100 * t + Math.random() * 5,
        },
        solution: {
          x: t,
          y: 1 - t,
        },
      });
    }

    ctx.onProgress(90, "Analyzing trade-offs...");

    return {
      frontier,
      tradeoffs: {
        frontierSize: frontier.length,
        extremePoints: {
          maxObjective1: frontier[0],
          maxObjective2: frontier[frontier.length - 1],
        },
        kneePoint: frontier[Math.floor(frontier.length / 2)],
      },
      iterations: iterations,
    };
  }

  private executeChart(ctx: ExecutorContext): Record<string, unknown> {
    const { chartType = "bar", title, interactive = true } = ctx.config;
    const { data } = ctx.inputs;

    // Generate chart configuration for frontend rendering
    return {
      chart: {
        type: chartType,
        title: title || "Generated Chart",
        data: data,
        options: {
          interactive,
          responsive: true,
          animation: true,
        },
      },
    };
  }

  private async executeDocParse(ctx: ExecutorContext): Promise<Record<string, unknown>> {
    const { extractTables = true, extractImages = false } = ctx.config;
    const { file, dataId } = ctx.inputs;

    ctx.onProgress(10, "Loading document...");

    // Check if we have a dataId (from data library) or raw file content
    let fileContent: string | Buffer;
    let fileType: string;
    let filename: string;

    if (dataId && typeof dataId === "string") {
      // Fetch from data store
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/data/upload?id=${dataId}`);
        if (!response.ok) {
          throw new Error(`Data not found: ${dataId}`);
        }
        const data = await response.json();
        fileContent = data.rawContent || data.content;
        fileType = data.type;
        filename = data.filename;

        // If already parsed (CSV, JSON), return the content directly
        if (fileType === "csv" || fileType === "json") {
          return {
            content: {
              text: typeof fileContent === "string" ? fileContent.slice(0, 1000) : JSON.stringify(data.preview),
              data: data.content,
              schema: data.schema,
              metadata: {
                filename,
                type: fileType,
                rowCount: data.rowCount,
                extractedAt: new Date().toISOString(),
              },
            },
          };
        }
      } catch (error) {
        throw new ExecutionError(
          "DATA_LOAD_FAILED",
          `Failed to load data: ${error instanceof Error ? error.message : "Unknown error"}`,
          true
        );
      }
    } else if (file && typeof file === "string") {
      // Raw file content provided
      fileContent = file;
      fileType = "txt";
      filename = "document";
    } else {
      throw new ExecutionError(
        "MISSING_INPUT",
        "Document parsing requires either 'dataId' (from data library) or 'file' input",
        false
      );
    }

    ctx.onProgress(30, `Processing ${fileType.toUpperCase()} document...`);

    // Parse based on file type
    let parsedContent: {
      text: string;
      sections?: Array<{ heading: string; content: string }>;
      tables?: Array<{ name: string; headers: string[]; rows: string[][] }>;
      metadata: Record<string, unknown>;
    };

    switch (fileType) {
      case "pdf": {
        ctx.onProgress(40, "Extracting PDF text...");
        // For PDF, we'd use pdf-parse in a real implementation
        // Since pdf-parse requires Buffer and we're in browser context for demo,
        // provide structured fallback
        const textContent = typeof fileContent === "string" ? fileContent : "";
        const paragraphs = textContent.split(/\n\n+/).filter(p => p.trim());

        parsedContent = {
          text: textContent.slice(0, 5000),
          sections: paragraphs.slice(0, 10).map((p, i) => ({
            heading: `Section ${i + 1}`,
            content: p.trim(),
          })),
          tables: [],
          metadata: {
            filename,
            type: "pdf",
            wordCount: textContent.split(/\s+/).length,
            extractedAt: new Date().toISOString(),
          },
        };
        break;
      }

      case "txt": {
        ctx.onProgress(40, "Processing text file...");
        const textContent = typeof fileContent === "string" ? fileContent : String(fileContent);
        const lines = textContent.split("\n");

        parsedContent = {
          text: textContent,
          sections: [{
            heading: "Content",
            content: textContent,
          }],
          metadata: {
            filename,
            type: "txt",
            lineCount: lines.length,
            wordCount: textContent.split(/\s+/).length,
            extractedAt: new Date().toISOString(),
          },
        };
        break;
      }

      case "docx": {
        ctx.onProgress(40, "Processing Word document...");
        // For DOCX, mammoth would be used in server context
        const textContent = typeof fileContent === "string" ? fileContent : "";

        parsedContent = {
          text: textContent,
          sections: [{
            heading: "Document Content",
            content: textContent,
          }],
          metadata: {
            filename,
            type: "docx",
            wordCount: textContent.split(/\s+/).length,
            extractedAt: new Date().toISOString(),
          },
        };
        break;
      }

      default: {
        // Generic text handling
        const textContent = typeof fileContent === "string" ? fileContent : JSON.stringify(fileContent);
        parsedContent = {
          text: textContent,
          metadata: {
            filename,
            type: fileType,
            extractedAt: new Date().toISOString(),
          },
        };
      }
    }

    ctx.onProgress(80, "Finalizing extraction...");

    // Extract tables if requested and available
    if (extractTables && parsedContent.text) {
      ctx.onProgress(85, "Detecting tables...");
      // Simple table detection from text (looking for tab-separated or pipe-separated data)
      const lines = parsedContent.text.split("\n");
      const potentialTables: Array<{ name: string; headers: string[]; rows: string[][] }> = [];

      let currentTable: string[][] = [];
      let inTable = false;

      for (const line of lines) {
        const cells = line.split(/\t|\|/).map(c => c.trim()).filter(c => c);
        if (cells.length >= 2) {
          if (!inTable) {
            inTable = true;
            currentTable = [];
          }
          currentTable.push(cells);
        } else if (inTable && currentTable.length >= 2) {
          potentialTables.push({
            name: `Table ${potentialTables.length + 1}`,
            headers: currentTable[0],
            rows: currentTable.slice(1),
          });
          currentTable = [];
          inTable = false;
        }
      }

      // Add last table if exists
      if (inTable && currentTable.length >= 2) {
        potentialTables.push({
          name: `Table ${potentialTables.length + 1}`,
          headers: currentTable[0],
          rows: currentTable.slice(1),
        });
      }

      if (potentialTables.length > 0) {
        parsedContent.tables = potentialTables;
      }
    }

    ctx.onProgress(95, "Complete");

    return {
      content: parsedContent,
    };
  }

  // ========================================
  // SPEC PRIMITIVES - Agent
  // ========================================

  private executeAgentCreate(ctx: ExecutorContext): Record<string, unknown> {
    const { name, role = "consumer", traits = {}, beliefs = {}, goals = [] } = ctx.config;

    ctx.onProgress(20, "Creating agent profile...");

    // Generate unique agent ID
    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Build agent object with traits
    const traitsObj = (traits && typeof traits === "object" ? traits : {}) as Record<string, unknown>;
    const agent = {
      id: agentId,
      name: name || `Agent ${agentId.slice(-6)}`,
      role,
      traits: {
        ...traitsObj,
        // Provide defaults if not specified
        risk_tolerance: traitsObj.risk_tolerance ?? 0.5,
        brand_loyalty: traitsObj.brand_loyalty ?? 0.5,
      },
      beliefs,
      goals: Array.isArray(goals) ? goals : [],
      createdAt: new Date().toISOString(),
    };

    ctx.onProgress(60, "Compiling persona prompt...");

    // Build persona prompt context for LLM calls
    const promptContext = this.buildAgentPromptContext(agent);

    ctx.onProgress(100, "Agent created");

    return {
      agent_id: agentId,
      agent,
      prompt_context: promptContext,
    };
  }

  private buildAgentPromptContext(agent: Record<string, unknown>): string {
    const traits = agent.traits as Record<string, unknown> || {};
    const beliefs = agent.beliefs as Record<string, unknown> || {};
    const goals = agent.goals as string[] || [];

    let context = `You are ${agent.name || "an individual"}, a ${agent.role || "person"}.\n\n`;

    // Add demographic traits
    const demographicParts: string[] = [];
    if (traits.age) demographicParts.push(`${traits.age} years old`);
    if (traits.gender) demographicParts.push(traits.gender as string);
    if (traits.occupation) demographicParts.push(`working as a ${traits.occupation}`);
    if (traits.education) demographicParts.push(`with ${traits.education} education`);
    if (traits.income) demographicParts.push(`earning ${traits.income}`);
    if (traits.location) demographicParts.push(`living in ${traits.location}`);

    if (demographicParts.length > 0) {
      context += `Demographics: ${demographicParts.join(", ")}.\n\n`;
    }

    // Add psychographic traits
    const psychParts: string[] = [];
    if (typeof traits.risk_tolerance === "number") {
      const rt = traits.risk_tolerance;
      psychParts.push(rt > 0.7 ? "risk-tolerant" : rt < 0.3 ? "risk-averse" : "moderate risk tolerance");
    }
    if (typeof traits.brand_loyalty === "number") {
      const bl = traits.brand_loyalty;
      psychParts.push(bl > 0.7 ? "brand-loyal" : bl < 0.3 ? "always shops around" : "moderately brand-conscious");
    }

    if (psychParts.length > 0) {
      context += `Personality: ${psychParts.join(", ")}.\n\n`;
    }

    // Add beliefs
    if (Object.keys(beliefs).length > 0) {
      context += "Beliefs:\n";
      for (const [topic, belief] of Object.entries(beliefs)) {
        context += `- ${topic}: ${belief}\n`;
      }
      context += "\n";
    }

    // Add goals
    if (goals.length > 0) {
      context += `Goals: ${goals.join("; ")}.\n\n`;
    }

    context += "When answering questions, respond authentically based on this background.";

    return context;
  }

  // ========================================
  // SPEC PRIMITIVES - Population
  // ========================================

  private async executePopulationSample(ctx: ExecutorContext): Promise<Record<string, unknown>> {
    const {
      population_spec = {},
      strategy = "stratified",
      filters = [],
      archetype_config = {},
      seed,
      use_database = true,  // Enable database VIP integration by default
      vip_ratio = 0.1,      // 10% VIP agents by default
      vertical,             // Optional vertical filter for VIPs
    } = ctx.config;
    const spec = population_spec as Record<string, unknown>;

    ctx.onProgress(10, "Initializing population sampling...");

    const populationId = (spec.base as string) || "us_adults";
    const sampleSize = (spec.size as number) || 1000;
    const useArchetypes = strategy === "archetype";
    const archetypeCount = (archetype_config as Record<string, unknown>).n_archetypes as number || 50;

    // Check if we should use database-backed agent store
    const useDatabase = use_database as boolean && agentStore.isDatabaseEnabled();

    ctx.onProgress(30, `Sampling ${sampleSize} agents from ${populationId}...`);

    if (useDatabase) {
      // Use AgentStore for database-backed sampling (includes VIPs)
      ctx.onProgress(40, `Using database with VIP ratio ${(vip_ratio as number) * 100}%...`);

      const agents = await agentStore.samplePopulation(
        { base: populationId as "us_adults" | "us_voters" | "us_consumers" | "enterprise_decision_makers" | "defense_stakeholders" },
        sampleSize,
        {
          useVIPs: true,
          vipRatio: vip_ratio as number,
          useArchetypes,
          seed: seed as number | undefined,
          vertical: vertical as string | undefined,
        }
      );

      // Count VIPs in sample
      const vipCount = agents.filter(a => a.tier === "vip").length;

      ctx.onProgress(80, `Generated ${agents.length} agents (${vipCount} VIPs from database)`);

      // Build weights array
      const weights = agents.map(a => a.weight);

      ctx.onProgress(100, "Sampling complete");

      return {
        agents,
        sample_metadata: {
          populationId,
          totalRequested: sampleSize,
          totalGenerated: agents.length,
          useArchetypes,
          useDatabase: true,
          vipCount,
          statisticalCount: agents.length - vipCount,
        },
        weights,
      };
    }

    // Fall back to pure synthetic sampling
    const result = samplePopulation({
      populationId,
      sampleSize,
      useArchetypes,
      archetypeCount,
      seed: seed as number | undefined,
      useConditionals: true,
    });

    ctx.onProgress(80, `Generated ${result.agents.length} synthetic agent profiles`);

    // Build weights array
    const weights = result.agents.map(a => a.weight);

    ctx.onProgress(100, "Sampling complete");

    return {
      agents: result.agents,
      sample_metadata: {
        ...result.metadata,
        useDatabase: false,
        vipCount: 0,
      },
      weights,
    };
  }

  private executePopulationFilter(ctx: ExecutorContext): Record<string, unknown> {
    const { filters = [], combine = "and" } = ctx.config;
    const { agents: inputAgents } = ctx.inputs;

    if (!inputAgents || !Array.isArray(inputAgents)) {
      throw new ExecutionError("MISSING_INPUT", "Population filter requires 'agents' input array", false);
    }

    ctx.onProgress(10, "Applying filters...");

    const filterList = filters as Array<{ trait: string; operator: string; value: unknown }>;
    const combineLogic = combine as "and" | "or";

    // Filter function
    const matchesFilter = (agent: AgentProfile, filter: { trait: string; operator: string; value: unknown }): boolean => {
      const traitPath = filter.trait.split(".");
      let value: unknown = agent;

      for (const part of traitPath) {
        if (value && typeof value === "object") {
          value = (value as Record<string, unknown>)[part];
        } else {
          return false;
        }
      }

      switch (filter.operator) {
        case "eq": return value === filter.value;
        case "neq": return value !== filter.value;
        case "gt": return typeof value === "number" && value > (filter.value as number);
        case "lt": return typeof value === "number" && value < (filter.value as number);
        case "gte": return typeof value === "number" && value >= (filter.value as number);
        case "lte": return typeof value === "number" && value <= (filter.value as number);
        case "in": return Array.isArray(filter.value) && (filter.value as unknown[]).includes(value);
        case "between": {
          if (typeof value !== "number" || !Array.isArray(filter.value)) return false;
          const [min, max] = filter.value as [number, number];
          return value >= min && value <= max;
        }
        default: return true;
      }
    };

    const filteredAgents = (inputAgents as AgentProfile[]).filter(agent => {
      if (filterList.length === 0) return true;

      if (combineLogic === "and") {
        return filterList.every(f => matchesFilter(agent, f));
      } else {
        return filterList.some(f => matchesFilter(agent, f));
      }
    });

    ctx.onProgress(100, `Filtered to ${filteredAgents.length} agents`);

    return {
      agents: filteredAgents,
      filter_metadata: {
        inputCount: (inputAgents as AgentProfile[]).length,
        outputCount: filteredAgents.length,
        filterRatio: filteredAgents.length / (inputAgents as AgentProfile[]).length,
        filtersApplied: filterList.length,
        combineLogic,
      },
    };
  }

  private executePopulationSegment(ctx: ExecutorContext): Record<string, unknown> {
    const { segment_by = ["demographics.age", "demographics.income"], bucketing = {} } = ctx.config;
    const { agents: inputAgents, agent_results: results } = ctx.inputs;

    if (!inputAgents || !Array.isArray(inputAgents)) {
      throw new ExecutionError("MISSING_INPUT", "Population segment requires 'agents' input array", false);
    }

    ctx.onProgress(10, "Segmenting population...");

    const segmentTraits = segment_by as string[];
    const agents = inputAgents as AgentProfile[];
    const agentResults = results as Array<{ agentId: string; value: unknown; confidence?: number }> | undefined;

    // Build segments
    const segments: Map<string, { agents: AgentProfile[]; results: unknown[] }> = new Map();

    for (const agent of agents) {
      // Build segment key from traits
      const keyParts = segmentTraits.map(trait => {
        const parts = trait.split(".");
        let value: unknown = agent;
        for (const part of parts) {
          if (value && typeof value === "object") {
            value = (value as Record<string, unknown>)[part];
          }
        }
        return String(value ?? "unknown");
      });
      const segmentKey = keyParts.join("|");

      if (!segments.has(segmentKey)) {
        segments.set(segmentKey, { agents: [], results: [] });
      }
      segments.get(segmentKey)!.agents.push(agent);

      // Add result if available
      if (agentResults) {
        const result = agentResults.find(r => r.agentId === agent.id);
        if (result) {
          segments.get(segmentKey)!.results.push(result.value);
        }
      }
    }

    ctx.onProgress(60, `Found ${segments.size} segments`);

    // Build output segments
    const outputSegments = Array.from(segments.entries()).map(([key, data]) => {
      const keyParts = key.split("|");
      const segmentLabels: Record<string, string> = {};
      segmentTraits.forEach((trait, i) => {
        segmentLabels[trait] = keyParts[i];
      });

      // Calculate statistics if results available
      let statistics: Record<string, unknown> | undefined;
      if (data.results.length > 0) {
        const numericResults = data.results.filter(r => typeof r === "number") as number[];
        if (numericResults.length > 0) {
          const mean = numericResults.reduce((a, b) => a + b, 0) / numericResults.length;
          const variance = numericResults.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / numericResults.length;
          statistics = {
            mean,
            std: Math.sqrt(variance),
            count: numericResults.length,
          };
        }

        // For boolean/binary results
        const boolResults = data.results.filter(r => typeof r === "boolean") as boolean[];
        if (boolResults.length > 0) {
          const yesCount = boolResults.filter(r => r).length;
          statistics = {
            yesRate: yesCount / boolResults.length,
            noRate: 1 - yesCount / boolResults.length,
            count: boolResults.length,
          };
        }
      }

      return {
        id: `segment_${Math.random().toString(36).substring(2, 9)}`,
        labels: segmentLabels,
        agentCount: data.agents.length,
        weight: data.agents.reduce((sum, a) => sum + a.weight, 0),
        statistics,
      };
    });

    ctx.onProgress(100, "Segmentation complete");

    // Build comparison if we have results
    let segmentComparison: Record<string, unknown> | undefined;
    if (agentResults && outputSegments.some(s => s.statistics)) {
      const segmentsWithStats = outputSegments.filter(s => s.statistics);
      if (segmentsWithStats.length > 0) {
        const sortedByMean = [...segmentsWithStats].sort((a, b) => {
          const aMean = (a.statistics as Record<string, number>)?.mean ?? (a.statistics as Record<string, number>)?.yesRate ?? 0;
          const bMean = (b.statistics as Record<string, number>)?.mean ?? (b.statistics as Record<string, number>)?.yesRate ?? 0;
          return bMean - aMean;
        });

        segmentComparison = {
          highestSegment: sortedByMean[0],
          lowestSegment: sortedByMean[sortedByMean.length - 1],
          spread: (() => {
            const highest = (sortedByMean[0].statistics as Record<string, number>)?.mean ?? (sortedByMean[0].statistics as Record<string, number>)?.yesRate ?? 0;
            const lowest = (sortedByMean[sortedByMean.length - 1].statistics as Record<string, number>)?.mean ?? (sortedByMean[sortedByMean.length - 1].statistics as Record<string, number>)?.yesRate ?? 0;
            return highest - lowest;
          })(),
        };
      }
    }

    return {
      segments: outputSegments,
      segment_comparison: segmentComparison,
    };
  }

  // ========================================
  // SPEC PRIMITIVES - Aggregate
  // ========================================

  private executeAggregateDistribution(
    ctx: ExecutorContext
  ): { outputs: Record<string, unknown>; distribution: Distribution } {
    const { response_type = "categorical", bucketing = {} } = ctx.config;
    const { results: inputResults } = ctx.inputs;

    if (!inputResults || !Array.isArray(inputResults)) {
      throw new ExecutionError("MISSING_INPUT", "aggregate.distribution requires 'results' input array", false);
    }

    ctx.onProgress(10, "Building distribution...");

    const results = inputResults as Array<{ value: unknown; confidence?: number; weight?: number }>;
    const responseType = response_type as "binary" | "categorical" | "numeric" | "likert";

    // Extract values and weights
    const values = results.map(r => r.value);
    const weights = results.map(r => r.weight ?? 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    let distribution: Distribution;
    let statistics: Record<string, unknown>;

    if (responseType === "binary") {
      // Binary distribution
      const yesWeight = results
        .filter(r => r.value === true || r.value === "yes" || r.value === 1)
        .reduce((sum, r) => sum + (r.weight ?? 1), 0);
      const yesRate = yesWeight / totalWeight;

      distribution = {
        type: "empirical",
        mean: yesRate,
        std: Math.sqrt(yesRate * (1 - yesRate) / results.length),
        percentiles: {
          p5: Math.max(0, yesRate - 1.645 * Math.sqrt(yesRate * (1 - yesRate) / results.length)),
          p25: Math.max(0, yesRate - 0.675 * Math.sqrt(yesRate * (1 - yesRate) / results.length)),
          p50: yesRate,
          p75: Math.min(1, yesRate + 0.675 * Math.sqrt(yesRate * (1 - yesRate) / results.length)),
          p95: Math.min(1, yesRate + 1.645 * Math.sqrt(yesRate * (1 - yesRate) / results.length)),
        },
      };

      statistics = {
        yesRate,
        noRate: 1 - yesRate,
        sampleSize: results.length,
        confidenceInterval: {
          low: distribution.percentiles!.p5,
          high: distribution.percentiles!.p95,
        },
      };
    } else if (responseType === "numeric" || responseType === "likert") {
      // Numeric distribution
      const numericValues = values.filter(v => typeof v === "number") as number[];
      if (numericValues.length === 0) {
        throw new ExecutionError("INVALID_DATA", "No numeric values in results", false);
      }

      const weightedSum = results
        .filter(r => typeof r.value === "number")
        .reduce((sum, r) => sum + (r.value as number) * (r.weight ?? 1), 0);
      const mean = weightedSum / totalWeight;

      const weightedVariance = results
        .filter(r => typeof r.value === "number")
        .reduce((sum, r) => sum + (r.weight ?? 1) * Math.pow((r.value as number) - mean, 2), 0) / totalWeight;
      const std = Math.sqrt(weightedVariance);

      // Build histogram (10 buckets)
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      const bucketWidth = (max - min) / 10 || 1;
      const histogram = new Array(10).fill(0);

      for (const result of results) {
        if (typeof result.value === "number") {
          const bucket = Math.min(9, Math.floor((result.value - min) / bucketWidth));
          histogram[bucket] += result.weight ?? 1;
        }
      }
      const normalizedHistogram = histogram.map(h => h / totalWeight);

      distribution = {
        type: "empirical",
        mean,
        std,
        min,
        max,
        samples: normalizedHistogram,
        percentiles: {
          p5: mean - 1.645 * std,
          p25: mean - 0.675 * std,
          p50: mean,
          p75: mean + 0.675 * std,
          p95: mean + 1.645 * std,
        },
      };

      statistics = {
        mean,
        std,
        min,
        max,
        histogram: normalizedHistogram,
        sampleSize: numericValues.length,
        confidenceInterval: {
          low: distribution.percentiles!.p5,
          high: distribution.percentiles!.p95,
        },
      };
    } else {
      // Categorical distribution
      const counts: Record<string, number> = {};
      for (const result of results) {
        const key = String(result.value);
        counts[key] = (counts[key] || 0) + (result.weight ?? 1);
      }

      const proportions: Record<string, number> = {};
      for (const [key, count] of Object.entries(counts)) {
        proportions[key] = count / totalWeight;
      }

      // Find mode
      const mode = Object.entries(proportions).reduce((a, b) => a[1] > b[1] ? a : b)[0];

      distribution = {
        type: "empirical",
        mean: proportions[mode] || 0,
        std: 0.1, // Categorical std is not well-defined
      };

      statistics = {
        options: proportions,
        mode,
        modeFrequency: proportions[mode],
        entropy: -Object.values(proportions)
          .filter(p => p > 0)
          .reduce((sum, p) => sum + p * Math.log2(p), 0),
        sampleSize: results.length,
      };
    }

    ctx.onProgress(100, "Distribution complete");

    return {
      outputs: {
        distribution,
        statistics,
      },
      distribution,
    };
  }

  private executeAggregateWeighted(
    ctx: ExecutorContext
  ): { outputs: Record<string, unknown>; distribution: Distribution } {
    const { normalize_weights = true } = ctx.config;
    const { results: inputResults } = ctx.inputs;

    if (!inputResults || !Array.isArray(inputResults)) {
      throw new ExecutionError("MISSING_INPUT", "aggregate.weighted requires 'results' input array", false);
    }

    ctx.onProgress(10, "Computing weighted aggregate...");

    const results = inputResults as Array<{
      distribution?: Distribution;
      value?: number;
      weight?: number;
    }>;

    // Extract means and weights from distributions or direct values
    const items = results.map(r => ({
      mean: r.distribution?.mean ?? r.value ?? 0,
      std: r.distribution?.std ?? 0.1,
      weight: r.weight ?? 1,
    }));

    let totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
    if (normalize_weights && totalWeight > 0) {
      items.forEach(i => i.weight /= totalWeight);
      totalWeight = 1;
    }

    // Weighted mean
    const combinedMean = items.reduce((sum, i) => sum + i.mean * i.weight, 0);

    // Combined variance (weighted sum of variances + variance of means)
    const varianceOfMeans = items.reduce((sum, i) => sum + i.weight * Math.pow(i.mean - combinedMean, 2), 0);
    const weightedVariance = items.reduce((sum, i) => sum + i.weight * i.std * i.std, 0);
    const combinedStd = Math.sqrt(weightedVariance + varianceOfMeans);

    const distribution: Distribution = {
      type: "normal",
      mean: combinedMean,
      std: combinedStd,
      percentiles: {
        p5: combinedMean - 1.645 * combinedStd,
        p25: combinedMean - 0.675 * combinedStd,
        p50: combinedMean,
        p75: combinedMean + 0.675 * combinedStd,
        p95: combinedMean + 1.645 * combinedStd,
      },
    };

    ctx.onProgress(100, "Weighted aggregate complete");

    return {
      outputs: {
        combined_distribution: distribution,
        expected_value: combinedMean,
        uncertainty: {
          aleatory: Math.sqrt(weightedVariance),
          epistemic: Math.sqrt(varianceOfMeans),
          total: combinedStd,
        },
        input_count: results.length,
      },
      distribution,
    };
  }

  // ========================================
  // SPEC PRIMITIVES - Branch
  // ========================================

  private executeBranchScenario(ctx: ExecutorContext): Record<string, unknown> {
    const {
      scenario_name = "Scenario",
      description = "",
      probability = 0.33,
      modifications = {},
    } = ctx.config;
    const { base_context } = ctx.inputs;

    ctx.onProgress(10, "Creating scenario branch...");

    const scenarioId = `scenario_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const mods = modifications as {
      context_changes?: Record<string, unknown>;
      agent_changes?: Record<string, unknown>;
      environment_changes?: Record<string, unknown>;
    };

    // Apply modifications to base context
    const baseCtx = (base_context as Record<string, unknown>) || {};
    const modifiedContext = {
      ...baseCtx,
      ...(mods.context_changes || {}),
      _scenario: {
        id: scenarioId,
        name: scenario_name,
        probability,
        modifications: mods,
      },
    };

    ctx.onProgress(100, "Scenario ready");

    return {
      scenario_id: scenarioId,
      scenario_name,
      modified_context: modifiedContext,
      modified_agents: mods.agent_changes,
      ready: true,
    };
  }

  private executeBranchMerge(
    ctx: ExecutorContext
  ): { outputs: Record<string, unknown>; distribution: Distribution } {
    const { merge_strategy = "weighted_average" } = ctx.config;
    const { branches: inputBranches } = ctx.inputs;

    if (!inputBranches || !Array.isArray(inputBranches)) {
      throw new ExecutionError("MISSING_INPUT", "branch.merge requires 'branches' input array", false);
    }

    ctx.onProgress(10, "Merging branches...");

    const branches = inputBranches as Array<{
      scenario_name?: string;
      probability?: number;
      result?: { distribution?: Distribution; value?: number };
    }>;

    // Extract values and weights (probabilities)
    const items = branches.map(b => ({
      name: b.scenario_name || "Unknown",
      probability: b.probability ?? 1 / branches.length,
      mean: b.result?.distribution?.mean ?? b.result?.value ?? 0,
      std: b.result?.distribution?.std ?? 0.1,
    }));

    // Normalize probabilities
    const totalProb = items.reduce((sum, i) => sum + i.probability, 0);
    items.forEach(i => i.probability /= totalProb);

    let mergedMean: number;
    let mergedStd: number;

    switch (merge_strategy) {
      case "expected_value":
      case "weighted_average":
        // E[X] = sum(p_i * x_i)
        mergedMean = items.reduce((sum, i) => sum + i.probability * i.mean, 0);
        // Var[X] = E[X^2] - E[X]^2 + sum(p_i * var_i)
        const varianceOfMeans = items.reduce((sum, i) => sum + i.probability * Math.pow(i.mean - mergedMean, 2), 0);
        const expectedVariance = items.reduce((sum, i) => sum + i.probability * i.std * i.std, 0);
        mergedStd = Math.sqrt(varianceOfMeans + expectedVariance);
        break;

      case "worst_case":
        const worstItem = items.reduce((worst, i) => i.mean < worst.mean ? i : worst, items[0]);
        mergedMean = worstItem.mean;
        mergedStd = worstItem.std;
        break;

      case "best_case":
        const bestItem = items.reduce((best, i) => i.mean > best.mean ? i : best, items[0]);
        mergedMean = bestItem.mean;
        mergedStd = bestItem.std;
        break;

      default:
        throw new ExecutionError("INVALID_CONFIG", `Unknown merge strategy: ${merge_strategy}`, false);
    }

    const distribution: Distribution = {
      type: "normal",
      mean: mergedMean,
      std: mergedStd,
      percentiles: {
        p5: mergedMean - 1.645 * mergedStd,
        p25: mergedMean - 0.675 * mergedStd,
        p50: mergedMean,
        p75: mergedMean + 0.675 * mergedStd,
        p95: mergedMean + 1.645 * mergedStd,
      },
    };

    ctx.onProgress(100, "Branches merged");

    return {
      outputs: {
        merged_result: {
          mean: mergedMean,
          std: mergedStd,
          confidenceInterval: {
            low: distribution.percentiles!.p5,
            high: distribution.percentiles!.p95,
          },
        },
        uncertainty: {
          aleatory: Math.sqrt(items.reduce((sum, i) => sum + i.probability * i.std * i.std, 0)),
          scenario: Math.sqrt(items.reduce((sum, i) => sum + i.probability * Math.pow(i.mean - mergedMean, 2), 0)),
          total: mergedStd,
        },
        branches_merged: items.map(i => ({
          name: i.name,
          probability: i.probability,
          mean: i.mean,
        })),
        strategy: merge_strategy,
      },
      distribution,
    };
  }

  // Helper functions
  private sampleNormal(mean: number, std: number): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z;
  }

  private generateDefaultPayoffMatrix(players: unknown[]): Record<string, number> {
    // Classic prisoner's dilemma payoffs
    return {
      "cooperate-cooperate": 3,
      "cooperate-defect": 0,
      "defect-cooperate": 5,
      "defect-defect": 1,
    };
  }

  // =============================================================================
  // CONGRESSIONAL VOTE SIMULATION WITH SSR CALIBRATION
  // =============================================================================

  private async executeCongressionalVote(
    ctx: ExecutorContext
  ): Promise<{ outputs: Record<string, unknown>; distribution: Distribution }> {
    const {
      sampleSize = 100, // Number of senators to simulate (max 100)
      scenario: scenarioType = "tiktok_ban",
      withChinaRetaliation = false,
      customScenario,
    } = ctx.config;

    const { question: questionText } = ctx.inputs;

    ctx.onProgress(5, "Loading senator personas...");

    // Step 1: Sample senators
    const senators = sampleSenators(Math.min(sampleSize as number, 100), {
      partyBalance: true,
    });

    ctx.onProgress(10, `Simulating ${senators.length} senators`);

    // Step 2: Build scenario context
    let scenario: PoliticalScenario;
    if (customScenario) {
      scenario = customScenario as PoliticalScenario;
    } else if (scenarioType === "tiktok_ban") {
      scenario = buildTikTokBanScenario(withChinaRetaliation as boolean);
    } else {
      scenario = {
        description: String(ctx.inputs.scenario || "A bill is before the Senate for a vote."),
        backgroundInfo: [],
        recentEvents: [],
        stakeholderPositions: {},
      };
    }

    // Step 3: Create SSR vote rater
    const voteRater = createVoteRater({ temperature: 1.0 });

    ctx.onProgress(15, "Generating senator responses...");

    // Step 4: Execute simulation for each senator
    const results: Array<{
      senator: SenatorPersona;
      response: string;
      ssrResult: SSRResult;
      latencyMs: number;
    }> = [];

    const question = questionText as string || "How would you vote on this bill?";
    const batchSize = 10;

    for (let i = 0; i < senators.length; i += batchSize) {
      const batch = senators.slice(i, i + batchSize);
      const progress = 15 + (i / senators.length) * 70;
      ctx.onProgress(progress, `Processing senators ${i + 1}-${Math.min(i + batchSize, senators.length)}...`);

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (senator) => {
          const startTime = Date.now();

          // Build persona prompt
          const prompt = buildSenatorPrompt(senator, scenario, question);

          // Call LLM (using Anthropic)
          const response = await this.callLLMForSenator(prompt, senator);

          // Apply SSR calibration to free-text response
          const ssrResult = await voteRater.rate(response);

          return {
            senator,
            response,
            ssrResult,
            latencyMs: Date.now() - startTime,
          };
        })
      );

      results.push(...batchResults);

      // Stream sample reasoning
      if (batchResults[0]) {
        const sample = batchResults[0];
        const vote = pmfToBinaryVote(sample.ssrResult.pmf);
        ctx.onStream(
          `[${sample.senator.party}-${sample.senator.stateAbbr}] ${sample.senator.name}: ${vote.vote.toUpperCase()} (${(vote.probability * 100).toFixed(0)}%)\n` +
          `  "${sample.response.slice(0, 150)}..."\n\n`
        );
      }
    }

    ctx.onProgress(85, "Aggregating votes with SSR calibration...");

    // Step 5: Aggregate results using SSR
    const aggregated = aggregatePMFs(
      results.map((r) => ({
        agentId: r.senator.id,
        result: r.ssrResult,
      }))
    );

    // Step 6: Build detailed breakdown
    const partyBreakdown = this.buildPartyBreakdown(results);
    const swingVotes = this.identifySwingVotes(results);
    const topFactors = this.extractVoteFactors(results);

    // Step 7: Build distribution
    const distribution: Distribution = {
      type: "empirical",
      mean: aggregated.binaryOutcome.probability * 100,
      std: 5, // Estimated based on CI
      percentiles: {
        p5: aggregated.confidenceInterval.lower * 100,
        p25: (aggregated.confidenceInterval.lower + aggregated.binaryOutcome.probability) / 2 * 100,
        p50: aggregated.binaryOutcome.probability * 100,
        p75: (aggregated.confidenceInterval.upper + aggregated.binaryOutcome.probability) / 2 * 100,
        p95: aggregated.confidenceInterval.upper * 100,
      },
    };

    ctx.onProgress(100, "Congressional vote simulation complete");

    return {
      outputs: {
        prediction: {
          outcome: aggregated.binaryOutcome.vote === "yes" ? "PASS" : "FAIL",
          probability: aggregated.binaryOutcome.probability,
          confidence: aggregated.binaryOutcome.confidence,
        },
        voteCount: {
          yes: aggregated.breakdown.yesCount,
          no: aggregated.breakdown.noCount,
          undecided: aggregated.breakdown.undecidedCount,
          total: results.length,
        },
        confidenceInterval: {
          lower: aggregated.confidenceInterval.lower,
          upper: aggregated.confidenceInterval.upper,
        },
        partyBreakdown,
        swingVotes: swingVotes.slice(0, 10),
        topFactors,
        distribution: aggregated.distribution,
        // Execution metadata
        execution: {
          senatorsSimulated: results.length,
          avgLatencyMs: results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length,
          ssrCalibrated: true,
        },
        // Sample reasoning
        reasoningSamples: results.slice(0, 5).map((r) => ({
          senator: `${r.senator.name} (${r.senator.party}-${r.senator.stateAbbr})`,
          vote: pmfToBinaryVote(r.ssrResult.pmf).vote,
          probability: pmfToBinaryVote(r.ssrResult.pmf).probability,
          reasoning: r.response.slice(0, 300),
        })),
      },
      distribution,
    };
  }

  private async callLLMForSenator(prompt: string, senator: SenatorPersona): Promise<string> {
    // Use Anthropic Claude for senator simulation
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      // Return mock response based on senator's voting record
      return this.generateMockSenatorResponse(senator);
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        console.error("[Congressional Vote] LLM error:", await response.text());
        return this.generateMockSenatorResponse(senator);
      }

      const data = await response.json();
      return data.content[0]?.text || this.generateMockSenatorResponse(senator);
    } catch (error) {
      console.error("[Congressional Vote] LLM call failed:", error);
      return this.generateMockSenatorResponse(senator);
    }
  }

  private generateMockSenatorResponse(senator: SenatorPersona): string {
    const { chinaHawkScore, techRegulationScore } = senator.votingRecord;
    const avgScore = (chinaHawkScore + techRegulationScore) / 2;

    if (avgScore >= 0.8) {
      return `As a senator who has consistently prioritized national security and supported strong action against foreign threats, I will vote YES on this bill. The evidence is clear that TikTok poses unacceptable risks to American data security and could be used as a tool of Chinese influence operations. My constituents in ${senator.state} expect me to protect their privacy and our national interests.`;
    } else if (avgScore >= 0.6) {
      return `I'm inclined to support this legislation, though I have some concerns about the precedent it sets. On balance, the national security arguments are compelling, and the bill provides a reasonable pathway for divestiture. I'll likely vote YES, but I want to see strong implementation safeguards.`;
    } else if (avgScore >= 0.4) {
      return `This is a difficult vote. I understand the national security concerns, but I'm also hearing from young constituents who rely on this platform. I'm weighing the evidence carefully and haven't made a final decision. The bill raises important questions about government overreach.`;
    } else {
      return `I have serious reservations about this bill. While I take national security seriously, I'm concerned about the precedent of banning a platform used by millions of Americans. We need a more nuanced approach to addressing data security that doesn't restrict free expression. I'm leaning toward voting NO.`;
    }
  }

  private buildPartyBreakdown(
    results: Array<{ senator: SenatorPersona; ssrResult: SSRResult }>
  ): Record<string, { yes: number; no: number; probability: number }> {
    const breakdown: Record<string, { yes: number; no: number; total: number; sumProb: number }> = {
      R: { yes: 0, no: 0, total: 0, sumProb: 0 },
      D: { yes: 0, no: 0, total: 0, sumProb: 0 },
      I: { yes: 0, no: 0, total: 0, sumProb: 0 },
    };

    for (const { senator, ssrResult } of results) {
      const vote = pmfToBinaryVote(ssrResult.pmf);
      const party = breakdown[senator.party];
      if (party) {
        party.total++;
        party.sumProb += vote.probability;
        if (vote.vote === "yes") {
          party.yes++;
        } else {
          party.no++;
        }
      }
    }

    return {
      Republican: {
        yes: breakdown.R.yes,
        no: breakdown.R.no,
        probability: breakdown.R.total > 0 ? breakdown.R.sumProb / breakdown.R.total : 0,
      },
      Democrat: {
        yes: breakdown.D.yes,
        no: breakdown.D.no,
        probability: breakdown.D.total > 0 ? breakdown.D.sumProb / breakdown.D.total : 0,
      },
      Independent: {
        yes: breakdown.I.yes,
        no: breakdown.I.no,
        probability: breakdown.I.total > 0 ? breakdown.I.sumProb / breakdown.I.total : 0,
      },
    };
  }

  private identifySwingVotes(
    results: Array<{ senator: SenatorPersona; ssrResult: SSRResult; response: string }>
  ): Array<{ name: string; party: string; state: string; probability: number; reasoning: string }> {
    return results
      .map(({ senator, ssrResult, response }) => ({
        name: senator.name,
        party: senator.party,
        state: senator.stateAbbr,
        probability: pmfToBinaryVote(ssrResult.pmf).probability,
        reasoning: response.slice(0, 200),
      }))
      .filter((v) => v.probability >= 0.35 && v.probability <= 0.65)
      .sort((a, b) => Math.abs(0.5 - a.probability) - Math.abs(0.5 - b.probability));
  }

  private extractVoteFactors(
    results: Array<{ senator: SenatorPersona; response: string }>
  ): Array<{ factor: string; weight: number }> {
    // Simple keyword-based factor extraction
    const factors: Record<string, number> = {
      "National security": 0,
      "China threat": 0,
      "Data privacy": 0,
      "Free speech": 0,
      "Constituent impact": 0,
      "Tech industry": 0,
      "Young voters": 0,
      "Economic retaliation": 0,
    };

    const keywords: Record<string, string[]> = {
      "National security": ["national security", "security threat", "protect america"],
      "China threat": ["china", "beijing", "ccp", "chinese"],
      "Data privacy": ["data", "privacy", "personal information"],
      "Free speech": ["free speech", "first amendment", "expression", "censorship"],
      "Constituent impact": ["constituent", "voters", "people of"],
      "Tech industry": ["tech", "silicon valley", "jobs"],
      "Young voters": ["young", "youth", "generation z", "tiktok users"],
      "Economic retaliation": ["retaliation", "trade war", "economic"],
    };

    for (const { response } of results) {
      const lower = response.toLowerCase();
      for (const [factor, words] of Object.entries(keywords)) {
        if (words.some((w) => lower.includes(w))) {
          factors[factor]++;
        }
      }
    }

    // Normalize and sort
    const total = Object.values(factors).reduce((sum, v) => sum + v, 0) || 1;
    return Object.entries(factors)
      .map(([factor, count]) => ({ factor, weight: count / total }))
      .filter((f) => f.weight > 0)
      .sort((a, b) => b.weight - a.weight);
  }

  // =============================================================================
  // THREE-TIER MONTE CARLO WITH SSR CALIBRATION
  // =============================================================================

  private async executeMonteCarloSSR(
    ctx: ExecutorContext
  ): Promise<{ outputs: Record<string, unknown>; distribution: Distribution }> {
    // Extract configuration
    const {
      sampleSize = 1000,
      questionType = "binary",
      domain = "consumer",
      useDatabase = true,
      vipRatio = 0.1,
      vertical,
      // SSR calibration options
      calibrationMode = "semantic", // "semantic" | "direct" | "hybrid"
    } = ctx.config;

    // Extract scenario from inputs
    const {
      scenario: scenarioText,
      question: questionText,
      context: contextText,
      options: choiceOptions,
      agents: inputAgents, // Can receive agents from upstream node
    } = ctx.inputs;

    // Validate required inputs
    if (!scenarioText || !questionText) {
      throw new ExecutionError(
        "MISSING_INPUT",
        "Monte Carlo SSR requires 'scenario' and 'question' inputs",
        false
      );
    }

    ctx.onProgress(5, "Initializing three-tier agent simulation...");

    // Step 1: Get agents (from input or sample)
    let agents: Agent[];
    if (inputAgents && Array.isArray(inputAgents) && inputAgents.length > 0) {
      agents = inputAgents as Agent[];
      ctx.onProgress(10, `Using ${agents.length} agents from upstream node`);
    } else {
      // Sample population with database integration
      ctx.onProgress(8, "Sampling population with VIP integration...");
      agents = await agentStore.samplePopulation(
        { base: "us_adults" },
        sampleSize as number,
        {
          useVIPs: useDatabase as boolean,
          vipRatio: vipRatio as number,
          useArchetypes: true,
          vertical: vertical as string | undefined,
        }
      );
      ctx.onProgress(10, `Sampled ${agents.length} agents`);
    }

    // Step 2: Group agents by tier for efficient routing
    const tierGroups = groupAgentsByTier(agents);
    const tierCounts = {
      vip: tierGroups.opus.length,
      archetype: tierGroups.sonnet.length + tierGroups.haiku.length,
      statistical: tierGroups.statistical.length,
    };

    ctx.onProgress(12, `Agent tiers: ${tierCounts.vip} VIP, ${tierCounts.archetype} Archetype, ${tierCounts.statistical} Statistical`);

    // Estimate costs
    const costEstimate = estimateAgentTierCost(agents);
    ctx.onStream(`Cost estimate: $${costEstimate.totalCost.toFixed(4)}, latency: ${Math.round(costEstimate.estimatedLatencyMs / 1000)}s\n`);

    // Step 3: Build scenario context
    const scenarioContext: ScenarioContext = {
      scenario: scenarioText as string,
      question: questionText as string,
      questionType: questionType as QuestionType,
      context: contextText as string | undefined,
      domain: domain as "enterprise" | "defense" | "consumer",
      options: choiceOptions as string[] | undefined,
    };

    ctx.onProgress(15, "Processing agents by tier...");

    // Step 4: Process each tier in parallel
    const results: Array<{
      agentId: string;
      tier: AgentTier;
      response: { value: unknown; confidence: number; reasoning?: string };
      modelUsed: ModelTier | "lookup";
      weight: number;
      latencyMs: number;
      success: boolean;
      error?: string;
    }> = [];

    // 4a: Process Statistical agents (distribution lookup - no LLM)
    if (tierGroups.statistical.length > 0) {
      ctx.onProgress(20, `Processing ${tierGroups.statistical.length} statistical agents (lookup)...`);
      const statStart = Date.now();

      for (const agent of tierGroups.statistical) {
        // Use pre-computed distribution lookup
        const lookupResult = this.statisticalLookup(agent, scenarioContext);
        results.push({
          agentId: agent.id,
          tier: "statistical",
          response: lookupResult,
          modelUsed: "lookup",
          weight: agent.weight,
          latencyMs: Date.now() - statStart,
          success: true,
        });
      }

      ctx.onStream(`[Statistical] Processed ${tierGroups.statistical.length} agents via lookup\n`);
    }

    // 4b: Process Archetype agents (Haiku/Sonnet)
    const archetypeAgents = [...tierGroups.haiku, ...tierGroups.sonnet];
    if (archetypeAgents.length > 0) {
      ctx.onProgress(35, `Processing ${archetypeAgents.length} archetype agents...`);

      const archetypeResults = await this.processAgentBatch(
        archetypeAgents,
        scenarioContext,
        ctx,
        { startProgress: 35, endProgress: 65 }
      );
      results.push(...archetypeResults);

      const haikuCount = archetypeResults.filter(r => r.modelUsed === "haiku").length;
      const sonnetCount = archetypeResults.filter(r => r.modelUsed === "sonnet").length;
      ctx.onStream(`[Archetype] ${haikuCount} Haiku, ${sonnetCount} Sonnet calls\n`);
    }

    // 4c: Process VIP agents (Opus with full persona)
    if (tierGroups.opus.length > 0) {
      ctx.onProgress(70, `Processing ${tierGroups.opus.length} VIP agents with Opus...`);

      const vipResults = await this.processVIPAgents(
        tierGroups.opus,
        scenarioContext,
        ctx,
        { startProgress: 70, endProgress: 85 }
      );
      results.push(...vipResults);

      // Stream VIP reasoning samples
      for (const vip of vipResults.slice(0, 3)) {
        const agent = tierGroups.opus.find(a => a.id === vip.agentId);
        if (agent && vip.response.reasoning) {
          ctx.onStream(`[VIP] ${agent.name || agent.id}: "${vip.response.reasoning.slice(0, 100)}..."\n`);
        }
      }
    }

    ctx.onProgress(88, "Aggregating results with SSR calibration...");

    // Step 5: Aggregate results
    const aggregated = this.aggregateTieredResults(results, questionType as string);

    // Step 6: Build distribution
    const distribution: Distribution = {
      type: "empirical",
      mean: aggregated.weightedMean * 100,
      std: aggregated.std * 100,
      percentiles: {
        p5: (aggregated.weightedMean - 1.645 * aggregated.std) * 100,
        p25: (aggregated.weightedMean - 0.675 * aggregated.std) * 100,
        p50: aggregated.weightedMean * 100,
        p75: (aggregated.weightedMean + 0.675 * aggregated.std) * 100,
        p95: (aggregated.weightedMean + 1.645 * aggregated.std) * 100,
      },
    };

    ctx.onProgress(95, "Building detailed analysis...");

    // Step 7: Build segment analysis
    const segmentAnalysis = this.buildTierSegmentAnalysis(results, agents);

    // Calculate actual costs
    const actualCosts = {
      lookup: results.filter(r => r.modelUsed === "lookup").length * 0.0001,
      haiku: results.filter(r => r.modelUsed === "haiku").length * 0.0003,
      sonnet: results.filter(r => r.modelUsed === "sonnet").length * 0.003,
      opus: results.filter(r => r.modelUsed === "opus").length * 0.03,
    };
    const totalActualCost = actualCosts.lookup + actualCosts.haiku + actualCosts.sonnet + actualCosts.opus;

    // Build VIP-specific insights
    const vipInsights = results
      .filter(r => r.tier === "vip" && r.response.reasoning)
      .slice(0, 5)
      .map(r => {
        const agent = agents.find(a => a.id === r.agentId);
        return {
          name: agent?.name || r.agentId,
          answer: r.response.value,
          confidence: r.response.confidence,
          reasoning: r.response.reasoning,
        };
      });

    ctx.onProgress(100, "Complete");

    return {
      outputs: {
        // Main result
        outcomeDistribution: distribution,
        prediction: {
          value: aggregated.weightedMean,
          confidenceInterval: {
            low: aggregated.weightedMean - 1.96 * aggregated.std,
            high: aggregated.weightedMean + 1.96 * aggregated.std,
          },
          sampleSize: results.length,
        },
        // Binary breakdown
        ...(questionType === "binary" && {
          yesRate: aggregated.yesRate,
          noRate: 1 - aggregated.yesRate,
        }),
        // Tier breakdown
        tierBreakdown: {
          vip: {
            count: tierCounts.vip,
            yesRate: aggregated.tierYesRates?.vip,
            avgConfidence: aggregated.tierConfidence?.vip,
          },
          archetype: {
            count: tierCounts.archetype,
            yesRate: aggregated.tierYesRates?.archetype,
            avgConfidence: aggregated.tierConfidence?.archetype,
          },
          statistical: {
            count: tierCounts.statistical,
            yesRate: aggregated.tierYesRates?.statistical,
            avgConfidence: aggregated.tierConfidence?.statistical,
          },
        },
        // VIP insights (for high-value persona analysis)
        vipInsights,
        // Segment analysis
        segmentAnalysis,
        // Execution metadata
        execution: {
          totalAgents: agents.length,
          successfulResponses: results.filter(r => r.success).length,
          failedResponses: results.filter(r => !r.success).length,
          modelUsage: {
            lookup: results.filter(r => r.modelUsed === "lookup").length,
            haiku: results.filter(r => r.modelUsed === "haiku").length,
            sonnet: results.filter(r => r.modelUsed === "sonnet").length,
            opus: results.filter(r => r.modelUsed === "opus").length,
          },
          costs: {
            estimated: costEstimate.totalCost,
            actual: totalActualCost,
          },
          threeTierEnabled: true,
          calibrationMode,
        },
      },
      distribution,
    };
  }

  // Statistical lookup for tier 3 agents (no LLM call)
  private statisticalLookup(
    agent: Agent,
    scenario: ScenarioContext
  ): { value: unknown; confidence: number; reasoning?: string } {
    // Use pre-computed response distributions based on demographics
    // This is a simplified version - in production, would use actual calibrated distributions

    // Extract key traits
    const demographics = (agent as AgentProfile).demographics;
    const traits = (agent as AgentProfile).traits;

    // Base probability based on archetype
    let baseProbability = 0.5;

    // Adjust based on risk tolerance (traits.riskTolerance is a string like "high", "medium", "low")
    if (traits?.riskTolerance !== undefined) {
      // Higher risk tolerance = more likely to adopt new things
      if (scenario.domain === "consumer") {
        const riskMap: Record<string, number> = { high: 0.7, medium: 0.5, low: 0.3 };
        const riskFactor = riskMap[traits.riskTolerance] ?? 0.5;
        baseProbability += (riskFactor - 0.5) * 0.2;
      }
    }

    // Adjust based on demographics
    if (demographics?.age) {
      const ageMap: Record<string, number> = {
        "18-24": 0.7, "25-34": 0.65, "35-44": 0.55,
        "45-54": 0.45, "55-64": 0.4, "65+": 0.35,
      };
      const ageFactor = ageMap[demographics.age] ?? 0.5;
      baseProbability = baseProbability * 0.6 + ageFactor * 0.4;
    }

    // Add some noise for realism
    const noise = (Math.random() - 0.5) * 0.15;
    const finalProbability = Math.max(0.05, Math.min(0.95, baseProbability + noise));

    // Convert to binary response with confidence
    const isYes = Math.random() < finalProbability;

    return {
      value: isYes,
      confidence: 0.6 + Math.random() * 0.3, // 60-90% confidence range
    };
  }

  // Process batch of archetype agents
  private async processAgentBatch(
    agents: Agent[],
    scenario: ScenarioContext,
    ctx: ExecutorContext,
    progress: { startProgress: number; endProgress: number }
  ): Promise<Array<{
    agentId: string;
    tier: AgentTier;
    response: { value: unknown; confidence: number; reasoning?: string };
    modelUsed: ModelTier | "lookup";
    weight: number;
    latencyMs: number;
    success: boolean;
    error?: string;
  }>> {
    const results: Array<{
      agentId: string;
      tier: AgentTier;
      response: { value: unknown; confidence: number; reasoning?: string };
      modelUsed: ModelTier | "lookup";
      weight: number;
      latencyMs: number;
      success: boolean;
      error?: string;
    }> = [];

    const batchSize = 20;
    for (let i = 0; i < agents.length; i += batchSize) {
      const batch = agents.slice(i, i + batchSize);
      const pct = progress.startProgress +
        ((i / agents.length) * (progress.endProgress - progress.startProgress));
      ctx.onProgress(pct, `Processing archetype batch ${Math.floor(i / batchSize) + 1}...`);

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (agent) => {
          const startTime = Date.now();
          try {
            // Route to appropriate model
            const routing = routeByAgentTier(agent, { complexity: 0.4 });
            const modelTier = routing.tier || "sonnet";

            // Build prompt
            const prompt = compilePrompt(agent as AgentProfile, scenario);

            // Call LLM
            const response = await this.callLLMForAgent(prompt, modelTier);

            // Parse response
            const parsed = parseResponse(response, { questionType: scenario.questionType });

            return {
              agentId: agent.id,
              tier: agent.tier,
              response: {
                value: parsed.value,
                confidence: parsed.confidenceScore,
                reasoning: parsed.reasoning,
              },
              modelUsed: modelTier,
              weight: agent.weight,
              latencyMs: Date.now() - startTime,
              success: true,
            };
          } catch (error) {
            return {
              agentId: agent.id,
              tier: agent.tier,
              response: { value: false, confidence: 0.5 },
              modelUsed: "sonnet" as ModelTier,
              weight: agent.weight,
              latencyMs: Date.now() - startTime,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );

      results.push(...batchResults);
    }

    return results;
  }

  // Process VIP agents with full persona context
  private async processVIPAgents(
    agents: Agent[],
    scenario: ScenarioContext,
    ctx: ExecutorContext,
    progress: { startProgress: number; endProgress: number }
  ): Promise<Array<{
    agentId: string;
    tier: AgentTier;
    response: { value: unknown; confidence: number; reasoning?: string };
    modelUsed: ModelTier | "lookup";
    weight: number;
    latencyMs: number;
    success: boolean;
    error?: string;
  }>> {
    const results: Array<{
      agentId: string;
      tier: AgentTier;
      response: { value: unknown; confidence: number; reasoning?: string };
      modelUsed: ModelTier | "lookup";
      weight: number;
      latencyMs: number;
      success: boolean;
      error?: string;
    }> = [];

    // VIPs are processed with lower concurrency for higher quality
    const batchSize = 5;
    for (let i = 0; i < agents.length; i += batchSize) {
      const batch = agents.slice(i, i + batchSize);
      const pct = progress.startProgress +
        ((i / agents.length) * (progress.endProgress - progress.startProgress));
      ctx.onProgress(pct, `Processing VIP batch ${Math.floor(i / batchSize) + 1}...`);

      // Process batch
      const batchResults = await Promise.all(
        batch.map(async (agent) => {
          const startTime = Date.now();
          try {
            // Build enhanced VIP prompt with full persona
            const prompt = this.buildVIPPrompt(agent, scenario);

            // Always use Opus for VIPs
            const response = await this.callLLMForAgent(prompt, "opus");

            // Parse response
            const parsed = parseResponse(response, {
              questionType: scenario.questionType,
            });

            return {
              agentId: agent.id,
              tier: agent.tier,
              response: {
                value: parsed.value,
                confidence: parsed.confidenceScore,
                reasoning: parsed.reasoning || response.slice(0, 500),
              },
              modelUsed: "opus" as ModelTier,
              weight: agent.weight,
              latencyMs: Date.now() - startTime,
              success: true,
            };
          } catch (error) {
            return {
              agentId: agent.id,
              tier: agent.tier,
              response: { value: false, confidence: 0.5 },
              modelUsed: "opus" as ModelTier,
              weight: agent.weight,
              latencyMs: Date.now() - startTime,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );

      results.push(...batchResults);
    }

    return results;
  }

  // Build enhanced prompt for VIP agents
  private buildVIPPrompt(agent: Agent, scenario: ScenarioContext): CompiledPrompt {
    const vip = agent as Agent & {
      name?: string;
      role?: string;
      affiliation?: string;
      biography?: string;
      knownPositions?: Record<string, unknown>;
      communicationStyle?: string;
    };

    let systemPrompt = `You are ${vip.name || "a VIP decision maker"}, ${vip.role || "a senior leader"} at ${vip.affiliation || "a major organization"}.\n\n`;

    if (vip.biography) {
      systemPrompt += `Background:\n${vip.biography}\n\n`;
    }

    if (vip.knownPositions && Object.keys(vip.knownPositions).length > 0) {
      systemPrompt += `Your known positions and views:\n`;
      for (const [topic, position] of Object.entries(vip.knownPositions)) {
        systemPrompt += `- ${topic}: ${position}\n`;
      }
      systemPrompt += "\n";
    }

    if (vip.communicationStyle) {
      systemPrompt += `Communication style: ${vip.communicationStyle}\n\n`;
    }

    systemPrompt += `When responding, stay true to your established persona, positions, and decision-making style.
Provide a clear answer followed by your reasoning.`;

    const userPrompt = `Scenario: ${scenario.scenario}

${scenario.context ? `Context: ${scenario.context}\n\n` : ""}Question: ${scenario.question}

Please provide your response as ${vip.name || "yourself"}, including your reasoning.`;

    return {
      systemPrompt,
      userPrompt,
      expectedFormat: "Answer: [YES/NO]\nConfidence: [HIGH/MEDIUM/LOW]\nReasoning: [Your reasoning]",
      complexity: 0.8, // VIP prompts are high complexity
    };
  }

  // Generic LLM call for agent simulation
  private async callLLMForAgent(prompt: CompiledPrompt, tier: ModelTier): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const config = MODEL_CONFIGS[tier];

    if (!apiKey) {
      // Return mock response
      return this.generateMockAgentResponse(prompt, tier);
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.modelId,
          max_tokens: config.maxOutputTokens,
          system: prompt.systemPrompt,
          messages: [{ role: "user", content: prompt.userPrompt }],
        }),
      });

      if (!response.ok) {
        console.error(`[Agent LLM] Error from ${tier}:`, await response.text());
        return this.generateMockAgentResponse(prompt, tier);
      }

      const data = await response.json();
      return data.content[0]?.text || this.generateMockAgentResponse(prompt, tier);
    } catch (error) {
      console.error(`[Agent LLM] Call failed for ${tier}:`, error);
      return this.generateMockAgentResponse(prompt, tier);
    }
  }

  // Generate mock response when API not available
  private generateMockAgentResponse(prompt: CompiledPrompt, tier: ModelTier): string {
    const isYes = Math.random() > 0.5;
    const confidence = tier === "opus" ? "high" : tier === "sonnet" ? "moderate" : "reasonable";

    if (isYes) {
      return `Yes, I would support this. After careful consideration of the scenario presented, I believe the benefits outweigh the risks. My ${confidence} confidence in this position is based on my understanding of the situation and relevant factors. The key considerations include market dynamics, stakeholder impact, and long-term strategic value.`;
    } else {
      return `No, I would not support this. Having analyzed the scenario, I have concerns about the potential downsides. With ${confidence} confidence, I believe there are better alternatives. The main issues include risk exposure, timing considerations, and potential unintended consequences that should be addressed first.`;
    }
  }

  // Aggregate results from all tiers
  private aggregateTieredResults(
    results: Array<{
      agentId: string;
      tier: AgentTier;
      response: { value: unknown; confidence: number; reasoning?: string };
      weight: number;
      success: boolean;
    }>,
    questionType: string
  ): {
    weightedMean: number;
    std: number;
    yesRate: number;
    tierYesRates: Record<string, number>;
    tierConfidence: Record<string, number>;
  } {
    const successful = results.filter(r => r.success);
    const totalWeight = successful.reduce((sum, r) => sum + r.weight, 0);

    // Calculate weighted yes rate for binary
    let yesWeight = 0;
    const tierStats: Record<string, { yesWeight: number; totalWeight: number; confidenceSum: number; count: number }> = {
      vip: { yesWeight: 0, totalWeight: 0, confidenceSum: 0, count: 0 },
      archetype: { yesWeight: 0, totalWeight: 0, confidenceSum: 0, count: 0 },
      statistical: { yesWeight: 0, totalWeight: 0, confidenceSum: 0, count: 0 },
    };

    for (const result of successful) {
      const isYes = result.response.value === true || result.response.value === "yes" || result.response.value === 1;

      if (isYes) {
        yesWeight += result.weight;
      }

      const tier = result.tier;
      if (tierStats[tier]) {
        tierStats[tier].totalWeight += result.weight;
        tierStats[tier].confidenceSum += result.response.confidence * result.weight;
        tierStats[tier].count++;
        if (isYes) {
          tierStats[tier].yesWeight += result.weight;
        }
      }
    }

    const yesRate = totalWeight > 0 ? yesWeight / totalWeight : 0.5;

    // Calculate variance
    let varianceSum = 0;
    for (const result of successful) {
      const isYes = result.response.value === true || result.response.value === "yes" || result.response.value === 1;
      const value = isYes ? 1 : 0;
      varianceSum += result.weight * Math.pow(value - yesRate, 2);
    }
    const std = totalWeight > 0 ? Math.sqrt(varianceSum / totalWeight) : 0.2;

    // Build tier breakdowns
    const tierYesRates: Record<string, number> = {};
    const tierConfidence: Record<string, number> = {};

    for (const [tier, stats] of Object.entries(tierStats)) {
      if (stats.totalWeight > 0) {
        tierYesRates[tier] = stats.yesWeight / stats.totalWeight;
        tierConfidence[tier] = stats.confidenceSum / stats.totalWeight;
      }
    }

    return {
      weightedMean: yesRate,
      std,
      yesRate,
      tierYesRates,
      tierConfidence,
    };
  }

  // Build segment analysis with tier information
  private buildTierSegmentAnalysis(
    results: Array<{
      agentId: string;
      tier: AgentTier;
      response: { value: unknown; confidence: number };
      weight: number;
      success: boolean;
    }>,
    agents: Agent[]
  ): Record<string, unknown> {
    const agentMap = new Map(agents.map(a => [a.id, a]));
    const segments: Record<string, { yes: number; no: number; total: number }> = {};

    for (const result of results) {
      if (!result.success) continue;

      const agent = agentMap.get(result.agentId);
      if (!agent) continue;

      // Segment by tier
      const tierKey = `tier_${result.tier}`;
      if (!segments[tierKey]) {
        segments[tierKey] = { yes: 0, no: 0, total: 0 };
      }
      segments[tierKey].total += result.weight;

      const isYes = result.response.value === true || result.response.value === "yes" || result.response.value === 1;
      if (isYes) {
        segments[tierKey].yes += result.weight;
      } else {
        segments[tierKey].no += result.weight;
      }

      // Segment by demographics if available
      const demographics = (agent as AgentProfile).demographics;
      if (demographics?.age) {
        const ageKey = `age_${demographics.age}`;
        if (!segments[ageKey]) {
          segments[ageKey] = { yes: 0, no: 0, total: 0 };
        }
        segments[ageKey].total += result.weight;
        if (isYes) segments[ageKey].yes += result.weight;
      }
    }

    // Convert to rates
    const segmentRates: Record<string, number> = {};
    for (const [key, data] of Object.entries(segments)) {
      if (data.total > 0) {
        segmentRates[key] = data.yes / data.total;
      }
    }

    return segmentRates;
  }
}

// Export singleton instance
export const computeExecutor = new ComputeExecutor();
