/**
 * GET /api/personas/status
 *
 * Returns collection statistics and VIP persona status.
 * Used to monitor the state of the persona database.
 */

import { NextRequest } from "next/server";
import { getPersonaStore } from "@/lib/personas/persona-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const store = getPersonaStore();
    const searchParams = request.nextUrl.searchParams;

    // Check for detailed query
    const detailed = searchParams.get("detailed") === "true";
    const vertical = searchParams.get("vertical") as
      | "enterprise"
      | "political"
      | "defense"
      | null;

    // Get collection stats
    const stats = await store.getCollectionStats();

    // Get credit usage stats (returns array of daily stats)
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dailyStats = await store.getCreditUsageStats({ since: monthAgo, groupBy: "day" });

    // Compute totals from daily stats
    const totalCredits = stats.creditsUsed; // Use from main stats
    const todayCredits = dailyStats
      .filter(d => new Date(d.period) >= dayAgo)
      .reduce((sum, d) => sum + d.credits, 0);
    const weekCredits = dailyStats
      .filter(d => new Date(d.period) >= weekAgo)
      .reduce((sum, d) => sum + d.credits, 0);
    const monthCredits = dailyStats
      .reduce((sum, d) => sum + d.credits, 0);

    // Build response
    const response: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      collection: {
        total: stats.total,
        byStatus: stats.byStatus,
        byVertical: stats.byVertical,
        byTier: stats.byTier,
        needsRefresh: stats.needsRefresh,
        creditsUsed: stats.creditsUsed,
      },
      credits: {
        total: totalCredits,
        today: todayCredits,
        thisWeek: weekCredits,
        thisMonth: monthCredits,
        budget: 9000, // Pro plan budget
        remaining: 9000 - totalCredits,
      },
    };

    // Add detailed breakdown if requested
    if (detailed) {
      // Get VIPs needing collection
      const needingCollection = await store.getPersonasNeedingCollection({
        vertical: vertical || undefined,
        limit: 50,
      });

      // Get simulation-ready personas
      const simulationReady = await store.getSimulationReadyPersonas({
        vertical: vertical || undefined,
        limit: 50,
      });

      response.details = {
        needingCollection: needingCollection.map((p) => ({
          id: p.id,
          name: p.name,
          vertical: p.vertical,
          tier: p.tier,
          status: p.collectionStatus,
        })),
        simulationReady: simulationReady.map((p) => ({
          id: p.id,
          name: p.name,
          vertical: p.vertical,
          tier: p.tier,
          domain: p.domain,
          hasCompiledProfile: !!p.bigFive,
        })),
      };
    }

    return Response.json(response);
  } catch (error) {
    console.error("[/api/personas/status] Error:", error);

    // Return meaningful error with fallback stats
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to get status",
        timestamp: new Date().toISOString(),
        collection: {
          total: 0,
          byStatus: { pending: 0, partial: 0, complete: 0, error: 0, stale: 0 },
          byVertical: {
            enterprise: 0,
            political: 0,
            defense: 0,
          },
          byTier: { A: 0, B: 0, C: 0 },
          needsRefresh: 0,
          creditsUsed: 0,
        },
        credits: {
          total: 0,
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
          budget: 9000,
          remaining: 9000,
        },
        note: "Database may not be connected. Check ENABLE_DATABASE flag.",
      },
      { status: 500 }
    );
  }
}
