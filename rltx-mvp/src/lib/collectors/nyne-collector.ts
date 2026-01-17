/**
 * NyneCollector - Rate-limited nyne.ai API client for VIP data collection
 *
 * Rate Limits:
 * - 60 requests/minute
 * - 1000 requests/hour
 * - 10000 requests/month
 *
 * ACTUAL Credit Costs (from nyne.ai documentation):
 * - Person Enrichment: 6 credits
 * - Lite Enrichment: 3 credits (basic profile only)
 * - Person Newsfeed: 6 credits (standalone)
 * - Enrichment + Newsfeed add-on: 12 credits total
 * - Person Search: 1-5+ credits (DON'T USE for known VIPs with LinkedIn URLs)
 *
 * OPTIMAL STRATEGY (per founder guidance):
 * - For known VIPs: Use direct enrichment with LinkedIn URL (skip search)
 * - Tier A: Enrichment + newsfeed add-on = 12 credits
 * - Tier B: Enrichment only = 6 credits
 * - Tier C: Lite enrichment = 3 credits
 */

import vipSeedList from "./vip-seed-list.json";

// Types
export interface VIPSeed {
  id: string;
  name: string;
  vertical: "enterprise" | "political" | "defense";
  tier: "A" | "B" | "C";
  domain: string;
  role: string;
  affiliation: string;
  priorityRank: number;
  apis: string[];
  creditsRequired: number;
  // Social media identifiers for nyne.ai lookup
  linkedinUrl?: string;
  twitterHandle?: string;
  email?: string;
}

export interface NyneInterests {
  person_id: string;
  name: string;
  interests: Array<{
    topic: string;
    weight: number;
    category: string;
  }>;
  engagement_patterns: {
    peak_times: string[];
    preferred_platforms: string[];
  };
}

export interface NyneNewsfeed {
  person_id: string;
  name: string;
  recent_content: Array<{
    text: string;
    source: string;
    date: string;
    engagement: number;
    sentiment: number;
  }>;
  communication_style: {
    formality: number;
    emotionality: number;
    assertiveness: number;
  };
}

export interface NyneEnrichment {
  person_id: string;
  name: string;
  biography: string;
  current_role: string;
  organization: string;
  education: string[];
  career_history: Array<{
    role: string;
    organization: string;
    years: string;
  }>;

  // Additional fields from nyne.ai API (preserved for simulation use)
  location?: string;
  gender?: string;
  probability?: "high" | "medium" | "low" | "unknown";
  headline?: string;
  summary?: string;

  // Contact info (if available)
  altemails?: string[];
  fullphone?: Array<{ fullphone: string; type: string }>;

  // Social profiles with engagement metrics
  social_profiles?: {
    linkedin?: {
      url?: string;
      username?: string;
      followers?: number;
      connections?: number;
    };
    twitter?: {
      url?: string;
      username?: string;
      followers?: number;
      following?: number;
      posts?: number;
    };
    github?: {
      url?: string;
      username?: string;
      followers?: number;
    };
  };

  // Raw schools data (for more detailed education info)
  schools_info?: Array<{
    name?: string;
    degree?: string;
    title?: string;
    fieldOfStudy?: string;
    startDate?: string;
    endDate?: string;
  }>;

  // Raw organizations data (for more detailed career info)
  organizations?: Array<{
    name?: string;
    title?: string;
    startDate?: string;
    endDate?: string;
    startDate_formatted?: { year?: number; month?: number; is_current?: boolean };
    endDate_formatted?: { year?: number; month?: number; is_current?: boolean };
  }>;
}

export interface NyneSocialProfiles {
  person_id: string;
  name: string;
  profiles: Array<{
    platform: string;
    username: string;
    followers: number;
    verified: boolean;
  }>;
}

export interface CollectionResult {
  vipId: string;
  name: string;
  success: boolean;
  creditsUsed: number;
  data?: {
    interests?: NyneInterests;
    newsfeed?: NyneNewsfeed;
    enrichment?: NyneEnrichment;
    social?: NyneSocialProfiles;
  };
  error?: string;
  timestamp: Date;
}

export interface CollectionStats {
  totalCollected: number;
  creditsUsed: number;
  creditsRemaining: number;
  byVertical: Record<string, number>;
  byTier: Record<string, number>;
  errors: number;
  lastCollection: Date | null;
}

// Rate limiter class
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
export class NyneCollector {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private rateLimiter: RateLimiter;
  private collectionLog: CollectionResult[] = [];
  private creditsUsed = 0;
  private creditBudget: number;

  constructor(options?: { creditBudget?: number }) {
    this.apiKey = process.env.NYNE_API_KEY || "";
    this.apiSecret = process.env.NYNE_API_SECRET || "";
    // IMPORTANT: nyne.ai API base URL has no /v1 suffix
    this.baseUrl = process.env.NYNE_API_URL || "https://api.nyne.ai";
    this.rateLimiter = new RateLimiter();
    this.creditBudget = options?.creditBudget || 9000;

    if (!this.apiKey || !this.apiSecret) {
      console.warn("NYNE_API_KEY or NYNE_API_SECRET not set. Running in mock mode.");
    }
  }

  /**
   * Get VIPs to collect, prioritized by vertical and tier
   */
  getCollectionQueue(options?: {
    vertical?: "enterprise" | "political" | "defense";
    tier?: "A" | "B" | "C";
    limit?: number;
  }): VIPSeed[] {
    let vips = vipSeedList.vips as VIPSeed[];

    if (options?.vertical) {
      vips = vips.filter((v) => v.vertical === options.vertical);
    }

    if (options?.tier) {
      vips = vips.filter((v) => v.tier === options.tier);
    }

    // Sort by priority rank within each vertical
    vips.sort((a, b) => {
      // First by vertical priority
      const verticalOrder = { enterprise: 0, political: 1, defense: 2 };
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
      vips = vips.slice(0, options.limit);
    }

    return vips;
  }

  /**
   * Get the credit cost for a VIP tier based on optimal strategy
   */
  private getCreditsForTier(tier: "A" | "B" | "C"): number {
    switch (tier) {
      case "A": return 12; // enrichment (6) + newsfeed add-on (6)
      case "B": return 6;  // enrichment only
      case "C": return 3;  // lite enrichment
    }
  }

  /**
   * Get tier-based polling configuration
   * Higher tiers get more patience (longer timeout, more retries)
   *
   * nyne.ai API can take 60-120+ seconds for some VIPs, so we need patience
   */
  private getPollConfig(tier: "A" | "B" | "C"): {
    maxAttempts: number;
    delayMs: number;
    maxRetries: number;
    description: string;
  } {
    switch (tier) {
      case "A":
        return {
          maxAttempts: 60,  // 60 * 4s = 240 seconds (4 min) timeout
          delayMs: 4000,    // 4 second delay between polls
          maxRetries: 3,    // Up to 3 retry attempts
          description: "Tier A: Patient polling (240s timeout, 3 retries)"
        };
      case "B":
        return {
          maxAttempts: 50,  // 50 * 4s = 200 seconds (3.3 min) timeout
          delayMs: 4000,    // 4 second delay
          maxRetries: 2,    // Up to 2 retry attempts
          description: "Tier B: Standard polling (200s timeout, 2 retries)"
        };
      case "C":
        return {
          maxAttempts: 40,  // 40 * 3s = 120 seconds (2 min) timeout
          delayMs: 3000,    // 3 second delay
          maxRetries: 2,    // 2 retries
          description: "Tier C: Standard polling (120s timeout, 2 retries)"
        };
    }
  }

  /**
   * Validate that collected data meets tier requirements
   * Returns true if data is complete enough for the tier
   * Detects mock data and marks as incomplete so retries are triggered
   */
  private isDataComplete(result: CollectionResult, tier: "A" | "B" | "C"): {
    complete: boolean;
    missing: string[];
    score: number;
    isMockData: boolean;
  } {
    const missing: string[] = [];
    let score = 0;
    const maxScore = tier === "A" ? 10 : tier === "B" ? 6 : 3;

    if (!result.data?.enrichment) {
      return { complete: false, missing: ["enrichment"], score: 0, isMockData: false };
    }

    const e = result.data.enrichment;

    // Detect mock data - mock person_ids start with "mock-"
    const isMockData = e.person_id?.startsWith("mock-") || false;
    if (isMockData) {
      console.log(`[NyneCollector] Detected mock data for ${result.name} - will retry if possible`);
      return { complete: false, missing: ["real_data"], score: 0, isMockData: true };
    }

    // Check name (required for all tiers)
    if (e.name && e.name.length > 0) {
      score += 1;
    } else {
      missing.push("name");
    }

    // Check biography
    if (e.biography && e.biography.length > 10) {
      score += 1;
    } else if (tier !== "C") {
      missing.push("biography");
    }

    // Check career history (important for A and B)
    if (e.career_history && e.career_history.length > 0) {
      score += 2;
    } else if (tier !== "C") {
      missing.push("career_history");
    }

    // Check education
    if (e.education && e.education.length > 0) {
      score += 1;
    } else if (tier === "A") {
      missing.push("education");
    }

    // Check social profiles (important for A)
    if (e.social_profiles && Object.keys(e.social_profiles).length > 0) {
      score += 1;
    } else if (tier === "A") {
      missing.push("social_profiles");
    }

    // Check current role/organization
    if (e.current_role && e.current_role.length > 0) {
      score += 1;
    } else if (tier !== "C") {
      missing.push("current_role");
    }

    if (e.organization && e.organization.length > 0) {
      score += 1;
    } else if (tier !== "C") {
      missing.push("organization");
    }

    // For Tier A, also check newsfeed
    if (tier === "A") {
      if (result.data.newsfeed?.recent_content && result.data.newsfeed.recent_content.length > 0) {
        score += 2;
      } else {
        missing.push("newsfeed");
      }
    }

    // Determine if complete based on tier
    const minScore = tier === "A" ? 7 : tier === "B" ? 4 : 2;
    const complete = score >= minScore;

    return { complete, missing, score, isMockData: false };
  }

  /**
   * Collect VIP with automatic retry on incomplete data
   * Uses tier-based configuration for timeout and retry attempts
   * Will retry if:
   * - Collection failed
   * - Got mock data instead of real data (timeout)
   * - Data is incomplete for the tier
   */
  async collectVIPWithRetry(vip: VIPSeed): Promise<CollectionResult> {
    const config = this.getPollConfig(vip.tier);
    let lastResult: CollectionResult | null = null;
    let bestResult: CollectionResult | null = null;
    let bestScore = -1;
    let gotRealData = false;

    console.log(`[NyneCollector] ${config.description}`);

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      if (attempt > 0) {
        // Longer backoff for mock data (API might be overwhelmed)
        const backoffMs = 10000 * Math.pow(2, attempt - 1); // Exponential backoff: 10s, 20s, 40s
        console.log(`[NyneCollector] Retry ${attempt}/${config.maxRetries} for ${vip.name} (waiting ${backoffMs/1000}s)...`);
        await this.sleep(backoffMs);
      }

      const result = await this.collectVIP(vip, config);
      lastResult = result;

      if (result.success) {
        const validation = this.isDataComplete(result, vip.tier);

        // Track the best result we've seen (prefer real data over mock)
        if (!validation.isMockData && validation.score > bestScore) {
          bestScore = validation.score;
          bestResult = result;
          gotRealData = true;
        }

        if (validation.complete && !validation.isMockData) {
          console.log(`[NyneCollector] ✓ Real data complete for ${vip.name} (score: ${validation.score})`);
          return result;
        } else if (validation.isMockData) {
          console.log(`[NyneCollector] ⚠ Got mock data for ${vip.name} (API timeout) - will retry`);
        } else {
          console.log(`[NyneCollector] ⚠ Incomplete data for ${vip.name} (score: ${validation.score}, missing: ${validation.missing.join(", ")})`);
        }
      } else {
        console.log(`[NyneCollector] ✗ Collection failed for ${vip.name}: ${result.error}`);
      }
    }

    // Return best result we got, even if incomplete
    if (bestResult && gotRealData) {
      console.log(`[NyneCollector] Returning best real data for ${vip.name} (score: ${bestScore})`);
      return bestResult;
    }

    // If we only got mock data, still return it but log a warning
    if (lastResult) {
      console.log(`[NyneCollector] ⚠ Returning mock data for ${vip.name} after ${config.maxRetries + 1} attempts`);
    }

    return lastResult!;
  }

  /**
   * Collect data for a single VIP using the OPTIMAL API flow:
   *
   * For VIPs WITH LinkedIn URL (most cases):
   * - Skip search entirely (per founder guidance)
   * - Use direct enrichment with social_media_url
   * - Tier A: Include newsfeed add-on (12 credits)
   * - Tier B: Enrichment only (6 credits)
   * - Tier C: Lite enrichment (3 credits)
   *
   * For VIPs WITHOUT LinkedIn URL (rare):
   * - Use search as last resort to discover profile
   *
   * @param vip - The VIP seed data
   * @param pollConfig - Optional tier-based polling configuration (for retry scenarios)
   */
  async collectVIP(
    vip: VIPSeed,
    pollConfig?: { maxAttempts: number; delayMs: number }
  ): Promise<CollectionResult> {
    const expectedCredits = this.getCreditsForTier(vip.tier);
    // Use provided config or get default for tier
    const config = pollConfig || this.getPollConfig(vip.tier);

    const result: CollectionResult = {
      vipId: vip.id,
      name: vip.name,
      success: false,
      creditsUsed: 0,
      timestamp: new Date(),
    };

    try {
      // Check credit budget with accurate tier-based cost
      if (this.creditsUsed + expectedCredits > this.creditBudget) {
        throw new Error(`Credit budget exceeded. Used: ${this.creditsUsed}, Required: ${expectedCredits}`);
      }

      const data: CollectionResult["data"] = {};

      // Build social media URL - prefer LinkedIn, fall back to Twitter
      let socialUrl = vip.linkedinUrl;
      const twitterUrl = vip.twitterHandle ? `https://x.com/${vip.twitterHandle}` : undefined;

      console.log(`[NyneCollector] Collecting ${vip.name} (${vip.vertical}/${vip.tier})`);
      console.log(`[NyneCollector] LinkedIn: ${socialUrl || "none"}, Twitter: ${twitterUrl || "none"}`);
      console.log(`[NyneCollector] Strategy: ${vip.tier === "A" ? "Enrichment+Newsfeed (12 cr)" : vip.tier === "B" ? "Enrichment (6 cr)" : "Lite (3 cr)"}`);
      console.log(`[NyneCollector] Poll config: ${config.maxAttempts} attempts, ${config.delayMs}ms delay`);

      // OPTIMAL FLOW: If we have LinkedIn URL, use direct enrichment (skip search)
      if (socialUrl || vip.email) {
        // Determine enrichment options based on tier
        const includeNewsfeed = vip.tier === "A";
        const liteMode = vip.tier === "C";

        await this.rateLimiter.waitForSlot();
        const enrichmentResult = await this.getPersonEnrichmentOptimized(
          vip.name,
          socialUrl,
          vip.email,
          { includeNewsfeed, liteMode, pollConfig: config }
        );
        this.rateLimiter.recordRequest();

        data.enrichment = enrichmentResult.enrichment;

        // Newsfeed is included in enrichment response for Tier A
        if (enrichmentResult.newsfeed) {
          data.newsfeed = enrichmentResult.newsfeed;
        }

        // Track actual credits based on tier
        result.creditsUsed = expectedCredits;
      }
      // FALLBACK: No LinkedIn URL - use search to discover (rare case)
      else if (twitterUrl) {
        console.log(`[NyneCollector] No LinkedIn URL, trying Twitter for enrichment...`);
        await this.rateLimiter.waitForSlot();
        const enrichmentResult = await this.getPersonEnrichmentOptimized(
          vip.name,
          twitterUrl,
          undefined,
          { includeNewsfeed: vip.tier === "A", liteMode: vip.tier === "C", pollConfig: config }
        );
        this.rateLimiter.recordRequest();

        data.enrichment = enrichmentResult.enrichment;
        if (enrichmentResult.newsfeed) {
          data.newsfeed = enrichmentResult.newsfeed;
        }
        result.creditsUsed = expectedCredits;
      }
      // LAST RESORT: No social URLs at all - use search
      else {
        console.log(`[NyneCollector] No social URLs, using search as fallback...`);
        await this.rateLimiter.waitForSlot();
        const searchResult = await this.searchForPerson(vip);
        this.rateLimiter.recordRequest();
        result.creditsUsed += 5; // Premium search cost

        if (searchResult?.linkedinUrl) {
          socialUrl = searchResult.linkedinUrl;
          console.log(`[NyneCollector] Discovered LinkedIn URL: ${socialUrl}`);

          // Now do enrichment with discovered URL
          await this.rateLimiter.waitForSlot();
          const enrichmentResult = await this.getPersonEnrichmentOptimized(
            vip.name,
            socialUrl,
            undefined,
            { includeNewsfeed: vip.tier === "A", liteMode: vip.tier === "C", pollConfig: config }
          );
          this.rateLimiter.recordRequest();

          data.enrichment = enrichmentResult.enrichment;
          if (enrichmentResult.newsfeed) {
            data.newsfeed = enrichmentResult.newsfeed;
          }
          result.creditsUsed += expectedCredits;
        }

        data.interests = searchResult?.interests || this.mockPersonInterests(vip.name);
      }

      result.data = data;
      result.success = !!data.enrichment || !!data.interests;
      this.creditsUsed += result.creditsUsed;

      console.log(`[NyneCollector] Completed ${vip.name}: ${result.creditsUsed} credits, success=${result.success}`);
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Unknown error";
      console.error(`[NyneCollector] Error collecting ${vip.name}: ${result.error}`);
    }

    this.collectionLog.push(result);
    return result;
  }

  /**
   * Search for a person using nyne.ai Person Search API
   * Returns LinkedIn URL and interests if found
   */
  private async searchForPerson(vip: VIPSeed): Promise<{ linkedinUrl?: string; interests?: NyneInterests } | null> {
    if (!this.apiKey) {
      return { interests: this.mockPersonInterests(vip.name) };
    }

    // Split name into first/last for custom filters
    const nameParts = vip.name.split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

    // Build search query and filters
    const searchPayload = {
      query: `${vip.name} ${vip.role} at ${vip.affiliation}`,
      limit: 5,
      type: "premium",
      show_emails: true,
      insights: true,
      custom_filters: {
        first_name: firstName,
        last_name: lastName,
        companies: [vip.affiliation],
        titles: [vip.role],
      },
    };

    console.log(`[NyneCollector] Search query: "${searchPayload.query}"`);

    try {
      const response = await fetch(`${this.baseUrl}/person/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.apiKey,
          "X-API-Secret": this.apiSecret,
        },
        body: JSON.stringify(searchPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[NyneCollector] Search API error: ${response.status} - ${errorText}`);
        return { interests: this.mockPersonInterests(vip.name) };
      }

      const result = await response.json();

      // Handle async response (queued)
      if (result.data?.status === "queued" && result.data?.request_id) {
        console.log(`[NyneCollector] Search queued, polling for results...`);
        return this.pollSearchResultsV2(result.data.request_id, vip.name);
      }

      // Handle direct results
      return this.extractFromSearchResults(result, vip.name);
    } catch (error) {
      console.error(`[NyneCollector] Search error: ${error}`);
      return { interests: this.mockPersonInterests(vip.name) };
    }
  }

  /**
   * Poll for async search results (v2 with LinkedIn extraction)
   */
  private async pollSearchResultsV2(requestId: string, name: string, maxAttempts = 10): Promise<{ linkedinUrl?: string; interests?: NyneInterests } | null> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.sleep(2000);

      try {
        const response = await fetch(`${this.baseUrl}/person/search?request_id=${requestId}`, {
          method: "GET",
          headers: {
            "X-API-Key": this.apiKey,
            "X-API-Secret": this.apiSecret,
          },
        });

        if (!response.ok) continue;

        const result = await response.json();

        if (result.data?.status === "completed" || result.data?.results) {
          return this.extractFromSearchResults(result, name);
        }

        if (result.data?.status === "failed") {
          console.error(`[NyneCollector] Search failed: ${result.data?.error}`);
          return { interests: this.mockPersonInterests(name) };
        }

        console.log(`[NyneCollector] Polling search... attempt ${attempt + 1}/${maxAttempts}`);
      } catch (error) {
        console.error(`[NyneCollector] Poll error: ${error}`);
      }
    }

    console.warn(`[NyneCollector] Search timeout for ${name}`);
    return { interests: this.mockPersonInterests(name) };
  }

  /**
   * Extract LinkedIn URL and interests from search results
   */
  private extractFromSearchResults(result: unknown, name: string): { linkedinUrl?: string; interests?: NyneInterests } {
    const data = (result as { data?: { results?: Array<Record<string, unknown>> } })?.data;
    const results = data?.results || [];

    let linkedinUrl: string | undefined;
    const interests: NyneInterests["interests"] = [];

    // Find the best match and extract data
    for (const person of results) {
      // Extract LinkedIn URL from social_profiles or direct linkedin field
      if (!linkedinUrl) {
        const socialProfiles = person.social_profiles as Array<{ url?: string; platform?: string }> | undefined;
        if (socialProfiles) {
          const linkedin = socialProfiles.find((p) => p.platform === "linkedin" || p.url?.includes("linkedin"));
          if (linkedin?.url) {
            linkedinUrl = linkedin.url;
          }
        }
        // Also check direct linkedin_url field
        if (!linkedinUrl && person.linkedin_url) {
          linkedinUrl = person.linkedin_url as string;
        }
      }

      // Extract interests from insights or headline
      const insights = person.insights as { topics?: string[]; interests?: string[] } | undefined;
      if (insights?.topics) {
        for (const topic of insights.topics) {
          interests.push({ topic, weight: 0.8, category: "professional" });
        }
      }
      if (insights?.interests) {
        for (const interest of insights.interests) {
          interests.push({ topic: interest, weight: 0.7, category: "personal" });
        }
      }
    }

    return {
      linkedinUrl,
      interests: {
        person_id: `nyne-${name.toLowerCase().replace(/\s/g, "-")}`,
        name,
        interests: interests.length > 0 ? interests : this.mockPersonInterests(name).interests,
        engagement_patterns: {
          peak_times: ["09:00", "14:00", "20:00"],
          preferred_platforms: ["linkedin", "twitter"],
        },
      },
    };
  }

  /**
   * Batch collect VIPs with progress callback
   *
   * @param vips - Array of VIP seeds to collect
   * @param options.onProgress - Callback for progress updates
   * @param options.stopOnError - Stop batch on first error
   * @param options.useRetry - Use retry logic with data validation (default: true)
   */
  async collectBatch(
    vips: VIPSeed[],
    options?: {
      onProgress?: (current: number, total: number, result: CollectionResult) => void;
      stopOnError?: boolean;
      useRetry?: boolean;
    }
  ): Promise<CollectionResult[]> {
    const results: CollectionResult[] = [];
    const useRetry = options?.useRetry !== false; // Default to true

    console.log(`[NyneCollector] Starting batch collection of ${vips.length} VIPs (retry=${useRetry})`);

    for (let i = 0; i < vips.length; i++) {
      const vip = vips[i];

      // Use retry wrapper by default for better data quality
      const result = useRetry
        ? await this.collectVIPWithRetry(vip)
        : await this.collectVIP(vip);

      results.push(result);

      if (options?.onProgress) {
        options.onProgress(i + 1, vips.length, result);
      }

      if (!result.success && options?.stopOnError) {
        console.error(`Stopping batch due to error: ${result.error}`);
        break;
      }

      // Small delay between VIPs to be nice to the API
      await this.sleep(500);
    }

    return results;
  }

  /**
   * Get collection statistics
   */
  getStats(): CollectionStats {
    const stats: CollectionStats = {
      totalCollected: this.collectionLog.filter((r) => r.success).length,
      creditsUsed: this.creditsUsed,
      creditsRemaining: this.creditBudget - this.creditsUsed,
      byVertical: { enterprise: 0, political: 0, defense: 0 },
      byTier: { A: 0, B: 0, C: 0 },
      errors: this.collectionLog.filter((r) => !r.success).length,
      lastCollection: this.collectionLog.length > 0
        ? this.collectionLog[this.collectionLog.length - 1].timestamp
        : null,
    };

    // Count by vertical and tier from seed list
    for (const result of this.collectionLog.filter((r) => r.success)) {
      const vip = (vipSeedList.vips as VIPSeed[]).find((v) => v.id === result.vipId);
      if (vip) {
        stats.byVertical[vip.vertical]++;
        stats.byTier[vip.tier]++;
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
   * OPTIMIZED: Get person enrichment with optional newsfeed in single API call
   *
   * This is the recommended approach per nyne.ai founder guidance:
   * - Use social_media_url directly (skip search for known VIPs)
   * - Include newsfeed add-on for Tier A (costs +6 credits but avoids separate call)
   * - Use lite_enrich for Tier C (costs 3 credits instead of 6)
   */
  private async getPersonEnrichmentOptimized(
    name: string,
    socialUrl?: string,
    email?: string,
    options: {
      includeNewsfeed?: boolean;
      liteMode?: boolean;
      pollConfig?: { maxAttempts: number; delayMs: number };
    } = {}
  ): Promise<{ enrichment: NyneEnrichment; newsfeed?: NyneNewsfeed }> {
    if (!this.apiKey) {
      return {
        enrichment: this.mockPersonEnrichment(name),
        newsfeed: options.includeNewsfeed ? this.mockPersonNewsfeed(name) : undefined,
      };
    }

    console.log(`[NyneCollector] Fetching enrichment for ${name}...`);
    console.log(`[NyneCollector] Options: includeNewsfeed=${options.includeNewsfeed}, liteMode=${options.liteMode}`);

    const body: Record<string, unknown> = {};
    if (socialUrl) body.social_media_url = socialUrl;
    if (email) body.email = email;

    // Always use AI enhanced search for better matching
    body.ai_enhanced_search = true;

    // Tier-based options
    if (options.liteMode) {
      body.lite_enrich = true;
      // Cost: 3 credits
    } else if (options.includeNewsfeed) {
      body.newsfeed = ["linkedin", "twitter"];
      // Cost: 6 (enrichment) + 6 (newsfeed) = 12 credits
    }
    // else: Cost: 6 credits (standard enrichment)

    const response = await fetch(`${this.baseUrl}/person/enrichment`, {
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
      throw new Error(`Enrichment API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // Handle async response (queued)
    if (result.data?.status === "queued" && result.data?.request_id) {
      console.log(`[NyneCollector] Enrichment queued, polling for results...`);
      return this.pollEnrichmentResultsOptimized(
        result.data.request_id,
        name,
        options.includeNewsfeed,
        options.pollConfig
      );
    }

    return this.transformEnrichmentResultOptimized(result, name, options.includeNewsfeed);
  }

  /**
   * LEGACY: Get person enrichment (kept for backwards compatibility)
   */
  private async getPersonEnrichment(name: string, socialUrl?: string, email?: string): Promise<NyneEnrichment> {
    const result = await this.getPersonEnrichmentOptimized(name, socialUrl, email, { includeNewsfeed: true });
    return result.enrichment;
  }

  /**
   * OPTIMIZED: Poll for enrichment results with optional newsfeed extraction
   * Now accepts tier-based poll configuration for customized timeout behavior
   */
  private async pollEnrichmentResultsOptimized(
    requestId: string,
    name: string,
    includeNewsfeed?: boolean,
    pollConfig?: { maxAttempts: number; delayMs: number }
  ): Promise<{ enrichment: NyneEnrichment; newsfeed?: NyneNewsfeed }> {
    // Use provided config or defaults
    const maxAttempts = pollConfig?.maxAttempts || 20;
    const delayMs = pollConfig?.delayMs || 3000;

    console.log(`[NyneCollector] Polling with: maxAttempts=${maxAttempts}, delayMs=${delayMs}`);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.sleep(delayMs); // Use tier-based delay

      try {
        const response = await fetch(`${this.baseUrl}/person/enrichment?request_id=${requestId}`, {
          method: "GET",
          headers: {
            "X-API-Key": this.apiKey,
            "X-API-Secret": this.apiSecret,
          },
        });

        if (!response.ok) continue;

        const result = await response.json();

        // Check for completion: status=completed OR result field exists with data
        const isCompleted = result.data?.status === "completed" ||
                           result.data?.result?.organizations ||
                           result.data?.result?.displayname;

        if (isCompleted) {
          console.log(`[NyneCollector] Enrichment completed for ${name}`);
          return this.transformEnrichmentResultOptimized(result, name, includeNewsfeed);
        }

        if (result.data?.status === "failed") {
          console.error(`[NyneCollector] Enrichment failed: ${result.data?.error}`);
          return {
            enrichment: this.mockPersonEnrichment(name),
            newsfeed: includeNewsfeed ? this.mockPersonNewsfeed(name) : undefined,
          };
        }

        console.log(`[NyneCollector] Polling enrichment... attempt ${attempt + 1}/${maxAttempts}`);
      } catch (error) {
        console.error(`[NyneCollector] Enrichment poll error: ${error}`);
      }
    }

    console.warn(`[NyneCollector] Enrichment timeout for ${name}`);
    return {
      enrichment: this.mockPersonEnrichment(name),
      newsfeed: includeNewsfeed ? this.mockPersonNewsfeed(name) : undefined,
    };
  }

  /**
   * LEGACY: Poll for enrichment results (kept for backwards compatibility)
   */
  private async pollEnrichmentResults(requestId: string, name: string, maxAttempts = 20): Promise<NyneEnrichment> {
    const result = await this.pollEnrichmentResultsOptimized(requestId, name, false, maxAttempts);
    return result.enrichment;
  }

  /**
   * OPTIMIZED: Transform enrichment API result, extracting both profile and newsfeed
   * nyne.ai returns data in result.data.result (nested)
   */
  private transformEnrichmentResultOptimized(
    result: unknown,
    name: string,
    includeNewsfeed?: boolean
  ): { enrichment: NyneEnrichment; newsfeed?: NyneNewsfeed } {
    const responseData = (result as { data?: { result?: Record<string, unknown> } })?.data;
    // Data can be in data.result (completed poll) or directly in data (immediate response)
    const data = (responseData?.result || responseData || {}) as Record<string, unknown>;

    console.log(`[NyneCollector] Transforming enrichment for ${name}, fields: ${Object.keys(data).join(", ")}`);

    // Extract from nyne.ai format - check various field names
    const displayname = (data.displayname as string) ||
                        ((data.firstname as string) ? `${data.firstname} ${data.lastname || ""}`.trim() : null) ||
                        (data.full_name as string) ||
                        name;

    const organizations = (data.organizations as Array<{
      name?: string;
      title?: string;
      startDate?: string;
      endDate?: string;
      company_linkedin_url?: string;
    }>) || [];

    const schools = (data.schools_info as Array<{ name?: string; degree?: string; fieldOfStudy?: string }>) ||
                    (data.education as Array<{ name?: string; degree?: string; fieldOfStudy?: string }>) || [];

    // Get current organization (look for "Present" or no endDate)
    const currentOrg = organizations.find(o =>
      o.endDate === "Present" ||
      (o as { endDate_formatted?: { is_current?: boolean } }).endDate_formatted?.is_current === true
    ) || organizations[0];

    // Build career history
    const careerHistory: Array<{ role: string; organization: string; years: string }> = [];
    for (const org of organizations.slice(0, 5)) {
      if (org.name && org.title) {
        careerHistory.push({
          role: org.title,
          organization: org.name,
          years: `${org.startDate || "?"}-${org.endDate || "Present"}`,
        });
      }
    }

    // Build education list
    const education: string[] = [];
    for (const school of schools.slice(0, 3)) {
      const entry = [school.degree, school.fieldOfStudy, school.name].filter(Boolean).join(" - ");
      if (entry) education.push(entry);
    }

    // Extract biography from various sources
    const biography = (data.summary as string) ||
                     (data.headline as string) ||
                     (data.bio as string) ||
                     (data.about as string) ||
                     "";

    // Get location
    const location = (data.location as string) ||
                    ((data.city as string) ? `${data.city}, ${data.country || ""}`.trim() : "");

    // Extract social profiles with engagement metrics
    const rawSocialProfiles = data.social_profiles as Record<string, unknown> | undefined;
    const socialProfiles: NyneEnrichment["social_profiles"] = rawSocialProfiles ? {
      linkedin: rawSocialProfiles.linkedin as NyneEnrichment["social_profiles"]["linkedin"],
      twitter: rawSocialProfiles.twitter as NyneEnrichment["social_profiles"]["twitter"],
      github: rawSocialProfiles.github as NyneEnrichment["social_profiles"]["github"],
    } : undefined;

    const enrichment: NyneEnrichment = {
      person_id: `nyne-${name.toLowerCase().replace(/\s/g, "-")}`,
      name: displayname,
      biography: biography || `${currentOrg?.title || ""} at ${currentOrg?.name || ""}`.trim(),
      current_role: currentOrg?.title || "",
      organization: currentOrg?.name || "",
      education,
      career_history: careerHistory,

      // Additional fields for rich persona data
      location: location || undefined,
      gender: data.gender as string | undefined,
      probability: data.probability as "high" | "medium" | "low" | "unknown" | undefined,
      headline: data.headline as string | undefined,
      summary: data.summary as string | undefined,

      // Contact info
      altemails: data.altemails as string[] | undefined,
      fullphone: data.fullphone as Array<{ fullphone: string; type: string }> | undefined,

      // Social profiles with engagement metrics
      social_profiles: socialProfiles,

      // Raw data for reprocessing
      schools_info: schools as NyneEnrichment["schools_info"],
      organizations: organizations as NyneEnrichment["organizations"],
    };

    // Log summary of what we captured
    const socialCount = Object.values(socialProfiles || {}).filter(Boolean).length;
    console.log(`[NyneCollector] Enrichment for ${name}: ${careerHistory.length} career entries, ${education.length} education entries, ${socialCount} social profiles`);

    // Extract newsfeed if requested and present in response
    let newsfeed: NyneNewsfeed | undefined;
    if (includeNewsfeed) {
      const rawPosts = (data.newsfeed as unknown[]) || [];
      if (rawPosts.length > 0) {
        newsfeed = this.transformNewsfeedFromEnrichment(rawPosts, name);
        console.log(`[NyneCollector] Extracted ${rawPosts.length} newsfeed posts from enrichment response`);
      } else {
        console.log(`[NyneCollector] No newsfeed data in enrichment response, using mock`);
        newsfeed = this.mockPersonNewsfeed(name);
      }
    }

    return { enrichment, newsfeed };
  }

  /**
   * Transform newsfeed data embedded in enrichment response
   */
  private transformNewsfeedFromEnrichment(rawPosts: unknown[], name: string): NyneNewsfeed {
    const posts = rawPosts as Array<{
      content?: string;
      text?: string;
      timestamp?: string;
      date?: string;
      likes?: number;
      engagement?: number;
      comments?: number;
      shares?: number;
      source?: string;
    }>;

    // Transform to our format
    const recentContent: NyneNewsfeed["recent_content"] = [];
    for (const post of posts.slice(0, 10)) {
      recentContent.push({
        text: post.content || post.text || "",
        source: post.source || "unknown",
        date: post.timestamp || post.date || new Date().toISOString(),
        engagement: (post.likes || 0) + (post.comments || 0) + (post.shares || 0),
        sentiment: 0.5, // Default neutral
      });
    }

    // Analyze communication style from posts
    let formality = 0.7;
    let emotionality = 0.3;
    let assertiveness = 0.6;

    if (recentContent.length > 0) {
      const allText = recentContent.map(p => p.text).join(" ").toLowerCase();
      const wordCount = allText.split(/\s+/).length;

      const avgSentenceLength = wordCount / Math.max(1, (allText.match(/[.!?]/g) || []).length);
      formality = Math.min(0.95, 0.5 + avgSentenceLength / 50);

      const emotionalIndicators = (allText.match(/!|amazing|excited|thrilled|proud|love|hate|terrible/g) || []).length;
      emotionality = Math.min(0.9, 0.2 + emotionalIndicators / 20);

      const assertiveIndicators = (allText.match(/\bi\s|\bwe\s|will|must|should|believe|commit/g) || []).length;
      assertiveness = Math.min(0.9, 0.4 + assertiveIndicators / 30);
    }

    return {
      person_id: `nyne-${name.toLowerCase().replace(/\s/g, "-")}`,
      name,
      recent_content: recentContent,
      communication_style: {
        formality,
        emotionality,
        assertiveness,
      },
    };
  }

  /**
   * LEGACY: Transform enrichment API result (kept for backwards compatibility)
   */
  private transformEnrichmentResult(result: unknown, name: string): NyneEnrichment {
    return this.transformEnrichmentResultOptimized(result, name, false).enrichment;
  }

  /**
   * Get social profiles
   */
  private async getPersonSocialProfiles(name: string, socialUrl?: string): Promise<NyneSocialProfiles> {
    if (!this.apiKey) {
      return this.mockPersonSocialProfiles(name);
    }

    // Social profiles might come from enrichment or a dedicated endpoint
    if (socialUrl) {
      try {
        const enrichment = await this.getPersonEnrichment(name, socialUrl);
        // Transform enrichment to social profiles format
        return {
          person_id: enrichment.person_id,
          name,
          profiles: [
            {
              platform: socialUrl.includes("linkedin") ? "linkedin" : "twitter",
              username: name.toLowerCase().replace(/\s/g, ""),
              followers: 0,
              verified: true,
            },
          ],
        };
      } catch {
        return this.mockPersonSocialProfiles(name);
      }
    }

    return this.mockPersonSocialProfiles(name);
  }

  // Mock data generators for development

  private mockPersonInterests(name: string): NyneInterests {
    const topics = [
      "artificial_intelligence", "technology", "leadership", "innovation",
      "business_strategy", "digital_transformation", "sustainability", "finance"
    ];

    return {
      person_id: `mock-${name.toLowerCase().replace(/\s/g, "-")}`,
      name,
      interests: topics.slice(0, 5).map((topic) => ({
        topic,
        weight: Math.random() * 0.5 + 0.5,
        category: "professional",
      })),
      engagement_patterns: {
        peak_times: ["09:00", "14:00", "20:00"],
        preferred_platforms: ["linkedin", "twitter"],
      },
    };
  }

  private mockPersonNewsfeed(name: string): NyneNewsfeed {
    return {
      person_id: `mock-${name.toLowerCase().replace(/\s/g, "-")}`,
      name,
      recent_content: [
        {
          text: `Excited about the future of AI and its potential to transform industries.`,
          source: "linkedin",
          date: new Date().toISOString(),
          engagement: Math.floor(Math.random() * 10000),
          sentiment: 0.7,
        },
        {
          text: `Building for the long term requires patience and persistence.`,
          source: "twitter",
          date: new Date(Date.now() - 86400000).toISOString(),
          engagement: Math.floor(Math.random() * 5000),
          sentiment: 0.5,
        },
      ],
      communication_style: {
        formality: 0.7 + Math.random() * 0.2,
        emotionality: 0.3 + Math.random() * 0.3,
        assertiveness: 0.6 + Math.random() * 0.3,
      },
    };
  }

  private mockPersonEnrichment(name: string): NyneEnrichment {
    const vip = (vipSeedList.vips as VIPSeed[]).find((v) => v.name === name);

    return {
      person_id: `mock-${name.toLowerCase().replace(/\s/g, "-")}`,
      name,
      biography: `${name} is a prominent ${vip?.role || "executive"} at ${vip?.affiliation || "a major organization"}, known for strategic leadership and innovation.`,
      current_role: vip?.role || "Executive",
      organization: vip?.affiliation || "Unknown",
      education: ["Stanford University", "Harvard Business School"],
      career_history: [
        {
          role: vip?.role || "Executive",
          organization: vip?.affiliation || "Current Company",
          years: "2020-Present",
        },
        {
          role: "VP",
          organization: "Previous Company",
          years: "2015-2020",
        },
      ],
    };
  }

  private mockPersonSocialProfiles(name: string): NyneSocialProfiles {
    return {
      person_id: `mock-${name.toLowerCase().replace(/\s/g, "-")}`,
      name,
      profiles: [
        {
          platform: "linkedin",
          username: name.toLowerCase().replace(/\s/g, ""),
          followers: Math.floor(Math.random() * 1000000) + 100000,
          verified: true,
        },
        {
          platform: "twitter",
          username: name.toLowerCase().replace(/\s/g, ""),
          followers: Math.floor(Math.random() * 5000000) + 500000,
          verified: true,
        },
      ],
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
let collectorInstance: NyneCollector | null = null;

export function getNyneCollector(options?: { creditBudget?: number }): NyneCollector {
  if (!collectorInstance) {
    collectorInstance = new NyneCollector(options);
  }
  return collectorInstance;
}

// CLI helper for running collection
export async function runCollection(options: {
  vertical?: "enterprise" | "political" | "defense";
  tier?: "A" | "B" | "C";
  limit?: number;
  dryRun?: boolean;
}): Promise<void> {
  const collector = getNyneCollector();
  const queue = collector.getCollectionQueue(options);

  console.log(`\nCollection Queue:`);
  console.log(`- Vertical: ${options.vertical || "all"}`);
  console.log(`- Tier: ${options.tier || "all"}`);
  console.log(`- VIPs to collect: ${queue.length}`);
  console.log(`- Estimated credits: ${queue.reduce((sum, v) => sum + v.creditsRequired, 0)}`);

  if (options.dryRun) {
    console.log("\n[DRY RUN] Would collect:");
    queue.forEach((vip, i) => {
      console.log(`  ${i + 1}. ${vip.name} (${vip.vertical}/${vip.tier}) - ${vip.creditsRequired} credits`);
    });
    return;
  }

  console.log("\nStarting collection...\n");

  const results = await collector.collectBatch(queue, {
    onProgress: (current, total, result) => {
      const status = result.success ? "✓" : "✗";
      console.log(`[${current}/${total}] ${status} ${result.name} - ${result.creditsUsed} credits`);
    },
  });

  const stats = collector.getStats();
  console.log("\n=== Collection Complete ===");
  console.log(`Total collected: ${stats.totalCollected}`);
  console.log(`Credits used: ${stats.creditsUsed}`);
  console.log(`Credits remaining: ${stats.creditsRemaining}`);
  console.log(`Errors: ${stats.errors}`);
}
