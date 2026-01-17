// POST /api/merge/link-token
// Generate a link token for Merge Link component

import { NextRequest, NextResponse } from "next/server";
import type { MergeCategory } from "@/lib/merge/client";

const MERGE_API_KEY = process.env.MERGE_API_KEY || "";
const MERGE_API_URL = "https://api.merge.dev/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      endUserEmailAddress,
      endUserOrganizationName,
      endUserOriginId,
      categories,
      integration,
    } = body as {
      endUserEmailAddress: string;
      endUserOrganizationName: string;
      endUserOriginId?: string;
      categories?: MergeCategory[];
      integration?: string;
    };

    // Validate required fields
    if (!endUserEmailAddress || !endUserOrganizationName) {
      return NextResponse.json(
        { error: "Missing required fields: endUserEmailAddress, endUserOrganizationName" },
        { status: 400 }
      );
    }

    if (!MERGE_API_KEY) {
      return NextResponse.json(
        { error: "Merge API key not configured" },
        { status: 500 }
      );
    }

    // Build request body
    const requestBody: Record<string, unknown> = {
      end_user_email_address: endUserEmailAddress,
      end_user_organization_name: endUserOrganizationName,
      end_user_origin_id: endUserOriginId || `rltx_${Date.now()}`,
    };

    // Add categories if specified (limits integrations shown)
    if (categories && categories.length > 0) {
      requestBody.categories = categories;
    }

    // Add specific integration if specified
    if (integration) {
      requestBody.integration = integration;
    }

    // Request link token from Merge
    const response = await fetch(`${MERGE_API_URL}/integrations/create-link-token`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MERGE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Merge API error:", response.status, errorData);
      return NextResponse.json(
        { error: "Failed to generate link token", details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      linkToken: data.link_token,
      integrationName: data.integration_name,
      magicLinkUrl: data.magic_link_url,
    });
  } catch (error) {
    console.error("Link token generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
