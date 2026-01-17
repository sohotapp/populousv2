/**
 * Excel Export API for Simulation Results
 *
 * POST /api/simulation/export/xlsx
 *
 * Generates comprehensive Excel workbook with:
 * - Summary sheet with key metrics
 * - Distribution data
 * - Demographic segments
 * - Driver analysis
 * - Counterfactual scenarios
 * - Raw data for further analysis
 */

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

interface SimulationResult {
  id: string;
  query: string;
  timestamp: string;
  summary: {
    primaryMetric: number;
    primaryMetricLabel: string;
    confidenceInterval: { lower: number; upper: number };
    sampleSize: number;
    effectiveSampleSize?: number;
    executionTimeMs?: number;
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
    significance?: boolean;
  }>;
  drivers?: Array<{
    factor: string;
    importance: number;
    direction: string;
    effect?: number;
  }>;
  counterfactuals?: Array<{
    id?: string;
    label: string;
    outcome: number;
    delta: number;
    significance?: boolean;
  }>;
  accuracy?: {
    ssrCalibration: number;
    sampleQuality: number;
    responseQuality?: number;
    diversityIndex?: number;
    historicalFit?: number;
  };
  metadata?: {
    populationId: string;
    agentsGenerated: number;
    agentsExecuted: number;
    archetypesUsed: boolean;
    modelTierDistribution: Record<string, number>;
    avgLatencyMs: number;
  };
}

// Brand colors for Excel
const COLORS = {
  primary: "2563EB",
  secondary: "10B981",
  negative: "EF4444",
  header: "1A1A1A",
  headerText: "FFFFFF",
  altRow: "F5F5F5"
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { simulationResult }: { simulationResult: SimulationResult } = body;

    if (!simulationResult) {
      return NextResponse.json({ error: "Simulation result is required" }, { status: 400 });
    }

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "RLTX Decision Compiler";
    workbook.created = new Date();
    workbook.modified = new Date();

    // ========================================================================
    // SHEET 1: Summary
    // ========================================================================
    const summarySheet = workbook.addWorksheet("Summary", {
      properties: { tabColor: { argb: COLORS.primary } }
    });

    // Title
    summarySheet.mergeCells("A1:D1");
    const titleCell = summarySheet.getCell("A1");
    titleCell.value = "Multi-Agent Simulation Report";
    titleCell.font = { size: 18, bold: true };
    titleCell.alignment = { horizontal: "left" };

    // Query
    summarySheet.mergeCells("A2:D2");
    const queryCell = summarySheet.getCell("A2");
    queryCell.value = simulationResult.query;
    queryCell.font = { size: 12, italic: true, color: { argb: "666666" } };

    // Timestamp
    summarySheet.getCell("A3").value = `Generated: ${new Date(simulationResult.timestamp).toLocaleString()}`;
    summarySheet.getCell("A3").font = { size: 10, color: { argb: "999999" } };

    // Key Metrics section
    summarySheet.getCell("A5").value = "KEY METRICS";
    summarySheet.getCell("A5").font = { size: 14, bold: true };

    const metricsData = [
      ["Primary Outcome", `${Math.round(simulationResult.summary.primaryMetric * 100)}%`, simulationResult.summary.primaryMetricLabel],
      ["Confidence Interval (95%)", `${Math.round(simulationResult.summary.confidenceInterval.lower * 100)}% - ${Math.round(simulationResult.summary.confidenceInterval.upper * 100)}%`, ""],
      ["Sample Size", simulationResult.summary.sampleSize.toLocaleString(), "agents"],
      ["Effective Sample Size", (simulationResult.summary.effectiveSampleSize || simulationResult.summary.sampleSize).toLocaleString(), "after weighting"],
    ];

    if (simulationResult.accuracy) {
      metricsData.push(
        ["SSR Calibration", `${Math.round(simulationResult.accuracy.ssrCalibration * 100)}%`, "accuracy score"],
        ["Sample Quality", `${Math.round(simulationResult.accuracy.sampleQuality * 100)}%`, "execution success rate"],
      );
      if (simulationResult.accuracy.diversityIndex) {
        metricsData.push(["Response Diversity", `${Math.round(simulationResult.accuracy.diversityIndex * 100)}%`, "Simpson's diversity"]);
      }
    }

    let rowNum = 7;
    for (const [metric, value, note] of metricsData) {
      summarySheet.getCell(`A${rowNum}`).value = metric;
      summarySheet.getCell(`A${rowNum}`).font = { bold: true };
      summarySheet.getCell(`B${rowNum}`).value = value;
      summarySheet.getCell(`B${rowNum}`).font = { color: { argb: COLORS.primary } };
      summarySheet.getCell(`C${rowNum}`).value = note;
      summarySheet.getCell(`C${rowNum}`).font = { color: { argb: "999999" }, size: 10 };
      rowNum++;
    }

    // Set column widths
    summarySheet.columns = [
      { width: 25 },
      { width: 20 },
      { width: 25 },
      { width: 15 }
    ];

    // ========================================================================
    // SHEET 2: Distribution
    // ========================================================================
    const distSheet = workbook.addWorksheet("Distribution", {
      properties: { tabColor: { argb: COLORS.secondary } }
    });

    // Header
    distSheet.addRow(["Category", "Probability", "Percentage"]);
    const headerRow = distSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: COLORS.headerText } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.header }
    };

    // Data
    for (const item of simulationResult.distribution.values) {
      const row = distSheet.addRow([
        item.label,
        item.value,
        `${Math.round(item.value * 100)}%`
      ]);

      // Format probability column
      row.getCell(2).numFmt = "0.00%";
    }

    distSheet.columns = [
      { width: 25 },
      { width: 15 },
      { width: 15 }
    ];

    // ========================================================================
    // SHEET 3: Segments
    // ========================================================================
    if (simulationResult.segments && simulationResult.segments.length > 0) {
      const segSheet = workbook.addWorksheet("Segments", {
        properties: { tabColor: { argb: "F59E0B" } }
      });

      segSheet.addRow(["Segment", "Outcome", "Sample Size", "Delta vs Average", "Significant"]);
      const segHeader = segSheet.getRow(1);
      segHeader.font = { bold: true, color: { argb: COLORS.headerText } };
      segHeader.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.header }
      };

      for (const segment of simulationResult.segments) {
        const row = segSheet.addRow([
          segment.name,
          segment.value,
          segment.count,
          segment.delta,
          segment.significance ? "Yes" : "No"
        ]);

        // Format outcome as percentage
        row.getCell(2).numFmt = "0.0%";

        // Color delta based on direction
        const deltaCell = row.getCell(4);
        deltaCell.numFmt = "+0;-0;0";
        if (segment.delta > 0) {
          deltaCell.font = { color: { argb: COLORS.secondary } };
        } else if (segment.delta < 0) {
          deltaCell.font = { color: { argb: COLORS.negative } };
        }
      }

      segSheet.columns = [
        { width: 30 },
        { width: 12 },
        { width: 15 },
        { width: 18 },
        { width: 12 }
      ];
    }

    // ========================================================================
    // SHEET 4: Drivers
    // ========================================================================
    if (simulationResult.drivers && simulationResult.drivers.length > 0) {
      const driverSheet = workbook.addWorksheet("Drivers", {
        properties: { tabColor: { argb: "8B5CF6" } }
      });

      driverSheet.addRow(["Factor", "Importance", "Direction", "Effect Size"]);
      const driverHeader = driverSheet.getRow(1);
      driverHeader.font = { bold: true, color: { argb: COLORS.headerText } };
      driverHeader.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.header }
      };

      for (const driver of simulationResult.drivers) {
        const row = driverSheet.addRow([
          driver.factor,
          driver.importance,
          driver.direction,
          driver.effect || driver.importance * (driver.direction === "positive" ? 1 : -1)
        ]);

        row.getCell(2).numFmt = "0.0%";
        row.getCell(4).numFmt = "+0.00;-0.00;0.00";

        // Color direction
        const dirCell = row.getCell(3);
        if (driver.direction === "positive") {
          dirCell.font = { color: { argb: COLORS.secondary } };
        } else {
          dirCell.font = { color: { argb: COLORS.negative } };
        }
      }

      driverSheet.columns = [
        { width: 25 },
        { width: 15 },
        { width: 12 },
        { width: 15 }
      ];
    }

    // ========================================================================
    // SHEET 5: Counterfactuals
    // ========================================================================
    if (simulationResult.counterfactuals && simulationResult.counterfactuals.length > 0) {
      const cfSheet = workbook.addWorksheet("Scenarios", {
        properties: { tabColor: { argb: "EC4899" } }
      });

      cfSheet.addRow(["Scenario", "Outcome", "Delta", "Significant"]);
      const cfHeader = cfSheet.getRow(1);
      cfHeader.font = { bold: true, color: { argb: COLORS.headerText } };
      cfHeader.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.header }
      };

      // Base scenario
      const baseRow = cfSheet.addRow([
        "Base Scenario",
        simulationResult.summary.primaryMetric,
        0,
        "-"
      ]);
      baseRow.font = { bold: true };
      baseRow.getCell(2).numFmt = "0.0%";

      // Counterfactuals
      for (const cf of simulationResult.counterfactuals) {
        const row = cfSheet.addRow([
          cf.label,
          cf.outcome,
          cf.delta,
          cf.significance ? "Yes" : "No"
        ]);

        row.getCell(2).numFmt = "0.0%";

        const deltaCell = row.getCell(3);
        deltaCell.numFmt = "+0;-0;0";
        if (cf.delta > 0) {
          deltaCell.font = { color: { argb: COLORS.secondary } };
        } else if (cf.delta < 0) {
          deltaCell.font = { color: { argb: COLORS.negative } };
        }
      }

      cfSheet.columns = [
        { width: 40 },
        { width: 12 },
        { width: 10 },
        { width: 12 }
      ];
    }

    // ========================================================================
    // SHEET 6: Metadata
    // ========================================================================
    const metaSheet = workbook.addWorksheet("Metadata", {
      properties: { tabColor: { argb: "6B7280" } }
    });

    metaSheet.addRow(["Property", "Value"]);
    const metaHeader = metaSheet.getRow(1);
    metaHeader.font = { bold: true };

    const metadata = [
      ["Simulation ID", simulationResult.id],
      ["Timestamp", simulationResult.timestamp],
      ["Query", simulationResult.query],
      ["Distribution Type", simulationResult.distribution.type],
    ];

    if (simulationResult.metadata) {
      metadata.push(
        ["Population ID", simulationResult.metadata.populationId],
        ["Agents Generated", simulationResult.metadata.agentsGenerated],
        ["Agents Executed", simulationResult.metadata.agentsExecuted],
        ["Archetypes Used", simulationResult.metadata.archetypesUsed ? "Yes" : "No"],
        ["Average Latency (ms)", simulationResult.metadata.avgLatencyMs.toFixed(0)],
      );

      // Model distribution
      for (const [model, count] of Object.entries(simulationResult.metadata.modelTierDistribution)) {
        metadata.push([`Model: ${model}`, count]);
      }
    }

    for (const [key, value] of metadata) {
      metaSheet.addRow([key, value]);
    }

    metaSheet.columns = [
      { width: 25 },
      { width: 50 }
    ];

    // ========================================================================
    // Generate buffer
    // ========================================================================
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="simulation-data-${simulationResult.id}.xlsx"`,
      },
    });

  } catch (error) {
    console.error("Excel export error:", error);
    return NextResponse.json(
      { error: "Export failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
