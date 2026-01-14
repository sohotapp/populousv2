import { NextRequest, NextResponse } from "next/server";

// POST /api/sources/[id]/sync - Trigger data sync from source
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // In production, this would trigger PyAirbyte sync job
    // For demo, simulate a sync with random data

    // Simulate sync delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const recordCount = Math.floor(Math.random() * 5000) + 1000;
    const durationMs = Math.floor(Math.random() * 30000) + 5000;

    return NextResponse.json({
      success: true,
      sourceId: id,
      syncedAt: new Date().toISOString(),
      recordCount,
      durationMs,
      streams: [
        { name: "contacts", records: Math.floor(recordCount * 0.6) },
        { name: "leads", records: Math.floor(recordCount * 0.3) },
        { name: "accounts", records: Math.floor(recordCount * 0.1) },
      ],
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync source" },
      { status: 500 }
    );
  }
}
