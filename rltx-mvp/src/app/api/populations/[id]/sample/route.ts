import { NextRequest, NextResponse } from "next/server";
import type { IndexedAgent } from "@/stores/sources";
import type { AgentTraits } from "@/db/schema";

// Sample names for realistic agent generation
const FIRST_NAMES = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Christopher", "Karen"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"];
const CITIES = [
  { name: "New York, NY", type: "urban" },
  { name: "Los Angeles, CA", type: "urban" },
  { name: "Chicago, IL", type: "urban" },
  { name: "Houston, TX", type: "urban" },
  { name: "Phoenix, AZ", type: "suburban" },
  { name: "Philadelphia, PA", type: "urban" },
  { name: "San Antonio, TX", type: "suburban" },
  { name: "San Diego, CA", type: "suburban" },
  { name: "Dallas, TX", type: "urban" },
  { name: "Austin, TX", type: "urban" },
  { name: "Denver, CO", type: "suburban" },
  { name: "Seattle, WA", type: "urban" },
  { name: "Portland, OR", type: "urban" },
  { name: "Nashville, TN", type: "suburban" },
  { name: "Boise, ID", type: "suburban" },
  { name: "Burlington, VT", type: "rural" },
  { name: "Fargo, ND", type: "rural" },
  { name: "Billings, MT", type: "rural" },
];
const OCCUPATIONS = [
  "Software Engineer", "Marketing Manager", "Sales Representative", "Product Manager",
  "Data Analyst", "Financial Advisor", "Project Manager", "UX Designer",
  "Account Executive", "Operations Manager", "HR Specialist", "Business Analyst",
  "Customer Success Manager", "Content Writer", "Graphic Designer", "IT Administrator",
];
const EDUCATION_LEVELS: AgentTraits["education"][] = ["high_school", "some_college", "bachelors", "graduate", "doctorate"];
const GENDERS: AgentTraits["gender"][] = ["male", "female", "non-binary"];
const VALUES = ["career", "family", "health", "wealth", "adventure", "security", "creativity", "community", "independence", "learning"];

// GET /api/populations/[id]/sample - Sample agents from a population
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const count = parseInt(url.searchParams.get("count") || "10", 10);

  try {
    const agents: IndexedAgent[] = [];

    for (let i = 0; i < Math.min(count, 100); i++) {
      const city = CITIES[Math.floor(Math.random() * CITIES.length)];
      const age = Math.floor(Math.random() * 47) + 18; // 18-65
      const income = Math.floor(Math.random() * 180000) + 30000; // $30k - $210k

      const traits: AgentTraits = {
        age,
        gender: GENDERS[Math.floor(Math.random() * GENDERS.length)],
        income,
        income_bracket: income < 50000 ? "low" : income < 100000 ? "medium" : income < 200000 ? "high" : "affluent",
        education: EDUCATION_LEVELS[Math.floor(Math.random() * EDUCATION_LEVELS.length)],
        occupation: OCCUPATIONS[Math.floor(Math.random() * OCCUPATIONS.length)],
        location_type: city.type as AgentTraits["location_type"],
        location_name: city.name,
        household_composition: Math.random() > 0.5 ? "family" : "single",
        values: VALUES.sort(() => Math.random() - 0.5).slice(0, 3),
        risk_tolerance: Math.random(),
        price_sensitivity: Math.random(),
        brand_loyalty: Math.random(),
        information_seeking: Math.random(),
      };

      agents.push({
        id: `agent_${id}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        populationId: id,
        traits,
        traitCompleteness: 0.85 + Math.random() * 0.15,
      });
    }

    return NextResponse.json(agents);
  } catch (error) {
    console.error("Error sampling agents:", error);
    return NextResponse.json(
      { error: "Failed to sample agents" },
      { status: 500 }
    );
  }
}
