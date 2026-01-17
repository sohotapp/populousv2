/**
 * RLTX Data Collection Pipeline
 *
 * Run with: npx tsx scripts/run-collection.ts
 *
 * This script:
 * 1. Collects VIP data from nyne.ai
 * 2. Compiles personas (Big Five, moral foundations)
 * 3. Stores everything in Supabase
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { getNyneCollector, type VIPSeed, type CollectionResult } from "../src/lib/collectors/nyne-collector";
import { getCompanyCollector, type CompanySeed, type CompanyCollectionResult } from "../src/lib/collectors/company-collector";
import { getPersonaCompiler, type RawVIPData } from "../src/lib/synthesis/persona-compiler";
import { vipAgents, companyAgents, collectionLog } from "../src/db/schema";

// Database client - use pooler URL for better connection handling
const connectionString = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set. Cannot run collection.");
  process.exit(1);
}

const client = postgres(connectionString, {
  max: 3,
  idle_timeout: 300, // 5 minutes idle timeout
  connect_timeout: 30, // 30 seconds connect timeout
});
const db = drizzle(client);

interface CollectionOptions {
  vips?: {
    vertical?: "enterprise" | "political" | "defense";
    tier?: "A" | "B" | "C";
    limit?: number;
  };
  companies?: {
    vertical?: "enterprise" | "defense" | "startup";
    tier?: "A" | "B" | "C";
    limit?: number;
  };
  dryRun?: boolean;
  skipPersonaSynthesis?: boolean;
}

async function runVIPCollection(options: CollectionOptions["vips"] = {}) {
  console.log("\n=== VIP Collection ===\n");

  const collector = getNyneCollector({ creditBudget: 3100 }); // VIP budget
  const queue = collector.getCollectionQueue(options);

  console.log(`VIPs to collect: ${queue.length}`);
  console.log(`Estimated credits: ${queue.reduce((sum, v) => sum + v.creditsRequired, 0)}`);

  if (options.limit) {
    console.log(`Limited to: ${options.limit}`);
  }

  const results = await collector.collectBatch(queue, {
    onProgress: async (current, total, result) => {
      const status = result.success ? "✓" : "✗";
      console.log(`[${current}/${total}] ${status} ${result.name} - ${result.creditsUsed} credits`);

      // Store in database
      if (result.success && result.data) {
        try {
          // Insert into vip_agents
          const vip = (queue as VIPSeed[]).find((v) => v.id === result.vipId)!;

          await db.insert(vipAgents).values({
            nyneId: result.vipId,
            name: result.name,
            vertical: vip.vertical,
            tier: vip.tier,
            domain: vip.domain,
            role: vip.role,
            affiliation: vip.affiliation,
            priorityRank: vip.priorityRank,
            nyneRawInterests: result.data.interests as unknown as Record<string, unknown>,
            nyneRawNewsfeed: result.data.newsfeed as unknown as Record<string, unknown>,
            nyneRawEnrichment: result.data.enrichment as unknown as Record<string, unknown>,
            nyneRawSocial: result.data.social as unknown as Record<string, unknown>,
            collectionStatus: "raw",
            creditsUsed: result.creditsUsed,
          }).onConflictDoUpdate({
            target: vipAgents.nyneId,
            set: {
              nyneRawInterests: result.data.interests as unknown as Record<string, unknown>,
              nyneRawNewsfeed: result.data.newsfeed as unknown as Record<string, unknown>,
              nyneRawEnrichment: result.data.enrichment as unknown as Record<string, unknown>,
              nyneRawSocial: result.data.social as unknown as Record<string, unknown>,
              collectionStatus: "raw",
              creditsUsed: result.creditsUsed,
              updatedAt: new Date(),
            },
          });

          // Log collection
          await db.insert(collectionLog).values({
            vipName: result.name,
            apiEndpoint: vip.apis.join(","),
            creditsUsed: result.creditsUsed,
            status: "success",
          });
        } catch (error) {
          console.error(`  Failed to store ${result.name}:`, error);
        }
      }
    },
  });

  const stats = collector.getStats();
  console.log("\n--- VIP Collection Complete ---");
  console.log(`Collected: ${stats.totalCollected}`);
  console.log(`Credits used: ${stats.creditsUsed}`);
  console.log(`Errors: ${stats.errors}`);

  return results;
}

async function runCompanyCollection(options: CollectionOptions["companies"] = {}) {
  console.log("\n=== Company Collection ===\n");

  const collector = getCompanyCollector({ creditBudget: 900 }); // Company budget
  const queue = collector.getCollectionQueue(options);

  console.log(`Companies to collect: ${queue.length}`);
  console.log(`Estimated credits: ${queue.reduce((sum, c) => sum + c.creditsRequired, 0)}`);

  const results = await collector.collectBatch(queue, {
    onProgress: async (current, total, result) => {
      const status = result.success ? "✓" : "✗";
      console.log(`[${current}/${total}] ${status} ${result.name} - ${result.creditsUsed} credits`);

      // Store in database
      if (result.success && result.data) {
        try {
          const company = (queue as CompanySeed[]).find((c) => c.id === result.companyId)!;

          await db.insert(companyAgents).values({
            nyneId: result.companyId,
            name: result.name,
            companyDomain: company.domain,
            ticker: company.ticker || null,
            vertical: company.vertical,
            tier: company.tier,
            sector: company.sector,
            subsector: company.subsector,
            priorityRank: company.priorityRank,
            nyneRawEnrichment: result.data.enrichment as unknown as Record<string, unknown>,
            nyneRawNeeds: result.data.needs as unknown as Record<string, unknown>,
            nyneRawFeatures: result.data.features as unknown as Record<string, unknown>,
            nyneRawFunding: result.data.funding as unknown as Record<string, unknown>,
            collectionStatus: "raw",
            creditsUsed: result.creditsUsed,
          }).onConflictDoUpdate({
            target: companyAgents.nyneId,
            set: {
              nyneRawEnrichment: result.data.enrichment as unknown as Record<string, unknown>,
              nyneRawNeeds: result.data.needs as unknown as Record<string, unknown>,
              nyneRawFeatures: result.data.features as unknown as Record<string, unknown>,
              nyneRawFunding: result.data.funding as unknown as Record<string, unknown>,
              collectionStatus: "raw",
              creditsUsed: result.creditsUsed,
              updatedAt: new Date(),
            },
          });
        } catch (error) {
          console.error(`  Failed to store ${result.name}:`, error);
        }
      }
    },
  });

  const stats = collector.getStats();
  console.log("\n--- Company Collection Complete ---");
  console.log(`Collected: ${stats.totalCollected}`);
  console.log(`Credits used: ${stats.creditsUsed}`);
  console.log(`Errors: ${stats.errors}`);

  return results;
}

async function runPersonaSynthesis() {
  console.log("\n=== Persona Synthesis ===\n");

  const compiler = getPersonaCompiler({ useAI: true });

  // Get all VIPs with raw data but no compiled persona
  const rawVips = await db
    .select()
    .from(vipAgents)
    .where(eq(vipAgents.collectionStatus, "raw"));

  console.log(`VIPs to synthesize: ${rawVips.length}`);

  for (let i = 0; i < rawVips.length; i++) {
    const vip = rawVips[i];
    console.log(`[${i + 1}/${rawVips.length}] Synthesizing ${vip.name}...`);

    try {
      const rawData: RawVIPData = {
        name: vip.name,
        vertical: vip.vertical as "enterprise" | "political" | "defense",
        tier: vip.tier as "A" | "B" | "C",
        domain: vip.domain || "",
        role: vip.role || "",
        affiliation: vip.affiliation || "",
        interests: vip.nyneRawInterests as any,
        newsfeed: vip.nyneRawNewsfeed as any,
        enrichment: vip.nyneRawEnrichment as any,
      };

      const persona = await compiler.compile(rawData);

      // Update VIP with compiled persona
      await db.update(vipAgents)
        .set({
          biography: persona.biography,
          bigFive: persona.bigFive,
          moralFoundations: persona.moralFoundations,
          psychographics: persona.psychographics,
          communicationStyle: persona.communicationStyle,
          sampleContent: persona.sampleContent,
          topicInterests: persona.topicInterests,
          knownPositions: persona.knownPositions,
          collectionStatus: "complete",
          updatedAt: new Date(),
        })
        .where(eq(vipAgents.id, vip.id));

      console.log(`  ✓ Big Five: O=${persona.bigFive.openness.toFixed(2)}, C=${persona.bigFive.conscientiousness.toFixed(2)}, E=${persona.bigFive.extraversion.toFixed(2)}`);
    } catch (error) {
      console.error(`  ✗ Failed to synthesize ${vip.name}:`, error);
    }

    // Rate limit to avoid API overload
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("\n--- Persona Synthesis Complete ---");
}

async function main() {
  console.log("=".repeat(60));
  console.log("RLTX Data Collection Pipeline");
  console.log("=".repeat(60));

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const vipsOnly = args.includes("--vips-only");
  const companiesOnly = args.includes("--companies-only");
  const synthesisOnly = args.includes("--synthesis-only");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1]) : undefined;

  if (dryRun) {
    console.log("\n[DRY RUN MODE - No API calls will be made]\n");
  }

  try {
    if (synthesisOnly) {
      await runPersonaSynthesis();
    } else if (vipsOnly) {
      await runVIPCollection({ limit });
    } else if (companiesOnly) {
      await runCompanyCollection({ limit });
    } else {
      // Run full pipeline
      await runVIPCollection({ tier: "A", limit: limit || 10 }); // Start small
      await runCompanyCollection({ tier: "A", limit: limit || 10 });
      await runPersonaSynthesis();
    }

    console.log("\n" + "=".repeat(60));
    console.log("Pipeline Complete!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\nPipeline failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
