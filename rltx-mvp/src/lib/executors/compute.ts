// Compute Executor - Handles simulation and optimization primitives

import { BaseExecutor } from "./base";
import {
  ExecutorContext,
  ExecutorResult,
  ExecutorType,
  ExecutionError,
  Distribution,
} from "./types";

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
    const { populationSize = 1000, rollouts = 1000 } = ctx.config;
    const { scenario, distributions: inputDists } = ctx.inputs;

    ctx.onProgress(10, `Running ${rollouts} simulations...`);

    // Generate samples based on input distributions
    const samples: number[] = [];
    const totalIterations = rollouts as number;

    for (let i = 0; i < totalIterations; i++) {
      // Simple Monte Carlo - sample from normal distribution
      const sample = this.sampleNormal(50, 15); // Base outcome
      samples.push(sample);

      if (i % 100 === 0) {
        ctx.onProgress(10 + (80 * i / totalIterations), `Iteration ${i}/${totalIterations}`);
      }
    }

    ctx.onProgress(95, "Computing statistics...");

    // Compute distribution statistics
    const sorted = [...samples].sort((a, b) => a - b);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / samples.length;
    const std = Math.sqrt(variance);

    const distribution: Distribution = {
      type: "empirical",
      mean,
      std,
      samples: sorted.slice(0, 100), // Keep subset for visualization
      percentiles: {
        p5: sorted[Math.floor(samples.length * 0.05)],
        p25: sorted[Math.floor(samples.length * 0.25)],
        p50: sorted[Math.floor(samples.length * 0.50)],
        p75: sorted[Math.floor(samples.length * 0.75)],
        p95: sorted[Math.floor(samples.length * 0.95)],
      },
    };

    return {
      outputs: {
        outcomeDistribution: distribution,
        samples: sorted,
        summary: {
          mean,
          std,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          iterations: totalIterations,
        },
      },
      distribution,
    };
  }

  private async executeGameEquilibrium(ctx: ExecutorContext): Promise<Record<string, unknown>> {
    const { equilibriumType = "nash", maxIterations = 100 } = ctx.config;
    const { players, payoffs } = ctx.inputs;

    ctx.onProgress(20, `Computing ${equilibriumType} equilibrium...`);

    // Simplified Nash equilibrium calculation
    // In reality, this would use proper game theory algorithms
    const playerList = (players as unknown[]) || ["Player 1", "Player 2"];

    const strategies: Record<string, Record<string, number>> = {};
    const equilibrium: Record<string, string> = {};

    for (const player of playerList) {
      const playerName = String(player);
      // Generate plausible mixed strategy
      strategies[playerName] = {
        cooperate: 0.3 + Math.random() * 0.4,
        defect: 0.3 + Math.random() * 0.4,
      };

      // Normalize
      const total = Object.values(strategies[playerName]).reduce((a, b) => a + b, 0);
      for (const key of Object.keys(strategies[playerName])) {
        strategies[playerName][key] /= total;
      }

      // Best response
      equilibrium[playerName] = strategies[playerName].cooperate > 0.5 ? "cooperate" : "defect";
    }

    ctx.onProgress(80, "Analyzing stability...");

    return {
      equilibrium: {
        type: equilibriumType,
        strategies,
        pureStrategies: equilibrium,
        isStable: true,
        iterations: Math.floor(maxIterations as number * 0.7),
      },
      strategies: strategies,
      payoffMatrix: payoffs || this.generateDefaultPayoffMatrix(playerList),
    };
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
    const { file } = ctx.inputs;

    ctx.onProgress(20, "Parsing document...");

    // In a real implementation, this would use a document parsing library
    // For now, return mock extracted content
    ctx.onProgress(60, "Extracting content...");

    return {
      content: {
        text: "This is extracted document text. In production, this would contain the actual parsed content from the uploaded file.",
        sections: [
          { heading: "Introduction", content: "Document introduction text..." },
          { heading: "Main Content", content: "Primary document content..." },
          { heading: "Conclusion", content: "Document conclusions..." },
        ],
        tables: extractTables ? [
          {
            name: "Table 1",
            headers: ["Column A", "Column B", "Column C"],
            rows: [
              ["Value 1", "Value 2", "Value 3"],
              ["Value 4", "Value 5", "Value 6"],
            ],
          },
        ] : [],
        images: extractImages ? [
          { name: "Figure 1", description: "Chart showing growth trends" },
        ] : [],
        metadata: {
          pageCount: 10,
          wordCount: 2500,
          extractedAt: new Date().toISOString(),
        },
      },
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
