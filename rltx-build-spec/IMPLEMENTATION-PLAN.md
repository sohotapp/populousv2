# RLTX Implementation Plan: Research-Backed Architecture

## Executive Summary

This plan synthesizes the Stanford Generative Agents paper, SSR calibration research (arXiv:2510.08338), and AgentSociety architecture into a concrete implementation strategy for RLTX.

**Core Insight**: Minimal seed data + rich runtime memory = believability. Stanford agents started with ~200 words per agent and emergent behavior did the rest.

**Budget Reality**: 9,000 nyne.ai credits over 4 months. Must be surgical.

---

## Part 1: Credit-Optimal nyne.ai Data Collection Strategy

### Credit Allocation (9,000 total)

| API | Credits | Use Case |
|-----|---------|----------|
| **Person Interests** | 2,000 | VIP topic profiles |
| **Person Newsfeed** | 2,000 | VIP behavioral anchors |
| **Person Interests** | 5,000 | Archetype seed samples |
| **TOTAL** | 9,000 | |

### The 2,000 VIP List (Prioritized)

**Tier A: Mission Critical (500 agents)**
- Must have full Interests + Newsfeed
- These appear in every high-value simulation

| Category | Count | Examples |
|----------|-------|----------|
| US Senators | 100 | All senators |
| Key House Members | 50 | Committee chairs, swing votes |
| Cabinet/NSC | 30 | Secretary of State, Defense, Treasury, NSA |
| Tech CEOs | 50 | FAANG, AI labs, major SaaS |
| Defense Industry | 50 | Lockheed, Raytheon, Anduril, Palantir |
| Key Investors | 50 | Top 50 VC partners by AUM |
| Media Influencers | 50 | Top political/tech commentators |
| Foreign Leaders | 50 | G20 heads, key adversary leadership |
| Military/IC | 70 | Combatant commanders, agency heads |

**Tier B: Important (1,000 agents)**
- Interests only (no Newsfeed to save credits)
- Used in domain-specific simulations

| Category | Count |
|----------|-------|
| House of Representatives | 300 |
| State Governors | 50 |
| Fortune 500 CEOs | 200 |
| Additional VC/PE | 100 |
| Think Tank Leaders | 100 |
| Journalists | 150 |
| Academic Experts | 100 |

**Tier C: Archetype Seeds (500 agents)**
- Interests only
- Used to train archetype clusters, not individual simulation

Distribute across:
- Geographic regions (to capture regional variation)
- Industry verticals
- Political spectrum
- Age/career stage

### Collection Sequence

```
Phase 1: Tier A (500 VIPs)
├── Week 1-2: Collect Interests for all 500
├── Week 3-4: Collect Newsfeed for all 500
├── Credits used: 1,000
└── Output: Full behavioral profiles for core VIPs

Phase 2: Archetype Seeds (500 samples)
├── Week 5-6: Collect Interests for diverse sample
├── Credits used: 500
└── Output: Training data for archetype clustering

Phase 3: Tier B (1,000 VIPs)
├── Week 7-10: Collect Interests only
├── Credits used: 1,000
└── Output: Topic profiles for extended VIP roster

Phase 4: Remaining Tier A Newsfeed
├── Week 11-16: Fill in any gaps
├── Credits used: 500 (buffer)
└── Output: Complete Tier A coverage

Reserve: 6,000 credits for:
- Additional VIPs as needed
- API updates/retries
- Future expansion
```

---

## Part 2: Three-Tier Agent Architecture

### Tier 1: VIP Agents (2,000)

**Stanford Architecture Components** (per agent):
- **Memory Stream**: All observations in natural language, timestamped
- **Reflection**: Triggered when importance sum > threshold
- **Planning**: Daily schedule, adjustable in real-time

**Data Structure**:
```typescript
interface VIPAgent {
  // Identity (from nyne.ai + enrichment)
  id: string;
  name: string;
  role: string;
  affiliation: string;
  biography: string;  // ~200 words, Stanford-style

  // Psychological Profile (inferred from nyne.ai content)
  bigFive: {
    openness: number;       // 0-1
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  moralFoundations: {
    care: number;
    fairness: number;
    loyalty: number;
    authority: number;
    sanctity: number;
    liberty: number;
  };
  decisionStyle: 'analytical' | 'intuitive' | 'consensus';
  riskTolerance: number;  // 0-1

  // Behavioral Anchors (from nyne.ai Newsfeed)
  communicationStyle: string;
  sampleContent: string[];  // 3-5 representative posts
  topicInterests: { topic: string; weight: number }[];

  // Belief System
  coreBeliefs: { belief: string; confidence: number }[];
  updateableBeliefs: { belief: string; confidence: number }[];
  knownPositions: { topic: string; stance: number; source: string }[];

  // Runtime (Stanford architecture)
  memoryStream: Memory[];
  reflections: Reflection[];
  currentPlan: Plan;

  // Metadata
  tier: 'vip';
  source: 'nyne.ai';
  lastUpdated: Date;
}
```

**Prompt Template** (~600 tokens):
```
You are simulating {name} in a strategic scenario.

[IDENTITY CORE - 100 words]
{biography}

[PSYCHOLOGICAL PROFILE - 100 words]
Big Five: {bigFive description}
Decision Style: {decisionStyle}
Risk Tolerance: {riskTolerance description}
Moral Foundations: {moralFoundations description}

[BEHAVIORAL ANCHORS - 150 words]
Communication style: {communicationStyle}
Sample content that reflects their voice:
{sampleContent[0]}
{sampleContent[1]}
{sampleContent[2]}

[BELIEF SYSTEM - 100 words]
Core beliefs: {coreBeliefs}
Known positions: {knownPositions}

[MEMORY - Retrieved by recency × importance × relevance]
{retrievedMemories}

[CURRENT SITUATION]
{scenario}

Respond in character. Think step by step about what {name} would
actually do, given their personality, beliefs, and goals.
```

### Tier 2: Archetype Agents (10,000)

**Clustering Approach**:
1. Take 5,000 nyne.ai samples
2. Extract features:
   - Topic interest vector (from Interests API)
   - Inferred Big Five (from content analysis)
   - Political lean (from donations + content)
   - Risk tolerance (from career + content)
   - Demographics (from LinkedIn enrichment)
3. Cluster into ~500 archetypes using k-means
4. Define each archetype by mean + variance of all features

**Data Structure**:
```typescript
interface ArchetypeDefinition {
  id: string;
  name: string;  // e.g., "tech_optimist_coastal_millennial"
  description: string;

  // Distributions (mean, std)
  demographics: {
    age: { mean: number; std: number };
    income: { mean: number; std: number };
    education: string[];  // probability distribution
    location: string[];
  };

  // Psychological distributions
  bigFive: {
    [trait: string]: { mean: number; std: number };
  };
  riskTolerance: { mean: number; std: number };

  // Topic interests (probability distribution)
  interests: { topic: string; probability: number }[];

  // Behavior templates (for common scenarios)
  templates: {
    scenarioType: string;
    responseTemplate: string;
  }[];

  // Learned from Tier 1 + human data
  behaviorModel: NeuralNetwork | LookupTable;
}
```

**Prompt Template** (~300 tokens):
```
You are a {age}-year-old {occupation} living in {location}.

Personality: {bigFive description}
You care about: {interests}
Political lean: {politicalLean}
Risk tolerance: {riskTolerance description}

{scenario}

How would you respond? Be authentic to your personality.
```

### Tier 3: Statistical Agents (1,000,000+)

**No LLM calls**. Pure distribution sampling.

**Implementation**:
```typescript
interface StatisticalAgent {
  id: string;
  archetypeId: string;
  features: SampledFeatures;

  // Pre-computed response distributions
  // Learned from Tier 1 + Tier 2 outputs
  respond(scenario: Scenario): Distribution {
    return this.behaviorModel.predict(this.features, scenario);
  }
}

// Generate 1M agents in seconds
function generatePopulation(count: number): StatisticalAgent[] {
  return Array(count).fill(null).map(() => {
    const archetype = sampleArchetype();
    return {
      id: generateId(),
      archetypeId: archetype.id,
      features: sampleFromDistributions(archetype),
    };
  });
}
```

---

## Part 3: SSR Calibration System

### The Problem SSR Solves

When you ask LLMs for Likert ratings directly:
- Overly narrow distributions (cluster around 3)
- Systematic skew
- Unrealistic patterns

### SSR Implementation

```typescript
interface SSRConfig {
  questionType: string;
  anchors: {
    rating: number;
    statement: string;
    embedding?: number[];  // Pre-computed
  }[];
}

// Pre-define anchors for each decision type
const SSR_ANCHORS: Record<string, SSRConfig> = {
  purchase_intent: {
    questionType: 'purchase_intent',
    anchors: [
      { rating: 1, statement: "I would definitely not buy this product under any circumstances" },
      { rating: 2, statement: "I probably would not buy this product" },
      { rating: 3, statement: "I might or might not buy this product" },
      { rating: 4, statement: "I probably would buy this product" },
      { rating: 5, statement: "I would definitely buy this product" },
    ]
  },
  policy_support: {
    questionType: 'policy_support',
    anchors: [
      { rating: 1, statement: "I strongly oppose this policy" },
      { rating: 2, statement: "I somewhat oppose this policy" },
      { rating: 3, statement: "I am neutral on this policy" },
      { rating: 4, statement: "I somewhat support this policy" },
      { rating: 5, statement: "I strongly support this policy" },
    ]
  },
  alliance_likelihood: {
    questionType: 'alliance_likelihood',
    anchors: [
      { rating: 1, statement: "This alliance is completely unacceptable" },
      { rating: 2, statement: "This alliance is undesirable but possible" },
      { rating: 3, statement: "This alliance is pragmatically neutral" },
      { rating: 4, statement: "This alliance is strategically valuable" },
      { rating: 5, statement: "This alliance is essential and must happen" },
    ]
  },
  // ... more anchor sets for different decision types
};

// SSR scoring function
async function scoreWithSSR(
  response: string,
  config: SSRConfig
): Promise<{ distribution: number[]; expectedValue: number }> {
  // Get embedding for response
  const responseEmbedding = await embed(response);

  // Compute similarity to each anchor
  const similarities = config.anchors.map(anchor =>
    cosineSimilarity(responseEmbedding, anchor.embedding!)
  );

  // Softmax to get probability distribution
  const distribution = softmax(similarities);

  // Expected value
  const expectedValue = distribution.reduce(
    (sum, p, i) => sum + p * (i + 1), 0
  );

  return { distribution, expectedValue };
}
```

### Calibration Validation

Target metrics (from SSR paper):
- **Correlation attainment**: 90% of human test-retest reliability
- **KS similarity**: >0.85 to real human distributions
- **Segment calibration**: Match demographics-specific patterns

---

## Part 4: Validation Framework

### Level 1: Persona Fidelity (Individual)

**Test**: Present VIP agent with known situations, compare to actual behavior

```typescript
interface FidelityTest {
  agentId: string;
  scenario: string;
  actualResponse: string;  // From real-world data
  simulatedResponse: string;

  metrics: {
    semanticSimilarity: number;  // Embedding cosine similarity
    stanceAlignment: number;     // Same direction?
    toneMatch: number;           // Sentiment analysis
  };
}
```

**Target**: >0.7 semantic similarity for Tier A VIPs

### Level 2: Distributional Validity (Population)

**Test**: Run simulation, compare aggregate to real data

```typescript
interface DistributionalTest {
  testName: string;
  realDistribution: number[];
  simulatedDistribution: number[];

  metrics: {
    ksSimilarity: number;        // Kolmogorov-Smirnov
    chiSquared: number;          // Chi-squared test
    meanDifference: number;      // Absolute difference in means
  };
}
```

**Target**: KS similarity >0.85

### Level 3: Emergent Validity (Macro)

**Test**: Check for known social phenomena

- Polarization dynamics (should match empirical patterns)
- Information cascade patterns
- Coalition formation dynamics

**Target**: Reproduce known phenomena from social science literature

### Level 4: Predictive Validity (Ultimate)

**Test**: Predict real outcomes before they happen

- Election results
- Policy responses
- Market reactions

**Target**: Beat baseline models (polls, prediction markets)

---

## Part 5: Implementation Phases

### Phase 0: Foundation (Current)
- [x] Simulation Assistant chat interface
- [x] Conversational pattern handling
- [x] Agent store architecture
- [x] Model routing by tier
- [x] Database schema

### Phase 1: Data Collection (Weeks 1-4)
- [ ] Build nyne.ai client with rate limiting
- [ ] Collect Tier A VIP data (500 agents)
- [ ] Store in Supabase
- [ ] Index in Pinecone for semantic search

### Phase 2: Persona Synthesis (Weeks 5-6)
- [ ] Build persona compiler (nyne.ai → VIP prompt)
- [ ] Implement Big Five inference from content
- [ ] Implement moral foundations inference
- [ ] Generate 500 VIP personas

### Phase 3: SSR Calibration (Weeks 7-8)
- [ ] Define anchor libraries for all decision types
- [ ] Implement SSR scoring pipeline
- [ ] Validate against known human data
- [ ] Tune embeddings for calibration

### Phase 4: Archetype Clustering (Weeks 9-10)
- [ ] Collect archetype seed data (500 samples)
- [ ] Feature extraction pipeline
- [ ] K-means clustering
- [ ] Generate 500 archetype definitions

### Phase 5: Statistical Population (Weeks 11-12)
- [ ] Train behavior models from Tier 1+2 outputs
- [ ] Implement synthetic agent generator
- [ ] Generate 1M statistical agents
- [ ] Validate distributional properties

### Phase 6: Integration (Weeks 13-16)
- [ ] Wire up to simulation execution engine
- [ ] Implement the interaction loop (VIP → Archetype → Statistical)
- [ ] Build validation dashboard
- [ ] Run first end-to-end simulation

---

## Part 6: Cost Breakdown

| Item | Cost | Notes |
|------|------|-------|
| nyne.ai Pro (4 mo) | $520 | 9,000 credits |
| Free APIs | $0 | FEC, Wikipedia, YouTube |
| LLM inference (persona synthesis) | ~$100 | ~$0.05/VIP × 2,000 |
| LLM inference (calibration) | ~$50 | SSR anchor validation |
| Supabase | $0 | Free tier sufficient for MVP |
| Pinecone | $0 | Free tier (100K vectors) |
| **TOTAL** | **~$670** | |

---

## Part 7: Risk Mitigation

### Risk: nyne.ai API Changes
- Mitigation: Cache all responses locally
- Mitigation: Abstract nyne.ai behind interface for easy swap

### Risk: Credit Exhaustion
- Mitigation: Strict rate limiting
- Mitigation: Priority queue for high-value VIPs
- Mitigation: Early negotiation with nyne.ai contact

### Risk: Poor Persona Fidelity
- Mitigation: Validation against known behaviors
- Mitigation: Human review of Tier A personas
- Mitigation: Iterative prompt engineering

### Risk: Calibration Drift
- Mitigation: Continuous validation loop
- Mitigation: Track every prediction vs outcome
- Mitigation: Re-calibrate quarterly

---

## Next Steps (Immediate)

1. **Talk to nyne.ai contact** - Explain use case, negotiate better rate
2. **Prioritize Tier A list** - Finalize the 500 most critical VIPs
3. **Build collection pipeline** - With rate limiting and caching
4. **Define anchor libraries** - For top 5 decision types
5. **Set up validation infrastructure** - Before collecting data

---

## Questions for You

Before we start executing:

1. **nyne.ai rate limits** - What's the actual rate limit? Need to design collection cadence.
2. **Tier A priorities** - Which domain is most urgent? (Defense > Political > Enterprise?)
3. **Validation data** - What ground truth do you have access to? (Election results, surveys, etc.)
4. **Timeline** - When do you need first working simulation?
