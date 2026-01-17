import { NextRequest, NextResponse } from "next/server";
import { CONNECTOR_CATALOG } from "@/stores/sources";
import { MERGE_INTEGRATIONS, type MergeCategory } from "@/lib/merge/client";

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
  // Merge-specific fields
  mergeLinkedAccountId?: string;
  mergeCategory?: string;
}

// Helper to check if connector type is a Merge integration
function isMergeConnector(connectorType: string): boolean {
  return connectorType.startsWith("merge-");
}

// Get Merge integration details from connector type (e.g., "merge-salesforce" -> salesforce)
function getMergeIntegration(connectorType: string) {
  const slug = connectorType.replace("merge-", "");
  for (const category of Object.keys(MERGE_INTEGRATIONS) as MergeCategory[]) {
    const integration = MERGE_INTEGRATIONS[category].find(i => i.slug === slug);
    if (integration) return integration;
  }
  return null;
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
    const { name, connectorType, config, description, mergeLinkedAccountId, mergeCategory, recordCount: initialRecordCount } = body;

    if (!name || !connectorType) {
      return NextResponse.json(
        { error: "Name and connector type are required" },
        { status: 400 }
      );
    }

    const id = `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    // Handle Merge connectors differently
    if (isMergeConnector(connectorType)) {
      const mergeIntegration = getMergeIntegration(connectorType);

      if (!mergeIntegration) {
        return NextResponse.json(
          { error: "Invalid Merge integration type" },
          { status: 400 }
        );
      }

      if (!mergeLinkedAccountId) {
        return NextResponse.json(
          { error: "Merge linked account ID is required" },
          { status: 400 }
        );
      }

      const source: DataSourceRecord = {
        id,
        name,
        description: description || `${mergeIntegration.name} integration via Merge`,
        connectorType,
        connectorImage: mergeIntegration.slug, // Use slug for ConnectorLogo lookup
        config: {}, // No credentials needed - stored in Merge
        status: "ready", // Already synced via Merge
        recordCount: initialRecordCount || 0,
        createdAt: now,
        updatedAt: now,
        lastSyncAt: now,
        mergeLinkedAccountId,
        mergeCategory: mergeCategory || mergeIntegration.category,
      };

      dataSources.set(id, source);

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
        lastSyncAt: source.lastSyncAt,
      });
    }

    // Standard connector handling
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
