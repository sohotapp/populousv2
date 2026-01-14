"""Modal serverless functions for RLTX simulations."""

import os
import json
import asyncio
from typing import Any, Optional
from pathlib import Path
import modal

# Define Modal app
app = modal.App("rltx-simulation")

# Get the path to rltx_oasis relative to this file
OASIS_PATH = Path(__file__).resolve().parent.parent / "rltx-oasis"

# Define image with dependencies and include the OASIS package
simulation_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "anthropic>=0.18.0",
        "numpy>=1.24.0",
        "scipy>=1.10.0",
        "pydantic>=2.0.0",
        "asyncpg>=0.27.0",
        "httpx>=0.24.0",
        "fastapi>=0.100.0",
    )
    .add_local_dir(str(OASIS_PATH), remote_path="/root/rltx_oasis_pkg")
)


@app.function(
    image=simulation_image,
        secrets=[modal.Secret.from_name("anthropic-secret")],
    timeout=600,  # 10 minute max for large simulations
    memory=2048,
)
async def run_monte_carlo(
    config: dict[str, Any],
    scenario_template: dict[str, Any],
    available_actions: list[str],
    outcome_metrics: list[str],
    context_variations: Optional[list[dict[str, Any]]] = None,
    webhook_url: Optional[str] = None,
) -> dict[str, Any]:
    """
    Run Monte Carlo simulation with OASIS-style agent population.

    Args:
        config: Simulation configuration
        scenario_template: Base scenario for agents
        available_actions: Actions agents can choose
        outcome_metrics: Metrics to track
        context_variations: Optional context variations
        webhook_url: URL to POST progress updates

    Returns:
        Simulation results with distributions
    """
    import httpx

    # Import from mounted package
    import sys
    sys.path.insert(0, "/root/rltx_oasis_pkg")

    from rltx_oasis.environments.decision_env import (
        DecisionEnvironment,
        SimulationConfig,
    )

    # Progress callback to send updates
    async def send_progress(progress: float, message: str):
        if webhook_url:
            async with httpx.AsyncClient() as client:
                try:
                    await client.post(
                        webhook_url,
                        json={
                            "type": "progress",
                            "simulation_id": config.get("simulation_id"),
                            "progress": progress,
                            "message": message,
                        },
                        timeout=5.0,
                    )
                except Exception:
                    pass  # Don't fail on webhook errors

    def sync_progress(progress: float, message: str):
        asyncio.create_task(send_progress(progress, message))

    # Create simulation config
    sim_config = SimulationConfig(
        simulation_id=config.get("simulation_id", ""),
        population_size=config.get("population_size", 1000),
        llm_ratio=config.get("llm_ratio", 0.1),
        num_iterations=config.get("num_iterations", 100),
        domain=config.get("domain", "enterprise"),
        random_seed=config.get("random_seed"),
    )

    # Create environment
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    env = DecisionEnvironment(
        anthropic_api_key=api_key,
        progress_callback=sync_progress,
    )

    # Run simulation
    results = await env.run_monte_carlo(
        config=sim_config,
        scenario_template=scenario_template,
        available_actions=available_actions,
        outcome_metrics=outcome_metrics,
        context_variations=context_variations,
    )

    # Send completion
    if webhook_url:
        async with httpx.AsyncClient() as client:
            try:
                await client.post(
                    webhook_url,
                    json={
                        "type": "complete",
                        "simulation_id": config.get("simulation_id"),
                        "results": results.to_dict(),
                    },
                    timeout=30.0,
                )
            except Exception:
                pass

    return results.to_dict()


@app.function(
    image=simulation_image,
        secrets=[modal.Secret.from_name("anthropic-secret")],
    timeout=600,
    memory=2048,
)
async def run_game_theory(
    players: list[dict[str, Any]],
    payoff_structure: dict[str, Any],
    num_rounds: int = 10,
    webhook_url: Optional[str] = None,
) -> dict[str, Any]:
    """
    Run game theory simulation with LLM players.

    Args:
        players: Player configurations with profiles
        payoff_structure: Game payoff definition
        num_rounds: Number of rounds to play
        webhook_url: URL for progress updates

    Returns:
        Game results with equilibrium analysis
    """
    import httpx

    import sys
    sys.path.insert(0, "/root/rltx_oasis_pkg")

    from rltx_oasis.environments.decision_env import DecisionEnvironment

    async def send_progress(progress: float, message: str):
        if webhook_url:
            async with httpx.AsyncClient() as client:
                try:
                    await client.post(
                        webhook_url,
                        json={
                            "type": "progress",
                            "progress": progress,
                            "message": message,
                        },
                        timeout=5.0,
                    )
                except Exception:
                    pass

    def sync_progress(progress: float, message: str):
        asyncio.create_task(send_progress(progress, message))

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    env = DecisionEnvironment(
        anthropic_api_key=api_key,
        progress_callback=sync_progress,
    )

    results = await env.run_game_theory(
        players=players,
        payoff_structure=payoff_structure,
        num_rounds=num_rounds,
    )

    if webhook_url:
        async with httpx.AsyncClient() as client:
            try:
                await client.post(
                    webhook_url,
                    json={
                        "type": "complete",
                        "results": results,
                    },
                    timeout=30.0,
                )
            except Exception:
                pass

    return results


@app.function(
    image=simulation_image,
        secrets=[modal.Secret.from_name("anthropic-secret")],
    timeout=1800,  # 30 min for counterfactual branching
    memory=4096,
)
async def run_counterfactual(
    base_scenario: dict[str, Any],
    branches: list[dict[str, Any]],
    simulation_config: dict[str, Any],
    available_actions: list[str],
    outcome_metrics: list[str],
    webhook_url: Optional[str] = None,
) -> dict[str, Any]:
    """
    Run counterfactual analysis with multiple branching scenarios.

    Args:
        base_scenario: The baseline scenario
        branches: List of counterfactual modifications
        simulation_config: Config for each branch simulation
        available_actions: Available actions
        outcome_metrics: Metrics to track
        webhook_url: Progress updates URL

    Returns:
        Results for all branches with comparison
    """
    import httpx

    import sys
    sys.path.insert(0, "/root/rltx_oasis_pkg")

    from rltx_oasis.environments.decision_env import (
        DecisionEnvironment,
        SimulationConfig,
    )

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    env = DecisionEnvironment(anthropic_api_key=api_key)

    all_results = {
        "base": None,
        "branches": [],
        "comparison": {},
    }

    total_branches = len(branches) + 1  # +1 for baseline

    # Run baseline
    if webhook_url:
        async with httpx.AsyncClient() as client:
            await client.post(
                webhook_url,
                json={
                    "type": "progress",
                    "progress": 0.1,
                    "message": "Running baseline scenario",
                },
                timeout=5.0,
            )

    base_config = SimulationConfig(
        population_size=simulation_config.get("population_size", 500),
        llm_ratio=simulation_config.get("llm_ratio", 0.1),
        num_iterations=simulation_config.get("num_iterations", 50),
        domain=simulation_config.get("domain", "enterprise"),
    )

    base_results = await env.run_monte_carlo(
        config=base_config,
        scenario_template=base_scenario,
        available_actions=available_actions,
        outcome_metrics=outcome_metrics,
    )
    all_results["base"] = base_results.to_dict()

    # Run each counterfactual branch
    for i, branch in enumerate(branches):
        progress = (i + 2) / total_branches

        if webhook_url:
            async with httpx.AsyncClient() as client:
                await client.post(
                    webhook_url,
                    json={
                        "type": "progress",
                        "progress": progress,
                        "message": f"Running branch: {branch.get('name', f'Branch {i+1}')}",
                    },
                    timeout=5.0,
                )

        # Apply branch modifications to scenario
        branch_scenario = {**base_scenario, **branch.get("modifications", {})}

        branch_config = SimulationConfig(
            simulation_id=f"branch_{i}",
            population_size=simulation_config.get("population_size", 500),
            llm_ratio=simulation_config.get("llm_ratio", 0.1),
            num_iterations=simulation_config.get("num_iterations", 50),
            domain=simulation_config.get("domain", "enterprise"),
        )

        branch_results = await env.run_monte_carlo(
            config=branch_config,
            scenario_template=branch_scenario,
            available_actions=available_actions,
            outcome_metrics=outcome_metrics,
        )

        all_results["branches"].append({
            "name": branch.get("name", f"Branch {i+1}"),
            "assumptions": branch.get("modifications", {}),
            "probability": branch.get("probability", 1.0 / len(branches)),
            "results": branch_results.to_dict(),
        })

    # Compute comparison metrics
    base_outcomes = all_results["base"]["outcomes"]
    for metric in outcome_metrics:
        if metric in base_outcomes:
            base_mean = base_outcomes[metric]["mean"]
            all_results["comparison"][metric] = {
                "base": base_mean,
                "branches": {},
                "max_deviation": 0,
                "most_sensitive_branch": None,
            }

            max_dev = 0
            max_branch = None

            for branch_result in all_results["branches"]:
                branch_name = branch_result["name"]
                if metric in branch_result["results"]["outcomes"]:
                    branch_mean = branch_result["results"]["outcomes"][metric]["mean"]
                    deviation = branch_mean - base_mean
                    all_results["comparison"][metric]["branches"][branch_name] = {
                        "mean": branch_mean,
                        "deviation": deviation,
                        "percent_change": (deviation / base_mean * 100) if base_mean != 0 else 0,
                    }

                    if abs(deviation) > abs(max_dev):
                        max_dev = deviation
                        max_branch = branch_name

            all_results["comparison"][metric]["max_deviation"] = max_dev
            all_results["comparison"][metric]["most_sensitive_branch"] = max_branch

    if webhook_url:
        async with httpx.AsyncClient() as client:
            await client.post(
                webhook_url,
                json={
                    "type": "complete",
                    "results": all_results,
                },
                timeout=30.0,
            )

    return all_results


# Web endpoint for synchronous calls from external services
@app.function(
    image=simulation_image,
        secrets=[modal.Secret.from_name("anthropic-secret")],
    timeout=60,
)
@modal.fastapi_endpoint(method="POST")
async def simulate(request: dict[str, Any]) -> dict[str, Any]:
    """
    HTTP endpoint for triggering simulations.

    Request body:
        type: "monte_carlo" | "game_theory" | "counterfactual"
        config: Simulation configuration
        ... other parameters based on type

    Returns:
        Simulation results or job ID for async processing
    """
    sim_type = request.get("type", "monte_carlo")

    if sim_type == "monte_carlo":
        # Spawn async job for long-running simulation
        call = run_monte_carlo.spawn(
            config=request.get("config", {}),
            scenario_template=request.get("scenario_template", {}),
            available_actions=request.get("available_actions", []),
            outcome_metrics=request.get("outcome_metrics", []),
            context_variations=request.get("context_variations"),
            webhook_url=request.get("webhook_url"),
        )
        return {
            "status": "started",
            "job_id": call.object_id,
            "type": "monte_carlo",
        }

    elif sim_type == "game_theory":
        call = run_game_theory.spawn(
            players=request.get("players", []),
            payoff_structure=request.get("payoff_structure", {}),
            num_rounds=request.get("num_rounds", 10),
            webhook_url=request.get("webhook_url"),
        )
        return {
            "status": "started",
            "job_id": call.object_id,
            "type": "game_theory",
        }

    elif sim_type == "counterfactual":
        call = run_counterfactual.spawn(
            base_scenario=request.get("base_scenario", {}),
            branches=request.get("branches", []),
            simulation_config=request.get("simulation_config", {}),
            available_actions=request.get("available_actions", []),
            outcome_metrics=request.get("outcome_metrics", []),
            webhook_url=request.get("webhook_url"),
        )
        return {
            "status": "started",
            "job_id": call.object_id,
            "type": "counterfactual",
        }

    else:
        return {
            "status": "error",
            "message": f"Unknown simulation type: {sim_type}",
        }


@app.function(image=simulation_image, timeout=30)
@modal.fastapi_endpoint(method="GET")
async def job_status(job_id: str) -> dict[str, Any]:
    """
    Check status of a running simulation job.

    Args:
        job_id: The job ID returned from simulate endpoint

    Returns:
        Status and results if complete
    """
    from modal import FunctionCall

    try:
        call = FunctionCall.from_id(job_id)

        try:
            result = call.get(timeout=0.1)
            return {
                "status": "complete",
                "results": result,
            }
        except TimeoutError:
            return {
                "status": "running",
                "job_id": job_id,
            }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
        }


# Local mount for development
@app.local_entrypoint()
def main():
    """Test the simulation locally."""
    import asyncio

    config = {
        "simulation_id": "test-sim-001",
        "population_size": 100,
        "llm_ratio": 0.0,  # No LLM for local test
        "num_iterations": 10,
        "domain": "enterprise",
    }

    scenario = {
        "product": "Enterprise SaaS",
        "price": 500,
        "perceived_value": 600,
        "current_satisfaction": 0.7,
        "switching_cost": 0.3,
    }

    actions = ["buy", "wait", "switch_to_competitor", "churn"]
    metrics = ["adoption_rate", "churn_rate", "revenue"]

    result = run_monte_carlo.remote(
        config=config,
        scenario_template=scenario,
        available_actions=actions,
        outcome_metrics=metrics,
    )

    print(json.dumps(result, indent=2))
