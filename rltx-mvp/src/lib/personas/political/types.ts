// Political Persona Types
// Defines the structure for Congressional and political actor personas

// =============================================================================
// SENATOR PERSONA
// =============================================================================

export interface SenatorPersona {
  // Identity
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  party: "R" | "D" | "I";
  state: string;
  stateAbbr: string;
  chamber: "senate";

  // Political profile
  ideologyScore: number; // DW-NOMINATE score (-1 = very liberal, +1 = very conservative)
  leadershipRole?: string; // "Majority Leader", "Minority Whip", etc.
  seniorityRank: number; // 1 = most senior
  termStart: number; // Year first elected to current chamber
  termEnd: number; // Year current term ends

  // Committees
  committees: string[];
  committeesChaired: string[];

  // Issue positions (derived from voting record)
  keyIssues: KeyIssue[];
  votingRecord: VotingRecord;

  // Behavioral factors
  reelectionPressure: number; // 0-1, higher = more vulnerable
  bipartisanScore: number; // 0-1, higher = more bipartisan
  partyLoyalty: number; // 0-1, higher = more loyal to party

  // Demographics of constituency
  constituencyProfile: ConstituencyProfile;

  // Optional nyne.ai enrichment
  psychProfile?: BigFive;
  communicationStyle?: string;
  mediaPresence?: number; // 0-1
}

export interface KeyIssue {
  topic: string;
  position: "strongly_favor" | "favor" | "neutral" | "oppose" | "strongly_oppose";
  salience: number; // 0-1, how important is this issue to them
}

export interface VotingRecord {
  chinaHawkScore: number; // 0-1
  techRegulationScore: number; // 0-1
  defenseHawkScore: number; // 0-1
  tradeProtectionScore: number; // 0-1
  privacyScore: number; // 0-1
}

export interface ConstituencyProfile {
  urbanization: "urban" | "suburban" | "rural" | "mixed";
  techIndustryPresence: "high" | "medium" | "low";
  militaryPresence: "high" | "medium" | "low";
  chineseAmericanPopulation: "high" | "medium" | "low";
  medianIncome: number;
  educationLevel: "high" | "medium" | "low";
}

export interface BigFive {
  openness: number; // 0-1
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

// =============================================================================
// HOUSE REPRESENTATIVE PERSONA (subset of senator fields)
// =============================================================================

export interface RepresentativePersona extends Omit<SenatorPersona, "chamber"> {
  chamber: "house";
  district: number;
  districtType: "safe_R" | "lean_R" | "competitive" | "lean_D" | "safe_D";
}

// =============================================================================
// GENERIC POLITICAL ACTOR
// =============================================================================

export type CongressMember = SenatorPersona | RepresentativePersona;

// =============================================================================
// VOTER ARCHETYPE
// =============================================================================

export interface VoterArchetype {
  id: string;
  name: string;
  description: string;

  // Demographics
  ageRange: [number, number];
  education: string;
  income: string;
  urbanization: string;
  region: string;

  // Political profile
  partyAffiliation: "strong_R" | "lean_R" | "independent" | "lean_D" | "strong_D";
  ideologyScore: number; // -1 to 1

  // Key issues
  topIssues: string[];
  issueWeights: Record<string, number>;

  // Behavioral
  votelikelihood: number; // 0-1
  persuadability: number; // 0-1
  mediaConsumption: string[];

  // Psychological
  bigFive?: BigFive;
  moralFoundations?: MoralFoundations;
}

export interface MoralFoundations {
  care: number;
  fairness: number;
  loyalty: number;
  authority: number;
  sanctity: number;
  liberty: number;
}

// =============================================================================
// PROMPT CONTEXT
// =============================================================================

export interface SenatorPromptContext {
  persona: SenatorPersona;
  scenario: ScenarioContext;
  question: string;
}

export interface ScenarioContext {
  description: string;
  backgroundInfo: string[];
  recentEvents: string[];
  stakeholderPositions: Record<string, string>;
}
