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

    // Generate Word-compatible HTML (MHTML format)
    const doc = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>Simulation Report - ${simulationResult.id}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: 8.5in 11in;
      margin: 1in 1in 1in 1in;
    }
    body {
      font-family: Calibri, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #333;
    }
    h1 {
      font-size: 18pt;
      font-weight: bold;
      color: #1a1a1a;
      margin-bottom: 6pt;
      border-bottom: 2pt solid #3b82f6;
      padding-bottom: 6pt;
    }
    h2 {
      font-size: 14pt;
      font-weight: bold;
      color: #333;
      margin-top: 18pt;
      margin-bottom: 9pt;
    }
    .meta {
      font-size: 9pt;
      color: #666;
      margin-bottom: 18pt;
    }
    .query-box {
      background-color: #f5f5f5;
      border: 1pt solid #ddd;
      padding: 12pt;
      margin-bottom: 18pt;
    }
    .query-label {
      font-size: 9pt;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 3pt;
    }
    .query-text {
      font-size: 12pt;
      font-weight: bold;
      color: #1a1a1a;
    }
    .highlight-box {
      background-color: #eff6ff;
      border-left: 3pt solid #3b82f6;
      padding: 12pt;
      margin: 18pt 0;
      font-style: italic;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 12pt;
    }
    th, td {
      border: 1pt solid #ddd;
      padding: 6pt 9pt;
      text-align: left;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    .metric-table td:first-child {
      font-weight: bold;
      width: 40%;
    }
    .positive {
      color: #22c55e;
    }
    .negative {
      color: #ef4444;
    }
    .footer {
      margin-top: 24pt;
      padding-top: 12pt;
      border-top: 1pt solid #ddd;
      font-size: 9pt;
      color: #999;
      text-align: center;
    }
  </style>
</head>
<body>

<h1>Behavioral Simulation Report</h1>
<p class="meta">
  <strong>Report ID:</strong> ${simulationResult.id}<br>
  <strong>Generated:</strong> ${timestamp}
</p>

<div class="query-box">
  <div class="query-label">Simulation Query</div>
  <div class="query-text">${simulationResult.query}</div>
</div>

<h2>Executive Summary</h2>
<table class="metric-table">
  <tr>
    <td>Primary Outcome</td>
    <td><strong>${formatPercent(simulationResult.summary.primaryMetric)}</strong> ${simulationResult.summary.primaryMetricLabel}</td>
  </tr>
  <tr>
    <td>95% Confidence Interval</td>
    <td>${formatPercent(simulationResult.summary.confidenceInterval.lower)} - ${formatPercent(simulationResult.summary.confidenceInterval.upper)}</td>
  </tr>
  <tr>
    <td>Sample Size</td>
    <td>${simulationResult.summary.sampleSize.toLocaleString()} agents</td>
  </tr>
  <tr>
    <td>Execution Time</td>
    <td>${simulationResult.summary.executionTime.toFixed(2)} seconds</td>
  </tr>
</table>

${simulationResult.narrative ? `
<div class="highlight-box">
  <strong>Key Finding:</strong> ${simulationResult.narrative}
</div>
` : ""}

<h2>Response Distribution</h2>
<table>
  <tr>
    <th>Response Category</th>
    <th>Probability</th>
  </tr>
  ${simulationResult.distribution.values
    .map(item => `
    <tr>
      <td>${item.label}</td>
      <td>${formatPercent(item.value)}</td>
    </tr>
  `).join("")}
</table>

${simulationResult.segments?.length ? `
<h2>Segment Analysis</h2>
<table>
  <tr>
    <th>Segment</th>
    <th>Response Rate</th>
    <th>Count</th>
    <th>Delta vs Average</th>
  </tr>
  ${simulationResult.segments.map(seg => `
    <tr>
      <td>${seg.name}</td>
      <td>${formatPercent(seg.value)}</td>
      <td>${seg.count}</td>
      <td class="${seg.delta >= 0 ? "positive" : "negative"}">${formatDelta(seg.delta)}</td>
    </tr>
  `).join("")}
</table>
` : ""}

${simulationResult.drivers?.length ? `
<h2>Key Decision Drivers</h2>
<table>
  <tr>
    <th>Factor</th>
    <th>Importance</th>
    <th>Direction</th>
  </tr>
  ${simulationResult.drivers.map(driver => `
    <tr>
      <td>${driver.factor}</td>
      <td>${formatPercent(driver.importance)}</td>
      <td>${driver.direction}</td>
    </tr>
  `).join("")}
</table>
` : ""}

${simulationResult.counterfactuals?.length ? `
<h2>Counterfactual Scenarios</h2>
<p>The following scenarios show how different conditions would affect the outcome:</p>
<table>
  <tr>
    <th>Scenario</th>
    <th>Projected Outcome</th>
    <th>Impact</th>
    <th>Statistically Significant</th>
  </tr>
  ${simulationResult.counterfactuals.map(cf => `
    <tr>
      <td>${cf.scenario}</td>
      <td>${formatPercent(cf.outcome)}</td>
      <td class="${cf.delta >= 0 ? "positive" : "negative"}">${formatDelta(cf.delta)}</td>
      <td>${cf.significance ? "Yes" : "No"}</td>
    </tr>
  `).join("")}
</table>
` : ""}

<h2>Accuracy Metrics</h2>
<table class="metric-table">
  <tr>
    <td>SSR Calibration Score</td>
    <td>${formatPercent(simulationResult.accuracy.ssrCalibration)}</td>
  </tr>
  <tr>
    <td>Sample Quality Score</td>
    <td>${formatPercent(simulationResult.accuracy.sampleQuality)}</td>
  </tr>
  <tr>
    <td>Historical Fit Score</td>
    <td>${formatPercent(simulationResult.accuracy.historicalFit)}</td>
  </tr>
</table>

${simulationResult.analysis ? `
<h2>Methodology</h2>
<p><strong>Interpretation:</strong> ${simulationResult.analysis.interpretation}</p>
<p><strong>Approach:</strong> ${simulationResult.analysis.methodology}</p>
<p><strong>Key Factors Considered:</strong> ${simulationResult.analysis.keyFactors.join(", ")}</p>
` : ""}

<div class="footer">
  <p>Generated by RLTX Behavioral Simulation Engine</p>
  <p>SSR-Calibrated Multi-Agent Analysis | Proprietary Methodology</p>
</div>

</body>
</html>
    `.trim();

    return new NextResponse(doc, {
      headers: {
        "Content-Type": "application/msword",
        "Content-Disposition": `attachment; filename="simulation-${simulationResult.id}.doc"`,
      },
    });
  } catch (error) {
    console.error("Doc export error:", error);
    return NextResponse.json(
      { error: "Export failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
