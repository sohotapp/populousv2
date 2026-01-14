import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { workflows } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// Mock data for demo mode (no database)
const mockWorkflows = [
  {
    id: "demo-workflow-1",
    name: "Market Expansion Analysis",
    question: "Should we expand into the European market?",
    graph: { nodes: [], edges: [] },
    status: "draft",
    createdBy: "demo-user",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// GET /api/workflows - List all workflows
export async function GET(request: NextRequest) {
  try {
    // Demo mode without database
    if (!db) {
      return NextResponse.json(mockWorkflows);
    }

    // In production, get user from auth
    const userId = "demo-user";

    const userWorkflows = await db
      .select()
      .from(workflows)
      .where(eq(workflows.createdBy, userId))
      .orderBy(desc(workflows.updatedAt));

    return NextResponse.json(userWorkflows);
  } catch (error) {
    console.error("Failed to fetch workflows:", error);
    return NextResponse.json(mockWorkflows);
  }
}

// POST /api/workflows - Create a new workflow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, question } = body;

    if (!name || !question) {
      return NextResponse.json(
        { error: "Name and question are required" },
        { status: 400 }
      );
    }

    // Demo mode without database
    if (!db) {
      const newWorkflow = {
        id: `demo-${Date.now()}`,
        name,
        question,
        graph: { nodes: [], edges: [] },
        status: "draft",
        createdBy: "demo-user",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return NextResponse.json(newWorkflow);
    }

    // In production, get user from auth
    const userId = "demo-user";

    const [workflow] = await db
      .insert(workflows)
      .values({
        name,
        question,
        graph: { nodes: [], edges: [] },
        status: "draft",
        createdBy: userId,
      })
      .returning();

    return NextResponse.json(workflow);
  } catch (error) {
    console.error("Failed to create workflow:", error);
    return NextResponse.json(
      { error: "Failed to create workflow" },
      { status: 500 }
    );
  }
}
