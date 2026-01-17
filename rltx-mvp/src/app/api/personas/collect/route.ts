/**
 * POST /api/personas/collect
 *
 * Triggers VIP persona collection from nyne.ai with progress streaming.
 * This is the manual trigger endpoint for admins to run collection.
 *
 * Request body:
 * - vertical?: "enterprise" | "political" | "defense" (filter by vertical)
 * - tier?: "A" | "B" | "C" (filter by tier)
 * - limit?: number (max VIPs to collect)
 * - creditBudget?: number (max credits to spend, default 5000)
 * - dryRun?: boolean (just return what would be collected)
 *
 * Response: Server-Sent Events stream with progress updates
 */

import { NextRequest } from "next/server";
import {
  CollectionOrchestrator,
  type CollectionFilter,
  type CollectionProgress,
  type CollectionSummary,
} from "@/lib/personas/collection-orchestrator";
import { type VIPVertical, type VIPTier } from "@/lib/personas/persona-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CollectRequest {
  vertical?: VIPVertical;
  tier?: VIPTier;
  limit?: number;
  creditBudget?: number;
  dryRun?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: CollectRequest = await request.json();
    const { vertical, tier, limit, creditBudget = 5000, dryRun = false } = body;

    // Validate inputs
    if (vertical && !["enterprise", "political", "defense"].includes(vertical)) {
      return Response.json(
        { error: "Invalid vertical. Must be: enterprise, political, or defense" },
        { status: 400 }
      );
    }

    if (tier && !["A", "B", "C"].includes(tier)) {
      return Response.json(
        { error: "Invalid tier. Must be: A, B, or C" },
        { status: 400 }
      );
    }

    // Create orchestrator with budget
    const orchestrator = new CollectionOrchestrator({
      creditBudget,
      enableAICompilation: true,
      continueOnError: true,
    });

    // Build filter
    const filter: CollectionFilter = {};
    if (vertical) filter.vertical = vertical;
    if (tier) filter.tier = tier;
    if (limit) filter.limit = limit;

    // Dry run - just return what would be collected
    if (dryRun) {
      const stats = await orchestrator.getStats();
      return Response.json({
        dryRun: true,
        filter,
        creditBudget,
        currentStats: stats,
        message: `Would collect VIPs matching filter. Current status: ${stats.byStatus.complete} complete, ${stats.byStatus.pending} pending.`,
      });
    }

    // Check if already running
    if (orchestrator.isActive()) {
      return Response.json(
        {
          error: "Collection already in progress",
          progress: orchestrator.getProgress(),
        },
        { status: 409 }
      );
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (type: string, data: unknown) => {
          const event = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(event));
        };

        // Send initial event
        sendEvent("started", {
          filter,
          creditBudget,
          timestamp: new Date().toISOString(),
        });

        try {
          // Run collection with progress callback
          const summary: CollectionSummary = await orchestrator.runCollection(
            filter,
            (progress: CollectionProgress) => {
              sendEvent("progress", {
                ...progress,
                timestamp: new Date().toISOString(),
              });
            }
          );

          // Send completion event
          sendEvent("completed", {
            summary: {
              success: summary.success,
              durationMs: summary.durationMs,
              totalProcessed: summary.totalProcessed,
              successfulCollections: summary.successfulCollections,
              failedCollections: summary.failedCollections,
              successfulCompilations: summary.successfulCompilations,
              failedCompilations: summary.failedCompilations,
              creditsUsed: summary.creditsUsed,
              creditBudget: summary.creditBudget,
              byVertical: summary.byVertical,
              byTier: summary.byTier,
              errorCount: summary.errors.length,
              errors: summary.errors.slice(0, 20), // Limit errors in response
            },
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          sendEvent("error", {
            error: message,
            timestamp: new Date().toISOString(),
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[/api/personas/collect] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Collection failed" },
      { status: 500 }
    );
  }
}

// GET - Check if collection is running and get progress
export async function GET() {
  try {
    const orchestrator = new CollectionOrchestrator();

    if (orchestrator.isActive()) {
      return Response.json({
        running: true,
        progress: orchestrator.getProgress(),
      });
    }

    return Response.json({
      running: false,
      message: "No collection in progress. POST to start collection.",
    });
  } catch (error) {
    console.error("[/api/personas/collect] GET Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to check status" },
      { status: 500 }
    );
  }
}
