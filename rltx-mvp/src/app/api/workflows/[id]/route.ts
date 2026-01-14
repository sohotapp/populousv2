import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { workflows } from "@/db/schema";
import { eq } from "drizzle-orm";

interface RouteParams {
  params: { id: string };
}

// Demo workflow for when database is not available
const getDemoWorkflow = (id: string) => ({
  id,
  name: "Market Expansion Analysis",
  question: "Should we expand into the European market?",
  graph: { nodes: [], edges: [] },
  status: "draft",
  createdBy: "demo-user",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// GET /api/workflows/[id] - Get a single workflow
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Demo mode without database
    if (!db) {
      return NextResponse.json(getDemoWorkflow(id));
    }

    const [workflow] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, id));

    if (!workflow) {
      return NextResponse.json(getDemoWorkflow(id));
    }

    return NextResponse.json(workflow);
  } catch (error) {
    console.error("Failed to fetch workflow:", error);
    const { id } = params;
    return NextResponse.json(getDemoWorkflow(id));
  }
}

// PATCH /api/workflows/[id] - Update a workflow
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await request.json();

    // Demo mode without database
    if (!db) {
      return NextResponse.json({
        ...getDemoWorkflow(id),
        ...body,
        updatedAt: new Date().toISOString(),
      });
    }

    const [workflow] = await db
      .update(workflows)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, id))
      .returning();

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(workflow);
  } catch (error) {
    console.error("Failed to update workflow:", error);
    return NextResponse.json(
      { error: "Failed to update workflow" },
      { status: 500 }
    );
  }
}

// DELETE /api/workflows/[id] - Delete a workflow
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Demo mode without database
    if (!db) {
      return NextResponse.json({ success: true });
    }

    const [deleted] = await db
      .delete(workflows)
      .where(eq(workflows.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete workflow:", error);
    return NextResponse.json(
      { error: "Failed to delete workflow" },
      { status: 500 }
    );
  }
}
