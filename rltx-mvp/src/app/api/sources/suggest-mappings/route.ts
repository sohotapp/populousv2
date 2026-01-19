/**
 * Field Mapping Suggestions API
 * 
 * POST /api/sources/suggest-mappings
 * 
 * Uses semantic similarity and pattern matching to suggest
 * field mappings from source data to RLTX traits.
 */

import { NextRequest, NextResponse } from "next/server";
import { suggestFieldMappings } from "@/lib/population/data-source-integration";

interface SourceField {
  name: string;
  type: string;
  sample?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fields } = body as { fields: SourceField[] };

    if (!fields || !Array.isArray(fields)) {
      return NextResponse.json(
        { error: "Fields array is required" },
        { status: 400 }
      );
    }

    // Get suggestions using pattern matching
    const suggestions = suggestFieldMappings(fields);

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error("[suggest-mappings] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate mapping suggestions" },
      { status: 500 }
    );
  }
}
