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
    analysis?: {
      interpretation: string;
      keyFactors: string[];
      methodology: string;
    };
    narrative?: string;
  };
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDelta(delta: number): string {
  return `${delta > 0 ? "+" : ""}${delta}%`;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json();
    const { simulationResult } = body;

    if (!simulationResult) {
      return NextResponse.json({ error: "Simulation result is required" }, { status: 400 });
    }

    const timestamp = new Date(simulationResult.timestamp).toLocaleString();

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simulation Report - ${simulationResult.id}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
      background: white;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #111;
    }
    h2 {
      font-size: 16px;
      font-weight: 600;
      margin: 24px 0 12px;
      color: #333;
      border-bottom: 1px solid #e5e5e5;
      padding-bottom: 8px;
    }
    .meta {
      font-size: 12px;
      color: #666;
      margin-bottom: 24px;
    }
    .query-box {
      background: #f8f9fa;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .query-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #666;
      margin-bottom: 4px;
    }
    .query-text {
      font-size: 16px;
      font-weight: 500;
      color: #111;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .metric-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .metric-value {
      font-size: 28px;
      font-weight: 700;
      color: #111;
    }
    .metric-label {
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }
    .distribution-bar {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }
    .distribution-label {
      width: 140px;
      font-size: 13px;
      color: #333;
    }
    .distribution-track {
      flex: 1;
      height: 24px;
      background: #f0f0f0;
      border-radius: 4px;
      overflow: hidden;
      margin: 0 12px;
    }
    .distribution-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #60a5fa);
      border-radius: 4px;
    }
    .distribution-value {
      width: 50px;
      text-align: right;
      font-size: 13px;
      font-weight: 500;
      color: #333;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    th, td {
      text-align: left;
      padding: 10px 12px;
      border-bottom: 1px solid #e5e5e5;
      font-size: 13px;
    }
    th {
      font-weight: 600;
      color: #666;
      background: #f8f9fa;
    }
    .delta-positive {
      color: #22c55e;
    }
    .delta-negative {
      color: #ef4444;
    }
    .narrative {
      background: #f0f9ff;
      border-left: 4px solid #3b82f6;
      padding: 16px;
      margin: 24px 0;
      font-size: 14px;
      color: #1e40af;
    }
    .accuracy-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .accuracy-item {
      text-align: center;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .accuracy-value {
      font-size: 24px;
      font-weight: 700;
      color: #22c55e;
    }
    .accuracy-label {
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e5e5e5;
      font-size: 11px;
      color: #999;
      text-align: center;
    }
    @media print {
      body { padding: 20px; }
      .metrics-grid { grid-template-columns: repeat(4, 1fr); }
    }
  </style>
</head>
<body>
  <h1>Behavioral Simulation Report</h1>
  <div class="meta">ID: ${simulationResult.id} | Generated: ${timestamp}</div>

  <div class="query-box">
    <div class="query-label">Simulation Query</div>
    <div class="query-text">${simulationResult.query}</div>
  </div>

  <h2>Key Metrics</h2>
  <div class="metrics-grid">
    <div class="metric-card">
      <div class="metric-value">${formatPercent(simulationResult.summary.primaryMetric)}</div>
      <div class="metric-label">${simulationResult.summary.primaryMetricLabel}</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${formatPercent(simulationResult.summary.confidenceInterval.lower)}-${formatPercent(simulationResult.summary.confidenceInterval.upper)}</div>
      <div class="metric-label">95% Confidence</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${simulationResult.summary.sampleSize.toLocaleString()}</div>
      <div class="metric-label">Sample Size</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${simulationResult.summary.executionTime.toFixed(1)}s</div>
      <div class="metric-label">Execution Time</div>
    </div>
  </div>

  ${simulationResult.narrative ? `
  <div class="narrative">
    <strong>Key Finding:</strong> ${simulationResult.narrative}
  </div>
  ` : ""}

  <h2>Response Distribution</h2>
  ${simulationResult.distribution.values
    .map(
      (item) => `
    <div class="distribution-bar">
      <div class="distribution-label">${item.label}</div>
      <div class="distribution-track">
        <div class="distribution-fill" style="width: ${item.value * 100}%"></div>
      </div>
      <div class="distribution-value">${formatPercent(item.value)}</div>
    </div>
  `
    )
    .join("")}

  ${
    simulationResult.segments?.length
      ? `
  <h2>Segment Breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>Segment</th>
        <th>Response Rate</th>
        <th>Count</th>
        <th>vs Average</th>
      </tr>
    </thead>
    <tbody>
      ${simulationResult.segments
        .map(
          (seg) => `
        <tr>
          <td>${seg.name}</td>
          <td>${formatPercent(seg.value)}</td>
          <td>${seg.count}</td>
          <td class="${seg.delta >= 0 ? "delta-positive" : "delta-negative"}">${formatDelta(seg.delta)}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>
  `
      : ""
  }

  ${
    simulationResult.drivers?.length
      ? `
  <h2>Key Drivers</h2>
  <table>
    <thead>
      <tr>
        <th>Factor</th>
        <th>Importance</th>
        <th>Direction</th>
      </tr>
    </thead>
    <tbody>
      ${simulationResult.drivers
        .map(
          (driver) => `
        <tr>
          <td>${driver.factor}</td>
          <td>${formatPercent(driver.importance)}</td>
          <td>${driver.direction}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>
  `
      : ""
  }

  ${
    simulationResult.counterfactuals?.length
      ? `
  <h2>Counterfactual Scenarios</h2>
  <table>
    <thead>
      <tr>
        <th>Scenario</th>
        <th>Outcome</th>
        <th>Impact</th>
        <th>Significant</th>
      </tr>
    </thead>
    <tbody>
      ${simulationResult.counterfactuals
        .map(
          (cf) => `
        <tr>
          <td>${cf.scenario}</td>
          <td>${formatPercent(cf.outcome)}</td>
          <td class="${cf.delta >= 0 ? "delta-positive" : "delta-negative"}">${formatDelta(cf.delta)}</td>
          <td>${cf.significance ? "Yes" : "No"}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>
  `
      : ""
  }

  <h2>Accuracy & Calibration</h2>
  <div class="accuracy-grid">
    <div class="accuracy-item">
      <div class="accuracy-value">${formatPercent(simulationResult.accuracy.ssrCalibration)}</div>
      <div class="accuracy-label">SSR Calibration</div>
    </div>
    <div class="accuracy-item">
      <div class="accuracy-value">${formatPercent(simulationResult.accuracy.sampleQuality)}</div>
      <div class="accuracy-label">Sample Quality</div>
    </div>
    <div class="accuracy-item">
      <div class="accuracy-value">${formatPercent(simulationResult.accuracy.historicalFit)}</div>
      <div class="accuracy-label">Historical Fit</div>
    </div>
  </div>

  ${
    simulationResult.analysis
      ? `
  <h2>Methodology</h2>
  <p style="font-size: 13px; color: #666; margin-bottom: 12px;">
    <strong>Interpretation:</strong> ${simulationResult.analysis.interpretation}
  </p>
  <p style="font-size: 13px; color: #666; margin-bottom: 12px;">
    <strong>Approach:</strong> ${simulationResult.analysis.methodology}
  </p>
  <p style="font-size: 13px; color: #666;">
    <strong>Key Factors:</strong> ${simulationResult.analysis.keyFactors.join(", ")}
  </p>
  `
      : ""
  }

  <div class="footer">
    Generated by RLTX Behavioral Simulation Engine | SSR-Calibrated Multi-Agent Analysis
  </div>

  <script>
    // Auto-trigger print dialog for PDF export
    window.onload = function() {
      if (window.location.search.includes('print=true')) {
        window.print();
      }
    };
  </script>
</body>
</html>
    `.trim();

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  } catch (error) {
    console.error("PDF export error:", error);
    return NextResponse.json(
      { error: "Export failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
