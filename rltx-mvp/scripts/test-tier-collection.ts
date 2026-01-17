/**
 * Test Tier Collection - Comprehensive test for each VIP tier
 *
 * Run with: npx dotenvx run -- npx tsx scripts/test-tier-collection.ts
 *
 * This script:
 * 1. Tests ONE VIP from each tier (A, B, C) with the new retry logic
 * 2. Collects data with tier-based polling configuration
 * 3. Stores results in Supabase
 * 4. Verifies data completeness for each tier
 * 5. Shows detailed field breakdown
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { getNyneCollector, type VIPSeed, type CollectionResult } from "../src/lib/collectors/nyne-collector";
import { vipAgents, collectionLog } from "../src/db/schema";
import vipSeedList from "../src/lib/collectors/vip-seed-list.json";

// Database client
const connectionString = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set. Cannot run test.");
  process.exit(1);
}

const client = postgres(connectionString, {
  max: 3,
  idle_timeout: 300,
  connect_timeout: 30,
});
const db = drizzle(client);

// ============================================================================
// TEST VIP SELECTION - One from each tier
// ============================================================================

function getTestVIPs(): { tierA: VIPSeed; tierB: VIPSeed; tierC: VIPSeed } {
  const vips = vipSeedList.vips as VIPSeed[];

  // Get first VIP from each tier that has a LinkedIn URL
  const tierA = vips.find((v) => v.tier === "A" && v.linkedinUrl);
  const tierB = vips.find((v) => v.tier === "B" && v.linkedinUrl);
  const tierC = vips.find((v) => v.tier === "C" && v.linkedinUrl);

  if (!tierA || !tierB || !tierC) {
    throw new Error("Could not find test VIPs with LinkedIn URLs for all tiers");
  }

  return { tierA, tierB, tierC };
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

function printDivider(title: string) {
  console.log("\n" + "=".repeat(80));
  console.log(`  ${title}`);
  console.log("=".repeat(80) + "\n");
}

function printSection(title: string) {
  console.log(`\n--- ${title} ---`);
}

function printField(name: string, value: unknown, indent = 0) {
  const prefix = "  ".repeat(indent);
  if (value === undefined || value === null || value === "") {
    console.log(`${prefix}${name}: [MISSING]`);
  } else if (Array.isArray(value)) {
    if (value.length === 0) {
      console.log(`${prefix}${name}: [EMPTY ARRAY]`);
    } else if (typeof value[0] === "object") {
      console.log(`${prefix}${name}: [${value.length} items]`);
      value.slice(0, 2).forEach((item, i) => {
        const summary = JSON.stringify(item).substring(0, 100);
        console.log(`${prefix}  [${i}]: ${summary}${summary.length >= 100 ? "..." : ""}`);
      });
      if (value.length > 2) console.log(`${prefix}  ... and ${value.length - 2} more`);
    } else {
      const items = value.slice(0, 3).join(", ");
      console.log(`${prefix}${name}: [${items}${value.length > 3 ? ", ..." : ""}]`);
    }
  } else if (typeof value === "object") {
    const summary = JSON.stringify(value).substring(0, 100);
    console.log(`${prefix}${name}: ${summary}${summary.length >= 100 ? "..." : ""}`);
  } else if (typeof value === "string" && value.length > 100) {
    console.log(`${prefix}${name}: ${value.substring(0, 100)}...`);
  } else {
    console.log(`${prefix}${name}: ${value}`);
  }
}

// ============================================================================
// DATA QUALITY SCORING
// ============================================================================

interface DataQualityReport {
  tier: string;
  name: string;
  success: boolean;
  creditsUsed: number;
  score: number;
  maxScore: number;
  percentage: number;
  fields: {
    name: string;
    present: boolean;
    value?: string;
  }[];
  missing: string[];
  supabaseStored: boolean;
}

function generateQualityReport(
  result: CollectionResult,
  tier: "A" | "B" | "C"
): DataQualityReport {
  const fields: DataQualityReport["fields"] = [];
  const missing: string[] = [];
  let score = 0;

  // Tier-based scoring
  const maxScores = { A: 12, B: 8, C: 4 };
  const maxScore = maxScores[tier];

  const e = result.data?.enrichment;
  const n = result.data?.newsfeed;

  // Check each field
  const checkField = (name: string, value: unknown, points: number, requiredFor: string[]) => {
    const present = value !== undefined && value !== null && value !== "";
    const hasContent = Array.isArray(value) ? value.length > 0 : !!value;

    fields.push({
      name,
      present: hasContent,
      value: hasContent ? (typeof value === "string" ? value.substring(0, 50) : `[${Array.isArray(value) ? value.length + " items" : "object"}]`) : undefined,
    });

    if (hasContent) {
      score += points;
    } else if (requiredFor.includes(tier)) {
      missing.push(name);
    }
  };

  // Core identity (all tiers)
  checkField("name", e?.name, 1, ["A", "B", "C"]);
  checkField("biography", e?.biography, 1, ["A", "B"]);
  checkField("current_role", e?.current_role, 1, ["A", "B"]);
  checkField("organization", e?.organization, 1, ["A", "B"]);

  // Career & education (A, B)
  checkField("career_history", e?.career_history, 2, ["A", "B"]);
  checkField("education", e?.education, 1, ["A"]);

  // Social profiles (A)
  checkField("social_profiles.linkedin", e?.social_profiles?.linkedin, 1, ["A"]);
  checkField("social_profiles.twitter", e?.social_profiles?.twitter, 1, ["A"]);

  // Contact info (A)
  checkField("altemails", e?.altemails, 1, ["A"]);
  checkField("fullphone", e?.fullphone, 1, []);

  // Newsfeed (A only)
  checkField("newsfeed.recent_content", n?.recent_content, 2, ["A"]);
  checkField("newsfeed.communication_style", n?.communication_style, 1, ["A"]);

  return {
    tier,
    name: result.name,
    success: result.success,
    creditsUsed: result.creditsUsed,
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    fields,
    missing,
    supabaseStored: false, // Will be updated after storage
  };
}

// ============================================================================
// SUPABASE STORAGE
// ============================================================================

async function storeInSupabase(vip: VIPSeed, result: CollectionResult): Promise<boolean> {
  try {
    await db.insert(vipAgents).values({
      nyneId: result.vipId,
      name: result.name,
      vertical: vip.vertical,
      tier: vip.tier,
      domain: vip.domain,
      role: vip.role,
      affiliation: vip.affiliation,
      priorityRank: vip.priorityRank,
      nyneRawInterests: result.data?.interests as unknown as Record<string, unknown>,
      nyneRawNewsfeed: result.data?.newsfeed as unknown as Record<string, unknown>,
      nyneRawEnrichment: result.data?.enrichment as unknown as Record<string, unknown>,
      nyneRawSocial: result.data?.social as unknown as Record<string, unknown>,
      // Store extracted fields
      biography: result.data?.enrichment?.biography || null,
      collectionStatus: "complete",
      creditsUsed: result.creditsUsed,
      lastSyncedAt: new Date(),
    }).onConflictDoUpdate({
      target: vipAgents.nyneId,
      set: {
        nyneRawInterests: result.data?.interests as unknown as Record<string, unknown>,
        nyneRawNewsfeed: result.data?.newsfeed as unknown as Record<string, unknown>,
        nyneRawEnrichment: result.data?.enrichment as unknown as Record<string, unknown>,
        nyneRawSocial: result.data?.social as unknown as Record<string, unknown>,
        biography: result.data?.enrichment?.biography || null,
        collectionStatus: "complete",
        creditsUsed: result.creditsUsed,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Log collection
    await db.insert(collectionLog).values({
      vipName: result.name,
      apiEndpoint: `tier_${vip.tier}_test`,
      creditsUsed: result.creditsUsed,
      status: result.success ? "success" : "error",
      errorMessage: result.error || null,
    });

    return true;
  } catch (error) {
    console.error(`  Failed to store ${result.name}:`, error);
    return false;
  }
}

async function verifySupabaseStorage(vipId: string): Promise<{
  found: boolean;
  hasRawEnrichment: boolean;
  hasNewsfeed: boolean;
  hasBiography: boolean;
}> {
  try {
    const results = await db
      .select()
      .from(vipAgents)
      .where(eq(vipAgents.nyneId, vipId))
      .limit(1);

    if (results.length === 0) {
      return { found: false, hasRawEnrichment: false, hasNewsfeed: false, hasBiography: false };
    }

    const record = results[0];
    return {
      found: true,
      hasRawEnrichment: !!record.nyneRawEnrichment,
      hasNewsfeed: !!record.nyneRawNewsfeed,
      hasBiography: !!record.biography && record.biography.length > 0,
    };
  } catch (error) {
    console.error("Error verifying Supabase storage:", error);
    return { found: false, hasRawEnrichment: false, hasNewsfeed: false, hasBiography: false };
  }
}

// ============================================================================
// MAIN TEST FLOW
// ============================================================================

async function testTier(
  tier: "A" | "B" | "C",
  vip: VIPSeed,
  collector: ReturnType<typeof getNyneCollector>
): Promise<DataQualityReport> {
  printDivider(`TIER ${tier} TEST: ${vip.name}`);

  console.log("VIP Details:");
  console.log(`  Name: ${vip.name}`);
  console.log(`  Role: ${vip.role}`);
  console.log(`  Affiliation: ${vip.affiliation}`);
  console.log(`  LinkedIn: ${vip.linkedinUrl}`);
  console.log(`  Expected Credits: ${vip.creditsRequired}`);

  printSection("COLLECTING DATA");
  console.log("Starting collection with retry logic...\n");

  const startTime = Date.now();
  const result = await collector.collectVIPWithRetry(vip);
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\nCollection completed in ${duration}s`);

  printSection("COLLECTION RESULT");
  console.log(`  Success: ${result.success}`);
  console.log(`  Credits Used: ${result.creditsUsed}`);
  if (result.error) console.log(`  Error: ${result.error}`);

  printSection("ENRICHMENT DATA");
  if (result.data?.enrichment) {
    const e = result.data.enrichment;
    printField("person_id", e.person_id);
    printField("name", e.name);
    printField("biography", e.biography);
    printField("current_role", e.current_role);
    printField("organization", e.organization);
    printField("location", e.location);
    printField("career_history", e.career_history);
    printField("education", e.education);
    printField("social_profiles", e.social_profiles);
    printField("altemails", e.altemails);
    printField("fullphone", e.fullphone);
  } else {
    console.log("  [NO ENRICHMENT DATA]");
  }

  if (tier === "A") {
    printSection("NEWSFEED DATA");
    if (result.data?.newsfeed) {
      const n = result.data.newsfeed;
      printField("recent_content", n.recent_content);
      printField("communication_style", n.communication_style);
    } else {
      console.log("  [NO NEWSFEED DATA]");
    }
  }

  printSection("DATA QUALITY SCORE");
  const report = generateQualityReport(result, tier);
  console.log(`  Score: ${report.score}/${report.maxScore} (${report.percentage}%)`);
  if (report.missing.length > 0) {
    console.log(`  Missing required fields: ${report.missing.join(", ")}`);
  }

  printSection("STORING IN SUPABASE");
  const stored = await storeInSupabase(vip, result);
  console.log(`  Storage: ${stored ? "SUCCESS" : "FAILED"}`);

  if (stored) {
    const verification = await verifySupabaseStorage(vip.id);
    console.log(`  Verification:`);
    console.log(`    - Record found: ${verification.found}`);
    console.log(`    - Has raw enrichment: ${verification.hasRawEnrichment}`);
    console.log(`    - Has newsfeed: ${verification.hasNewsfeed}`);
    console.log(`    - Has biography: ${verification.hasBiography}`);
    report.supabaseStored = verification.found && verification.hasRawEnrichment;
  }

  return report;
}

async function main() {
  console.log("=".repeat(80));
  console.log("  RLTX Tier Collection Test");
  console.log("  Testing all tiers with new retry logic and Supabase storage");
  console.log("=".repeat(80));

  // Check API credentials
  if (!process.env.NYNE_API_KEY || !process.env.NYNE_API_SECRET) {
    console.error("\nERROR: NYNE_API_KEY or NYNE_API_SECRET not set in .env.local");
    console.log("Running in MOCK MODE - results will be simulated\n");
  }

  const testVIPs = getTestVIPs();
  console.log("\nTest VIPs selected:");
  console.log(`  Tier A: ${testVIPs.tierA.name} (${testVIPs.tierA.affiliation})`);
  console.log(`  Tier B: ${testVIPs.tierB.name} (${testVIPs.tierB.affiliation})`);
  console.log(`  Tier C: ${testVIPs.tierC.name} (${testVIPs.tierC.affiliation})`);

  // Reset collector for fresh test
  const collector = getNyneCollector({ creditBudget: 100 });

  const reports: DataQualityReport[] = [];

  try {
    // Test each tier
    reports.push(await testTier("A", testVIPs.tierA, collector));
    reports.push(await testTier("B", testVIPs.tierB, collector));
    reports.push(await testTier("C", testVIPs.tierC, collector));

    // Summary
    printDivider("TEST SUMMARY");

    console.log("Results by Tier:\n");
    console.log("| Tier | Name                    | Score | Credits | Stored | Missing Fields |");
    console.log("|------|-------------------------|-------|---------|--------|----------------|");

    for (const r of reports) {
      const name = r.name.substring(0, 23).padEnd(23);
      const score = `${r.score}/${r.maxScore}`.padStart(5);
      const credits = String(r.creditsUsed).padStart(7);
      const stored = r.supabaseStored ? "  YES  " : "  NO   ";
      const missing = r.missing.length > 0 ? r.missing.slice(0, 2).join(", ") : "-";
      console.log(`|  ${r.tier}   | ${name} | ${score} | ${credits} | ${stored} | ${missing.padEnd(14)} |`);
    }

    const totalCredits = reports.reduce((sum, r) => sum + r.creditsUsed, 0);
    const avgScore = Math.round(reports.reduce((sum, r) => sum + r.percentage, 0) / reports.length);

    console.log("\nOverall:");
    console.log(`  Total Credits Used: ${totalCredits}`);
    console.log(`  Average Data Quality: ${avgScore}%`);
    console.log(`  All Stored in Supabase: ${reports.every((r) => r.supabaseStored)}`);

    // Check for failures
    const failures = reports.filter((r) => !r.success || !r.supabaseStored);
    if (failures.length > 0) {
      console.log("\n⚠ WARNINGS:");
      for (const f of failures) {
        if (!f.success) console.log(`  - ${f.name}: Collection failed`);
        if (!f.supabaseStored) console.log(`  - ${f.name}: Supabase storage failed`);
      }
    } else {
      console.log("\n✓ All tiers collected and stored successfully!");
    }

  } catch (error) {
    console.error("\nTest failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
