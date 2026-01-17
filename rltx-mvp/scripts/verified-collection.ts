/**
 * VERIFIED COLLECTION - Single API call per VIP, proper Supabase storage
 *
 * Run with: npx tsx scripts/verified-collection.ts
 *
 * CRITICAL: This script makes EXACTLY ONE API call per VIP:
 * - Tier A: person_enrichment with newsfeed add-on = 12 credits
 * - Tier B: person_enrichment = 6 credits
 * - Tier C: person_enrichment_lite = 3 credits
 *
 * NO SEPARATE NEWSFEED CALLS - newsfeed is included in enrichment response
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
 * Returns the enrichment data with newsfeed included (for Tier A)
 */
async function fetchEnrichment(
  vip: VIPSeed
): Promise<{ success: boolean; data: Record<string, unknown> | null; credits: number; error?: string }> {
  const tier = vip.tier;

  // Build request body based on tier
  const body: Record<string, unknown> = {
    social_media_url: vip.linkedinUrl,
    ai_enhanced_search: true,
  };

  // Tier-specific options
  let expectedCredits: number;
  if (tier === "C") {
    body.lite_enrich = true;
    expectedCredits = 3;
  } else if (tier === "A") {
    body.newsfeed = ["linkedin", "twitter"]; // Include newsfeed in same call
    expectedCredits = 12; // 6 enrichment + 6 newsfeed add-on
  } else {
    expectedCredits = 6; // Standard enrichment
  }

  console.log(`\n[API] ${vip.name} (Tier ${tier})`);
  console.log(`[API] LinkedIn: ${vip.linkedinUrl}`);
  console.log(`[API] Expected credits: ${expectedCredits}`);
  console.log(`[API] Making SINGLE call to /person/enrichment...`);

  try {
    // Make the API call
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

    // Handle async (queued) response
    if (result.data?.status === "queued" && result.data?.request_id) {
      console.log(`[API] Request queued, polling...`);
      const pollResult = await pollForResult(result.data.request_id, vip.name, tier);
      return { success: true, data: pollResult, credits: expectedCredits };
    }

    // Direct result
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

      // Check for completion
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
 *
 * CRITICAL: Store the ACTUAL raw API response for future reprocessing
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
      o.endDate === "Present" || (o as any).endDate_formatted?.is_current
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
      nyneRawEnrichment: rawData,  // FULL raw response - preserves ALL fields
      nyneRawNewsfeed: newsfeed || null,  // Raw newsfeed array

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
        nyneRawEnrichment: rawData,  // FULL raw response
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
 * Verify data was stored correctly
 */
async function verifyStorage(vipId: string): Promise<{
  found: boolean;
  hasEnrichment: boolean;
  hasNewsfeed: boolean;
  hasBiography: boolean;
  status: string;
}> {
  const results = await db.select().from(vipAgents).where(eq(vipAgents.nyneId, vipId)).limit(1);

  if (results.length === 0) {
    return { found: false, hasEnrichment: false, hasNewsfeed: false, hasBiography: false, status: "not_found" };
  }

  const record = results[0];
  return {
    found: true,
    hasEnrichment: !!record.nyneRawEnrichment,
    hasNewsfeed: !!record.nyneRawNewsfeed,
    hasBiography: !!record.biography && record.biography.length > 0,
    status: record.collectionStatus || "unknown",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(70));
  console.log("VERIFIED COLLECTION - Single API Call Per VIP");
  console.log("=".repeat(70));

  // Get test VIPs - one from each tier with LinkedIn URL
  const vips = vipSeedList.vips as VIPSeed[];
  const tierA = vips.find(v => v.tier === "A" && v.linkedinUrl);
  const tierB = vips.find(v => v.tier === "B" && v.linkedinUrl);
  const tierC = vips.find(v => v.tier === "C" && v.linkedinUrl);

  if (!tierA || !tierB || !tierC) {
    console.error("ERROR: Could not find VIPs with LinkedIn URLs for all tiers");
    process.exit(1);
  }

  const testVIPs = [tierA, tierB, tierC];
  console.log("\nTest VIPs:");
  testVIPs.forEach(v => console.log(`  Tier ${v.tier}: ${v.name} (${v.affiliation})`));

  console.log("\n" + "=".repeat(70));
  console.log("STARTING COLLECTION");
  console.log("=".repeat(70));

  const results: Array<{
    tier: string;
    name: string;
    success: boolean;
    credits: number;
    stored: boolean;
    verification: Awaited<ReturnType<typeof verifyStorage>>;
  }> = [];

  for (const vip of testVIPs) {
    console.log(`\n${"─".repeat(70)}`);

    // Fetch from API (SINGLE CALL)
    const apiResult = await fetchEnrichment(vip);

    if (apiResult.success && apiResult.data) {
      totalCreditsUsed += apiResult.credits;

      // Store in Supabase
      const stored = await storeInSupabase(vip, apiResult.data, apiResult.credits);

      // Verify storage
      const verification = await verifyStorage(vip.id);

      results.push({
        tier: vip.tier,
        name: vip.name,
        success: apiResult.success,
        credits: apiResult.credits,
        stored,
        verification,
      });
    } else {
      results.push({
        tier: vip.tier,
        name: vip.name,
        success: false,
        credits: 0,
        stored: false,
        verification: { found: false, hasEnrichment: false, hasNewsfeed: false, hasBiography: false, status: "error" },
      });
    }

    // Rate limit pause
    await sleep(1000);
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("COLLECTION SUMMARY");
  console.log("=".repeat(70));

  console.log("\n| Tier | Name                 | Credits | API | DB | Enrichment | Newsfeed | Bio |");
  console.log("|------|----------------------|---------|-----|----| -----------|----------|-----|");

  for (const r of results) {
    const name = r.name.substring(0, 20).padEnd(20);
    const credits = String(r.credits).padStart(7);
    const api = r.success ? " ✓ " : " ✗ ";
    const db = r.stored ? " ✓ " : " ✗ ";
    const enrich = r.verification.hasEnrichment ? "     ✓     " : "     ✗     ";
    const news = r.verification.hasNewsfeed ? "    ✓   " : "    -   ";
    const bio = r.verification.hasBiography ? " ✓  " : " ✗  ";
    console.log(`|  ${r.tier}   | ${name} | ${credits} | ${api} | ${db} | ${enrich} | ${news} | ${bio} |`);
  }

  console.log(`\nTotal Credits Used: ${totalCreditsUsed}`);
  console.log(`Expected: ${12 + 6 + 3} (Tier A: 12, Tier B: 6, Tier C: 3)`);

  const allSuccess = results.every(r => r.success && r.stored && r.verification.hasEnrichment);
  if (allSuccess) {
    console.log("\n✓ ALL VIPS COLLECTED AND STORED SUCCESSFULLY");
  } else {
    console.log("\n✗ SOME ERRORS OCCURRED - CHECK ABOVE");
  }

  await client.end();
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
