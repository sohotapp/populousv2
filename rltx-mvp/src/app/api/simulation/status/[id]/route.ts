import { NextRequest, NextResponse } from "next/server";
import { getSimulationRun } from "@/lib/simulation/run-store";

/**
 * GET /api/simulation/status/:id
 * Returns run status + result (if completed).
 */
export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  const runId = context.params.id;
  const run = getSimulationRun(runId);

  if (!run) {
    return NextResponse.json({ error: "Simulation run not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: run.id,
    status: run.status,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    auditId: run.auditId,
    result: run.result,
    error: run.error,
  });
}
