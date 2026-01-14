"""Decision simulation environment for Monte Carlo and game theory."""

import asyncio
import uuid
from typing import Any, Callable, Literal
from datetime import datetime
from dataclasses import dataclass, field
from collections import defaultdict
import random
import numpy as np
from scipy import stats

from ..agents.population import PopulationFactory, AgentProfile
from ..agents.llm_agent import ClaudeAgent, AgentDecision
from ..agents.rule_agent import RuleBasedAgent, DefenseRuleAgent


@dataclass
class SimulationConfig:
    """Configuration for a simulation run."""
    simulation_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    population_size: int = 1000
    llm_ratio: float = 0.1
    num_iterations: int = 100
    domain: Literal["enterprise", "defense", "consumer"] = "enterprise"
    scenario_generator: str | None = None
    demographic_distribution: dict[str, float] | None = None
    custom_profiles: dict[str, AgentProfile] | None = None
    random_seed: int | None = None


@dataclass
class DistributionResult:
    """Statistical distribution result from simulation."""
    type: Literal["normal", "lognormal", "uniform", "empirical", "mixture"]
    parameters: dict[str, float]
    samples: list[float]
    mean: float
    std: float
    p5: float
    p25: float
    p50: float
    p75: float
    p95: float
    uncertainty_type: Literal["aleatory", "epistemic"] = "aleatory"

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "parameters": self.parameters,
            "samples": self.samples,
            "mean": self.mean,
            "std": self.std,
            "p5": self.p5,
            "p25": self.p25,
            "p50": self.p50,
            "p75": self.p75,
            "p95": self.p95,
            "uncertainty_type": self.uncertainty_type,
        }


@dataclass
class SimulationResults:
    """Complete results from a simulation run."""
    simulation_id: str
    config: SimulationConfig
    outcomes: dict[str, DistributionResult]
    aggregate_metrics: dict[str, float]
    decision_breakdown: dict[str, dict[str, int]]
    timeline: list[dict[str, Any]]
    compute_time_seconds: float
    total_llm_calls: int
    total_rule_evaluations: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "simulation_id": self.simulation_id,
            "config": {
                "population_size": self.config.population_size,
                "llm_ratio": self.config.llm_ratio,
                "num_iterations": self.config.num_iterations,
                "domain": self.config.domain,
            },
            "outcomes": {k: v.to_dict() for k, v in self.outcomes.items()},
            "aggregate_metrics": self.aggregate_metrics,
            "decision_breakdown": self.decision_breakdown,
            "timeline": self.timeline,
            "compute_time_seconds": self.compute_time_seconds,
            "total_llm_calls": self.total_llm_calls,
            "total_rule_evaluations": self.total_rule_evaluations,
        }


class DecisionEnvironment:
    """
    Main simulation environment for running Monte Carlo and game theory simulations.

    This environment orchestrates agent populations, runs iterations, and collects
    statistical distributions of outcomes.
    """

    def __init__(
        self,
        anthropic_api_key: str | None = None,
        progress_callback: Callable[[float, str], None] | None = None,
    ):
        self.api_key = anthropic_api_key
        self.progress_callback = progress_callback
        self.factory = PopulationFactory(anthropic_api_key=anthropic_api_key)

    def _report_progress(self, progress: float, message: str) -> None:
        """Report progress to callback if available."""
        if self.progress_callback:
            self.progress_callback(progress, message)

    async def run_monte_carlo(
        self,
        config: SimulationConfig,
        scenario_template: dict[str, Any],
        available_actions: list[str],
        outcome_metrics: list[str],
        context_variations: list[dict[str, Any]] | None = None,
    ) -> SimulationResults:
        """
        Run Monte Carlo simulation with agent population.

        Args:
            config: Simulation configuration
            scenario_template: Base scenario that may be varied
            available_actions: Actions agents can choose from
            outcome_metrics: Metrics to track across iterations
            context_variations: Optional list of context variations to sample from

        Returns:
            SimulationResults with distributions and metrics
        """
        start_time = datetime.now()

        if config.random_seed is not None:
            random.seed(config.random_seed)
            np.random.seed(config.random_seed)

        self._report_progress(0.05, "Creating agent population")

        # Create agent population
        agents = self.factory.create_population(
            size=config.population_size,
            domain=config.domain,
            llm_ratio=config.llm_ratio,
            demographic_distribution=config.demographic_distribution,
            custom_profiles=config.custom_profiles,
        )

        # Track results
        iteration_results: list[dict[str, Any]] = []
        decision_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        timeline: list[dict[str, Any]] = []
        total_llm_calls = 0
        total_rule_evaluations = 0

        self._report_progress(0.10, f"Running {config.num_iterations} iterations")

        # Run iterations
        for iteration in range(config.num_iterations):
            progress = 0.10 + (0.80 * (iteration / config.num_iterations))
            self._report_progress(progress, f"Iteration {iteration + 1}/{config.num_iterations}")

            # Vary scenario if needed
            scenario = self._vary_scenario(scenario_template, iteration)

            # Select context variation if provided
            context = None
            if context_variations:
                context = random.choice(context_variations)

            # Collect decisions from all agents
            iteration_decisions = await self._run_iteration(
                agents=agents,
                scenario=scenario,
                available_actions=available_actions,
                context=context,
            )

            # Track LLM vs rule-based calls
            for agent, decision in iteration_decisions:
                if isinstance(agent, ClaudeAgent):
                    total_llm_calls += 1
                else:
                    total_rule_evaluations += 1
                decision_counts[type(agent).__name__][decision.action] += 1

            # Calculate iteration metrics
            iteration_metrics = self._calculate_iteration_metrics(
                iteration_decisions,
                outcome_metrics,
                scenario,
            )
            iteration_results.append(iteration_metrics)

            # Record timeline event
            timeline.append({
                "iteration": iteration,
                "metrics": iteration_metrics,
                "dominant_action": max(
                    {d.action for _, d in iteration_decisions},
                    key=lambda a: sum(1 for _, d in iteration_decisions if d.action == a),
                ),
            })

        self._report_progress(0.90, "Computing distributions")

        # Compute distributions from iteration results
        outcomes = self._compute_distributions(iteration_results, outcome_metrics)

        # Compute aggregate metrics
        aggregate_metrics = self._compute_aggregate_metrics(iteration_results, outcomes)

        compute_time = (datetime.now() - start_time).total_seconds()

        self._report_progress(1.0, "Simulation complete")

        return SimulationResults(
            simulation_id=config.simulation_id,
            config=config,
            outcomes=outcomes,
            aggregate_metrics=aggregate_metrics,
            decision_breakdown=dict(decision_counts),
            timeline=timeline,
            compute_time_seconds=compute_time,
            total_llm_calls=total_llm_calls,
            total_rule_evaluations=total_rule_evaluations,
        )

    async def _run_iteration(
        self,
        agents: list[RuleBasedAgent | ClaudeAgent],
        scenario: dict[str, Any],
        available_actions: list[str],
        context: dict[str, Any] | None,
    ) -> list[tuple[RuleBasedAgent | ClaudeAgent, AgentDecision]]:
        """Run a single iteration with all agents."""
        results: list[tuple[RuleBasedAgent | ClaudeAgent, AgentDecision]] = []

        # Separate LLM and rule-based agents
        llm_agents = [a for a in agents if isinstance(a, ClaudeAgent)]
        rule_agents = [a for a in agents if isinstance(a, RuleBasedAgent)]

        # Run rule-based agents synchronously (fast)
        for agent in rule_agents:
            decision = agent.decide(scenario, available_actions, context)
            results.append((agent, decision))

        # Run LLM agents with concurrency control
        if llm_agents:
            semaphore = asyncio.Semaphore(10)  # Max 10 concurrent LLM calls

            async def decide_with_limit(agent: ClaudeAgent):
                async with semaphore:
                    decision = await agent.decide(scenario, available_actions, context)
                    return (agent, decision)

            llm_results = await asyncio.gather(*[decide_with_limit(a) for a in llm_agents])
            results.extend(llm_results)

        return results

    def _vary_scenario(self, template: dict[str, Any], iteration: int) -> dict[str, Any]:
        """Add variation to scenario for Monte Carlo sampling."""
        scenario = template.copy()

        # Add gaussian noise to numeric values
        for key, value in scenario.items():
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                # Add 5-10% noise
                noise_factor = random.gauss(1.0, 0.05)
                scenario[key] = value * noise_factor

        return scenario

    def _calculate_iteration_metrics(
        self,
        decisions: list[tuple[RuleBasedAgent | ClaudeAgent, AgentDecision]],
        metric_names: list[str],
        scenario: dict[str, Any],
    ) -> dict[str, float]:
        """Calculate metrics for a single iteration."""
        metrics: dict[str, float] = {}

        # Action distribution
        action_counts = defaultdict(int)
        total_confidence = 0.0
        for _, decision in decisions:
            action_counts[decision.action] += 1
            total_confidence += decision.confidence

        # Calculate metrics based on requested names
        for metric in metric_names:
            metric_lower = metric.lower()

            if "adoption" in metric_lower or "conversion" in metric_lower:
                # Count positive actions
                positive_actions = ["buy", "purchase", "subscribe", "upgrade", "adopt", "switch"]
                positive_count = sum(
                    action_counts[a] for a in action_counts
                    if any(pos in a.lower() for pos in positive_actions)
                )
                metrics[metric] = positive_count / len(decisions) if decisions else 0

            elif "churn" in metric_lower or "leave" in metric_lower:
                # Count negative actions
                negative_actions = ["churn", "leave", "cancel", "quit"]
                negative_count = sum(
                    action_counts[a] for a in action_counts
                    if any(neg in a.lower() for neg in negative_actions)
                )
                metrics[metric] = negative_count / len(decisions) if decisions else 0

            elif "retention" in metric_lower:
                # Count stay actions
                stay_actions = ["stay", "keep", "retain", "continue"]
                stay_count = sum(
                    action_counts[a] for a in action_counts
                    if any(s in a.lower() for s in stay_actions)
                )
                metrics[metric] = stay_count / len(decisions) if decisions else 0

            elif "confidence" in metric_lower:
                metrics[metric] = total_confidence / len(decisions) if decisions else 0

            elif "revenue" in metric_lower:
                # Estimate revenue impact
                base_revenue = scenario.get("base_revenue", 100)
                price = scenario.get("price", 100)
                positive_actions = ["buy", "purchase", "subscribe", "upgrade"]
                buyers = sum(
                    action_counts[a] for a in action_counts
                    if any(pos in a.lower() for pos in positive_actions)
                )
                metrics[metric] = buyers * price

            elif "market_share" in metric_lower:
                # Market share calculation
                positive_actions = ["buy", "purchase", "subscribe", "switch"]
                positive_count = sum(
                    action_counts[a] for a in action_counts
                    if any(pos in a.lower() for pos in positive_actions)
                )
                total_market = scenario.get("total_market_size", len(decisions))
                metrics[metric] = positive_count / total_market if total_market > 0 else 0

            elif "compliance" in metric_lower:
                # Defense domain compliance rate
                comply_actions = ["comply", "cooperate", "accept"]
                comply_count = sum(
                    action_counts[a] for a in action_counts
                    if any(c in a.lower() for c in comply_actions)
                )
                metrics[metric] = comply_count / len(decisions) if decisions else 0

            elif "escalation" in metric_lower:
                # Defense domain escalation rate
                escalate_actions = ["escalate", "retaliate", "counter"]
                escalate_count = sum(
                    action_counts[a] for a in action_counts
                    if any(e in a.lower() for e in escalate_actions)
                )
                metrics[metric] = escalate_count / len(decisions) if decisions else 0

            else:
                # Default: just count any matching action
                metrics[metric] = action_counts.get(metric, 0) / len(decisions) if decisions else 0

        return metrics

    def _compute_distributions(
        self,
        iteration_results: list[dict[str, float]],
        metric_names: list[str],
    ) -> dict[str, DistributionResult]:
        """Compute statistical distributions from iteration results."""
        distributions: dict[str, DistributionResult] = {}

        for metric in metric_names:
            samples = [r.get(metric, 0) for r in iteration_results]

            if not samples:
                continue

            # Calculate statistics
            mean = float(np.mean(samples))
            std = float(np.std(samples))
            percentiles = np.percentile(samples, [5, 25, 50, 75, 95])

            # Fit distribution
            dist_type, parameters = self._fit_distribution(samples)

            distributions[metric] = DistributionResult(
                type=dist_type,
                parameters=parameters,
                samples=samples,
                mean=mean,
                std=std,
                p5=float(percentiles[0]),
                p25=float(percentiles[1]),
                p50=float(percentiles[2]),
                p75=float(percentiles[3]),
                p95=float(percentiles[4]),
            )

        return distributions

    def _fit_distribution(
        self,
        samples: list[float],
    ) -> tuple[Literal["normal", "lognormal", "uniform", "empirical", "mixture"], dict[str, float]]:
        """Fit best distribution to samples."""
        samples_arr = np.array(samples)

        # Try normal distribution
        norm_params = stats.norm.fit(samples_arr)
        norm_ks = stats.kstest(samples_arr, "norm", args=norm_params).statistic

        # Try lognormal if all positive
        lognorm_ks = float("inf")
        lognorm_params = None
        if np.all(samples_arr > 0):
            try:
                lognorm_params = stats.lognorm.fit(samples_arr)
                lognorm_ks = stats.kstest(samples_arr, "lognorm", args=lognorm_params).statistic
            except Exception:
                pass

        # Choose best fit
        if lognorm_params and lognorm_ks < norm_ks:
            return "lognormal", {
                "shape": float(lognorm_params[0]),
                "loc": float(lognorm_params[1]),
                "scale": float(lognorm_params[2]),
            }
        else:
            return "normal", {
                "mean": float(norm_params[0]),
                "std": float(norm_params[1]),
            }

    def _compute_aggregate_metrics(
        self,
        iteration_results: list[dict[str, float]],
        distributions: dict[str, DistributionResult],
    ) -> dict[str, float]:
        """Compute aggregate metrics across all iterations."""
        metrics: dict[str, float] = {}

        for name, dist in distributions.items():
            metrics[f"{name}_mean"] = dist.mean
            metrics[f"{name}_std"] = dist.std
            metrics[f"{name}_ci_lower"] = dist.p5
            metrics[f"{name}_ci_upper"] = dist.p95

        # Coefficient of variation for key metrics
        for name, dist in distributions.items():
            if dist.mean != 0:
                metrics[f"{name}_cv"] = dist.std / abs(dist.mean)

        return metrics

    async def run_game_theory(
        self,
        players: list[dict[str, Any]],
        payoff_structure: dict[str, Any],
        num_rounds: int = 10,
        progress_callback: Callable[[float, str], None] | None = None,
    ) -> dict[str, Any]:
        """
        Run game theory simulation with LLM players.

        Args:
            players: List of player configurations with profiles
            payoff_structure: Definition of payoffs for action combinations
            num_rounds: Number of rounds to play
            progress_callback: Optional progress callback

        Returns:
            Game theory results with equilibrium analysis
        """
        self._report_progress(0.05, "Creating game players")

        # Create LLM agents for all players (game theory needs strategic reasoning)
        player_agents = self.factory.create_game_players(players)

        # Track game history
        history: list[dict[str, Any]] = []
        action_history: dict[str, list[str]] = {p["id"]: [] for p in players}

        self._report_progress(0.10, f"Playing {num_rounds} rounds")

        # Play rounds
        for round_num in range(num_rounds):
            progress = 0.10 + (0.70 * (round_num / num_rounds))
            self._report_progress(progress, f"Round {round_num + 1}/{num_rounds}")

            round_actions = {}

            # Get each player's action
            for agent, player_config in zip(player_agents, players):
                scenario = {
                    "round": round_num + 1,
                    "total_rounds": num_rounds,
                    "payoff_structure": payoff_structure,
                    "opponent_history": {
                        pid: action_history[pid]
                        for pid in action_history
                        if pid != player_config["id"]
                    },
                }

                available_actions = payoff_structure.get("actions", ["cooperate", "defect"])
                decision = await agent.decide(scenario, available_actions)
                round_actions[player_config["id"]] = decision.action
                action_history[player_config["id"]].append(decision.action)

            # Calculate payoffs
            round_payoffs = self._calculate_payoffs(round_actions, payoff_structure)

            history.append({
                "round": round_num + 1,
                "actions": round_actions,
                "payoffs": round_payoffs,
            })

        self._report_progress(0.85, "Analyzing equilibrium")

        # Analyze equilibrium
        equilibrium = self._analyze_equilibrium(history, players, payoff_structure)

        self._report_progress(1.0, "Game complete")

        return {
            "players": players,
            "payoff_structure": payoff_structure,
            "history": history,
            "equilibrium": equilibrium,
            "action_frequencies": {
                pid: dict(defaultdict(int, {a: actions.count(a) for a in set(actions)}))
                for pid, actions in action_history.items()
            },
        }

    def _calculate_payoffs(
        self,
        actions: dict[str, str],
        payoff_structure: dict[str, Any],
    ) -> dict[str, float]:
        """Calculate payoffs for a round based on action combination."""
        payoffs: dict[str, float] = {}
        payoff_matrix = payoff_structure.get("matrix", {})

        # Convert actions to key for matrix lookup
        action_key = tuple(sorted(actions.items()))

        if str(action_key) in payoff_matrix:
            return payoff_matrix[str(action_key)]

        # Default payoff calculation for common games
        action_values = list(actions.values())

        # Prisoner's dilemma style
        if set(payoff_structure.get("actions", [])) == {"cooperate", "defect"}:
            for player_id, action in actions.items():
                other_actions = [a for pid, a in actions.items() if pid != player_id]

                if action == "cooperate":
                    if all(a == "cooperate" for a in other_actions):
                        payoffs[player_id] = 3.0  # Mutual cooperation
                    else:
                        payoffs[player_id] = 0.0  # Sucker's payoff
                else:  # defect
                    if all(a == "cooperate" for a in other_actions):
                        payoffs[player_id] = 5.0  # Temptation
                    else:
                        payoffs[player_id] = 1.0  # Mutual defection

        else:
            # Default equal payoffs
            for player_id in actions:
                payoffs[player_id] = 1.0

        return payoffs

    def _analyze_equilibrium(
        self,
        history: list[dict[str, Any]],
        players: list[dict[str, Any]],
        payoff_structure: dict[str, Any],
    ) -> dict[str, Any]:
        """Analyze game history to identify equilibrium strategies."""
        # Calculate average payoffs per player
        avg_payoffs = {}
        for player in players:
            pid = player["id"]
            payoffs = [h["payoffs"].get(pid, 0) for h in history]
            avg_payoffs[pid] = np.mean(payoffs) if payoffs else 0

        # Calculate strategy frequencies
        strategy_freq = {}
        for player in players:
            pid = player["id"]
            actions = [h["actions"].get(pid) for h in history]
            total = len(actions)
            strategy_freq[pid] = {
                action: actions.count(action) / total
                for action in set(actions)
            } if total > 0 else {}

        # Detect convergence (last 20% of rounds)
        convergence_rounds = history[int(len(history) * 0.8):]
        converged = False
        convergent_strategies = {}

        if convergence_rounds:
            for player in players:
                pid = player["id"]
                recent_actions = [h["actions"].get(pid) for h in convergence_rounds]
                most_common = max(set(recent_actions), key=recent_actions.count)
                frequency = recent_actions.count(most_common) / len(recent_actions)

                if frequency >= 0.8:  # 80% consistency = converged
                    converged = True
                    convergent_strategies[pid] = most_common

        return {
            "converged": converged,
            "convergent_strategies": convergent_strategies,
            "average_payoffs": avg_payoffs,
            "strategy_frequencies": strategy_freq,
            "stability_score": 0.8 if converged else 0.4,
        }
