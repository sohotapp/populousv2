"""Rule-based agent for scalable simulation (90% of population)."""

import random
from typing import Any
from pydantic import BaseModel


class AgentDecision(BaseModel):
    """Structured decision output from an agent."""
    action: str
    confidence: float
    reasoning: str
    factors: dict[str, float] | None = None


class RuleBasedAgent:
    """
    Rule-based agent for efficient large-scale simulation.
    Uses probabilistic rules derived from profile parameters.
    """

    def __init__(self, agent_id: str, profile: dict[str, Any]):
        self.agent_id = agent_id
        self.profile = profile
        self.decision_history: list[AgentDecision] = []

    def decide(
        self,
        scenario: dict[str, Any],
        available_actions: list[str],
        context: dict[str, Any] | None = None,
    ) -> AgentDecision:
        """
        Make a decision based on rules derived from profile.
        """
        # Calculate utility for each action
        utilities = {}
        for action in available_actions:
            utilities[action] = self._calculate_utility(action, scenario, context)

        # Add randomness based on profile consistency
        consistency = self.profile.get("consistency", 0.8)
        for action in utilities:
            noise = random.gauss(0, 0.1 * (1 - consistency))
            utilities[action] += noise

        # Select action with highest utility
        best_action = max(utilities, key=utilities.get)
        best_utility = utilities[best_action]

        # Calculate confidence based on utility gap
        sorted_utils = sorted(utilities.values(), reverse=True)
        if len(sorted_utils) > 1:
            gap = sorted_utils[0] - sorted_utils[1]
            confidence = min(0.95, 0.5 + gap)
        else:
            confidence = 0.7

        decision = AgentDecision(
            action=best_action,
            confidence=confidence,
            reasoning=self._generate_reasoning(best_action, scenario),
            factors=self._get_decision_factors(best_action, scenario),
        )

        self.decision_history.append(decision)
        return decision

    def _calculate_utility(
        self,
        action: str,
        scenario: dict[str, Any],
        context: dict[str, Any] | None,
    ) -> float:
        """Calculate utility score for an action based on profile."""
        utility = 0.5  # Base utility
        action_lower = action.lower()

        # Price-related actions
        if any(word in action_lower for word in ["buy", "purchase", "subscribe", "upgrade"]):
            price = scenario.get("price", 100)
            price_sensitivity = self.profile.get("price_sensitivity", 0.5)
            perceived_value = scenario.get("perceived_value", 100)

            # Higher sensitivity = more negative impact from high prices
            price_factor = (perceived_value - price) / max(perceived_value, 1)
            utility += price_factor * price_sensitivity

            # Innovation bonus for early adopters
            if scenario.get("is_new_product", False):
                innovation_pref = self.profile.get("innovation_preference", 0.5)
                utility += 0.2 * innovation_pref

        # Switching actions
        elif any(word in action_lower for word in ["switch", "change", "migrate"]):
            switching_cost = scenario.get("switching_cost", 0.3)
            switching_tolerance = self.profile.get("switching_cost_tolerance", 0.5)
            loyalty = self.profile.get("loyalty", 0.5)

            # Higher loyalty = less likely to switch
            utility -= 0.3 * loyalty
            # Higher tolerance = more willing to switch despite cost
            utility += 0.2 * switching_tolerance - 0.2 * switching_cost

            # Benefit must outweigh switching cost
            benefit = scenario.get("switching_benefit", 0.2)
            utility += benefit * (1 - loyalty)

        # Stay/retain actions
        elif any(word in action_lower for word in ["stay", "keep", "retain", "continue"]):
            loyalty = self.profile.get("loyalty", 0.5)
            satisfaction = scenario.get("current_satisfaction", 0.6)

            utility += 0.3 * loyalty + 0.2 * satisfaction

        # Risk-related actions
        elif any(word in action_lower for word in ["invest", "expand", "aggressive"]):
            risk_tolerance = self.profile.get("risk_tolerance", 0.5)
            potential_reward = scenario.get("potential_reward", 0.5)
            potential_risk = scenario.get("potential_risk", 0.5)

            utility += risk_tolerance * potential_reward - (1 - risk_tolerance) * potential_risk

        # Conservative actions
        elif any(word in action_lower for word in ["wait", "hold", "conservative", "cautious"]):
            risk_tolerance = self.profile.get("risk_tolerance", 0.5)
            utility += 0.3 * (1 - risk_tolerance)

        # Churn/leave actions
        elif any(word in action_lower for word in ["churn", "leave", "cancel", "quit"]):
            satisfaction = scenario.get("current_satisfaction", 0.6)
            loyalty = self.profile.get("loyalty", 0.5)
            alternatives = scenario.get("better_alternatives", 0.3)

            utility -= 0.3 * satisfaction - 0.2 * loyalty + 0.3 * alternatives

        # Context modifiers
        if context:
            # Economic conditions
            if context.get("economic_outlook") == "recession":
                price_sensitivity = self.profile.get("price_sensitivity", 0.5)
                if "buy" in action_lower or "upgrade" in action_lower:
                    utility -= 0.2 * price_sensitivity
            elif context.get("economic_outlook") == "growth":
                if "buy" in action_lower or "expand" in action_lower:
                    utility += 0.1

            # Competitive pressure
            competitor_move = context.get("competitor_action")
            if competitor_move == "price_cut":
                if "switch" in action_lower:
                    utility += 0.15

        return utility

    def _generate_reasoning(self, action: str, scenario: dict[str, Any]) -> str:
        """Generate human-readable reasoning for the decision."""
        reasons = []

        if self.profile.get("price_sensitivity", 0.5) > 0.6:
            reasons.append("price considerations")
        if self.profile.get("loyalty", 0.5) > 0.6:
            reasons.append("brand loyalty")
        if self.profile.get("risk_tolerance", 0.5) < 0.4:
            reasons.append("risk aversion")
        if self.profile.get("innovation_preference", 0.5) > 0.6:
            reasons.append("preference for innovation")

        if reasons:
            return f"Decision driven by {', '.join(reasons)}"
        return "Decision based on overall utility assessment"

    def _get_decision_factors(
        self, action: str, scenario: dict[str, Any]
    ) -> dict[str, float]:
        """Return the factors that influenced the decision."""
        factors = {}

        for key in ["price_sensitivity", "loyalty", "risk_tolerance", "innovation_preference"]:
            if key in self.profile:
                factors[key] = self.profile[key]

        return factors


class DefenseRuleAgent(RuleBasedAgent):
    """Specialized rule-based agent for defense/geopolitical simulations."""

    def _calculate_utility(
        self,
        action: str,
        scenario: dict[str, Any],
        context: dict[str, Any] | None,
    ) -> float:
        """Calculate utility for defense-domain actions."""
        utility = 0.5
        action_lower = action.lower()

        # Compliance actions
        if any(word in action_lower for word in ["comply", "cooperate", "accept"]):
            compliance_tendency = self.profile.get("compliance_tendency", 0.5)
            sanction_severity = scenario.get("sanction_severity", 0.5)
            international_pressure = scenario.get("international_pressure", 0.5)

            utility += 0.3 * compliance_tendency + 0.2 * international_pressure
            utility -= 0.2 * (1 - sanction_severity)  # Lighter sanctions = less compliance

        # Defiance/evasion actions
        elif any(word in action_lower for word in ["evade", "resist", "defy", "circumvent"]):
            compliance_tendency = self.profile.get("compliance_tendency", 0.5)
            risk_tolerance = self.profile.get("risk_tolerance", 0.5)
            evasion_capability = scenario.get("evasion_capability", 0.5)

            utility += 0.3 * (1 - compliance_tendency) + 0.2 * risk_tolerance
            utility += 0.2 * evasion_capability

        # Alliance actions
        elif any(word in action_lower for word in ["ally", "partner", "coalition"]):
            alliance_seeking = self.profile.get("alliance_seeking", 0.5)
            shared_interests = scenario.get("shared_interests", 0.5)

            utility += 0.3 * alliance_seeking + 0.2 * shared_interests

        # Escalation actions
        elif any(word in action_lower for word in ["escalate", "retaliate", "counter"]):
            risk_tolerance = self.profile.get("risk_tolerance", 0.5)
            military_capability = scenario.get("military_capability", 0.5)
            provocation_level = scenario.get("provocation_level", 0.3)

            utility += 0.2 * risk_tolerance + 0.2 * military_capability
            utility += 0.3 * provocation_level

        # De-escalation actions
        elif any(word in action_lower for word in ["negotiate", "de-escalate", "compromise"]):
            risk_tolerance = self.profile.get("risk_tolerance", 0.5)
            diplomatic_capacity = scenario.get("diplomatic_capacity", 0.5)

            utility += 0.3 * (1 - risk_tolerance) + 0.2 * diplomatic_capacity

        return utility
