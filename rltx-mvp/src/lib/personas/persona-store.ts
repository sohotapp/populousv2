/**
 * PersonaStore - Supabase persistence layer for compiled VIP personas
 *
 * Manages the full lifecycle of VIP personas:
 * - Storing compiled personas from nyne.ai data
 * - Tracking collection status and credit usage
 * - Managing refresh cycles for stale data
 * - Bulk operations for efficient batch processing
 * - Logging all collection activities
 *
 * Uses the existing `vipAgents` and `collectionLog` tables in Supabase.
 */

import { db } from "@/db";
import {
  vipAgents,
  collectionLog,
  type BigFiveTraits,
  type MoralFoundations,
  type VIPPsychographics,
  type TopicInterest,
  type KnownPosition,
  type AgentNetwork,
} from "@/db/schema";
import { eq, and, or, lt, isNull, sql, desc, asc, inArray } from "drizzle-orm";
import type { CompiledPersona, RawVIPData } from "@/lib/synthesis/persona-compiler";
import type {
  NyneInterests,
  NyneNewsfeed,
  NyneEnrichment,
  NyneSocialProfiles,
} from "@/lib/collectors/nyne-collector";
import crypto from "crypto";

// =============================================================================
// TYPES
// =============================================================================

export type CollectionStatus = "pending" | "partial" | "complete" | "error" | "stale";
export type VIPVertical = "enterprise" | "political" | "defense";
export type VIPTier = "A" | "B" | "C";

export interface StoredPersona {
  id: string;
  nyneId?: string;
  name: string;
  vertical: VIPVertical;
  tier: VIPTier;
  domain: string;
  role: string;
  affiliation?: string;
  priorityRank?: number;

  // Compiled psychographics
  biography?: string;
  communicationStyle?: string;
  sampleContent?: string[];
  bigFive?: BigFiveTraits;
  moralFoundations?: MoralFoundations;
  psychographics?: VIPPsychographics;
  topicInterests?: TopicInterest[];
  knownPositions?: KnownPosition[];
  network?: AgentNetwork;

  // Raw nyne.ai data
  nyneRawInterests?: NyneInterests;
  nyneRawNewsfeed?: NyneNewsfeed;
  nyneRawEnrichment?: NyneEnrichment;
  nyneRawSocial?: NyneSocialProfiles;

  // Collection tracking
  collectionStatus: CollectionStatus;
  creditsUsed: number;
  lastSyncedAt?: Date;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonaInput {
  // From VIP seed list
  seedData: RawVIPData & {
    id: string;
    vertical: VIPVertical;
    tier: VIPTier;
    priorityRank?: number;
  };

  // Raw nyne.ai responses
  rawData?: {
    interests?: NyneInterests;
    newsfeed?: NyneNewsfeed;
    enrichment?: NyneEnrichment;
    social?: NyneSocialProfiles;
  };

  // Compiled persona (from PersonaCompiler)
  compiled?: CompiledPersona;

  // Collection metadata
  creditsUsed?: number;
  collectionStatus?: CollectionStatus;
}

export interface CollectionLogEntry {
  vipId: string;
  vipName: string;
  apiEndpoint: "interests" | "newsfeed" | "enrichment" | "social";
  creditsUsed: number;
  status: "success" | "error" | "rate_limited" | "not_found";
  errorMessage?: string;
  responseSize?: number;
  requestDurationMs?: number;
}

export interface PersonaQueryOptions {
  vertical?: VIPVertical;
  tier?: VIPTier;
  domain?: string;
  collectionStatus?: CollectionStatus | CollectionStatus[];
  limit?: number;
  offset?: number;
  orderBy?: "priority" | "name" | "updated" | "created";
  orderDir?: "asc" | "desc";
}

export interface CollectionStats {
  total: number;
  byStatus: Record<CollectionStatus, number>;
  byVertical: Record<VIPVertical, number>;
  byTier: Record<VIPTier, number>;
  creditsUsed: number;
  lastCollectionAt?: Date;
  needsRefresh: number;
}

export interface RefreshPolicy {
  maxAge: {
    tierA: number; // hours
    tierB: number;
    tierC: number;
  };
  prioritizeIncomplete: boolean;
}

const DEFAULT_REFRESH_POLICY: RefreshPolicy = {
  maxAge: {
    tierA: 24 * 30, // 30 days
    tierB: 24 * 90, // 90 days
    tierC: 24 * 365, // 1 year
  },
  prioritizeIncomplete: true,
};

// =============================================================================
// PERSONA STORE CLASS
// =============================================================================

export class PersonaStore {
  private refreshPolicy: RefreshPolicy;

  constructor(options?: { refreshPolicy?: Partial<RefreshPolicy> }) {
    this.refreshPolicy = {
      ...DEFAULT_REFRESH_POLICY,
      ...options?.refreshPolicy,
      maxAge: {
        ...DEFAULT_REFRESH_POLICY.maxAge,
        ...options?.refreshPolicy?.maxAge,
      },
    };
  }

  /**
   * Check if database is available
   */
  isAvailable(): boolean {
    return db !== null;
  }

  // ===========================================================================
  // WRITE OPERATIONS
  // ===========================================================================

  /**
   * Save or update a compiled persona to Supabase
   * This is the main entry point for persisting personas after collection
   */
  async savePersona(input: PersonaInput): Promise<StoredPersona> {
    if (!db) {
      throw new Error("Database not available. Set DATABASE_URL environment variable.");
    }

    const { seedData, rawData, compiled, creditsUsed = 0, collectionStatus = "pending" } = input;

    // Determine actual collection status based on what data we have
    let status: CollectionStatus = collectionStatus;
    if (compiled && rawData?.interests && rawData?.newsfeed && rawData?.enrichment) {
      status = "complete";
    } else if (compiled || rawData?.interests || rawData?.newsfeed || rawData?.enrichment) {
      status = "partial";
    }

    const now = new Date();

    const record = {
      nyneId: seedData.id || null,
      name: compiled?.name || seedData.name,
      vertical: seedData.vertical,
      tier: seedData.tier,
      domain: seedData.domain,
      role: seedData.role,
      affiliation: seedData.affiliation || null,
      priorityRank: seedData.priorityRank || null,

      // Compiled data
      biography: compiled?.biography || null,
      communicationStyle: compiled?.communicationStyle || null,
      sampleContent: compiled?.sampleContent || null,
      bigFive: compiled?.bigFive || null,
      moralFoundations: compiled?.moralFoundations || null,
      psychographics: compiled?.psychographics || null,
      topicInterests: compiled?.topicInterests || null,
      knownPositions: compiled?.knownPositions || null,

      // Raw nyne.ai data (preserved for reprocessing)
      // Cast to Record<string, unknown> to match schema type
      nyneRawInterests: rawData?.interests
        ? (rawData.interests as unknown as Record<string, unknown>)
        : null,
      nyneRawNewsfeed: rawData?.newsfeed
        ? (rawData.newsfeed as unknown as Record<string, unknown>)
        : null,
      nyneRawEnrichment: rawData?.enrichment
        ? (rawData.enrichment as unknown as Record<string, unknown>)
        : null,
      nyneRawSocial: rawData?.social
        ? (rawData.social as unknown as Record<string, unknown>)
        : null,

      // Collection tracking
      collectionStatus: status,
      creditsUsed,
      lastSyncedAt: now,
      updatedAt: now,
    };

    // Upsert: update if nyneId exists, insert otherwise
    let result: typeof vipAgents.$inferSelect;

    if (seedData.id) {
      // Try to find existing record by nyneId
      const existing = await db
        .select()
        .from(vipAgents)
        .where(eq(vipAgents.nyneId, seedData.id))
        .limit(1);

      if (existing.length > 0) {
        // Update existing record
        const updated = await db
          .update(vipAgents)
          .set(record)
          .where(eq(vipAgents.id, existing[0].id))
          .returning();
        result = updated[0];
      } else {
        // Insert new record
        const inserted = await db
          .insert(vipAgents)
          .values({ ...record, createdAt: now })
          .returning();
        result = inserted[0];
      }
    } else {
      // Insert new record
      const inserted = await db
        .insert(vipAgents)
        .values({ ...record, createdAt: now })
        .returning();
      result = inserted[0];
    }

    return this.mapToStoredPersona(result);
  }

  /**
   * Save multiple personas in a batch (more efficient for bulk operations)
   */
  async savePersonasBatch(
    inputs: PersonaInput[],
    options?: {
      onProgress?: (saved: number, total: number) => void;
      batchSize?: number;
    }
  ): Promise<{ saved: number; errors: Array<{ input: PersonaInput; error: string }> }> {
    if (!db) {
      throw new Error("Database not available");
    }

    const batchSize = options?.batchSize || 50;
    let saved = 0;
    const errors: Array<{ input: PersonaInput; error: string }> = [];

    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);

      for (const input of batch) {
        try {
          await this.savePersona(input);
          saved++;
        } catch (error) {
          errors.push({
            input,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      options?.onProgress?.(saved, inputs.length);
    }

    return { saved, errors };
  }

  /**
   * Update collection status for a persona
   */
  async updateCollectionStatus(
    id: string,
    status: CollectionStatus,
    creditsUsed?: number
  ): Promise<void> {
    if (!db) return;

    const update: Partial<typeof vipAgents.$inferInsert> = {
      collectionStatus: status,
      updatedAt: new Date(),
    };

    if (creditsUsed !== undefined) {
      update.creditsUsed = creditsUsed;
    }

    if (status === "complete") {
      update.lastSyncedAt = new Date();
    }

    await db.update(vipAgents).set(update).where(eq(vipAgents.id, id));
  }

  /**
   * Mark personas as stale based on refresh policy
   */
  async markStalePersonas(): Promise<number> {
    if (!db) return 0;

    const now = new Date();

    // Calculate cutoff dates for each tier
    const tierACutoff = new Date(now.getTime() - this.refreshPolicy.maxAge.tierA * 60 * 60 * 1000);
    const tierBCutoff = new Date(now.getTime() - this.refreshPolicy.maxAge.tierB * 60 * 60 * 1000);
    const tierCCutoff = new Date(now.getTime() - this.refreshPolicy.maxAge.tierC * 60 * 60 * 1000);

    // Update tier A that are past cutoff
    const tierAResult = await db
      .update(vipAgents)
      .set({ collectionStatus: "stale", updatedAt: now })
      .where(
        and(
          eq(vipAgents.tier, "A"),
          eq(vipAgents.collectionStatus, "complete"),
          lt(vipAgents.lastSyncedAt, tierACutoff)
        )
      )
      .returning({ id: vipAgents.id });

    // Update tier B
    const tierBResult = await db
      .update(vipAgents)
      .set({ collectionStatus: "stale", updatedAt: now })
      .where(
        and(
          eq(vipAgents.tier, "B"),
          eq(vipAgents.collectionStatus, "complete"),
          lt(vipAgents.lastSyncedAt, tierBCutoff)
        )
      )
      .returning({ id: vipAgents.id });

    // Update tier C
    const tierCResult = await db
      .update(vipAgents)
      .set({ collectionStatus: "stale", updatedAt: now })
      .where(
        and(
          eq(vipAgents.tier, "C"),
          eq(vipAgents.collectionStatus, "complete"),
          lt(vipAgents.lastSyncedAt, tierCCutoff)
        )
      )
      .returning({ id: vipAgents.id });

    return tierAResult.length + tierBResult.length + tierCResult.length;
  }

  /**
   * Delete a persona by ID
   */
  async deletePersona(id: string): Promise<boolean> {
    if (!db) return false;

    const result = await db
      .delete(vipAgents)
      .where(eq(vipAgents.id, id))
      .returning({ id: vipAgents.id });

    return result.length > 0;
  }

  // ===========================================================================
  // READ OPERATIONS
  // ===========================================================================

  /**
   * Get a single persona by ID
   */
  async getPersona(id: string): Promise<StoredPersona | null> {
    if (!db) return null;

    const results = await db.select().from(vipAgents).where(eq(vipAgents.id, id)).limit(1);

    if (results.length === 0) return null;
    return this.mapToStoredPersona(results[0]);
  }

  /**
   * Get a persona by nyne.ai ID
   */
  async getPersonaByNyneId(nyneId: string): Promise<StoredPersona | null> {
    if (!db) return null;

    const results = await db
      .select()
      .from(vipAgents)
      .where(eq(vipAgents.nyneId, nyneId))
      .limit(1);

    if (results.length === 0) return null;
    return this.mapToStoredPersona(results[0]);
  }

  /**
   * Get a persona by name (fuzzy search)
   */
  async getPersonaByName(name: string): Promise<StoredPersona | null> {
    if (!db) return null;

    const results = await db
      .select()
      .from(vipAgents)
      .where(sql`lower(${vipAgents.name}) LIKE lower(${"%" + name + "%"})`)
      .limit(1);

    if (results.length === 0) return null;
    return this.mapToStoredPersona(results[0]);
  }

  /**
   * Query personas with filtering and pagination
   */
  async queryPersonas(options: PersonaQueryOptions = {}): Promise<{
    personas: StoredPersona[];
    total: number;
  }> {
    if (!db) return { personas: [], total: 0 };

    const {
      vertical,
      tier,
      domain,
      collectionStatus,
      limit = 100,
      offset = 0,
      orderBy = "priority",
      orderDir = "asc",
    } = options;

    // Build conditions
    const conditions = [];

    if (vertical) {
      conditions.push(eq(vipAgents.vertical, vertical));
    }

    if (tier) {
      conditions.push(eq(vipAgents.tier, tier));
    }

    if (domain) {
      conditions.push(eq(vipAgents.domain, domain));
    }

    if (collectionStatus) {
      if (Array.isArray(collectionStatus)) {
        conditions.push(inArray(vipAgents.collectionStatus, collectionStatus));
      } else {
        conditions.push(eq(vipAgents.collectionStatus, collectionStatus));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Determine order column
    const orderColumn =
      orderBy === "priority"
        ? vipAgents.priorityRank
        : orderBy === "name"
          ? vipAgents.name
          : orderBy === "updated"
            ? vipAgents.updatedAt
            : vipAgents.createdAt;

    const orderFn = orderDir === "desc" ? desc : asc;

    // Execute query
    const [results, countResult] = await Promise.all([
      db
        .select()
        .from(vipAgents)
        .where(whereClause)
        .orderBy(orderFn(orderColumn))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(vipAgents)
        .where(whereClause),
    ]);

    return {
      personas: results.map((r) => this.mapToStoredPersona(r)),
      total: countResult[0]?.count || 0,
    };
  }

  /**
   * Get personas that need collection (pending, partial, or stale)
   */
  async getPersonasNeedingCollection(options?: {
    vertical?: VIPVertical;
    limit?: number;
    prioritizeIncomplete?: boolean;
  }): Promise<StoredPersona[]> {
    if (!db) return [];

    const {
      vertical,
      limit = 100,
      prioritizeIncomplete = this.refreshPolicy.prioritizeIncomplete,
    } = options || {};

    const conditions = [
      inArray(vipAgents.collectionStatus, ["pending", "partial", "stale", "error"]),
    ];

    if (vertical) {
      conditions.push(eq(vipAgents.vertical, vertical));
    }

    // Build order: tier A first, then by priority rank
    // If prioritizeIncomplete, put pending/partial before stale
    let query = db
      .select()
      .from(vipAgents)
      .where(and(...conditions))
      .orderBy(
        // Tier order: A=1, B=2, C=3
        sql`CASE WHEN ${vipAgents.tier} = 'A' THEN 1 WHEN ${vipAgents.tier} = 'B' THEN 2 ELSE 3 END`,
        // Status priority if prioritizeIncomplete
        prioritizeIncomplete
          ? sql`CASE WHEN ${vipAgents.collectionStatus} IN ('pending', 'partial') THEN 0 ELSE 1 END`
          : sql`1`,
        // Then by priority rank
        asc(vipAgents.priorityRank)
      )
      .limit(limit);

    const results = await query;
    return results.map((r) => this.mapToStoredPersona(r));
  }

  /**
   * Get personas that are ready for simulation (complete status)
   */
  async getSimulationReadyPersonas(options?: {
    vertical?: VIPVertical;
    limit?: number;
  }): Promise<StoredPersona[]> {
    const { personas } = await this.queryPersonas({
      vertical: options?.vertical,
      collectionStatus: "complete",
      limit: options?.limit || 1000,
      orderBy: "priority",
    });

    return personas;
  }

  // ===========================================================================
  // COLLECTION LOGGING
  // ===========================================================================

  /**
   * Log a collection attempt (success or failure)
   */
  async logCollectionAttempt(entry: CollectionLogEntry): Promise<void> {
    if (!db) return;

    const responseHash = entry.status === "success" ? this.computeHash(JSON.stringify(entry)) : null;

    await db.insert(collectionLog).values({
      vipId: entry.vipId,
      vipName: entry.vipName,
      apiEndpoint: entry.apiEndpoint,
      creditsUsed: entry.creditsUsed,
      status: entry.status,
      errorMessage: entry.errorMessage || null,
      responseHash,
      responseSize: entry.responseSize || null,
      requestDurationMs: entry.requestDurationMs || null,
      collectedAt: new Date(),
    });
  }

  /**
   * Get collection history for a VIP
   */
  async getCollectionHistory(
    vipId: string,
    limit: number = 50
  ): Promise<Array<typeof collectionLog.$inferSelect>> {
    if (!db) return [];

    return db
      .select()
      .from(collectionLog)
      .where(eq(collectionLog.vipId, vipId))
      .orderBy(desc(collectionLog.collectedAt))
      .limit(limit);
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get comprehensive collection statistics
   */
  async getCollectionStats(): Promise<CollectionStats> {
    if (!db) {
      return {
        total: 0,
        byStatus: { pending: 0, partial: 0, complete: 0, error: 0, stale: 0 },
        byVertical: { enterprise: 0, political: 0, defense: 0 },
        byTier: { A: 0, B: 0, C: 0 },
        creditsUsed: 0,
        needsRefresh: 0,
      };
    }

    // Get counts by status
    const statusCounts = await db
      .select({
        status: vipAgents.collectionStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(vipAgents)
      .groupBy(vipAgents.collectionStatus);

    // Get counts by vertical
    const verticalCounts = await db
      .select({
        vertical: vipAgents.vertical,
        count: sql<number>`count(*)::int`,
      })
      .from(vipAgents)
      .groupBy(vipAgents.vertical);

    // Get counts by tier
    const tierCounts = await db
      .select({
        tier: vipAgents.tier,
        count: sql<number>`count(*)::int`,
      })
      .from(vipAgents)
      .groupBy(vipAgents.tier);

    // Get total credits used
    const creditsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${vipAgents.creditsUsed}), 0)::int`,
      })
      .from(vipAgents);

    // Get last collection timestamp
    const lastCollection = await db
      .select({ lastSyncedAt: vipAgents.lastSyncedAt })
      .from(vipAgents)
      .orderBy(desc(vipAgents.lastSyncedAt))
      .limit(1);

    // Count needing refresh
    const needsRefresh = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vipAgents)
      .where(inArray(vipAgents.collectionStatus, ["pending", "partial", "stale", "error"]));

    // Build response
    const byStatus: Record<CollectionStatus, number> = {
      pending: 0,
      partial: 0,
      complete: 0,
      error: 0,
      stale: 0,
    };
    for (const row of statusCounts) {
      if (row.status && row.status in byStatus) {
        byStatus[row.status as CollectionStatus] = row.count;
      }
    }

    const byVertical: Record<VIPVertical, number> = {
      enterprise: 0,
      political: 0,
      defense: 0,
    };
    for (const row of verticalCounts) {
      if (row.vertical && row.vertical in byVertical) {
        byVertical[row.vertical as VIPVertical] = row.count;
      }
    }

    const byTier: Record<VIPTier, number> = { A: 0, B: 0, C: 0 };
    for (const row of tierCounts) {
      if (row.tier && row.tier in byTier) {
        byTier[row.tier as VIPTier] = row.count;
      }
    }

    const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

    return {
      total,
      byStatus,
      byVertical,
      byTier,
      creditsUsed: creditsResult[0]?.total || 0,
      lastCollectionAt: lastCollection[0]?.lastSyncedAt || undefined,
      needsRefresh: needsRefresh[0]?.count || 0,
    };
  }

  /**
   * Get credit usage statistics from collection log
   */
  async getCreditUsageStats(options?: {
    since?: Date;
    groupBy?: "day" | "week" | "month";
  }): Promise<Array<{ period: string; credits: number; requests: number }>> {
    if (!db) return [];

    const since = options?.since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
    const groupBy = options?.groupBy || "day";

    const dateFormat =
      groupBy === "day"
        ? "YYYY-MM-DD"
        : groupBy === "week"
          ? "YYYY-IW"
          : "YYYY-MM";

    const results = await db
      .select({
        period: sql<string>`to_char(${collectionLog.collectedAt}, ${dateFormat})`,
        credits: sql<number>`SUM(${collectionLog.creditsUsed})::int`,
        requests: sql<number>`count(*)::int`,
      })
      .from(collectionLog)
      .where(sql`${collectionLog.collectedAt} >= ${since}`)
      .groupBy(sql`to_char(${collectionLog.collectedAt}, ${dateFormat})`)
      .orderBy(sql`to_char(${collectionLog.collectedAt}, ${dateFormat})`);

    return results;
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Map database record to StoredPersona type
   */
  private mapToStoredPersona(record: typeof vipAgents.$inferSelect): StoredPersona {
    return {
      id: record.id,
      nyneId: record.nyneId || undefined,
      name: record.name,
      vertical: record.vertical as VIPVertical,
      tier: record.tier as VIPTier,
      domain: record.domain,
      role: record.role,
      affiliation: record.affiliation || undefined,
      priorityRank: record.priorityRank || undefined,

      biography: record.biography || undefined,
      communicationStyle: record.communicationStyle || undefined,
      sampleContent: record.sampleContent as string[] | undefined,
      bigFive: record.bigFive as BigFiveTraits | undefined,
      moralFoundations: record.moralFoundations as MoralFoundations | undefined,
      psychographics: record.psychographics as VIPPsychographics | undefined,
      topicInterests: record.topicInterests as TopicInterest[] | undefined,
      knownPositions: record.knownPositions as KnownPosition[] | undefined,
      network: record.network as AgentNetwork | undefined,

      nyneRawInterests: record.nyneRawInterests as unknown as NyneInterests | undefined,
      nyneRawNewsfeed: record.nyneRawNewsfeed as unknown as NyneNewsfeed | undefined,
      nyneRawEnrichment: record.nyneRawEnrichment as unknown as NyneEnrichment | undefined,
      nyneRawSocial: record.nyneRawSocial as unknown as NyneSocialProfiles | undefined,

      collectionStatus: (record.collectionStatus || "pending") as CollectionStatus,
      creditsUsed: record.creditsUsed || 0,
      lastSyncedAt: record.lastSyncedAt || undefined,

      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Compute hash for deduplication
   */
  private computeHash(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let storeInstance: PersonaStore | null = null;

export function getPersonaStore(options?: { refreshPolicy?: Partial<RefreshPolicy> }): PersonaStore {
  if (!storeInstance) {
    storeInstance = new PersonaStore(options);
  }
  return storeInstance;
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export const personaStore = new PersonaStore();
