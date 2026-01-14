# RLTX Calibration Methodology

## Overview

**Calibration is how we ensure simulations match reality.**

Without calibration, we're generating plausible-sounding fiction. With calibration, we're generating validated predictions.

---

## The Calibration Loop

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│    ┌──────────────┐                          ┌──────────────┐          │
│    │  Historical  │                          │  Simulation  │          │
│    │   Scenario   │ ───────────────────────► │    Result    │          │
│    └──────────────┘         Run              └──────────────┘          │
│           │                                         │                  │
│           │                                         │                  │
│           ▼                                         ▼                  │
│    ┌──────────────┐                          ┌──────────────┐          │
│    │   Actual     │         Compare          │  Predicted   │          │
│    │   Outcome    │ ◄─────────────────────── │   Outcome    │          │
│    └──────────────┘                          └──────────────┘          │
│           │                                         │                  │
│           │                                         │                  │
│           └─────────────────┬───────────────────────┘                  │
│                             │                                          │
│                             ▼                                          │
│                      ┌─────────────┐                                   │
│                      │   Error     │                                   │
│                      │  Analysis   │                                   │
│                      └─────────────┘                                   │
│                             │                                          │
│              ┌──────────────┼──────────────┐                          │
│              ▼              ▼              ▼                          │
│       ┌───────────┐  ┌───────────┐  ┌───────────┐                    │
│       │  Adjust   │  │  Adjust   │  │  Adjust   │                    │
│       │Population │  │  Prompts  │  │  Ontology │                    │
│       │  Weights  │  │           │  │           │                    │
│       └───────────┘  └───────────┘  └───────────┘                    │
│              │              │              │                          │
│              └──────────────┴──────────────┘                          │
│                             │                                          │
│                             ▼                                          │
│                      Re-run simulation                                 │
│                             │                                          │
│                             └──────────────────────────────────────────┘
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## What Gets Calibrated

### 1. Population Weights

**Problem**: Our synthetic population might not match the true distribution.

**Example**: We generate 18% millennials but real customer base is 25% millennials.

**Solution**: Adjust sampling weights to match known distributions.

```typescript
interface PopulationCalibration {
  // Target distributions from ground truth
  targets: {
    [trait: string]: {
      [value: string]: number;  // e.g., {"age_25_34": 0.25}
    };
  };
  
  // Current simulation distributions
  current: {
    [trait: string]: {
      [value: string]: number;
    };
  };
  
  // Calculated adjustment weights
  weights: {
    [trait_value: string]: number;  // Multiply agent count by this
  };
}

function calculatePopulationWeights(
  target: Distribution,
  current: Distribution
): Weights {
  const weights: Weights = {};
  
  for (const trait of Object.keys(target)) {
    for (const value of Object.keys(target[trait])) {
      const targetPct = target[trait][value];
      const currentPct = current[trait][value];
      
      // Weight = target / current
      // If target is 25% and current is 18%, weight = 1.39
      weights[`${trait}_${value}`] = targetPct / currentPct;
    }
  }
  
  return weights;
}
```

### 2. Trait-to-Behavior Mappings

**Problem**: Our assumption that "high income → less price sensitive" might be miscalibrated.

**Example**: We assume high-income agents are 30% less likely to churn on price increase. Reality shows they're only 15% less likely.

**Solution**: Adjust how traits influence prompt language and aggregation.

```typescript
interface TraitMapping {
  trait: string;
  behavior: string;
  assumed_effect: number;      // What we assumed
  observed_effect: number;     // What data shows
  adjustment_factor: number;   // observed / assumed
}

// Example calibration data
const traitMappings: TraitMapping[] = [
  {
    trait: "income_high",
    behavior: "price_sensitivity",
    assumed_effect: 0.3,       // We assumed 30% less sensitive
    observed_effect: 0.15,     // Data shows only 15% less
    adjustment_factor: 0.5     // Halve our assumed effect
  },
  {
    trait: "age_65_plus",
    behavior: "churn_likelihood",
    assumed_effect: -0.2,      // We assumed 20% less likely to churn
    observed_effect: 0.1,      // Actually 10% MORE likely
    adjustment_factor: -0.5    // Flip the direction
  }
];
```

### 3. Prompt Templates

**Problem**: The way we frame questions might systematically bias responses.

**Example**: "Would you continue subscribing?" leads to 10% more positive responses than "Would you cancel?"

**Solution**: A/B test prompt variations against real outcomes.

```typescript
interface PromptCalibration {
  prompt_variant: string;
  description: string;
  
  // Validation results
  backtests: Array<{
    scenario_id: string;
    predicted: number;
    actual: number;
    error: number;
  }>;
  
  // Aggregate metrics
  mean_absolute_error: number;
  directional_accuracy: number;  // % of times direction was right
  bias: number;                   // Systematic over/under prediction
  
  // Decision
  status: 'active' | 'deprecated' | 'testing';
}
```

### 4. Aggregation Method

**Problem**: How we combine individual responses might not produce accurate aggregate predictions.

**Example**: Simple majority might work for binary choices but fail for intensity questions.

**Solution**: Calibrate aggregation formulas.

```typescript
interface AggregationCalibration {
  question_type: string;
  
  aggregation_methods: Array<{
    method: 'mean' | 'median' | 'mode' | 'weighted_mean' | 'custom';
    formula?: string;
    
    // Performance
    backtests: Array<{
      scenario_id: string;
      predicted: number;
      actual: number;
    }>;
    
    mean_error: number;
    selected: boolean;
  }>;
}

// Example: For purchase intent, weighted mean performs better than simple mean
const purchaseIntentAggregation = {
  question_type: 'purchase_intent',
  aggregation_methods: [
    {
      method: 'mean',
      mean_error: 0.12,  // 12% average error
      selected: false
    },
    {
      method: 'weighted_mean',
      formula: 'sum(response * confidence_weight) / sum(confidence_weight)',
      mean_error: 0.08,  // 8% average error - better!
      selected: true
    }
  ]
};
```

---

## Calibration Datasets

### Required Ground Truth Data

For each domain, we need historical scenarios where we know:
1. The question asked
2. The population characteristics
3. The actual outcome

#### Enterprise Calibration Set

```typescript
interface EnterpriseCalibrationScenario {
  id: string;
  name: string;
  date: string;
  
  // The scenario
  scenario_type: 'price_change' | 'product_launch' | 'campaign_response' | 'churn_prediction';
  
  // What we asked (or equivalent)
  question: string;
  
  // Who was surveyed/affected
  population: {
    description: string;
    size: number;
    known_demographics: {
      [trait: string]: { [value: string]: number };
    };
  };
  
  // Context at the time
  context: {
    economic_conditions: string;
    competitive_landscape: string;
    prior_events: string[];
  };
  
  // The actual outcome
  outcome: {
    metric: string;           // e.g., "conversion_rate"
    value: number;            // e.g., 0.23
    confidence: number;       // How sure we are of ground truth
    sample_size?: number;     // If from survey
  };
}

// Example scenarios
const enterpriseCalibrationSet: EnterpriseCalibrationScenario[] = [
  {
    id: 'ent_001',
    name: 'Netflix 2023 Price Increase',
    date: '2023-10',
    scenario_type: 'price_change',
    question: 'Would you continue subscribing at the new price?',
    population: {
      description: 'US Netflix subscribers',
      size: 75000000,
      known_demographics: {
        age: { '18-34': 0.35, '35-54': 0.40, '55+': 0.25 },
        income: { 'under_50k': 0.30, '50k-100k': 0.45, 'over_100k': 0.25 }
      }
    },
    context: {
      economic_conditions: 'Moderate inflation, post-pandemic normalization',
      competitive_landscape: 'Disney+, HBO Max, Paramount+ competing',
      prior_events: ['Previous price increase 2022', 'Password sharing crackdown']
    },
    outcome: {
      metric: 'retention_rate_3_months',
      value: 0.91,            // 91% retained
      confidence: 0.95,
      sample_size: 75000000
    }
  },
  // ... more scenarios
];
```

#### Defense Calibration Set

```typescript
interface DefenseCalibrationScenario {
  id: string;
  name: string;
  date: string;
  
  scenario_type: 'adversary_response' | 'population_reaction' | 'escalation_dynamics';
  
  actors: Array<{
    name: string;
    role: string;
    known_objectives: string[];
  }>;
  
  trigger_event: string;
  
  actual_response: {
    actor: string;
    action: string;
    timing: string;
    escalation_level: number;
  };
  
  outcome: {
    description: string;
    key_metrics: { [metric: string]: number };
  };
}

// Example: Russia response to sanctions
const defenseCalibrationSet: DefenseCalibrationScenario[] = [
  {
    id: 'def_001',
    name: 'Russian Response to 2022 Sanctions',
    date: '2022-02',
    scenario_type: 'adversary_response',
    actors: [
      {
        name: 'Russian Leadership',
        role: 'adversary',
        known_objectives: ['Maintain regime stability', 'Achieve military objectives', 'Minimize economic damage']
      },
      {
        name: 'Western Coalition',
        role: 'us_allies',
        known_objectives: ['Deter aggression', 'Support Ukraine', 'Maintain alliance cohesion']
      }
    ],
    trigger_event: 'Comprehensive Western sanctions on Russian banks and individuals',
    actual_response: {
      actor: 'Russian Leadership',
      action: 'Economic counter-measures, energy export restrictions, domestic narrative control',
      timing: 'Within 1 week',
      escalation_level: 3  // Economic warfare, no kinetic escalation
    },
    outcome: {
      description: 'Prolonged economic standoff, no direct military confrontation',
      key_metrics: {
        'economic_decoupling': 0.7,
        'escalation_to_kinetic': 0.0,
        'alliance_cohesion': 0.85
      }
    }
  }
];
```

---

## Calibration Metrics

### Primary Metrics

#### 1. Mean Absolute Error (MAE)

**What it measures**: Average distance between prediction and reality.

```
MAE = (1/n) * Σ |predicted - actual|
```

**Target**: < 0.05 for binary (5 percentage points), < 0.10 for complex

#### 2. Directional Accuracy

**What it measures**: Did we get the direction right?

```
Directional Accuracy = (# correct direction) / (# predictions)
```

**Target**: > 0.85 (85% of the time we predict the right direction)

#### 3. Calibration Score

**What it measures**: When we say "70% confident", are we right 70% of the time?

```
For each confidence bucket (0.5-0.6, 0.6-0.7, etc.):
  Expected accuracy = bucket midpoint
  Actual accuracy = % correct in that bucket
  
Calibration Score = 1 - mean(|expected - actual|)
```

**Target**: > 0.90 (well-calibrated confidence)

#### 4. Segment Accuracy

**What it measures**: Are we right about WHICH segments respond differently?

```
For each segment:
  Segment Error = |predicted_segment_rate - actual_segment_rate|
  
Segment Accuracy = 1 - mean(Segment Error)
```

**Target**: > 0.80

### Secondary Metrics

#### 5. Bias

**What it measures**: Systematic over/under prediction.

```
Bias = mean(predicted - actual)
```

**Target**: |Bias| < 0.02 (no systematic lean)

#### 6. Variance Calibration

**What it measures**: Do our confidence intervals capture reality?

```
Coverage = (# times actual fell in 95% CI) / (# predictions)
```

**Target**: Coverage ≈ 0.95 for 95% CI

---

## Calibration Pipeline

### Step 1: Select Calibration Scenarios

```typescript
function selectCalibrationScenarios(
  domain: 'enterprise' | 'defense' | 'policy',
  config: {
    min_scenarios: number;
    recency_weight: number;      // Prefer recent scenarios
    diversity_requirement: boolean;  // Cover different scenario types
  }
): CalibrationScenario[] {
  const allScenarios = loadScenariosForDomain(domain);
  
  // Filter for quality
  const validScenarios = allScenarios.filter(s => 
    s.outcome.confidence > 0.8 &&  // High-quality ground truth
    s.population.size > 1000       // Statistically significant
  );
  
  // Weight by recency
  const weighted = validScenarios.map(s => ({
    ...s,
    weight: calculateRecencyWeight(s.date, config.recency_weight)
  }));
  
  // Ensure diversity
  if (config.diversity_requirement) {
    return selectDiverseSubset(weighted, config.min_scenarios);
  }
  
  return weighted.slice(0, config.min_scenarios);
}
```

### Step 2: Run Simulations

```typescript
async function runCalibrationSimulations(
  scenarios: CalibrationScenario[],
  currentModel: ModelConfig
): Promise<CalibrationResult[]> {
  const results: CalibrationResult[] = [];
  
  for (const scenario of scenarios) {
    // Build simulation matching historical scenario
    const workflow = await composeWorkflow(scenario.question, {
      population: scenario.population,
      context: scenario.context
    });
    
    // Run with current model configuration
    const simResult = await executeWorkflow(workflow, currentModel);
    
    // Compare to ground truth
    const comparison = compareToGroundTruth(simResult, scenario.outcome);
    
    results.push({
      scenario_id: scenario.id,
      predicted: simResult.primary_result,
      actual: scenario.outcome.value,
      error: comparison.error,
      segments: comparison.segment_errors,
      trace: simResult.trace
    });
  }
  
  return results;
}
```

### Step 3: Analyze Errors

```typescript
interface ErrorAnalysis {
  overall: {
    mae: number;
    bias: number;
    directional_accuracy: number;
  };
  
  by_scenario_type: {
    [type: string]: {
      mae: number;
      bias: number;
      n: number;
    };
  };
  
  by_segment: {
    [segment: string]: {
      mae: number;
      bias: number;
      worst_scenarios: string[];
    };
  };
  
  systematic_patterns: Array<{
    pattern: string;
    evidence: string;
    suggested_fix: string;
  }>;
}

function analyzeErrors(results: CalibrationResult[]): ErrorAnalysis {
  // Calculate overall metrics
  const errors = results.map(r => r.predicted - r.actual);
  const absErrors = errors.map(Math.abs);
  
  const overall = {
    mae: mean(absErrors),
    bias: mean(errors),
    directional_accuracy: results.filter(r => 
      (r.predicted > 0.5) === (r.actual > 0.5)
    ).length / results.length
  };
  
  // Break down by scenario type
  const byType = groupBy(results, r => r.scenario.scenario_type);
  const by_scenario_type = mapValues(byType, group => ({
    mae: mean(group.map(r => Math.abs(r.predicted - r.actual))),
    bias: mean(group.map(r => r.predicted - r.actual)),
    n: group.length
  }));
  
  // Identify systematic patterns
  const systematic_patterns = identifyPatterns(results);
  
  return { overall, by_scenario_type, by_segment: {}, systematic_patterns };
}

function identifyPatterns(results: CalibrationResult[]): Pattern[] {
  const patterns: Pattern[] = [];
  
  // Check for income-related bias
  const highIncomeErrors = results.flatMap(r => 
    r.segments.filter(s => s.segment.includes('high_income'))
  );
  if (highIncomeErrors.length > 0) {
    const highIncomeBias = mean(highIncomeErrors.map(e => e.error));
    if (Math.abs(highIncomeBias) > 0.05) {
      patterns.push({
        pattern: `High income segment ${highIncomeBias > 0 ? 'over' : 'under'}-predicted`,
        evidence: `Mean error: ${highIncomeBias.toFixed(3)}`,
        suggested_fix: highIncomeBias > 0 
          ? 'Increase price sensitivity language for high income agents'
          : 'Decrease price sensitivity language for high income agents'
      });
    }
  }
  
  // Check for recency bias
  const recentScenarios = results.filter(r => 
    new Date(r.scenario.date) > new Date(Date.now() - 365*24*60*60*1000)
  );
  const olderScenarios = results.filter(r => 
    new Date(r.scenario.date) <= new Date(Date.now() - 365*24*60*60*1000)
  );
  
  if (recentScenarios.length > 0 && olderScenarios.length > 0) {
    const recentMAE = mean(recentScenarios.map(r => Math.abs(r.error)));
    const olderMAE = mean(olderScenarios.map(r => Math.abs(r.error)));
    
    if (olderMAE > recentMAE * 1.5) {
      patterns.push({
        pattern: 'Model performs worse on older scenarios',
        evidence: `Recent MAE: ${recentMAE.toFixed(3)}, Older MAE: ${olderMAE.toFixed(3)}`,
        suggested_fix: 'Add temporal context to prompts, or weight recent scenarios higher'
      });
    }
  }
  
  return patterns;
}
```

### Step 4: Apply Adjustments

```typescript
interface CalibrationAdjustment {
  type: 'population_weight' | 'trait_mapping' | 'prompt_change' | 'aggregation';
  
  before: any;
  after: any;
  
  expected_impact: {
    mae_reduction: number;
    bias_reduction: number;
  };
  
  applied_at: string;
  validated: boolean;
}

async function applyCalibrationAdjustments(
  analysis: ErrorAnalysis,
  currentConfig: ModelConfig
): Promise<ModelConfig> {
  const adjustments: CalibrationAdjustment[] = [];
  
  // 1. Adjust population weights based on segment errors
  if (analysis.by_segment) {
    for (const [segment, data] of Object.entries(analysis.by_segment)) {
      if (Math.abs(data.bias) > 0.03) {
        const adjustment = calculateWeightAdjustment(segment, data.bias);
        adjustments.push(adjustment);
      }
    }
  }
  
  // 2. Adjust trait mappings based on patterns
  for (const pattern of analysis.systematic_patterns) {
    const adjustment = patternToAdjustment(pattern);
    if (adjustment) {
      adjustments.push(adjustment);
    }
  }
  
  // 3. Apply adjustments to config
  let newConfig = { ...currentConfig };
  for (const adjustment of adjustments) {
    newConfig = applyAdjustment(newConfig, adjustment);
  }
  
  // 4. Log adjustments for tracking
  await logCalibrationAdjustments(adjustments);
  
  return newConfig;
}
```

### Step 5: Validate Adjustments

```typescript
async function validateCalibration(
  adjustedConfig: ModelConfig,
  holdoutScenarios: CalibrationScenario[]
): Promise<ValidationResult> {
  // Run on holdout set (scenarios not used for calibration)
  const results = await runCalibrationSimulations(holdoutScenarios, adjustedConfig);
  const analysis = analyzeErrors(results);
  
  return {
    holdout_mae: analysis.overall.mae,
    holdout_bias: analysis.overall.bias,
    holdout_directional: analysis.overall.directional_accuracy,
    
    passes_threshold: analysis.overall.mae < 0.10 && 
                      Math.abs(analysis.overall.bias) < 0.02 &&
                      analysis.overall.directional_accuracy > 0.85,
    
    comparison_to_before: {
      // Compare to pre-adjustment performance
    }
  };
}
```

---

## Calibration Schedule

### Continuous Calibration

Every simulation that has a known outcome should feed back:

```typescript
interface SimulationOutcome {
  simulation_id: string;
  predicted: number;
  actual: number;
  actual_confidence: number;
  reported_at: string;
}

async function recordOutcome(outcome: SimulationOutcome) {
  // Store for future calibration
  await db.calibration_outcomes.insert(outcome);
  
  // Check if this triggers recalibration
  const recentOutcomes = await db.calibration_outcomes.recent(30);
  const metrics = calculateMetrics(recentOutcomes);
  
  if (metrics.mae > CALIBRATION_THRESHOLD || 
      Math.abs(metrics.bias) > BIAS_THRESHOLD) {
    await triggerRecalibration();
  }
}
```

### Scheduled Calibration

- **Weekly**: Check metrics, flag if degradation
- **Monthly**: Full calibration run on all domains
- **Quarterly**: Deep review of systematic errors, ontology updates

---

## Calibration Reports

### Weekly Dashboard

```typescript
interface WeeklyCalibrationReport {
  period: { start: string; end: string };
  
  simulations_with_outcomes: number;
  
  metrics: {
    mae: number;
    mae_trend: 'improving' | 'stable' | 'degrading';
    bias: number;
    directional_accuracy: number;
  };
  
  by_domain: {
    [domain: string]: {
      simulations: number;
      mae: number;
      status: 'healthy' | 'warning' | 'critical';
    };
  };
  
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical';
    message: string;
    suggested_action: string;
  }>;
}
```

### Monthly Deep Dive

```typescript
interface MonthlyCalibrationReport extends WeeklyCalibrationReport {
  segment_analysis: {
    best_performing: string[];
    worst_performing: string[];
    segment_specific_recommendations: Array<{
      segment: string;
      issue: string;
      recommendation: string;
    }>;
  };
  
  prompt_performance: {
    [template: string]: {
      usage_count: number;
      mae: number;
      recommended_changes: string[];
    };
  };
  
  model_comparison: {
    // If testing different LLM models
    [model: string]: {
      mae: number;
      cost_per_simulation: number;
      latency: number;
    };
  };
}
```

---

## Key Calibration Insights from Research

Based on the Aaru EY study and academic literature:

1. **0.90 correlation is achievable** for well-defined consumer surveys
2. **Segment-level accuracy is harder** than aggregate accuracy
3. **Temporal drift is real** - models degrade over time without recalibration
4. **Prompt phrasing matters enormously** - same question, different words = different results
5. **Ground truth quality is limiting factor** - bad validation data = bad calibration
6. **Edge cases are where models fail** - extreme segments, unusual scenarios

### Practical Recommendations

1. **Start with high-confidence ground truth** - Verified sales data > Survey responses
2. **Calibrate by domain** - Enterprise vs Defense have different error patterns
3. **Monitor continuously** - Catch degradation early
4. **Be transparent about uncertainty** - Report confidence intervals, not just point estimates
5. **Human-in-the-loop for new domains** - Don't trust auto-calibration for novel scenarios
