// Calibration module exports
export * from "./ssr-static";
export * from "./ssr-rater";
export * from "./embeddings";

// Domain-specific anchor sets
export * from "./anchors/generic";
export * from "./anchors/political";
export * from "./anchors/enterprise";
export * from "./anchors/consumer";
export * from "./anchors/defense";

// Re-export anchor factory functions
import { createGenericAnchors, getAllAnchorSets } from "./anchors/generic";
import { getEnterpriseAnchors, getAllEnterpriseAnchors } from "./anchors/enterprise";
import { getConsumerAnchors, getAllConsumerAnchors } from "./anchors/consumer";
import { getDefenseAnchors, getAllDefenseAnchors } from "./anchors/defense";
import type { AnchorSet } from "./anchors/generic";

/**
 * Get anchors for a specific domain and scenario type
 */
export function getAnchorsForDomain(
  domain: string,
  scenarioType: string
): AnchorSet {
  switch (domain) {
    case "enterprise":
      return getEnterpriseAnchors(scenarioType);
    case "consumer":
      return getConsumerAnchors(scenarioType);
    case "defense":
      return getDefenseAnchors(scenarioType);
    default:
      return createGenericAnchors(scenarioType);
  }
}

/**
 * Get all available anchor sets across all domains
 */
export function getAllDomainAnchors(): Record<string, AnchorSet[]> {
  return {
    generic: getAllAnchorSets(),
    enterprise: getAllEnterpriseAnchors(),
    consumer: getAllConsumerAnchors(),
    defense: getAllDefenseAnchors(),
  };
}
