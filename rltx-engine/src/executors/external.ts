interface ExecutorCallbacks {
  onProgress?: (progress: number, message?: string) => void;
}

/**
 * External Executor - Handles API calls and external data sources
 */
export class ExternalExecutor {
  async execute(
    primitiveId: string,
    config: Record<string, unknown>,
    inputs: Record<string, unknown>,
    callbacks: ExecutorCallbacks = {}
  ): Promise<unknown> {
    const { onProgress } = callbacks;

    switch (primitiveId) {
      case "data.api.fetch":
        return this.executeFetch(config, onProgress);

      case "data.crm.salesforce":
        return this.executeSalesforce(config, inputs, onProgress);

      case "data.db.query":
        return this.executeDbQuery(config, inputs, onProgress);

      default:
        throw new Error(`Unknown external primitive: ${primitiveId}`);
    }
  }

  private async executeFetch(
    config: Record<string, unknown>,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<unknown> {
    const url = config.url as string;
    const method = (config.method as string) || "GET";
    const headers = (config.headers as Record<string, string>) || {};
    const body = config.body;

    if (!url) {
      throw new Error("URL is required for API fetch");
    }

    onProgress?.(20, `Fetching ${url}...`);

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      };

      if (body && method !== "GET") {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);

      onProgress?.(80, "Processing response...");

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      let data: unknown;

      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      onProgress?.(100, "Complete");

      return {
        status: response.status,
        data,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error) {
      throw new Error(
        `API fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async executeSalesforce(
    config: Record<string, unknown>,
    inputs: Record<string, unknown>,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<unknown> {
    // Placeholder for Salesforce integration
    // In production, this would use the Salesforce API
    onProgress?.(50, "Salesforce integration not yet implemented");

    return {
      warning: "Salesforce integration placeholder",
      config,
      inputs,
      mockData: {
        accounts: [],
        opportunities: [],
        contacts: [],
      },
    };
  }

  private async executeDbQuery(
    config: Record<string, unknown>,
    inputs: Record<string, unknown>,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<unknown> {
    // Placeholder for database query
    // In production, this would execute SQL against configured databases
    onProgress?.(50, "Database query not yet implemented");

    return {
      warning: "Database query placeholder",
      query: config.query,
      mockData: [],
    };
  }
}
