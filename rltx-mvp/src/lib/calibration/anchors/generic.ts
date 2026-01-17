/**
 * Generic Anchor Sets for SSR Calibration
 *
 * Provides anchor statements for different question types:
 * - Binary (yes/no)
 * - Scale (1-5 or 1-7)
 * - Choice (multiple options)
 * - Sentiment (positive/negative)
 *
 * These are used to calibrate free-text LLM responses into
 * probability distributions using semantic similarity.
 */

// Re-export AnchorSet type for convenience
export interface AnchorSet {
  id: string;
  domain?: string;
  scale: string[];
  anchors: Record<string, string[]>;
}

// =============================================================================
// BINARY (YES/NO) ANCHORS
// =============================================================================

export const BINARY_ANCHORS: AnchorSet = {
  id: "binary_yes_no",
  scale: ["strong_yes", "lean_yes", "undecided", "lean_no", "strong_no"],
  anchors: {
    strong_yes: [
      "I would definitely do this.",
      "Absolutely yes, without hesitation.",
      "This is clearly the right choice.",
      "I'm fully committed to this.",
      "Yes, I strongly support this decision.",
      "This aligns perfectly with my values and interests.",
    ],
    lean_yes: [
      "I would probably do this.",
      "I'm inclined to say yes.",
      "On balance, this seems like a good idea.",
      "I lean toward supporting this.",
      "More likely yes than no.",
      "I would tentatively agree to this.",
    ],
    undecided: [
      "I'm really not sure about this.",
      "It could go either way.",
      "I need more information to decide.",
      "There are valid points on both sides.",
      "I'm genuinely torn on this.",
      "It depends on factors I can't evaluate right now.",
    ],
    lean_no: [
      "I would probably not do this.",
      "I'm inclined to say no.",
      "On balance, this doesn't seem right.",
      "I lean toward opposing this.",
      "More likely no than yes.",
      "I would tentatively decline.",
    ],
    strong_no: [
      "I would definitely not do this.",
      "Absolutely not, under no circumstances.",
      "This is clearly wrong for me.",
      "I'm fully opposed to this.",
      "No, I strongly reject this option.",
      "This conflicts with my values and interests.",
    ],
  },
};

// =============================================================================
// SCALE (1-5) ANCHORS - AGREEMENT
// =============================================================================

export const SCALE_AGREEMENT_ANCHORS: AnchorSet = {
  id: "scale_agreement",
  scale: ["strongly_disagree", "disagree", "neutral", "agree", "strongly_agree"],
  anchors: {
    strongly_disagree: [
      "I completely disagree with this statement.",
      "This is absolutely wrong.",
      "I couldn't disagree more strongly.",
      "This is fundamentally incorrect.",
      "I reject this premise entirely.",
    ],
    disagree: [
      "I disagree with this statement.",
      "This doesn't seem right to me.",
      "I have reservations about this.",
      "I don't think this is accurate.",
      "I lean against this view.",
    ],
    neutral: [
      "I neither agree nor disagree.",
      "I'm neutral on this matter.",
      "I can see merit on both sides.",
      "I don't have a strong opinion.",
      "This is somewhere in the middle for me.",
    ],
    agree: [
      "I agree with this statement.",
      "This seems right to me.",
      "I support this position.",
      "I think this is generally correct.",
      "I lean toward this view.",
    ],
    strongly_agree: [
      "I completely agree with this statement.",
      "This is absolutely right.",
      "I couldn't agree more strongly.",
      "This is fundamentally correct.",
      "I fully endorse this position.",
    ],
  },
};

// =============================================================================
// SCALE (1-5) ANCHORS - LIKELIHOOD
// =============================================================================

export const SCALE_LIKELIHOOD_ANCHORS: AnchorSet = {
  id: "scale_likelihood",
  scale: ["very_unlikely", "unlikely", "neutral", "likely", "very_likely"],
  anchors: {
    very_unlikely: [
      "This is extremely unlikely to happen.",
      "There's almost no chance of this.",
      "I would be shocked if this occurred.",
      "The probability is near zero.",
      "This is virtually impossible given the circumstances.",
    ],
    unlikely: [
      "This probably won't happen.",
      "I doubt this will occur.",
      "The chances are fairly low.",
      "I'm skeptical this will come to pass.",
      "It's possible but improbable.",
    ],
    neutral: [
      "This could go either way.",
      "It's a coin flip.",
      "I have no strong sense of the likelihood.",
      "The odds are roughly even.",
      "It's hard to predict one way or the other.",
    ],
    likely: [
      "This will probably happen.",
      "I expect this to occur.",
      "The chances are fairly high.",
      "I'm confident this will come to pass.",
      "It's more likely than not.",
    ],
    very_likely: [
      "This is extremely likely to happen.",
      "There's almost certainty this will occur.",
      "I would be shocked if this didn't happen.",
      "The probability is near 100%.",
      "This is virtually guaranteed given the circumstances.",
    ],
  },
};

// =============================================================================
// SENTIMENT ANCHORS
// =============================================================================

export const SENTIMENT_ANCHORS: AnchorSet = {
  id: "sentiment",
  scale: ["very_negative", "negative", "neutral", "positive", "very_positive"],
  anchors: {
    very_negative: [
      "I have extremely negative feelings about this.",
      "This is terrible and unacceptable.",
      "I'm deeply disappointed and frustrated.",
      "This is a complete failure.",
      "I couldn't be more unhappy with this.",
    ],
    negative: [
      "I have negative feelings about this.",
      "This isn't good.",
      "I'm disappointed with this outcome.",
      "This falls short of expectations.",
      "I'm not satisfied with this.",
    ],
    neutral: [
      "I feel neutral about this.",
      "It's neither good nor bad.",
      "I don't have strong feelings either way.",
      "It's acceptable but not remarkable.",
      "I'm indifferent to this outcome.",
    ],
    positive: [
      "I have positive feelings about this.",
      "This is good.",
      "I'm pleased with this outcome.",
      "This meets or exceeds expectations.",
      "I'm satisfied with this.",
    ],
    very_positive: [
      "I have extremely positive feelings about this.",
      "This is excellent and wonderful.",
      "I'm thrilled and delighted.",
      "This is a complete success.",
      "I couldn't be happier with this.",
    ],
  },
};

// =============================================================================
// BEHAVIORAL RESPONSE ANCHORS (for business scenarios)
// =============================================================================

export const BEHAVIORAL_RESPONSE_ANCHORS: AnchorSet = {
  id: "behavioral_response",
  scale: ["reject", "negotiate", "accept_conditionally", "accept", "enthusiastic_accept"],
  anchors: {
    reject: [
      "I would decline this offer outright.",
      "This doesn't work for me at all.",
      "I'm not interested in pursuing this.",
      "The terms are unacceptable.",
      "I would walk away from this deal.",
      "This is a non-starter for me.",
    ],
    negotiate: [
      "I would want to negotiate the terms.",
      "The basic concept is interesting but needs adjustment.",
      "I'd counter with different terms.",
      "Let's discuss how to make this work better.",
      "I'm open to this with some modifications.",
      "We need to find middle ground here.",
    ],
    accept_conditionally: [
      "I would accept this with certain conditions.",
      "Yes, but with some caveats.",
      "I can agree to this if certain requirements are met.",
      "Conditionally, this works for me.",
      "I'm willing to proceed with some protections in place.",
    ],
    accept: [
      "I would accept this offer.",
      "This works for me.",
      "I'm comfortable proceeding with these terms.",
      "Yes, I can agree to this.",
      "This is acceptable and I'm ready to move forward.",
    ],
    enthusiastic_accept: [
      "I would enthusiastically accept this offer.",
      "This is exactly what I was looking for.",
      "I'm eager to proceed immediately.",
      "This exceeds my expectations.",
      "Absolutely yes, let's make this happen.",
      "I couldn't be more pleased with this opportunity.",
    ],
  },
};

// =============================================================================
// WILLINGNESS TO PAY ANCHORS
// =============================================================================

export const WILLINGNESS_TO_PAY_ANCHORS: AnchorSet = {
  id: "willingness_to_pay",
  scale: ["never_pay", "only_if_discounted", "fair_price", "willingly_pay", "premium_price"],
  anchors: {
    never_pay: [
      "I would never pay for this, regardless of price.",
      "This has no value to me.",
      "I wouldn't buy this even if it were free.",
      "This is a complete waste of money.",
      "I'm not in the market for this at any price.",
    ],
    only_if_discounted: [
      "I would only buy this at a significant discount.",
      "The price would need to be much lower.",
      "Maybe if it were on sale.",
      "I'd consider it at a bargain price.",
      "Only if I could get a deal on it.",
    ],
    fair_price: [
      "I would pay a fair market price for this.",
      "The price seems reasonable.",
      "I can see the value proposition.",
      "This is worth what they're asking.",
      "I would buy this at the standard price.",
    ],
    willingly_pay: [
      "I would gladly pay for this.",
      "This is worth the investment.",
      "I see this as good value for money.",
      "I'm comfortable with this purchase.",
      "The price-to-value ratio is favorable.",
    ],
    premium_price: [
      "I would pay a premium price for this.",
      "This is worth more than the asking price.",
      "I would pay top dollar for this quality.",
      "Price is secondary to the value I'm getting.",
      "I'd invest heavily in this.",
    ],
  },
};

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create anchor set appropriate for the question type
 */
export function createGenericAnchors(questionType: string): AnchorSet {
  switch (questionType) {
    case "binary":
      return BINARY_ANCHORS;
    case "scale":
      return SCALE_AGREEMENT_ANCHORS;
    case "likelihood":
      return SCALE_LIKELIHOOD_ANCHORS;
    case "sentiment":
      return SENTIMENT_ANCHORS;
    case "behavioral":
    case "choice":
      return BEHAVIORAL_RESPONSE_ANCHORS;
    case "willingness_to_pay":
    case "pricing":
      return WILLINGNESS_TO_PAY_ANCHORS;
    default:
      // Default to behavioral for business scenarios
      return BEHAVIORAL_RESPONSE_ANCHORS;
  }
}

/**
 * Get all available anchor sets
 */
export function getAllAnchorSets(): AnchorSet[] {
  return [
    BINARY_ANCHORS,
    SCALE_AGREEMENT_ANCHORS,
    SCALE_LIKELIHOOD_ANCHORS,
    SENTIMENT_ANCHORS,
    BEHAVIORAL_RESPONSE_ANCHORS,
    WILLINGNESS_TO_PAY_ANCHORS,
  ];
}
