/**
 * VERIFY SUPABASE DATA
 * Quick script to check VIP and Company data in Supabase
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";

const connectionString = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: DATABASE_URL not set");
  process.exit(1);
}

const client = postgres(connectionString, { max: 3, idle_timeout: 300 });
const db = drizzle(client);

async function verify() {
  console.log("=".repeat(70));
  console.log("SUPABASE DATA VERIFICATION");
  console.log("=".repeat(70));

  // Check VIP agents
  const vipCount = await db.execute(sql`SELECT COUNT(*) as count FROM vip_agents WHERE collection_status = 'complete'`);
  console.log("\n=== VIP AGENTS ===");
  console.log("Total VIPs collected:", vipCount[0].count);

  const vipSample = await db.execute(sql`
    SELECT name, tier,
           LENGTH(COALESCE(biography, '')) as bio_length,
           CASE WHEN nyne_raw_enrichment IS NOT NULL THEN 'YES' ELSE 'NO' END as has_raw,
           CASE WHEN nyne_raw_newsfeed IS NOT NULL THEN 'YES' ELSE 'NO' END as has_newsfeed,
           CASE WHEN sample_content IS NOT NULL THEN 'YES' ELSE 'NO' END as has_sample,
           credits_used
    FROM vip_agents
    WHERE collection_status = 'complete'
    ORDER BY updated_at DESC
    LIMIT 10
  `);
  console.log("\nMost Recent VIPs:");
  console.table(vipSample);

  // Check Company agents
  const companyCount = await db.execute(sql`SELECT COUNT(*) as count FROM company_agents WHERE collection_status = 'complete'`);
  console.log("\n=== COMPANY AGENTS ===");
  console.log("Total companies collected:", companyCount[0].count);

  const companySample = await db.execute(sql`
    SELECT name, vertical, tier,
           LENGTH(COALESCE(company_description, '')) as desc_length,
           CASE WHEN nyne_raw_enrichment IS NOT NULL THEN 'YES' ELSE 'NO' END as has_raw,
           employee_count,
           credits_used
    FROM company_agents
    WHERE collection_status = 'complete'
    ORDER BY updated_at DESC
    LIMIT 10
  `);
  console.log("\nMost Recent Companies:");
  console.table(companySample);

  // Check raw data quality
  console.log("\n=== RAW DATA QUALITY CHECK ===");

  const vipDataQuality = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN nyne_raw_enrichment IS NOT NULL THEN 1 ELSE 0 END) as with_raw_enrichment,
      SUM(CASE WHEN nyne_raw_newsfeed IS NOT NULL THEN 1 ELSE 0 END) as with_raw_newsfeed,
      SUM(CASE WHEN sample_content IS NOT NULL THEN 1 ELSE 0 END) as with_sample_content,
      SUM(CASE WHEN communication_style IS NOT NULL THEN 1 ELSE 0 END) as with_comm_style
    FROM vip_agents
    WHERE collection_status = 'complete'
  `);
  console.log("\nVIP Data Quality:");
  console.table(vipDataQuality);

  const companyDataQuality = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN nyne_raw_enrichment IS NOT NULL THEN 1 ELSE 0 END) as with_raw_enrichment,
      SUM(CASE WHEN company_description IS NOT NULL AND company_description != '' THEN 1 ELSE 0 END) as with_description,
      SUM(CASE WHEN employee_count IS NOT NULL THEN 1 ELSE 0 END) as with_employee_count,
      SUM(CASE WHEN hq_location IS NOT NULL THEN 1 ELSE 0 END) as with_location
    FROM company_agents
    WHERE collection_status = 'complete'
  `);
  console.log("\nCompany Data Quality:");
  console.table(companyDataQuality);

  await client.end();
}

verify().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
