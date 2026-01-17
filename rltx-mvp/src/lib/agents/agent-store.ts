/**
 * AgentStore - Unified interface for accessing all three tiers of agents
 *
 * Tier 1: VIP Agents (2,000) - Full LLM reasoning with Claude Opus
 * Tier 2: Archetype Agents (10,000) - Lighter LLM with GPT-4o-mini
 * Tier 3: Statistical Agents (1,000,000) - No LLM, distribution lookup
 */

import { db } from "@/db";
import {
  vipAgents,
  agentArchetypes,
  statisticalAgents,
  companyAgents,
  type VIPPsychographics,
  type KnownPosition,
  type AgentNetwork,
  type ArchetypeDemographics,
  type ArchetypeTraits,
  type ResponseDistribution,
  type BigFiveTraits,
  type MoralFoundations,
} from "@/db/schema";
import { eq, ilike, and, or, sql } from "drizzle-orm";

// Agent tier types
export type AgentTier = "vip" | "archetype" | "statistical";

// Unified agent interface
export interface Agent {
  id: string;
  tier: AgentTier;
  name?: string;
  demographics?: ArchetypeDemographics;
  traits?: ArchetypeTraits;
  description?: string;
  weight: number;
}

// VIP agent with full profile
export interface VIPAgentProfile extends Agent {
  tier: "vip";
  nyneId?: string;
  domain: string;
  role: string;
  affiliation?: string;
  biography?: string;
  psychographics?: VIPPsychographics;
  knownPositions?: KnownPosition[];
  network?: AgentNetwork;
}

// Archetype agent with statistical profile
export interface ArchetypeAgentProfile extends Agent {
  tier: "archetype";
  archetypeId: string;
  responseDistributions?: Record<string, ResponseDistribution>;
}

// Statistical agent (lightweight)
export interface StatisticalAgentProfile extends Agent {
  tier: "statistical";
  archetypeId: string;
  traitVariation?: Partial<ArchetypeTraits>;
}

// Population sampling specification
export interface PopulationSpec {
  base:
    | "us_adults"
    | "us_voters"
    | "us_consumers"
    | "enterprise_decision_makers"
    | "defense_stakeholders";
  filters?: {
    age?: string[];
    gender?: string[];
    income?: string[];
    education?: string[];
    location?: string[];
    region?: string[];
  };
}

// In-memory cache for demo mode (no database)
const vipCache: Map<string, VIPAgentProfile> = new Map();
const archetypeCache: Map<string, ArchetypeAgentProfile> = new Map();

/**
 * AgentStore provides unified access to all agent tiers
 */
export class AgentStore {
  private useDatabase: boolean;

  constructor(useDatabase?: boolean) {
    // Auto-detect database availability if not specified
    this.useDatabase = useDatabase ?? (db !== null);
  }

  /**
   * Check if database is available
   */
  isDatabaseEnabled(): boolean {
    return this.useDatabase && db !== null;
  }

  /**
   * Get an agent by ID (any tier)
   */
  async getAgent(id: string): Promise<Agent | null> {
    // Check VIP cache first
    if (vipCache.has(id)) {
      return vipCache.get(id)!;
    }

    // Check archetype cache
    if (archetypeCache.has(id)) {
      return archetypeCache.get(id)!;
    }

    // Database lookup when enabled
    if (this.isDatabaseEnabled() && db) {
      // Try VIP agents first
      const vipResults = await db
        .select()
        .from(vipAgents)
        .where(eq(vipAgents.id, id))
        .limit(1);

      if (vipResults.length > 0) {
        const vip = vipResults[0];
        return this.dbVipToAgent(vip);
      }

      // Try archetypes
      const archetypeResults = await db
        .select()
        .from(agentArchetypes)
        .where(eq(agentArchetypes.id, id))
        .limit(1);

      if (archetypeResults.length > 0) {
        const archetype = archetypeResults[0];
        return {
          id: archetype.id,
          tier: "archetype",
          demographics: archetype.demographics as ArchetypeDemographics,
          traits: archetype.traits as ArchetypeTraits,
          description: archetype.description || undefined,
          weight: archetype.populationWeight,
        } as ArchetypeAgentProfile;
      }
    }

    return null;
  }

  /**
   * Convert database VIP record to VIPAgentProfile
   */
  private dbVipToAgent(vip: typeof vipAgents.$inferSelect): VIPAgentProfile {
    return {
      id: vip.id,
      tier: "vip",
      name: vip.name,
      nyneId: vip.nyneId || undefined,
      domain: vip.domain,
      role: vip.role,
      affiliation: vip.affiliation || undefined,
      biography: vip.biography || undefined,
      psychographics: vip.psychographics as VIPPsychographics | undefined,
      knownPositions: vip.knownPositions as KnownPosition[] | undefined,
      network: vip.network as AgentNetwork | undefined,
      description: vip.biography || `${vip.name}, ${vip.role} at ${vip.affiliation || "unknown"}`,
      weight: 1.0,
    };
  }

  /**
   * Get VIP agent by name (fuzzy match)
   */
  async getVIPByName(name: string): Promise<VIPAgentProfile | null> {
    const normalizedName = name.toLowerCase();

    // Check cache first
    const cachedAgents = Array.from(vipCache.values());
    for (const agent of cachedAgents) {
      if (agent.name?.toLowerCase().includes(normalizedName)) {
        return agent;
      }
    }

    // Database lookup with fuzzy matching
    if (this.isDatabaseEnabled() && db) {
      const results = await db
        .select()
        .from(vipAgents)
        .where(ilike(vipAgents.name, `%${name}%`))
        .limit(1);

      if (results.length > 0) {
        return this.dbVipToAgent(results[0]);
      }
    }

    return null;
  }

  /**
   * Search VIPs by domain, role, vertical, tier
   */
  async searchVIPs(query: {
    domain?: string;
    role?: string;
    vertical?: string;
    tier?: string;
    limit?: number;
  }): Promise<VIPAgentProfile[]> {
    const results: VIPAgentProfile[] = [];
    const limit = query.limit || 100;

    // Database lookup
    if (this.isDatabaseEnabled() && db) {
      const conditions = [];

      if (query.domain) {
        conditions.push(eq(vipAgents.domain, query.domain));
      }
      if (query.vertical) {
        conditions.push(eq(vipAgents.vertical, query.vertical));
      }
      if (query.tier) {
        conditions.push(eq(vipAgents.tier, query.tier));
      }
      if (query.role) {
        conditions.push(ilike(vipAgents.role, `%${query.role}%`));
      }

      const dbResults = await db
        .select()
        .from(vipAgents)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(limit);

      for (const vip of dbResults) {
        results.push(this.dbVipToAgent(vip));
      }
    }

    // Also check cache
    const cachedAgents = Array.from(vipCache.values());
    for (const agent of cachedAgents) {
      if (results.length >= limit) break;
      if (results.some(r => r.id === agent.id)) continue; // Already in results
      if (query.domain && agent.domain !== query.domain) continue;
      if (query.role && !agent.role.toLowerCase().includes(query.role.toLowerCase())) continue;
      results.push(agent);
    }

    return results.slice(0, limit);
  }

  /**
   * Get all VIPs from database
   */
  async getAllVIPs(options?: { limit?: number; vertical?: string }): Promise<VIPAgentProfile[]> {
    const limit = options?.limit || 1000;

    if (this.isDatabaseEnabled() && db) {
      const conditions = options?.vertical
        ? eq(vipAgents.vertical, options.vertical)
        : undefined;

      const dbResults = await db
        .select()
        .from(vipAgents)
        .where(conditions)
        .limit(limit);

      return dbResults.map(vip => this.dbVipToAgent(vip));
    }

    // Fall back to cache
    return Array.from(vipCache.values()).slice(0, limit);
  }

  /**
   * Get VIP count by vertical
   */
  async getVIPStats(): Promise<{
    total: number;
    byVertical: Record<string, number>;
    byTier: Record<string, number>;
  }> {
    if (this.isDatabaseEnabled() && db) {
      const verticalCounts = await db
        .select({
          vertical: vipAgents.vertical,
          count: sql<number>`count(*)::int`,
        })
        .from(vipAgents)
        .groupBy(vipAgents.vertical);

      const tierCounts = await db
        .select({
          tier: vipAgents.tier,
          count: sql<number>`count(*)::int`,
        })
        .from(vipAgents)
        .groupBy(vipAgents.tier);

      const byVertical: Record<string, number> = {};
      const byTier: Record<string, number> = {};
      let total = 0;

      for (const row of verticalCounts) {
        byVertical[row.vertical] = row.count;
        total += row.count;
      }

      for (const row of tierCounts) {
        byTier[row.tier] = row.count;
      }

      return { total, byVertical, byTier };
    }

    // Fall back to cache stats
    const cached = Array.from(vipCache.values());
    return {
      total: cached.length,
      byVertical: {},
      byTier: {},
    };
  }

  /**
   * Sample agents from a population
   * Uses stratified sampling to match demographic distributions
   * Can include VIP agents from database when relevant
   */
  async samplePopulation(
    spec: PopulationSpec,
    count: number,
    options?: {
      useVIPs?: boolean; // Include VIP agents where available
      vipRatio?: number; // Ratio of VIPs to include (0-1)
      useArchetypes?: boolean; // Cluster into archetypes
      seed?: number; // Random seed for reproducibility
      vertical?: string; // VIP vertical filter (enterprise, political, defense)
    }
  ): Promise<Agent[]> {
    const agents: Agent[] = [];
    const useVIPs = options?.useVIPs ?? (this.isDatabaseEnabled());
    const vipRatio = options?.vipRatio ?? 0.1; // 10% VIPs by default
    const useArchetypes = options?.useArchetypes ?? true;
    const seed = options?.seed ?? Date.now();

    // Simple seeded random for reproducibility
    let rng = seed;
    const random = () => {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff;
      return rng / 0x7fffffff;
    };

    // Calculate VIP count
    const vipCount = useVIPs ? Math.floor(count * vipRatio) : 0;
    const statisticalCount = count - vipCount;

    // Include VIPs from database
    if (vipCount > 0 && this.isDatabaseEnabled()) {
      // Map population base to VIP vertical
      const verticalMap: Record<string, string> = {
        us_adults: "enterprise",
        us_voters: "political",
        us_consumers: "enterprise",
        enterprise_decision_makers: "enterprise",
        defense_stakeholders: "defense",
      };
      const vertical = options?.vertical || verticalMap[spec.base] || "enterprise";

      const vips = await this.getAllVIPs({ limit: vipCount, vertical });

      for (const vip of vips) {
        agents.push(vip);
      }

      console.log(`[AgentStore] Included ${vips.length} VIP agents from database (vertical: ${vertical})`);
    }

    // Get demographic distributions for this population
    const demographics = this.getPopulationDemographics(spec.base);

    // Generate statistical agents to fill remaining count
    for (let i = 0; i < statisticalCount; i++) {
      const demo = this.sampleDemographics(demographics, random);
      const traits = this.sampleTraits(demo, random);

      if (useArchetypes) {
        // Create archetype agent
        const archetypeId = this.computeArchetypeHash(demo, traits);
        agents.push({
          id: `arch-${archetypeId}-${i}`,
          tier: "archetype",
          demographics: demo,
          traits,
          description: this.generateDescription(demo, traits),
          weight: 1.0,
        } as ArchetypeAgentProfile);
      } else {
        // Create statistical agent
        agents.push({
          id: `stat-${i}`,
          tier: "statistical",
          demographics: demo,
          traits,
          description: this.generateDescription(demo, traits),
          weight: 1.0,
        } as StatisticalAgentProfile);
      }
    }

    return agents;
  }

  /**
   * Register a VIP agent (from nyne.ai or manual creation)
   */
  async registerVIP(agent: Omit<VIPAgentProfile, "tier">): Promise<VIPAgentProfile> {
    const vip: VIPAgentProfile = {
      ...agent,
      tier: "vip",
    };
    vipCache.set(agent.id, vip);

    // TODO: Persist to database if enabled
    return vip;
  }

  /**
   * Get all VIPs in a domain
   */
  async getVIPsByDomain(domain: string): Promise<VIPAgentProfile[]> {
    const results: VIPAgentProfile[] = [];
    const agents = Array.from(vipCache.values());
    for (const agent of agents) {
      if (agent.domain === domain) {
        results.push(agent);
      }
    }
    return results;
  }

  // Private helper methods

  private getPopulationDemographics(base: string): Record<string, Record<string, number>> {
    // US Census 2022 distributions
    const usAdults = {
      age: { "18-24": 0.12, "25-34": 0.18, "35-44": 0.17, "45-54": 0.16, "55-64": 0.17, "65+": 0.20 },
      gender: { male: 0.49, female: 0.51 },
      income: {
        under_25k: 0.18,
        "25k_50k": 0.22,
        "50k_75k": 0.17,
        "75k_100k": 0.13,
        "100k_150k": 0.15,
        "150k_plus": 0.15,
      },
      education: { no_hs: 0.11, hs: 0.27, some_college: 0.29, bachelors: 0.21, graduate: 0.12 },
      location: { urban: 0.31, suburban: 0.55, rural: 0.14 },
      region: { northeast: 0.17, midwest: 0.21, south: 0.38, west: 0.24 },
    };

    const populationMap: Record<string, typeof usAdults> = {
      us_adults: usAdults,
      us_voters: {
        ...usAdults,
        // Voters skew older and more educated
        age: { "18-24": 0.08, "25-34": 0.14, "35-44": 0.17, "45-54": 0.18, "55-64": 0.20, "65+": 0.23 },
        education: { no_hs: 0.06, hs: 0.22, some_college: 0.28, bachelors: 0.26, graduate: 0.18 },
      },
      us_consumers: usAdults,
      enterprise_decision_makers: {
        age: { "18-24": 0.02, "25-34": 0.15, "35-44": 0.30, "45-54": 0.30, "55-64": 0.18, "65+": 0.05 },
        gender: { male: 0.62, female: 0.38 },
        income: {
          under_25k: 0.01,
          "25k_50k": 0.03,
          "50k_75k": 0.08,
          "75k_100k": 0.15,
          "100k_150k": 0.28,
          "150k_plus": 0.45,
        },
        education: { no_hs: 0.01, hs: 0.04, some_college: 0.12, bachelors: 0.45, graduate: 0.38 },
        location: { urban: 0.45, suburban: 0.50, rural: 0.05 },
        region: { northeast: 0.25, midwest: 0.18, south: 0.30, west: 0.27 },
      },
      defense_stakeholders: {
        age: { "18-24": 0.05, "25-34": 0.15, "35-44": 0.25, "45-54": 0.28, "55-64": 0.20, "65+": 0.07 },
        gender: { male: 0.75, female: 0.25 },
        income: {
          under_25k: 0.02,
          "25k_50k": 0.05,
          "50k_75k": 0.12,
          "75k_100k": 0.20,
          "100k_150k": 0.30,
          "150k_plus": 0.31,
        },
        education: { no_hs: 0.01, hs: 0.08, some_college: 0.15, bachelors: 0.38, graduate: 0.38 },
        location: { urban: 0.35, suburban: 0.55, rural: 0.10 },
        region: { northeast: 0.20, midwest: 0.15, south: 0.40, west: 0.25 },
      },
    };

    return populationMap[base] || usAdults;
  }

  private sampleDemographics(
    distributions: Record<string, Record<string, number>>,
    random: () => number
  ): ArchetypeDemographics {
    const sample = (dist: Record<string, number>): string => {
      const r = random();
      let cumulative = 0;
      for (const [key, prob] of Object.entries(dist)) {
        cumulative += prob;
        if (r < cumulative) return key;
      }
      return Object.keys(dist)[0];
    };

    return {
      age: sample(distributions.age) as ArchetypeDemographics["age"],
      gender: sample(distributions.gender) as ArchetypeDemographics["gender"],
      income: sample(distributions.income) as ArchetypeDemographics["income"],
      education: sample(distributions.education) as ArchetypeDemographics["education"],
      location: sample(distributions.location) as ArchetypeDemographics["location"],
      region: sample(distributions.region) as ArchetypeDemographics["region"],
    };
  }

  private sampleTraits(demo: ArchetypeDemographics, random: () => number): ArchetypeTraits {
    // Conditional distributions based on demographics
    // P(trait | demographics)

    // Risk tolerance decreases with age, increases with income
    const ageRiskBase: Record<string, number> = {
      "18-24": 0.65,
      "25-34": 0.60,
      "35-44": 0.50,
      "45-54": 0.45,
      "55-64": 0.40,
      "65+": 0.35,
    };
    const incomeRiskMod: Record<string, number> = {
      under_25k: -0.1,
      "25k_50k": -0.05,
      "50k_75k": 0,
      "75k_100k": 0.05,
      "100k_150k": 0.10,
      "150k_plus": 0.15,
    };
    const riskTolerance = Math.max(
      0,
      Math.min(1, ageRiskBase[demo.age] + incomeRiskMod[demo.income] + (random() - 0.5) * 0.2)
    );

    // Price sensitivity inversely related to income
    const incomePriceSens: Record<string, number> = {
      under_25k: 0.85,
      "25k_50k": 0.70,
      "50k_75k": 0.55,
      "75k_100k": 0.45,
      "100k_150k": 0.35,
      "150k_plus": 0.25,
    };
    const priceSensitivity = Math.max(
      0,
      Math.min(1, incomePriceSens[demo.income] + (random() - 0.5) * 0.15)
    );

    // Brand loyalty increases with age
    const ageLoyalty: Record<string, number> = {
      "18-24": 0.30,
      "25-34": 0.40,
      "35-44": 0.50,
      "45-54": 0.55,
      "55-64": 0.60,
      "65+": 0.65,
    };
    const brandLoyalty = Math.max(0, Math.min(1, ageLoyalty[demo.age] + (random() - 0.5) * 0.2));

    // Tech adoption decreases with age, increases with education
    const ageTechBase: Record<string, number> = {
      "18-24": 0.80,
      "25-34": 0.75,
      "35-44": 0.60,
      "45-54": 0.45,
      "55-64": 0.35,
      "65+": 0.25,
    };
    const eduTechMod: Record<string, number> = {
      no_hs: -0.15,
      hs: -0.05,
      some_college: 0,
      bachelors: 0.10,
      graduate: 0.15,
    };
    const techAdoption = Math.max(
      0,
      Math.min(1, ageTechBase[demo.age] + eduTechMod[demo.education] + (random() - 0.5) * 0.15)
    );

    return {
      riskTolerance,
      priceSensitivity,
      brandLoyalty,
      techAdoption,
    };
  }

  private computeArchetypeHash(demo: ArchetypeDemographics, traits: ArchetypeTraits): string {
    // Bin traits into discrete categories for clustering
    const riskBin = traits.riskTolerance < 0.33 ? "L" : traits.riskTolerance < 0.67 ? "M" : "H";
    const priceBin = traits.priceSensitivity < 0.33 ? "L" : traits.priceSensitivity < 0.67 ? "M" : "H";

    return `${demo.age}-${demo.income}-${demo.location}-${riskBin}-${priceBin}`;
  }

  private generateDescription(demo: ArchetypeDemographics, traits: ArchetypeTraits): string {
    const ageDesc: Record<string, string> = {
      "18-24": "young adult",
      "25-34": "young professional",
      "35-44": "mid-career adult",
      "45-54": "established professional",
      "55-64": "pre-retirement adult",
      "65+": "retiree",
    };

    const incomeDesc: Record<string, string> = {
      under_25k: "low-income",
      "25k_50k": "lower-middle income",
      "50k_75k": "middle income",
      "75k_100k": "upper-middle income",
      "100k_150k": "high income",
      "150k_plus": "affluent",
    };

    const riskDesc = traits.riskTolerance > 0.6 ? "risk-tolerant" : traits.riskTolerance < 0.4 ? "risk-averse" : "";
    const priceDesc = traits.priceSensitivity > 0.6 ? "price-conscious" : "";

    const parts = [
      `${ageDesc[demo.age]}`,
      `${demo.gender}`,
      `${incomeDesc[demo.income]}`,
      `${demo.education.replace("_", " ")} education`,
      `living in ${demo.location} ${demo.region}`,
      riskDesc,
      priceDesc,
    ].filter(Boolean);

    return parts.join(", ");
  }
}

// Singleton instance for convenience (auto-detects database)
export const agentStore = new AgentStore();

// Helper to get store with explicit database preference
export function getAgentStore(useDatabase?: boolean): AgentStore {
  if (useDatabase !== undefined) {
    return new AgentStore(useDatabase);
  }
  return agentStore;
}
