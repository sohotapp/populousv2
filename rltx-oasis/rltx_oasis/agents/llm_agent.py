"""Claude-powered agent for high-fidelity decision simulation."""

import asyncio
from typing import Any
import anthropic
from pydantic import BaseModel


class AgentDecision(BaseModel):
    """Structured decision output from an agent."""
    action: str
    confidence: float
    reasoning: str
    factors: dict[str, float] | None = None


class ClaudeAgent:
    """
    LLM-powered agent using Claude for nuanced decision-making.
    Used for the 10% of agents that need sophisticated reasoning.
    """

    def __init__(
        self,
        agent_id: str,
        profile: dict[str, Any],
        api_key: str | None = None,
        model: str = "claude-sonnet-4-20250514",
    ):
        self.agent_id = agent_id
        self.profile = profile
        self.model = model
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.decision_history: list[AgentDecision] = []

    async def decide(
        self,
        scenario: dict[str, Any],
        available_actions: list[str],
        context: dict[str, Any] | None = None,
    ) -> AgentDecision:
        """
        Make a decision based on scenario and agent profile.

        Args:
            scenario: Current situation description
            available_actions: List of possible actions
            context: Additional context (market conditions, etc.)

        Returns:
            AgentDecision with action, confidence, and reasoning
        """
        system_prompt = self._build_system_prompt()
        user_prompt = self._build_decision_prompt(scenario, available_actions, context)

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )

            # Parse response
            decision = self._parse_response(response.content[0].text, available_actions)
            self.decision_history.append(decision)
            return decision

        except Exception as e:
            # Fallback to random action on error
            import random
            fallback = AgentDecision(
                action=random.choice(available_actions),
                confidence=0.5,
                reasoning=f"Fallback due to error: {str(e)}",
            )
            self.decision_history.append(fallback)
            return fallback

    def _build_system_prompt(self) -> str:
        """Build system prompt based on agent profile."""
        profile_desc = self._describe_profile()

        return f"""You are simulating a decision-maker with the following characteristics:

{profile_desc}

When presented with a scenario, you must decide what action to take.
Always respond in this exact JSON format:
{{
  "action": "chosen_action",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "factors": {{"factor_name": importance_weight}}
}}

Be consistent with your profile. Your decisions should reflect your characteristics."""

    def _describe_profile(self) -> str:
        """Convert profile dict to natural language description."""
        lines = []

        # Agent type
        agent_type = self.profile.get("type", "decision-maker")
        lines.append(f"Role: {agent_type}")

        # Key characteristics
        if "price_sensitivity" in self.profile:
            ps = self.profile["price_sensitivity"]
            if ps > 0.7:
                lines.append("- Highly price-sensitive, prioritizes cost savings")
            elif ps < 0.3:
                lines.append("- Price-insensitive, values quality over cost")
            else:
                lines.append("- Moderate price sensitivity, balances cost and value")

        if "risk_tolerance" in self.profile:
            rt = self.profile["risk_tolerance"]
            if rt > 0.7:
                lines.append("- High risk tolerance, willing to take chances")
            elif rt < 0.3:
                lines.append("- Risk-averse, prefers safe options")
            else:
                lines.append("- Moderate risk tolerance")

        if "innovation_preference" in self.profile:
            ip = self.profile["innovation_preference"]
            if ip > 0.7:
                lines.append("- Early adopter, excited by new solutions")
            elif ip < 0.3:
                lines.append("- Conservative, prefers proven solutions")

        if "loyalty" in self.profile:
            loy = self.profile["loyalty"]
            if loy > 0.7:
                lines.append("- Strong brand loyalty, resistant to switching")
            elif loy < 0.3:
                lines.append("- No brand loyalty, easily switches")

        # Custom attributes
        if "custom_traits" in self.profile:
            for trait, value in self.profile["custom_traits"].items():
                lines.append(f"- {trait}: {value}")

        return "\n".join(lines)

    def _build_decision_prompt(
        self,
        scenario: dict[str, Any],
        available_actions: list[str],
        context: dict[str, Any] | None,
    ) -> str:
        """Build the decision prompt."""
        prompt_parts = [
            "## Current Scenario",
            "",
        ]

        # Scenario description
        if isinstance(scenario, dict):
            for key, value in scenario.items():
                prompt_parts.append(f"**{key}**: {value}")
        else:
            prompt_parts.append(str(scenario))

        prompt_parts.append("")

        # Context if provided
        if context:
            prompt_parts.append("## Market/Environmental Context")
            for key, value in context.items():
                prompt_parts.append(f"- {key}: {value}")
            prompt_parts.append("")

        # Available actions
        prompt_parts.append("## Available Actions")
        for i, action in enumerate(available_actions, 1):
            prompt_parts.append(f"{i}. {action}")

        prompt_parts.append("")
        prompt_parts.append("Based on your profile and this scenario, what action do you take?")

        return "\n".join(prompt_parts)

    def _parse_response(self, response_text: str, available_actions: list[str]) -> AgentDecision:
        """Parse Claude's response into structured decision."""
        import json
        import random

        # Try to extract JSON
        try:
            # Find JSON in response
            start = response_text.find("{")
            end = response_text.rfind("}") + 1
            if start >= 0 and end > start:
                json_str = response_text[start:end]
                data = json.loads(json_str)

                action = data.get("action", available_actions[0])
                # Validate action is in available list
                if action not in available_actions:
                    # Try to match partial
                    for avail in available_actions:
                        if action.lower() in avail.lower() or avail.lower() in action.lower():
                            action = avail
                            break
                    else:
                        action = available_actions[0]

                return AgentDecision(
                    action=action,
                    confidence=float(data.get("confidence", 0.7)),
                    reasoning=data.get("reasoning", "No reasoning provided"),
                    factors=data.get("factors"),
                )
        except (json.JSONDecodeError, ValueError, KeyError):
            pass

        # Fallback: try to find action mention
        response_lower = response_text.lower()
        for action in available_actions:
            if action.lower() in response_lower:
                return AgentDecision(
                    action=action,
                    confidence=0.6,
                    reasoning=response_text[:200],
                )

        # Ultimate fallback
        return AgentDecision(
            action=random.choice(available_actions),
            confidence=0.5,
            reasoning="Could not parse response",
        )

    async def batch_decide(
        self,
        scenarios: list[dict[str, Any]],
        available_actions: list[str],
        context: dict[str, Any] | None = None,
        max_concurrent: int = 5,
    ) -> list[AgentDecision]:
        """
        Make decisions for multiple scenarios with concurrency control.
        """
        semaphore = asyncio.Semaphore(max_concurrent)

        async def decide_with_limit(scenario):
            async with semaphore:
                return await self.decide(scenario, available_actions, context)

        tasks = [decide_with_limit(s) for s in scenarios]
        return await asyncio.gather(*tasks)
