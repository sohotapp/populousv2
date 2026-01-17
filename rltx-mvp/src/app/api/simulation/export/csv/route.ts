import { NextRequest, NextResponse } from "next/server";

interface ExportRequest {
  simulationResult: {
    id: string;
    query: string;
    timestamp: string;
    summary: {
      primaryMetric: number;
      primaryMetricLabel: string;
      confidenceInterval: { lower: number; upper: number };
      sampleSize: number;
      executionTime: number;
    };
    distribution: {
      type: string;
      values: Array<{ label: string; value: number }>;
    };
    segments?: Array<{
      name: string;
      value: number;
      count: number;
      delta: number;
    }>;
    drivers?: Array<{
      factor: string;
      importance: number;
      direction: string;
    }>;
    counterfactuals?: Array<{
      scenario: string;
      outcome: number;
      delta: number;
      significance: boolean;
    }>;
    accuracy: {
      ssrCalibration: number;
      sampleQuality: number;
      historicalFit: number;
    };
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json();
    const { simulationResult } = body;

    if (!simulationResult) {
      return NextResponse.json({ error: "Simulation result is required" }, { status: 400 });
    }

    const csvSections: string[] = [];

    // Summary section
    csvSections.push("SIMULATION SUMMARY");
    csvSections.push("Field,Value");
    csvSections.push(`Simulation ID,${simulationResult.id}`);
    csvSections.push(`Query,"${simulationResult.query.replace(/"/g, '""')}"`);
    csvSections.push(`Timestamp,${simulationResult.timestamp}`);
    csvSections.push(`Primary Outcome,${simulationResult.summary.primaryMetricLabel}`);
    csvSections.push(`Primary Metric,${(simulationResult.summary.primaryMetric * 100).toFixed(1)}%`);
    csvSections.push(`Confidence Interval Lower,${(simulationResult.summary.confidenceInterval.lower * 100).toFixed(1)}%`);
    csvSections.push(`Confidence Interval Upper,${(simulationResult.summary.confidenceInterval.upper * 100).toFixed(1)}%`);
    csvSections.push(`Sample Size,${simulationResult.summary.sampleSize}`);
    csvSections.push(`Execution Time,${simulationResult.summary.executionTime.toFixed(2)}s`);
    csvSections.push("");

    // Distribution section
    csvSections.push("RESPONSE DISTRIBUTION");
    csvSections.push("Category,Probability");
    for (const item of simulationResult.distribution.values) {
      csvSections.push(`"${item.label}",${(item.value * 100).toFixed(1)}%`);
    }
    csvSections.push("");

    // Segments section
    if (simulationResult.segments?.length) {
      csvSections.push("SEGMENT BREAKDOWN");
      csvSections.push("Segment,Response Rate,Count,Delta vs Average");
      for (const segment of simulationResult.segments) {
        csvSections.push(
          `"${segment.name}",${(segment.value * 100).toFixed(1)}%,${segment.count},${segment.delta > 0 ? "+" : ""}${segment.delta}%`
        );
      }
      csvSections.push("");
    }

    // Drivers section
    if (simulationResult.drivers?.length) {
      csvSections.push("KEY DRIVERS");
      csvSections.push("Factor,Importance,Direction");
      for (const driver of simulationResult.drivers) {
        csvSections.push(
          `"${driver.factor}",${(driver.importance * 100).toFixed(0)}%,${driver.direction}`
        );
      }
      csvSections.push("");
    }

    // Counterfactuals section
    if (simulationResult.counterfactuals?.length) {
      csvSections.push("COUNTERFACTUAL SCENARIOS");
      csvSections.push("Scenario,Outcome,Delta,Significant");
      for (const cf of simulationResult.counterfactuals) {
        csvSections.push(
          `"${cf.scenario}",${(cf.outcome * 100).toFixed(1)}%,${cf.delta > 0 ? "+" : ""}${cf.delta}%,${cf.significance ? "Yes" : "No"}`
        );
      }
      csvSections.push("");
    }

    // Accuracy metrics section
    csvSections.push("ACCURACY METRICS");
    csvSections.push("Metric,Value");
    csvSections.push(`SSR Calibration,${(simulationResult.accuracy.ssrCalibration * 100).toFixed(1)}%`);
    csvSections.push(`Sample Quality,${(simulationResult.accuracy.sampleQuality * 100).toFixed(1)}%`);
    csvSections.push(`Historical Fit,${(simulationResult.accuracy.historicalFit * 100).toFixed(1)}%`);

    const csvContent = csvSections.join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="simulation-${simulationResult.id}.csv"`,
      },
    });
  } catch (error) {
    console.error("CSV export error:", error);
    return NextResponse.json(
      { error: "Export failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
