import { NextRequest, NextResponse } from "next/server";
import type { PopulationIndex } from "@/stores/sources";

// In-memory storage (would be database in production)
const populationsStore: Map<string, PopulationIndex[]> = new Map();

// GET /api/sources/[id]/populations - List populations for a source
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const populations = populationsStore.get(id) || [];
  return NextResponse.json(populations);
}

// POST /api/sources/[id]/populations - Build a new population index
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { streamName, name, filters } = body;

    if (!streamName || !name) {
      return NextResponse.json(
        { error: "Stream name and population name are required" },
        { status: 400 }
      );
    }

    // Simulate population building
    // In production, this would transform data through mappings and build index
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const totalRecords = Math.floor(Math.random() * 5000) + 1000;
    const completeRecords = Math.floor(totalRecords * 0.85);

    const population: PopulationIndex = {
      id: `pop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sourceId: id,
      streamName,
      name,
      description: `Population built from ${streamName}`,
      distributions: {
        age: {
          "18-24": { count: Math.floor(completeRecords * 0.12), percentage: 0.12 },
          "25-34": { count: Math.floor(completeRecords * 0.28), percentage: 0.28 },
          "35-44": { count: Math.floor(completeRecords * 0.25), percentage: 0.25 },
          "45-54": { count: Math.floor(completeRecords * 0.20), percentage: 0.20 },
          "55-64": { count: Math.floor(completeRecords * 0.10), percentage: 0.10 },
          "65+": { count: Math.floor(completeRecords * 0.05), percentage: 0.05 },
        },
        income_bracket: {
          low: { count: Math.floor(completeRecords * 0.20), percentage: 0.20 },
          medium: { count: Math.floor(completeRecords * 0.45), percentage: 0.45 },
          high: { count: Math.floor(completeRecords * 0.25), percentage: 0.25 },
          affluent: { count: Math.floor(completeRecords * 0.10), percentage: 0.10 },
        },
        location_type: {
          urban: { count: Math.floor(completeRecords * 0.55), percentage: 0.55 },
          suburban: { count: Math.floor(completeRecords * 0.35), percentage: 0.35 },
          rural: { count: Math.floor(completeRecords * 0.10), percentage: 0.10 },
        },
      },
      segments: [
        {
          name: "Young Professionals",
          criteria: { age: "25-34", income_bracket: "medium" },
          count: Math.floor(completeRecords * 0.15),
          percentage: 0.15,
        },
        {
          name: "High-Value Enterprise",
          criteria: { income_bracket: "affluent" },
          count: Math.floor(completeRecords * 0.10),
          percentage: 0.10,
        },
        {
          name: "Urban Tech Workers",
          criteria: { location_type: "urban", occupation: "tech" },
          count: Math.floor(completeRecords * 0.12),
          percentage: 0.12,
        },
      ],
      totalRecords,
      completeRecords,
      traitCoverage: {
        age: 0.95,
        income_bracket: 0.78,
        occupation: 0.92,
        location_name: 0.88,
        location_type: 0.85,
        gender: 0.65,
        education: 0.45,
      },
      status: "ready",
      builtAt: new Date().toISOString(),
    };

    // Store population
    const existing = populationsStore.get(id) || [];
    populationsStore.set(id, [...existing, population]);

    return NextResponse.json(population);
  } catch (error) {
    console.error("Error building population:", error);
    return NextResponse.json(
      { error: "Failed to build population" },
      { status: 500 }
    );
  }
}
