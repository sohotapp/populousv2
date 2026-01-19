/**
 * Single Simulation Run API
 * 
 * GET /api/simulation/run/[id]
 * 
 * Retrieves a single simulation run by ID, including config and result.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSimulationRun } from "@/lib/simulation/run-store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: "Run ID is required" },
        { status: 400 }
      );
    }

    const run = await getSimulationRun(id);

    if (!run) {
      return NextResponse.json(
        { error: "Simulation run not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: run.id,
      status: run.status,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      config: run.config,
      result: run.result,
      error: run.error,
      auditId: run.auditId,
    });
  } catch (error) {
    console.error("[run/[id]] Failed to fetch simulation run:", error);
    return NextResponse.json(
      { error: "Failed to fetch simulation run" },
      { status: 500 }
    );
  }
}
