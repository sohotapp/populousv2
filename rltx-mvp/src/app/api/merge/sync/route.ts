// POST /api/merge/sync
// Sync data from a linked Merge account and transform to RLTX agents

import { NextRequest, NextResponse } from "next/server";
import type { MergeContact, MergeLead, MergeEmployee, MergeAccount, MergePaginatedResponse } from "@/lib/merge/types";
import {
  batchTransformContacts,
  batchTransformEmployees,
  type TransformResult,
} from "@/lib/merge/transforms";
import { getAccountToken } from "@/lib/merge/accounts";

const MERGE_API_KEY = process.env.MERGE_API_KEY || "";
const MERGE_API_URL = "https://api.merge.dev/api";

// In-memory storage for synced data (replace with database)
const syncedAgents = new Map<string, TransformResult[]>();

interface SyncRequest {
  linkedAccountId: string;
  accountToken?: string;
  dataTypes?: ("contacts" | "leads" | "employees")[];
  fieldMappings?: Record<string, string>;
  limit?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SyncRequest;
    const {
      linkedAccountId,
      accountToken: providedToken,
      dataTypes = ["contacts"],
      fieldMappings,
      limit = 1000,
    } = body;

    // Get account token
    const accountToken = providedToken || getAccountToken(linkedAccountId);

    if (!accountToken) {
      return NextResponse.json(
        { error: "Account token not found. Please reconnect the integration." },
        { status: 400 }
      );
    }

    if (!MERGE_API_KEY) {
      return NextResponse.json(
        { error: "Merge API key not configured" },
        { status: 500 }
      );
    }

    const results: {
      dataType: string;
      recordsFetched: number;
      agentsCreated: number;
      averageCompleteness: number;
    }[] = [];

    const allAgents: TransformResult[] = [];

    // Fetch and transform each data type
    for (const dataType of dataTypes) {
      let agents: TransformResult[] = [];
      let recordsFetched = 0;

      if (dataType === "contacts") {
        const { contacts, accounts } = await fetchCRMData(accountToken, limit);
        recordsFetched = contacts.length;

        // Create account lookup map
        const accountMap = new Map<string, MergeAccount>();
        accounts.forEach(acc => accountMap.set(acc.id, acc));

        agents = batchTransformContacts(contacts, accountMap, fieldMappings);
      } else if (dataType === "leads") {
        const leads = await fetchLeads(accountToken, limit);
        recordsFetched = leads.length;
        agents = leads.map(lead => {
          const traits = {
            occupation: lead.title || undefined,
            location_name: lead.addresses?.[0]?.city || undefined,
          };
          return {
            success: true,
            agentId: `agent_${lead.id}`,
            sourceId: lead.id,
            traits,
            completeness: Object.keys(traits).filter(k => traits[k as keyof typeof traits]).length * 20,
          };
        });
      } else if (dataType === "employees") {
        const employees = await fetchEmployees(accountToken, limit);
        recordsFetched = employees.length;
        agents = batchTransformEmployees(employees);
      }

      // Calculate average completeness
      const avgCompleteness = agents.length > 0
        ? Math.round(agents.reduce((sum, a) => sum + a.completeness, 0) / agents.length)
        : 0;

      results.push({
        dataType,
        recordsFetched,
        agentsCreated: agents.length,
        averageCompleteness: avgCompleteness,
      });

      allAgents.push(...agents);
    }

    // Store the synced agents
    syncedAgents.set(linkedAccountId, allAgents);

    // Calculate overall stats
    const totalRecords = results.reduce((sum, r) => sum + r.recordsFetched, 0);
    const totalAgents = results.reduce((sum, r) => sum + r.agentsCreated, 0);
    const overallCompleteness = allAgents.length > 0
      ? Math.round(allAgents.reduce((sum, a) => sum + a.completeness, 0) / allAgents.length)
      : 0;

    return NextResponse.json({
      success: true,
      linkedAccountId,
      summary: {
        totalRecords,
        totalAgents,
        averageCompleteness: overallCompleteness,
        syncedAt: new Date().toISOString(),
      },
      byDataType: results,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

// GET /api/merge/sync - Get synced agents
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const linkedAccountId = searchParams.get("linkedAccountId");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 100;

    if (!linkedAccountId) {
      return NextResponse.json(
        { error: "Missing linkedAccountId" },
        { status: 400 }
      );
    }

    const agents = syncedAgents.get(linkedAccountId) || [];
    const limitedAgents = agents.slice(0, limit);

    return NextResponse.json({
      linkedAccountId,
      totalAgents: agents.length,
      agents: limitedAgents,
    });
  } catch (error) {
    console.error("Get synced agents error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DATA FETCHING HELPERS
// =============================================================================

async function fetchCRMData(
  accountToken: string,
  limit: number
): Promise<{ contacts: MergeContact[]; accounts: MergeAccount[] }> {
  const headers = {
    "Authorization": `Bearer ${MERGE_API_KEY}`,
    "X-Account-Token": accountToken,
  };

  // Fetch contacts
  const contactsResponse = await fetch(
    `${MERGE_API_URL}/crm/v1/contacts?page_size=${Math.min(limit, 100)}`,
    { headers }
  );

  if (!contactsResponse.ok) {
    throw new Error(`Failed to fetch contacts: ${contactsResponse.status}`);
  }

  const contactsData = await contactsResponse.json() as MergePaginatedResponse<MergeContact>;
  let contacts = contactsData.results;

  // Paginate if needed
  let nextUrl = contactsData.next;
  while (nextUrl && contacts.length < limit) {
    const pageResponse = await fetch(nextUrl, { headers });
    if (!pageResponse.ok) break;
    const pageData = await pageResponse.json() as MergePaginatedResponse<MergeContact>;
    contacts = contacts.concat(pageData.results);
    nextUrl = pageData.next;
  }

  // Fetch associated accounts
  const accountIds = Array.from(new Set(contacts.map(c => c.account).filter(Boolean)));
  const accounts: MergeAccount[] = [];

  for (const accountId of accountIds.slice(0, 50)) {
    try {
      const accountResponse = await fetch(
        `${MERGE_API_URL}/crm/v1/accounts/${accountId}`,
        { headers }
      );
      if (accountResponse.ok) {
        accounts.push(await accountResponse.json());
      }
    } catch {
      // Skip failed account fetches
    }
  }

  return { contacts: contacts.slice(0, limit), accounts };
}

async function fetchLeads(accountToken: string, limit: number): Promise<MergeLead[]> {
  const headers = {
    "Authorization": `Bearer ${MERGE_API_KEY}`,
    "X-Account-Token": accountToken,
  };

  const response = await fetch(
    `${MERGE_API_URL}/crm/v1/leads?page_size=${Math.min(limit, 100)}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch leads: ${response.status}`);
  }

  const data = await response.json() as MergePaginatedResponse<MergeLead>;
  return data.results.slice(0, limit);
}

async function fetchEmployees(accountToken: string, limit: number): Promise<MergeEmployee[]> {
  const headers = {
    "Authorization": `Bearer ${MERGE_API_KEY}`,
    "X-Account-Token": accountToken,
  };

  const response = await fetch(
    `${MERGE_API_URL}/hris/v1/employees?page_size=${Math.min(limit, 100)}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch employees: ${response.status}`);
  }

  const data = await response.json() as MergePaginatedResponse<MergeEmployee>;
  return data.results.slice(0, limit);
}
