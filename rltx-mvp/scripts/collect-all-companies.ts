/**
 * COLLECT ALL COMPANIES
 *
 * Run with: npx tsx scripts/collect-all-companies.ts
 * Run batch: npx tsx scripts/collect-all-companies.ts 50  (first 50 only)
 *
 * Company enrichment = 1 credit per company
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { companyAgents, collectionLog } from "../src/db/schema";
import companySeedList from "../src/lib/collectors/company-seed-list.json";

// Types
interface CompanySeed {
  id: string;
  name: string;
  domain: string;
  ticker?: string;
  linkedinUrl: string;
  vertical: string;
  tier: string;
  sector: string;
  subsector: string;
  priorityRank: number;
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
 * Fetch company enrichment - 1 credit per company
 */
async function fetchCompanyEnrichment(
  company: CompanySeed
): Promise<{ success: boolean; data: Record<string, unknown> | null; error?: string }> {
  console.log(`\n[API] ${company.name}`);
  console.log(`[API] LinkedIn: ${company.linkedinUrl}`);

  try {
    const response = await fetch(`${API_URL}/company/enrichment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY!,
        "X-API-Secret": API_SECRET!,
      },
      body: JSON.stringify({
        social_media_url: company.linkedinUrl,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    // Handle async response
    if (result.data?.status === "queued" && result.data?.request_id) {
      console.log(`[API] Request queued, polling...`);
      const pollResult = await pollForResult(result.data.request_id, company.name);
      return { success: true, data: pollResult };
    }

    const data = result.data?.result || result.data || {};
    console.log(`[API] ✓ Got response`);
    return { success: true, data };

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[API] ✗ Error: ${message}`);
    return { success: false, data: null, error: message };
  }
}

/**
 * Poll for async result
 */
async function pollForResult(
  requestId: string,
  name: string
): Promise<Record<string, unknown>> {
  const maxAttempts = 30;
  const delayMs = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(delayMs);

    try {
      const response = await fetch(`${API_URL}/company/enrichment?request_id=${requestId}`, {
        method: "GET",
        headers: {
          "X-API-Key": API_KEY!,
          "X-API-Secret": API_SECRET!,
        },
      });

      if (!response.ok) continue;

      const result = await response.json();
      const data = result.data?.result || result.data || {};

      if (result.data?.status === "completed" || data.name || data.description) {
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
      // Continue polling
    }
  }

  throw new Error(`Poll timeout after ${maxAttempts} attempts`);
}

/**
 * Store company in Supabase using companyAgents table
 */
async function storeInSupabase(
  company: CompanySeed,
  rawData: Record<string, unknown>
): Promise<boolean> {
  try {
    const name = (rawData.name as string) || company.name;
    const description = (rawData.description as string) || "";
    const industry = (rawData.industry as string) || "";
    const employeeCount = rawData.employee_count || rawData.size || null;
    const specialties = (rawData.specialties as string[]) || [];
    const founded = rawData.founded_year || rawData.founded || null;
    const headquarters = rawData.headquarters || rawData.location || null;
    const website = (rawData.website as string) || (rawData.domain as string) || company.domain;

    console.log(`[DB] Storing ${company.name}...`);
    console.log(`[DB] - Description: ${description.length} chars`);
    console.log(`[DB] - Industry: ${industry || "unknown"}`);
    console.log(`[DB] - Employee count: ${employeeCount || "unknown"}`);
    console.log(`[DB] - Specialties: ${specialties.length}`);

    await db.insert(companyAgents).values({
      nyneId: company.id,
      name: name,
      companyDomain: website,
      ticker: company.ticker || null,
      vertical: company.vertical,
      tier: company.tier,
      sector: company.sector,
      subsector: company.subsector,
      priorityRank: company.priorityRank,

      // Extracted fields
      companyDescription: description || null,
      hqLocation: headquarters ? (typeof headquarters === "string" ? headquarters : JSON.stringify(headquarters)) : null,
      employeeCount: typeof employeeCount === "number" ? employeeCount : null,
      founded: typeof founded === "number" ? founded : null,

      // RAW DATA - Store full API response
      nyneRawEnrichment: rawData,

      // Tracking
      collectionStatus: "complete",
      creditsUsed: 1,
      lastSyncedAt: new Date(),
    }).onConflictDoUpdate({
      target: companyAgents.nyneId,
      set: {
        name: name,
        companyDomain: website,
        companyDescription: description || null,
        hqLocation: headquarters ? (typeof headquarters === "string" ? headquarters : JSON.stringify(headquarters)) : null,
        employeeCount: typeof employeeCount === "number" ? employeeCount : null,
        founded: typeof founded === "number" ? founded : null,
        nyneRawEnrichment: rawData,
        collectionStatus: "complete",
        creditsUsed: 1,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await db.insert(collectionLog).values({
      vipName: company.name,
      apiEndpoint: "company_enrichment",
      creditsUsed: 1,
      status: "success",
    });

    console.log(`[DB] ✓ Stored with ${Object.keys(rawData).length} raw fields`);
    return true;

  } catch (error) {
    console.error(`[DB] ✗ Storage error:`, error);
    return false;
  }
}

/**
 * Check if company already collected
 */
async function isAlreadyCollected(companyId: string): Promise<boolean> {
  try {
    const results = await db.select({
      collectionStatus: companyAgents.collectionStatus,
      nyneRawEnrichment: companyAgents.nyneRawEnrichment,
    }).from(companyAgents).where(eq(companyAgents.nyneId, companyId)).limit(1);

    if (results.length === 0) return false;

    const record = results[0];
    return record.collectionStatus === "complete" && !!record.nyneRawEnrichment;
  } catch (error) {
    // Table might not exist or other error - assume not collected
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("=".repeat(70));
  console.log("COLLECT ALL COMPANIES");
  console.log("=".repeat(70));

  const allCompanies = companySeedList.companies as CompanySeed[];
  console.log(`\nTotal companies in seed list: ${allCompanies.length}`);

  // Check which are already collected
  const toCollect: CompanySeed[] = [];
  const alreadyDone: string[] = [];

  for (const company of allCompanies) {
    if (await isAlreadyCollected(company.id)) {
      alreadyDone.push(company.name);
    } else {
      toCollect.push(company);
    }
  }

  console.log(`\nAlready collected: ${alreadyDone.length}`);
  console.log(`To collect: ${toCollect.length}`);
  console.log(`Expected credits: ${toCollect.length} (1 per company)`);

  if (toCollect.length === 0) {
    console.log("\nAll companies already collected!");
    await client.end();
    return;
  }

  // Limit for testing
  const batchSize = parseInt(process.argv[2]) || toCollect.length;
  const batch = toCollect.slice(0, batchSize);

  console.log(`\nCollecting batch of ${batch.length} companies...`);

  console.log("\n" + "=".repeat(70));
  console.log("STARTING COLLECTION");
  console.log("=".repeat(70));

  let successCount = 0;
  let failCount = 0;

  for (const company of batch) {
    console.log(`\n${"─".repeat(70)}`);

    const apiResult = await fetchCompanyEnrichment(company);

    if (apiResult.success && apiResult.data) {
      totalCreditsUsed += 1;
      const stored = await storeInSupabase(company, apiResult.data);
      if (stored) {
        successCount++;
      } else {
        failCount++;
      }
    } else {
      failCount++;
    }

    // Rate limit pause
    await sleep(500);
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("COLLECTION SUMMARY");
  console.log("=".repeat(70));
  console.log(`\nTotal Credits Used: ${totalCreditsUsed}`);
  console.log(`Successfully Collected: ${successCount}/${batch.length}`);
  console.log(`Failed: ${failCount}`);

  if (failCount === 0) {
    console.log("\n✓ ALL COMPANIES COLLECTED SUCCESSFULLY");
  } else {
    console.log("\n⚠ SOME ERRORS OCCURRED");
  }

  await client.end();
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
