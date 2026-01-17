# RLTX Database Seeding Plan

## Executive Summary

**Goal**: Seed a three-tier agent database to power RLTX behavioral simulations.

| Tier | Count | Data Source | LLM Model | Cost/Call |
|------|-------|-------------|-----------|-----------|
| **VIP** | 2,000 | nyne.ai profiles | Claude Opus | $0.01-0.05 |
| **Archetype** | 10,000 | Statistical clusters | GPT-4o-mini | $0.001-0.005 |
| **Statistical** | 1,000,000 | Behavioral distributions | None (lookup) | $0.0001 |

**Budget**: 9,000 nyne.ai credits over 4 months
**Rate Limits**: 60/min, 1,000/hr, 10,000/month

---

## Current Status

### Infrastructure (Complete)
- [x] Drizzle schema with all tables (`src/db/schema.ts`)
- [x] NyneCollector with rate limiting (`src/lib/collectors/nyne-collector.ts`)
- [x] VIP seed list (70/2000 VIPs) (`src/lib/collectors/vip-seed-list.json`)
- [x] Three-tier model router (`src/lib/agents/model-router.ts`)
- [x] Agent store interface (`src/lib/agents/agent-store.ts`)

### Environment Variables (Required)
```bash
# .env.local
NYNE_API_KEY=your_api_key
NYNE_API_SECRET=your_api_secret
DATABASE_URL=postgresql://...
PINECONE_API_KEY=your_pinecone_key  # For VIP embeddings
```

---

## Phase 1: Database Setup

### Step 1.1: Push Schema to Supabase
```bash
cd rltx-mvp
npx drizzle-kit push:pg
```

### Step 1.2: Verify Tables Created
Tables that should exist:
- `vip_agents` - Named VIP individuals
- `company_agents` - Organizations as actors
- `agent_archetypes` - Statistical clusters
- `statistical_agents` - 1M population agents
- `validation_events` - Historical ground truth
- `collection_log` - API call tracking
- `vip_company_relations` - Network links

---

## Phase 2: VIP Collection

### Priority Order
1. **Enterprise Tier A** (200) - 600 credits
2. **Political Tier A** (200) - 600 credits
3. **Defense Tier A** (150) - 450 credits
4. **All Tier B** (850) - 850 credits
5. **All Tier C** (600) - 600 credits

### Collection Commands

```bash
# Test connection with 1 VIP
npx tsx scripts/run-collection.ts --dry-run --limit=1

# Collect first 10 Enterprise Tier A (30 credits)
npx tsx scripts/run-collection.ts --vertical=enterprise --tier=A --limit=10

# Full Enterprise Tier A batch (200 VIPs, 600 credits)
npx tsx scripts/run-collection.ts --vertical=enterprise --tier=A

# Political Tier A batch
npx tsx scripts/run-collection.ts --vertical=political --tier=A

# Defense Tier A batch
npx tsx scripts/run-collection.ts --vertical=defense --tier=A
```

### Credit Allocation

| Phase | VIPs | Credits/VIP | Total | Cumulative |
|-------|------|-------------|-------|------------|
| Enterprise Tier A | 200 | 3 | 600 | 600 |
| Political Tier A | 200 | 3 | 600 | 1,200 |
| Defense Tier A | 150 | 3 | 450 | 1,650 |
| Enterprise Tier B | 300 | 1 | 300 | 1,950 |
| Political Tier B | 300 | 1 | 300 | 2,250 |
| Defense Tier B | 250 | 1 | 250 | 2,500 |
| All Tier C | 600 | 1 | 600 | 3,100 |
| Social Deep Dive | 100 | 5 | 500 | 3,600 |
| **Reserve** | - | - | 5,400 | 9,000 |

---

## Phase 3: Company Collection

### Priority Companies

| Tier | Count | Type | Credits/Company |
|------|-------|------|-----------------|
| A | 100 | Fortune 100 | 3 |
| B | 200 | Fortune 500 | 1 |
| C | 200 | Strategic Startups | 2 |

### Company APIs
- **Enrichment**: Basic firmographics (1 credit)
- **Needs**: Pain points from SEC filings (1 credit)
- **Features**: Tech stack detection (1 credit)
- **Funding**: Funding history (1 credit - startups only)

---

## Phase 4: Statistical Agents

### Archetype Generation

Statistical agents are generated from US Census demographic distributions. No API calls needed.

```typescript
// Generate archetypes from demographic combinations
const demographics = {
  age: ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
  gender: ["male", "female"],
  income: ["under_25k", "25k_50k", "50k_75k", "75k_100k", "100k_150k", "150k_plus"],
  education: ["no_hs", "hs", "some_college", "bachelors", "graduate"],
  location: ["urban", "suburban", "rural"],
  region: ["northeast", "midwest", "south", "west"],
};

// Total combinations: 6 × 2 × 6 × 5 × 3 × 4 = 4,320 archetypes
```

### Running Archetype Seeding
```bash
npx tsx scripts/seed-archetypes.ts
```

### Statistical Agent Generation
```bash
# Generate 1M agents (takes ~10 minutes)
npx tsx scripts/seed-statistical-agents.ts --count=1000000
```

---

## Phase 5: Validation Events

### Historical Ground Truth

| Event | Date | Type | Use |
|-------|------|------|-----|
| 2024 Presidential Election | Nov 2024 | Political | Vote prediction validation |
| TikTok Ban Vote | Mar 2024 | Congressional | Congressional vote |
| NVIDIA Q4 Earnings | Feb 2024 | Enterprise | Market sentiment |
| GPT-4o Launch | May 2024 | Enterprise | Adoption prediction |

### Seeding Validation Events
```bash
npx tsx scripts/seed-validation-events.ts
```

---

## Phase 6: Persona Synthesis

After collecting raw nyne.ai data, synthesize behavioral profiles:

### Big Five Inference
Infer personality traits from communication patterns:
- **Openness**: From topic diversity, curiosity indicators
- **Conscientiousness**: From formality, precision in language
- **Extraversion**: From engagement levels, assertiveness
- **Agreeableness**: From sentiment, collaboration language
- **Neuroticism**: From emotional volatility, anxiety markers

### Known Positions Extraction
Parse content for stance indicators:
```typescript
interface KnownPosition {
  topic: string;      // "AI regulation", "climate policy"
  stance: number;     // -1 to +1
  confidence: number; // 0 to 1
  source: string;     // Tweet, interview, etc.
}
```

### Running Synthesis
```bash
# Run persona synthesis on collected VIPs
npx tsx scripts/synthesize-personas.ts
```

---

## Scripts to Create

### 1. `scripts/run-collection.ts`
```typescript
import { runCollection } from "@/lib/collectors/nyne-collector";

const args = parseArgs(process.argv);
await runCollection({
  vertical: args.vertical,
  tier: args.tier,
  limit: args.limit,
  dryRun: args.dryRun,
});
```

### 2. `scripts/seed-archetypes.ts`
```typescript
import { db } from "@/db";
import { agentArchetypes } from "@/db/schema";

// Generate all demographic combinations
// Calculate population weights from Census data
// Insert into agentArchetypes table
```

### 3. `scripts/seed-statistical-agents.ts`
```typescript
import { db } from "@/db";
import { statisticalAgents, agentArchetypes } from "@/db/schema";

// For each archetype, generate N agents proportional to weight
// Insert in batches of 10,000
```

### 4. `scripts/synthesize-personas.ts`
```typescript
import { db } from "@/db";
import { vipAgents } from "@/db/schema";

// For each VIP with raw data:
// 1. Infer Big Five traits
// 2. Extract known positions
// 3. Generate communication style summary
// 4. Update vipAgents record
```

### 5. `scripts/seed-validation-events.ts`
```typescript
import { db } from "@/db";
import { validationEvents } from "@/db/schema";

// Insert historical events with ground truth outcomes
```

---

## Verification Checklist

### Phase 1 Complete
- [ ] Schema pushed to Supabase
- [ ] All tables visible in dashboard
- [ ] Test query returns empty arrays

### Phase 2 Complete
- [ ] 10 test VIPs collected (mock mode)
- [ ] Collection log shows success
- [ ] VIP data visible in Supabase

### Phase 3 Complete
- [ ] 10 test companies collected
- [ ] Company-VIP relations linked

### Phase 4 Complete
- [ ] ~4,000 archetypes seeded
- [ ] 1M statistical agents generated
- [ ] Population weights sum to 1.0

### Phase 5 Complete
- [ ] Historical events seeded
- [ ] Ground truth data populated

### Phase 6 Complete
- [ ] Big Five inferred for Tier A VIPs
- [ ] Known positions extracted
- [ ] Persona quality verified

---

## End-to-End Test

After seeding, verify the full flow:

```bash
# 1. Start dev server
npm run dev

# 2. In browser, send chat:
"How would Jamie Dimon respond to AI regulation?"

# 3. Verify:
# - Jamie Dimon appears as VIP actor
# - Response uses Claude Opus (VIP tier)
# - Reasoning reflects known positions

# 4. Send population query:
"Would consumers buy a $25 subscription?"

# 5. Verify:
# - Statistical agents sampled from archetypes
# - No LLM calls for Tier 3 agents
# - Distribution matches demographic weights
```

---

## Troubleshooting

### Rate Limit Errors
```
Error: Monthly rate limit reached
```
- Check `collection_log` for credit usage
- Wait for monthly reset or use mock mode

### Database Connection
```
Error: Connection refused
```
- Verify `DATABASE_URL` in `.env.local`
- Check Supabase project is active

### Missing VIP Data
```
VIP not found: Jamie Dimon
```
- Run collection for enterprise Tier A
- Check `vip_agents` table has records

### Mock Mode Warning
```
NYNE_API_KEY not set. Running in mock mode.
```
- Add API credentials to `.env.local`
- Or continue with mock data for development

---

## Quick Reference

### Collection Commands
```bash
# Dry run (no API calls)
npx tsx scripts/run-collection.ts --dry-run

# Collect specific vertical
npx tsx scripts/run-collection.ts --vertical=enterprise

# Collect specific tier
npx tsx scripts/run-collection.ts --tier=A

# Limit count
npx tsx scripts/run-collection.ts --limit=10
```

### Database Queries
```sql
-- Count VIPs by vertical
SELECT vertical, COUNT(*) FROM vip_agents GROUP BY vertical;

-- Check collection progress
SELECT status, COUNT(*) FROM vip_agents GROUP BY collection_status;

-- Credit usage
SELECT SUM(credits_used) FROM collection_log;
```

### Environment Check
```bash
# Verify all required env vars
echo $DATABASE_URL
echo $NYNE_API_KEY
echo $ANTHROPIC_API_KEY
```
