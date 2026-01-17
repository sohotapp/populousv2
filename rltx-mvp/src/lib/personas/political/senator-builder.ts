// Senator Persona Builder
// Generates rich prompts for congressional vote simulations

import type { SenatorPersona, ScenarioContext } from "./types";
import { SENATORS, getSenatorsByParty } from "@/data/congress/senators";

// =============================================================================
// PROMPT GENERATION
// =============================================================================

/**
 * Build a complete persona prompt for a senator
 */
export function buildSenatorPrompt(
  senator: SenatorPersona,
  scenario: ScenarioContext,
  question: string
): string {
  const identity = buildIdentitySection(senator);
  const politicalProfile = buildPoliticalProfile(senator);
  const issuePositions = buildIssuePositions(senator);
  const constituencyContext = buildConstituencyContext(senator);
  const scenarioSection = buildScenarioSection(scenario);

  return `${identity}

${politicalProfile}

${issuePositions}

${constituencyContext}

---
CURRENT SITUATION:
${scenarioSection}

---
QUESTION:
${question}

Respond as Senator ${senator.lastName} would. Explain your reasoning in first person, considering your political positions, constituency, and the current political landscape. Be specific about what factors are driving your decision.`;
}

function buildIdentitySection(senator: SenatorPersona): string {
  const roleDesc = senator.leadershipRole
    ? ` and serve as ${senator.leadershipRole}`
    : "";

  return `You are Senator ${senator.name} (${senator.party}-${senator.stateAbbr}). You have represented ${senator.state} in the United States Senate since ${senator.termStart}${roleDesc}. Your current term ends in ${senator.termEnd}.`;
}

function buildPoliticalProfile(senator: SenatorPersona): string {
  const ideologyDesc = describeIdeology(senator.ideologyScore, senator.party);
  const loyaltyDesc = describeLoyalty(senator.partyLoyalty);
  const bipartisanDesc = describeBipartisanship(senator.bipartisanScore);

  let profile = `POLITICAL PROFILE:
- Ideology: ${ideologyDesc}
- Party loyalty: ${loyaltyDesc}
- Bipartisanship: ${bipartisanDesc}`;

  if (senator.committees.length > 0) {
    profile += `\n- Committee assignments: ${senator.committees.join(", ")}`;
  }

  if (senator.committeesChaired.length > 0) {
    profile += `\n- Committees chaired: ${senator.committeesChaired.join(", ")}`;
  }

  return profile;
}

function buildIssuePositions(senator: SenatorPersona): string {
  const vr = senator.votingRecord;

  let positions = `VOTING RECORD AND POSITIONS:`;

  if (vr.chinaHawkScore >= 0.8) {
    positions += `\n- China policy: You are a strong China hawk who consistently supports tough measures against Beijing`;
  } else if (vr.chinaHawkScore >= 0.6) {
    positions += `\n- China policy: You support a firm stance on China but weigh economic implications`;
  } else {
    positions += `\n- China policy: You prefer diplomatic engagement and are cautious about escalation`;
  }

  if (vr.techRegulationScore >= 0.8) {
    positions += `\n- Tech regulation: You are a leading voice for reining in Big Tech and protecting consumers`;
  } else if (vr.techRegulationScore >= 0.6) {
    positions += `\n- Tech regulation: You support reasonable tech oversight while avoiding overreach`;
  } else {
    positions += `\n- Tech regulation: You are skeptical of heavy-handed tech regulation`;
  }

  if (vr.defenseHawkScore >= 0.8) {
    positions += `\n- Defense: You strongly support military spending and a robust national defense`;
  } else if (vr.defenseHawkScore >= 0.5) {
    positions += `\n- Defense: You support adequate defense funding while scrutinizing spending`;
  }

  if (vr.privacyScore >= 0.8) {
    positions += `\n- Privacy: You are a strong advocate for digital privacy and data protection`;
  }

  if (vr.tradeProtectionScore >= 0.8) {
    positions += `\n- Trade: You favor protectionist trade policies to support American workers`;
  }

  return positions;
}

function buildConstituencyContext(senator: SenatorPersona): string {
  const cp = senator.constituencyProfile;
  let context = `YOUR CONSTITUENCY (${senator.state}):`;

  context += `\n- Demographics: ${describeUrbanization(cp.urbanization)} state`;

  if (cp.techIndustryPresence === "high") {
    context += `\n- Major tech industry presence - decisions on tech policy directly affect your constituents' jobs`;
  }

  if (cp.militaryPresence === "high") {
    context += `\n- Significant military installations and defense contractors`;
  }

  if (cp.chineseAmericanPopulation === "high") {
    context += `\n- Large Chinese-American community whose concerns you must consider`;
  }

  if (senator.reelectionPressure >= 0.4) {
    context += `\n- You face a competitive reelection and must carefully consider how votes play with swing voters`;
  } else if (senator.reelectionPressure <= 0.15) {
    context += `\n- You are in a safe seat and can vote your convictions`;
  }

  return context;
}

function buildScenarioSection(scenario: ScenarioContext): string {
  let section = scenario.description;

  if (scenario.backgroundInfo.length > 0) {
    section += `\n\nBackground:\n${scenario.backgroundInfo.map((b) => `- ${b}`).join("\n")}`;
  }

  if (scenario.recentEvents.length > 0) {
    section += `\n\nRecent developments:\n${scenario.recentEvents.map((e) => `- ${e}`).join("\n")}`;
  }

  if (Object.keys(scenario.stakeholderPositions).length > 0) {
    section += `\n\nKey stakeholder positions:`;
    for (const [stakeholder, position] of Object.entries(scenario.stakeholderPositions)) {
      section += `\n- ${stakeholder}: ${position}`;
    }
  }

  return section;
}

// =============================================================================
// DESCRIPTION HELPERS
// =============================================================================

function describeIdeology(score: number, party: "R" | "D" | "I"): string {
  if (party === "R") {
    if (score >= 0.7) return "Very conservative Republican";
    if (score >= 0.5) return "Conservative Republican";
    if (score >= 0.3) return "Moderate Republican";
    return "Centrist Republican, often works across the aisle";
  } else if (party === "D") {
    if (score <= -0.7) return "Very progressive Democrat";
    if (score <= -0.5) return "Progressive Democrat";
    if (score <= -0.3) return "Moderate Democrat";
    return "Centrist Democrat, often works across the aisle";
  } else {
    if (score <= -0.5) return "Independent who caucuses with Democrats, progressive leaning";
    if (score >= 0.5) return "Independent who caucuses with Republicans, conservative leaning";
    return "True independent, centrist";
  }
}

function describeLoyalty(score: number): string {
  if (score >= 0.9) return "Highly loyal to party leadership, rarely breaks ranks";
  if (score >= 0.75) return "Generally votes with party, occasional independence";
  if (score >= 0.6) return "Independent streak, will cross party lines on key issues";
  return "Frequently breaks with party, known as a maverick";
}

function describeBipartisanship(score: number): string {
  if (score >= 0.6) return "Known for reaching across the aisle, co-sponsors bipartisan legislation";
  if (score >= 0.4) return "Works with the other party when interests align";
  if (score >= 0.2) return "Occasionally bipartisan but generally partisan";
  return "Strongly partisan, rarely works with the other party";
}

function describeUrbanization(type: string): string {
  switch (type) {
    case "urban": return "Primarily urban";
    case "suburban": return "Largely suburban";
    case "rural": return "Predominantly rural";
    case "mixed": return "Mixed urban/suburban/rural";
    default: return type;
  }
}

// =============================================================================
// SCENARIO BUILDERS
// =============================================================================

/**
 * Build TikTok ban vote scenario
 */
export function buildTikTokBanScenario(withChinaRetaliation = false): ScenarioContext {
  const base: ScenarioContext = {
    description: "The Senate is voting on legislation that would force ByteDance to divest TikTok's US operations or face a ban. The bill has already passed the House with strong bipartisan support.",
    backgroundInfo: [
      "TikTok has 170 million American users, predominantly young people",
      "Intelligence agencies have warned about potential Chinese government access to user data",
      "TikTok has proposed a $1.5 billion 'Project Texas' to store US data domestically",
      "The bill gives ByteDance 270 days to complete a sale or face app store removal",
    ],
    recentEvents: [
      "The House passed the bill 352-65 with bipartisan support",
      "President Biden has indicated he will sign the bill if passed",
      "TikTok has launched an aggressive lobbying campaign and in-app notifications",
    ],
    stakeholderPositions: {
      "Intelligence Community": "Supports the bill, citing national security risks",
      "Tech Industry": "Mixed - some support, others concerned about precedent",
      "Civil Liberties Groups": "Oppose, citing First Amendment concerns",
      "Young Voters": "Strongly oppose, view as government overreach",
    },
  };

  if (withChinaRetaliation) {
    base.recentEvents.push(
      "China has announced it will retaliate against US companies if the ban proceeds",
      "Beijing is threatening to restrict rare earth exports critical to US tech manufacturing",
      "Chinese state media has called the bill 'digital McCarthyism'"
    );
    base.stakeholderPositions["Business Community"] = "Increasingly concerned about escalation and supply chain disruption";
    base.stakeholderPositions["China"] = "Threatening significant economic retaliation";
  }

  return base;
}

// =============================================================================
// SAMPLING
// =============================================================================

/**
 * Sample senators for simulation
 */
export function sampleSenators(
  count: number = 100,
  options: {
    includeAll?: boolean;
    partyBalance?: boolean;
  } = {}
): SenatorPersona[] {
  if (options.includeAll || count >= SENATORS.length) {
    return [...SENATORS];
  }

  if (options.partyBalance) {
    // Maintain party balance
    const republicans = getSenatorsByParty("R");
    const democrats = getSenatorsByParty("D");
    const independents = getSenatorsByParty("I");

    const rCount = Math.round((republicans.length / SENATORS.length) * count);
    const dCount = Math.round((democrats.length / SENATORS.length) * count);
    const iCount = count - rCount - dCount;

    return [
      ...shuffleArray(republicans).slice(0, rCount),
      ...shuffleArray(democrats).slice(0, dCount),
      ...shuffleArray(independents).slice(0, iCount),
    ];
  }

  return shuffleArray([...SENATORS]).slice(0, count);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// =============================================================================
// EXPORTS
// =============================================================================

export { SENATORS } from "@/data/congress/senators";
