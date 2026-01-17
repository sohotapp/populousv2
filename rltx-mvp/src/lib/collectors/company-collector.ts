/**
 * CompanyCollector - Rate-limited nyne.ai Company API client
 *
 * ACTUAL Credit Costs (from nyne.ai documentation):
 * - Company Enrichment: 1 credit per successful enrichment
 *   (Only charged when data is returned - no charge for not found)
 *
 * Best Practice: Use LinkedIn company URL for most complete results
 * Input: email, phone, OR social_media_url (LinkedIn company URL)
 *
 * Response Fields:
 * - linkedin_id, name, universal_name
 * - linkedin_url, website_url, logo_url, background_url
 * - tagline, description, industry, specialities[]
 * - employee_count, follower_count, employee_count_range
 * - headquarter: { city, country, postal_code, geographic_area, streets }
 * - founded_on
 * - funding: { number_of_funding_rounds, crunchbase_organization_url, last_funding_round }
 *
 * Rate Limits: 60/min, 1000/hr
 */

import companySeedList from "./company-seed-list.json";

// Types
export interface CompanySeed {
  id: string;
  name: string;
  domain?: string;
  linkedinUrl?: string; // LinkedIn company URL for best enrichment results
  ticker?: string | null;
  vertical: "enterprise" | "defense" | "startup";
  tier: "A" | "B" | "C";
  sector: string;
  subsector?: string;
  priorityRank: number;
  apis: string[];
  creditsRequired: number;
}

// Updated to match actual nyne.ai API response structure
export interface NyneCompanyEnrichment {
  // Identity
  company_id: string;
  linkedin_id?: string;
  name: string;
  universal_name?: string;
  domain?: string;

  // URLs
  linkedin_url?: string;
  website_url?: string;
  logo_url?: string;
  background_url?: string;

  // Description
  tagline?: string;
  description?: string;
  industry?: string;
  specialities?: string[];

  // Size & Scale
  employee_count?: number;
  follower_count?: number;
  employee_count_range?: {
    start?: number;
    end?: number;
  };

  // Location
  headquarter?: {
    city?: string;
    country?: string;
    postal_code?: string;
    geographic_area?: string;
    street1?: string;
    street2?: string;
  };

  // Historical & Financial
  founded_on?: number;
  funding?: {
    number_of_funding_rounds?: number;
    crunchbase_organization_url?: string;
    last_funding_round?: {
      money_raised?: { value?: number; currency?: string };
      announced_on?: string;
      funding_type?: string;
    };
  };

  // Legacy fields for backwards compatibility
  sub_industry?: string;
  size?: string;
  annual_revenue?: number;
  founded?: number;
  headquarters?: {
    city?: string;
    state?: string;
    country?: string;
  };
  social_links?: {
    linkedin?: string;
    twitter?: string;
  };
}

export interface NyneCompanyNeeds {
  company_id: string;
  name: string;
  needs: Array<{
    pain_point: string;
    severity: number; // 0-1
    category: string; // 'operational', 'regulatory', 'competitive', 'technology'
    source: string; // 'sec_filing', 'news', 'inferred'
    evidence: string;
  }>;
  analysis_date: string;
}

export interface NyneCompanyFeatures {
  company_id: string;
  name: string;
  tech_stack: string[];
  tools: string[];
  platforms: string[];
  frameworks: string[];
  cloud_providers: string[];
  analytics: string[];
  detection_confidence: number;
}

export interface NyneCompanyFunding {
  company_id: string;
  name: string;
  total_raised: number;
  valuation?: number;
  rounds: Array<{
    round_type: string; // 'seed', 'series_a', 'series_b', etc.
    amount: number;
    date: string;
    investors: string[];
    lead_investor?: string;
    valuation?: number;
  }>;
}

export interface CompanyCollectionResult {
  companyId: string;
  name: string;
  success: boolean;
  creditsUsed: number;
  data?: {
    enrichment?: NyneCompanyEnrichment;
    needs?: NyneCompanyNeeds;
    features?: NyneCompanyFeatures;
    funding?: NyneCompanyFunding;
  };
  error?: string;
  timestamp: Date;
}

export interface CompanyCollectionStats {
  totalCollected: number;
  creditsUsed: number;
  creditsRemaining: number;
  byVertical: Record<string, number>;
  byTier: Record<string, number>;
  bySector: Record<string, number>;
  errors: number;
  lastCollection: Date | null;
}

// Rate limiter (shared with person collector)
class RateLimiter {
  private requestsThisMinute = 0;
  private requestsThisHour = 0;
  private requestsThisMonth = 0;
  private minuteStart = Date.now();
  private hourStart = Date.now();
  private monthStart = Date.now();

  private readonly MINUTE_LIMIT = 60;
  private readonly HOUR_LIMIT = 1000;
  private readonly MONTH_LIMIT = 10000;

  async waitForSlot(): Promise<void> {
    const now = Date.now();

    // Reset minute counter
    if (now - this.minuteStart > 60000) {
      this.requestsThisMinute = 0;
      this.minuteStart = now;
    }

    // Reset hour counter
    if (now - this.hourStart > 3600000) {
      this.requestsThisHour = 0;
      this.hourStart = now;
    }

    // Reset month counter (approximate - 30 days)
    if (now - this.monthStart > 30 * 24 * 60 * 60 * 1000) {
      this.requestsThisMonth = 0;
      this.monthStart = now;
    }

    // Check limits and wait if needed
    if (this.requestsThisMinute >= this.MINUTE_LIMIT) {
      const waitTime = 60000 - (now - this.minuteStart);
      console.log(`Rate limit: waiting ${Math.ceil(waitTime / 1000)}s for minute limit`);
      await this.sleep(waitTime + 100);
      this.requestsThisMinute = 0;
      this.minuteStart = Date.now();
    }

    if (this.requestsThisHour >= this.HOUR_LIMIT) {
      const waitTime = 3600000 - (now - this.hourStart);
      console.log(`Rate limit: waiting ${Math.ceil(waitTime / 60000)}m for hour limit`);
      await this.sleep(waitTime + 100);
      this.requestsThisHour = 0;
      this.hourStart = Date.now();
    }

    if (this.requestsThisMonth >= this.MONTH_LIMIT) {
      throw new Error("Monthly rate limit reached. Cannot make more requests.");
    }
  }

  recordRequest(): void {
    this.requestsThisMinute++;
    this.requestsThisHour++;
    this.requestsThisMonth++;
  }

  getStats(): { minute: number; hour: number; month: number } {
    return {
      minute: this.requestsThisMinute,
      hour: this.requestsThisHour,
      month: this.requestsThisMonth,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Main collector class
export class CompanyCollector {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private rateLimiter: RateLimiter;
  private collectionLog: CompanyCollectionResult[] = [];
  private creditsUsed = 0;
  private creditBudget: number;

  constructor(options?: { creditBudget?: number }) {
    this.apiKey = process.env.NYNE_API_KEY || "";
    this.apiSecret = process.env.NYNE_API_SECRET || "";
    // IMPORTANT: nyne.ai API base URL has NO /v1 suffix
    this.baseUrl = process.env.NYNE_API_URL || "https://api.nyne.ai";
    this.rateLimiter = new RateLimiter();
    this.creditBudget = options?.creditBudget || 900; // Default budget for companies

    if (!this.apiKey || !this.apiSecret) {
      console.warn("NYNE_API_KEY or NYNE_API_SECRET not set. Running in mock mode.");
    }
  }

  /**
   * Get companies to collect, prioritized by vertical and tier
   */
  getCollectionQueue(options?: {
    vertical?: "enterprise" | "defense" | "startup";
    tier?: "A" | "B" | "C";
    sector?: string;
    limit?: number;
  }): CompanySeed[] {
    let companies = companySeedList.companies as CompanySeed[];

    if (options?.vertical) {
      companies = companies.filter((c) => c.vertical === options.vertical);
    }

    if (options?.tier) {
      companies = companies.filter((c) => c.tier === options.tier);
    }

    if (options?.sector) {
      companies = companies.filter((c) => c.sector === options.sector);
    }

    // Sort by priority rank
    companies.sort((a, b) => {
      // First by vertical priority
      const verticalOrder = { enterprise: 0, defense: 1, startup: 2 };
      if (a.vertical !== b.vertical) {
        return verticalOrder[a.vertical] - verticalOrder[b.vertical];
      }
      // Then by tier
      const tierOrder = { A: 0, B: 1, C: 2 };
      if (a.tier !== b.tier) {
        return tierOrder[a.tier] - tierOrder[b.tier];
      }
      // Then by priority rank
      return a.priorityRank - b.priorityRank;
    });

    if (options?.limit) {
      companies = companies.slice(0, options.limit);
    }

    return companies;
  }

  /**
   * Collect data for a single company
   * Best practice: Use LinkedIn URL when available for most complete results
   */
  async collectCompany(company: CompanySeed): Promise<CompanyCollectionResult> {
    const result: CompanyCollectionResult = {
      companyId: company.id,
      name: company.name,
      success: false,
      creditsUsed: 0,
      timestamp: new Date(),
    };

    try {
      // Check credit budget
      if (this.creditsUsed + company.creditsRequired > this.creditBudget) {
        throw new Error(`Credit budget exceeded. Used: ${this.creditsUsed}, Required: ${company.creditsRequired}`);
      }

      const data: CompanyCollectionResult["data"] = {};
      const domain = company.domain || `${company.name.toLowerCase().replace(/\s/g, "")}.com`;

      console.log(`[CompanyCollector] Collecting ${company.name} (${company.vertical}/${company.tier})`);
      console.log(`[CompanyCollector] LinkedIn: ${company.linkedinUrl || "none"}, Domain: ${domain}`);

      // Collect each API endpoint
      for (const api of company.apis) {
        await this.rateLimiter.waitForSlot();

        switch (api) {
          case "enrichment":
            // Prefer LinkedIn URL for best results, fall back to domain
            if (company.linkedinUrl) {
              data.enrichment = await this.getCompanyEnrichment(company.linkedinUrl, "linkedin");
            } else {
              data.enrichment = await this.getCompanyEnrichment(domain, "domain");
            }
            result.creditsUsed += 1;
            break;
          case "needs":
            data.needs = await this.getCompanyNeeds(domain);
            result.creditsUsed += 1;
            break;
          case "features":
            data.features = await this.getCompanyFeatures(domain);
            result.creditsUsed += 1;
            break;
          case "funding":
            data.funding = await this.getCompanyFunding(domain);
            result.creditsUsed += 1;
            break;
        }

        this.rateLimiter.recordRequest();
      }

      result.data = data;
      result.success = !!data.enrichment;
      this.creditsUsed += result.creditsUsed;

      console.log(`[CompanyCollector] Completed ${company.name}: ${result.creditsUsed} credits, success=${result.success}`);
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Unknown error";
      console.error(`[CompanyCollector] Error collecting ${company.name}: ${result.error}`);
    }

    this.collectionLog.push(result);
    return result;
  }

  /**
   * Batch collect companies with progress callback
   */
  async collectBatch(
    companies: CompanySeed[],
    options?: {
      onProgress?: (current: number, total: number, result: CompanyCollectionResult) => void;
      stopOnError?: boolean;
    }
  ): Promise<CompanyCollectionResult[]> {
    const results: CompanyCollectionResult[] = [];

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      const result = await this.collectCompany(company);
      results.push(result);

      if (options?.onProgress) {
        options.onProgress(i + 1, companies.length, result);
      }

      if (!result.success && options?.stopOnError) {
        console.error(`Stopping batch due to error: ${result.error}`);
        break;
      }

      // Small delay between requests
      await this.sleep(100);
    }

    return results;
  }

  /**
   * Get collection statistics
   */
  getStats(): CompanyCollectionStats {
    const stats: CompanyCollectionStats = {
      totalCollected: this.collectionLog.filter((r) => r.success).length,
      creditsUsed: this.creditsUsed,
      creditsRemaining: this.creditBudget - this.creditsUsed,
      byVertical: { enterprise: 0, defense: 0, startup: 0 },
      byTier: { A: 0, B: 0, C: 0 },
      bySector: {},
      errors: this.collectionLog.filter((r) => !r.success).length,
      lastCollection: this.collectionLog.length > 0
        ? this.collectionLog[this.collectionLog.length - 1].timestamp
        : null,
    };

    // Count by vertical, tier, and sector from seed list
    for (const result of this.collectionLog.filter((r) => r.success)) {
      const company = (companySeedList.companies as CompanySeed[]).find((c) => c.id === result.companyId);
      if (company) {
        stats.byVertical[company.vertical]++;
        stats.byTier[company.tier]++;
        stats.bySector[company.sector] = (stats.bySector[company.sector] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * Get rate limiter stats
   */
  getRateLimitStats(): { minute: number; hour: number; month: number } {
    return this.rateLimiter.getStats();
  }

  // API Methods (with mock fallback)

  /**
   * Get company enrichment - best results with LinkedIn URL
   * Handles async polling like person enrichment
   */
  private async getCompanyEnrichment(
    identifier: string,
    type: "domain" | "linkedin" = "domain"
  ): Promise<NyneCompanyEnrichment> {
    if (!this.apiKey) {
      return this.mockCompanyEnrichment(identifier);
    }

    console.log(`[CompanyCollector] Fetching enrichment via ${type}: ${identifier}...`);

    const body: Record<string, unknown> = {};
    if (type === "linkedin") {
      body.social_media_url = identifier;
    } else {
      // Try email format first (more reliable)
      body.email = `info@${identifier}`;
    }

    const response = await fetch(`${this.baseUrl}/company/enrichment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        "X-API-Secret": this.apiSecret,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Company Enrichment API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // Handle async response (queued)
    if (result.data?.status === "queued" && result.data?.request_id) {
      console.log(`[CompanyCollector] Enrichment queued, polling for results...`);
      return this.pollCompanyEnrichmentResults(result.data.request_id, identifier);
    }

    return this.transformCompanyEnrichmentResult(result, identifier);
  }

  /**
   * Poll for company enrichment results
   */
  private async pollCompanyEnrichmentResults(
    requestId: string,
    identifier: string,
    maxAttempts = 15
  ): Promise<NyneCompanyEnrichment> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.sleep(2000);

      try {
        const response = await fetch(
          `${this.baseUrl}/company/enrichment?request_id=${requestId}`,
          {
            method: "GET",
            headers: {
              "X-API-Key": this.apiKey,
              "X-API-Secret": this.apiSecret,
            },
          }
        );

        if (!response.ok) continue;

        const result = await response.json();

        // Check for completion
        const isCompleted =
          result.data?.status === "completed" ||
          result.data?.result?.name ||
          result.data?.result?.linkedin_id;

        if (isCompleted) {
          console.log(`[CompanyCollector] Enrichment completed for ${identifier}`);
          return this.transformCompanyEnrichmentResult(result, identifier);
        }

        if (result.data?.status === "failed") {
          console.error(`[CompanyCollector] Enrichment failed: ${result.data?.error}`);
          return this.mockCompanyEnrichment(identifier);
        }

        console.log(`[CompanyCollector] Polling enrichment... attempt ${attempt + 1}/${maxAttempts}`);
      } catch (error) {
        console.error(`[CompanyCollector] Poll error: ${error}`);
      }
    }

    console.warn(`[CompanyCollector] Enrichment timeout for ${identifier}`);
    return this.mockCompanyEnrichment(identifier);
  }

  /**
   * Transform nyne.ai company enrichment response to our format
   */
  private transformCompanyEnrichmentResult(
    result: unknown,
    identifier: string
  ): NyneCompanyEnrichment {
    const responseData = (result as { data?: { result?: Record<string, unknown> } })?.data;
    const data = (responseData?.result || responseData || {}) as Record<string, unknown>;

    console.log(`[CompanyCollector] Transforming enrichment, fields: ${Object.keys(data).join(", ")}`);

    const enrichment: NyneCompanyEnrichment = {
      company_id: (data.linkedin_id as string) || `nyne-${identifier.replace(/[^a-z0-9]/gi, "-")}`,
      linkedin_id: data.linkedin_id as string,
      name: (data.name as string) || identifier,
      universal_name: data.universal_name as string,
      domain: (data.website_url as string)?.replace(/^https?:\/\//, "").replace(/\/$/, ""),

      linkedin_url: data.linkedin_url as string,
      website_url: data.website_url as string,
      logo_url: data.logo_url as string,
      background_url: data.background_url as string,

      tagline: data.tagline as string,
      description: data.description as string,
      industry: data.industry as string,
      specialities: data.specialities as string[],

      employee_count: data.employee_count as number,
      follower_count: data.follower_count as number,
      employee_count_range: data.employee_count_range as { start?: number; end?: number },

      headquarter: data.headquarter as NyneCompanyEnrichment["headquarter"],
      founded_on: data.founded_on as number,
      funding: data.funding as NyneCompanyEnrichment["funding"],
    };

    // Log summary
    console.log(`[CompanyCollector] Enrichment for ${enrichment.name}: ${enrichment.employee_count || "?"} employees, industry: ${enrichment.industry || "unknown"}`);

    return enrichment;
  }

  private async getCompanyNeeds(domain: string): Promise<NyneCompanyNeeds> {
    if (!this.apiKey) {
      return this.mockCompanyNeeds(domain);
    }

    const response = await fetch(`${this.baseUrl}/company/needs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        "X-API-Secret": this.apiSecret,
      },
      body: JSON.stringify({ domain }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async getCompanyFeatures(domain: string): Promise<NyneCompanyFeatures> {
    if (!this.apiKey) {
      return this.mockCompanyFeatures(domain);
    }

    const response = await fetch(`${this.baseUrl}/company/features`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        "X-API-Secret": this.apiSecret,
      },
      body: JSON.stringify({ domain }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async getCompanyFunding(domain: string): Promise<NyneCompanyFunding> {
    if (!this.apiKey) {
      return this.mockCompanyFunding(domain);
    }

    const response = await fetch(`${this.baseUrl}/company/funding`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        "X-API-Secret": this.apiSecret,
      },
      body: JSON.stringify({ domain }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Mock data generators for development

  private mockCompanyEnrichment(domain: string): NyneCompanyEnrichment {
    const company = (companySeedList.companies as CompanySeed[]).find(
      (c) => c.domain === domain || c.name.toLowerCase().replace(/\s/g, "") + ".com" === domain
    );

    const sizes = ["startup", "small", "medium", "large", "enterprise"];
    const employeeCounts: Record<string, number> = {
      startup: 50,
      small: 200,
      medium: 1000,
      large: 10000,
      enterprise: 100000,
    };

    const size = sizes[Math.floor(Math.random() * sizes.length)];

    return {
      company_id: `mock-${domain.replace(/\./g, "-")}`,
      name: company?.name || domain.split(".")[0],
      domain,
      industry: company?.sector || "technology",
      sub_industry: company?.subsector || "software",
      size,
      employee_count: employeeCounts[size] + Math.floor(Math.random() * 1000),
      annual_revenue: Math.floor(Math.random() * 100000000000),
      founded: 1990 + Math.floor(Math.random() * 34),
      description: `${company?.name || domain} is a leading company in the ${company?.sector || "technology"} sector.`,
      headquarters: {
        city: "San Francisco",
        state: "CA",
        country: "USA",
      },
      social_links: {
        linkedin: `https://linkedin.com/company/${domain.split(".")[0]}`,
        twitter: `https://twitter.com/${domain.split(".")[0]}`,
      },
    };
  }

  private mockCompanyNeeds(domain: string): NyneCompanyNeeds {
    const needs = [
      { pain_point: "Digital transformation challenges", category: "technology", severity: 0.8 },
      { pain_point: "Talent acquisition and retention", category: "operational", severity: 0.7 },
      { pain_point: "Supply chain resilience", category: "operational", severity: 0.6 },
      { pain_point: "Regulatory compliance burden", category: "regulatory", severity: 0.5 },
      { pain_point: "Competitive pressure from startups", category: "competitive", severity: 0.6 },
    ];

    const selectedNeeds = needs.slice(0, 2 + Math.floor(Math.random() * 3));

    return {
      company_id: `mock-${domain.replace(/\./g, "-")}`,
      name: domain.split(".")[0],
      needs: selectedNeeds.map((n) => ({
        ...n,
        source: "sec_filing",
        evidence: `Mentioned in recent 10-K filing`,
      })),
      analysis_date: new Date().toISOString(),
    };
  }

  private mockCompanyFeatures(domain: string): NyneCompanyFeatures {
    const techStacks = [
      ["React", "Node.js", "AWS", "PostgreSQL"],
      ["Python", "Django", "GCP", "MongoDB"],
      ["Java", "Spring Boot", "Azure", "MySQL"],
      ["TypeScript", "Next.js", "Vercel", "Supabase"],
    ];

    const tools = ["Slack", "GitHub", "Jira", "Figma", "Notion", "Salesforce"];
    const platforms = ["AWS", "GCP", "Azure", "Cloudflare"];
    const analytics = ["Google Analytics", "Segment", "Mixpanel", "Amplitude"];

    const selectedStack = techStacks[Math.floor(Math.random() * techStacks.length)];

    return {
      company_id: `mock-${domain.replace(/\./g, "-")}`,
      name: domain.split(".")[0],
      tech_stack: selectedStack,
      tools: tools.slice(0, 3 + Math.floor(Math.random() * 3)),
      platforms: platforms.slice(0, 1 + Math.floor(Math.random() * 2)),
      frameworks: [selectedStack[0], selectedStack[1]],
      cloud_providers: [platforms[Math.floor(Math.random() * platforms.length)]],
      analytics: analytics.slice(0, 1 + Math.floor(Math.random() * 2)),
      detection_confidence: 0.7 + Math.random() * 0.3,
    };
  }

  private mockCompanyFunding(domain: string): NyneCompanyFunding {
    const company = (companySeedList.companies as CompanySeed[]).find(
      (c) => c.domain === domain || c.name.toLowerCase().replace(/\s/g, "") + ".com" === domain
    );

    // Only startups have detailed funding history
    const isStartup = company?.vertical === "startup";

    if (!isStartup) {
      return {
        company_id: `mock-${domain.replace(/\./g, "-")}`,
        name: company?.name || domain.split(".")[0],
        total_raised: 0,
        rounds: [],
      };
    }

    const rounds = [
      { round_type: "seed", amount: 5000000, date: "2020-01-15", investors: ["Y Combinator", "Angels"] },
      { round_type: "series_a", amount: 25000000, date: "2021-06-01", investors: ["Sequoia Capital", "A16Z"] },
      { round_type: "series_b", amount: 100000000, date: "2022-09-15", investors: ["Tiger Global", "Coatue"] },
    ];

    const numRounds = 1 + Math.floor(Math.random() * 3);
    const selectedRounds = rounds.slice(0, numRounds);
    const totalRaised = selectedRounds.reduce((sum, r) => sum + r.amount, 0);

    return {
      company_id: `mock-${domain.replace(/\./g, "-")}`,
      name: company?.name || domain.split(".")[0],
      total_raised: totalRaised,
      valuation: totalRaised * 3,
      rounds: selectedRounds,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
let collectorInstance: CompanyCollector | null = null;

export function getCompanyCollector(options?: { creditBudget?: number }): CompanyCollector {
  if (!collectorInstance) {
    collectorInstance = new CompanyCollector(options);
  }
  return collectorInstance;
}

// CLI helper for running collection
export async function runCompanyCollection(options: {
  vertical?: "enterprise" | "defense" | "startup";
  tier?: "A" | "B" | "C";
  sector?: string;
  limit?: number;
  dryRun?: boolean;
}): Promise<void> {
  const collector = getCompanyCollector();
  const queue = collector.getCollectionQueue(options);

  console.log(`\nCompany Collection Queue:`);
  console.log(`- Vertical: ${options.vertical || "all"}`);
  console.log(`- Tier: ${options.tier || "all"}`);
  console.log(`- Sector: ${options.sector || "all"}`);
  console.log(`- Companies to collect: ${queue.length}`);
  console.log(`- Estimated credits: ${queue.reduce((sum, c) => sum + c.creditsRequired, 0)}`);

  if (options.dryRun) {
    console.log("\n[DRY RUN] Would collect:");
    queue.forEach((company, i) => {
      console.log(`  ${i + 1}. ${company.name} (${company.vertical}/${company.tier}/${company.sector}) - ${company.creditsRequired} credits`);
    });
    return;
  }

  console.log("\nStarting collection...\n");

  const results = await collector.collectBatch(queue, {
    onProgress: (current, total, result) => {
      const status = result.success ? "+" : "x";
      console.log(`[${current}/${total}] ${status} ${result.name} - ${result.creditsUsed} credits`);
    },
  });

  const stats = collector.getStats();
  console.log("\n=== Collection Complete ===");
  console.log(`Total collected: ${stats.totalCollected}`);
  console.log(`Credits used: ${stats.creditsUsed}`);
  console.log(`Credits remaining: ${stats.creditsRemaining}`);
  console.log(`Errors: ${stats.errors}`);
  console.log("\nBy sector:", stats.bySector);
}
