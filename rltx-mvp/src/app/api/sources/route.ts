import { NextRequest, NextResponse } from "next/server";
import { CONNECTOR_CATALOG } from "@/stores/sources";

// Mock data storage (would use database in production)
const dataSources: Map<string, DataSourceRecord> = new Map();

interface DataSourceRecord {
  id: string;
  name: string;
  description?: string;
  connectorType: string;
  connectorImage?: string;
  config: Record<string, string>; // Encrypted in production
  status: "pending" | "connecting" | "ready" | "syncing" | "error";
  errorMessage?: string;
  lastSyncAt?: string;
  lastSyncDurationMs?: number;
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

// GET /api/sources - List all sources
export async function GET() {
  try {
    const sources = Array.from(dataSources.values()).map((source) => ({
      ...source,
      config: undefined, // Don't expose credentials
    }));

    return NextResponse.json({ sources });
  } catch (error) {
    console.error("Error fetching sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch sources" },
      { status: 500 }
    );
  }
}

// POST /api/sources - Create a new source
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, connectorType, config, description } = body;

    if (!name || !connectorType) {
      return NextResponse.json(
        { error: "Name and connector type are required" },
        { status: 400 }
      );
    }

    // Validate connector type
    const connector = CONNECTOR_CATALOG.find((c) => c.id === connectorType);
    if (!connector) {
      return NextResponse.json(
        { error: "Invalid connector type" },
        { status: 400 }
      );
    }

    // Validate required config fields
    const missingFields = connector.configFields
      .filter((f) => f.required && !config?.[f.name])
      .map((f) => f.label);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    const id = `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const source: DataSourceRecord = {
      id,
      name,
      description,
      connectorType,
      connectorImage: connector.icon,
      config: config || {},
      status: "pending",
      recordCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    dataSources.set(id, source);

    // Return without config
    return NextResponse.json({
      id: source.id,
      name: source.name,
      description: source.description,
      connectorType: source.connectorType,
      connectorImage: source.connectorImage,
      status: source.status,
      recordCount: source.recordCount,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    });
  } catch (error) {
    console.error("Error creating source:", error);
    return NextResponse.json(
      { error: "Failed to create source" },
      { status: 500 }
    );
  }
}
