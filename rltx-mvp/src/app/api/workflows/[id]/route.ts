import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { workflows } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getWorkflow,
  updateWorkflow as updateMockWorkflow,
  deleteWorkflow as deleteMockWorkflow,
} from "@/lib/mock-db";

interface RouteParams {
  params: { id: string };
}

// GET /api/workflows/[id] - Get a single workflow
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Demo mode without database
    if (!db) {
      const workflow = getWorkflow(id);
      if (workflow) {
        return NextResponse.json(workflow);
      }
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    const [workflow] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, id));

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(workflow);
  } catch (error) {
    console.error("Failed to fetch workflow:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflow" },
      { status: 500 }
    );
  }
}

// PATCH /api/workflows/[id] - Update a workflow
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await request.json();

    // Demo mode without database
    if (!db) {
      const updated = updateMockWorkflow(id, body);
      if (!updated) {
        return NextResponse.json(
          { error: "Workflow not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(updated);
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
      if (deleteMockWorkflow(id)) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
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
