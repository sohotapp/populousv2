/**
 * Test Full Enrichment - Test one VIP and one company with maximum data capture
 *
 * Run with: npx tsx scripts/test-full-enrichment.ts
 *
 * This script:
 * 1. Collects ONE VIP with full enrichment + newsfeed
 * 2. Collects ONE company with full enrichment
 * 3. Displays ALL captured data fields
 * 4. Shows what would be stored in Supabase
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { getNyneCollector, type VIPSeed } from "../src/lib/collectors/nyne-collector";
import { getCompanyCollector, type CompanySeed } from "../src/lib/collectors/company-collector";

// Test VIP: Satya Nadella (Tier A with LinkedIn URL)
const TEST_VIP: VIPSeed = {
  id: "test-satya-nadella",
  name: "Satya Nadella",
  vertical: "enterprise",
  tier: "A",
  domain: "tech_ceo",
  role: "CEO",
  affiliation: "Microsoft",
  priorityRank: 1,
  apis: ["enrichment", "newsfeed"],
  creditsRequired: 12,
  linkedinUrl: "https://linkedin.com/in/satyanadella",
};

// Test Company: Microsoft (with LinkedIn URL)
const TEST_COMPANY: CompanySeed = {
  id: "test-microsoft",
  name: "Microsoft",
  domain: "microsoft.com",
  linkedinUrl: "https://www.linkedin.com/company/microsoft",
  ticker: "MSFT",
  vertical: "enterprise",
  tier: "A",
  sector: "tech",
  subsector: "cloud",
  priorityRank: 1,
  apis: ["enrichment"],
  creditsRequired: 1,
};

function printDivider(title: string) {
  console.log("\n" + "=".repeat(70));
  console.log(`  ${title}`);
  console.log("=".repeat(70) + "\n");
}

function printSection(title: string) {
  console.log(`\n--- ${title} ---`);
}

function printField(name: string, value: unknown, indent = 0) {
  const prefix = "  ".repeat(indent);
  if (value === undefined || value === null) {
    console.log(`${prefix}${name}: [not provided]`);
  } else if (Array.isArray(value)) {
    if (value.length === 0) {
      console.log(`${prefix}${name}: []`);
    } else if (typeof value[0] === "object") {
      console.log(`${prefix}${name}: [${value.length} items]`);
      value.slice(0, 3).forEach((item, i) => {
        console.log(`${prefix}  [${i}]:`, JSON.stringify(item, null, 2).split("\n").join(`\n${prefix}    `));
      });
      if (value.length > 3) console.log(`${prefix}  ... and ${value.length - 3} more`);
    } else {
      console.log(`${prefix}${name}: [${value.join(", ")}]`);
    }
  } else if (typeof value === "object") {
    console.log(`${prefix}${name}:`, JSON.stringify(value, null, 2).split("\n").join(`\n${prefix}  `));
  } else {
    console.log(`${prefix}${name}: ${value}`);
  }
}

async function testVIPEnrichment() {
  printDivider("VIP ENRICHMENT TEST: " + TEST_VIP.name);

  const collector = getNyneCollector({ creditBudget: 100 });

  console.log("Input:");
  console.log(`  Name: ${TEST_VIP.name}`);
  console.log(`  LinkedIn: ${TEST_VIP.linkedinUrl}`);
  console.log(`  Tier: ${TEST_VIP.tier} (Strategy: Enrichment + Newsfeed = 12 credits)`);

  const result = await collector.collectVIP(TEST_VIP);

  printSection("Collection Result");
  console.log(`  Success: ${result.success}`);
  console.log(`  Credits Used: ${result.creditsUsed}`);
  if (result.error) console.log(`  Error: ${result.error}`);

  if (result.data?.enrichment) {
    printSection("ENRICHMENT DATA");
    const e = result.data.enrichment;
    printField("person_id", e.person_id);
    printField("name", e.name);
    printField("biography", e.biography);
    printField("current_role", e.current_role);
    printField("organization", e.organization);
    printField("location", e.location);
    printField("gender", e.gender);
    printField("headline", e.headline);
    printField("education", e.education);
    printField("career_history", e.career_history);

    printSection("SOCIAL PROFILES");
    if (e.social_profiles) {
      printField("linkedin", e.social_profiles.linkedin);
      printField("twitter", e.social_profiles.twitter);
      printField("github", e.social_profiles.github);
    } else {
      console.log("  [not provided]");
    }

    printSection("CONTACT INFO");
    printField("altemails", e.altemails);
    printField("fullphone", e.fullphone);

    printSection("RAW SCHOOL DATA");
    printField("schools_info", e.schools_info);
  }

  if (result.data?.newsfeed) {
    printSection("NEWSFEED DATA");
    const n = result.data.newsfeed;
    printField("person_id", n.person_id);
    printField("recent_content", n.recent_content);
    printField("communication_style", n.communication_style);
  }

  printSection("RAW API RESPONSE (for Supabase storage)");
  console.log("This is what would be stored in nyne_raw_enrichment:");
  console.log(JSON.stringify(result.data?.enrichment || {}, null, 2).substring(0, 2000) + "...");

  return result;
}

async function testCompanyEnrichment() {
  printDivider("COMPANY ENRICHMENT TEST: " + TEST_COMPANY.name);

  // Reset singleton to get fresh instance
  const collector = getCompanyCollector({ creditBudget: 100 });

  console.log("Input:");
  console.log(`  Name: ${TEST_COMPANY.name}`);
  console.log(`  LinkedIn: ${TEST_COMPANY.linkedinUrl}`);
  console.log(`  Domain: ${TEST_COMPANY.domain}`);
  console.log(`  Credits Required: ${TEST_COMPANY.creditsRequired}`);

  const result = await collector.collectCompany(TEST_COMPANY);

  printSection("Collection Result");
  console.log(`  Success: ${result.success}`);
  console.log(`  Credits Used: ${result.creditsUsed}`);
  if (result.error) console.log(`  Error: ${result.error}`);

  if (result.data?.enrichment) {
    printSection("ENRICHMENT DATA");
    const e = result.data.enrichment;
    printField("company_id", e.company_id);
    printField("linkedin_id", e.linkedin_id);
    printField("name", e.name);
    printField("universal_name", e.universal_name);
    printField("domain", e.domain);
    printField("linkedin_url", e.linkedin_url);
    printField("website_url", e.website_url);
    printField("logo_url", e.logo_url);
    printField("tagline", e.tagline);
    printField("description", e.description?.substring(0, 200) + "...");
    printField("industry", e.industry);
    printField("specialities", e.specialities);
    printField("employee_count", e.employee_count);
    printField("follower_count", e.follower_count);
    printField("employee_count_range", e.employee_count_range);
    printField("headquarter", e.headquarter);
    printField("founded_on", e.founded_on);
    printField("funding", e.funding);
  }

  printSection("RAW API RESPONSE (for Supabase storage)");
  console.log("This is what would be stored in nyne_raw_enrichment:");
  console.log(JSON.stringify(result.data?.enrichment || {}, null, 2).substring(0, 2000) + "...");

  return result;
}

async function main() {
  console.log("=".repeat(70));
  console.log("  RLTX Full Enrichment Test");
  console.log("  Testing maximum data capture from nyne.ai APIs");
  console.log("=".repeat(70));

  // Check API credentials
  if (!process.env.NYNE_API_KEY || !process.env.NYNE_API_SECRET) {
    console.error("\nERROR: NYNE_API_KEY or NYNE_API_SECRET not set in .env.local");
    console.log("Running in MOCK MODE - results will be simulated\n");
  }

  try {
    // Test VIP
    const vipResult = await testVIPEnrichment();

    // Test Company
    const companyResult = await testCompanyEnrichment();

    // Summary
    printDivider("SUMMARY");
    console.log("VIP Collection:");
    console.log(`  Success: ${vipResult.success}`);
    console.log(`  Credits: ${vipResult.creditsUsed}`);
    console.log(`  Data fields: ${Object.keys(vipResult.data || {}).join(", ")}`);

    console.log("\nCompany Collection:");
    console.log(`  Success: ${companyResult.success}`);
    console.log(`  Credits: ${companyResult.creditsUsed}`);
    console.log(`  Data fields: ${Object.keys(companyResult.data || {}).join(", ")}`);

    console.log("\nTotal Credits Used:", vipResult.creditsUsed + companyResult.creditsUsed);

  } catch (error) {
    console.error("\nTest failed:", error);
    process.exit(1);
  }
}

main();
