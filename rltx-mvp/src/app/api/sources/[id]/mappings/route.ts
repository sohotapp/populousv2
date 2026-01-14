import { NextRequest, NextResponse } from "next/server";
import type { FieldMapping } from "@/stores/sources";
import { RLTX_TRAITS, TRANSFORM_TYPES } from "@/stores/sources";

// In-memory storage for mappings (would be database in production)
const mappingsStore: Map<string, FieldMapping[]> = new Map();

// GET /api/sources/[id]/mappings - Get mappings for a source/stream
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const streamName = url.searchParams.get("stream");

  if (!streamName) {
    return NextResponse.json(
      { error: "Stream name is required" },
      { status: 400 }
    );
  }

  const key = `${id}:${streamName}`;
  const mappings = mappingsStore.get(key) || [];

  return NextResponse.json(mappings);
}

// PUT /api/sources/[id]/mappings - Save mappings for a source/stream
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { streamName, mappings } = body;

    if (!streamName || !mappings) {
      return NextResponse.json(
        { error: "Stream name and mappings are required" },
        { status: 400 }
      );
    }

    // Validate mappings
    const validatedMappings = mappings.map((m: FieldMapping) => ({
      ...m,
      id: m.id || `map_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sourceId: id,
      streamName,
      userConfirmed: true,
      updatedAt: new Date().toISOString(),
    }));

    const key = `${id}:${streamName}`;
    mappingsStore.set(key, validatedMappings);

    return NextResponse.json({ success: true, mappings: validatedMappings });
  } catch (error) {
    console.error("Error saving mappings:", error);
    return NextResponse.json(
      { error: "Failed to save mappings" },
      { status: 500 }
    );
  }
}

// POST /api/sources/[id]/mappings/suggest - AI-suggest mappings
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { streamName, fields } = body;

    // Simulate AI mapping suggestion
    // In production, this would use Claude or embeddings to match fields
    const suggestedMappings: FieldMapping[] = [];

    for (const field of fields || []) {
      // Check if field has pre-suggested mapping
      if (field.suggestedTrait) {
        suggestedMappings.push({
          id: `map_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          sourceId: id,
          streamName,
          sourceField: field.name,
          targetTrait: field.suggestedTrait,
          transformType: field.suggestedTransform || "direct",
          matchMethod: "semantic",
          confidence: field.confidence || 0.8,
          userConfirmed: false,
        });
        continue;
      }

      // Try to match by field name similarity
      const fieldLower = field.name.toLowerCase().replace(/_/g, "");

      // Age detection
      if (fieldLower.includes("birth") || fieldLower.includes("dob") || fieldLower === "age") {
        suggestedMappings.push({
          id: `map_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          sourceId: id,
          streamName,
          sourceField: field.name,
          targetTrait: "age",
          transformType: field.type === "date" ? "date_to_age" : "direct",
          matchMethod: "fuzzy",
          confidence: 0.85,
          userConfirmed: false,
        });
        continue;
      }

      // Location detection
      if (fieldLower.includes("city") || fieldLower.includes("location") || fieldLower.includes("metro")) {
        suggestedMappings.push({
          id: `map_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          sourceId: id,
          streamName,
          sourceField: field.name,
          targetTrait: "location_name",
          transformType: "direct",
          matchMethod: "fuzzy",
          confidence: 0.8,
          userConfirmed: false,
        });
        continue;
      }

      // Occupation detection
      if (fieldLower.includes("title") || fieldLower.includes("job") || fieldLower.includes("role") || fieldLower.includes("position") || fieldLower.includes("occupation")) {
        suggestedMappings.push({
          id: `map_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          sourceId: id,
          streamName,
          sourceField: field.name,
          targetTrait: "occupation",
          transformType: "direct",
          matchMethod: "fuzzy",
          confidence: 0.85,
          userConfirmed: false,
        });
        continue;
      }

      // Income detection
      if (fieldLower.includes("income") || fieldLower.includes("salary") || fieldLower.includes("revenue") || fieldLower.includes("compensation")) {
        suggestedMappings.push({
          id: `map_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          sourceId: id,
          streamName,
          sourceField: field.name,
          targetTrait: "income_bracket",
          transformType: "income_to_bracket",
          matchMethod: "fuzzy",
          confidence: 0.75,
          userConfirmed: false,
        });
        continue;
      }

      // Gender detection
      if (fieldLower.includes("gender") || fieldLower === "sex") {
        suggestedMappings.push({
          id: `map_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          sourceId: id,
          streamName,
          sourceField: field.name,
          targetTrait: "gender",
          transformType: "normalize_gender",
          matchMethod: "exact",
          confidence: 0.95,
          userConfirmed: false,
        });
        continue;
      }

      // Education detection
      if (fieldLower.includes("education") || fieldLower.includes("degree")) {
        suggestedMappings.push({
          id: `map_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          sourceId: id,
          streamName,
          sourceField: field.name,
          targetTrait: "education",
          transformType: "normalize_education",
          matchMethod: "fuzzy",
          confidence: 0.8,
          userConfirmed: false,
        });
        continue;
      }
    }

    return NextResponse.json(suggestedMappings);
  } catch (error) {
    console.error("Error suggesting mappings:", error);
    return NextResponse.json(
      { error: "Failed to suggest mappings" },
      { status: 500 }
    );
  }
}
