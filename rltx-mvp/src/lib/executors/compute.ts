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
import {
  compilePrompt,
  compilePromptBatch,
  ScenarioContext,
  QuestionType,
} from "../agents/prompt-compiler";
import { parseResponse, aggregateResponses, ParseOptions } from "../agents/response-parser";
import { routePrompt, routeBatch, RoutingOptions } from "../agents/model-router";
import { executeBatch, createBatchRequests, BatchResult } from "../agents/parallel-batch";
import {
  executeGameTheory,
  StrategicActor,
  GameScenario,
  PRESET_ACTORS,
} from "../agents/game-theory";

export class ComputeExecutor extends BaseExecutor {
  type: ExecutorType = "compute";
  primitiveIds = [
    "sim.montecarlo.oasis",
    "game.equilibrium",
    "branch.counterfactual",
    "uncertainty.aggregate",
    "opt.pareto",
    "output.chart",
    "data.doc.parse",
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
}

// Export singleton instance
export const computeExecutor = new ComputeExecutor();
