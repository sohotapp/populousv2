/**
 * PersonaCompiler - Synthesize VIP agent profiles from nyne.ai raw data
 *
 * Takes raw API responses (interests, newsfeed, enrichment) and produces:
 * - Big Five personality traits
 * - Moral foundations
 * - Communication style
 * - Known positions on topics
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  BigFiveTraits,
  MoralFoundations,
  VIPPsychographics,
  KnownPosition,
  TopicInterest,
} from "@/db/schema";
import type {
  NyneInterests,
  NyneNewsfeed,
  NyneEnrichment,
} from "@/lib/collectors/nyne-collector";

// Anthropic client
const anthropic = new Anthropic();

// Topics we want to extract positions on
const POSITION_TOPICS = [
  "ai_regulation",
  "china_policy",
  "climate_change",
  "taxation",
  "immigration",
  "defense_spending",
  "trade_policy",
  "tech_antitrust",
  "cryptocurrency",
  "remote_work",
  "dei_initiatives",
  "data_privacy",
  "healthcare",
  "education",
  "energy_policy",
];

export interface RawVIPData {
  name: string;
  vertical: "enterprise" | "political" | "defense";
  tier: "A" | "B" | "C";
  domain: string;
  role: string;
  affiliation: string;
  interests?: NyneInterests;
  newsfeed?: NyneNewsfeed;
  enrichment?: NyneEnrichment;
}

export interface CompiledPersona {
  name: string;
  biography: string;
  bigFive: BigFiveTraits;
  moralFoundations: MoralFoundations;
  psychographics: VIPPsychographics;
  communicationStyle: string;
  sampleContent: string[];
  topicInterests: TopicInterest[];
  knownPositions: KnownPosition[];
}

/**
 * Main persona compiler class
 */
export class PersonaCompiler {
  private useAI: boolean;

  constructor(options?: { useAI?: boolean }) {
    this.useAI = options?.useAI ?? !!process.env.ANTHROPIC_API_KEY;
  }

  /**
   * Compile a full persona from raw nyne.ai data
   */
  async compile(raw: RawVIPData): Promise<CompiledPersona> {
    // Extract content samples from newsfeed
    const contentSamples = this.extractContentSamples(raw.newsfeed);

    // Build biography
    const biography = this.buildBiography(raw);

    // Infer Big Five traits
    const bigFive = await this.inferBigFive(contentSamples, biography);

    // Infer moral foundations
    const moralFoundations = await this.inferMoralFoundations(contentSamples, raw.vertical);

    // Analyze communication style
    const communicationStyle = this.analyzeCommunicationStyle(raw.newsfeed);

    // Build psychographics
    const psychographics = this.buildPsychographics(raw, bigFive);

    // Extract topic interests
    const topicInterests = this.extractTopicInterests(raw.interests);

    // Infer known positions
    const knownPositions = await this.inferKnownPositions(
      contentSamples,
      raw.vertical,
      raw.domain
    );

    return {
      name: raw.name,
      biography,
      bigFive,
      moralFoundations,
      psychographics,
      communicationStyle,
      sampleContent: contentSamples.slice(0, 5),
      topicInterests,
      knownPositions,
    };
  }

  /**
   * Extract representative content samples from newsfeed
   */
  private extractContentSamples(newsfeed?: NyneNewsfeed): string[] {
    if (!newsfeed?.recent_content) {
      return [];
    }

    // Sort by engagement to get most representative content
    const sorted = [...newsfeed.recent_content].sort(
      (a, b) => b.engagement - a.engagement
    );

    return sorted.slice(0, 10).map((item) => item.text);
  }

  /**
   * Build biography from enrichment data
   */
  private buildBiography(raw: RawVIPData): string {
    if (raw.enrichment?.biography) {
      return raw.enrichment.biography;
    }

    // Generate basic biography if none available
    const parts = [
      `${raw.name} is ${raw.role}`,
      raw.affiliation ? `at ${raw.affiliation}` : "",
      raw.domain ? `in the ${raw.domain.replace(/_/g, " ")} sector` : "",
    ].filter(Boolean);

    return parts.join(" ") + ".";
  }

  /**
   * Infer Big Five personality traits from content
   */
  async inferBigFive(
    contentSamples: string[],
    biography: string
  ): Promise<BigFiveTraits> {
    if (!this.useAI || contentSamples.length === 0) {
      return this.getDefaultBigFive();
    }

    const prompt = `Analyze the following content and biography to infer Big Five personality traits (OCEAN model).

Biography:
${biography}

Recent content samples:
${contentSamples.slice(0, 5).map((c, i) => `${i + 1}. "${c}"`).join("\n")}

For each trait, provide a score from 0.0 to 1.0 where:
- 0.0 = very low expression of this trait
- 0.5 = average
- 1.0 = very high expression of this trait

Respond with ONLY a JSON object in this exact format:
{
  "openness": <number>,
  "conscientiousness": <number>,
  "extraversion": <number>,
  "agreeableness": <number>,
  "neuroticism": <number>,
  "reasoning": "<brief explanation>"
}`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const json = JSON.parse(text);

      return {
        openness: this.clamp(json.openness, 0, 1),
        conscientiousness: this.clamp(json.conscientiousness, 0, 1),
        extraversion: this.clamp(json.extraversion, 0, 1),
        agreeableness: this.clamp(json.agreeableness, 0, 1),
        neuroticism: this.clamp(json.neuroticism, 0, 1),
      };
    } catch (error) {
      console.error("Error inferring Big Five:", error);
      return this.getDefaultBigFive();
    }
  }

  /**
   * Infer moral foundations from content
   */
  async inferMoralFoundations(
    contentSamples: string[],
    vertical: string
  ): Promise<MoralFoundations> {
    if (!this.useAI || contentSamples.length === 0) {
      return this.getDefaultMoralFoundations(vertical);
    }

    const prompt = `Analyze the following content to infer Moral Foundations (Jonathan Haidt's theory).

Content samples:
${contentSamples.slice(0, 5).map((c, i) => `${i + 1}. "${c}"`).join("\n")}

For each foundation, provide a score from 0.0 to 1.0 indicating how much this person values it:

- Care/Harm: Concern for the suffering of others
- Fairness/Cheating: Justice, rights, autonomy
- Loyalty/Betrayal: Patriotism, self-sacrifice for group
- Authority/Subversion: Respect for tradition and hierarchy
- Sanctity/Degradation: Purity, sacredness
- Liberty/Oppression: Freedom, autonomy

Respond with ONLY a JSON object:
{
  "care": <number>,
  "fairness": <number>,
  "loyalty": <number>,
  "authority": <number>,
  "sanctity": <number>,
  "liberty": <number>
}`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const json = JSON.parse(text);

      return {
        care: this.clamp(json.care, 0, 1),
        fairness: this.clamp(json.fairness, 0, 1),
        loyalty: this.clamp(json.loyalty, 0, 1),
        authority: this.clamp(json.authority, 0, 1),
        sanctity: this.clamp(json.sanctity, 0, 1),
        liberty: this.clamp(json.liberty, 0, 1),
      };
    } catch (error) {
      console.error("Error inferring moral foundations:", error);
      return this.getDefaultMoralFoundations(vertical);
    }
  }

  /**
   * Analyze communication style from newsfeed
   */
  private analyzeCommunicationStyle(newsfeed?: NyneNewsfeed): string {
    if (!newsfeed?.communication_style) {
      return "professional and measured";
    }

    const { formality, emotionality, assertiveness } = newsfeed.communication_style;

    const parts: string[] = [];

    // Formality
    if (formality > 0.7) parts.push("formal");
    else if (formality < 0.3) parts.push("casual");
    else parts.push("professional");

    // Emotionality
    if (emotionality > 0.6) parts.push("emotionally expressive");
    else if (emotionality < 0.3) parts.push("analytical");

    // Assertiveness
    if (assertiveness > 0.7) parts.push("assertive");
    else if (assertiveness < 0.3) parts.push("measured");
    else parts.push("balanced");

    return parts.join(", ");
  }

  /**
   * Build psychographics profile
   */
  private buildPsychographics(
    raw: RawVIPData,
    bigFive: BigFiveTraits
  ): VIPPsychographics {
    // Infer risk tolerance from Big Five (extraversion + openness correlate with risk-taking)
    const riskTolerance = (bigFive.extraversion + bigFive.openness) / 2;

    // Infer decision style from Big Five
    let decisionStyle: "analytical" | "intuitive" | "consensus";
    if (bigFive.conscientiousness > 0.6 && bigFive.openness < 0.5) {
      decisionStyle = "analytical";
    } else if (bigFive.openness > 0.6 && bigFive.conscientiousness < 0.5) {
      decisionStyle = "intuitive";
    } else {
      decisionStyle = "consensus";
    }

    // Infer influenceability (inverse of conscientiousness + neuroticism effect)
    const influenceability = Math.max(
      0,
      Math.min(1, 1 - bigFive.conscientiousness * 0.5 + bigFive.neuroticism * 0.2)
    );

    // Public-private gap (higher extraversion = more consistent public persona)
    const publicPrivateGap = 1 - bigFive.extraversion * 0.5;

    return {
      riskTolerance,
      decisionStyle,
      influenceability,
      publicPrivateGap,
    };
  }

  /**
   * Extract topic interests from nyne.ai interests data
   */
  private extractTopicInterests(interests?: NyneInterests): TopicInterest[] {
    if (!interests?.interests) {
      return [];
    }

    return interests.interests.map((item) => ({
      topic: item.topic,
      weight: item.weight,
      category: item.category,
      source: "nyne.ai",
    }));
  }

  /**
   * Infer known positions on key topics
   */
  async inferKnownPositions(
    contentSamples: string[],
    vertical: string,
    domain: string
  ): Promise<KnownPosition[]> {
    if (!this.useAI || contentSamples.length === 0) {
      return [];
    }

    // Select relevant topics based on vertical
    const relevantTopics = this.getRelevantTopics(vertical, domain);

    const prompt = `Analyze the following content samples to infer this person's likely positions on key topics.

Content samples:
${contentSamples.slice(0, 5).map((c, i) => `${i + 1}. "${c}"`).join("\n")}

For each of the following topics, provide:
- stance: number from -1 (strongly against) to +1 (strongly for), or null if unknown
- confidence: how confident are you in this assessment (0-1)

Topics: ${relevantTopics.join(", ")}

Respond with ONLY a JSON array:
[
  {"topic": "<topic>", "stance": <number or null>, "confidence": <number>},
  ...
]

Only include topics where you can make a reasonable inference (confidence > 0.3).`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const positions = JSON.parse(text);

      return positions
        .filter((p: { stance: number | null; confidence: number }) =>
          p.stance !== null && p.confidence > 0.3
        )
        .map((p: { topic: string; stance: number; confidence: number }) => ({
          topic: p.topic,
          stance: this.clamp(p.stance, -1, 1),
          confidence: this.clamp(p.confidence, 0, 1),
          source: "inferred_from_content",
        }));
    } catch (error) {
      console.error("Error inferring positions:", error);
      return [];
    }
  }

  /**
   * Get relevant topics for a vertical/domain
   */
  private getRelevantTopics(vertical: string, domain: string): string[] {
    const baseTopic = [...POSITION_TOPICS];

    // Add vertical-specific topics
    if (vertical === "political") {
      baseTopic.push("bipartisanship", "campaign_finance", "voting_rights");
    } else if (vertical === "enterprise") {
      baseTopic.push("ai_adoption", "sustainability_esg", "workforce_automation");
    } else if (vertical === "defense") {
      baseTopic.push("military_modernization", "cyber_warfare", "alliance_policy");
    }

    return baseTopic.slice(0, 10);
  }

  // Helper methods

  private getDefaultBigFive(): BigFiveTraits {
    return {
      openness: 0.5,
      conscientiousness: 0.5,
      extraversion: 0.5,
      agreeableness: 0.5,
      neuroticism: 0.5,
    };
  }

  private getDefaultMoralFoundations(vertical: string): MoralFoundations {
    // Default profiles by vertical
    if (vertical === "political") {
      return {
        care: 0.6,
        fairness: 0.7,
        loyalty: 0.5,
        authority: 0.5,
        sanctity: 0.4,
        liberty: 0.6,
      };
    } else if (vertical === "defense") {
      return {
        care: 0.5,
        fairness: 0.5,
        loyalty: 0.8,
        authority: 0.7,
        sanctity: 0.5,
        liberty: 0.6,
      };
    } else {
      // Enterprise
      return {
        care: 0.5,
        fairness: 0.6,
        loyalty: 0.5,
        authority: 0.5,
        sanctity: 0.3,
        liberty: 0.7,
      };
    }
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

// Singleton instance
let compilerInstance: PersonaCompiler | null = null;

export function getPersonaCompiler(options?: { useAI?: boolean }): PersonaCompiler {
  if (!compilerInstance) {
    compilerInstance = new PersonaCompiler(options);
  }
  return compilerInstance;
}

/**
 * Compile a batch of VIPs
 */
export async function compileBatch(
  vips: RawVIPData[],
  options?: {
    onProgress?: (current: number, total: number, result: CompiledPersona) => void;
    useAI?: boolean;
  }
): Promise<CompiledPersona[]> {
  const compiler = getPersonaCompiler({ useAI: options?.useAI });
  const results: CompiledPersona[] = [];

  for (let i = 0; i < vips.length; i++) {
    const vip = vips[i];
    const persona = await compiler.compile(vip);
    results.push(persona);

    if (options?.onProgress) {
      options.onProgress(i + 1, vips.length, persona);
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}
