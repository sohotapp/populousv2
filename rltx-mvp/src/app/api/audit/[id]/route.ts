import { NextRequest, NextResponse } from "next/server";
import { getSimulationAudit } from "@/lib/simulation/run-store";

/**
 * GET /api/audit/:id
 * Returns audit record for a simulation run.
 */
export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  const auditId = context.params.id;
  const audit = getSimulationAudit(auditId);

  if (!audit) {
    return NextResponse.json({ error: "Audit record not found" }, { status: 404 });
  }

  return NextResponse.json({ audit });
}
