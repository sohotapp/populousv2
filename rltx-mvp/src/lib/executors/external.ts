// External Executor - Handles API calls and external data sources

import { BaseExecutor } from "./base";
import {
  ExecutorContext,
  ExecutorResult,
  ExecutorType,
  ExecutionError,
} from "./types";

export class ExternalExecutor extends BaseExecutor {
  type: ExecutorType = "external";
  primitiveIds = [
    "data.api.fetch",
    "data.db.query",
    "data.crm.salesforce",
  ];

  async execute(ctx: ExecutorContext): Promise<ExecutorResult> {
    const startedAt = new Date();

    ctx.onProgress(10, "Connecting...");

    let outputs: Record<string, unknown>;

    switch (ctx.primitiveId) {
      case "data.api.fetch":
        outputs = await this.executeApiFetch(ctx);
        break;
      case "data.db.query":
        outputs = await this.executeDbQuery(ctx);
        break;
      case "data.crm.salesforce":
        outputs = await this.executeSalesforceQuery(ctx);
        break;
      default:
        throw new ExecutionError(
          "UNKNOWN_PRIMITIVE",
          `Unknown external primitive: ${ctx.primitiveId}`,
          false
        );
    }

    ctx.onProgress(100, "Complete");

    return {
      outputs,
      timing: this.createTiming(startedAt),
    };
  }

  private async executeApiFetch(ctx: ExecutorContext): Promise<Record<string, unknown>> {
    const { url, method = "GET", headers = {}, body } = ctx.config;

    if (!url) {
      throw new ExecutionError("MISSING_URL", "URL is required for API fetch", false);
    }

    ctx.onProgress(30, `Fetching ${method} ${url}...`);

    try {
      const fetchOptions: RequestInit = {
        method: method as string,
        headers: {
          "Content-Type": "application/json",
          ...(headers as Record<string, string>),
        },
        signal: ctx.abortSignal,
      };

      if (body && method !== "GET") {
        fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
      }

      const response = await fetch(url as string, fetchOptions);

      ctx.onProgress(70, "Parsing response...");

      if (!response.ok) {
        throw new ExecutionError(
          `HTTP_${response.status}`,
          `API returned ${response.status}: ${response.statusText}`,
          response.status >= 500 // 5xx errors are recoverable
        );
      }

      const contentType = response.headers.get("content-type");
      let data: unknown;

      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        response: {
          data,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        },
      };
    } catch (error) {
      if (error instanceof ExecutionError) throw error;

      throw new ExecutionError(
        "FETCH_ERROR",
        `Failed to fetch: ${(error as Error).message}`,
        true // Network errors are usually recoverable
      );
    }
  }

  private async executeDbQuery(ctx: ExecutorContext): Promise<Record<string, unknown>> {
    const { query, connection = "primary" } = ctx.config;

    if (!query) {
      throw new ExecutionError("MISSING_QUERY", "SQL query is required", false);
    }

    ctx.onProgress(30, `Executing query on ${connection}...`);

    // In a real implementation, this would connect to a database
    // For now, return mock data based on query patterns
    const mockResults = this.generateMockDbResults(query as string);

    ctx.onProgress(80, "Processing results...");

    return { results: mockResults };
  }

  private async executeSalesforceQuery(ctx: ExecutorContext): Promise<Record<string, unknown>> {
    const { soqlQuery, objectType = "Account" } = ctx.config;

    if (!soqlQuery) {
      throw new ExecutionError("MISSING_QUERY", "SOQL query is required", false);
    }

    ctx.onProgress(30, `Querying Salesforce ${objectType}...`);

    // In a real implementation, this would use Salesforce API
    // For now, return mock data
    const mockRecords = this.generateMockSalesforceRecords(objectType as string);

    ctx.onProgress(80, "Processing records...");

    return { records: mockRecords };
  }

  private generateMockDbResults(query: string): unknown[] {
    // Generate plausible mock data based on query
    const queryLower = query.toLowerCase();

    if (queryLower.includes("count")) {
      return [{ count: Math.floor(Math.random() * 10000) }];
    }

    if (queryLower.includes("sum") || queryLower.includes("revenue")) {
      return [{ total: Math.floor(Math.random() * 1000000) }];
    }

    // Default: return some rows
    return Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: `Record ${i + 1}`,
      value: Math.floor(Math.random() * 1000),
      created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));
  }

  private generateMockSalesforceRecords(objectType: string): unknown[] {
    switch (objectType) {
      case "Account":
        return Array.from({ length: 5 }, (_, i) => ({
          Id: `001${String(i).padStart(15, "0")}`,
          Name: `Acme Corporation ${i + 1}`,
          Industry: ["Technology", "Healthcare", "Finance", "Manufacturing"][i % 4],
          AnnualRevenue: Math.floor(Math.random() * 10000000),
          NumberOfEmployees: Math.floor(Math.random() * 5000),
        }));

      case "Opportunity":
        return Array.from({ length: 5 }, (_, i) => ({
          Id: `006${String(i).padStart(15, "0")}`,
          Name: `Deal ${i + 1}`,
          Amount: Math.floor(Math.random() * 500000),
          StageName: ["Prospecting", "Qualification", "Proposal", "Negotiation", "Closed Won"][i % 5],
          Probability: [10, 25, 50, 75, 100][i % 5],
          CloseDate: new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        }));

      default:
        return Array.from({ length: 5 }, (_, i) => ({
          Id: `000${String(i).padStart(15, "0")}`,
          Name: `${objectType} ${i + 1}`,
        }));
    }
  }
}

// Export singleton instance
export const externalExecutor = new ExternalExecutor();
