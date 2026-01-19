import { NextRequest, NextResponse } from "next/server";
import { listSimulationRuns, getRunStatistics } from "@/lib/simulation/run-store";

/**
 * GET /api/simulation/history
 * Returns recent simulation runs for audit/history views.
 * 
 * Query params:
 * - limit: number (default 50, max 200)
 * - includeStats: boolean (default false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const includeStats = searchParams.get("includeStats") === "true";
    const limit = Math.min(Number(limitParam || 50) || 50, 200);

    // Fetch runs from persistent store
    const allRuns = await listSimulationRuns(limit);
    
    const runs = allRuns.map((run) => ({
      id: run.id,
      status: run.status,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      auditId: run.auditId,
      query: run.config.query,
      summary: run.result?.summary,
      error: run.error,
    }));

    // Optionally include statistics
    let stats = null;
    if (includeStats) {
      stats = await getRunStatistics();
    }

    return NextResponse.json({ 
      runs,
      stats,
      total: runs.length,
    });
  } catch (error) {
    console.error("[history] Failed to fetch simulation history:", error);
    return NextResponse.json(
      { error: "Failed to fetch simulation history", runs: [] },
      { status: 500 }
    );
  }
}
