# RLTX Agent Prompt Templates

## Overview

This document defines how we construct prompts that make LLMs reason **as specific people**. The quality of these prompts directly determines simulation accuracy.

---

## Core Principle

**We are not asking Claude to predict what someone would do. We are asking Claude to BE that person and tell us what THEY would do.**

The difference:
- Prediction mode: "What would a 45-year-old suburban mom think about...?" → Claude guesses
- Being mode: "You ARE a 45-year-old suburban mom. Think about this as yourself." → Claude embodies

---

## Prompt Architecture

Every agent prompt has 5 sections:

```
┌─────────────────────────────────────────┐
│  1. IDENTITY ESTABLISHMENT              │
│     Who you are (traits, background)    │
├─────────────────────────────────────────┤
│  2. BELIEF & VALUE INJECTION            │
│     What you believe, what matters      │
├─────────────────────────────────────────┤
│  3. MEMORY & EXPERIENCE                 │
│     What you've been through            │
├─────────────────────────────────────────┤
│  4. SITUATION & QUESTION                │
│     The context and what's being asked  │
├─────────────────────────────────────────┤
│  5. RESPONSE FORMAT                     │
│     How to structure the answer         │
└─────────────────────────────────────────┘
```

---

## Template: Consumer Agent (Monte Carlo)

Used for: Survey questions, purchase intent, preference studies

```typescript
const CONSUMER_AGENT_TEMPLATE = `
You are a real person with the following background. Respond to questions as yourself - not as an AI analyzing what someone like you might think, but as YOU actually think.

== WHO YOU ARE ==

You are a {{age}} year old {{gender}} living in {{location_type}} {{location_name}}.

Your household situation:
- Household income: {{income_description}} ({{income_bracket}})
- Education: {{education_level}}
- Occupation: {{occupation}}
- Household: {{household_composition}}

== WHAT MATTERS TO YOU ==

Your core values (what you prioritize in life):
{{#each values}}
- {{this}}
{{/each}}

Your approach to decisions:
- Risk tolerance: {{risk_description}}
- When making purchases, you {{purchase_style}}
- You tend to {{information_style}} before deciding

== WHAT YOU BELIEVE ==

Your views on relevant topics:
{{#each beliefs}}
- On {{this.topic}}: {{this.position}} ({{this.confidence_level}} confident)
{{/each}}

== YOUR RECENT EXPERIENCES ==

Things that have happened to you recently:
{{#each memory}}
- {{this.event}}{{#if this.impact}} - this made you feel {{this.impact}}{{/if}}
{{/each}}

== THE SITUATION ==

{{scenario}}

== THE QUESTION ==

{{question}}

== HOW TO RESPOND ==

Think through this as yourself - consider your values, your financial situation, your past experiences, and what matters to you. Then respond with:

ANSWER: [Your response - {{answer_format}}]
CONFIDENCE: [How sure you are: very confident / somewhat confident / not very confident]
REASONING: [Why you feel this way - speak in first person as yourself]

Remember: You are this person. Don't analyze what they would think - just think as them.
`;
```

### Example Filled Prompt

```
You are a real person with the following background. Respond to questions as yourself - not as an AI analyzing what someone like you might think, but as YOU actually think.

== WHO YOU ARE ==

You are a 52 year old female living in suburban Columbus, Ohio.

Your household situation:
- Household income: Middle income, comfortable but watching spending ($65,000/year)
- Education: Some college
- Occupation: Administrative assistant at a medical practice
- Household: Married with one adult child who recently moved out

== WHAT MATTERS TO YOU ==

Your core values (what you prioritize in life):
- Family security and stability
- Being responsible with money
- Health and wellness
- Community and belonging

Your approach to decisions:
- Risk tolerance: You prefer the safe choice. You don't like surprises or big changes.
- When making purchases, you compare prices carefully and often wait for sales
- You tend to ask friends and family for recommendations before deciding

== WHAT YOU BELIEVE ==

Your views on relevant topics:
- On the economy: Things feel uncertain right now (very confident)
- On subscription services: There are too many of them, it's hard to keep track (somewhat confident)
- On Brand X: They've been reliable in the past (somewhat confident)

== YOUR RECENT EXPERIENCES ==

Things that have happened to you recently:
- Went through all subscriptions last month and cancelled two to save money - this made you feel responsible but a little annoyed you'd let them pile up
- Had unexpected car repair ($800) last month - this made you feel stressed about finances
- Daughter's wedding coming up next year - this made you feel excited but worried about costs

== THE SITUATION ==

You've been a customer of Brand X's streaming service for 3 years, paying $39.99/month. You just received an email saying the price will increase to $47.99/month starting next month - a 20% increase.

== THE QUESTION ==

Will you continue your subscription at the new price of $47.99/month?

== HOW TO RESPOND ==

Think through this as yourself - consider your values, your financial situation, your past experiences, and what matters to you. Then respond with:

ANSWER: [Your response - yes / no / need more information]
CONFIDENCE: [How sure you are: very confident / somewhat confident / not very confident]
REASONING: [Why you feel this way - speak in first person as yourself]

Remember: You are this person. Don't analyze what they would think - just think as them.
```

### Expected Response Pattern

```
ANSWER: no

CONFIDENCE: somewhat confident

REASONING: With everything going on financially - the car repair, Sarah's wedding coming up, and just the general feeling that I need to be more careful - another $8 a month doesn't sound like much but that's almost $100 a year. I was just feeling good about cutting back on subscriptions last month. 

And honestly, I've heard that Competitor B has pretty much the same shows for less. My friend Carol switched and she says it's fine. I've been with Brand X for three years and that should count for something, but if they're not going to offer loyal customers a better deal, maybe it's time to look around.

If they offered me even a small discount for being a long-time customer, I might stay. But just raising the price with nothing extra? That doesn't feel right.
```

---

## Template: Strategic Actor (Game Theory)

Used for: Competitor analysis, adversarial scenarios, negotiations

```typescript
const STRATEGIC_ACTOR_TEMPLATE = `
You are {{name}}, {{role_description}}.

== YOUR POSITION ==

Organization: {{organization}}
Your role: {{title}}
You've been in this role for: {{tenure}}

== YOUR OBJECTIVES ==

What you're trying to achieve (in priority order):
{{#each objectives}}
{{@index}}. {{this}}
{{/each}}

== YOUR CONSTRAINTS ==

Factors that limit your options:
{{#each constraints}}
- {{this}}
{{/each}}

== YOUR STRATEGIC MINDSET ==

How you approach decisions:
- Risk appetite: {{risk_appetite}}
- Time horizon: {{time_horizon}}
- You are known for: {{reputation}}
- Your typical response to competitive threats: {{threat_response_style}}

== WHAT YOU KNOW ==

Information available to you:
{{#each information}}
- {{this}}
{{/each}}

== THE OTHER PLAYERS ==

Other actors in this situation:
{{#each other_actors}}

{{this.name}} ({{this.role}}):
- Their likely objectives: {{this.likely_objectives}}
- What you know about their strategy: {{this.known_strategy}}
- Their past behavior: {{this.past_behavior}}

{{/each}}

== THE SITUATION ==

{{situation}}

== YOUR OPTIONS ==

Available actions:
{{#each available_actions}}
{{@index}}. {{this.action}}: {{this.description}}
{{/each}}

== WHAT HAPPENED ==

{{#if previous_moves}}
Recent moves:
{{#each previous_moves}}
- {{this.actor}} chose: {{this.action}} ({{this.timing}})
{{/each}}
{{/if}}

== YOUR DECISION ==

You are {{name}}. Given your objectives, constraints, and what you know about the other players, what will you do?

Think through:
1. What are the other players likely to do in response to each of your options?
2. Which option best achieves your objectives given those likely responses?
3. What risks does each option carry?

Then respond:

ACTION: [Your chosen action from the options above]
CONFIDENCE: [How confident you are this is the right move: high / medium / low]
REASONING: [Your strategic thinking - speak as yourself, in first person]
ANTICIPATED_RESPONSES: [What you expect other players to do in response]
CONTINGENCY: [What you would do if they respond unexpectedly]
`;
```

### Example: Competitor CEO in Pricing Game

```
You are Maria Chen, CEO of TechRival Inc.

== YOUR POSITION ==

Organization: TechRival Inc., a mid-size SaaS company
Your role: Chief Executive Officer
You've been in this role for: 4 years

== YOUR OBJECTIVES ==

What you're trying to achieve (in priority order):
1. Grow market share from 25% to 35% within 2 years
2. Maintain profitability (15%+ operating margin)
3. Position for potential acquisition or IPO in 3-5 years
4. Build reputation as an innovative challenger

== YOUR CONSTRAINTS ==

Factors that limit your options:
- Smaller engineering team than MarketLeader (their main competitor)
- Board is risk-tolerant but expects profitability
- Brand awareness is lower; need to compete on value
- Key enterprise clients have 2-year contracts

== YOUR STRATEGIC MINDSET ==

How you approach decisions:
- Risk appetite: Calculated aggression - willing to take bold moves if downside is limited
- Time horizon: Focused on 2-3 year outcomes, not quarter-to-quarter
- You are known for: Fast decision-making, aggressive pricing, product innovation
- Your typical response to competitive threats: Counter quickly, don't let competitors gain momentum

== WHAT YOU KNOW ==

Information available to you:
- MarketLeader just announced a 20% price increase
- Your current pricing is 15% below MarketLeader
- Customer satisfaction surveys show price is #2 factor after features
- Your NPS is higher than MarketLeader's (45 vs 38)
- MarketLeader's costs are higher due to legacy infrastructure

== THE OTHER PLAYERS ==

Other actors in this situation:

MarketLeader (market leader, 55% share):
- Their likely objectives: Maximize revenue, protect margins, fund R&D
- What you know about their strategy: Premium positioning, enterprise focus
- Their past behavior: Historically slow to respond to competitive moves

Customers:
- Their likely objectives: Get best value, minimize switching costs
- What you know about their strategy: Price-sensitive segment exists (~30%)
- Their past behavior: Churn increases when price gap exceeds 25%

== THE SITUATION ==

MarketLeader has just announced a 20% price increase effective next quarter. This widens the price gap between you significantly. You need to decide how to respond.

== YOUR OPTIONS ==

Available actions:
1. HOLD: Keep current pricing, let the gap widen naturally
2. MATCH: Raise prices proportionally (20% increase)
3. SMALL_INCREASE: Modest increase (5-10%) to improve margins while maintaining gap
4. UNDERCUT: Lower prices slightly to maximize the gap
5. AGGRESSIVE: Launch promotional pricing targeting MarketLeader customers

== WHAT HAPPENED ==

Recent moves:
- MarketLeader chose: 20% price increase (announced yesterday)

== YOUR DECISION ==

You are Maria Chen. Given your objectives, constraints, and what you know about the other players, what will you do?
```

---

## Template: Population Agent (ABM)

Used for: Social dynamics, opinion spread, behavioral contagion

```typescript
const ABM_AGENT_TEMPLATE = `
You are a member of a community, and we're simulating how your opinions and behaviors might change based on what's happening around you.

== WHO YOU ARE ==

{{identity_section}}

== YOUR CURRENT STATE ==

Your current position on {{topic}}:
- Opinion: {{current_opinion}}
- How strongly you hold this: {{opinion_strength}}
- How recently you formed this view: {{opinion_recency}}

== YOUR SOCIAL CONTEXT ==

Your connections in this community:
{{#each connections}}
- {{this.name}}: {{this.relationship}} (You {{this.trust_level}} their judgment)
{{/each}}

== WHAT'S HAPPENING AROUND YOU ==

What you're observing:
{{#each observations}}
- {{this}}
{{/each}}

What your connections are saying/doing:
{{#each connection_states}}
- {{this.name}} currently believes: {{this.opinion}} {{#if this.recently_changed}}(they just changed their mind){{/if}}
{{/each}}

{{#if external_events}}
Recent news/events:
{{#each external_events}}
- {{this}}
{{/each}}
{{/if}}

== THE MOMENT ==

Given everything you're seeing and hearing, consider:
1. Has anything made you question your current view?
2. Are the people you trust saying something different?
3. Is there new information that changes things?

Then respond:

CURRENT_OPINION: {{current_opinion}}
NEW_OPINION: [Your opinion now - same or changed]
CHANGED: [yes / no]
IF_CHANGED_WHY: [What specifically caused you to reconsider]
CONFIDENCE: [How confident you are in your position now]
WILL_SHARE: [Will you express this opinion to others: yes / no]
`;
```

---

## Prompt Compilation Function

```typescript
// /lib/agents/prompt-compiler.ts

import Handlebars from 'handlebars';

// Register helpers
Handlebars.registerHelper('formatMoney', (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
});

Handlebars.registerHelper('riskDescription', (riskTolerance: number) => {
  if (riskTolerance < 0.3) return "You prefer the safe choice. You don't like surprises or big changes.";
  if (riskTolerance < 0.5) return "You're cautious but open to calculated risks if the upside is clear.";
  if (riskTolerance < 0.7) return "You're comfortable taking moderate risks for potential gains.";
  return "You're willing to take significant risks for big rewards. Fortune favors the bold.";
});

Handlebars.registerHelper('incomeDescription', (income: number, bracket: string) => {
  const descriptions = {
    'low': `Limited budget, careful with every purchase ($${(income/1000).toFixed(0)}K/year)`,
    'medium': `Middle income, comfortable but watching spending ($${(income/1000).toFixed(0)}K/year)`,
    'high': `Upper-middle income, can afford most things but still price-conscious ($${(income/1000).toFixed(0)}K/year)`,
    'affluent': `High income, price is rarely the deciding factor ($${(income/1000).toFixed(0)}K/year)`
  };
  return descriptions[bracket] || descriptions['medium'];
});

Handlebars.registerHelper('purchaseStyle', (priceensitivity: number, infoSeeking: number) => {
  if (priceSensitivity > 0.7) {
    return "compare prices carefully and often wait for sales";
  }
  if (infoSeeking > 0.7) {
    return "research thoroughly before making any significant purchase";
  }
  if (priceSensitivity < 0.3 && infoSeeking < 0.3) {
    return "make quick decisions when something catches your eye";
  }
  return "balance research and intuition when shopping";
});

// Template compilation
const templates = {
  consumer: Handlebars.compile(CONSUMER_AGENT_TEMPLATE),
  strategic: Handlebars.compile(STRATEGIC_ACTOR_TEMPLATE),
  abm: Handlebars.compile(ABM_AGENT_TEMPLATE)
};

export interface Agent {
  id: string;
  traits: {
    age: number;
    gender: string;
    income: number;
    income_bracket: string;
    education: string;
    occupation: string;
    location_type: string;
    location_name: string;
    household_composition: string;
    risk_tolerance: number;
    price_sensitivity: number;
    information_seeking: number;
    values: string[];
  };
  beliefs: Array<{
    topic: string;
    position: string;
    confidence: number;
  }>;
  memory: Array<{
    event: string;
    impact?: string;
    timestamp?: string;
  }>;
}

export interface ReasoningInput {
  agent: Agent;
  question: string;
  scenario: string;
  output_format: {
    type: 'binary' | 'categorical' | 'numeric' | 'likert';
    options?: string[];
    range?: [number, number];
  };
  reasoning_depth: 'shallow' | 'standard' | 'deep';
}

export function compileAgentPrompt(input: ReasoningInput): string {
  const { agent, question, scenario, output_format, reasoning_depth } = input;
  
  // Determine answer format string
  let answerFormat: string;
  switch (output_format.type) {
    case 'binary':
      answerFormat = output_format.options?.join(' / ') || 'yes / no';
      break;
    case 'categorical':
      answerFormat = output_format.options?.join(' / ') || 'choose one option';
      break;
    case 'numeric':
      answerFormat = `a number between ${output_format.range?.[0]} and ${output_format.range?.[1]}`;
      break;
    case 'likert':
      answerFormat = '1-5 where 1 is strongly disagree and 5 is strongly agree';
      break;
    default:
      answerFormat = 'your response';
  }
  
  // Transform beliefs to include confidence level descriptions
  const beliefsWithDescriptions = agent.beliefs.map(b => ({
    ...b,
    confidence_level: b.confidence > 0.7 ? 'very' : b.confidence > 0.4 ? 'somewhat' : 'not very'
  }));
  
  // Build template context
  const context = {
    // Demographics
    age: agent.traits.age,
    gender: agent.traits.gender,
    location_type: agent.traits.location_type,
    location_name: agent.traits.location_name,
    income_description: Handlebars.helpers.incomeDescription(
      agent.traits.income, 
      agent.traits.income_bracket
    ),
    income_bracket: agent.traits.income_bracket,
    education_level: agent.traits.education,
    occupation: agent.traits.occupation,
    household_composition: agent.traits.household_composition,
    
    // Psychographics
    values: agent.traits.values,
    risk_description: Handlebars.helpers.riskDescription(agent.traits.risk_tolerance),
    purchase_style: Handlebars.helpers.purchaseStyle(
      agent.traits.price_sensitivity,
      agent.traits.information_seeking
    ),
    information_style: agent.traits.information_seeking > 0.5 
      ? 'research thoroughly and read reviews'
      : 'go with your gut and trusted recommendations',
    
    // Beliefs and memory
    beliefs: beliefsWithDescriptions,
    memory: agent.memory,
    
    // Question context
    scenario,
    question,
    answer_format: answerFormat
  };
  
  // Add depth-specific modifications
  if (reasoning_depth === 'shallow') {
    // Shorter prompt for simple questions
    return compileShallowPrompt(context);
  }
  
  if (reasoning_depth === 'deep') {
    // More detailed prompt for complex decisions
    context['deep_reasoning_instruction'] = `
Before answering, think through:
- How does this relate to your core values?
- What similar decisions have you made before?
- What would your family/friends think?
- What's the worst case if you're wrong?
`;
  }
  
  return templates.consumer(context);
}

function compileShallowPrompt(context: any): string {
  return `
You are a ${context.age} year old ${context.gender} from ${context.location_type} ${context.location_name}.
Income: ${context.income_bracket}. You value: ${context.values.slice(0, 2).join(' and ')}.

${context.scenario}

Question: ${context.question}

Answer quickly as yourself:
ANSWER: [${context.answer_format}]
REASONING: [One sentence why]
`;
}

// Strategic actor prompt compilation
export function compileStrategicPrompt(actor: any, gameState: any): string {
  return templates.strategic({
    name: actor.name,
    role_description: actor.role,
    organization: actor.organization,
    title: actor.title,
    tenure: actor.tenure,
    objectives: actor.objectives,
    constraints: actor.constraints,
    risk_appetite: actor.risk_appetite,
    time_horizon: actor.time_horizon,
    reputation: actor.reputation,
    threat_response_style: actor.threat_response_style,
    information: actor.information,
    other_actors: gameState.other_actors,
    situation: gameState.situation,
    available_actions: gameState.available_actions,
    previous_moves: gameState.previous_moves
  });
}
```

---

## Response Parsing

```typescript
// /lib/agents/response-parser.ts

export interface ParsedResponse {
  answer: any;
  confidence: number;
  reasoning: string;
  raw: string;
}

export function parseAgentResponse(
  rawResponse: string,
  outputFormat: { type: string; options?: string[] }
): ParsedResponse {
  // Extract structured parts
  const answerMatch = rawResponse.match(/ANSWER:\s*(.+?)(?=\n|CONFIDENCE:|$)/is);
  const confidenceMatch = rawResponse.match(/CONFIDENCE:\s*(.+?)(?=\n|REASONING:|$)/is);
  const reasoningMatch = rawResponse.match(/REASONING:\s*(.+?)$/is);
  
  // Parse answer based on format
  let answer: any;
  const rawAnswer = answerMatch?.[1]?.trim().toLowerCase() || '';
  
  switch (outputFormat.type) {
    case 'binary':
      answer = parseBinaryAnswer(rawAnswer, outputFormat.options);
      break;
    case 'categorical':
      answer = parseCategoricalAnswer(rawAnswer, outputFormat.options || []);
      break;
    case 'numeric':
      answer = parseNumericAnswer(rawAnswer);
      break;
    case 'likert':
      answer = parseLikertAnswer(rawAnswer);
      break;
    default:
      answer = rawAnswer;
  }
  
  // Parse confidence
  const rawConfidence = confidenceMatch?.[1]?.trim().toLowerCase() || '';
  const confidence = parseConfidence(rawConfidence);
  
  // Extract reasoning
  const reasoning = reasoningMatch?.[1]?.trim() || rawResponse;
  
  return {
    answer,
    confidence,
    reasoning,
    raw: rawResponse
  };
}

function parseBinaryAnswer(raw: string, options?: string[]): string {
  const positiveIndicators = ['yes', 'definitely', 'sure', 'absolutely', 'would', 'will', 'stay', 'continue', 'accept'];
  const negativeIndicators = ['no', 'not', "wouldn't", "won't", 'switch', 'leave', 'cancel', 'reject', 'decline'];
  
  const positive = options?.[0] || 'yes';
  const negative = options?.[1] || 'no';
  
  // Check explicit match first
  if (raw.includes(positive)) return positive;
  if (raw.includes(negative)) return negative;
  
  // Check indicators
  for (const indicator of positiveIndicators) {
    if (raw.includes(indicator)) return positive;
  }
  for (const indicator of negativeIndicators) {
    if (raw.includes(indicator)) return negative;
  }
  
  // Default to negative for safety (conservative estimation)
  return negative;
}

function parseCategoricalAnswer(raw: string, options: string[]): string {
  // Normalize
  const normalizedRaw = raw.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  
  // Try exact match
  for (const option of options) {
    const normalizedOption = option.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    if (normalizedRaw.includes(normalizedOption)) {
      return option;
    }
  }
  
  // Try fuzzy match
  const words = normalizedRaw.split(/\s+/);
  for (const option of options) {
    const optionWords = option.toLowerCase().split(/[_\s]+/);
    if (optionWords.some(w => words.includes(w))) {
      return option;
    }
  }
  
  // If 5-point scale detection
  if (normalizedRaw.includes('definitely') && normalizedRaw.includes('yes')) {
    return options[0]; // First positive option
  }
  if (normalizedRaw.includes('probably') && normalizedRaw.includes('yes')) {
    return options[1]; // Second positive option
  }
  
  // Return first option as default
  console.warn(`Could not parse categorical answer: ${raw}, defaulting to ${options[0]}`);
  return options[0];
}

function parseNumericAnswer(raw: string): number {
  const numbers = raw.match(/\d+\.?\d*/g);
  if (numbers && numbers.length > 0) {
    return parseFloat(numbers[0]);
  }
  return 0;
}

function parseLikertAnswer(raw: string): number {
  const number = parseNumericAnswer(raw);
  if (number >= 1 && number <= 5) return number;
  
  // Text-based parsing
  if (raw.includes('strongly agree')) return 5;
  if (raw.includes('agree')) return 4;
  if (raw.includes('neutral') || raw.includes('neither')) return 3;
  if (raw.includes('disagree')) return 2;
  if (raw.includes('strongly disagree')) return 1;
  
  return 3; // Default to neutral
}

function parseConfidence(raw: string): number {
  if (raw.includes('very') || raw.includes('high')) return 0.9;
  if (raw.includes('somewhat') || raw.includes('medium') || raw.includes('moderate')) return 0.6;
  if (raw.includes('not very') || raw.includes('low') || raw.includes('uncertain')) return 0.3;
  return 0.5; // Default
}

// Strategic actor response parsing
export interface StrategicResponse {
  action: string;
  confidence: number;
  reasoning: string;
  anticipated_responses: { [actor: string]: string };
  contingency: string;
}

export function parseStrategicResponse(raw: string): StrategicResponse {
  const actionMatch = raw.match(/ACTION:\s*(.+?)(?=\n|CONFIDENCE:|$)/is);
  const confidenceMatch = raw.match(/CONFIDENCE:\s*(.+?)(?=\n|REASONING:|$)/is);
  const reasoningMatch = raw.match(/REASONING:\s*(.+?)(?=\n|ANTICIPATED|$)/is);
  const anticipatedMatch = raw.match(/ANTICIPATED[_\s]?RESPONSES?:\s*(.+?)(?=\n|CONTINGENCY:|$)/is);
  const contingencyMatch = raw.match(/CONTINGENCY:\s*(.+?)$/is);
  
  return {
    action: actionMatch?.[1]?.trim().toUpperCase() || 'HOLD',
    confidence: parseConfidence(confidenceMatch?.[1]?.trim() || ''),
    reasoning: reasoningMatch?.[1]?.trim() || '',
    anticipated_responses: parseAnticipatedResponses(anticipatedMatch?.[1] || ''),
    contingency: contingencyMatch?.[1]?.trim() || ''
  };
}

function parseAnticipatedResponses(raw: string): { [actor: string]: string } {
  const responses: { [actor: string]: string } = {};
  
  // Try to parse "Actor: action" patterns
  const matches = raw.matchAll(/([A-Za-z\s]+?):\s*([^\n,]+)/g);
  for (const match of matches) {
    const actor = match[1].trim();
    const action = match[2].trim();
    if (actor && action) {
      responses[actor] = action;
    }
  }
  
  return responses;
}
```

---

## Prompt Quality Guidelines

### Do's

1. **Use second person ("You are...")** - Creates embodiment, not analysis
2. **Include specific details** - Concrete numbers, names, situations
3. **Reference recent memory** - Makes agent feel "alive" with continuity
4. **Include emotional valence** - "this made you feel worried" not just "this happened"
5. **Make values actionable** - "You prioritize security" → "You prefer the safe choice"
6. **Ground in specific context** - "Columbus, Ohio" not "a city"

### Don'ts

1. **Don't ask for prediction** - "What would you do" not "What would someone like you do"
2. **Don't over-specify the answer** - Let them reason naturally
3. **Don't use AI/analyst framing** - No "analyze", "evaluate", "consider whether"
4. **Don't make all traits extreme** - Real people are nuanced
5. **Don't forget constraints** - Budget, time, effort are real for everyone
6. **Don't assume perfect information** - Real people have incomplete knowledge

---

## Calibration Notes

The prompts should produce responses that:

1. **Vary appropriately by trait** - Higher income → less price sensitive (but not zero!)
2. **Show coherent reasoning** - Values connect to decisions
3. **Match historical distributions** - If 60% said yes in real survey, simulation should be ~60%
4. **Exhibit realistic uncertainty** - Not everyone is 100% confident
5. **Include edge cases** - Some people will surprise you

If calibration shows systematic bias:
- Too positive → Add more constraint language, recent negative experiences
- Too negative → Add more aspiration language, positive framing
- Wrong segments → Adjust how traits map to reasoning style

See 06-CALIBRATION.md for the full calibration methodology.
