# RLTX MULTI-AGENT SIMULATION ARCHITECTURE
## Complete Technical Specification with SSR Calibration

---

## EXECUTIVE SUMMARY

This document provides the complete technical specification for building a **multi-agent simulation engine** that:
1. Creates realistic AI personas from real behavioral data (nyne.ai)
2. Uses **Semantic Similarity Rating (SSR)** to calibrate agent outputs to match human distributions
3. Scales from 2,000 VIP agents to 1,000,000+ statistical agents
4. Achieves **90%+ correlation** with real human behavior (validated)

The core innovation is the **SSR calibration layer** from arXiv:2510.08338, which solves the fundamental problem that LLMs produce unrealistic Likert-scale distributions when asked directly for numerical ratings.

---

## PART 1: THE PROBLEM SSR SOLVES

### Why Direct LLM Rating Fails

When you ask an LLM to rate something on a 1-5 scale directly:

```
User: "You are a 35-year-old suburban mom. Rate your purchase intent for this product (1-5)"
LLM: "3"
```

**The Problem:**
- LLMs regress to the mean (cluster around "3")
- Distributions are unrealistically narrow (low variance)
- They never say "1" or "5" (avoid extremes)
- KS similarity to human distributions: **~0.26-0.39** (poor)

**Real human surveys show:**
- Mean purchase intent: 4.0 ± 0.1
- Heavy weighting on 4s and 5s
- Natural variance across demographics

### The SSR Solution

Instead of asking for numbers, ask for **free-text responses**, then map them to calibrated distributions using **semantic similarity to anchor statements**.

```
User: "You are a 35-year-old suburban mom. How likely are you to purchase this product?"
LLM: "I'd probably buy it. I like that it's easy to use and I can take it with me. Plus, the price isn't too bad."

→ SSR maps this to: P(4) = 0.40, P(5) = 0.35, P(3) = 0.20, P(2) = 0.05, P(1) = 0.00
→ Expected value: 4.05 (calibrated to real human behavior)
```

**SSR Results (validated on 57 surveys, 9,300 human responses):**
- KS similarity to human distributions: **>0.85** (excellent)
- Correlation attainment: **90%** of human test-retest reliability
- Maintains realistic variance across demographics

---

## PART 2: SSR MATHEMATICAL FORMULATION

### Core Algorithm

**Step 1: Define Anchor Statements**

For each Likert point r ∈ {1, 2, 3, 4, 5}, define anchor statement σᵣ:

```python
PURCHASE_INTENT_ANCHORS = {
    1: "I would definitely not buy this product",
    2: "I probably would not buy this product",
    3: "I might or might not buy this product",
    4: "I probably would buy this product",
    5: "I would definitely buy this product"
}

# Multiple anchor sets improve stability (use 6 sets, average results)
ANCHOR_SETS = [
    {1: "Definitely not", 2: "Probably not", 3: "Maybe", 4: "Probably yes", 5: "Definitely yes"},
    {1: "No chance I'd buy this", 2: "Unlikely to buy", 3: "Undecided", 4: "Likely to buy", 5: "Certain to buy"},
    # ... 4 more sets
]
```

**Step 2: Embed Response and Anchors**

```python
from openai import OpenAI

def get_embedding(text: str, model: str = "text-embedding-3-small") -> np.ndarray:
    """Get embedding vector for text."""
    client = OpenAI()
    response = client.embeddings.create(input=text, model=model)
    return np.array(response.data[0].embedding)

# Embed the LLM's free-text response
response_text = "I'd probably buy it. I like that it's easy to use..."
v_response = get_embedding(response_text)

# Embed each anchor statement
anchor_embeddings = {r: get_embedding(sigma) for r, sigma in ANCHORS.items()}
```

**Step 3: Compute Cosine Similarity**

```python
def cosine_similarity(v1: np.ndarray, v2: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))

# Similarity to each anchor
similarities = {
    r: cosine_similarity(v_response, v_anchor) 
    for r, v_anchor in anchor_embeddings.items()
}
# Example: {1: 0.42, 2: 0.48, 3: 0.55, 4: 0.72, 5: 0.68}
```

**Step 4: Convert to Probability Distribution**

The key insight: subtract the minimum similarity to create contrast, then normalize.

```python
def similarities_to_pmf(
    similarities: dict[int, float],
    temperature: float = 1.0,
    epsilon: float = 0.0
) -> dict[int, float]:
    """
    Convert similarities to probability mass function.
    
    Args:
        similarities: {likert_value: similarity_score}
        temperature: Controls distribution sharpness (1.0 = default)
        epsilon: Regularization to prevent zero probabilities
    
    Returns:
        {likert_value: probability}
    """
    # Subtract minimum to create contrast
    min_sim = min(similarities.values())
    min_rating = min(similarities, key=similarities.get)
    
    adjusted = {}
    for r, sim in similarities.items():
        # Add epsilon to the minimum rating to prevent zero probability
        if r == min_rating:
            adjusted[r] = epsilon
        else:
            adjusted[r] = sim - min_sim + epsilon
    
    # Apply temperature scaling
    if temperature != 1.0:
        adjusted = {r: p ** (1/temperature) for r, p in adjusted.items()}
    
    # Normalize to sum to 1
    total = sum(adjusted.values())
    pmf = {r: p / total for r, p in adjusted.items()}
    
    return pmf

# Example output:
# {1: 0.00, 2: 0.08, 3: 0.17, 4: 0.40, 5: 0.35}
```

**Step 5: Average Over Multiple Anchor Sets**

```python
def get_calibrated_rating(
    response_text: str,
    anchor_sets: list[dict],
    temperature: float = 1.0
) -> dict[int, float]:
    """Get calibrated PMF by averaging over multiple anchor sets."""
    
    v_response = get_embedding(response_text)
    all_pmfs = []
    
    for anchors in anchor_sets:
        # Embed anchors for this set
        anchor_embeddings = {r: get_embedding(s) for r, s in anchors.items()}
        
        # Compute similarities
        similarities = {
            r: cosine_similarity(v_response, v) 
            for r, v in anchor_embeddings.items()
        }
        
        # Convert to PMF
        pmf = similarities_to_pmf(similarities, temperature)
        all_pmfs.append(pmf)
    
    # Average across all anchor sets
    averaged_pmf = {}
    for r in range(1, 6):
        averaged_pmf[r] = np.mean([pmf[r] for pmf in all_pmfs])
    
    # Re-normalize
    total = sum(averaged_pmf.values())
    return {r: p / total for r, p in averaged_pmf.items()}
```

### Complete SSR Implementation Class

```python
"""
Semantic Similarity Rating (SSR) Implementation
Based on arXiv:2510.08338 - PyMC Labs
"""

import numpy as np
from dataclasses import dataclass
from typing import Optional
import polars as pl

@dataclass
class SSRConfig:
    """Configuration for SSR rating."""
    embedding_model: str = "text-embedding-3-small"
    temperature: float = 1.0
    epsilon: float = 0.0
    cache_embeddings: bool = True

class SemanticSimilarityRater:
    """
    Maps free-text LLM responses to calibrated Likert distributions.
    
    Usage:
        rater = SemanticSimilarityRater(anchor_sets)
        pmf = rater.rate("I'd probably buy it...")
        expected_value = rater.expected_value(pmf)
    """
    
    def __init__(
        self,
        anchor_sets: list[dict[int, str]],
        config: Optional[SSRConfig] = None
    ):
        self.anchor_sets = anchor_sets
        self.config = config or SSRConfig()
        self._embedding_cache = {}
        
        # Pre-compute anchor embeddings
        self.anchor_embeddings = []
        for anchors in anchor_sets:
            embeddings = {r: self._get_embedding(s) for r, s in anchors.items()}
            self.anchor_embeddings.append(embeddings)
    
    def _get_embedding(self, text: str) -> np.ndarray:
        """Get embedding with caching."""
        if self.config.cache_embeddings and text in self._embedding_cache:
            return self._embedding_cache[text]
        
        from openai import OpenAI
        client = OpenAI()
        response = client.embeddings.create(
            input=text, 
            model=self.config.embedding_model
        )
        embedding = np.array(response.data[0].embedding)
        
        if self.config.cache_embeddings:
            self._embedding_cache[text] = embedding
        
        return embedding
    
    def _cosine_similarity(self, v1: np.ndarray, v2: np.ndarray) -> float:
        """Compute cosine similarity."""
        return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
    
    def _similarities_to_pmf(self, similarities: dict[int, float]) -> dict[int, float]:
        """Convert similarities to PMF using minimum subtraction."""
        min_sim = min(similarities.values())
        min_rating = min(similarities, key=similarities.get)
        
        adjusted = {}
        for r, sim in similarities.items():
            if r == min_rating:
                adjusted[r] = self.config.epsilon
            else:
                adjusted[r] = sim - min_sim + self.config.epsilon
        
        if self.config.temperature != 1.0:
            adjusted = {r: p ** (1/self.config.temperature) for r, p in adjusted.items()}
        
        total = sum(adjusted.values())
        if total == 0:
            return {r: 1/5 for r in range(1, 6)}  # Uniform if all zero
        
        return {r: p / total for r, p in adjusted.items()}
    
    def rate(self, response_text: str) -> dict[int, float]:
        """
        Convert a free-text response to a calibrated Likert PMF.
        
        Args:
            response_text: The LLM's free-text response
            
        Returns:
            Dictionary mapping Likert values (1-5) to probabilities
        """
        v_response = self._get_embedding(response_text)
        all_pmfs = []
        
        for anchor_embeddings in self.anchor_embeddings:
            similarities = {
                r: self._cosine_similarity(v_response, v)
                for r, v in anchor_embeddings.items()
            }
            pmf = self._similarities_to_pmf(similarities)
            all_pmfs.append(pmf)
        
        # Average across anchor sets
        averaged = {}
        for r in range(1, 6):
            averaged[r] = np.mean([pmf[r] for pmf in all_pmfs])
        
        total = sum(averaged.values())
        return {r: p / total for r, p in averaged.items()}
    
    def expected_value(self, pmf: dict[int, float]) -> float:
        """Compute expected value from PMF."""
        return sum(r * p for r, p in pmf.items())
    
    def sample(self, pmf: dict[int, float], n: int = 1) -> list[int]:
        """Sample n ratings from PMF."""
        ratings = list(pmf.keys())
        probs = list(pmf.values())
        return list(np.random.choice(ratings, size=n, p=probs))
    
    def rate_batch(self, responses: list[str]) -> list[dict[int, float]]:
        """Rate multiple responses efficiently."""
        return [self.rate(r) for r in responses]
    
    def aggregate_survey(self, pmfs: list[dict[int, float]]) -> dict[int, float]:
        """Aggregate individual PMFs into survey-level distribution."""
        n = len(pmfs)
        aggregated = {}
        for r in range(1, 6):
            aggregated[r] = sum(pmf[r] for pmf in pmfs) / n
        return aggregated


# Pre-defined anchor sets for common use cases
PURCHASE_INTENT_ANCHORS = [
    {
        1: "I would definitely not buy this product",
        2: "I probably would not buy this product", 
        3: "I might or might not buy this product",
        4: "I probably would buy this product",
        5: "I would definitely buy this product"
    },
    {
        1: "No chance I would purchase this",
        2: "It's unlikely I would purchase this",
        3: "I'm undecided about purchasing this",
        4: "I would likely purchase this",
        5: "I would certainly purchase this"
    },
    {
        1: "Definitely not interested in buying",
        2: "Probably not interested in buying",
        3: "Neutral about buying",
        4: "Probably interested in buying",
        5: "Definitely interested in buying"
    },
    {
        1: "I have no intention to buy this",
        2: "I have little intention to buy this",
        3: "I'm uncertain whether I'd buy this",
        4: "I have some intention to buy this",
        5: "I have strong intention to buy this"
    },
    {
        1: "This product doesn't appeal to me at all",
        2: "This product doesn't really appeal to me",
        3: "This product somewhat appeals to me",
        4: "This product appeals to me",
        5: "This product strongly appeals to me"
    },
    {
        1: "I would never consider buying this",
        2: "I would rarely consider buying this",
        3: "I might consider buying this",
        4: "I would often consider buying this",
        5: "I would always consider buying this"
    }
]

POLITICAL_SUPPORT_ANCHORS = [
    {
        1: "I strongly oppose this",
        2: "I somewhat oppose this",
        3: "I'm neutral on this",
        4: "I somewhat support this",
        5: "I strongly support this"
    },
    {
        1: "I completely disagree",
        2: "I mostly disagree",
        3: "I neither agree nor disagree",
        4: "I mostly agree",
        5: "I completely agree"
    }
]

RISK_TOLERANCE_ANCHORS = [
    {
        1: "I would never take this risk",
        2: "I would rarely take this risk",
        3: "I might take this risk",
        4: "I would likely take this risk",
        5: "I would definitely take this risk"
    }
]

ALLIANCE_LIKELIHOOD_ANCHORS = [
    {
        1: "This alliance is extremely unlikely",
        2: "This alliance is unlikely",
        3: "This alliance is possible",
        4: "This alliance is likely",
        5: "This alliance is highly likely"
    }
]
```

---

## PART 3: THREE-TIER AGENT ARCHITECTURE

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RLTX AGENT ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   TIER 0: CALIBRATION LAYER (SSR)                                           │
│   └── Maps all agent outputs to calibrated distributions                    │
│   └── Validated against real human data                                     │
│                                                                             │
│   TIER 1: VIP AGENTS (~2,000)                                               │
│   └── Full LLM reasoning (GPT-4o, Claude)                                   │
│   └── Named individuals with rich personas                                  │
│   └── Memory streams + reflection + planning                                │
│   └── Cost: ~$0.01-0.05 per action                                          │
│                                                                             │
│   TIER 2: ARCHETYPE AGENTS (~10,000)                                        │
│   └── Lighter LLM calls (GPT-4o-mini, Gemini Flash)                         │
│   └── Template-based personas from clusters                                 │
│   └── Simpler memory (last N interactions)                                  │
│   └── Cost: ~$0.001-0.005 per action                                        │
│                                                                             │
│   TIER 3: STATISTICAL AGENTS (~1,000,000+)                                  │
│   └── No LLM calls                                                          │
│   └── Behavioral distributions learned from Tier 1/2                        │
│   └── Neural network or lookup tables                                       │
│   └── Cost: ~$0.0001 per action                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tier 1: VIP Agent Implementation

```python
"""
Tier 1 VIP Agent - Full LLM reasoning with memory and reflection.
Based on Stanford Generative Agents architecture.
"""

import json
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional
import numpy as np

@dataclass
class Memory:
    """A single memory in the agent's memory stream."""
    id: str
    timestamp: datetime
    content: str
    importance: float  # 1-10 scale
    embedding: Optional[np.ndarray] = None
    memory_type: str = "observation"  # observation, reflection, plan
    
    def relevance_score(self, query_embedding: np.ndarray, current_time: datetime) -> float:
        """Compute retrieval score: recency × importance × relevance."""
        if self.embedding is None:
            return 0.0
        
        # Recency: exponential decay with half-life of 1 day
        hours_ago = (current_time - self.timestamp).total_seconds() / 3600
        recency = 0.99 ** hours_ago
        
        # Relevance: cosine similarity
        relevance = np.dot(self.embedding, query_embedding) / (
            np.linalg.norm(self.embedding) * np.linalg.norm(query_embedding)
        )
        
        # Combined score
        return recency * (self.importance / 10) * relevance


@dataclass
class VIPPersona:
    """Rich persona specification for a VIP agent."""
    
    # Identity Core (~100 words)
    name: str
    role: str
    background: str
    
    # Psychological Profile (~150 words)
    big_five: dict[str, float]  # O, C, E, A, N (0-1 scale)
    moral_foundations: dict[str, float]  # Care, Fairness, Loyalty, Authority, Sanctity, Liberty
    decision_style: str
    risk_tolerance: float  # 0-1
    
    # Behavioral Anchors (~200 words) - from nyne.ai
    topics_engaged: list[str]
    communication_style: str
    sample_content: list[str]  # 3-5 representative posts/tweets
    influence_network: dict[str, list[str]]  # amplifies, amplified_by
    
    # Belief System (~150 words)
    core_beliefs: dict[str, float]  # belief: confidence (0-1)
    updateable_beliefs: dict[str, float]
    
    def to_prompt(self) -> str:
        """Generate the system prompt for this persona."""
        big_five_desc = ", ".join([
            f"{trait}={score:.2f}" for trait, score in self.big_five.items()
        ])
        
        return f"""You are simulating {self.name} in a strategic scenario.

IDENTITY:
- Role: {self.role}
- Background: {self.background}

PSYCHOLOGICAL PROFILE:
- Big Five: {big_five_desc}
- Decision Style: {self.decision_style}
- Risk Tolerance: {self.risk_tolerance:.2f}

BEHAVIORAL PATTERNS:
- Topics: {', '.join(self.topics_engaged)}
- Communication: {self.communication_style}
- Sample statements from this person:
{chr(10).join(f'  - "{s}"' for s in self.sample_content[:3])}

CORE BELIEFS:
{chr(10).join(f'  - "{b}" (confidence: {c:.2f})' for b, c in self.core_beliefs.items())}

Respond authentically as {self.name} would. Think step by step about what they would actually do given their personality, beliefs, and goals."""


class VIPAgent:
    """
    Full-fidelity VIP agent with memory, reflection, and planning.
    """
    
    def __init__(
        self,
        persona: VIPPersona,
        ssr_rater: 'SemanticSimilarityRater',
        llm_client: 'OpenAI',
        model: str = "gpt-4o"
    ):
        self.persona = persona
        self.ssr_rater = ssr_rater
        self.llm = llm_client
        self.model = model
        
        self.memory_stream: list[Memory] = []
        self.importance_sum = 0.0
        self.reflection_threshold = 100.0  # Trigger reflection when sum exceeds this
        
    def _get_embedding(self, text: str) -> np.ndarray:
        """Get embedding for text."""
        response = self.llm.embeddings.create(
            input=text,
            model="text-embedding-3-small"
        )
        return np.array(response.data[0].embedding)
    
    def _rate_importance(self, observation: str) -> float:
        """Rate the importance of an observation (1-10)."""
        response = self.llm.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Rate the importance of this observation for a person's daily life on a scale of 1-10. Reply with just the number."},
                {"role": "user", "content": observation}
            ],
            temperature=0.3
        )
        try:
            return float(response.choices[0].message.content.strip())
        except:
            return 5.0
    
    def observe(self, observation: str) -> None:
        """Add an observation to the memory stream."""
        importance = self._rate_importance(observation)
        embedding = self._get_embedding(observation)
        
        memory = Memory(
            id=f"mem_{len(self.memory_stream)}",
            timestamp=datetime.now(),
            content=observation,
            importance=importance,
            embedding=embedding,
            memory_type="observation"
        )
        
        self.memory_stream.append(memory)
        self.importance_sum += importance
        
        # Trigger reflection if threshold exceeded
        if self.importance_sum >= self.reflection_threshold:
            self._reflect()
            self.importance_sum = 0.0
    
    def _retrieve_memories(self, query: str, k: int = 10) -> list[Memory]:
        """Retrieve most relevant memories for a query."""
        query_embedding = self._get_embedding(query)
        current_time = datetime.now()
        
        scored_memories = [
            (m, m.relevance_score(query_embedding, current_time))
            for m in self.memory_stream
        ]
        
        scored_memories.sort(key=lambda x: x[1], reverse=True)
        return [m for m, score in scored_memories[:k]]
    
    def _reflect(self) -> None:
        """Generate higher-level reflections from recent memories."""
        recent = self.memory_stream[-50:]  # Last 50 memories
        
        memory_text = "\n".join([f"- {m.content}" for m in recent])
        
        response = self.llm.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": self.persona.to_prompt()},
                {"role": "user", "content": f"""Based on these recent observations, what are 3 high-level insights or reflections that {self.persona.name} would have?

Observations:
{memory_text}

Format: Return each insight on a new line, starting with "Insight: \""""}
            ],
            temperature=0.7
        )
        
        insights = response.choices[0].message.content.strip().split("\n")
        for insight in insights:
            if insight.strip():
                clean = insight.replace("Insight:", "").strip()
                embedding = self._get_embedding(clean)
                
                reflection = Memory(
                    id=f"reflect_{len(self.memory_stream)}",
                    timestamp=datetime.now(),
                    content=clean,
                    importance=8.0,  # Reflections are important
                    embedding=embedding,
                    memory_type="reflection"
                )
                self.memory_stream.append(reflection)
    
    def act(self, situation: str) -> tuple[str, dict[int, float]]:
        """
        Generate an action/response to a situation.
        
        Returns:
            (free_text_response, calibrated_pmf)
        """
        # Retrieve relevant memories
        memories = self._retrieve_memories(situation, k=10)
        memory_context = "\n".join([f"- {m.content}" for m in memories])
        
        # Generate response
        response = self.llm.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": self.persona.to_prompt()},
                {"role": "user", "content": f"""Relevant memories:
{memory_context}

Current situation: {situation}

How does {self.persona.name} respond? Think step by step about what they would actually do."""}
            ],
            temperature=0.7
        )
        
        free_text = response.choices[0].message.content.strip()
        
        # Calibrate using SSR
        pmf = self.ssr_rater.rate(free_text)
        
        # Store the action as a memory
        self.observe(f"I responded to '{situation[:50]}...' with '{free_text[:100]}...'")
        
        return free_text, pmf
    
    def decide(
        self,
        question: str,
        anchor_type: str = "purchase_intent"
    ) -> tuple[str, dict[int, float], float]:
        """
        Make a calibrated decision on a question.
        
        Returns:
            (reasoning, pmf, expected_value)
        """
        reasoning, pmf = self.act(question)
        expected = self.ssr_rater.expected_value(pmf)
        
        return reasoning, pmf, expected
```

### Tier 2: Archetype Agent Implementation

```python
"""
Tier 2 Archetype Agent - Lighter LLM calls with template personas.
"""

@dataclass
class ArchetypeDefinition:
    """Definition of an archetype cluster."""
    
    id: str
    description: str  # e.g., "senior_defense_contractor_conservative"
    
    # Demographics (distributions)
    age_mean: float
    age_std: float
    gender_male_prob: float
    education_level: dict[str, float]  # {level: probability}
    income_percentile: float
    location_distribution: dict[str, float]  # {region: probability}
    
    # Psychological distributions (mean, std)
    big_five: dict[str, tuple[float, float]]  # {trait: (mean, std)}
    risk_tolerance: tuple[float, float]  # (mean, std)
    political_lean: tuple[float, float]  # -1 (left) to +1 (right)
    
    # Behavioral patterns
    interest_topics: dict[str, float]  # {topic: probability}
    response_templates: dict[str, str]  # {scenario_type: template}
    
    def sample_agent(self) -> dict:
        """Sample a concrete agent from this archetype."""
        return {
            "age": np.random.normal(self.age_mean, self.age_std),
            "gender": "male" if np.random.random() < self.gender_male_prob else "female",
            "big_five": {
                trait: np.clip(np.random.normal(mean, std), 0, 1)
                for trait, (mean, std) in self.big_five.items()
            },
            "risk_tolerance": np.clip(
                np.random.normal(*self.risk_tolerance), 0, 1
            ),
            "political_lean": np.clip(
                np.random.normal(*self.political_lean), -1, 1
            ),
            "interests": np.random.choice(
                list(self.interest_topics.keys()),
                size=5,
                p=list(self.interest_topics.values()),
                replace=False
            ).tolist()
        }


class ArchetypeAgent:
    """
    Lighter-weight agent based on archetype templates.
    Uses simpler memory (last N interactions only).
    """
    
    def __init__(
        self,
        archetype: ArchetypeDefinition,
        ssr_rater: 'SemanticSimilarityRater',
        llm_client: 'OpenAI',
        model: str = "gpt-4o-mini"  # Lighter model
    ):
        self.archetype = archetype
        self.attributes = archetype.sample_agent()
        self.ssr_rater = ssr_rater
        self.llm = llm_client
        self.model = model
        
        self.memory: list[str] = []  # Simple memory - last 20 interactions
        self.max_memory = 20
    
    def _build_prompt(self) -> str:
        """Build a simpler prompt from archetype + sampled attributes."""
        big_five = self.attributes["big_five"]
        
        return f"""You are a {self.archetype.description}.

Demographics: {int(self.attributes['age'])} year old {self.attributes['gender']}
Personality: Openness={big_five['O']:.1f}, Conscientiousness={big_five['C']:.1f}, Extraversion={big_five['E']:.1f}, Agreeableness={big_five['A']:.1f}, Neuroticism={big_five['N']:.1f}
Risk tolerance: {self.attributes['risk_tolerance']:.1f}
Interests: {', '.join(self.attributes['interests'])}

Respond naturally and authentically based on this profile."""
    
    def act(self, situation: str) -> tuple[str, dict[int, float]]:
        """Generate response with SSR calibration."""
        
        # Include recent memory context
        memory_context = ""
        if self.memory:
            memory_context = f"\nRecent context: {'; '.join(self.memory[-5:])}\n"
        
        response = self.llm.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": self._build_prompt()},
                {"role": "user", "content": f"{memory_context}{situation}"}
            ],
            temperature=0.7
        )
        
        free_text = response.choices[0].message.content.strip()
        pmf = self.ssr_rater.rate(free_text)
        
        # Update simple memory
        self.memory.append(f"Q: {situation[:50]} A: {free_text[:50]}")
        if len(self.memory) > self.max_memory:
            self.memory.pop(0)
        
        return free_text, pmf
```

### Tier 3: Statistical Agent Implementation

```python
"""
Tier 3 Statistical Agent - No LLM calls, pure distribution sampling.
"""

import torch
import torch.nn as nn

class BehaviorPredictor(nn.Module):
    """
    Neural network that predicts behavior distributions from agent features.
    Trained on outputs from Tier 1 and Tier 2 agents.
    """
    
    def __init__(self, input_dim: int = 50, hidden_dim: int = 128):
        super().__init__()
        
        self.network = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, 5),  # 5-point Likert output
            nn.Softmax(dim=-1)
        )
    
    def forward(self, features: torch.Tensor) -> torch.Tensor:
        """Predict Likert PMF from features."""
        return self.network(features)


class StatisticalAgent:
    """
    Extremely fast agent using pre-trained behavior model.
    No LLM calls - pure statistical inference.
    """
    
    def __init__(
        self,
        archetype_id: str,
        features: dict,
        behavior_model: BehaviorPredictor
    ):
        self.archetype_id = archetype_id
        self.features = features
        self.model = behavior_model
        
        # Pre-compute feature vector
        self.feature_vector = self._encode_features(features)
    
    def _encode_features(self, features: dict) -> torch.Tensor:
        """Encode features into fixed-size vector."""
        # Normalize numerical features
        numerical = [
            features.get("age", 35) / 100,
            features.get("income_percentile", 50) / 100,
            features.get("risk_tolerance", 0.5),
            features.get("political_lean", 0) / 2 + 0.5,  # [-1,1] -> [0,1]
        ]
        
        # One-hot encode Big Five
        big_five = [
            features.get("big_five", {}).get(t, 0.5)
            for t in ["O", "C", "E", "A", "N"]
        ]
        
        # Combine
        vector = numerical + big_five
        # Pad to expected size
        while len(vector) < 50:
            vector.append(0.0)
        
        return torch.tensor(vector[:50], dtype=torch.float32)
    
    def decide(self, scenario_embedding: Optional[torch.Tensor] = None) -> dict[int, float]:
        """
        Make a decision without any LLM calls.
        
        Args:
            scenario_embedding: Optional embedding of the scenario (if using)
            
        Returns:
            PMF over Likert scale
        """
        features = self.feature_vector
        if scenario_embedding is not None:
            # Concatenate scenario context if provided
            features = torch.cat([features, scenario_embedding])
        
        with torch.no_grad():
            pmf_tensor = self.model(features.unsqueeze(0)).squeeze()
        
        return {i+1: pmf_tensor[i].item() for i in range(5)}


class StatisticalPopulation:
    """
    Manage millions of statistical agents efficiently.
    """
    
    def __init__(
        self,
        archetypes: dict[str, ArchetypeDefinition],
        behavior_model: BehaviorPredictor
    ):
        self.archetypes = archetypes
        self.model = behavior_model
        self.agents: list[StatisticalAgent] = []
    
    def generate_population(self, n: int, archetype_distribution: dict[str, float]) -> None:
        """Generate n agents according to archetype distribution."""
        for archetype_id, prob in archetype_distribution.items():
            n_agents = int(n * prob)
            archetype = self.archetypes[archetype_id]
            
            for _ in range(n_agents):
                features = archetype.sample_agent()
                agent = StatisticalAgent(archetype_id, features, self.model)
                self.agents.append(agent)
    
    def run_simulation(
        self,
        scenario_embedding: Optional[torch.Tensor] = None
    ) -> dict[int, float]:
        """
        Run simulation across all agents, return aggregate distribution.
        
        Returns:
            Aggregate PMF across population
        """
        # Batch process for efficiency
        all_features = torch.stack([a.feature_vector for a in self.agents])
        
        with torch.no_grad():
            all_pmfs = self.model(all_features)
        
        # Aggregate
        aggregate = all_pmfs.mean(dim=0)
        return {i+1: aggregate[i].item() for i in range(5)}
    
    def segment_analysis(self, segment_fn: callable) -> dict[str, dict[int, float]]:
        """
        Analyze results by segment.
        
        Args:
            segment_fn: Function that takes agent features and returns segment name
            
        Returns:
            {segment_name: aggregate_pmf}
        """
        segments = {}
        for agent in self.agents:
            segment = segment_fn(agent.features)
            if segment not in segments:
                segments[segment] = []
            segments[segment].append(agent)
        
        results = {}
        for segment, agents in segments.items():
            all_features = torch.stack([a.feature_vector for a in agents])
            with torch.no_grad():
                pmfs = self.model(all_features)
            aggregate = pmfs.mean(dim=0)
            results[segment] = {i+1: aggregate[i].item() for i in range(5)}
        
        return results
```

---

## PART 4: DATA PIPELINE (NYNE.AI INTEGRATION)

### API Integration

```python
"""
Data pipeline for building personas from nyne.ai behavioral data.
"""

import requests
from dataclasses import dataclass

@dataclass
class NyneAPIConfig:
    api_key: str
    base_url: str = "https://api.nyne.ai/v1"

class NyneDataPipeline:
    """
    Extract behavioral data from nyne.ai to build agent personas.
    """
    
    def __init__(self, config: NyneAPIConfig):
        self.config = config
        self.headers = {"Authorization": f"Bearer {config.api_key}"}
    
    def get_person_interests(self, person_id: str) -> dict:
        """
        Get interest profile for a person.
        Maps to: Topic interests, values signals, identity anchors
        """
        response = requests.get(
            f"{self.config.base_url}/person/{person_id}/interests",
            headers=self.headers
        )
        return response.json()
    
    def get_person_newsfeed(self, person_id: str, limit: int = 100) -> list[dict]:
        """
        Get recent content from person's feeds.
        Maps to: Communication style, content samples, behavioral anchors
        """
        response = requests.get(
            f"{self.config.base_url}/person/{person_id}/newsfeed",
            headers=self.headers,
            params={"limit": limit}
        )
        return response.json()
    
    def build_vip_persona(self, person_id: str, name: str) -> VIPPersona:
        """
        Build a complete VIP persona from nyne.ai data.
        """
        interests = self.get_person_interests(person_id)
        newsfeed = self.get_person_newsfeed(person_id)
        
        # Extract topics
        topics = [item["topic"] for item in interests.get("interests", [])]
        
        # Extract sample content
        samples = [
            item["text"][:200] 
            for item in newsfeed[:5] 
            if item.get("text")
        ]
        
        # Infer Big Five from content (using LLM)
        big_five = self._infer_big_five(samples)
        
        # Build persona
        return VIPPersona(
            name=name,
            role=interests.get("occupation", "Unknown"),
            background=interests.get("bio", ""),
            big_five=big_five,
            moral_foundations=self._infer_moral_foundations(samples),
            decision_style=self._infer_decision_style(samples),
            risk_tolerance=self._infer_risk_tolerance(samples),
            topics_engaged=topics[:10],
            communication_style=self._analyze_communication_style(samples),
            sample_content=samples,
            influence_network={
                "amplifies": interests.get("influences", []),
                "amplified_by": interests.get("influenced_by", [])
            },
            core_beliefs=self._extract_beliefs(samples),
            updateable_beliefs={}
        )
    
    def _infer_big_five(self, content_samples: list[str]) -> dict[str, float]:
        """Use LIWC-style analysis + LLM to infer Big Five traits."""
        # Implementation: analyze linguistic features
        # - First-person pronouns → introversion/extraversion
        # - Certainty words → conscientiousness
        # - Emotional words → neuroticism
        # - Complexity → openness
        # - Social words → agreeableness
        pass
    
    def _infer_moral_foundations(self, samples: list[str]) -> dict[str, float]:
        """Infer Moral Foundations from content."""
        pass
    
    def _infer_decision_style(self, samples: list[str]) -> str:
        """Analyze decision-making style from content."""
        pass
    
    def _infer_risk_tolerance(self, samples: list[str]) -> float:
        """Infer risk tolerance from career/content patterns."""
        pass
    
    def _analyze_communication_style(self, samples: list[str]) -> str:
        """Analyze communication patterns."""
        pass
    
    def _extract_beliefs(self, samples: list[str]) -> dict[str, float]:
        """Extract core beliefs and confidence levels."""
        pass


def build_archetype_clusters(
    sampled_personas: list[dict],
    n_clusters: int = 500
) -> list[ArchetypeDefinition]:
    """
    Cluster sampled personas into archetypes.
    
    Args:
        sampled_personas: List of feature dicts from nyne.ai
        n_clusters: Target number of archetypes
        
    Returns:
        List of archetype definitions
    """
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler
    
    # Extract features for clustering
    features = []
    for persona in sampled_personas:
        feature_vector = [
            persona.get("age", 35),
            1 if persona.get("gender") == "male" else 0,
            persona.get("income_percentile", 50),
            persona.get("political_lean", 0),
            persona.get("risk_tolerance", 0.5),
        ] + [
            persona.get("big_five", {}).get(t, 0.5)
            for t in ["O", "C", "E", "A", "N"]
        ]
        features.append(feature_vector)
    
    # Standardize and cluster
    scaler = StandardScaler()
    features_scaled = scaler.fit_transform(features)
    
    kmeans = KMeans(n_clusters=n_clusters, random_state=42)
    labels = kmeans.fit_predict(features_scaled)
    
    # Build archetype definitions from clusters
    archetypes = []
    for cluster_id in range(n_clusters):
        cluster_indices = [i for i, l in enumerate(labels) if l == cluster_id]
        cluster_personas = [sampled_personas[i] for i in cluster_indices]
        
        # Compute cluster statistics
        ages = [p.get("age", 35) for p in cluster_personas]
        
        archetype = ArchetypeDefinition(
            id=f"archetype_{cluster_id}",
            description=_generate_archetype_description(cluster_personas),
            age_mean=np.mean(ages),
            age_std=np.std(ages),
            gender_male_prob=np.mean([1 if p.get("gender") == "male" else 0 for p in cluster_personas]),
            education_level=_compute_distribution(cluster_personas, "education"),
            income_percentile=np.mean([p.get("income_percentile", 50) for p in cluster_personas]),
            location_distribution=_compute_distribution(cluster_personas, "location"),
            big_five={
                t: (
                    np.mean([p.get("big_five", {}).get(t, 0.5) for p in cluster_personas]),
                    np.std([p.get("big_five", {}).get(t, 0.5) for p in cluster_personas])
                )
                for t in ["O", "C", "E", "A", "N"]
            },
            risk_tolerance=(
                np.mean([p.get("risk_tolerance", 0.5) for p in cluster_personas]),
                np.std([p.get("risk_tolerance", 0.5) for p in cluster_personas])
            ),
            political_lean=(
                np.mean([p.get("political_lean", 0) for p in cluster_personas]),
                np.std([p.get("political_lean", 0) for p in cluster_personas])
            ),
            interest_topics=_compute_topic_distribution(cluster_personas),
            response_templates={}
        )
        archetypes.append(archetype)
    
    return archetypes
```

---

## PART 5: VALIDATION FRAMEWORK

### Metrics Implementation

```python
"""
Validation framework for calibrating and proving simulation accuracy.
"""

from scipy import stats
import numpy as np

class SimulationValidator:
    """
    Validate simulation outputs against real-world data.
    """
    
    @staticmethod
    def ks_similarity(synthetic_dist: dict[int, float], real_dist: dict[int, float]) -> float:
        """
        Kolmogorov-Smirnov similarity between distributions.
        
        Returns:
            Similarity score (0-1, higher is better)
        """
        # Convert to CDFs
        synthetic_cdf = np.cumsum([synthetic_dist.get(i, 0) for i in range(1, 6)])
        real_cdf = np.cumsum([real_dist.get(i, 0) for i in range(1, 6)])
        
        # KS distance
        ks_dist = np.max(np.abs(synthetic_cdf - real_cdf))
        
        return 1 - ks_dist
    
    @staticmethod
    def correlation_attainment(
        synthetic_means: list[float],
        real_means: list[float],
        n_bootstrap: int = 2000
    ) -> tuple[float, float]:
        """
        Compute correlation attainment (synthetic/real correlation divided by test-retest ceiling).
        
        Returns:
            (correlation_attainment, standard_error)
        """
        # Compute actual correlation
        r_synthetic_real = stats.pearsonr(synthetic_means, real_means)[0]
        
        # Estimate test-retest ceiling via bootstrap
        real_array = np.array(real_means)
        n = len(real_array)
        
        test_retest_correlations = []
        for _ in range(n_bootstrap):
            # Split each survey randomly
            half_size = n // 2
            indices = np.random.permutation(n)
            test_indices = indices[:half_size]
            control_indices = indices[half_size:2*half_size]
            
            # Compute correlation between halves
            r = stats.pearsonr(
                real_array[test_indices],
                real_array[control_indices]
            )[0]
            test_retest_correlations.append(r)
        
        ceiling = np.mean(test_retest_correlations)
        
        # Correlation attainment
        attainment = r_synthetic_real / ceiling if ceiling > 0 else 0
        
        # Standard error
        se = np.std(test_retest_correlations) / np.sqrt(n_bootstrap)
        
        return attainment, se
    
    @staticmethod
    def demographic_calibration(
        synthetic_by_segment: dict[str, dict[int, float]],
        real_by_segment: dict[str, dict[int, float]]
    ) -> dict[str, float]:
        """
        Validate that synthetic agents replicate demographic patterns.
        
        Returns:
            {segment: ks_similarity} for each demographic segment
        """
        results = {}
        for segment in synthetic_by_segment:
            if segment in real_by_segment:
                results[segment] = SimulationValidator.ks_similarity(
                    synthetic_by_segment[segment],
                    real_by_segment[segment]
                )
        return results


class ContinuousCalibrationLoop:
    """
    Continuously improve personas based on real-world outcomes.
    """
    
    def __init__(self, personas: dict[str, VIPPersona]):
        self.personas = personas
        self.prediction_history: list[dict] = []
    
    def record_prediction(
        self,
        persona_id: str,
        scenario: str,
        predicted_pmf: dict[int, float],
        predicted_value: float
    ) -> str:
        """Record a prediction for later validation."""
        prediction_id = f"pred_{len(self.prediction_history)}"
        self.prediction_history.append({
            "id": prediction_id,
            "persona_id": persona_id,
            "scenario": scenario,
            "predicted_pmf": predicted_pmf,
            "predicted_value": predicted_value,
            "actual_outcome": None,
            "validated": False
        })
        return prediction_id
    
    def record_outcome(self, prediction_id: str, actual_outcome: float) -> None:
        """Record actual outcome for a prediction."""
        for pred in self.prediction_history:
            if pred["id"] == prediction_id:
                pred["actual_outcome"] = actual_outcome
                pred["validated"] = True
                break
    
    def analyze_accuracy(self, persona_id: str) -> dict:
        """Analyze prediction accuracy for a persona."""
        predictions = [
            p for p in self.prediction_history
            if p["persona_id"] == persona_id and p["validated"]
        ]
        
        if not predictions:
            return {"n": 0, "mae": None, "correlation": None}
        
        predicted = [p["predicted_value"] for p in predictions]
        actual = [p["actual_outcome"] for p in predictions]
        
        mae = np.mean(np.abs(np.array(predicted) - np.array(actual)))
        correlation = stats.pearsonr(predicted, actual)[0] if len(predicted) > 2 else None
        
        return {
            "n": len(predictions),
            "mae": mae,
            "correlation": correlation,
            "predictions": predictions
        }
    
    def suggest_persona_updates(self, persona_id: str) -> list[str]:
        """Suggest updates to improve persona accuracy."""
        accuracy = self.analyze_accuracy(persona_id)
        suggestions = []
        
        if accuracy["n"] < 5:
            suggestions.append("Need more validated predictions to suggest updates")
            return suggestions
        
        # Analyze systematic biases
        predictions = accuracy["predictions"]
        errors = [p["predicted_value"] - p["actual_outcome"] for p in predictions]
        mean_error = np.mean(errors)
        
        if mean_error > 0.5:
            suggestions.append(f"Persona tends to predict too high (bias: {mean_error:.2f}). Consider reducing optimism/positivity.")
        elif mean_error < -0.5:
            suggestions.append(f"Persona tends to predict too low (bias: {mean_error:.2f}). Consider increasing optimism/positivity.")
        
        return suggestions
```

---

## PART 6: COMPLETE USAGE EXAMPLE

```python
"""
Complete example: Running a simulation with all components.
"""

from openai import OpenAI

def run_complete_simulation():
    """
    Full simulation pipeline example.
    """
    
    # Initialize OpenAI client
    client = OpenAI()
    
    # Initialize SSR rater
    ssr_rater = SemanticSimilarityRater(
        anchor_sets=PURCHASE_INTENT_ANCHORS,
        config=SSRConfig(embedding_model="text-embedding-3-small")
    )
    
    # Create a VIP agent (e.g., tech executive)
    persona = VIPPersona(
        name="Sarah Chen",
        role="VP of Product at a Fortune 500 tech company",
        background="Stanford MBA, 15 years in enterprise software, known for data-driven decisions",
        big_five={"O": 0.85, "C": 0.90, "E": 0.70, "A": 0.60, "N": 0.30},
        moral_foundations={"Care": 0.6, "Fairness": 0.8, "Liberty": 0.7, "Authority": 0.5, "Loyalty": 0.5, "Sanctity": 0.3},
        decision_style="Analytical, seeks data before committing, risk-aware but not risk-averse",
        risk_tolerance=0.65,
        topics_engaged=["AI/ML", "enterprise SaaS", "product strategy", "team leadership", "data analytics"],
        communication_style="Direct, professional, uses metrics to support arguments",
        sample_content=[
            "The key question isn't whether AI will transform enterprise software—it's which companies will lead that transformation.",
            "We shipped 3 major features this quarter with 99.9% uptime. The team executed flawlessly.",
            "Data doesn't lie, but it also doesn't tell the whole story. Context matters."
        ],
        influence_network={"amplifies": ["tech_ceos", "ai_researchers"], "amplified_by": ["product_managers"]},
        core_beliefs={
            "Data should drive decisions": 0.95,
            "Enterprise AI will be bigger than consumer AI": 0.80,
            "Team culture determines outcomes": 0.90
        },
        updateable_beliefs={
            "Open source will dominate enterprise": 0.60
        }
    )
    
    # Create VIP agent
    vip_agent = VIPAgent(
        persona=persona,
        ssr_rater=ssr_rater,
        llm_client=client,
        model="gpt-4o"
    )
    
    # Run a decision scenario
    scenario = """
    Your company is considering acquiring a startup that has developed a novel AI model 
    for enterprise document processing. The acquisition price is $50M. The startup has 
    strong technology but limited enterprise sales experience. Your competitor is also 
    interested in acquiring them.
    
    How likely are you to recommend proceeding with this acquisition?
    """
    
    # Get calibrated decision
    reasoning, pmf, expected_value = vip_agent.decide(scenario)
    
    print("=" * 80)
    print("VIP AGENT DECISION")
    print("=" * 80)
    print(f"\nPersona: {persona.name}")
    print(f"\nScenario: {scenario[:100]}...")
    print(f"\nReasoning:\n{reasoning}")
    print(f"\nCalibrated Distribution:")
    for rating, prob in pmf.items():
        bar = "█" * int(prob * 40)
        print(f"  {rating}: {prob:.3f} {bar}")
    print(f"\nExpected Value: {expected_value:.2f}")
    
    # Validate against benchmark
    validator = SimulationValidator()
    
    # Example: Compare to hypothetical real survey data
    real_distribution = {1: 0.05, 2: 0.10, 3: 0.20, 4: 0.40, 5: 0.25}
    ks_sim = validator.ks_similarity(pmf, real_distribution)
    print(f"\nKS Similarity to benchmark: {ks_sim:.3f}")
    
    return reasoning, pmf, expected_value


if __name__ == "__main__":
    run_complete_simulation()
```

---

## PART 7: KEY RESEARCH FINDINGS SUMMARY

### From arXiv:2510.08338 (SSR Paper)

| Metric | Direct Likert | Follow-up Likert | SSR |
|--------|--------------|------------------|-----|
| KS Similarity (GPT-4o) | 0.26 | 0.72 | **0.88** |
| KS Similarity (Gemini) | 0.39 | 0.59 | **0.80** |
| Correlation Attainment | 80% | 85% | **90%** |
| Demographic Calibration | Poor | Moderate | **Good** |

### Critical Implementation Details

1. **Use 6 anchor sets and average** - Single anchor set results vary; averaging stabilizes
2. **Temperature T=1.0 is optimal** - Can tune between 0.5-1.5 for specific domains
3. **Epsilon=0 works** - But small epsilon (0.01) adds smoothing if needed
4. **Demographics matter** - Without demographic prompting, correlation drops to ~50%
5. **Age and income are key** - LLMs replicate these demographic patterns well
6. **Gender/region are weak** - LLMs don't capture these demographic differences as well

### From Stanford Generative Agents

1. **Minimal seed data works** - ~200 words per agent is enough to bootstrap
2. **Memory stream is critical** - Ablation shows believability drops without it
3. **Reflection triggers emergent behavior** - Party planning emerged from simple seeds
4. **Planning enables coherent behavior** - Daily schedules prevent random actions

### From AgentSociety (10K+ agents)

1. **Validate against known phenomena** - Polarization, cascade dynamics
2. **Use psychological frameworks** - Emotions, needs, motivations from literature
3. **Ground in real experiments** - Reproduce UBI studies, disaster response

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Core Infrastructure
- [ ] Implement SSR rater class with anchor sets
- [ ] Set up embedding pipeline (OpenAI text-embedding-3-small)
- [ ] Build VIP agent with memory stream
- [ ] Implement reflection and planning modules

### Phase 2: Data Pipeline
- [ ] Integrate nyne.ai API (Interests + Newsfeed)
- [ ] Build persona synthesis from behavioral data
- [ ] Implement archetype clustering
- [ ] Create statistical agent behavior model

### Phase 3: Validation
- [ ] Implement KS similarity metrics
- [ ] Build correlation attainment calculator
- [ ] Set up demographic calibration tests
- [ ] Create continuous calibration loop

### Phase 4: Scale
- [ ] Implement Tier 2 archetype agents
- [ ] Train behavior prediction neural network
- [ ] Build Tier 3 statistical population
- [ ] Implement batch processing for millions of agents

---

## REFERENCES

1. **SSR Paper**: arXiv:2510.08338 - "LLMs Reproduce Human Purchase Intent via Semantic Similarity Elicitation of Likert Ratings"
2. **Stanford Generative Agents**: Park et al. 2023 - "Generative Agents: Interactive Simulacra of Human Behavior"
3. **AgentSociety**: arXiv:2502.08691 - "AgentSociety: Large-Scale Agent-Based Social Simulation"
4. **Hybrid Architecture**: arXiv:2510.16366 - "Hybrid LLM-Diffusion Architecture for Social Simulation"
5. **GitHub Implementation**: https://github.com/pymc-labs/semantic-similarity-rating
