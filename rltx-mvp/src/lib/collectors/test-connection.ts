/**
 * Test script for nyne.ai API connection
 *
 * Run with: npx tsx src/lib/collectors/test-connection.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { getNyneCollector, type VIPSeed } from "./nyne-collector";

async function testConnection() {
  console.log("\n=== RLTX nyne.ai Connection Test ===\n");

  // Check environment variables
  const apiKey = process.env.NYNE_API_KEY;
  const apiSecret = process.env.NYNE_API_SECRET;

  console.log("1. Checking credentials...");
  if (!apiKey) {
    console.log("   ⚠ NYNE_API_KEY not set - will use mock data");
  } else {
    console.log(`   ✓ NYNE_API_KEY: ${apiKey.substring(0, 8)}...`);
  }
  if (!apiSecret) {
    console.log("   ⚠ NYNE_API_SECRET not set - will use mock data");
  } else {
    console.log(`   ✓ NYNE_API_SECRET: ${apiSecret.substring(0, 4)}...`);
  }

  // Initialize collector
  console.log("\n2. Initializing collector...");
  const collector = getNyneCollector({ creditBudget: 100 }); // Small budget for testing
  console.log("   ✓ Collector initialized");

  // Get collection queue
  console.log("\n3. Loading VIP seed list...");
  const queue = collector.getCollectionQueue({ vertical: "enterprise", tier: "A", limit: 10 });
  console.log(`   ✓ Found ${queue.length} Enterprise Tier A VIPs`);

  // Show first 5
  console.log("\n   Top 5 in queue:");
  queue.slice(0, 5).forEach((vip: VIPSeed, i: number) => {
    console.log(`   ${i + 1}. ${vip.name} (${vip.affiliation}) - ${vip.creditsRequired} credits`);
  });

  // Test collection (dry run or mock)
  console.log("\n4. Testing collection (first VIP only)...");
  const testVip = queue[0];
  console.log(`   Testing: ${testVip.name}`);

  try {
    const result = await collector.collectVIP(testVip);

    if (result.success) {
      console.log(`   ✓ Collection successful!`);
      console.log(`   - Credits used: ${result.creditsUsed}`);

      if (result.data?.interests) {
        console.log(`   - Interests: ${result.data.interests.interests?.length || 0} topics`);
      }
      if (result.data?.newsfeed) {
        console.log(`   - Newsfeed: ${result.data.newsfeed.recent_content?.length || 0} items`);
      }
      if (result.data?.enrichment) {
        console.log(`   - Biography: ${result.data.enrichment.biography?.length || 0} chars`);
      }
    } else {
      console.log(`   ✗ Collection failed: ${result.error}`);
    }
  } catch (error) {
    console.log(`   ✗ Error: ${error}`);
  }

  // Show stats
  console.log("\n5. Collection stats:");
  const stats = collector.getStats();
  console.log(`   - Total collected: ${stats.totalCollected}`);
  console.log(`   - Credits used: ${stats.creditsUsed}`);
  console.log(`   - Credits remaining: ${stats.creditsRemaining}`);
  console.log(`   - Errors: ${stats.errors}`);

  // Rate limit stats
  const rateStats = collector.getRateLimitStats();
  console.log("\n6. Rate limit status:");
  console.log(`   - This minute: ${rateStats.minute}/60`);
  console.log(`   - This hour: ${rateStats.hour}/1000`);
  console.log(`   - This month: ${rateStats.month}/10000`);

  console.log("\n=== Test Complete ===\n");

  // Summary
  if (!apiKey || !apiSecret) {
    console.log("⚠ Running in MOCK mode. Set NYNE_API_KEY and NYNE_API_SECRET to use real API.\n");
  } else {
    console.log("✓ Ready for production collection!\n");
  }
}

// Run test
testConnection().catch(console.error);
