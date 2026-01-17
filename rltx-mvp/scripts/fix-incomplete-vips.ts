/**
 * FIX INCOMPLETE VIPs - Re-collect VIPs with "raw" status
 *
 * This script finds VIPs with incomplete data and re-collects them properly.
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { drizzle } from "drizzle-orm/postgres-js";
import { eq, or } from "drizzle-orm";
import postgres from "postgres";
import { vipAgents, collectionLog } from "../src/db/schema";
import vipSeedList from "../src/lib/collectors/vip-seed-list.json";

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

const client = postgres(process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL!, {
  max: 3,
  idle_timeout: 300,
});
const db = drizzle(client);

const API_KEY = process.env.NYNE_API_KEY!;
const API_SECRET = process.env.NYNE_API_SECRET!;
const API_URL = "https://api.nyne.ai";

let totalCreditsUsed = 0;

async function fetchEnrichment(
  vip: VIPSeed
): Promise<{ success: boolean; data: Record<string, unknown> | null; credits: number }> {
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

  console.log(`\n[API] ${vip.name} (Tier ${tier}) - Expected: ${expectedCredits} credits`);

  try {
    const response = await fetch(`${API_URL}/person/enrichment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "X-API-Secret": API_SECRET,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();

    if (result.data?.status === "queued" && result.data?.request_id) {
      console.log(`[API] Polling...`);
      const data = await pollForResult(result.data.request_id, tier);
      return { success: true, data, credits: expectedCredits };
    }

    return { success: true, data: result.data?.result || result.data || {}, credits: expectedCredits };
  } catch (error) {
    console.error(`[API] Error:`, error);
    return { success: false, data: null, credits: 0 };
  }
}

async function pollForResult(requestId: string, tier: string): Promise<Record<string, unknown>> {
  const maxAttempts = tier === "A" ? 60 : tier === "B" ? 50 : 40;
  const delayMs = 4000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, delayMs));

    const response = await fetch(`${API_URL}/person/enrichment?request_id=${requestId}`, {
      headers: { "X-API-Key": API_KEY, "X-API-Secret": API_SECRET },
    });

    if (!response.ok) continue;

    const result = await response.json();
    const data = result.data?.result || result.data || {};

    if (result.data?.status === "completed" || data.organizations || data.displayname) {
      console.log(`[API] ✓ Complete after ${attempt} polls`);
      return data;
    }

    if (attempt % 10 === 0) console.log(`[API] Poll ${attempt}/${maxAttempts}...`);
  }

  throw new Error("Poll timeout");
}

async function updateVIP(vip: VIPSeed, rawData: Record<string, unknown>, credits: number) {
  const displayname = (rawData.displayname as string) ||
    `${rawData.firstname || ""} ${rawData.lastname || ""}`.trim() || vip.name;

  const biography = (rawData.summary as string) || (rawData.bio as string) || (rawData.headline as string) || "";

  const organizations = (rawData.organizations as Array<Record<string, unknown>>) || [];
  const currentOrg = organizations.find(o =>
    o.endDate === "Present" || (o as any).endDate_formatted?.is_current
  ) || organizations[0];

  const newsfeed = rawData.newsfeed as Array<Record<string, unknown>> | undefined;
  const newsfeedData = newsfeed?.length ? {
    person_id: `nyne-${vip.name.toLowerCase().replace(/\s/g, "-")}`,
    name: displayname,
    recent_content: newsfeed.slice(0, 10).map(p => ({
      text: p.content || p.text || "",
      source: p.source || "linkedin",
      date: p.timestamp || new Date().toISOString(),
      engagement: ((p.likes as number) || 0) + ((p.comments as number) || 0),
      sentiment: 0.5,
    })),
    communication_style: { formality: 0.7, emotionality: 0.4, assertiveness: 0.6 }
  } : null;

  const enrichmentData = {
    person_id: `nyne-${vip.name.toLowerCase().replace(/\s/g, "-")}`,
    name: displayname,
    biography,
    current_role: currentOrg?.title || "",
    organization: currentOrg?.name || "",
    location: rawData.location || "",
    altemails: rawData.altemails || [],
    fullphone: rawData.fullphone || [],
    social_profiles: rawData.social_profiles || {},
    career_history: organizations.slice(0, 5).map(o => ({
      role: o.title || "",
      organization: o.name || "",
      years: `${o.startDate || "?"}-${o.endDate || "Present"}`
    })),
    schools_info: rawData.schools_info || [],
    organizations: rawData.organizations || [],
  };

  console.log(`[DB] Updating ${vip.name}...`);
  console.log(`[DB] - Biography: ${biography.substring(0, 50)}...`);
  console.log(`[DB] - Career entries: ${organizations.length}`);
  console.log(`[DB] - Newsfeed posts: ${newsfeed?.length || 0}`);

  await db.update(vipAgents)
    .set({
      name: displayname,
      biography: biography || null,
      role: (currentOrg?.title as string) || vip.role,
      affiliation: (currentOrg?.name as string) || vip.affiliation,
      nyneRawEnrichment: enrichmentData as unknown as Record<string, unknown>,
      nyneRawNewsfeed: newsfeedData as unknown as Record<string, unknown>,
      collectionStatus: "complete",
      creditsUsed: credits,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(vipAgents.nyneId, vip.id));

  await db.insert(collectionLog).values({
    vipName: vip.name,
    apiEndpoint: vip.tier === "A" ? "enrichment_with_newsfeed_FIX" : "enrichment_FIX",
    creditsUsed: credits,
    status: "success",
  });

  console.log(`[DB] ✓ Updated`);
}

async function main() {
  console.log("=".repeat(70));
  console.log("FIX INCOMPLETE VIPs");
  console.log("=".repeat(70));

  // Find VIPs with "raw" status
  const incomplete = await db.select({
    nyneId: vipAgents.nyneId,
    name: vipAgents.name,
    tier: vipAgents.tier,
  }).from(vipAgents).where(
    or(
      eq(vipAgents.collectionStatus, "raw"),
      eq(vipAgents.collectionStatus, "partial")
    )
  );

  console.log(`\nFound ${incomplete.length} incomplete VIPs:`);
  incomplete.forEach(v => console.log(`  - ${v.name} (Tier ${v.tier})`));

  if (incomplete.length === 0) {
    console.log("\nNo incomplete VIPs to fix!");
    await client.end();
    return;
  }

  // Get seed data for these VIPs
  const vips = vipSeedList.vips as VIPSeed[];

  for (const inc of incomplete) {
    const vip = vips.find(v => v.id === inc.nyneId);
    if (!vip || !vip.linkedinUrl) {
      console.log(`\nSkipping ${inc.name} - no LinkedIn URL`);
      continue;
    }

    console.log(`\n${"─".repeat(70)}`);

    const result = await fetchEnrichment(vip);

    if (result.success && result.data) {
      await updateVIP(vip, result.data, result.credits);
      totalCreditsUsed += result.credits;
    } else {
      console.error(`[ERROR] Failed to collect ${vip.name}`);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log("\n" + "=".repeat(70));
  console.log("FIX COMPLETE");
  console.log(`Total credits used: ${totalCreditsUsed}`);
  console.log("=".repeat(70));

  await client.end();
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
