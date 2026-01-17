// Merge.dev API Client
// Provides unified access to CRM, HRIS, and other integrations

import { MergeClient } from "@mergeapi/merge-node-client";

// Merge API Configuration
const MERGE_API_KEY = process.env.MERGE_API_KEY || "";
const MERGE_ACCOUNT_TOKEN = process.env.MERGE_ACCOUNT_TOKEN || "";

// Initialize the Merge client
export function getMergeClient(accountToken?: string) {
  return new MergeClient({
    apiKey: MERGE_API_KEY,
    accountToken: accountToken || MERGE_ACCOUNT_TOKEN,
  });
}

// Categories we support
export type MergeCategory = "crm" | "hris" | "accounting" | "ticketing" | "ats";

// Integration metadata
export interface MergeIntegration {
  id: string;
  name: string;
  slug: string;
  category: MergeCategory;
  logo: string;
  color: string;
  squareLogo?: string;
}

// Available integrations by category
export const MERGE_INTEGRATIONS: Record<MergeCategory, MergeIntegration[]> = {
  crm: [
    { id: "salesforce", name: "Salesforce", slug: "salesforce", category: "crm", logo: "salesforce", color: "#00A1E0" },
    { id: "hubspot", name: "HubSpot", slug: "hubspot", category: "crm", logo: "hubspot", color: "#FF7A59" },
    { id: "pipedrive", name: "Pipedrive", slug: "pipedrive", category: "crm", logo: "pipedrive", color: "#25292C" },
    { id: "zoho-crm", name: "Zoho CRM", slug: "zoho-crm", category: "crm", logo: "zoho", color: "#C8202B" },
    { id: "close", name: "Close", slug: "close", category: "crm", logo: "close", color: "#1D364C" },
    { id: "copper", name: "Copper", slug: "copper", category: "crm", logo: "copper", color: "#F8B739" },
    { id: "freshsales", name: "Freshsales", slug: "freshsales", category: "crm", logo: "freshworks", color: "#F26722" },
    { id: "microsoft-dynamics", name: "Microsoft Dynamics 365", slug: "microsoft-dynamics-365-sales", category: "crm", logo: "microsoft", color: "#0078D4" },
  ],
  hris: [
    { id: "workday", name: "Workday", slug: "workday", category: "hris", logo: "workday", color: "#0066CC" },
    { id: "bamboohr", name: "BambooHR", slug: "bamboohr", category: "hris", logo: "bamboohr", color: "#73C41D" },
    { id: "gusto", name: "Gusto", slug: "gusto", category: "hris", logo: "gusto", color: "#F45D48" },
    { id: "rippling", name: "Rippling", slug: "rippling", category: "hris", logo: "rippling", color: "#FEB955" },
    { id: "adp", name: "ADP", slug: "adp-workforce-now", category: "hris", logo: "adp", color: "#D0271D" },
  ],
  accounting: [
    { id: "quickbooks", name: "QuickBooks", slug: "quickbooks-online", category: "accounting", logo: "intuit", color: "#2CA01C" },
    { id: "xero", name: "Xero", slug: "xero", category: "accounting", logo: "xero", color: "#13B5EA" },
    { id: "netsuite", name: "NetSuite", slug: "netsuite", category: "accounting", logo: "oracle", color: "#C74634" },
    { id: "sage", name: "Sage", slug: "sage-intacct", category: "accounting", logo: "sage", color: "#00D639" },
  ],
  ticketing: [
    { id: "zendesk", name: "Zendesk", slug: "zendesk", category: "ticketing", logo: "zendesk", color: "#03363D" },
    { id: "intercom", name: "Intercom", slug: "intercom", category: "ticketing", logo: "intercom", color: "#1F8FFF" },
    { id: "freshdesk", name: "Freshdesk", slug: "freshdesk", category: "ticketing", logo: "freshworks", color: "#F26722" },
  ],
  ats: [
    { id: "greenhouse", name: "Greenhouse", slug: "greenhouse", category: "ats", logo: "greenhouse", color: "#3AB549" },
    { id: "lever", name: "Lever", slug: "lever", category: "ats", logo: "lever", color: "#3D5C70" },
    { id: "workable", name: "Workable", slug: "workable", category: "ats", logo: "workable", color: "#00756D" },
  ],
};

// Get all integrations flat
export function getAllIntegrations(): MergeIntegration[] {
  return Object.values(MERGE_INTEGRATIONS).flat();
}

// Get integration by ID
export function getIntegrationById(id: string): MergeIntegration | undefined {
  return getAllIntegrations().find((i) => i.id === id);
}

// Category labels
export const CATEGORY_LABELS: Record<MergeCategory, string> = {
  crm: "CRM",
  hris: "HR & Payroll",
  accounting: "Accounting",
  ticketing: "Support",
  ats: "Recruiting",
};
