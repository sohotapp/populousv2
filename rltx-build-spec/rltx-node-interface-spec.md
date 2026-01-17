# RLTX NODE-BASED INTERFACE SPECIFICATION
## Natural Language to Simulation Graph

---

## INTERFACE DESIGN PHILOSOPHY

The key insight: **Natural language is the input, but nodes are the control surface.**

Users should be able to:
1. **Start with a sentence** → Get a working simulation immediately
2. **Click any node** → See reasoning, adjust parameters
3. **Add/remove nodes** → Customize the simulation
4. **Connect nodes** → Define new relationships
5. **Run & iterate** → See results, refine, run again

---

## THE CANVAS LAYOUT

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 💬 NATURAL LANGUAGE INPUT BAR                                                     │  │
│  │ ┌─────────────────────────────────────────────────────────────────────────────┐   │  │
│  │ │ "Simulate how Congress would vote on a TikTok ban if China retaliates..."  │   │  │
│  │ └─────────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                            [Generate Graph] 🔄    │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                                   │  │
│  │                           SIMULATION CANVAS                                       │  │
│  │                                                                                   │  │
│  │    ┌─────────┐           ┌─────────┐           ┌─────────┐                        │  │
│  │    │ 📋      │           │ 🧑      │           │ 🧑      │                        │  │
│  │    │ Trigger │─────────▶ │ China   │─────────▶ │ Congress│                        │  │
│  │    │ Event   │           │ Response│           │ Vote    │                        │  │
│  │    └─────────┘           └─────────┘           └────┬────┘                        │  │
│  │                                                     │                             │  │
│  │                                                     ▼                             │  │
│  │                                                ┌─────────┐                        │  │
│  │                                                │ 📊      │                        │  │
│  │                                                │ Outcome │                        │  │
│  │                                                │ Distrib │                        │  │
│  │                                                └─────────┘                        │  │
│  │                                                                                   │  │
│  │  ────────────────────────────────────────────────────────────────────────────     │  │
│  │  QUICK ACTIONS:  [+ Add Actor] [+ Add Event] [+ Add Constraint] [⚙️ Settings]    │  │
│  │                                                                                   │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                         │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────────────────┐  │
│  │ 📋 NODE INSPECTOR              │  │ 📊 SIMULATION RESULTS                       │  │
│  │ ───────────────────────────     │  │ ─────────────────────────                   │  │
│  │                                 │  │                                             │  │
│  │ Selected: Congress Vote Node   │  │ Pass Probability: 84%                       │  │
│  │                                 │  │ ┌─────────────────────────┐                 │  │
│  │ Vote Threshold: 60 (filibuster)│  │ │ ████████████████░░░░ │ 84%             │  │
│  │ Current Count: 82 YES          │  │ └─────────────────────────┘                 │  │
│  │                                 │  │                                             │  │
│  │ Key Swing Votes:               │  │ Key Variables:                              │  │
│  │ • Jon Tester (65% YES)         │  │ • China response intensity                  │  │
│  │ • Sherrod Brown (70% YES)      │  │ • Public sentiment shift                    │  │
│  │ • Susan Collins (55% YES)      │  │ • Corporate lobbying spend                  │  │
│  │                                 │  │                                             │  │
│  │ [Edit Parameters] [Expand]     │  │ [Run Simulation] [Export] [Share]           │  │
│  └─────────────────────────────────┘  └─────────────────────────────────────────────┘  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## NODE TYPE SPECIFICATIONS

### 1. ACTOR NODE (🧑)

**Visual Design:**
```
┌───────────────────────────────────────┐
│ 🧑 ACTOR                    [⋮ menu] │
├───────────────────────────────────────┤
│                                       │
│  ┌─────┐  Xi Jinping                  │
│  │ 🖼️  │  General Secretary, CPC      │
│  │     │  ────────────────────────    │
│  └─────┘  Risk Tolerance: ████░ 0.7   │
│           Hawkishness:    █████ 0.9   │
│                                       │
│  Current Position: [Undecided]        │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ ▶ Expand Persona Details       │  │
│  │ ▶ View Decision Reasoning      │  │
│  │ ▶ Edit Parameters              │  │
│  └─────────────────────────────────┘  │
│                                       │
└───────────────────────────────────────┘
```

**Expandable Persona Details:**
```
┌───────────────────────────────────────────────────────────────────────────┐
│ 🧑 XI JINPING - FULL PERSONA                                     [Close] │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  IDENTITY                           PSYCHOLOGICAL PROFILE                 │
│  ──────────────────                 ─────────────────────────             │
│  Name: Xi Jinping                   Big Five:                             │
│  Role: General Secretary            • Openness: 0.45                      │
│  Tenure: Since 2012                 • Conscientiousness: 0.85             │
│                                     • Extraversion: 0.55                  │
│  Background:                        • Agreeableness: 0.30                 │
│  Son of revolutionary, sent to      • Neuroticism: 0.40                   │
│  countryside during Cultural                                              │
│  Revolution. Engineering degree,    Decision Style:                       │
│  rose through provincial posts.     • Deliberate consolidator             │
│  Known for anti-corruption          • Long time horizons                  │
│  campaign and centralization.       • Face/dignity paramount              │
│                                     • Risk-seeking when cornered          │
│  ────────────────────────────────────────────────────────────────────     │
│                                                                           │
│  CORE BELIEFS                       BEHAVIORAL ANCHORS                    │
│  ──────────────────                 ────────────────────                  │
│  • "Century of humiliation must     • Taiwan: Red line, will use force    │
│     never recur" (conf: 0.99)       • US: Strategic competitor            │
│  • "CPC legitimacy = China's        • Economy: Tool of national power     │
│     prosperity" (conf: 0.95)        • Internal: Stability above all       │
│  • "Taiwan reunification in my                                            │
│     lifetime" (conf: 0.85)          Sample Statements:                    │
│  • "US in decline" (conf: 0.70)     • "The East is rising, West declining"│
│                                     • "We will never allow anyone to      │
│  ────────────────────────────────      bully, oppress, or subjugate China"│
│                                                                           │
│  [Save Changes] [Reset to Default] [View Source Data]                     │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Actor Node Subtypes:**

| Type | Icon | Description | Data Source |
|------|------|-------------|-------------|
| VIP | 🧑 | Named individual with full persona | nyne.ai + enrichment |
| Archetype | 👤 | Role-based template | Clustered from samples |
| Population | 👥 | Statistical segment | Census + behavioral |
| Organization | 🏢 | Company/Agency/Country | Public data + LLM |

---

### 2. SCENARIO NODE (📋)

**Visual Design:**
```
┌───────────────────────────────────────┐
│ 📋 SCENARIO                 [⋮ menu] │
├───────────────────────────────────────┤
│                                       │
│  Taiwan Strait Crisis                 │
│  ─────────────────────────────────    │
│                                       │
│  Trigger: US announces mutual         │
│  defense treaty with Taiwan           │
│                                       │
│  Timeline: 60-day Congressional       │
│  notification period                  │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ Key Assumptions:               │  │
│  │ • No prior military buildup    │  │
│  │ • Economic ties intact         │  │
│  │ • Global attention high        │  │
│  └─────────────────────────────────┘  │
│                                       │
│  [Edit Scenario] [Branch Variations]  │
│                                       │
└───────────────────────────────────────┘
```

**Scenario Properties:**
- Trigger event description
- Initial conditions
- Information state (who knows what)
- Timeline constraints
- Environmental factors

---

### 3. DECISION NODE (⚖️)

**Visual Design:**
```
┌───────────────────────────────────────┐
│ ⚖️ DECISION POINT            [⋮ menu] │
├───────────────────────────────────────┤
│                                       │
│  China's Response Options             │
│  ─────────────────────────────────    │
│                                       │
│  ○ Diplomatic protest only      15%   │
│  ○ Economic retaliation         35%   │
│  ○ Military demonstration       30%   │
│  ○ Gray zone operations         15%   │
│  ○ Kinetic response              5%   │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ Factors Influencing:           │  │
│  │ • Domestic pressure            │  │
│  │ • US resolve perception        │  │
│  │ • Economic cost tolerance      │  │
│  └─────────────────────────────────┘  │
│                                       │
│  [View Decision Tree] [Adjust Weights]│
│                                       │
└───────────────────────────────────────┘
```

**Decision Node Types:**
- **Binary:** Yes/No, Support/Oppose
- **Multi-choice:** Discrete options with probabilities
- **Continuous:** Slider (investment amount, force level)
- **Sequential:** If X then Y branching

---

### 4. RELATIONSHIP NODE (🔗)

**Visual Design (on connection line):**
```
         ┌─────────────┐
         │ 🔗 INFLUENCE│
         │ Strong (0.8)│
         │ Direction: →│
         └─────────────┘
              │
   [Xi] ═══════════════▶ [CMC]
```

**Relationship Types:**
- **Influence:** Direction + strength (0-1)
- **Alliance:** Mutual support probability
- **Opposition:** Conflict probability
- **Information:** What flows between nodes
- **Economic:** Trade/financial dependency
- **Hierarchy:** Command/reporting structure

---

### 5. CONSTRAINT NODE (⚠️)

**Visual Design:**
```
┌───────────────────────────────────────┐
│ ⚠️ CONSTRAINT               [⋮ menu] │
├───────────────────────────────────────┤
│                                       │
│  Nuclear Threshold                    │
│  ─────────────────────────────────    │
│                                       │
│  Type: RED LINE                       │
│  Applies to: All actors               │
│                                       │
│  Description:                         │
│  Nuclear weapons use triggers         │
│  automatic escalation to maximum      │
│  level for all parties.               │
│                                       │
│  Violation Probability: <1%           │
│                                       │
│  [Edit Constraint] [View Dependencies]│
│                                       │
└───────────────────────────────────────┘
```

**Constraint Types:**
- **Red Line:** Absolute limit (nuclear use, sovereignty)
- **Resource:** Budget, forces, time available
- **Procedural:** Legal requirements, approval chains
- **Normative:** Reputation, international norms
- **Physical:** Geography, logistics, physics

---

### 6. INFORMATION NODE (📰)

**Visual Design:**
```
┌───────────────────────────────────────┐
│ 📰 INFORMATION              [⋮ menu] │
├───────────────────────────────────────┤
│                                       │
│  Intelligence Assessment              │
│  ─────────────────────────────────    │
│                                       │
│  Content: PLA readiness level         │
│                                       │
│  Visibility:                          │
│  • US Intelligence: HIGH              │
│  • Public: LOW                        │
│  • China (own): PERFECT               │
│  • Taiwan: MEDIUM                     │
│                                       │
│  Confidence: 75%                      │
│  Source: Classified SIGINT            │
│                                       │
│  [Edit Visibility] [Add Disinformation]│
│                                       │
└───────────────────────────────────────┘
```

---

### 7. TIME NODE (⏱️)

**Visual Design:**
```
┌───────────────────────────────────────┐
│ ⏱️ TIME CONSTRAINT          [⋮ menu] │
├───────────────────────────────────────┤
│                                       │
│  Congressional Notification Period    │
│  ─────────────────────────────────    │
│                                       │
│  Duration: 60 days                    │
│  Start: Treaty announcement           │
│  End: Formal ratification             │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ ═══════════════░░░░░░░░░░░░░░░ │  │
│  │ Day 0                   Day 60 │  │
│  └─────────────────────────────────┘  │
│                                       │
│  Key Windows:                         │
│  • Day 1-7: Initial reactions         │
│  • Day 8-30: Negotiation window       │
│  • Day 31-60: Final positioning       │
│                                       │
│  [Edit Timeline] [Add Milestones]     │
│                                       │
└───────────────────────────────────────┘
```

---

### 8. OUTPUT NODE (📊)

**Visual Design:**
```
┌───────────────────────────────────────┐
│ 📊 SIMULATION OUTPUT        [⋮ menu] │
├───────────────────────────────────────┤
│                                       │
│  Escalation Probability Distribution  │
│  ─────────────────────────────────    │
│                                       │
│  Level 1 (Diplomatic)    ████████ 95% │
│  Level 2 (Economic)      ███████░ 80% │
│  Level 3 (Demonstration) █████░░░ 60% │
│  Level 4 (Gray Zone)     ███░░░░░ 35% │
│  Level 5 (Blockade)      █░░░░░░░ 15% │
│  Level 6 (Kinetic)       ░░░░░░░░  5% │
│                                       │
│  Most Likely: Level 2-3 plateau       │
│  Confidence Interval: [2.1, 3.4]      │
│                                       │
│  [Drill Down] [Export] [Compare]      │
│                                       │
└───────────────────────────────────────┘
```

---

## NATURAL LANGUAGE PARSING ENGINE

### Parser Architecture

```python
"""
Natural Language to Simulation Graph Parser
"""

from dataclasses import dataclass
from enum import Enum

class NodeType(Enum):
    ACTOR_VIP = "actor_vip"
    ACTOR_ARCHETYPE = "actor_archetype"
    ACTOR_POPULATION = "actor_population"
    ACTOR_ORGANIZATION = "actor_organization"
    SCENARIO = "scenario"
    DECISION = "decision"
    RELATIONSHIP = "relationship"
    CONSTRAINT = "constraint"
    INFORMATION = "information"
    TIME = "time"
    OUTPUT = "output"

@dataclass
class ParsedNode:
    type: NodeType
    name: str
    properties: dict
    position: tuple[int, int]  # Canvas position
    
@dataclass
class ParsedEdge:
    source: str
    target: str
    relationship_type: str
    properties: dict

class NLToGraphParser:
    """
    Parses natural language simulation requests into node graphs.
    """
    
    def __init__(self, llm_client, entity_db):
        self.llm = llm_client
        self.entity_db = entity_db  # VIP personas, archetypes, etc.
        
    def parse(self, user_input: str) -> tuple[list[ParsedNode], list[ParsedEdge]]:
        """
        Parse natural language into simulation graph.
        
        Returns:
            (nodes, edges) defining the simulation
        """
        # Step 1: Extract simulation type
        sim_type = self._classify_simulation_type(user_input)
        
        # Step 2: Extract entities (actors, events, outcomes)
        entities = self._extract_entities(user_input)
        
        # Step 3: Identify relationships
        relationships = self._extract_relationships(user_input, entities)
        
        # Step 4: Generate node specifications
        nodes = self._generate_nodes(entities, sim_type)
        
        # Step 5: Generate edge specifications
        edges = self._generate_edges(relationships)
        
        # Step 6: Validate and enrich from database
        nodes = self._enrich_from_database(nodes)
        
        return nodes, edges
    
    def _classify_simulation_type(self, user_input: str) -> str:
        """Classify the type of simulation requested."""
        
        prompt = f"""Classify this simulation request into one of these categories:
        
        Categories:
        - NEGOTIATION: M&A, diplomatic, labor, sales negotiations
        - VOTE: Congressional, board, shareholder, election votes
        - CRISIS: PR crisis, military crisis, financial crisis
        - MARKET: Product launch, competitive response, market entry
        - WARGAME: Military scenarios, geopolitical conflicts
        - POLICY: Regulatory, legislative, policy impact
        
        User request: "{user_input}"
        
        Return only the category name."""
        
        response = self.llm.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        
        return response.choices[0].message.content.strip()
    
    def _extract_entities(self, user_input: str) -> dict:
        """Extract all entities from the input."""
        
        prompt = f"""Extract all entities from this simulation request.
        
        Request: "{user_input}"
        
        Return JSON with:
        {{
            "actors": [
                {{"name": "...", "type": "person|organization|population", "role": "..."}}
            ],
            "events": [
                {{"name": "...", "type": "trigger|outcome|milestone", "description": "..."}}
            ],
            "constraints": [
                {{"name": "...", "type": "red_line|resource|procedural", "description": "..."}}
            ],
            "decisions": [
                {{"name": "...", "options": ["option1", "option2"], "owner": "actor_name"}}
            ]
        }}"""
        
        response = self.llm.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)
    
    def _extract_relationships(self, user_input: str, entities: dict) -> list[dict]:
        """Extract relationships between entities."""
        
        actor_names = [a["name"] for a in entities.get("actors", [])]
        
        prompt = f"""Given these actors: {actor_names}
        
        And this simulation request: "{user_input}"
        
        Extract the relationships between actors. Return JSON:
        {{
            "relationships": [
                {{
                    "source": "actor_name",
                    "target": "actor_name",
                    "type": "influences|opposes|allies_with|reports_to|depends_on",
                    "strength": 0.0-1.0
                }}
            ]
        }}"""
        
        response = self.llm.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)["relationships"]
    
    def _generate_nodes(self, entities: dict, sim_type: str) -> list[ParsedNode]:
        """Generate node specifications from extracted entities."""
        
        nodes = []
        
        # Generate actor nodes
        for actor in entities.get("actors", []):
            node_type = self._map_actor_type(actor["type"])
            nodes.append(ParsedNode(
                type=node_type,
                name=actor["name"],
                properties={"role": actor.get("role", "")},
                position=self._calculate_position(len(nodes))
            ))
        
        # Generate scenario node (always one)
        if entities.get("events"):
            trigger = next(
                (e for e in entities["events"] if e["type"] == "trigger"),
                entities["events"][0]
            )
            nodes.append(ParsedNode(
                type=NodeType.SCENARIO,
                name=trigger["name"],
                properties={"description": trigger["description"]},
                position=self._calculate_position(len(nodes))
            ))
        
        # Generate decision nodes
        for decision in entities.get("decisions", []):
            nodes.append(ParsedNode(
                type=NodeType.DECISION,
                name=decision["name"],
                properties={
                    "options": decision["options"],
                    "owner": decision["owner"]
                },
                position=self._calculate_position(len(nodes))
            ))
        
        # Generate constraint nodes
        for constraint in entities.get("constraints", []):
            nodes.append(ParsedNode(
                type=NodeType.CONSTRAINT,
                name=constraint["name"],
                properties={
                    "constraint_type": constraint["type"],
                    "description": constraint["description"]
                },
                position=self._calculate_position(len(nodes))
            ))
        
        # Always add output node
        nodes.append(ParsedNode(
            type=NodeType.OUTPUT,
            name="Simulation Output",
            properties={"output_type": self._default_output_for_sim_type(sim_type)},
            position=self._calculate_position(len(nodes))
        ))
        
        return nodes
    
    def _enrich_from_database(self, nodes: list[ParsedNode]) -> list[ParsedNode]:
        """Enrich nodes with data from entity database."""
        
        enriched = []
        for node in nodes:
            if node.type in [NodeType.ACTOR_VIP, NodeType.ACTOR_ARCHETYPE]:
                # Look up in persona database
                persona = self.entity_db.get_persona(node.name)
                if persona:
                    node.properties.update({
                        "persona": persona.to_dict(),
                        "source": "database"
                    })
                else:
                    # Generate persona on-the-fly
                    node.properties.update({
                        "persona": self._generate_persona(node.name, node.properties.get("role")),
                        "source": "generated"
                    })
            enriched.append(node)
        
        return enriched
    
    def _map_actor_type(self, type_str: str) -> NodeType:
        """Map string actor type to NodeType enum."""
        mapping = {
            "person": NodeType.ACTOR_VIP,
            "organization": NodeType.ACTOR_ORGANIZATION,
            "population": NodeType.ACTOR_POPULATION,
            "group": NodeType.ACTOR_ARCHETYPE
        }
        return mapping.get(type_str, NodeType.ACTOR_VIP)
    
    def _default_output_for_sim_type(self, sim_type: str) -> str:
        """Get default output type for simulation category."""
        mapping = {
            "NEGOTIATION": "deal_probability",
            "VOTE": "vote_count",
            "CRISIS": "timeline_projection",
            "MARKET": "market_share",
            "WARGAME": "escalation_ladder",
            "POLICY": "impact_distribution"
        }
        return mapping.get(sim_type, "probability_distribution")
```

---

## EXAMPLE: FULL PARSING FLOW

**User Input:**
> "Simulate how the Senate would vote on a TikTok ban if China announces retaliatory tariffs on US agricultural exports"

**Step 1: Classification**
```
Simulation Type: VOTE
```

**Step 2: Entity Extraction**
```json
{
    "actors": [
        {"name": "US Senate", "type": "organization", "role": "voting body"},
        {"name": "Senate Democrats", "type": "group", "role": "caucus"},
        {"name": "Senate Republicans", "type": "group", "role": "caucus"},
        {"name": "China", "type": "organization", "role": "retaliating party"},
        {"name": "US Agricultural Sector", "type": "population", "role": "affected constituency"}
    ],
    "events": [
        {"name": "TikTok Ban Vote", "type": "trigger", "description": "Senate votes on TikTok divestiture bill"},
        {"name": "China Tariff Retaliation", "type": "trigger", "description": "China announces tariffs on US agricultural exports"}
    ],
    "constraints": [
        {"name": "Filibuster Threshold", "type": "procedural", "description": "60 votes needed for cloture"},
        {"name": "Agricultural State Pressure", "type": "political", "description": "Senators from farm states face constituent pressure"}
    ],
    "decisions": [
        {"name": "Vote Decision", "options": ["YES", "NO", "ABSTAIN"], "owner": "Each Senator"}
    ]
}
```

**Step 3: Relationship Extraction**
```json
{
    "relationships": [
        {"source": "China", "target": "US Agricultural Sector", "type": "affects", "strength": 0.9},
        {"source": "US Agricultural Sector", "target": "Senate Democrats", "type": "pressures", "strength": 0.7},
        {"source": "US Agricultural Sector", "target": "Senate Republicans", "type": "pressures", "strength": 0.8},
        {"source": "Senate Democrats", "target": "Vote Decision", "type": "decides", "strength": 1.0},
        {"source": "Senate Republicans", "target": "Vote Decision", "type": "decides", "strength": 1.0}
    ]
}
```

**Step 4: Generated Node Graph**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│    ┌─────────┐                                                              │
│    │ 📋      │                                                              │
│    │ TikTok  │                                                              │
│    │ Ban Vote│                                                              │
│    └────┬────┘                                                              │
│         │                                                                   │
│         ▼                                                                   │
│    ┌─────────┐         ┌─────────┐                                          │
│    │ 🏢      │         │ 📋      │                                          │
│    │ China   │────────▶│ Tariff  │                                          │
│    │         │         │ Retaliat│                                          │
│    └─────────┘         └────┬────┘                                          │
│                             │                                               │
│                             ▼                                               │
│                        ┌─────────┐                                          │
│                        │ 👥      │                                          │
│                        │ US Ag   │                                          │
│                        │ Sector  │                                          │
│                        └────┬────┘                                          │
│                             │                                               │
│              ┌──────────────┼──────────────┐                                │
│              ▼              │              ▼                                │
│         ┌─────────┐        │         ┌─────────┐                            │
│         │ 👤      │        │         │ 👤      │                            │
│         │ Senate  │        │         │ Senate  │                            │
│         │ Dems    │        │         │ Repubs  │                            │
│         └────┬────┘        │         └────┬────┘                            │
│              │             │              │                                 │
│              └─────────────┼──────────────┘                                 │
│                            ▼                                                │
│                       ┌─────────┐                                           │
│                       │ ⚖️      │                                           │
│                       │ Vote    │                                           │
│                       │ Decision│                                           │
│                       └────┬────┘                                           │
│                            │                                                │
│         ┌──────────────────┼──────────────────┐                             │
│         ▼                  ▼                  ▼                             │
│    ┌─────────┐       ┌─────────┐       ┌─────────┐                          │
│    │ ⚠️      │       │ ⚠️      │       │ 📊      │                          │
│    │ Filibust│       │ Ag State│       │ Vote    │                          │
│    │ 60 votes│       │ Pressure│       │ Count   │                          │
│    └─────────┘       └─────────┘       └─────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## USER INTERACTION FLOWS

### Flow 1: Quick Simulation (No Editing)

```
User types query → [Generate Graph] → Auto-run simulation → View results
                         ↓
                   (5 seconds)
```

### Flow 2: Refined Simulation

```
User types query → [Generate Graph] → Click node to inspect → Edit parameters
                                              ↓
                                        Add new node
                                              ↓
                                        [Run Simulation]
                                              ↓
                                        Iterate on results
```

### Flow 3: Template-Based

```
User selects template (e.g., "Congressional Vote") → Pre-populated graph
                                                           ↓
                                                   Modify for specific case
                                                           ↓
                                                   [Run Simulation]
```

### Flow 4: Comparison Mode

```
Simulation A (baseline) → Branch to Simulation B (variant)
           ↓                         ↓
    [Run Both]             [Run Both]
           ↓                         ↓
         Compare results side-by-side
```

---

## SIMULATION TEMPLATES

### Template: Congressional Vote
```
Pre-populated nodes:
- 535 Member archetypes (grouped by party, state, committee)
- Bill/Resolution scenario
- Filibuster constraint (if Senate)
- Party leadership influence
- Lobbying pressure inputs
- Vote count output
```

### Template: M&A Negotiation
```
Pre-populated nodes:
- Buyer (organization + key decision makers)
- Seller (organization + key decision makers)
- Regulatory bodies
- Deal terms scenario
- BATNA constraints for each party
- Deal probability output
```

### Template: Taiwan Strait Crisis
```
Pre-populated nodes:
- Chinese leadership (Xi, CMC, PLA)
- US leadership (POTUS, NSC, INDOPACOM)
- Taiwan leadership
- Allied nations
- Escalation ladder decision tree
- Constraint: Nuclear threshold
- Output: Escalation probability by level
```

### Template: Product Launch
```
Pre-populated nodes:
- Consumer segments (early adopter, mainstream, etc.)
- Competitor organizations
- Media/influencer aggregate
- Launch scenario
- Price/feature constraints
- Output: Adoption curves, market share
```

---

## EXPORT FORMATS

### 1. Executive Brief (PDF)
```
- One-page summary
- Key probabilities
- Recommended actions
- Risk factors
```

### 2. Full Report (PDF/Word)
```
- Methodology description
- All agent reasoning
- Sensitivity analysis
- Detailed scenarios
```

### 3. Data Export (JSON/CSV)
```
- Raw probability distributions
- Agent-level decisions
- Monte Carlo run data
```

### 4. Interactive Dashboard (Web Link)
```
- Shareable URL
- Real-time what-if adjustment
- Drill-down capabilities
```

### 5. Presentation (PowerPoint)
```
- Scenario overview slide
- Key findings slides
- Detailed agent breakdown
- Q&A appendix
```
