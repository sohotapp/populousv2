# RLTX Few-Shot Workflow Patterns

## Overview

These are the **canonical patterns** that the composition system should use. When a question matches a pattern, use that pattern's structure exactly. Do not improvise.

---

## Pattern 1: Consumer Survey

### When to Use
- "Would customers buy X?"
- "What percent would Y?"
- "How do people feel about Z?"
- "Would you recommend X?"
- Any question asking about aggregate consumer opinion

### Structure
```
┌─────────────────┐
│ population      │
│ .sample         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ orchestrate     │
│ .monte_carlo    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│segment │ │factors │
└────────┘ └────────┘
```

### Full JSON Example

```json
{
  "interpretation": {
    "original_question": "Would customers subscribe to our service at $15/month?",
    "question_type": "consumer_survey",
    "key_entities": ["subscription service", "$15/month price point"],
    "assumptions": [
      "US adult consumers",
      "New product consideration (not existing customers)"
    ],
    "clarifications_needed": []
  },
  
  "workflow": {
    "name": "Subscription Intent Survey",
    "description": "Simulates consumer response to $15/month subscription pricing",
    
    "nodes": [
      {
        "id": "sample",
        "primitive": "population.sample",
        "name": "Sample US Consumers",
        "config": {
          "population_spec": {
            "base": "us_adults",
            "size": 10000
          },
          "strategy": "stratified"
        }
      },
      {
        "id": "simulate",
        "primitive": "orchestrate.monte_carlo",
        "name": "Purchase Intent Simulation",
        "config": {
          "question": "A company is offering a new subscription service for $15 per month. Given your needs, interests, and budget, would you subscribe?",
          "context": {
            "scenario": "You are considering whether to sign up for a new subscription service. The service costs $15 per month and provides [service description]. Consider your current spending on similar services and whether this fits your budget and needs."
          },
          "output_format": {
            "type": "categorical",
            "options": ["definitely_would", "probably_would", "might_or_might_not", "probably_would_not", "definitely_would_not"]
          },
          "reasoning_depth": "standard"
        }
      },
      {
        "id": "segment",
        "primitive": "population.segment",
        "name": "Segment Analysis",
        "config": {
          "segment_by": ["income_bracket", "age_group"],
          "bucketing": {
            "age": {
              "method": "custom",
              "boundaries": [18, 25, 35, 45, 55, 65]
            }
          }
        }
      },
      {
        "id": "factors",
        "primitive": "analyze.factors",
        "name": "Key Drivers Analysis",
        "config": {
          "analysis_type": "both"
        }
      }
    ],
    
    "edges": [
      {"from": "sample", "to": "simulate"},
      {"from": "simulate", "to": "segment"},
      {"from": "simulate", "to": "factors"}
    ]
  },
  
  "execution_plan": {
    "estimated_agents": 10000,
    "estimated_llm_calls": 10000,
    "parallelizable": true,
    "estimated_time_seconds": 120,
    "estimated_cost_usd": 15.00
  },
  
  "validation": {
    "required_inputs": [],
    "default_values": {},
    "warnings": []
  }
}
```

---

## Pattern 2: Price/Feature Change Impact

### When to Use
- "What if we raise/lower price by X%?"
- "What if we add/remove feature Y?"
- "Impact of changing X to Y"
- Any A/B comparison of a change vs. status quo

### Structure
```
                    ┌─────────────────┐
                    │ population      │
                    │ .sample         │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │ scenario   │ │ baseline   │ │ scenario   │
       │ (control)  │ │ monte_carlo│ │ (changed)  │
       └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
             │              │              │
             │              │              ▼
             │              │       ┌────────────┐
             │              │       │ changed    │
             │              │       │ monte_carlo│
             │              │       └─────┬──────┘
             │              │              │
             └──────────────┼──────────────┘
                            │
                            ▼
                     ┌────────────┐
                     │ branch     │
                     │ .compare   │
                     └─────┬──────┘
                           │
                           ▼
                     ┌────────────┐
                     │ analyze    │
                     │ .factors   │
                     └────────────┘
```

### Full JSON Example

```json
{
  "interpretation": {
    "original_question": "What happens to customer retention if we raise prices by 20%?",
    "question_type": "change_impact",
    "key_entities": ["20% price increase", "customer retention"],
    "assumptions": [
      "Existing customer base",
      "No other changes to product/service",
      "Competitors maintain current pricing"
    ],
    "clarifications_needed": [
      "Current price point?",
      "Any grandfathering for existing customers?"
    ]
  },
  
  "workflow": {
    "name": "Price Increase Retention Analysis",
    "description": "Compares customer retention at current price vs. 20% increase",
    
    "nodes": [
      {
        "id": "sample",
        "primitive": "population.sample",
        "name": "Sample Existing Customers",
        "config": {
          "population_spec": {
            "base": "existing_customers",
            "size": 10000
          },
          "strategy": "stratified"
        }
      },
      {
        "id": "scenario_control",
        "primitive": "branch.scenario",
        "name": "Control: Current Price",
        "config": {
          "scenario_name": "current_price",
          "description": "Status quo - no price change",
          "probability": 0.0,
          "modifications": {}
        }
      },
      {
        "id": "scenario_increase",
        "primitive": "branch.scenario",
        "name": "Treatment: Price Increase",
        "config": {
          "scenario_name": "price_increase_20pct",
          "description": "Price increases by 20%",
          "probability": 1.0,
          "modifications": {
            "context_changes": {
              "price_change": "+20%",
              "new_price": "{{current_price * 1.2}}"
            }
          }
        }
      },
      {
        "id": "sim_control",
        "primitive": "orchestrate.monte_carlo",
        "name": "Retention at Current Price",
        "config": {
          "question": "You are currently subscribed to [Service] at ${{current_price}}/month. The price will stay the same. Will you continue your subscription?",
          "context": {
            "scenario": "You've been a customer for [tenure]. Consider your satisfaction with the service and whether it's worth the current price to you."
          },
          "output_format": {
            "type": "binary",
            "options": ["continue", "cancel"]
          },
          "reasoning_depth": "standard"
        }
      },
      {
        "id": "sim_increase",
        "primitive": "orchestrate.monte_carlo",
        "name": "Retention at New Price",
        "config": {
          "question": "You are currently subscribed to [Service] at ${{current_price}}/month. The price will increase to ${{new_price}}/month (a 20% increase). Will you continue your subscription?",
          "context": {
            "scenario": "You've been a customer for [tenure]. Consider your satisfaction with the service and whether it's worth the new higher price to you."
          },
          "output_format": {
            "type": "binary",
            "options": ["continue", "cancel"]
          },
          "reasoning_depth": "standard"
        }
      },
      {
        "id": "compare",
        "primitive": "branch.compare",
        "name": "Compare Scenarios",
        "config": {
          "metrics": ["retention_rate", "churn_rate"],
          "calculate_lift": true
        }
      },
      {
        "id": "factors",
        "primitive": "analyze.factors",
        "name": "Churn Drivers Analysis",
        "config": {
          "analysis_type": "both",
          "focus_on": "cancel"
        }
      }
    ],
    
    "edges": [
      {"from": "sample", "to": "scenario_control"},
      {"from": "sample", "to": "scenario_increase"},
      {"from": "sample", "to": "sim_control"},
      {"from": "sample", "to": "sim_increase"},
      {"from": "scenario_control", "to": "sim_control"},
      {"from": "scenario_increase", "to": "sim_increase"},
      {"from": "sim_control", "to": "compare"},
      {"from": "sim_increase", "to": "compare"},
      {"from": "compare", "to": "factors"}
    ]
  },
  
  "execution_plan": {
    "estimated_agents": 20000,
    "estimated_llm_calls": 20000,
    "parallelizable": true,
    "estimated_time_seconds": 180,
    "estimated_cost_usd": 30.00
  },
  
  "validation": {
    "required_inputs": ["current_price"],
    "default_values": {
      "current_price": 39.99
    },
    "warnings": [
      "Consider also modeling competitive response scenarios"
    ]
  }
}
```

---

## Pattern 3: Competitive Response

### When to Use
- "What will competitor do if we X?"
- "How will the market respond?"
- "Competitive dynamics of X"
- Any question involving strategic actors + consumer response

### Structure
```
┌─────────────────┐     ┌─────────────────┐
│ agent.create    │     │ agent.create    │
│ (our company)   │     │ (competitor)    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
              ┌─────────────────┐
              │ orchestrate     │
              │ .game_theory    │
              └────────┬────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ scenario │  │ scenario │  │ scenario │
   │ (match)  │  │ (hold)   │  │ (undercut│
   └────┬─────┘  └────┬─────┘  └────┬─────┘
        │             │             │
        ▼             ▼             ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ consumer │  │ consumer │  │ consumer │
   │ MC       │  │ MC       │  │ MC       │
   └────┬─────┘  └────┬─────┘  └────┬─────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
                      ▼
               ┌─────────────┐
               │ branch.merge│
               └──────┬──────┘
                      │
                      ▼
               ┌─────────────┐
               │ analyze     │
               │ .factors    │
               └─────────────┘
```

### Full JSON Example

```json
{
  "interpretation": {
    "original_question": "What happens if we raise prices by 20%? Will competitors match or try to steal customers?",
    "question_type": "competitive_response",
    "key_entities": ["20% price increase", "competitor response", "customer retention"],
    "assumptions": [
      "One primary competitor",
      "Competitor is aware of our pricing",
      "Consumers have choice between us and competitor"
    ],
    "clarifications_needed": [
      "Specific competitor to model?",
      "Current market share split?"
    ]
  },
  
  "workflow": {
    "name": "Competitive Pricing Analysis",
    "description": "Models competitor response to price increase and resulting consumer impact",
    
    "nodes": [
      {
        "id": "create_us",
        "primitive": "agent.create",
        "name": "Create Our Company",
        "config": {
          "name": "Our Company",
          "traits": {
            "role": "market_leader",
            "market_share": 0.55,
            "brand_strength": "strong",
            "cost_structure": "efficient"
          },
          "objectives": [
            "Increase revenue per customer",
            "Maintain market share above 50%",
            "Improve profit margins"
          ],
          "constraints": [
            "Board expects revenue growth",
            "Cannot appear to be gouging customers"
          ],
          "information": "Implementing 20% price increase next quarter"
        }
      },
      {
        "id": "create_competitor",
        "primitive": "agent.create",
        "name": "Create Competitor",
        "config": {
          "name": "Main Competitor",
          "traits": {
            "role": "challenger",
            "market_share": 0.30,
            "brand_strength": "growing",
            "cost_structure": "lean_aggressive"
          },
          "objectives": [
            "Grow market share to 40%",
            "Establish as viable alternative",
            "Maintain profitability"
          ],
          "constraints": [
            "Smaller marketing budget",
            "Less brand recognition",
            "Investors expect growth"
          ],
          "information": "Aware that market leader is raising prices 20%"
        }
      },
      {
        "id": "game",
        "primitive": "orchestrate.game_theory",
        "name": "Competitive Dynamics",
        "config": {
          "game_type": "sequential",
          "move_order": ["Our Company", "Main Competitor"],
          "max_iterations": 3,
          "convergence_threshold": 0.1,
          "payoffs": {
            "description": "Market share and profitability tradeoff"
          }
        }
      },
      {
        "id": "sample_consumers",
        "primitive": "population.sample",
        "name": "Sample Consumers",
        "config": {
          "population_spec": {
            "base": "existing_customers",
            "size": 10000
          },
          "strategy": "stratified"
        }
      },
      {
        "id": "scenario_match",
        "primitive": "branch.scenario",
        "name": "Competitor Matches Price",
        "config": {
          "scenario_name": "competitor_matches",
          "description": "Competitor also raises prices by ~20%",
          "probability": 0.35,
          "modifications": {
            "context_changes": {
              "competitor_action": "price_increase",
              "competitor_price_change": "+18%",
              "price_gap": "similar"
            }
          }
        }
      },
      {
        "id": "scenario_hold",
        "primitive": "branch.scenario",
        "name": "Competitor Holds Price",
        "config": {
          "scenario_name": "competitor_holds",
          "description": "Competitor maintains current pricing",
          "probability": 0.40,
          "modifications": {
            "context_changes": {
              "competitor_action": "hold_price",
              "competitor_price_change": "0%",
              "price_gap": "widened_20pct"
            }
          }
        }
      },
      {
        "id": "scenario_undercut",
        "primitive": "branch.scenario",
        "name": "Competitor Undercuts",
        "config": {
          "scenario_name": "competitor_undercuts",
          "description": "Competitor lowers prices to steal share",
          "probability": 0.25,
          "modifications": {
            "context_changes": {
              "competitor_action": "price_decrease",
              "competitor_price_change": "-10%",
              "price_gap": "widened_30pct"
            }
          }
        }
      },
      {
        "id": "sim_match",
        "primitive": "orchestrate.monte_carlo",
        "name": "Consumer Response - Match",
        "config": {
          "question": "Your current provider (Company A) is raising prices by 20%. Their main competitor (Company B) is also raising prices by a similar amount. Would you stay with Company A, switch to Company B, or cancel both?",
          "context": {
            "scenario": "Both companies now cost about the same, roughly 20% more than before. Consider your satisfaction, switching costs, and whether the service is still worth the new price."
          },
          "output_format": {
            "type": "categorical",
            "options": ["stay_with_a", "switch_to_b", "cancel_both"]
          },
          "reasoning_depth": "standard"
        }
      },
      {
        "id": "sim_hold",
        "primitive": "orchestrate.monte_carlo",
        "name": "Consumer Response - Hold",
        "config": {
          "question": "Your current provider (Company A) is raising prices by 20%. Their competitor (Company B) is keeping prices the same, making them now 20% cheaper. Would you stay with Company A, switch to Company B, or cancel both?",
          "context": {
            "scenario": "Company A will now cost 20% more than Company B. Consider your satisfaction with A, the savings from switching to B, and any switching costs."
          },
          "output_format": {
            "type": "categorical",
            "options": ["stay_with_a", "switch_to_b", "cancel_both"]
          },
          "reasoning_depth": "standard"
        }
      },
      {
        "id": "sim_undercut",
        "primitive": "orchestrate.monte_carlo",
        "name": "Consumer Response - Undercut",
        "config": {
          "question": "Your current provider (Company A) is raising prices by 20%. Their competitor (Company B) is actually lowering prices by 10%, making them now 30% cheaper than A. Would you stay with Company A, switch to Company B, or cancel both?",
          "context": {
            "scenario": "Company A will now cost 30% more than Company B. This is a significant price difference. Consider your loyalty to A, the substantial savings from B, and switching costs."
          },
          "output_format": {
            "type": "categorical",
            "options": ["stay_with_a", "switch_to_b", "cancel_both"]
          },
          "reasoning_depth": "standard"
        }
      },
      {
        "id": "merge",
        "primitive": "branch.merge",
        "name": "Merge Scenario Results",
        "config": {
          "merge_strategy": "weighted_average"
        }
      },
      {
        "id": "factors",
        "primitive": "analyze.factors",
        "name": "Key Drivers Analysis",
        "config": {
          "analysis_type": "both"
        }
      }
    ],
    
    "edges": [
      {"from": "create_us", "to": "game"},
      {"from": "create_competitor", "to": "game"},
      {"from": "game", "to": "scenario_match", "output_mapping": {"competitor_strategy": "probability"}},
      {"from": "game", "to": "scenario_hold", "output_mapping": {"competitor_strategy": "probability"}},
      {"from": "game", "to": "scenario_undercut", "output_mapping": {"competitor_strategy": "probability"}},
      {"from": "sample_consumers", "to": "sim_match"},
      {"from": "sample_consumers", "to": "sim_hold"},
      {"from": "sample_consumers", "to": "sim_undercut"},
      {"from": "scenario_match", "to": "sim_match"},
      {"from": "scenario_hold", "to": "sim_hold"},
      {"from": "scenario_undercut", "to": "sim_undercut"},
      {"from": "sim_match", "to": "merge"},
      {"from": "sim_hold", "to": "merge"},
      {"from": "sim_undercut", "to": "merge"},
      {"from": "merge", "to": "factors"}
    ]
  },
  
  "execution_plan": {
    "estimated_agents": 30000,
    "estimated_llm_calls": 30010,
    "parallelizable": true,
    "estimated_time_seconds": 240,
    "estimated_cost_usd": 50.00
  },
  
  "validation": {
    "required_inputs": ["current_price", "competitor_current_price"],
    "default_values": {
      "current_price": 49.99,
      "competitor_current_price": 44.99
    },
    "warnings": [
      "Game theory probabilities will override scenario probabilities"
    ]
  }
}
```

---

## Pattern 4: Wargame / Adversarial

### When to Use
- "How would [adversary] respond to [action]?"
- "What's the escalation risk of X?"
- "Strategic options against Y"
- Defense and geopolitical scenarios

### Structure
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ agent.create    │  │ agent.create    │  │ agent.create    │
│ (blue/us)       │  │ (red/adversary) │  │ (gray/neutral)  │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ orchestrate     │
                    │ .game_theory    │
                    │ (multi-round)   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌───────────┐  ┌───────────┐  ┌───────────┐
       │ analyze   │  │ analyze   │  │ analyze   │
       │ .sensitiv │  │ .uncert   │  │ .factors  │
       └───────────┘  └───────────┘  └───────────┘
```

### Full JSON Example

```json
{
  "interpretation": {
    "original_question": "How would China respond if we increased Taiwan semiconductor export restrictions?",
    "question_type": "wargame",
    "key_entities": ["China", "Taiwan", "semiconductor exports", "US restrictions"],
    "assumptions": [
      "Current geopolitical context (2024)",
      "China prioritizes economic stability and territorial claims",
      "US prioritizes alliance relationships and tech leadership"
    ],
    "clarifications_needed": [
      "Scope of restrictions?",
      "Timeframe for analysis?"
    ]
  },
  
  "workflow": {
    "name": "Taiwan Semiconductor Restriction Wargame",
    "description": "Models Chinese response to increased semiconductor export restrictions",
    
    "nodes": [
      {
        "id": "create_blue",
        "primitive": "agent.create",
        "name": "Create US/Blue",
        "config": {
          "name": "United States",
          "traits": {
            "role": "status_quo_power",
            "alliance_network": "extensive",
            "economic_leverage": "high",
            "military_posture": "forward_deployed"
          },
          "objectives": [
            "Maintain technological superiority",
            "Strengthen Taiwan's resilience",
            "Avoid direct military conflict",
            "Maintain alliance cohesion"
          ],
          "constraints": [
            "Domestic political pressure",
            "Economic interdependence with China",
            "Alliance partner concerns about escalation"
          ],
          "information": "Considering expanded semiconductor export restrictions on Taiwan-China trade"
        }
      },
      {
        "id": "create_red",
        "primitive": "agent.create",
        "name": "Create China/Red",
        "config": {
          "name": "People's Republic of China",
          "traits": {
            "role": "revisionist_power",
            "economic_model": "state_capitalist",
            "military_modernization": "rapid",
            "domestic_legitimacy": "performance_based"
          },
          "objectives": [
            "Reunification with Taiwan (long-term)",
            "Maintain economic growth",
            "Reduce technological dependence on West",
            "Avoid regime-threatening instability"
          ],
          "constraints": [
            "Economic interdependence with US/West",
            "Military gap with US (narrowing)",
            "Domestic expectations of strength",
            "International reputation concerns"
          ],
          "information": "US is considering expanded semiconductor restrictions"
        }
      },
      {
        "id": "create_gray",
        "primitive": "agent.create",
        "name": "Create Taiwan/Gray",
        "config": {
          "name": "Taiwan",
          "traits": {
            "role": "contested_territory",
            "economic_importance": "critical_semiconductors",
            "military_capability": "defensive",
            "political_stance": "status_quo"
          },
          "objectives": [
            "Maintain de facto independence",
            "Economic prosperity",
            "Avoid military conflict",
            "Strengthen international ties"
          ],
          "constraints": [
            "Military asymmetry with China",
            "Economic ties with both US and China",
            "Limited international recognition"
          ],
          "information": "Caught between US and China on semiconductor policy"
        }
      },
      {
        "id": "game",
        "primitive": "orchestrate.game_theory",
        "name": "Strategic Interaction",
        "config": {
          "game_type": "sequential",
          "move_order": ["United States", "People's Republic of China", "Taiwan"],
          "max_iterations": 5,
          "convergence_threshold": 0.2,
          "initial_state": {
            "us_action": "expanded_semiconductor_restrictions",
            "escalation_level": 2,
            "international_attention": "high"
          }
        }
      },
      {
        "id": "sensitivity",
        "primitive": "analyze.sensitivity",
        "name": "Sensitivity Analysis",
        "config": {
          "parameters_to_vary": [
            {
              "parameter": "restriction_scope",
              "variations": ["narrow", "moderate", "comprehensive"]
            },
            {
              "parameter": "china_economic_conditions",
              "variations": ["strong", "moderate", "weak"]
            }
          ],
          "method": "estimate"
        }
      },
      {
        "id": "uncertainty",
        "primitive": "analyze.uncertainty",
        "name": "Uncertainty Analysis",
        "config": {}
      },
      {
        "id": "factors",
        "primitive": "analyze.factors",
        "name": "Key Factors",
        "config": {
          "analysis_type": "both"
        }
      }
    ],
    
    "edges": [
      {"from": "create_blue", "to": "game"},
      {"from": "create_red", "to": "game"},
      {"from": "create_gray", "to": "game"},
      {"from": "game", "to": "sensitivity"},
      {"from": "game", "to": "uncertainty"},
      {"from": "game", "to": "factors"}
    ]
  },
  
  "execution_plan": {
    "estimated_agents": 3,
    "estimated_llm_calls": 50,
    "parallelizable": false,
    "estimated_time_seconds": 300,
    "estimated_cost_usd": 25.00
  },
  
  "validation": {
    "required_inputs": ["restriction_scope"],
    "default_values": {
      "restriction_scope": "moderate"
    },
    "warnings": [
      "Wargame results are highly sensitive to actor objective specifications",
      "Consider running multiple iterations with varied assumptions"
    ]
  }
}
```

---

## Pattern 5: Opinion/Information Spread

### When to Use
- "How will this news spread?"
- "What's the adoption curve for X?"
- "How does sentiment evolve?"
- Any question about dynamics over time

### Structure
```
┌─────────────────┐
│ population      │
│ .sample         │
│ (with network)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ orchestrate     │
│ .abm            │
│ (multi-step)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ analyze         │
│ .factors        │
└─────────────────┘
```

### Full JSON Example

```json
{
  "interpretation": {
    "original_question": "How quickly would negative news about our product spread through social networks?",
    "question_type": "dynamics",
    "key_entities": ["negative news", "social spread", "brand impact"],
    "assumptions": [
      "News starts with small seed group",
      "Spread through social connections",
      "People share based on personal relevance"
    ],
    "clarifications_needed": [
      "Type of negative news?",
      "Initial seed size?"
    ]
  },
  
  "workflow": {
    "name": "News Spread Simulation",
    "description": "Models how negative product news spreads through population over time",
    
    "nodes": [
      {
        "id": "sample",
        "primitive": "population.sample",
        "name": "Sample Population with Network",
        "config": {
          "population_spec": {
            "base": "us_adults",
            "size": 5000
          },
          "strategy": "stratified",
          "network": {
            "type": "small_world",
            "params": {
              "k": 6,
              "p": 0.1
            }
          }
        }
      },
      {
        "id": "abm",
        "primitive": "orchestrate.abm",
        "name": "News Spread Simulation",
        "config": {
          "environment": {
            "initial_state": {
              "news_content": "Product found to have quality issues affecting 5% of units",
              "news_severity": "moderate",
              "company_response": "none_yet"
            },
            "globals": {
              "media_amplification": 0.3,
              "time_decay": 0.1
            }
          },
          "agent_step": {
            "perception": {
              "sees_neighbors": true,
              "sees_globals": true,
              "perception_radius": 2
            },
            "decision_question": "Some of your social connections are sharing news about a product quality issue. Based on your relationship with the brand, your social influences, and the nature of the news, will you: (a) share the news with your network, (b) engage but not share, (c) ignore it?",
            "action_effects": {
              "type": "broadcast",
              "description": "If share, news reaches all connections"
            }
          },
          "timesteps": 20,
          "stop_conditions": [
            {
              "condition": "saturation",
              "threshold": 0.8
            }
          ],
          "agent_activation": "random_subset",
          "activation_rate": 0.3
        }
      },
      {
        "id": "factors",
        "primitive": "analyze.factors",
        "name": "Spread Drivers Analysis",
        "config": {
          "analysis_type": "both"
        }
      }
    ],
    
    "edges": [
      {"from": "sample", "to": "abm"},
      {"from": "abm", "to": "factors"}
    ]
  },
  
  "execution_plan": {
    "estimated_agents": 5000,
    "estimated_llm_calls": 30000,
    "parallelizable": true,
    "estimated_time_seconds": 600,
    "estimated_cost_usd": 45.00
  },
  
  "validation": {
    "required_inputs": ["news_content", "seed_size"],
    "default_values": {
      "seed_size": 50
    },
    "warnings": [
      "ABM results are sensitive to network structure",
      "Consider running multiple seeds for robustness"
    ]
  }
}
```

---

## Pattern 6: Multi-Scenario Comparison

### When to Use
- "Compare options A, B, and C"
- "What's the best approach among X, Y, Z?"
- "Scenario planning for multiple futures"

### Full JSON Example

```json
{
  "interpretation": {
    "original_question": "Should we launch at $9.99, $14.99, or $19.99?",
    "question_type": "counterfactual",
    "key_entities": ["$9.99 price", "$14.99 price", "$19.99 price", "launch decision"],
    "assumptions": [
      "Same product at each price point",
      "No competitor response modeled",
      "US consumer market"
    ],
    "clarifications_needed": []
  },
  
  "workflow": {
    "name": "Price Point Comparison",
    "description": "Compares consumer response across three price points",
    
    "nodes": [
      {
        "id": "sample",
        "primitive": "population.sample",
        "name": "Sample Consumers",
        "config": {
          "population_spec": {
            "base": "us_adults",
            "size": 10000
          },
          "strategy": "stratified"
        }
      },
      {
        "id": "scenario_low",
        "primitive": "branch.scenario",
        "name": "Low Price: $9.99",
        "config": {
          "scenario_name": "price_9_99",
          "description": "Launch at $9.99/month",
          "probability": 0.33,
          "modifications": {
            "context_changes": {
              "price": 9.99,
              "positioning": "value"
            }
          }
        }
      },
      {
        "id": "scenario_mid",
        "primitive": "branch.scenario",
        "name": "Mid Price: $14.99",
        "config": {
          "scenario_name": "price_14_99",
          "description": "Launch at $14.99/month",
          "probability": 0.34,
          "modifications": {
            "context_changes": {
              "price": 14.99,
              "positioning": "balanced"
            }
          }
        }
      },
      {
        "id": "scenario_high",
        "primitive": "branch.scenario",
        "name": "High Price: $19.99",
        "config": {
          "scenario_name": "price_19_99",
          "description": "Launch at $19.99/month",
          "probability": 0.33,
          "modifications": {
            "context_changes": {
              "price": 19.99,
              "positioning": "premium"
            }
          }
        }
      },
      {
        "id": "sim_low",
        "primitive": "orchestrate.monte_carlo",
        "name": "Response at $9.99",
        "config": {
          "question": "A new subscription service is launching at $9.99/month. Would you subscribe?",
          "output_format": {
            "type": "categorical",
            "options": ["definitely_yes", "probably_yes", "maybe", "probably_no", "definitely_no"]
          },
          "reasoning_depth": "standard"
        }
      },
      {
        "id": "sim_mid",
        "primitive": "orchestrate.monte_carlo",
        "name": "Response at $14.99",
        "config": {
          "question": "A new subscription service is launching at $14.99/month. Would you subscribe?",
          "output_format": {
            "type": "categorical",
            "options": ["definitely_yes", "probably_yes", "maybe", "probably_no", "definitely_no"]
          },
          "reasoning_depth": "standard"
        }
      },
      {
        "id": "sim_high",
        "primitive": "orchestrate.monte_carlo",
        "name": "Response at $19.99",
        "config": {
          "question": "A new subscription service is launching at $19.99/month. Would you subscribe?",
          "output_format": {
            "type": "categorical",
            "options": ["definitely_yes", "probably_yes", "maybe", "probably_no", "definitely_no"]
          },
          "reasoning_depth": "standard"
        }
      },
      {
        "id": "compare",
        "primitive": "branch.compare",
        "name": "Compare Price Points",
        "config": {
          "metrics": [
            "conversion_rate",
            "revenue_per_100_prospects",
            "definitely_yes_rate"
          ],
          "calculate_lift": true
        }
      },
      {
        "id": "factors",
        "primitive": "analyze.factors",
        "name": "Decision Drivers",
        "config": {
          "analysis_type": "both"
        }
      }
    ],
    
    "edges": [
      {"from": "sample", "to": "scenario_low"},
      {"from": "sample", "to": "scenario_mid"},
      {"from": "sample", "to": "scenario_high"},
      {"from": "scenario_low", "to": "sim_low"},
      {"from": "scenario_mid", "to": "sim_mid"},
      {"from": "scenario_high", "to": "sim_high"},
      {"from": "sample", "to": "sim_low"},
      {"from": "sample", "to": "sim_mid"},
      {"from": "sample", "to": "sim_high"},
      {"from": "sim_low", "to": "compare"},
      {"from": "sim_mid", "to": "compare"},
      {"from": "sim_high", "to": "compare"},
      {"from": "compare", "to": "factors"}
    ]
  },
  
  "execution_plan": {
    "estimated_agents": 30000,
    "estimated_llm_calls": 30000,
    "parallelizable": true,
    "estimated_time_seconds": 200,
    "estimated_cost_usd": 45.00
  },
  
  "validation": {
    "required_inputs": [],
    "default_values": {},
    "warnings": []
  }
}
```

---

## Pattern Selection Logic

```typescript
function selectPattern(question: string, context: any): PatternType {
  const q = question.toLowerCase();
  
  // Check for competitive keywords
  if (q.includes('competitor') || q.includes('competition') || 
      q.includes('rival') || q.includes('market response')) {
    return 'competitive_response';
  }
  
  // Check for wargame keywords
  if (q.includes('adversary') || q.includes('country') || 
      q.includes('military') || q.includes('escalat') ||
      q.includes('geopolit') || q.includes('sanction')) {
    return 'wargame';
  }
  
  // Check for dynamics keywords
  if (q.includes('spread') || q.includes('viral') || 
      q.includes('adoption') || q.includes('over time') ||
      q.includes('evolve') || q.includes('dynamic')) {
    return 'dynamics';
  }
  
  // Check for comparison keywords
  if (q.includes('compare') || q.includes('vs') || 
      q.includes('versus') || q.includes('or') ||
      (q.includes('option') && q.includes('best'))) {
    return 'counterfactual';
  }
  
  // Check for change impact keywords
  if (q.includes('what if') || q.includes('what happens') ||
      q.includes('impact of') || q.includes('effect of') ||
      q.includes('change') || q.includes('increase') || 
      q.includes('decrease')) {
    return 'change_impact';
  }
  
  // Default to consumer survey
  return 'consumer_survey';
}
```

---

## Composition Validation Rules

After generating a workflow, validate:

1. **All required nodes present**
   ```typescript
   const requiredByPattern = {
     'consumer_survey': ['population.sample', 'orchestrate.monte_carlo', 'analyze.factors'],
     'change_impact': ['population.sample', 'branch.scenario', 'orchestrate.monte_carlo', 'branch.compare'],
     'competitive_response': ['agent.create', 'orchestrate.game_theory', 'population.sample', 'orchestrate.monte_carlo'],
     'wargame': ['agent.create', 'orchestrate.game_theory'],
     'dynamics': ['population.sample', 'orchestrate.abm'],
     'counterfactual': ['population.sample', 'branch.scenario', 'orchestrate.monte_carlo', 'branch.compare'],
   };
   ```

2. **Edges form valid DAG**
   - No cycles
   - All referenced nodes exist
   - Data types flow correctly

3. **Configs are complete**
   - Required fields present
   - Output formats specified
   - Reasonable defaults applied

4. **Resource estimates reasonable**
   - Agents × calls ≈ estimated_llm_calls
   - Time estimate matches parallelization
   - Cost estimate matches model selection
