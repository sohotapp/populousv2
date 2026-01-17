// POST /api/merge/callback
// Handle callback after user completes Merge Link OAuth flow
// Exchange public token for account token and store connection

import { NextRequest, NextResponse } from "next/server";
import {
  setLinkedAccount,
  getAllLinkedAccounts,
  type LinkedAccountData,
} from "@/lib/merge/accounts";

const MERGE_API_KEY = process.env.MERGE_API_KEY || "";
const MERGE_API_URL = "https://api.merge.dev/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { publicToken } = body as { publicToken: string };

    if (!publicToken) {
      return NextResponse.json(
        { error: "Missing publicToken" },
        { status: 400 }
      );
    }

    if (!MERGE_API_KEY) {
      return NextResponse.json(
        { error: "Merge API key not configured" },
        { status: 500 }
      );
    }

    // Exchange public token for account token
    const tokenResponse = await fetch(`${MERGE_API_URL}/integrations/account-token/${publicToken}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${MERGE_API_KEY}`,
      },
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange error:", tokenResponse.status, errorData);
      return NextResponse.json(
        { error: "Failed to exchange token", details: errorData },
        { status: tokenResponse.status }
      );
    }

    const tokenData = await tokenResponse.json();
    const accountToken = tokenData.account_token;

    // Get account details
    const accountResponse = await fetch(`${MERGE_API_URL}/integrations/account-details`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${MERGE_API_KEY}`,
        "X-Account-Token": accountToken,
      },
    });

    if (!accountResponse.ok) {
      const errorData = await accountResponse.text();
      console.error("Account details error:", accountResponse.status, errorData);
      return NextResponse.json(
        { error: "Failed to get account details", details: errorData },
        { status: accountResponse.status }
      );
    }

    const accountData = await accountResponse.json();

    // Store the linked account
    const linkedAccount: LinkedAccountData = {
      id: accountData.id,
      accountToken,
      integrationSlug: accountData.integration_slug,
      integrationName: accountData.integration,
      category: accountData.category,
      organizationName: accountData.end_user_organization_name,
      email: accountData.end_user_email_address,
      status: accountData.status,
      createdAt: new Date().toISOString(),
    };

    setLinkedAccount(accountData.id, linkedAccount);

    return NextResponse.json({
      success: true,
      linkedAccountId: accountData.id,
      integration: {
        name: accountData.integration,
        slug: accountData.integration_slug,
        category: accountData.category,
      },
      organization: accountData.end_user_organization_name,
      status: accountData.status,
    });
  } catch (error) {
    console.error("Callback error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/merge/callback - List linked accounts
export async function GET() {
  try {
    const accounts = getAllLinkedAccounts().map(acc => ({
      id: acc.id,
      integrationSlug: acc.integrationSlug,
      integrationName: acc.integrationName,
      category: acc.category,
      organizationName: acc.organizationName,
      status: acc.status,
      createdAt: acc.createdAt,
    }));

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("List accounts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
