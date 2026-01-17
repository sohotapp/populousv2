/**
 * PowerPoint Export API for Simulation Results
 *
 * POST /api/simulation/export/pptx
 *
 * Generates executive presentation with:
 * - Title slide with key finding
 * - Summary dashboard
 * - Distribution chart
 * - Demographic breakdown
 * - Driver analysis
 * - Counterfactual comparison
 * - Methodology appendix
 */

import { NextRequest, NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";

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
}

// Brand colors
const COLORS = {
  primary: "2563EB",      // Blue
  secondary: "10B981",    // Green
  accent: "F59E0B",       // Amber
  negative: "EF4444",     // Red
  background: "111111",   // Near black
  surface: "1A1A1A",      // Dark gray
  text: "FFFFFF",         // White
  textSecondary: "A3A3A3" // Gray
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { simulationResult }: { simulationResult: SimulationResult } = body;

    if (!simulationResult) {
      return NextResponse.json({ error: "Simulation result is required" }, { status: 400 });
    }

    // Create presentation
    const pptx = new PptxGenJS();

    // Set presentation properties
    pptx.author = "RLTX Decision Compiler";
    pptx.title = `Simulation Report: ${simulationResult.query.slice(0, 50)}`;
    pptx.subject = "Multi-Agent Behavioral Simulation Results";
    pptx.company = "RLTX";

    // Define master slide
    pptx.defineSlideMaster({
      title: "RLTX_MASTER",
      background: { color: COLORS.background },
      objects: [
        // Header bar
        {
          rect: {
            x: 0, y: 0, w: "100%", h: 0.5,
            fill: { color: COLORS.surface }
          }
        },
        // Footer
        {
          text: {
            text: "RLTX Decision Compiler | Confidential",
            options: {
              x: 0.5, y: "92%", w: "50%", h: 0.3,
              fontSize: 8, color: COLORS.textSecondary
            }
          }
        },
        // Page number placeholder
        {
          text: {
            text: "SLIDE_NUMBER",
            options: {
              x: "85%", y: "92%", w: "10%", h: 0.3,
              fontSize: 8, color: COLORS.textSecondary, align: "right"
            }
          }
        }
      ]
    });

    // SLIDE 1: Title
    const slide1 = pptx.addSlide({ masterName: "RLTX_MASTER" });

    slide1.addText("Multi-Agent Simulation Report", {
      x: 0.5, y: 1.5, w: 9, h: 0.8,
      fontSize: 36, bold: true, color: COLORS.text
    });

    slide1.addText(simulationResult.query, {
      x: 0.5, y: 2.5, w: 9, h: 1,
      fontSize: 18, color: COLORS.textSecondary, italic: true
    });

    const keyFinding = `${Math.round(simulationResult.summary.primaryMetric * 100)}% ${simulationResult.summary.primaryMetricLabel}`;
    slide1.addText("KEY FINDING:", {
      x: 0.5, y: 4, w: 2, h: 0.4,
      fontSize: 12, color: COLORS.textSecondary
    });

    slide1.addText(keyFinding, {
      x: 0.5, y: 4.4, w: 9, h: 0.6,
      fontSize: 28, bold: true, color: COLORS.primary
    });

    slide1.addText(
      `N = ${simulationResult.summary.sampleSize.toLocaleString()} agents | ` +
      `95% CI: ${Math.round(simulationResult.summary.confidenceInterval.lower * 100)}-` +
      `${Math.round(simulationResult.summary.confidenceInterval.upper * 100)}%`,
      {
        x: 0.5, y: 5.2, w: 9, h: 0.4,
        fontSize: 14, color: COLORS.textSecondary
      }
    );

    slide1.addText(new Date(simulationResult.timestamp).toLocaleDateString(), {
      x: 0.5, y: 6, w: 3, h: 0.3,
      fontSize: 10, color: COLORS.textSecondary
    });

    // SLIDE 2: Summary Dashboard
    const slide2 = pptx.addSlide({ masterName: "RLTX_MASTER" });

    slide2.addText("Executive Summary", {
      x: 0.5, y: 0.7, w: 9, h: 0.5,
      fontSize: 24, bold: true, color: COLORS.text
    });

    // Metric cards
    const metrics = [
      {
        label: "Primary Outcome",
        value: `${Math.round(simulationResult.summary.primaryMetric * 100)}%`,
        sublabel: simulationResult.summary.primaryMetricLabel
      },
      {
        label: "Confidence Interval",
        value: `${Math.round(simulationResult.summary.confidenceInterval.lower * 100)}-${Math.round(simulationResult.summary.confidenceInterval.upper * 100)}%`,
        sublabel: "95% CI"
      },
      {
        label: "Sample Size",
        value: simulationResult.summary.sampleSize.toLocaleString(),
        sublabel: "Agents simulated"
      },
      {
        label: "SSR Calibration",
        value: simulationResult.accuracy?.ssrCalibration
          ? `${Math.round(simulationResult.accuracy.ssrCalibration * 100)}%`
          : "N/A",
        sublabel: "Accuracy score"
      }
    ];

    metrics.forEach((metric, i) => {
      const x = 0.5 + (i * 2.3);

      // Card background
      slide2.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x, y: 1.5, w: 2.1, h: 1.3,
        fill: { color: COLORS.surface },
        line: { color: COLORS.surface }
      });

      slide2.addText(metric.label, {
        x, y: 1.6, w: 2.1, h: 0.25,
        fontSize: 10, color: COLORS.textSecondary, align: "center"
      });

      slide2.addText(metric.value, {
        x, y: 1.85, w: 2.1, h: 0.5,
        fontSize: 24, bold: true, color: COLORS.primary, align: "center"
      });

      slide2.addText(metric.sublabel, {
        x, y: 2.4, w: 2.1, h: 0.25,
        fontSize: 9, color: COLORS.textSecondary, align: "center"
      });
    });

    // Distribution chart (as table for simplicity)
    slide2.addText("Response Distribution", {
      x: 0.5, y: 3.2, w: 4, h: 0.4,
      fontSize: 14, bold: true, color: COLORS.text
    });

    const distRows = simulationResult.distribution.values.map(d => [
      { text: d.label, options: { color: COLORS.text } },
      {
        text: `${Math.round(d.value * 100)}%`,
        options: { color: COLORS.primary, bold: true, align: "right" as const }
      }
    ]);

    slide2.addTable(distRows, {
      x: 0.5, y: 3.6, w: 4, h: 0.3 * distRows.length,
      fontSize: 12,
      color: COLORS.text,
      fill: { color: COLORS.surface },
      border: { type: "none" }
    });

    // SLIDE 3: Demographic Breakdown (if segments exist)
    if (simulationResult.segments && simulationResult.segments.length > 0) {
      const slide3 = pptx.addSlide({ masterName: "RLTX_MASTER" });

      slide3.addText("Demographic Breakdown", {
        x: 0.5, y: 0.7, w: 9, h: 0.5,
        fontSize: 24, bold: true, color: COLORS.text
      });

      const segmentRows = simulationResult.segments.slice(0, 10).map(s => {
        const deltaColor = s.delta > 0 ? COLORS.secondary : s.delta < 0 ? COLORS.negative : COLORS.textSecondary;
        const deltaSign = s.delta > 0 ? "+" : "";

        return [
          { text: s.name, options: { color: COLORS.text } },
          { text: `${Math.round(s.value * 100)}%`, options: { color: COLORS.primary, align: "center" as const } },
          { text: `n=${s.count.toLocaleString()}`, options: { color: COLORS.textSecondary, align: "center" as const } },
          {
            text: `${deltaSign}${s.delta}%`,
            options: { color: deltaColor, align: "right" as const, bold: true }
          }
        ];
      });

      // Header row
      const headerRow = [
        { text: "Segment", options: { color: COLORS.textSecondary, bold: true } },
        { text: "Outcome", options: { color: COLORS.textSecondary, bold: true, align: "center" as const } },
        { text: "Sample", options: { color: COLORS.textSecondary, bold: true, align: "center" as const } },
        { text: "vs Avg", options: { color: COLORS.textSecondary, bold: true, align: "right" as const } }
      ];

      slide3.addTable([headerRow, ...segmentRows], {
        x: 0.5, y: 1.5, w: 9, h: 0.4 * (segmentRows.length + 1),
        fontSize: 11,
        color: COLORS.text,
        fill: { color: COLORS.surface },
        border: { type: "none" }
      });
    }

    // SLIDE 4: Drivers (if exist)
    if (simulationResult.drivers && simulationResult.drivers.length > 0) {
      const slide4 = pptx.addSlide({ masterName: "RLTX_MASTER" });

      slide4.addText("Key Drivers", {
        x: 0.5, y: 0.7, w: 9, h: 0.5,
        fontSize: 24, bold: true, color: COLORS.text
      });

      slide4.addText("Factors most correlated with the outcome", {
        x: 0.5, y: 1.2, w: 9, h: 0.3,
        fontSize: 12, color: COLORS.textSecondary
      });

      simulationResult.drivers.slice(0, 6).forEach((driver, i) => {
        const y = 1.8 + (i * 0.7);
        const barWidth = driver.importance * 6;
        const barColor = driver.direction === "positive" ? COLORS.secondary : COLORS.negative;

        slide4.addText(driver.factor, {
          x: 0.5, y, w: 2.5, h: 0.4,
          fontSize: 12, color: COLORS.text
        });

        // Bar background
        slide4.addShape(pptx.shapes.RECTANGLE, {
          x: 3, y: y + 0.1, w: 6, h: 0.25,
          fill: { color: COLORS.surface },
          line: { type: "none" }
        });

        // Bar fill
        slide4.addShape(pptx.shapes.RECTANGLE, {
          x: 3, y: y + 0.1, w: barWidth, h: 0.25,
          fill: { color: barColor },
          line: { type: "none" }
        });

        slide4.addText(`${Math.round(driver.importance * 100)}%`, {
          x: 9.1, y, w: 0.6, h: 0.4,
          fontSize: 11, color: COLORS.textSecondary, align: "right"
        });
      });
    }

    // SLIDE 5: Counterfactuals (if exist)
    if (simulationResult.counterfactuals && simulationResult.counterfactuals.length > 0) {
      const slide5 = pptx.addSlide({ masterName: "RLTX_MASTER" });

      slide5.addText("Scenario Comparison", {
        x: 0.5, y: 0.7, w: 9, h: 0.5,
        fontSize: 24, bold: true, color: COLORS.text
      });

      slide5.addText("How outcomes change under different conditions", {
        x: 0.5, y: 1.2, w: 9, h: 0.3,
        fontSize: 12, color: COLORS.textSecondary
      });

      // Base case
      slide5.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 0.5, y: 1.8, w: 4.2, h: 1.2,
        fill: { color: COLORS.surface },
        line: { color: COLORS.primary, pt: 2 }
      });

      slide5.addText("Base Scenario", {
        x: 0.7, y: 1.95, w: 3.8, h: 0.25,
        fontSize: 10, color: COLORS.textSecondary
      });

      slide5.addText(`${Math.round(simulationResult.summary.primaryMetric * 100)}%`, {
        x: 0.7, y: 2.2, w: 3.8, h: 0.5,
        fontSize: 28, bold: true, color: COLORS.primary
      });

      slide5.addText(simulationResult.summary.primaryMetricLabel, {
        x: 0.7, y: 2.7, w: 3.8, h: 0.25,
        fontSize: 11, color: COLORS.text
      });

      // Counterfactuals
      simulationResult.counterfactuals.slice(0, 3).forEach((cf, i) => {
        const x = 5 + (i % 2) * 2.3;
        const y = 1.8 + Math.floor(i / 2) * 1.4;
        const deltaColor = cf.delta > 0 ? COLORS.secondary : cf.delta < 0 ? COLORS.negative : COLORS.textSecondary;

        slide5.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
          x, y, w: 2.1, h: 1.2,
          fill: { color: COLORS.surface },
          line: { type: "none" }
        });

        slide5.addText(cf.label.slice(0, 30), {
          x: x + 0.1, y: y + 0.1, w: 1.9, h: 0.3,
          fontSize: 9, color: COLORS.textSecondary
        });

        slide5.addText(`${Math.round(cf.outcome * 100)}%`, {
          x: x + 0.1, y: y + 0.4, w: 1.9, h: 0.4,
          fontSize: 20, bold: true, color: COLORS.text
        });

        const deltaSign = cf.delta > 0 ? "+" : "";
        slide5.addText(`${deltaSign}${cf.delta}%`, {
          x: x + 0.1, y: y + 0.85, w: 1.9, h: 0.25,
          fontSize: 12, bold: true, color: deltaColor
        });
      });
    }

    // SLIDE 6: Methodology
    const slideMeth = pptx.addSlide({ masterName: "RLTX_MASTER" });

    slideMeth.addText("Methodology", {
      x: 0.5, y: 0.7, w: 9, h: 0.5,
      fontSize: 24, bold: true, color: COLORS.text
    });

    const methodologyText = [
      "Multi-Agent Simulation Framework",
      "",
      "• Population: Census-based demographic sampling with conditional distributions",
      "• Agents: Individual LLM calls with distinct persona prompts (not single-LLM imagination)",
      `• Sample: N = ${simulationResult.summary.sampleSize.toLocaleString()} synthetic agents`,
      "• Calibration: SSR (Semantic Similarity Rating) for response-to-probability conversion",
      "• Confidence: Wilson score intervals for binary proportions",
      "",
      "Quality Metrics:",
      simulationResult.accuracy?.ssrCalibration
        ? `• SSR Calibration: ${Math.round(simulationResult.accuracy.ssrCalibration * 100)}%`
        : "",
      simulationResult.accuracy?.sampleQuality
        ? `• Sample Quality: ${Math.round(simulationResult.accuracy.sampleQuality * 100)}%`
        : "",
      simulationResult.accuracy?.diversityIndex
        ? `• Response Diversity: ${Math.round(simulationResult.accuracy.diversityIndex * 100)}%`
        : "",
      "",
      "Note: Results are predictive estimates based on behavioral modeling.",
      "Actual outcomes may vary based on real-world factors not captured in the simulation."
    ].filter(Boolean).join("\n");

    slideMeth.addText(methodologyText, {
      x: 0.5, y: 1.4, w: 9, h: 4,
      fontSize: 11, color: COLORS.textSecondary,
      valign: "top"
    });

    // Generate file
    const buffer = await pptx.write({ outputType: "arraybuffer" }) as ArrayBuffer;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="simulation-report-${simulationResult.id}.pptx"`,
      },
    });

  } catch (error) {
    console.error("PPTX export error:", error);
    return NextResponse.json(
      { error: "Export failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
