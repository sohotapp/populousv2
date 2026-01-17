/**
 * COLLECT ALL VIPs WITH LINKEDIN URLs
 *
 * Run with: npx tsx scripts/collect-all-vips.ts
 *
 * Uses the verified-collection pattern for maximum data capture:
 * - Tier A: enrichment + newsfeed = 12 credits
 * - Tier B: enrichment only = 6 credits
 * - Tier C: lite enrichment = 3 credits
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { vipAgents, collectionLog } from "../src/db/schema";
import vipSeedList from "../src/lib/collectors/vip-seed-list.json";

// Types
interface VIPSeed {
  id: string;
  name: string;
  vertical: "enterprise" | "political" | "defense";
  tier: "A" | "B" | "C";
  domain: string;
  role: string;
  affiliation: string;
  priorityRank: number;
  linkedinUrl?: string;
  twitterHandle?: string;
}

// Database setup
const connectionString = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: DATABASE_URL not set");
  process.exit(1);
}

const client = postgres(connectionString, { max: 3, idle_timeout: 300 });
const db = drizzle(client);

// API setup
const API_KEY = process.env.NYNE_API_KEY;
const API_SECRET = process.env.NYNE_API_SECRET;
const API_URL = "https://api.nyne.ai";

if (!API_KEY || !API_SECRET) {
  console.error("ERROR: NYNE_API_KEY or NYNE_API_SECRET not set");
  process.exit(1);
}

// Credit tracking
let totalCreditsUsed = 0;

/**
 * Make a SINGLE optimized API call for a VIP
 */
async function fetchEnrichment(
  vip: VIPSeed
): Promise<{ success: boolean; data: Record<string, unknown> | null; credits: number; error?: string }> {
  const tier = vip.tier;

  const body: Record<string, unknown> = {
    social_media_url: vip.linkedinUrl,
    ai_enhanced_search: true,
  };

  let expectedCredits: number;
  if (tier === "C") {
    body.lite_enrich = true;
    expectedCredits = 3;
  } else if (tier === "A") {
    body.newsfeed = ["linkedin", "twitter"];
    expectedCredits = 12;
  } else {
    expectedCredits = 6;
  }

  console.log(`\n[API] ${vip.name} (Tier ${tier})`);
  console.log(`[API] LinkedIn: ${vip.linkedinUrl}`);
  console.log(`[API] Expected credits: ${expectedCredits}`);

  try {
    const response = await fetch(`${API_URL}/person/enrichment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY!,
        "X-API-Secret": API_SECRET!,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (result.data?.status === "queued" && result.data?.request_id) {
      console.log(`[API] Request queued, polling...`);
      const pollResult = await pollForResult(result.data.request_id, vip.name, tier);
      return { success: true, data: pollResult, credits: expectedCredits };
    }

    const data = result.data?.result || result.data || {};
    console.log(`[API] ✓ Got immediate response`);
    return { success: true, data, credits: expectedCredits };

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[API] ✗ Error: ${message}`);
    return { success: false, data: null, credits: 0, error: message };
  }
}

/**
 * Poll for async result with tier-appropriate timeout
 */
async function pollForResult(
  requestId: string,
  name: string,
  tier: string
): Promise<Record<string, unknown>> {
  const maxAttempts = tier === "A" ? 60 : tier === "B" ? 50 : 40;
  const delayMs = tier === "C" ? 3000 : 4000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(delayMs);

    try {
      const response = await fetch(`${API_URL}/person/enrichment?request_id=${requestId}`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY!,
          "X-API-Secret": API_SECRET!,
        },
      });

      if (!response.ok) continue;

      const result = await response.json();
      const data = result.data?.result || result.data || {};

      if (result.data?.status === "completed" || data.organizations || data.displayname) {
        console.log(`[API] ✓ Poll completed after ${attempt} attempts`);
        return data;
      }

      if (result.data?.status === "failed") {
        throw new Error(`Poll failed: ${result.data?.error}`);
      }

      if (attempt % 10 === 0) {
        console.log(`[API] Polling... attempt ${attempt}/${maxAttempts}`);
      }
    } catch (error) {
      // Continue polling on errors
    }
  }

  throw new Error(`Poll timeout after ${maxAttempts} attempts`);
}

/**
 * Store VIP data in Supabase with ALL fields properly populated
 */
async function storeInSupabase(
  vip: VIPSeed,
  rawData: Record<string, unknown>,
  credits: number
): Promise<boolean> {
  try {
    // 1. Extract display name
    const displayname = (rawData.displayname as string) ||
      `${rawData.firstname || ""} ${rawData.lastname || ""}`.trim() ||
      vip.name;

    // 2. Extract biography from multiple sources
    const biography = (rawData.summary as string) ||
      (rawData.bio as string) ||
      (rawData.headline as string) || "";

    // 3. Find current organization
    const organizations = (rawData.organizations as Array<Record<string, unknown>>) || [];
    const currentOrg = organizations.find(o =>
      o.endDate === "Present" || (o as Record<string, unknown> & { endDate_formatted?: { is_current?: boolean } }).endDate_formatted?.is_current
    ) || organizations[0];

    const currentRole = (currentOrg?.title as string) || "";
    const organization = (currentOrg?.name as string) || vip.affiliation;

    // 4. Extract newsfeed (raw array)
    const newsfeed = rawData.newsfeed as Array<Record<string, unknown>> | undefined;

    // 5. Extract sample content - top 5 posts for quick reference
    const sampleContent = newsfeed?.slice(0, 5).map(p =>
      ((p.content || p.text) as string) || ""
    ).filter(Boolean) || [];

    // 6. Calculate communication style from newsfeed
    let communicationStyle: string | null = null;
    if (newsfeed && newsfeed.length > 0) {
      const allText = newsfeed.map(p => ((p.content || p.text) as string) || "").join(" ").toLowerCase();
      const wordCount = allText.split(/\s+/).length;
      const avgSentenceLength = wordCount / Math.max(1, (allText.match(/[.!?]/g) || []).length);

      const style = {
        formality: Math.min(0.95, 0.5 + avgSentenceLength / 50),
        emotionality: Math.min(0.9, 0.2 + (allText.match(/!|amazing|excited|thrilled|proud|love|hate|terrible/g) || []).length / 20),
        assertiveness: Math.min(0.9, 0.4 + (allText.match(/\bi\s|\bwe\s|will|must|should|believe|commit/g) || []).length / 30),
      };
      communicationStyle = JSON.stringify(style);
    }

    // 7. Log match confidence
    const probability = rawData.probability as string;
    console.log(`[DB] Storing ${vip.name}...`);
    console.log(`[DB] - Match confidence: ${probability || "unknown"}`);
    console.log(`[DB] - Biography: ${biography.length} chars`);
    console.log(`[DB] - Career entries: ${organizations.length}`);
    console.log(`[DB] - Education entries: ${((rawData.schools_info as unknown[]) || []).length}`);
    console.log(`[DB] - Newsfeed posts: ${newsfeed?.length || 0}`);
    console.log(`[DB] - Sample content: ${sampleContent.length} posts`);
    console.log(`[DB] - Communication style: ${communicationStyle ? "calculated" : "null"}`);

    // 8. Upsert to Supabase - Store ACTUAL raw API response
    await db.insert(vipAgents).values({
      nyneId: vip.id,
      name: displayname,
      vertical: vip.vertical,
      tier: vip.tier,
      domain: vip.domain,
      role: currentRole || vip.role,
      affiliation: organization || vip.affiliation,
      priorityRank: vip.priorityRank,

      // Extracted content
      biography: biography || null,
      sampleContent: sampleContent.length > 0 ? sampleContent : null,
      communicationStyle: communicationStyle,

      // RAW DATA - Store ACTUAL API response for future reprocessing
      nyneRawEnrichment: rawData,
      nyneRawNewsfeed: newsfeed || null,

      // Tracking
      collectionStatus: "complete",
      creditsUsed: credits,
      lastSyncedAt: new Date(),
    }).onConflictDoUpdate({
      target: vipAgents.nyneId,
      set: {
        name: displayname,
        role: currentRole || vip.role,
        affiliation: organization || vip.affiliation,
        biography: biography || null,
        sampleContent: sampleContent.length > 0 ? sampleContent : null,
        communicationStyle: communicationStyle,
        nyneRawEnrichment: rawData,
        nyneRawNewsfeed: newsfeed || null,
        collectionStatus: "complete",
        creditsUsed: credits,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Log the collection
    await db.insert(collectionLog).values({
      vipName: vip.name,
      apiEndpoint: vip.tier === "A" ? "enrichment_with_newsfeed" :
                   vip.tier === "B" ? "enrichment" : "enrichment_lite",
      creditsUsed: credits,
      status: "success",
    });

    console.log(`[DB] ✓ Stored successfully with ${Object.keys(rawData).length} raw fields preserved`);
    return true;

  } catch (error) {
    console.error(`[DB] ✗ Storage error:`, error);
    return false;
  }
}

/**
 * Check if VIP is already collected with complete status
 */
async function isAlreadyCollected(vipId: string): Promise<boolean> {
  const results = await db.select({
    collectionStatus: vipAgents.collectionStatus,
    nyneRawEnrichment: vipAgents.nyneRawEnrichment,
  }).from(vipAgents).where(eq(vipAgents.nyneId, vipId)).limit(1);

  if (results.length === 0) return false;

  const record = results[0];
  return record.collectionStatus === "complete" && !!record.nyneRawEnrichment;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(70));
  console.log("COLLECT ALL VIPs WITH LINKEDIN URLs");
  console.log("=".repeat(70));

  // Get all VIPs with LinkedIn URLs
  const vips = (vipSeedList.vips as VIPSeed[]).filter(v => v.linkedinUrl);

  console.log(`\nFound ${vips.length} VIPs with LinkedIn URLs`);

  // Check which are already collected
  const toCollect: VIPSeed[] = [];
  const alreadyDone: string[] = [];

  for (const vip of vips) {
    if (await isAlreadyCollected(vip.id)) {
      alreadyDone.push(vip.name);
    } else {
      toCollect.push(vip);
    }
  }

  console.log(`\nAlready collected (${alreadyDone.length}): ${alreadyDone.join(", ") || "none"}`);
  console.log(`\nTo collect (${toCollect.length}):`);
  toCollect.forEach(v => console.log(`  - ${v.name} (Tier ${v.tier})`));

  // Calculate expected credits
  const expectedCredits = toCollect.reduce((sum, v) => {
    return sum + (v.tier === "A" ? 12 : v.tier === "B" ? 6 : 3);
  }, 0);
  console.log(`\nExpected credits: ${expectedCredits}`);

  if (toCollect.length === 0) {
    console.log("\nAll VIPs with URLs already collected!");
    await client.end();
    return;
  }

  console.log("\n" + "=".repeat(70));
  console.log("STARTING COLLECTION");
  console.log("=".repeat(70));

  const results: Array<{
    tier: string;
    name: string;
    success: boolean;
    credits: number;
    stored: boolean;
  }> = [];

  for (const vip of toCollect) {
    console.log(`\n${"─".repeat(70)}`);

    const apiResult = await fetchEnrichment(vip);

    if (apiResult.success && apiResult.data) {
      totalCreditsUsed += apiResult.credits;
      const stored = await storeInSupabase(vip, apiResult.data, apiResult.credits);

      results.push({
        tier: vip.tier,
        name: vip.name,
        success: apiResult.success,
        credits: apiResult.credits,
        stored,
      });
    } else {
      results.push({
        tier: vip.tier,
        name: vip.name,
        success: false,
        credits: 0,
        stored: false,
      });
    }

    // Rate limit pause
    await sleep(1000);
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("COLLECTION SUMMARY");
  console.log("=".repeat(70));

  console.log("\n| Tier | Name                        | Credits | API | DB |");
  console.log("|------|-----------------------------|---------|-----|---- |");

  for (const r of results) {
    const name = r.name.substring(0, 27).padEnd(27);
    const credits = String(r.credits).padStart(7);
    const api = r.success ? " ✓ " : " ✗ ";
    const db = r.stored ? " ✓ " : " ✗ ";
    console.log(`|  ${r.tier}   | ${name} | ${credits} | ${api} | ${db} |`);
  }

  const successCount = results.filter(r => r.success && r.stored).length;
  console.log(`\nTotal Credits Used: ${totalCreditsUsed}`);
  console.log(`Successfully Collected: ${successCount}/${results.length}`);

  if (successCount === results.length) {
    console.log("\n✓ ALL VIPS COLLECTED SUCCESSFULLY");
  } else {
    console.log("\n⚠ SOME ERRORS OCCURRED - CHECK ABOVE");
  }

  await client.end();
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
