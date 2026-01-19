/**
 * Enterprise Domain Anchor Sets for SSR Calibration
 *
 * Specialized anchors for B2B enterprise decision-making scenarios:
 * - Procurement decisions
 * - Vendor selection
 * - Contract negotiations
 * - Technology adoption
 * - Budget approvals
 *
 * These anchors capture the language and decision patterns of
 * enterprise buyers (CFOs, CTOs, procurement officers, etc.)
 */

import type { AnchorSet } from "./generic";

// =============================================================================
// ENTERPRISE PROCUREMENT DECISION ANCHORS
// =============================================================================

export const ENTERPRISE_PROCUREMENT_ANCHORS: AnchorSet = {
  id: "enterprise_procurement",
  domain: "enterprise",
  scale: ["reject", "defer", "evaluate", "shortlist", "approve"],
  anchors: {
    reject: [
      "This doesn't meet our enterprise requirements.",
      "The ROI doesn't justify the investment.",
      "We have concerns about vendor stability.",
      "This fails our security and compliance review.",
      "The total cost of ownership is too high.",
      "This isn't aligned with our strategic direction.",
      "We need to pass on this opportunity.",
    ],
    defer: [
      "We need to revisit this next budget cycle.",
      "The timing isn't right for this investment.",
      "Let's table this until we complete our current initiatives.",
      "We're not ready to make this decision yet.",
      "This requires more internal alignment before proceeding.",
      "I'd like to see more market validation first.",
    ],
    evaluate: [
      "We should include this in our formal evaluation process.",
      "Let's schedule a technical deep-dive with the team.",
      "I'd like to see a proof of concept.",
      "We need to assess the integration requirements.",
      "This warrants a more thorough due diligence process.",
      "Let's bring in stakeholders from other departments.",
    ],
    shortlist: [
      "This is a strong contender for our shortlist.",
      "We should move this forward to the final evaluation round.",
      "The value proposition is compelling.",
      "This addresses our key pain points effectively.",
      "I'm recommending this for executive review.",
      "Let's negotiate terms and pricing.",
    ],
    approve: [
      "I'm ready to approve this purchase.",
      "This meets all our requirements and budget constraints.",
      "We should proceed with implementation.",
      "I'm confident this will deliver the expected ROI.",
      "Let's finalize the contract and get started.",
      "This is the right solution for our organization.",
    ],
  },
};

// =============================================================================
// ENTERPRISE CONTRACT NEGOTIATION ANCHORS
// =============================================================================

export const ENTERPRISE_CONTRACT_ANCHORS: AnchorSet = {
  id: "enterprise_contract",
  domain: "enterprise",
  scale: ["walk_away", "major_changes", "minor_adjustments", "acceptable", "favorable"],
  anchors: {
    walk_away: [
      "These terms are unacceptable and we'll need to look elsewhere.",
      "We can't proceed under these conditions.",
      "The risk allocation is fundamentally unfair.",
      "This contract doesn't protect our interests.",
      "We need to terminate negotiations.",
      "The liability exposure is too high.",
    ],
    major_changes: [
      "We need significant revisions before we can proceed.",
      "Several key terms require renegotiation.",
      "The pricing structure needs to be restructured.",
      "We require substantial changes to the SLA.",
      "The indemnification clauses need major revision.",
      "We can't accept the current termination provisions.",
    ],
    minor_adjustments: [
      "We're close but need a few adjustments.",
      "Most terms are acceptable with minor modifications.",
      "We'd like to tweak the payment schedule.",
      "A few clarifications would address our concerns.",
      "We're nearly there with some small changes.",
      "Let's fine-tune a couple of provisions.",
    ],
    acceptable: [
      "These terms are acceptable to our organization.",
      "We can work with this contract as written.",
      "The risk-reward balance is appropriate.",
      "Our legal team has approved these terms.",
      "We're comfortable proceeding on this basis.",
      "This represents a fair agreement for both parties.",
    ],
    favorable: [
      "These terms are very favorable for us.",
      "We've negotiated an excellent deal.",
      "The contract exceeds our expectations.",
      "We should lock this in before they reconsider.",
      "This is a win for our organization.",
      "The terms are better than we anticipated.",
    ],
  },
};

// =============================================================================
// ENTERPRISE TECHNOLOGY ADOPTION ANCHORS
// =============================================================================

export const ENTERPRISE_TECH_ADOPTION_ANCHORS: AnchorSet = {
  id: "enterprise_tech_adoption",
  domain: "enterprise",
  scale: ["resist", "cautious", "pilot", "adopt", "champion"],
  anchors: {
    resist: [
      "This technology isn't mature enough for enterprise use.",
      "The security risks outweigh the benefits.",
      "We've seen similar solutions fail in our environment.",
      "Our team doesn't have the skills to support this.",
      "The integration complexity is prohibitive.",
      "This would disrupt our existing workflows too much.",
    ],
    cautious: [
      "We should wait and see how this evolves.",
      "Let's monitor early adopters before committing.",
      "I'm skeptical but open to learning more.",
      "We need more evidence of enterprise-grade reliability.",
      "The technology shows promise but isn't proven.",
      "I'd prefer to let others work out the kinks first.",
    ],
    pilot: [
      "Let's run a limited pilot to validate the benefits.",
      "We should test this with a small team first.",
      "A proof of concept would help us assess the fit.",
      "I'm willing to experiment in a controlled environment.",
      "Let's allocate resources for a trial deployment.",
      "We can learn a lot from a structured pilot program.",
    ],
    adopt: [
      "We should proceed with enterprise-wide adoption.",
      "The benefits justify a broader rollout.",
      "Our pilot results support full deployment.",
      "This technology is ready for production use.",
      "We should standardize on this solution.",
      "The time is right to scale this across the organization.",
    ],
    champion: [
      "I'm a strong advocate for this technology.",
      "This will transform how we operate.",
      "We should be industry leaders in adopting this.",
      "I'm personally committed to driving this initiative.",
      "This is a strategic imperative for our organization.",
      "We can't afford to fall behind on this technology.",
    ],
  },
};

// =============================================================================
// ENTERPRISE BUDGET APPROVAL ANCHORS
// =============================================================================

export const ENTERPRISE_BUDGET_ANCHORS: AnchorSet = {
  id: "enterprise_budget",
  domain: "enterprise",
  scale: ["deny", "reduce", "defer", "approve", "increase"],
  anchors: {
    deny: [
      "This request doesn't meet our investment criteria.",
      "We can't justify this expenditure.",
      "The business case is insufficient.",
      "This isn't a priority for the current fiscal year.",
      "We need to decline this budget request.",
      "The expected returns don't warrant the investment.",
    ],
    reduce: [
      "We can approve a reduced scope.",
      "Let's fund a smaller initial phase.",
      "We need to cut this budget by a significant amount.",
      "Can you achieve the objectives with less funding?",
      "We'll approve partial funding for now.",
      "Let's start smaller and expand based on results.",
    ],
    defer: [
      "Let's revisit this in the next budget cycle.",
      "We need to postpone this investment.",
      "The timing isn't right given current priorities.",
      "We should wait until we have more certainty.",
      "This can be considered for next year's planning.",
      "Let's defer until market conditions improve.",
    ],
    approve: [
      "I'm approving this budget request as submitted.",
      "The business case supports this investment.",
      "We should proceed with the proposed funding.",
      "This aligns with our strategic priorities.",
      "The ROI projections are compelling.",
      "You have my approval to move forward.",
    ],
    increase: [
      "We should actually increase this budget.",
      "This initiative deserves more resources.",
      "Let's accelerate the timeline with additional funding.",
      "The opportunity warrants a larger investment.",
      "We're underinvesting in this area.",
      "I'm recommending we expand the scope and budget.",
    ],
  },
};

// =============================================================================
// ENTERPRISE VENDOR RISK ASSESSMENT ANCHORS
// =============================================================================

export const ENTERPRISE_VENDOR_RISK_ANCHORS: AnchorSet = {
  id: "enterprise_vendor_risk",
  domain: "enterprise",
  scale: ["high_risk", "elevated_risk", "moderate_risk", "low_risk", "minimal_risk"],
  anchors: {
    high_risk: [
      "This vendor poses unacceptable risk to our organization.",
      "We cannot proceed given the compliance concerns.",
      "The financial stability of this vendor is concerning.",
      "There are serious security vulnerabilities.",
      "The vendor concentration risk is too high.",
      "We need to find an alternative provider.",
    ],
    elevated_risk: [
      "There are notable risks that require mitigation.",
      "We should proceed with enhanced monitoring.",
      "Additional contractual protections are needed.",
      "The vendor needs to address several concerns.",
      "We can proceed but with contingency planning.",
      "Risk mitigation measures must be in place.",
    ],
    moderate_risk: [
      "The risk level is typical for this type of engagement.",
      "Standard risk management practices apply.",
      "No unusual concerns have been identified.",
      "The vendor meets our baseline requirements.",
      "Normal due diligence is sufficient.",
      "The risk-reward balance is acceptable.",
    ],
    low_risk: [
      "This vendor presents minimal risk to our operations.",
      "Strong track record and financial stability.",
      "Excellent security posture and compliance.",
      "Well-established in the enterprise market.",
      "References and reputation are solid.",
      "We can proceed with confidence.",
    ],
    minimal_risk: [
      "This is one of the lowest-risk vendors we've evaluated.",
      "Exceptional due diligence results.",
      "Industry-leading security and compliance.",
      "Strong financial position and market presence.",
      "This vendor exceeds our requirements.",
      "We should prioritize this partnership.",
    ],
  },
};

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Get enterprise anchor set by scenario type
 */
export function getEnterpriseAnchors(scenarioType: string): AnchorSet {
  switch (scenarioType) {
    case "procurement":
    case "purchase":
    case "buy":
      return ENTERPRISE_PROCUREMENT_ANCHORS;
    case "contract":
    case "negotiation":
    case "terms":
      return ENTERPRISE_CONTRACT_ANCHORS;
    case "technology":
    case "adoption":
    case "implementation":
      return ENTERPRISE_TECH_ADOPTION_ANCHORS;
    case "budget":
    case "funding":
    case "investment":
      return ENTERPRISE_BUDGET_ANCHORS;
    case "vendor":
    case "risk":
    case "assessment":
      return ENTERPRISE_VENDOR_RISK_ANCHORS;
    default:
      return ENTERPRISE_PROCUREMENT_ANCHORS;
  }
}

/**
 * Get all enterprise anchor sets
 */
export function getAllEnterpriseAnchors(): AnchorSet[] {
  return [
    ENTERPRISE_PROCUREMENT_ANCHORS,
    ENTERPRISE_CONTRACT_ANCHORS,
    ENTERPRISE_TECH_ADOPTION_ANCHORS,
    ENTERPRISE_BUDGET_ANCHORS,
    ENTERPRISE_VENDOR_RISK_ANCHORS,
  ];
}
