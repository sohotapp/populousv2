import type { Distribution, DistributionStats } from "../types/index.js";

interface ExecutorCallbacks {
  onProgress?: (progress: number, message?: string) => void;
}

// Modal endpoint configuration
const MODAL_BASE_URL = process.env.MODAL_ENDPOINT_URL || "";
const USE_MODAL = process.env.USE_MODAL === "true" && MODAL_BASE_URL;

/**
 * Compute Executor - Handles simulation and compute-heavy primitives
 * Calls Modal.com serverless functions for actual compute
 */
export class ComputeExecutor {
  async execute(
    primitiveId: string,
    config: Record<string, unknown>,
    inputs: Record<string, unknown>,
    callbacks: ExecutorCallbacks = {}
  ): Promise<unknown> {
    const { onProgress } = callbacks;

    switch (primitiveId) {
      case "sim.montecarlo.oasis":
        return this.executeMonteCarloOasis(config, inputs, onProgress);

      case "game.equilibrium":
        return this.executeGameEquilibrium(config, inputs, onProgress);

      case "branch.counterfactual":
        return this.executeCounterfactual(config, inputs, onProgress);

      case "uncertainty.aggregate":
        return this.executeUncertaintyAggregate(config, inputs, onProgress);

      default:
        throw new Error(`Unknown compute primitive: ${primitiveId}`);
    }
  }

  /**
   * Monte Carlo simulation with OASIS agents
   * Calls Modal.com serverless function in production
   */
  private async executeMonteCarloOasis(
    config: Record<string, unknown>,
    inputs: Record<string, unknown>,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<unknown> {
    const populationSize = (config.populationSize as number) || 1000;
    const rollouts = (config.rollouts as number) || 1000;
    const domain = (config.domain as string) || "enterprise";
    const llmAgentRatio = (config.llmAgentRatio as number) || 0.1;

    onProgress?.(5, `Initializing ${domain} simulation...`);

    // Try to call Modal if configured
    if (USE_MODAL) {
      try {
        onProgress?.(10, "Connecting to Modal compute...");

        const response = await fetch(`${MODAL_BASE_URL}/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "monte_carlo",
            config: {
              simulation_id: `sim-${Date.now()}`,
              population_size: populationSize,
              llm_ratio: llmAgentRatio,
              num_iterations: rollouts,
              domain,
            },
            scenario_template: inputs.scenario || inputs,
            available_actions: inputs.actions || ["buy", "wait", "switch", "churn"],
            outcome_metrics: inputs.metrics || ["adoption_rate", "revenue"],
          }),
        });

        if (!response.ok) {
          throw new Error(`Modal returned ${response.status}`);
        }

        const result = await response.json();

        // If async job, poll for completion
        if (result.status === "started" && result.job_id) {
          return await this.pollModalJob(result.job_id, onProgress);
        }

        onProgress?.(100, "Simulation complete");
        return this.transformModalResult(result);
      } catch (error) {
        console.warn("Modal call failed, falling back to mock:", error);
        // Fall through to mock implementation
      }
    }

    // Mock implementation for development/demo
    onProgress?.(10, "Running local simulation...");

    const progressSteps = [25, 50, 75, 90, 100];
    for (const step of progressSteps) {
      await this.sleep(500);
      onProgress?.(step, `Running simulation... ${step}%`);
    }

    // Generate mock distribution
    const samples = this.generateMockSamples(rollouts, domain);
    const stats = this.calculateStats(samples);

    const outcomeDistribution: Distribution = {
      type: "empirical",
      parameters: { n: rollouts },
      samples,
      stats,
    };

    return {
      outcomeDistribution,
      samples,
      metadata: {
        populationSize,
        rollouts,
        domain,
        llmAgentRatio,
        convergenceScore: 0.95,
        computeTimeMs: progressSteps.length * 500,
      },
      _mock: true,
    };
  }

  /**
   * Poll Modal job for completion
   */
  private async pollModalJob(
    jobId: string,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<unknown> {
    const maxAttempts = 120; // 10 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      const response = await fetch(`${MODAL_BASE_URL}/job_status?job_id=${jobId}`);
      const status = await response.json();

      if (status.status === "complete") {
        onProgress?.(100, "Simulation complete");
        return this.transformModalResult(status.results);
      }

      if (status.status === "error") {
        throw new Error(status.message || "Modal job failed");
      }

      // Update progress based on poll count
      const progress = Math.min(90, 20 + (attempts / maxAttempts) * 70);
      onProgress?.(progress, "Running simulation on Modal...");

      await this.sleep(5000); // Poll every 5 seconds
      attempts++;
    }

    throw new Error("Modal job timed out");
  }

  /**
   * Transform Modal result to expected format
   */
  private transformModalResult(result: Record<string, unknown>): unknown {
    // Handle OASIS format results
    if (result.outcomes && typeof result.outcomes === "object") {
      const outcomes = result.outcomes as Record<string, unknown>;
      const firstMetric = Object.keys(outcomes)[0];
      const firstOutcome = outcomes[firstMetric] as Record<string, unknown>;

      if (firstOutcome) {
        return {
          outcomeDistribution: {
            type: firstOutcome.type || "empirical",
            parameters: firstOutcome.parameters || {},
            samples: firstOutcome.samples || [],
            stats: {
              mean: firstOutcome.mean,
              std: firstOutcome.std,
              p5: firstOutcome.p5,
              p25: firstOutcome.p25,
              p50: firstOutcome.p50,
              p75: firstOutcome.p75,
              p95: firstOutcome.p95,
            },
          },
          samples: firstOutcome.samples || [],
          metadata: {
            ...result.config,
            computeTimeSeconds: result.compute_time_seconds,
            totalLlmCalls: result.total_llm_calls,
            totalRuleEvaluations: result.total_rule_evaluations,
          },
          decisionBreakdown: result.decision_breakdown,
          timeline: result.timeline,
        };
      }
    }

    return result;
  }

  /**
   * Game theory equilibrium finder
   */
  private async executeGameEquilibrium(
    config: Record<string, unknown>,
    inputs: Record<string, unknown>,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<unknown> {
    const equilibriumType = (config.equilibriumType as string) || "nash";
    const maxIterations = (config.maxIterations as number) || 100;
    const useAgentNegotiation = config.useAgentNegotiation !== false;

    onProgress?.(10, `Finding ${equilibriumType} equilibrium...`);

    // Try Modal if configured
    if (USE_MODAL) {
      try {
        const response = await fetch(`${MODAL_BASE_URL}/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "game_theory",
            players: inputs.players || [
              { id: "player1", name: "Company", profile: {} },
              { id: "player2", name: "Competitor", profile: {} },
            ],
            payoff_structure: inputs.payoffs || {
              actions: ["cooperate", "defect"],
            },
            num_rounds: maxIterations,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.status === "started" && result.job_id) {
            return await this.pollModalJob(result.job_id, onProgress);
          }
          onProgress?.(100, "Equilibrium found");
          return result;
        }
      } catch (error) {
        console.warn("Modal game theory failed, using mock:", error);
      }
    }

    // Mock implementation
    for (let i = 0; i < 5; i++) {
      await this.sleep(300);
      onProgress?.(20 + i * 15, `Iteration ${(i + 1) * 20}/${maxIterations}...`);
    }

    const players = (inputs.players as unknown[]) || [
      { id: "player1", name: "Company" },
      { id: "player2", name: "Competitor" },
    ];

    const strategies: Record<string, Record<string, number>> = {};
    for (const player of players) {
      const p = player as { id: string };
      strategies[p.id] = {
        aggressive: 0.3,
        moderate: 0.5,
        passive: 0.2,
      };
    }

    onProgress?.(100, "Equilibrium found");

    return {
      equilibrium: {
        type: equilibriumType,
        isStable: true,
        iterations: 45,
      },
      strategies,
      payoffs: {
        player1: 0.65,
        player2: 0.45,
      },
      metadata: {
        useAgentNegotiation,
        converged: true,
      },
      _mock: true,
    };
  }

  /**
   * Counterfactual branching
   */
  private async executeCounterfactual(
    config: Record<string, unknown>,
    inputs: Record<string, unknown>,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<unknown> {
    const branchesConfig = config.branches as string || "[]";
    let branches: unknown[];

    try {
      branches = JSON.parse(branchesConfig);
    } catch {
      branches = [
        { name: "Best Case", modifications: { growth: 1.3 }, probability: 0.2 },
        { name: "Base Case", modifications: {}, probability: 0.6 },
        { name: "Worst Case", modifications: { growth: 0.7 }, probability: 0.2 },
      ];
    }

    onProgress?.(10, `Running ${branches.length} counterfactual branches...`);

    // Try Modal if configured
    if (USE_MODAL) {
      try {
        const response = await fetch(`${MODAL_BASE_URL}/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "counterfactual",
            base_scenario: inputs.baseScenario || inputs,
            branches: branches,
            simulation_config: {
              population_size: 500,
              llm_ratio: 0.1,
              num_iterations: 50,
              domain: config.domain || "enterprise",
            },
            available_actions: ["buy", "wait", "switch", "churn"],
            outcome_metrics: ["adoption_rate", "revenue"],
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.status === "started" && result.job_id) {
            return await this.pollModalJob(result.job_id, onProgress);
          }
          onProgress?.(100, "Counterfactual analysis complete");
          return result;
        }
      } catch (error) {
        console.warn("Modal counterfactual failed, using mock:", error);
      }
    }

    // Mock implementation
    const branchResults: unknown[] = [];

    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i] as { name: string; modifications: unknown; probability: number };
      await this.sleep(400);
      onProgress?.(
        10 + ((i + 1) / branches.length) * 80,
        `Simulating: ${branch.name}...`
      );

      branchResults.push({
        name: branch.name,
        assumptions: branch.modifications,
        probability: branch.probability,
        outcome: {
          expectedValue: 100 * (1 + Math.random() * 0.5 - 0.25),
          distribution: this.generateMockDistribution(),
        },
      });
    }

    onProgress?.(100, "Counterfactual analysis complete");

    const comparison = {
      bestBranch: branchResults[0],
      expectedValue: branchResults.reduce((sum, b) => {
        const br = b as { probability: number; outcome: { expectedValue: number } };
        return sum + br.probability * br.outcome.expectedValue;
      }, 0),
      riskMetrics: {
        downside: branchResults[branchResults.length - 1],
        upside: branchResults[0],
      },
    };

    return {
      branches: branchResults,
      comparison,
      _mock: true,
    };
  }

  /**
   * Uncertainty aggregation
   */
  private async executeUncertaintyAggregate(
    config: Record<string, unknown>,
    inputs: Record<string, unknown>,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<unknown> {
    const method = (config.aggregationMethod as string) || "monte-carlo-propagation";
    const separateEpistemic = config.separateEpistemic !== false;

    onProgress?.(20, `Aggregating uncertainties (${method})...`);

    await this.sleep(500);
    onProgress?.(60, "Computing combined distribution...");

    await this.sleep(500);
    onProgress?.(100, "Complete");

    const inputDistributions = (inputs.distributions as unknown[]) || [];

    // Generate aggregated distribution
    const aggregatedDistribution = this.generateMockDistribution();

    return {
      aggregatedDistribution,
      uncertaintyBreakdown: {
        total: aggregatedDistribution.stats?.std || 0.15,
        epistemic: separateEpistemic ? 0.08 : undefined,
        aleatory: separateEpistemic ? 0.12 : undefined,
        sources: inputDistributions.map((_, i) => ({
          source: `input_${i}`,
          contribution: 1 / (inputDistributions.length || 1),
        })),
      },
      calibrationApplied: config.calibrationAdjustment !== false,
      _mock: true,
    };
  }

  // Helper methods

  private generateMockSamples(n: number, domain: string): number[] {
    const samples: number[] = [];
    const mean = domain === "defense" ? 0.5 : 100;
    const std = domain === "defense" ? 0.15 : 25;

    for (let i = 0; i < n; i++) {
      // Box-Muller transform for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      samples.push(mean + z * std);
    }

    return samples;
  }

  private calculateStats(samples: number[]): DistributionStats {
    const sorted = [...samples].sort((a, b) => a - b);
    const n = sorted.length;

    const mean = samples.reduce((a, b) => a + b, 0) / n;
    const variance = samples.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);

    return {
      mean,
      std,
      p5: sorted[Math.floor(n * 0.05)],
      p25: sorted[Math.floor(n * 0.25)],
      p50: sorted[Math.floor(n * 0.5)],
      p75: sorted[Math.floor(n * 0.75)],
      p95: sorted[Math.floor(n * 0.95)],
    };
  }

  private generateMockDistribution(): Distribution {
    const samples = this.generateMockSamples(1000, "enterprise");
    return {
      type: "empirical",
      parameters: { n: 1000 },
      samples,
      stats: this.calculateStats(samples),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
