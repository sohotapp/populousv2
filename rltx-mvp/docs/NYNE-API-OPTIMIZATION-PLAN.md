# nyne.ai API Optimization Plan

## Complete API Credit Cost Reference

### Person APIs

| API Endpoint | Credits | Data Returned |
|--------------|---------|---------------|
| **Person Enrichment** | **6** | Full profile, emails, phones, work history, education, social profiles with metrics |
| Person Enrichment (Lite) | 3 | Basic only: name, current company, LinkedIn URL |
| **Person Enrichment + Newsfeed** | **12** | Everything above + 20 recent social posts |
| Person Newsfeed (standalone) | 6 | Social posts only (DON'T USE - redundant) |
| Person Interests | ? | Psychographics, brand affinities, political alignment |
| Person Article Search | 4 | Articles, podcasts, interviews, research papers |
| Person Search (Light) | 1 | Basic search results |
| Person Search (Premium) | 5+ | Full search with insights + add-ons |

### Company APIs

| API Endpoint | Credits | Data Returned |
|--------------|---------|---------------|
| **Company Enrichment** | **1** | Full profile, employee count, industry, location, funding summary |
| Company Needs | 3 | Pain points from SEC filings |
| Company Funding | 8 | Full funding history, investors, valuations |
| Company Feature Checker | 3 | Tech stack detection |

---

## Key Optimization Insights

### 1. Person Enrichment is BEST VALUE (6 credits)

One API call returns:
- `displayname`, `firstname`, `lastname`, `bio`, `gender`, `location`
- `altemails` - Array of email addresses
- `fullphone` - Array of phone numbers
- `organizations` - Full work history with dates
- `schools_info` - Education with degrees, dates, LinkedIn URLs
- `social_profiles`:
  - LinkedIn: url, username, followers, connections
  - Twitter: url, username, followers, following, posts
  - GitHub: url, username, followers
- `probability` - Match confidence

### 2. Add Newsfeed to Enrichment (NOT standalone)

**WRONG WAY** (18 credits):
```
Enrichment (6) + Standalone Newsfeed (6) + separate call overhead
```

**RIGHT WAY** (12 credits):
```javascript
{
  social_media_url: "linkedin.com/in/satyanadella",
  newsfeed: ["linkedin", "twitter"],  // Add-on in same call
  ai_enhanced_search: true
}
```

The `newsfeed` parameter adds posts to enrichment response for +6 credits.

### 3. Company Enrichment is INCREDIBLE VALUE (1 credit)

Returns everything:
- Company identity, description, tagline
- Employee count + LinkedIn followers
- Industry + 20+ specialities
- Full headquarters address
- Funding summary (rounds, total raised)
- Logo and background images

**Only use Company Funding (8 credits) for startups where detailed investor info matters.**

### 4. Skip Person Search for Known VIPs

Per founder guidance: "Person Search is for finding GROUPS of people. For specific known individuals, use enrichment directly with LinkedIn URL."

---

## Optimal Tier Strategy

### VIP Tiers (200 People)

| Tier | Count | Strategy | Credits/Person | Total Credits |
|------|-------|----------|----------------|---------------|
| **A** | 100 | Enrichment + Newsfeed + AI Enhanced | 12 | 1,200 |
| **B** | 65 | Enrichment only | 6 | 390 |
| **C** | 35 | Lite Enrichment | 3 | 105 |
| **Total** | **200** | | | **1,695** |

**Tier A** gets full profiles with:
- Complete biography and career history
- All email addresses and phone numbers
- Social profiles with engagement metrics
- 20 recent posts for communication style analysis
- AI-enhanced discovery for additional profiles

**Tier B** gets full profiles without posts:
- Complete biography and career history
- All contact information
- Social profiles with metrics
- Can upgrade to Tier A later if needed

**Tier C** gets basic identification:
- Name, current role, company
- LinkedIn URL
- Minimal cost, can upgrade later

### Company Tiers (200 Companies)

| Tier | Count | Strategy | Credits/Company | Total Credits |
|------|-------|----------|-----------------|---------------|
| **A** | 50 | Enrichment | 1 | 50 |
| **B** | 100 | Enrichment | 1 | 100 |
| **C** | 50 | Enrichment | 1 | 50 |
| **Total** | **200** | | | **200** |

**Note:** Company Enrichment is so cheap (1 credit) that all tiers get the same full data.

### Total Budget

| Category | Credits |
|----------|---------|
| VIP Collection | 1,695 |
| Company Collection | 200 |
| **Total** | **1,895** |
| Available | 9,752 |
| **Remaining** | **7,857** |

Remaining credits reserved for:
- Refresh cycles (quarterly re-enrichment)
- Article Search for thought leaders
- Company Funding for key startups
- Future VIP additions

---

## Data Extraction Checklist

### Person Enrichment - Extract ALL Fields

```typescript
interface MaximalPersonData {
  // Identity
  person_id: string;
  displayname: string;
  firstname: string;
  lastname: string;

  // Bio
  bio: string;
  headline: string;
  summary: string;
  location: string;
  gender: string;

  // Contact (CRITICAL for outreach)
  altemails: string[];           // Multiple emails
  fullphone: PhoneEntry[];       // Multiple phones

  // Career (for role-based simulation)
  organizations: Organization[]; // Full work history
  current_role: string;
  current_company: string;

  // Education (for calibration)
  schools_info: School[];        // Degrees, institutions

  // Social (for influence modeling)
  social_profiles: {
    linkedin: {
      url: string;
      username: string;
      followers: number;         // Influence metric
      connections: number;
    };
    twitter: {
      url: string;
      username: string;
      followers: number;
      following: number;
      posts: number;
      verified: boolean;
    };
    github?: {
      url: string;
      followers: number;
    };
  };

  // Newsfeed (for communication style)
  newsfeed: Post[];              // Recent posts
  communication_style: {
    formality: number;
    emotionality: number;
    assertiveness: number;
  };

  // Match quality
  probability: "high" | "medium" | "low";
}
```

### Company Enrichment - Extract ALL Fields

```typescript
interface MaximalCompanyData {
  // Identity
  linkedin_id: number;
  name: string;
  universal_name: string;

  // URLs
  linkedin_url: string;
  website_url: string;
  logo_url: string;
  background_url: string;

  // Description
  tagline: string;
  description: string;

  // Classification
  industry: string;
  specialities: string[];        // 20+ areas

  // Scale
  employee_count: number;
  follower_count: number;
  employee_count_range: {
    start: number;
    end: number;
  };

  // Location
  headquarter: {
    city: string;
    country: string;
    geographic_area: string;
    street1: string;
    postal_code: string;
  };

  // Funding (included in enrichment)
  funding: {
    number_of_funding_rounds: number;
    funding_total: string;
    last_round: string;
    crunchbase_organization_url: string;
  };

  // History
  founded_on: number;
}
```

---

## Database Storage Strategy

### Supabase vip_agents Table - Store EVERYTHING

```sql
-- Raw API responses (for reprocessing)
nyne_raw_enrichment JSONB,      -- Complete API response
nyne_raw_newsfeed JSONB,        -- Newsfeed data

-- Processed fields (for querying)
biography TEXT,
headline TEXT,
location TEXT,
career_history JSONB,           -- Array of positions
education JSONB,                -- Array of schools
social_profiles JSONB,          -- LinkedIn, Twitter, GitHub
sample_content TEXT[],          -- Recent posts
communication_style JSONB,      -- Formality, emotionality, assertiveness

-- Contact info (for network mapping)
alt_emails TEXT[],
phone_numbers JSONB,

-- Influence metrics
linkedin_followers INTEGER,
twitter_followers INTEGER,
total_connections INTEGER,

-- Psychographics (from PersonaCompiler)
big_five JSONB,
moral_foundations JSONB,
```

### Key Principle: Store Raw + Processed

1. **Raw API Response** - Store complete response in `nyne_raw_*` columns
   - Enables reprocessing if extraction logic improves
   - Preserves all data even if not immediately used

2. **Processed Fields** - Extract key fields for fast querying
   - Biography, career_history for persona building
   - Social metrics for influence modeling
   - Contact info for network mapping

---

## Collection Order

### Phase 1: Tier A VIPs (12 credits each)

**Priority: Highest-impact individuals**

1. Tech CEOs (Satya Nadella, Jensen Huang, Tim Cook...)
2. AI Leaders (Sam Altman, Dario Amodei, Demis Hassabis...)
3. Political Leaders (senators, cabinet members)
4. Defense Decision-makers

**API Call:**
```javascript
{
  social_media_url: vip.linkedinUrl,
  newsfeed: ["linkedin", "twitter"],
  ai_enhanced_search: true
}
// Returns: Full profile + 20 posts + enhanced discovery
```

### Phase 2: Tier B VIPs (6 credits each)

**Priority: Important but secondary**

1. Board members
2. Senior executives (VPs, SVPs)
3. Key legislators
4. Industry analysts

**API Call:**
```javascript
{
  social_media_url: vip.linkedinUrl,
  ai_enhanced_search: true
  // No newsfeed - just profile
}
```

### Phase 3: Tier C VIPs (3 credits each)

**Priority: Broad coverage**

1. Mid-level executives
2. Rising stars
3. Domain experts

**API Call:**
```javascript
{
  social_media_url: vip.linkedinUrl,
  lite_enrich: true
  // Basic profile only
}
```

### Phase 4: All Companies (1 credit each)

**Process all 200 companies - enrichment is cheap**

```javascript
{
  social_media_url: company.linkedinUrl
  // Full profile for just 1 credit
}
```

---

## Quality Assurance Checklist

After each collection, verify:

- [ ] `career_history` has 3+ entries for Tier A/B
- [ ] `education` has 1+ entries
- [ ] `social_profiles.linkedin.followers` is populated
- [ ] `altemails` has 1+ entries for Tier A/B
- [ ] `sample_content` has 5+ posts for Tier A
- [ ] `raw_data` preserves complete API response

---

## Scripts Location

- `scripts/run-collection.ts` - Main collection pipeline
- `scripts/test-full-enrichment.ts` - Test single VIP + Company
- `src/lib/collectors/nyne-collector.ts` - Person collection logic
- `src/lib/collectors/company-collector.ts` - Company collection logic
