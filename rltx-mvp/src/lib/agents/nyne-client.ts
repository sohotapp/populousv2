/**
 * NyneClient - Integration with nyne.ai for VIP persona data
 *
 * nyne.ai provides rich behavioral profiles for named individuals
 * including psychographics, known positions, and network data.
 */

import { agentStore, type VIPAgentProfile } from "./agent-store";
import type { VIPPsychographics, KnownPosition, AgentNetwork } from "@/db/schema";

// nyne.ai API response types (based on expected structure)
interface NynePersona {
  id: string;
  name: string;
  type: "political" | "business" | "media" | "defense" | "other";
  role: string;
  affiliation?: string;
  biography?: string;
  attributes: {
    decisionStyle?: "analytical" | "intuitive" | "consensus";
    riskProfile?: number;
    influenceScore?: number;
    publicPrivateDivergence?: number;
    values?: string[];
    communicationStyle?: string;
  };
  positions?: Array<{
    topic: string;
    stance: number;
    confidence: number;
    source: string;
    date?: string;
  }>;
  relationships?: {
    influences?: string[];
    influencedBy?: string[];
    affiliations?: string[];
  };
}

interface NyneSearchResult {
  personas: NynePersona[];
  total: number;
  hasMore: boolean;
}

export class NyneClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.NYNE_API_KEY || "";
    this.baseUrl = baseUrl || process.env.NYNE_API_URL || "https://api.nyne.ai/v1";
  }

  /**
   * Check if nyne.ai integration is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Fetch a single persona by ID
   */
  async getPersona(id: string): Promise<NynePersona | null> {
    if (!this.isConfigured()) {
      console.warn("[NyneClient] API key not configured, using mock data");
      return this.getMockPersona(id);
    }

    try {
      const response = await fetch(`${this.baseUrl}/personas/${id}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`nyne.ai API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[NyneClient] Error fetching persona:", error);
      return null;
    }
  }

  /**
   * Search personas by domain, role, or name
   */
  async searchPersonas(query: {
    domain?: string;
    role?: string;
    name?: string;
    limit?: number;
    offset?: number;
  }): Promise<NyneSearchResult> {
    if (!this.isConfigured()) {
      console.warn("[NyneClient] API key not configured, using mock data");
      return this.getMockSearchResults(query);
    }

    try {
      const params = new URLSearchParams();
      if (query.domain) params.set("type", query.domain);
      if (query.role) params.set("role", query.role);
      if (query.name) params.set("name", query.name);
      if (query.limit) params.set("limit", String(query.limit));
      if (query.offset) params.set("offset", String(query.offset));

      const response = await fetch(`${this.baseUrl}/personas/search?${params}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`nyne.ai API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[NyneClient] Error searching personas:", error);
      return { personas: [], total: 0, hasMore: false };
    }
  }

  /**
   * Sync all VIPs from nyne.ai to local agent store
   */
  async syncAllVIPs(options?: {
    domain?: string;
    limit?: number;
    onProgress?: (loaded: number, total: number) => void;
  }): Promise<number> {
    const limit = options?.limit || 2000;
    let loaded = 0;
    let offset = 0;
    const batchSize = 100;

    while (loaded < limit) {
      const results = await this.searchPersonas({
        domain: options?.domain,
        limit: Math.min(batchSize, limit - loaded),
        offset,
      });

      if (results.personas.length === 0) break;

      for (const persona of results.personas) {
        const vip = this.transformToVIP(persona);
        await agentStore.registerVIP(vip);
        loaded++;
      }

      options?.onProgress?.(loaded, Math.min(results.total, limit));

      if (!results.hasMore) break;
      offset += batchSize;
    }

    console.log(`[NyneClient] Synced ${loaded} VIP personas`);
    return loaded;
  }

  /**
   * Transform nyne.ai persona to RLTX VIP agent format
   */
  private transformToVIP(persona: NynePersona): Omit<VIPAgentProfile, "tier"> {
    const psychographics: VIPPsychographics = {
      riskTolerance: persona.attributes.riskProfile || 0.5,
      decisionStyle: persona.attributes.decisionStyle || "analytical",
      influenceability: 1 - (persona.attributes.influenceScore || 0.5), // Inverse of influence
      publicPrivateGap: persona.attributes.publicPrivateDivergence || 0.3,
      values: persona.attributes.values,
      communicationStyle: persona.attributes.communicationStyle,
    };

    const knownPositions: KnownPosition[] =
      persona.positions?.map((p) => ({
        topic: p.topic,
        stance: p.stance,
        confidence: p.confidence,
        source: p.source,
        date: p.date,
      })) || [];

    const network: AgentNetwork = {
      influences: persona.relationships?.influences || [],
      influencedBy: persona.relationships?.influencedBy || [],
      affiliations: persona.relationships?.affiliations,
    };

    return {
      id: `nyne-${persona.id}`,
      nyneId: persona.id,
      name: persona.name,
      domain: persona.type === "other" ? "business" : persona.type,
      role: persona.role,
      affiliation: persona.affiliation,
      biography: persona.biography,
      psychographics,
      knownPositions,
      network,
      weight: 1.0,
    };
  }

  // Mock data for development without API key

  private getMockPersona(id: string): NynePersona | null {
    const mockPersonas = this.getMockPersonaDatabase();
    return mockPersonas.find((p) => p.id === id) || null;
  }

  private getMockSearchResults(query: {
    domain?: string;
    role?: string;
    name?: string;
    limit?: number;
    offset?: number;
  }): NyneSearchResult {
    let personas = this.getMockPersonaDatabase();

    if (query.domain) {
      personas = personas.filter((p) => p.type === query.domain);
    }
    if (query.role) {
      personas = personas.filter((p) => p.role.toLowerCase().includes(query.role!.toLowerCase()));
    }
    if (query.name) {
      personas = personas.filter((p) => p.name.toLowerCase().includes(query.name!.toLowerCase()));
    }

    const offset = query.offset || 0;
    const limit = query.limit || 100;
    const paged = personas.slice(offset, offset + limit);

    return {
      personas: paged,
      total: personas.length,
      hasMore: offset + limit < personas.length,
    };
  }

  private getMockPersonaDatabase(): NynePersona[] {
    // Sample VIP personas for development
    return [
      {
        id: "us-sen-001",
        name: "Chuck Schumer",
        type: "political",
        role: "Senate Majority Leader",
        affiliation: "Democratic Party",
        biography:
          "Senior United States Senator from New York, serving since 1999. Senate Majority Leader since 2021.",
        attributes: {
          decisionStyle: "consensus",
          riskProfile: 0.3,
          influenceScore: 0.95,
          publicPrivateDivergence: 0.4,
          values: ["party unity", "constituent service", "institutional norms"],
        },
        positions: [
          { topic: "TikTok Ban", stance: 0.6, confidence: 0.7, source: "floor speech" },
          { topic: "China Trade", stance: -0.5, confidence: 0.8, source: "legislation" },
          { topic: "Tech Regulation", stance: 0.7, confidence: 0.75, source: "statements" },
        ],
        relationships: {
          influences: ["us-sen-002", "us-sen-003"],
          influencedBy: [],
          affiliations: ["Democratic Caucus", "Senate Leadership"],
        },
      },
      {
        id: "us-sen-002",
        name: "Mitch McConnell",
        type: "political",
        role: "Senate Minority Leader",
        affiliation: "Republican Party",
        biography:
          "Senior United States Senator from Kentucky, serving since 1985. Former Senate Majority Leader.",
        attributes: {
          decisionStyle: "analytical",
          riskProfile: 0.25,
          influenceScore: 0.9,
          publicPrivateDivergence: 0.6,
          values: ["party discipline", "institutional power", "judicial appointments"],
        },
        positions: [
          { topic: "TikTok Ban", stance: 0.8, confidence: 0.85, source: "floor speech" },
          { topic: "China Trade", stance: -0.7, confidence: 0.9, source: "legislation" },
          { topic: "Defense Spending", stance: 0.9, confidence: 0.95, source: "voting record" },
        ],
        relationships: {
          influences: ["us-sen-004", "us-sen-005"],
          affiliations: ["Republican Caucus", "Senate Leadership"],
        },
      },
      {
        id: "ceo-001",
        name: "Satya Nadella",
        type: "business",
        role: "CEO",
        affiliation: "Microsoft",
        biography: "CEO of Microsoft since 2014. Led cloud transformation and AI strategy.",
        attributes: {
          decisionStyle: "analytical",
          riskProfile: 0.6,
          influenceScore: 0.85,
          publicPrivateDivergence: 0.2,
          values: ["growth mindset", "cloud-first", "AI integration"],
        },
        positions: [
          { topic: "AI Regulation", stance: 0.3, confidence: 0.6, source: "public statements" },
          { topic: "Open Source", stance: 0.7, confidence: 0.8, source: "company actions" },
        ],
      },
      {
        id: "ceo-002",
        name: "Tim Cook",
        type: "business",
        role: "CEO",
        affiliation: "Apple",
        biography: "CEO of Apple since 2011. Known for operational excellence and privacy focus.",
        attributes: {
          decisionStyle: "analytical",
          riskProfile: 0.35,
          influenceScore: 0.9,
          publicPrivateDivergence: 0.3,
          values: ["privacy", "supply chain excellence", "premium positioning"],
        },
        positions: [
          { topic: "Privacy Regulation", stance: 0.6, confidence: 0.85, source: "public statements" },
          { topic: "China Manufacturing", stance: 0.4, confidence: 0.5, source: "business decisions" },
        ],
      },
      {
        id: "mil-001",
        name: "General Lloyd Austin",
        type: "defense",
        role: "Secretary of Defense",
        affiliation: "Department of Defense",
        biography: "27th United States Secretary of Defense. Former Commanding General of CENTCOM.",
        attributes: {
          decisionStyle: "consensus",
          riskProfile: 0.4,
          influenceScore: 0.95,
          publicPrivateDivergence: 0.5,
          values: ["readiness", "alliance management", "deterrence"],
        },
        positions: [
          { topic: "Taiwan Defense", stance: 0.7, confidence: 0.8, source: "testimony" },
          { topic: "Ukraine Support", stance: 0.85, confidence: 0.9, source: "policy actions" },
        ],
      },
    ];
  }
}

// Singleton instance
export const nyneClient = new NyneClient();
