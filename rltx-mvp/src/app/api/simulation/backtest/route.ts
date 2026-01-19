/**
 * Backtest API
 * 
 * POST /api/simulation/backtest
 * Runs simulations against historical validation events
 * 
 * GET /api/simulation/backtest
 * Returns backtest history and accuracy metrics
 */

import { NextRequest, NextResponse } from "next/server";
import {
  runBacktest,
  getValidationEvents,
  getBacktestHistory,
  getAccuracyTrend,
  createValidationEvent,
} from "@/lib/validation/backtest";

/**
 * POST - Run backtest against validation events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventIds, vertical, config } = body;

    // If eventIds provided, run against those
    if (eventIds && Array.isArray(eventIds) && eventIds.length > 0) {
      const results = await runBacktest(eventIds, config);
      return NextResponse.json(results);
    }

    // If vertical provided, get events for that vertical and run
    if (vertical) {
      const events = await getValidationEvents(vertical, 10);
      if (events.length === 0) {
        return NextResponse.json(
          { error: `No validation events found for vertical: ${vertical}` },
          { status: 404 }
        );
      }

      const eventIdsToRun = events.map((e) => e.id);
      const results = await runBacktest(eventIdsToRun, config);
      return NextResponse.json(results);
    }

    return NextResponse.json(
      { error: "Either eventIds or vertical is required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[backtest] Error:", error);
    return NextResponse.json(
      { error: "Backtest failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET - Get backtest history and metrics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vertical = searchParams.get("vertical") || "enterprise";
    const days = parseInt(searchParams.get("days") || "90", 10);
    const includeEvents = searchParams.get("includeEvents") === "true";

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get backtest history
    const history = await getBacktestHistory(startDate, endDate, vertical);

    // Get accuracy trend
    const trend = await getAccuracyTrend(vertical, 7);

    // Calculate summary statistics
    const completedBacktests = history.filter((h) => h.accuracyScore > 0);
    const avgAccuracy = completedBacktests.length > 0
      ? completedBacktests.reduce((sum, h) => sum + h.accuracyScore, 0) / completedBacktests.length
      : 0;
    const avgBrier = completedBacktests.length > 0
      ? completedBacktests.reduce((sum, h) => sum + h.brierScore, 0) / completedBacktests.length
      : 0;

    // Optionally include validation events
    let events = null;
    if (includeEvents) {
      events = await getValidationEvents(vertical, 20);
    }

    return NextResponse.json({
      vertical,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      summary: {
        totalBacktests: history.length,
        averageAccuracy: avgAccuracy,
        averageBrierScore: avgBrier,
        recentTrend: trend.length > 1
          ? trend[trend.length - 1].accuracy - trend[0].accuracy
          : 0,
      },
      trend,
      history: history.slice(0, 20), // Limit to recent 20
      events,
    });
  } catch (error) {
    console.error("[backtest] GET Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch backtest data" },
      { status: 500 }
    );
  }
}

/**
 * PUT - Create a new validation event
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventType, eventDate, description, vertical, scenario, actualOutcome, groundTruthSource } = body;

    if (!eventType || !eventDate || !vertical || !actualOutcome) {
      return NextResponse.json(
        { error: "eventType, eventDate, vertical, and actualOutcome are required" },
        { status: 400 }
      );
    }

    const eventId = await createValidationEvent({
      eventType,
      eventDate: new Date(eventDate),
      description: description || "",
      vertical,
      scenario: scenario || {},
      actualOutcome,
      groundTruthSource,
    });

    return NextResponse.json({ id: eventId, success: true });
  } catch (error) {
    console.error("[backtest] PUT Error:", error);
    return NextResponse.json(
      { error: "Failed to create validation event" },
      { status: 500 }
    );
  }
}
