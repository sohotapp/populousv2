/**
 * Verify Supabase Data
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { vipAgents } from "../src/db/schema";

const client = postgres(process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

async function verify() {
  const results = await db.select({
    id: vipAgents.id,
    nyneId: vipAgents.nyneId,
    name: vipAgents.name,
    tier: vipAgents.tier,
    vertical: vipAgents.vertical,
    biography: vipAgents.biography,
    status: vipAgents.collectionStatus,
    credits: vipAgents.creditsUsed,
    hasEnrichment: vipAgents.nyneRawEnrichment,
    hasNewsfeed: vipAgents.nyneRawNewsfeed,
    lastSynced: vipAgents.lastSyncedAt,
  }).from(vipAgents).limit(20);

  console.log("\n" + "=".repeat(100));
  console.log("VIP_AGENTS TABLE - VERIFICATION");
  console.log("=".repeat(100));

  for (const r of results) {
    const hasEnrich = r.hasEnrichment ? "YES" : "NO";
    const hasNews = r.hasNewsfeed ? "YES" : "NO";
    const bio = r.biography ? r.biography.substring(0, 60) + "..." : "[NULL]";

    console.log(`\n${r.name} (Tier ${r.tier}, ${r.vertical})`);
    console.log(`  Nyne ID: ${r.nyneId}`);
    console.log(`  Status: ${r.status}`);
    console.log(`  Credits Used: ${r.credits}`);
    console.log(`  Has Enrichment Data: ${hasEnrich}`);
    console.log(`  Has Newsfeed Data: ${hasNews}`);
    console.log(`  Biography: ${bio}`);
    console.log(`  Last Synced: ${r.lastSynced}`);
  }

  console.log("\n" + "=".repeat(100));
  console.log(`Total records in vip_agents: ${results.length}`);
  console.log("=".repeat(100));

  await client.end();
}

verify().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
