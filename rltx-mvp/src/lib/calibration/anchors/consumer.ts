/**
 * Consumer Domain Anchor Sets for SSR Calibration
 *
 * Specialized anchors for B2C consumer decision-making scenarios:
 * - Purchase intent
 * - Brand perception
 * - Product satisfaction
 * - Price sensitivity
 * - Subscription decisions
 *
 * These anchors capture the language and decision patterns of
 * everyday consumers making personal purchasing decisions.
 */

import type { AnchorSet } from "./generic";

// =============================================================================
// CONSUMER PURCHASE INTENT ANCHORS
// =============================================================================

export const CONSUMER_PURCHASE_INTENT_ANCHORS: AnchorSet = {
  id: "consumer_purchase_intent",
  domain: "consumer",
  scale: ["never_buy", "unlikely_buy", "might_buy", "likely_buy", "definitely_buy"],
  anchors: {
    never_buy: [
      "I would never buy this product.",
      "This isn't for me at all.",
      "I have no interest in purchasing this.",
      "I wouldn't buy this even if I needed it.",
      "This doesn't appeal to me whatsoever.",
      "I'd look for alternatives instead.",
    ],
    unlikely_buy: [
      "I probably wouldn't buy this.",
      "It's not something I'd prioritize.",
      "I'm skeptical about this product.",
      "I don't see myself purchasing this.",
      "Maybe if nothing else was available.",
      "I'd need a lot of convincing.",
    ],
    might_buy: [
      "I might consider buying this.",
      "It depends on the circumstances.",
      "I could see myself purchasing this eventually.",
      "I'm on the fence about this.",
      "If the price was right, maybe.",
      "I'd want to learn more first.",
    ],
    likely_buy: [
      "I would probably buy this.",
      "This looks like something I'd purchase.",
      "I'm interested in buying this.",
      "I can see this in my shopping cart.",
      "This appeals to me.",
      "I'd seriously consider this purchase.",
    ],
    definitely_buy: [
      "I would definitely buy this.",
      "This is exactly what I've been looking for.",
      "I'm ready to purchase this right now.",
      "Take my money!",
      "I need this in my life.",
      "I'm sold on this product.",
    ],
  },
};

// =============================================================================
// CONSUMER BRAND PERCEPTION ANCHORS
// =============================================================================

export const CONSUMER_BRAND_PERCEPTION_ANCHORS: AnchorSet = {
  id: "consumer_brand_perception",
  domain: "consumer",
  scale: ["very_negative", "negative", "neutral", "positive", "very_positive"],
  anchors: {
    very_negative: [
      "I have a terrible impression of this brand.",
      "I actively avoid this company.",
      "This brand has lost my trust completely.",
      "I would never recommend this brand to anyone.",
      "My experience with them has been awful.",
      "This is a brand I associate with poor quality.",
    ],
    negative: [
      "I have a somewhat negative view of this brand.",
      "I'm not impressed with this company.",
      "They've disappointed me in the past.",
      "I'd prefer other brands over this one.",
      "My perception of them isn't great.",
      "I have some concerns about this brand.",
    ],
    neutral: [
      "I don't have strong feelings about this brand.",
      "They're just okay in my book.",
      "I neither love nor hate this brand.",
      "They're one of many options to me.",
      "I'm indifferent to this company.",
      "They haven't made much of an impression.",
    ],
    positive: [
      "I have a good impression of this brand.",
      "I generally like this company.",
      "They've earned my respect.",
      "I'd consider them for future purchases.",
      "My experience with them has been positive.",
      "I think of them as a quality brand.",
    ],
    very_positive: [
      "I love this brand.",
      "They're one of my favorite companies.",
      "I'm a loyal customer and advocate.",
      "I recommend them to everyone.",
      "This brand consistently exceeds my expectations.",
      "I trust this brand completely.",
    ],
  },
};

// =============================================================================
// CONSUMER PRODUCT SATISFACTION ANCHORS
// =============================================================================

export const CONSUMER_SATISFACTION_ANCHORS: AnchorSet = {
  id: "consumer_satisfaction",
  domain: "consumer",
  scale: ["very_dissatisfied", "dissatisfied", "neutral", "satisfied", "very_satisfied"],
  anchors: {
    very_dissatisfied: [
      "I'm extremely unhappy with this product.",
      "This was a complete waste of money.",
      "I want a refund immediately.",
      "This is the worst purchase I've made.",
      "I regret buying this entirely.",
      "I would give this zero stars if I could.",
    ],
    dissatisfied: [
      "I'm not happy with this purchase.",
      "This didn't meet my expectations.",
      "I'm disappointed with the quality.",
      "I probably wouldn't buy this again.",
      "There are significant issues with this product.",
      "I expected more for the price.",
    ],
    neutral: [
      "This product is okay.",
      "It does what it's supposed to do.",
      "Nothing special, but not bad either.",
      "It meets basic expectations.",
      "I'm neither impressed nor disappointed.",
      "It's adequate for my needs.",
    ],
    satisfied: [
      "I'm happy with this purchase.",
      "This product meets my expectations.",
      "Good value for the money.",
      "I would buy this again.",
      "I'm pleased with the quality.",
      "This was a good decision.",
    ],
    very_satisfied: [
      "I'm thrilled with this product.",
      "This exceeded all my expectations.",
      "Best purchase I've made in a long time.",
      "I can't recommend this enough.",
      "Absolutely love everything about it.",
      "Five stars, no hesitation.",
    ],
  },
};

// =============================================================================
// CONSUMER PRICE SENSITIVITY ANCHORS
// =============================================================================

export const CONSUMER_PRICE_SENSITIVITY_ANCHORS: AnchorSet = {
  id: "consumer_price_sensitivity",
  domain: "consumer",
  scale: ["too_expensive", "expensive", "fair_price", "good_value", "great_deal"],
  anchors: {
    too_expensive: [
      "This is way too expensive for what it is.",
      "I can't justify spending this much.",
      "The price is outrageous.",
      "This is completely out of my budget.",
      "No product is worth this price.",
      "I'll wait for a major price drop.",
    ],
    expensive: [
      "This is on the pricey side.",
      "I'd have to think hard about spending this much.",
      "The price gives me pause.",
      "It's more than I wanted to spend.",
      "I'd prefer a cheaper option.",
      "The price is a barrier for me.",
    ],
    fair_price: [
      "The price seems reasonable.",
      "This is about what I'd expect to pay.",
      "The price is fair for what you get.",
      "I can work with this price.",
      "It's neither cheap nor expensive.",
      "The pricing is in line with the market.",
    ],
    good_value: [
      "This is a good value for the money.",
      "You get a lot for what you pay.",
      "The price-to-quality ratio is favorable.",
      "I feel like I'm getting my money's worth.",
      "This is priced well.",
      "Smart purchase at this price point.",
    ],
    great_deal: [
      "This is an amazing deal!",
      "I can't believe how affordable this is.",
      "This is a steal at this price.",
      "I'd buy multiple at this price.",
      "The value here is incredible.",
      "I feel like I'm getting away with something.",
    ],
  },
};

// =============================================================================
// CONSUMER SUBSCRIPTION DECISION ANCHORS
// =============================================================================

export const CONSUMER_SUBSCRIPTION_ANCHORS: AnchorSet = {
  id: "consumer_subscription",
  domain: "consumer",
  scale: ["cancel", "downgrade", "maintain", "upgrade", "advocate"],
  anchors: {
    cancel: [
      "I'm going to cancel my subscription.",
      "This service isn't worth paying for anymore.",
      "I need to cut this from my budget.",
      "I'm not getting enough value to continue.",
      "Time to unsubscribe.",
      "I've had enough of this service.",
    ],
    downgrade: [
      "I should switch to a cheaper plan.",
      "I don't need all these features.",
      "The basic tier would be enough for me.",
      "I want to reduce my monthly cost.",
      "I'll downgrade but keep the service.",
      "A lower tier makes more sense for my usage.",
    ],
    maintain: [
      "I'll keep my current subscription.",
      "The current plan works for me.",
      "No changes needed right now.",
      "I'm comfortable with what I'm paying.",
      "I'll stay at this level.",
      "My current subscription meets my needs.",
    ],
    upgrade: [
      "I should upgrade to a better plan.",
      "I want access to more features.",
      "The premium tier would be worth it.",
      "I'm ready to invest more in this service.",
      "Time to level up my subscription.",
      "I'd get more value from a higher tier.",
    ],
    advocate: [
      "I love this subscription and tell everyone about it.",
      "This is the best money I spend each month.",
      "I've gotten friends and family to subscribe.",
      "I couldn't imagine life without this service.",
      "Worth every penny and then some.",
      "I'm a superfan of this subscription.",
    ],
  },
};

// =============================================================================
// CONSUMER RECOMMENDATION ANCHORS (NPS-style)
// =============================================================================

export const CONSUMER_RECOMMENDATION_ANCHORS: AnchorSet = {
  id: "consumer_recommendation",
  domain: "consumer",
  scale: ["detractor", "passive_negative", "passive", "passive_positive", "promoter"],
  anchors: {
    detractor: [
      "I would actively warn people away from this.",
      "I've told friends to avoid this.",
      "I regret recommending this in the past.",
      "I would give this a very low score.",
      "I'm disappointed enough to speak up.",
      "People should know about my bad experience.",
    ],
    passive_negative: [
      "I wouldn't go out of my way to recommend this.",
      "It's okay but not worth mentioning.",
      "I have mixed feelings about recommending this.",
      "I'd probably suggest looking at alternatives.",
      "Not bad, but not recommendation-worthy.",
      "I'd give it a lukewarm review.",
    ],
    passive: [
      "I'm neutral about recommending this.",
      "If someone asked, I'd say it's fine.",
      "I neither recommend nor discourage it.",
      "It depends on what they're looking for.",
      "I don't have strong feelings either way.",
      "It's adequate but not special.",
    ],
    passive_positive: [
      "I'd probably recommend this if asked.",
      "It's pretty good, worth considering.",
      "I'd give it a positive mention.",
      "I think most people would like this.",
      "I'd say good things about it.",
      "Worth a look, in my opinion.",
    ],
    promoter: [
      "I enthusiastically recommend this to everyone.",
      "I've already told all my friends about this.",
      "This is a must-have, trust me.",
      "I can't say enough good things.",
      "I'm basically a brand ambassador at this point.",
      "10 out of 10, would recommend.",
    ],
  },
};

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Get consumer anchor set by scenario type
 */
export function getConsumerAnchors(scenarioType: string): AnchorSet {
  switch (scenarioType) {
    case "purchase":
    case "buy":
    case "intent":
      return CONSUMER_PURCHASE_INTENT_ANCHORS;
    case "brand":
    case "perception":
    case "image":
      return CONSUMER_BRAND_PERCEPTION_ANCHORS;
    case "satisfaction":
    case "product":
    case "experience":
      return CONSUMER_SATISFACTION_ANCHORS;
    case "price":
    case "value":
    case "cost":
      return CONSUMER_PRICE_SENSITIVITY_ANCHORS;
    case "subscription":
    case "membership":
    case "renewal":
      return CONSUMER_SUBSCRIPTION_ANCHORS;
    case "recommendation":
    case "nps":
    case "referral":
      return CONSUMER_RECOMMENDATION_ANCHORS;
    default:
      return CONSUMER_PURCHASE_INTENT_ANCHORS;
  }
}

/**
 * Get all consumer anchor sets
 */
export function getAllConsumerAnchors(): AnchorSet[] {
  return [
    CONSUMER_PURCHASE_INTENT_ANCHORS,
    CONSUMER_BRAND_PERCEPTION_ANCHORS,
    CONSUMER_SATISFACTION_ANCHORS,
    CONSUMER_PRICE_SENSITIVITY_ANCHORS,
    CONSUMER_SUBSCRIPTION_ANCHORS,
    CONSUMER_RECOMMENDATION_ANCHORS,
  ];
}
