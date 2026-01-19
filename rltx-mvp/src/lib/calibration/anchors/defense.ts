/**
 * Defense Domain Anchor Sets for SSR Calibration
 *
 * Specialized anchors for defense and national security scenarios:
 * - Threat assessment
 * - Strategic decisions
 * - Alliance dynamics
 * - Capability evaluation
 * - Policy response
 *
 * These anchors capture the language and decision patterns of
 * defense officials, military leaders, and policy analysts.
 */

import type { AnchorSet } from "./generic";

// =============================================================================
// THREAT ASSESSMENT ANCHORS
// =============================================================================

export const DEFENSE_THREAT_ASSESSMENT_ANCHORS: AnchorSet = {
  id: "defense_threat_assessment",
  domain: "defense",
  scale: ["negligible", "low", "moderate", "high", "critical"],
  anchors: {
    negligible: [
      "This poses no meaningful threat to our interests.",
      "The risk level is essentially zero.",
      "We can safely deprioritize this concern.",
      "This is not a credible threat.",
      "No action or monitoring is required.",
      "This falls well below our threshold for concern.",
    ],
    low: [
      "This represents a minor threat that warrants monitoring.",
      "The risk is present but manageable.",
      "Standard precautions should be sufficient.",
      "We should maintain awareness but not escalate.",
      "This is a low-priority concern.",
      "Routine surveillance is appropriate.",
    ],
    moderate: [
      "This is a significant threat requiring active management.",
      "We need to dedicate resources to address this.",
      "The risk level justifies enhanced measures.",
      "This should be elevated in our priority list.",
      "Proactive mitigation steps are warranted.",
      "We cannot afford to be complacent here.",
    ],
    high: [
      "This is a serious threat to our security interests.",
      "Immediate attention and resources are required.",
      "We need to implement defensive measures now.",
      "This poses substantial risk to our operations.",
      "Leadership needs to be briefed on this threat.",
      "We should prepare contingency responses.",
    ],
    critical: [
      "This is an existential threat requiring immediate action.",
      "All available resources should be mobilized.",
      "This is a clear and present danger.",
      "We are at a critical decision point.",
      "Failure to act could have catastrophic consequences.",
      "This demands the highest level of response.",
    ],
  },
};

// =============================================================================
// STRATEGIC DECISION ANCHORS
// =============================================================================

export const DEFENSE_STRATEGIC_DECISION_ANCHORS: AnchorSet = {
  id: "defense_strategic_decision",
  domain: "defense",
  scale: ["strongly_oppose", "oppose", "neutral", "support", "strongly_support"],
  anchors: {
    strongly_oppose: [
      "This course of action is strategically unsound.",
      "I cannot support this decision under any circumstances.",
      "This would undermine our core interests.",
      "The risks far outweigh any potential benefits.",
      "This represents a fundamental strategic error.",
      "I would resign before implementing this.",
    ],
    oppose: [
      "I have significant reservations about this approach.",
      "The strategic rationale is not compelling.",
      "I believe there are better alternatives.",
      "This doesn't align with our doctrine.",
      "I would advise against this course of action.",
      "The costs likely exceed the benefits.",
    ],
    neutral: [
      "I can see arguments on both sides.",
      "The strategic implications are unclear.",
      "More analysis is needed before I can form a view.",
      "This is a close call with valid points either way.",
      "I'm withholding judgment pending further information.",
      "The decision could go either way.",
    ],
    support: [
      "I believe this is a sound strategic decision.",
      "The benefits justify the risks involved.",
      "This aligns with our strategic objectives.",
      "I would recommend proceeding with this approach.",
      "The analysis supports this course of action.",
      "This represents a reasonable path forward.",
    ],
    strongly_support: [
      "This is exactly the right strategic move.",
      "I fully endorse this decision.",
      "This will significantly advance our interests.",
      "We should implement this without delay.",
      "This is a decisive and necessary action.",
      "History will vindicate this decision.",
    ],
  },
};

// =============================================================================
// ALLIANCE DYNAMICS ANCHORS
// =============================================================================

export const DEFENSE_ALLIANCE_ANCHORS: AnchorSet = {
  id: "defense_alliance",
  domain: "defense",
  scale: ["adversarial", "competitive", "neutral", "cooperative", "allied"],
  anchors: {
    adversarial: [
      "This actor is fundamentally hostile to our interests.",
      "We should treat them as an adversary.",
      "Their actions are consistently antagonistic.",
      "No basis for cooperation exists.",
      "We must prepare for potential conflict.",
      "Their intentions are clearly malign.",
    ],
    competitive: [
      "We have competing interests with this actor.",
      "The relationship is characterized by rivalry.",
      "We should engage cautiously and protect our interests.",
      "Limited cooperation may be possible on specific issues.",
      "Trust but verify should be our approach.",
      "We're not enemies but we're not friends either.",
    ],
    neutral: [
      "This actor is neither friend nor foe.",
      "We have no significant conflicts or alignment.",
      "The relationship is transactional at best.",
      "We should maintain diplomatic distance.",
      "No strong strategic interest in closer ties.",
      "A neutral posture serves our interests.",
    ],
    cooperative: [
      "We have significant shared interests with this actor.",
      "Cooperation would benefit both parties.",
      "We should pursue closer engagement.",
      "There's potential for a productive partnership.",
      "Our interests are largely aligned.",
      "We should invest in building this relationship.",
    ],
    allied: [
      "This is a trusted ally and strategic partner.",
      "We share fundamental values and interests.",
      "We should coordinate closely on all matters.",
      "This relationship is vital to our security.",
      "We would come to their defense if needed.",
      "Our alliance is a cornerstone of our strategy.",
    ],
  },
};

// =============================================================================
// CAPABILITY EVALUATION ANCHORS
// =============================================================================

export const DEFENSE_CAPABILITY_ANCHORS: AnchorSet = {
  id: "defense_capability",
  domain: "defense",
  scale: ["inadequate", "limited", "sufficient", "strong", "superior"],
  anchors: {
    inadequate: [
      "Current capabilities are dangerously insufficient.",
      "We have critical gaps that must be addressed.",
      "We cannot accomplish the mission with these resources.",
      "Immediate investment is required.",
      "We are at a significant disadvantage.",
      "This represents an unacceptable vulnerability.",
    ],
    limited: [
      "Our capabilities are constrained in key areas.",
      "We can accomplish basic objectives but face limitations.",
      "Additional resources would significantly improve effectiveness.",
      "We're operating below optimal capacity.",
      "Certain scenarios would strain our capabilities.",
      "Improvements are needed but not urgent.",
    ],
    sufficient: [
      "Our capabilities meet current requirements.",
      "We can accomplish assigned missions effectively.",
      "Resources are adequate for expected scenarios.",
      "No immediate capability gaps exist.",
      "We're at an appropriate level of readiness.",
      "Current investments are well-calibrated.",
    ],
    strong: [
      "We have robust capabilities in this domain.",
      "Our forces are well-equipped and trained.",
      "We can handle a range of contingencies.",
      "We maintain a favorable position.",
      "Our capabilities provide strategic advantage.",
      "We're well-positioned for current challenges.",
    ],
    superior: [
      "We have decisive superiority in this area.",
      "Our capabilities are unmatched.",
      "We can dominate any scenario in this domain.",
      "This is a core strength we should leverage.",
      "No adversary can match our capabilities here.",
      "We set the standard others aspire to.",
    ],
  },
};

// =============================================================================
// POLICY RESPONSE ANCHORS
// =============================================================================

export const DEFENSE_POLICY_RESPONSE_ANCHORS: AnchorSet = {
  id: "defense_policy_response",
  domain: "defense",
  scale: ["de_escalate", "restrain", "maintain", "escalate", "decisive_action"],
  anchors: {
    de_escalate: [
      "We should actively seek to reduce tensions.",
      "A diplomatic off-ramp is preferable.",
      "Further escalation serves no one's interests.",
      "We should signal our willingness to negotiate.",
      "Restraint is the wisest course here.",
      "Let's create space for a peaceful resolution.",
    ],
    restrain: [
      "We should avoid actions that could escalate.",
      "A measured response is appropriate.",
      "We don't need to match every provocation.",
      "Strategic patience is warranted.",
      "Let's not overreact to this development.",
      "Proportionality should guide our response.",
    ],
    maintain: [
      "We should maintain our current posture.",
      "No change in policy is required.",
      "Our existing approach remains appropriate.",
      "Consistency sends the right signal.",
      "We should stay the course.",
      "The situation doesn't warrant adjustment.",
    ],
    escalate: [
      "A stronger response is necessary.",
      "We need to demonstrate resolve.",
      "Inaction would be interpreted as weakness.",
      "We should increase pressure.",
      "A more assertive posture is warranted.",
      "We must respond to this provocation.",
    ],
    decisive_action: [
      "This requires immediate and forceful action.",
      "We must act decisively to protect our interests.",
      "The time for half-measures has passed.",
      "We should use all available instruments of power.",
      "A clear and overwhelming response is needed.",
      "We cannot afford to hesitate any longer.",
    ],
  },
};

// =============================================================================
// INTELLIGENCE CONFIDENCE ANCHORS
// =============================================================================

export const DEFENSE_INTELLIGENCE_CONFIDENCE_ANCHORS: AnchorSet = {
  id: "defense_intelligence_confidence",
  domain: "defense",
  scale: ["very_low", "low", "moderate", "high", "very_high"],
  anchors: {
    very_low: [
      "We have minimal confidence in this assessment.",
      "The intelligence is fragmentary and unreliable.",
      "Multiple alternative explanations exist.",
      "We cannot make decisions based on this information.",
      "Significant gaps in our understanding remain.",
      "This is essentially speculation at this point.",
    ],
    low: [
      "Our confidence in this assessment is limited.",
      "The evidence is suggestive but not conclusive.",
      "We have some corroborating information.",
      "Alternative explanations cannot be ruled out.",
      "More collection is needed to increase confidence.",
      "We should treat this as preliminary.",
    ],
    moderate: [
      "We have reasonable confidence in this assessment.",
      "Multiple sources support this conclusion.",
      "The evidence is credible but not definitive.",
      "This is our best current understanding.",
      "Some uncertainty remains but the picture is clear.",
      "We can make informed decisions based on this.",
    ],
    high: [
      "We have high confidence in this assessment.",
      "Strong evidence supports this conclusion.",
      "Multiple independent sources corroborate.",
      "Alternative explanations are unlikely.",
      "We can act on this intelligence with confidence.",
      "The analytical judgment is well-supported.",
    ],
    very_high: [
      "We have near-certainty in this assessment.",
      "The evidence is overwhelming and consistent.",
      "All sources point to the same conclusion.",
      "We would stake our reputation on this.",
      "This is as close to certain as intelligence gets.",
      "No reasonable alternative explanation exists.",
    ],
  },
};

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Get defense anchor set by scenario type
 */
export function getDefenseAnchors(scenarioType: string): AnchorSet {
  switch (scenarioType) {
    case "threat":
    case "risk":
    case "assessment":
      return DEFENSE_THREAT_ASSESSMENT_ANCHORS;
    case "strategic":
    case "decision":
    case "policy":
      return DEFENSE_STRATEGIC_DECISION_ANCHORS;
    case "alliance":
    case "diplomatic":
    case "relationship":
      return DEFENSE_ALLIANCE_ANCHORS;
    case "capability":
    case "readiness":
    case "force":
      return DEFENSE_CAPABILITY_ANCHORS;
    case "response":
    case "action":
    case "escalation":
      return DEFENSE_POLICY_RESPONSE_ANCHORS;
    case "intelligence":
    case "confidence":
    case "analysis":
      return DEFENSE_INTELLIGENCE_CONFIDENCE_ANCHORS;
    default:
      return DEFENSE_STRATEGIC_DECISION_ANCHORS;
  }
}

/**
 * Get all defense anchor sets
 */
export function getAllDefenseAnchors(): AnchorSet[] {
  return [
    DEFENSE_THREAT_ASSESSMENT_ANCHORS,
    DEFENSE_STRATEGIC_DECISION_ANCHORS,
    DEFENSE_ALLIANCE_ANCHORS,
    DEFENSE_CAPABILITY_ANCHORS,
    DEFENSE_POLICY_RESPONSE_ANCHORS,
    DEFENSE_INTELLIGENCE_CONFIDENCE_ANCHORS,
  ];
}
