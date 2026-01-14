"""Population factory for creating diverse agent populations."""

import random
from typing import Any, Literal
from pydantic import BaseModel

from .llm_agent import ClaudeAgent
from .rule_agent import RuleBasedAgent, DefenseRuleAgent


class AgentProfile(BaseModel):
    """Profile configuration for an agent."""
    type: str
    price_sensitivity: float = 0.5
    risk_tolerance: float = 0.5
    innovation_preference: float = 0.5
    loyalty: float = 0.5
    switching_cost_tolerance: float = 0.5
    consistency: float = 0.8
    # Defense-specific
    compliance_tendency: float | None = None
    alliance_seeking: float | None = None
    # Custom traits
    custom_traits: dict[str, Any] | None = None


# Pre-defined profile templates for different segments
ENTERPRISE_PROFILES = {
    "early_adopter": AgentProfile(
        type="consumer",
        price_sensitivity=0.3,
        risk_tolerance=0.7,
        innovation_preference=0.9,
        loyalty=0.4,
        switching_cost_tolerance=0.7,
    ),
    "conservative_buyer": AgentProfile(
        type="consumer",
        price_sensitivity=0.8,
        risk_tolerance=0.3,
        innovation_preference=0.2,
        loyalty=0.7,
        switching_cost_tolerance=0.2,
    ),
    "value_seeker": AgentProfile(
        type="consumer",
        price_sensitivity=0.9,
        risk_tolerance=0.4,
        innovation_preference=0.5,
        loyalty=0.3,
        switching_cost_tolerance=0.6,
    ),
    "brand_loyalist": AgentProfile(
        type="consumer",
        price_sensitivity=0.4,
        risk_tolerance=0.4,
        innovation_preference=0.4,
        loyalty=0.9,
        switching_cost_tolerance=0.1,
    ),
    "pragmatist": AgentProfile(
        type="consumer",
        price_sensitivity=0.5,
        risk_tolerance=0.5,
        innovation_preference=0.5,
        loyalty=0.5,
        switching_cost_tolerance=0.5,
    ),
}

DEFENSE_PROFILES = {
    "sanctioned_entity": AgentProfile(
        type="state_actor",
        risk_tolerance=0.7,
        compliance_tendency=0.2,
        alliance_seeking=0.8,
    ),
    "neutral_state": AgentProfile(
        type="state_actor",
        risk_tolerance=0.4,
        compliance_tendency=0.6,
        alliance_seeking=0.5,
    ),
    "allied_nation": AgentProfile(
        type="state_actor",
        risk_tolerance=0.5,
        compliance_tendency=0.8,
        alliance_seeking=0.7,
    ),
    "adversary": AgentProfile(
        type="state_actor",
        risk_tolerance=0.8,
        compliance_tendency=0.1,
        alliance_seeking=0.6,
    ),
    "regional_power": AgentProfile(
        type="state_actor",
        risk_tolerance=0.6,
        compliance_tendency=0.4,
        alliance_seeking=0.5,
    ),
}


class PopulationFactory:
    """Factory for creating diverse agent populations."""

    def __init__(self, anthropic_api_key: str | None = None):
        self.api_key = anthropic_api_key

    def create_population(
        self,
        size: int,
        domain: Literal["enterprise", "defense", "consumer"] = "enterprise",
        llm_ratio: float = 0.1,
        demographic_distribution: dict[str, float] | None = None,
        custom_profiles: dict[str, AgentProfile] | None = None,
    ) -> list[RuleBasedAgent | ClaudeAgent]:
        """
        Create a mixed population of LLM and rule-based agents.

        Args:
            size: Total number of agents
            domain: Simulation domain (enterprise, defense, consumer)
            llm_ratio: Fraction of agents using LLM (0.0-1.0)
            demographic_distribution: Weights for each profile type
            custom_profiles: Custom profile definitions

        Returns:
            List of agents (mix of ClaudeAgent and RuleBasedAgent)
        """
        # Select profile templates
        if custom_profiles:
            profiles = custom_profiles
        elif domain == "defense":
            profiles = DEFENSE_PROFILES
        else:
            profiles = ENTERPRISE_PROFILES

        # Default distribution: equal weights
        if demographic_distribution is None:
            demographic_distribution = {k: 1.0 / len(profiles) for k in profiles}

        # Normalize weights
        total_weight = sum(demographic_distribution.values())
        normalized = {k: v / total_weight for k, v in demographic_distribution.items()}

        # Calculate agent counts
        llm_count = int(size * llm_ratio)
        rule_count = size - llm_count

        agents: list[RuleBasedAgent | ClaudeAgent] = []

        # Create LLM agents (for nuanced decisions)
        for i in range(llm_count):
            profile_type = self._sample_profile(normalized)
            base_profile = profiles[profile_type]
            varied_profile = self._add_variation(base_profile)

            agent = ClaudeAgent(
                agent_id=f"llm_{i}",
                profile=varied_profile.model_dump(),
                api_key=self.api_key,
            )
            agents.append(agent)

        # Create rule-based agents (for scale)
        AgentClass = DefenseRuleAgent if domain == "defense" else RuleBasedAgent

        for i in range(rule_count):
            profile_type = self._sample_profile(normalized)
            base_profile = profiles[profile_type]
            varied_profile = self._add_variation(base_profile)

            agent = AgentClass(
                agent_id=f"rule_{i}",
                profile=varied_profile.model_dump(),
            )
            agents.append(agent)

        # Shuffle to mix LLM and rule-based agents
        random.shuffle(agents)

        return agents

    def _sample_profile(self, distribution: dict[str, float]) -> str:
        """Sample a profile type from the distribution."""
        return random.choices(
            list(distribution.keys()),
            weights=list(distribution.values()),
        )[0]

    def _add_variation(self, profile: AgentProfile, variation: float = 0.1) -> AgentProfile:
        """
        Add random variation to profile parameters.
        This creates heterogeneity within each segment.
        """
        varied = profile.model_copy()

        # Add gaussian noise to numeric parameters
        for field in ["price_sensitivity", "risk_tolerance", "innovation_preference",
                      "loyalty", "switching_cost_tolerance"]:
            current = getattr(varied, field)
            if current is not None:
                noise = random.gauss(0, variation)
                new_value = max(0.0, min(1.0, current + noise))
                setattr(varied, field, new_value)

        # Defense-specific fields
        for field in ["compliance_tendency", "alliance_seeking"]:
            current = getattr(varied, field, None)
            if current is not None:
                noise = random.gauss(0, variation)
                new_value = max(0.0, min(1.0, current + noise))
                setattr(varied, field, new_value)

        return varied

    def create_game_players(
        self,
        player_configs: list[dict[str, Any]],
    ) -> list[ClaudeAgent]:
        """
        Create players for game theory simulation.
        All players use LLM for strategic reasoning.

        Args:
            player_configs: List of player configurations with id, name, profile

        Returns:
            List of ClaudeAgent players
        """
        players = []

        for config in player_configs:
            profile = config.get("profile", {})
            profile["type"] = config.get("type", "player")

            player = ClaudeAgent(
                agent_id=config["id"],
                profile=profile,
                api_key=self.api_key,
            )
            players.append(player)

        return players
