/**
 * CollectionOrchestrator - Coordinates the full VIP persona collection pipeline
 *
 * Pipeline flow:
 * 1. VIP Seed List → NyneCollector → Raw Data
 * 2. Raw Data → PersonaCompiler → Compiled Persona
 * 3. Compiled Persona → PersonaStore → Supabase
 *
 * Features:
 * - Credit budget management
 * - Rate limiting respect
 * - Error recovery and resume
 * - Progress tracking
 * - Tiered collection (A/B/C)
 */

import { getNyneCollector, type VIPSeed, type CollectionResult } from "@/lib/collectors/nyne-collector";
import { getPersonaCompiler, type RawVIPData, type CompiledPersona } from "@/lib/synthesis/persona-compiler";
import {
  getPersonaStore,
  type PersonaInput,
  type StoredPersona,
  type CollectionStats,
  type VIPVertical,
  type VIPTier,
} from "./persona-store";

// =============================================================================
// TYPES
// =============================================================================

export interface OrchestratorConfig {
  // Credit budget for this collection run
  creditBudget: number;

  // Enable AI-powered persona compilation (uses Claude API)
  enableAICompilation: boolean;

  // Stop on first error or continue
  continueOnError: boolean;

  // Delay between VIPs (ms) to avoid rate limits
  delayBetweenVIPs: number;

  // Batch size for compilation
  compilationBatchSize: number;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  creditBudget: 5000,
  enableAICompilation: true,
  continueOnError: true,
  delayBetweenVIPs: 200,
  compilationBatchSize: 10,
};

export interface CollectionProgress {
  phase: "collecting" | "compiling" | "saving" | "complete";
  current: number;
  total: number;
  currentVIP?: string;
  creditsUsed: number;
  creditsRemaining: number;
  successCount: number;
  errorCount: number;
  elapsedMs: number;
  estimatedRemainingMs?: number;
}

export interface CollectionSummary {
  success: boolean;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;

  // Counts
  totalProcessed: number;
  successfulCollections: number;
  failedCollections: number;
  successfulCompilations: number;
  failedCompilations: number;

  // Credits
  creditsUsed: number;
  creditBudget: number;

  // Breakdown
  byVertical: Record<VIPVertical, { collected: number; failed: number }>;
  byTier: Record<VIPTier, { collected: number; failed: number }>;

  // Errors
  errors: Array<{ vipName: string; error: string }>;
}

export interface CollectionFilter {
  vertical?: VIPVertical;
  tier?: VIPTier;
  limit?: number;
  onlyPending?: boolean;
  onlyStale?: boolean;
}

// =============================================================================
// COLLECTION ORCHESTRATOR CLASS
// =============================================================================

export class CollectionOrchestrator {
  private config: OrchestratorConfig;
  private collector;
  private compiler;
  private store;

  // State for resumable operations
  private isRunning = false;
  private shouldStop = false;
  private currentProgress: CollectionProgress | null = null;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.collector = getNyneCollector({ creditBudget: this.config.creditBudget });
    this.compiler = getPersonaCompiler({ useAI: this.config.enableAICompilation });
    this.store = getPersonaStore();
  }

  /**
   * Check if the orchestrator is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get current progress (if running)
   */
  getProgress(): CollectionProgress | null {
    return this.currentProgress;
  }

  /**
   * Request stop (will complete current VIP then stop)
   */
  requestStop(): void {
    this.shouldStop = true;
  }

  /**
   * Run a full collection cycle
   * This is the main entry point for collecting VIP personas
   */
  async runCollection(
    filter?: CollectionFilter,
    onProgress?: (progress: CollectionProgress) => void
  ): Promise<CollectionSummary> {
    if (this.isRunning) {
      throw new Error("Collection already in progress. Call requestStop() first.");
    }

    this.isRunning = true;
    this.shouldStop = false;

    const startedAt = new Date();
    let creditsUsed = 0;
    const errors: Array<{ vipName: string; error: string }> = [];

    const byVertical: Record<VIPVertical, { collected: number; failed: number }> = {
      enterprise: { collected: 0, failed: 0 },
      political: { collected: 0, failed: 0 },
      defense: { collected: 0, failed: 0 },
    };

    const byTier: Record<VIPTier, { collected: number; failed: number }> = {
      A: { collected: 0, failed: 0 },
      B: { collected: 0, failed: 0 },
      C: { collected: 0, failed: 0 },
    };

    let successfulCollections = 0;
    let failedCollections = 0;
    let successfulCompilations = 0;
    let failedCompilations = 0;

    try {
      // Step 1: Get VIPs to collect
      const vipsToCollect = await this.getVIPsToCollect(filter);
      const total = vipsToCollect.length;

      console.log(`[Orchestrator] Starting collection of ${total} VIPs`);
      console.log(`[Orchestrator] Credit budget: ${this.config.creditBudget}`);

      // Step 2: Process each VIP
      for (let i = 0; i < total && !this.shouldStop; i++) {
        const vip = vipsToCollect[i];
        const startTime = Date.now();

        // Update progress
        this.currentProgress = {
          phase: "collecting",
          current: i + 1,
          total,
          currentVIP: vip.name,
          creditsUsed,
          creditsRemaining: this.config.creditBudget - creditsUsed,
          successCount: successfulCollections,
          errorCount: failedCollections,
          elapsedMs: Date.now() - startedAt.getTime(),
          estimatedRemainingMs: this.estimateRemainingTime(i, total, startedAt),
        };
        onProgress?.(this.currentProgress);

        try {
          // Check credit budget
          if (creditsUsed + vip.creditsRequired > this.config.creditBudget) {
            console.log(`[Orchestrator] Credit budget exhausted. Stopping.`);
            break;
          }

          // Step 2a: Collect raw data from nyne.ai
          console.log(`[Orchestrator] [${i + 1}/${total}] Collecting: ${vip.name}`);
          const collectionResult = await this.collector.collectVIP(vip);

          if (!collectionResult.success) {
            throw new Error(collectionResult.error || "Collection failed");
          }

          creditsUsed += collectionResult.creditsUsed;
          successfulCollections++;
          byVertical[vip.vertical as VIPVertical].collected++;
          byTier[vip.tier as VIPTier].collected++;

          // Log the collection
          await this.logCollectionAttempts(vip, collectionResult);

          // Update progress for compilation phase
          this.currentProgress.phase = "compiling";
          onProgress?.(this.currentProgress);

          // Step 2b: Compile persona using AI
          let compiled: CompiledPersona | undefined;
          try {
            const rawVIPData: RawVIPData = {
              name: vip.name,
              vertical: vip.vertical as "enterprise" | "political" | "defense",
              tier: vip.tier as "A" | "B" | "C",
              domain: vip.domain,
              role: vip.role,
              affiliation: vip.affiliation,
              interests: collectionResult.data?.interests,
              newsfeed: collectionResult.data?.newsfeed,
              enrichment: collectionResult.data?.enrichment,
            };

            compiled = await this.compiler.compile(rawVIPData);
            successfulCompilations++;
            console.log(`[Orchestrator] [${i + 1}/${total}] Compiled: ${vip.name}`);
          } catch (compileError) {
            console.error(`[Orchestrator] Compilation failed for ${vip.name}:`, compileError);
            failedCompilations++;
            // Continue with raw data only
          }

          // Update progress for saving phase
          this.currentProgress.phase = "saving";
          onProgress?.(this.currentProgress);

          // Step 2c: Save to Supabase
          const personaInput: PersonaInput = {
            seedData: {
              id: vip.id,
              name: vip.name,
              vertical: vip.vertical as VIPVertical,
              tier: vip.tier as VIPTier,
              domain: vip.domain,
              role: vip.role,
              affiliation: vip.affiliation,
              priorityRank: vip.priorityRank,
            },
            rawData: collectionResult.data
              ? {
                  interests: collectionResult.data.interests,
                  newsfeed: collectionResult.data.newsfeed,
                  enrichment: collectionResult.data.enrichment,
                  social: collectionResult.data.social,
                }
              : undefined,
            compiled,
            creditsUsed: collectionResult.creditsUsed,
            collectionStatus: compiled ? "complete" : "partial",
          };

          await this.store.savePersona(personaInput);
          console.log(`[Orchestrator] [${i + 1}/${total}] Saved: ${vip.name}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error(`[Orchestrator] Error processing ${vip.name}:`, errorMessage);

          errors.push({ vipName: vip.name, error: errorMessage });
          failedCollections++;
          byVertical[vip.vertical as VIPVertical].failed++;
          byTier[vip.tier as VIPTier].failed++;

          // Update store with error status
          await this.store.savePersona({
            seedData: {
              id: vip.id,
              name: vip.name,
              vertical: vip.vertical as VIPVertical,
              tier: vip.tier as VIPTier,
              domain: vip.domain,
              role: vip.role,
              affiliation: vip.affiliation,
              priorityRank: vip.priorityRank,
            },
            collectionStatus: "error",
          });

          if (!this.config.continueOnError) {
            throw error;
          }
        }

        // Delay between VIPs
        if (i < total - 1 && !this.shouldStop) {
          await this.sleep(this.config.delayBetweenVIPs);
        }
      }

      // Final progress update
      this.currentProgress = {
        phase: "complete",
        current: successfulCollections + failedCollections,
        total,
        creditsUsed,
        creditsRemaining: this.config.creditBudget - creditsUsed,
        successCount: successfulCollections,
        errorCount: failedCollections,
        elapsedMs: Date.now() - startedAt.getTime(),
      };
      onProgress?.(this.currentProgress);
    } finally {
      this.isRunning = false;
    }

    const completedAt = new Date();

    return {
      success: errors.length === 0,
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      totalProcessed: successfulCollections + failedCollections,
      successfulCollections,
      failedCollections,
      successfulCompilations,
      failedCompilations,
      creditsUsed,
      creditBudget: this.config.creditBudget,
      byVertical,
      byTier,
      errors,
    };
  }

  /**
   * Run collection for personas that need refresh (stale or incomplete)
   */
  async runRefreshCollection(
    onProgress?: (progress: CollectionProgress) => void
  ): Promise<CollectionSummary> {
    // First mark stale personas
    const markedStale = await this.store.markStalePersonas();
    console.log(`[Orchestrator] Marked ${markedStale} personas as stale`);

    // Then run collection for stale/incomplete personas
    return this.runCollection({ onlyStale: true }, onProgress);
  }

  /**
   * Get collection statistics from the store
   */
  async getStats(): Promise<CollectionStats> {
    return this.store.getCollectionStats();
  }

  /**
   * Import VIPs from seed list without collecting (just creates pending records)
   */
  async importSeedList(seeds: VIPSeed[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (const seed of seeds) {
      try {
        // Check if already exists
        const existing = await this.store.getPersonaByNyneId(seed.id);
        if (existing) {
          skipped++;
          continue;
        }

        // Create pending record
        await this.store.savePersona({
          seedData: {
            id: seed.id,
            name: seed.name,
            vertical: seed.vertical as VIPVertical,
            tier: seed.tier as VIPTier,
            domain: seed.domain,
            role: seed.role,
            affiliation: seed.affiliation,
            priorityRank: seed.priorityRank,
          },
          collectionStatus: "pending",
        });
        imported++;
      } catch (error) {
        console.error(`[Orchestrator] Failed to import ${seed.name}:`, error);
        skipped++;
      }
    }

    console.log(`[Orchestrator] Imported ${imported} VIPs, skipped ${skipped}`);
    return { imported, skipped };
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Get VIPs to collect based on filter
   */
  private async getVIPsToCollect(filter?: CollectionFilter): Promise<VIPSeed[]> {
    // If we have pending/stale filter, get from store
    if (filter?.onlyPending || filter?.onlyStale) {
      const personas = await this.store.getPersonasNeedingCollection({
        vertical: filter.vertical,
        limit: filter.limit,
      });

      // Convert StoredPersona back to VIPSeed format
      return personas.map((p) => ({
        id: p.nyneId || p.id,
        name: p.name,
        vertical: p.vertical,
        tier: p.tier,
        domain: p.domain,
        role: p.role,
        affiliation: p.affiliation || "",
        priorityRank: p.priorityRank || 999,
        apis: this.getApisForTier(p.tier),
        creditsRequired: this.getCreditsForTier(p.tier),
      }));
    }

    // Otherwise use collector's queue (from seed list)
    return this.collector.getCollectionQueue({
      vertical: filter?.vertical as "enterprise" | "political" | "defense" | undefined,
      tier: filter?.tier as "A" | "B" | "C" | undefined,
      limit: filter?.limit,
    });
  }

  /**
   * Get APIs to collect for a tier
   */
  private getApisForTier(tier: VIPTier): string[] {
    switch (tier) {
      case "A":
        return ["interests", "newsfeed", "enrichment"];
      case "B":
        return ["interests", "newsfeed"];
      case "C":
        return ["interests"];
      default:
        return ["interests"];
    }
  }

  /**
   * Get estimated credits for a tier
   */
  private getCreditsForTier(tier: VIPTier): number {
    switch (tier) {
      case "A":
        return 3;
      case "B":
        return 2;
      case "C":
        return 1;
      default:
        return 1;
    }
  }

  /**
   * Log collection attempts to the store
   */
  private async logCollectionAttempts(
    vip: VIPSeed,
    result: CollectionResult
  ): Promise<void> {
    const apis = vip.apis;
    const status = result.success ? "success" : "error";

    for (const api of apis) {
      await this.store.logCollectionAttempt({
        vipId: result.vipId,
        vipName: result.name,
        apiEndpoint: api as "interests" | "newsfeed" | "enrichment" | "social",
        creditsUsed: api === "social" ? 5 : 1,
        status,
        errorMessage: result.error,
      });
    }
  }

  /**
   * Estimate remaining time based on progress
   */
  private estimateRemainingTime(current: number, total: number, startedAt: Date): number {
    if (current === 0) return 0;

    const elapsed = Date.now() - startedAt.getTime();
    const avgTimePerVIP = elapsed / current;
    const remaining = total - current;

    return Math.round(avgTimePerVIP * remaining);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let orchestratorInstance: CollectionOrchestrator | null = null;

export function getCollectionOrchestrator(
  config?: Partial<OrchestratorConfig>
): CollectionOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new CollectionOrchestrator(config);
  }
  return orchestratorInstance;
}

// =============================================================================
// CLI ENTRY POINT
// =============================================================================

/**
 * CLI function for running collection from command line
 * Usage: npx ts-node -e "require('./src/lib/personas/collection-orchestrator').runCollectionCLI()"
 */
export async function runCollectionCLI(options?: {
  vertical?: VIPVertical;
  tier?: VIPTier;
  limit?: number;
  creditBudget?: number;
  dryRun?: boolean;
}): Promise<void> {
  const orchestrator = new CollectionOrchestrator({
    creditBudget: options?.creditBudget || 5000,
  });

  console.log("\n========================================");
  console.log("   RLTX VIP Persona Collection");
  console.log("========================================\n");

  // Get stats before collection
  const statsBefore = await orchestrator.getStats();
  console.log("Current Status:");
  console.log(`  Total personas: ${statsBefore.total}`);
  console.log(`  Complete: ${statsBefore.byStatus.complete}`);
  console.log(`  Pending: ${statsBefore.byStatus.pending}`);
  console.log(`  Stale: ${statsBefore.byStatus.stale}`);
  console.log(`  Needs refresh: ${statsBefore.needsRefresh}`);
  console.log(`  Credits used: ${statsBefore.creditsUsed}`);
  console.log("");

  if (options?.dryRun) {
    console.log("[DRY RUN] Would collect with filter:");
    console.log(`  Vertical: ${options.vertical || "all"}`);
    console.log(`  Tier: ${options.tier || "all"}`);
    console.log(`  Limit: ${options.limit || "no limit"}`);
    return;
  }

  // Run collection with progress
  const summary = await orchestrator.runCollection(
    {
      vertical: options?.vertical,
      tier: options?.tier,
      limit: options?.limit,
    },
    (progress) => {
      const pct = Math.round((progress.current / progress.total) * 100);
      const eta = progress.estimatedRemainingMs
        ? `ETA: ${Math.round(progress.estimatedRemainingMs / 1000)}s`
        : "";
      process.stdout.write(
        `\r[${progress.phase}] ${progress.current}/${progress.total} (${pct}%) - ${progress.currentVIP || ""} - Credits: ${progress.creditsUsed} ${eta}    `
      );
    }
  );

  console.log("\n\n========================================");
  console.log("   Collection Summary");
  console.log("========================================\n");
  console.log(`Duration: ${Math.round(summary.durationMs / 1000)}s`);
  console.log(`Processed: ${summary.totalProcessed}`);
  console.log(`  Successful: ${summary.successfulCollections}`);
  console.log(`  Failed: ${summary.failedCollections}`);
  console.log(`Compilations:`);
  console.log(`  Successful: ${summary.successfulCompilations}`);
  console.log(`  Failed: ${summary.failedCompilations}`);
  console.log(`Credits used: ${summary.creditsUsed} / ${summary.creditBudget}`);

  if (summary.errors.length > 0) {
    console.log(`\nErrors (${summary.errors.length}):`);
    summary.errors.slice(0, 10).forEach((e) => {
      console.log(`  - ${e.vipName}: ${e.error}`);
    });
    if (summary.errors.length > 10) {
      console.log(`  ... and ${summary.errors.length - 10} more`);
    }
  }

  console.log("");
}
