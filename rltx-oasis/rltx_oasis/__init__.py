"""RLTX Decision Simulation Engine powered by OASIS-style agent simulations."""

from .environments.decision_env import DecisionEnvironment
from .agents.population import PopulationFactory, AgentProfile
from .agents.llm_agent import ClaudeAgent
from .agents.rule_agent import RuleBasedAgent

__version__ = "0.1.0"
__all__ = [
    "DecisionEnvironment",
    "PopulationFactory",
    "AgentProfile",
    "ClaudeAgent",
    "RuleBasedAgent",
]
