import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ConnectorDefinition,
  SourceField,
  AgentTraits,
  TraitDistribution,
  PopulationSegment,
  ConfigField,
} from "@/db/schema";

// Re-export types for convenience
export type {
  ConnectorDefinition,
  SourceField,
  AgentTraits,
  TraitDistribution,
  PopulationSegment,
  ConfigField,
};

// ============ CONNECTOR CATALOG ============
// This would be fetched from PyAirbyte in production, but we define common ones here

export const CONNECTOR_CATALOG: ConnectorDefinition[] = [
  // NOTE: CRM/HRIS connectors are handled via Merge.dev (see DataConnectionWizard)
  // This catalog is for databases, warehouses, and file sources only

  // Databases
  {
    id: "postgres",
    name: "PostgreSQL",
    icon: "🐘",
    category: "database",
    description: "Open-source relational database",
    popularity: 5,
    authType: "connection_string",
    configFields: [
      { name: "host", label: "Host", type: "text", required: true, placeholder: "localhost" },
      { name: "port", label: "Port", type: "text", required: true, placeholder: "5432" },
      { name: "database", label: "Database", type: "text", required: true },
      { name: "username", label: "Username", type: "text", required: true },
      { name: "password", label: "Password", type: "password", required: true },
      { name: "ssl", label: "Use SSL", type: "checkbox", required: false },
    ],
  },
  {
    id: "mysql",
    name: "MySQL",
    icon: "🐬",
    category: "database",
    description: "Popular relational database",
    popularity: 5,
    authType: "connection_string",
    configFields: [
      { name: "host", label: "Host", type: "text", required: true },
      { name: "port", label: "Port", type: "text", required: true, placeholder: "3306" },
      { name: "database", label: "Database", type: "text", required: true },
      { name: "username", label: "Username", type: "text", required: true },
      { name: "password", label: "Password", type: "password", required: true },
    ],
  },
  {
    id: "mongodb",
    name: "MongoDB",
    icon: "🍃",
    category: "database",
    description: "NoSQL document database",
    popularity: 4,
    authType: "connection_string",
    configFields: [
      { name: "connection_string", label: "Connection String", type: "password", required: true, placeholder: "mongodb://..." },
      { name: "database", label: "Database", type: "text", required: true },
    ],
  },
  // Data Warehouses
  {
    id: "snowflake",
    name: "Snowflake",
    icon: "❄️",
    category: "warehouse",
    description: "Cloud data warehouse",
    popularity: 5,
    authType: "basic",
    configFields: [
      { name: "account", label: "Account", type: "text", required: true },
      { name: "warehouse", label: "Warehouse", type: "text", required: true },
      { name: "database", label: "Database", type: "text", required: true },
      { name: "schema", label: "Schema", type: "text", required: true },
      { name: "username", label: "Username", type: "text", required: true },
      { name: "password", label: "Password", type: "password", required: true },
    ],
  },
  {
    id: "bigquery",
    name: "BigQuery",
    icon: "📊",
    category: "warehouse",
    description: "Google Cloud data warehouse",
    popularity: 5,
    authType: "oauth",
    configFields: [
      { name: "project_id", label: "Project ID", type: "text", required: true },
      { name: "credentials_json", label: "Service Account JSON", type: "password", required: true },
      { name: "dataset_id", label: "Dataset ID", type: "text", required: false },
    ],
  },
  {
    id: "redshift",
    name: "Redshift",
    icon: "🔶",
    category: "warehouse",
    description: "AWS data warehouse",
    popularity: 4,
    authType: "connection_string",
    configFields: [
      { name: "host", label: "Host", type: "text", required: true },
      { name: "port", label: "Port", type: "text", required: true, placeholder: "5439" },
      { name: "database", label: "Database", type: "text", required: true },
      { name: "username", label: "Username", type: "text", required: true },
      { name: "password", label: "Password", type: "password", required: true },
    ],
  },
  // Files
  {
    id: "csv",
    name: "CSV File",
    icon: "📄",
    category: "files",
    description: "Upload CSV files",
    popularity: 5,
    authType: "basic",
    configFields: [],
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    icon: "📗",
    category: "files",
    description: "Google spreadsheets",
    popularity: 5,
    authType: "oauth",
    configFields: [
      { name: "spreadsheet_id", label: "Spreadsheet ID", type: "text", required: true },
      { name: "credentials_json", label: "Service Account JSON", type: "password", required: true },
    ],
  },
  {
    id: "s3",
    name: "Amazon S3",
    icon: "🪣",
    category: "files",
    description: "AWS object storage",
    popularity: 4,
    authType: "api_key",
    configFields: [
      { name: "bucket", label: "Bucket Name", type: "text", required: true },
      { name: "aws_access_key_id", label: "Access Key ID", type: "text", required: true },
      { name: "aws_secret_access_key", label: "Secret Access Key", type: "password", required: true },
      { name: "region", label: "Region", type: "text", required: false, placeholder: "us-east-1" },
      { name: "path_prefix", label: "Path Prefix", type: "text", required: false },
    ],
  },
  // Marketing
  {
    id: "mailchimp",
    name: "Mailchimp",
    icon: "🐵",
    category: "marketing",
    description: "Email marketing platform",
    popularity: 4,
    authType: "api_key",
    configFields: [
      { name: "api_key", label: "API Key", type: "password", required: true },
    ],
  },
  {
    id: "klaviyo",
    name: "Klaviyo",
    icon: "💚",
    category: "marketing",
    description: "Email & SMS marketing",
    popularity: 4,
    authType: "api_key",
    configFields: [
      { name: "api_key", label: "Private API Key", type: "password", required: true },
    ],
  },
  // Analytics
  {
    id: "mixpanel",
    name: "Mixpanel",
    icon: "📈",
    category: "analytics",
    description: "Product analytics",
    popularity: 4,
    authType: "api_key",
    configFields: [
      { name: "api_secret", label: "API Secret", type: "password", required: true },
      { name: "project_id", label: "Project ID", type: "text", required: false },
    ],
  },
  {
    id: "amplitude",
    name: "Amplitude",
    icon: "📊",
    category: "analytics",
    description: "Product analytics",
    popularity: 4,
    authType: "api_key",
    configFields: [
      { name: "api_key", label: "API Key", type: "password", required: true },
      { name: "secret_key", label: "Secret Key", type: "password", required: true },
    ],
  },
  {
    id: "segment",
    name: "Segment",
    icon: "🟩",
    category: "analytics",
    description: "Customer data platform",
    popularity: 4,
    authType: "api_key",
    configFields: [
      { name: "write_key", label: "Write Key", type: "password", required: true },
    ],
  },
  // APIs
  {
    id: "rest-api",
    name: "REST API",
    icon: "🔗",
    category: "api",
    description: "Generic REST API connector",
    popularity: 4,
    authType: "api_key",
    configFields: [
      { name: "base_url", label: "Base URL", type: "text", required: true, placeholder: "https://api.example.com" },
      { name: "auth_header", label: "Auth Header", type: "text", required: false, placeholder: "Authorization" },
      { name: "auth_value", label: "Auth Value", type: "password", required: false },
    ],
  },
  {
    id: "graphql",
    name: "GraphQL",
    icon: "◼️",
    category: "api",
    description: "Generic GraphQL connector",
    popularity: 3,
    authType: "api_key",
    configFields: [
      { name: "endpoint", label: "GraphQL Endpoint", type: "text", required: true },
      { name: "headers", label: "Headers (JSON)", type: "text", required: false },
    ],
  },
  // Survey/Research
  {
    id: "surveymonkey",
    name: "SurveyMonkey",
    icon: "🐒",
    category: "other",
    description: "Survey platform",
    popularity: 3,
    authType: "oauth",
    configFields: [
      { name: "access_token", label: "Access Token", type: "password", required: true },
    ],
  },
  {
    id: "typeform",
    name: "Typeform",
    icon: "📝",
    category: "other",
    description: "Form & survey builder",
    popularity: 3,
    authType: "api_key",
    configFields: [
      { name: "api_key", label: "Personal Access Token", type: "password", required: true },
    ],
  },
  {
    id: "qualtrics",
    name: "Qualtrics",
    icon: "🔬",
    category: "other",
    description: "Experience management",
    popularity: 3,
    authType: "api_key",
    configFields: [
      { name: "api_token", label: "API Token", type: "password", required: true },
      { name: "datacenter_id", label: "Datacenter ID", type: "text", required: true },
    ],
  },
];

// ============ TYPES ============

export interface DataSource {
  id: string;
  name: string;
  description?: string;
  connectorType: string;
  connectorImage?: string;
  status: "pending" | "connecting" | "ready" | "syncing" | "error";
  errorMessage?: string;
  lastSyncAt?: string;
  lastSyncDurationMs?: number;
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SourceSchema {
  id: string;
  sourceId: string;
  streamName: string;
  streamNamespace?: string;
  fields: SourceField[];
  sampleRecords?: Record<string, unknown>[];
  discoveredAt: string;
  recordCount?: number;
}

export interface FieldMapping {
  id: string;
  sourceId: string;
  streamName: string;
  sourceField: string;
  targetTrait: string;
  transformType: string;
  transformConfig?: Record<string, unknown>;
  matchMethod: string;
  confidence: number;
  userConfirmed: boolean;
  validationErrors?: string[];
  sampleOutput?: unknown[];
}

export interface PopulationIndex {
  id: string;
  sourceId: string;
  streamName: string;
  name: string;
  description?: string;
  distributions: Record<string, TraitDistribution>;
  segments?: PopulationSegment[];
  totalRecords: number;
  completeRecords: number;
  traitCoverage?: Record<string, number>;
  status: "building" | "ready" | "stale";
  builtAt?: string;
}

export interface IndexedAgent {
  id: string;
  populationId: string;
  traits: AgentTraits;
  inferredTraits?: Partial<AgentTraits>;
  traitCompleteness: number;
}

// ============ RLTX TRAIT DEFINITIONS ============

export const RLTX_TRAITS = [
  { name: "age", label: "Age", type: "number", required: true },
  { name: "gender", label: "Gender", type: "enum", options: ["male", "female", "non-binary", "other"], required: false },
  { name: "income", label: "Income", type: "number", required: false },
  { name: "income_bracket", label: "Income Bracket", type: "enum", options: ["low", "medium", "high", "affluent"], required: true },
  { name: "education", label: "Education", type: "enum", options: ["high_school", "some_college", "bachelors", "graduate", "doctorate"], required: false },
  { name: "occupation", label: "Occupation", type: "string", required: true },
  { name: "location_type", label: "Location Type", type: "enum", options: ["urban", "suburban", "rural"], required: false },
  { name: "location_name", label: "Location Name", type: "string", required: true },
  { name: "household_composition", label: "Household", type: "string", required: false },
  { name: "risk_tolerance", label: "Risk Tolerance", type: "number", range: [0, 1], required: false },
  { name: "price_sensitivity", label: "Price Sensitivity", type: "number", range: [0, 1], required: false },
  { name: "brand_loyalty", label: "Brand Loyalty", type: "number", range: [0, 1], required: false },
] as const;

// ============ TRANSFORM DEFINITIONS ============

export const TRANSFORM_TYPES = [
  { id: "direct", label: "Direct Copy", description: "Copy value as-is" },
  { id: "date_to_age", label: "Date to Age", description: "Calculate age from birthdate" },
  { id: "income_to_bracket", label: "Income to Bracket", description: "Map income to bracket (low/medium/high/affluent)" },
  { id: "location_to_type", label: "Location to Type", description: "Classify as urban/suburban/rural" },
  { id: "normalize_gender", label: "Normalize Gender", description: "Map to male/female/non-binary/other" },
  { id: "normalize_education", label: "Normalize Education", description: "Map to education level" },
  { id: "concat", label: "Concatenate", description: "Combine multiple fields" },
  { id: "lookup", label: "Lookup Table", description: "Map values using a lookup table" },
  { id: "scale", label: "Scale to Range", description: "Scale numeric value to 0-1 range" },
  { id: "custom", label: "Custom Expression", description: "Custom JavaScript expression" },
] as const;

// ============ STORE ============

interface SourcesState {
  // Data
  sources: DataSource[];
  schemas: Record<string, SourceSchema[]>; // sourceId -> schemas
  mappings: Record<string, FieldMapping[]>; // sourceId -> mappings
  populations: Record<string, PopulationIndex[]>; // sourceId -> populations

  // UI State
  selectedSourceId: string | null;
  selectedStreamName: string | null;
  isLoading: boolean;
  error: string | null;

  // Wizard state
  wizardStep: "connector" | "config" | "schema" | "mapping" | "build" | "done";
  wizardConnector: ConnectorDefinition | null;
  wizardConfig: Record<string, string>;

  // Actions
  fetchSources: () => Promise<void>;
  createSource: (data: {
    name: string;
    connectorType: string;
    config: Record<string, string>;
    description?: string;
    // Merge-specific fields
    mergeLinkedAccountId?: string;
    mergeCategory?: string;
    recordCount?: number;
  }) => Promise<DataSource>;
  deleteSource: (sourceId: string) => Promise<void>;
  testConnection: (sourceId: string) => Promise<{ success: boolean; error?: string }>;

  discoverSchema: (sourceId: string) => Promise<SourceSchema[]>;

  getMappings: (sourceId: string, streamName: string) => Promise<FieldMapping[]>;
  suggestMappings: (sourceId: string, streamName: string) => Promise<FieldMapping[]>;
  saveMappings: (sourceId: string, streamName: string, mappings: FieldMapping[]) => Promise<void>;

  buildPopulation: (sourceId: string, streamName: string, name: string) => Promise<PopulationIndex>;
  sampleAgents: (populationId: string, count: number) => Promise<IndexedAgent[]>;

  syncSource: (sourceId: string) => Promise<void>;

  // UI Actions
  setSelectedSource: (sourceId: string | null) => void;
  setSelectedStream: (streamName: string | null) => void;
  setWizardStep: (step: SourcesState["wizardStep"]) => void;
  setWizardConnector: (connector: ConnectorDefinition | null) => void;
  setWizardConfig: (config: Record<string, string>) => void;
  resetWizard: () => void;
}

export const useSourcesStore = create<SourcesState>()(
  persist(
    (set, get) => ({
  // Initial state
  sources: [],
  schemas: {},
  mappings: {},
  populations: {},
  selectedSourceId: null,
  selectedStreamName: null,
  isLoading: false,
  error: null,
  wizardStep: "connector",
  wizardConnector: null,
  wizardConfig: {},

  // Fetch all sources
  fetchSources: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch("/api/sources");
      if (!response.ok) throw new Error("Failed to fetch sources");
      const data = await response.json();
      set({ sources: data.sources, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to fetch sources", isLoading: false });
    }
  },

  // Create a new data source
  createSource: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create source");
      }
      const source = await response.json();
      set((state) => ({
        sources: [source, ...state.sources],
        isLoading: false,
      }));
      return source;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to create source", isLoading: false });
      throw error;
    }
  },

  // Delete a source
  deleteSource: async (sourceId) => {
    try {
      const response = await fetch(`/api/sources/${sourceId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete source");
      set((state) => ({
        sources: state.sources.filter((s) => s.id !== sourceId),
        selectedSourceId: state.selectedSourceId === sourceId ? null : state.selectedSourceId,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to delete source" });
      throw error;
    }
  },

  // Test connection
  testConnection: async (sourceId) => {
    try {
      const response = await fetch(`/api/sources/${sourceId}/test`, { method: "POST" });
      const result = await response.json();

      // Update source status
      set((state) => ({
        sources: state.sources.map((s) =>
          s.id === sourceId
            ? { ...s, status: result.success ? "ready" : "error", errorMessage: result.error }
            : s
        ),
      }));

      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Connection test failed" };
    }
  },

  // Discover schema
  discoverSchema: async (sourceId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/sources/${sourceId}/schema`);
      if (!response.ok) throw new Error("Failed to discover schema");
      const schemas = await response.json();
      set((state) => ({
        schemas: { ...state.schemas, [sourceId]: schemas },
        isLoading: false,
      }));
      return schemas;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to discover schema", isLoading: false });
      throw error;
    }
  },

  // Get mappings
  getMappings: async (sourceId, streamName) => {
    try {
      const response = await fetch(`/api/sources/${sourceId}/mappings?stream=${streamName}`);
      if (!response.ok) throw new Error("Failed to get mappings");
      const mappings = await response.json();
      set((state) => ({
        mappings: {
          ...state.mappings,
          [`${sourceId}:${streamName}`]: mappings,
        },
      }));
      return mappings;
    } catch (error) {
      throw error;
    }
  },

  // AI-suggest mappings
  suggestMappings: async (sourceId, streamName) => {
    set({ isLoading: true });
    try {
      const response = await fetch(`/api/sources/${sourceId}/mappings/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamName }),
      });
      if (!response.ok) throw new Error("Failed to suggest mappings");
      const mappings = await response.json();
      set({ isLoading: false });
      return mappings;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // Save mappings
  saveMappings: async (sourceId, streamName, mappings) => {
    try {
      const response = await fetch(`/api/sources/${sourceId}/mappings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamName, mappings }),
      });
      if (!response.ok) throw new Error("Failed to save mappings");
      set((state) => ({
        mappings: {
          ...state.mappings,
          [`${sourceId}:${streamName}`]: mappings,
        },
      }));
    } catch (error) {
      throw error;
    }
  },

  // Build population index
  buildPopulation: async (sourceId, streamName, name) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/sources/${sourceId}/populations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamName, name }),
      });
      if (!response.ok) throw new Error("Failed to build population");
      const population = await response.json();
      set((state) => ({
        populations: {
          ...state.populations,
          [sourceId]: [...(state.populations[sourceId] || []), population],
        },
        isLoading: false,
      }));
      return population;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to build population", isLoading: false });
      throw error;
    }
  },

  // Sample agents from population
  sampleAgents: async (populationId, count) => {
    try {
      const response = await fetch(`/api/populations/${populationId}/sample?count=${count}`);
      if (!response.ok) throw new Error("Failed to sample agents");
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Sync source
  syncSource: async (sourceId) => {
    set((state) => ({
      sources: state.sources.map((s) =>
        s.id === sourceId ? { ...s, status: "syncing" } : s
      ),
    }));
    try {
      const response = await fetch(`/api/sources/${sourceId}/sync`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to sync source");
      const result = await response.json();
      set((state) => ({
        sources: state.sources.map((s) =>
          s.id === sourceId
            ? { ...s, status: "ready", lastSyncAt: result.syncedAt, recordCount: result.recordCount }
            : s
        ),
      }));
    } catch (error) {
      set((state) => ({
        sources: state.sources.map((s) =>
          s.id === sourceId ? { ...s, status: "error", errorMessage: error instanceof Error ? error.message : "Sync failed" } : s
        ),
      }));
      throw error;
    }
  },

  // UI Actions
  setSelectedSource: (sourceId) => set({ selectedSourceId: sourceId }),
  setSelectedStream: (streamName) => set({ selectedStreamName: streamName }),
  setWizardStep: (step) => set({ wizardStep: step }),
  setWizardConnector: (connector) => set({ wizardConnector: connector }),
  setWizardConfig: (config) => set({ wizardConfig: config }),
  resetWizard: () =>
    set({
      wizardStep: "connector",
      wizardConnector: null,
      wizardConfig: {},
    }),
    }),
    {
      name: "rltx-sources-store",
      partialize: (state) => ({
        // Only persist sources data, not UI state
        sources: state.sources,
      }),
    }
  )
);

// ============ HELPER FUNCTIONS ============

export function getConnectorById(id: string): ConnectorDefinition | undefined {
  return CONNECTOR_CATALOG.find((c) => c.id === id);
}

export function getConnectorsByCategory(category: ConnectorDefinition["category"]): ConnectorDefinition[] {
  return CONNECTOR_CATALOG.filter((c) => c.category === category);
}

export function getConnectorCategories(): { id: string; label: string; count: number }[] {
  // NOTE: CRM/HRIS categories removed - those are handled via Merge.dev
  const categories = [
    { id: "database", label: "Database" },
    { id: "warehouse", label: "Data Warehouse" },
    { id: "files", label: "Files" },
    { id: "marketing", label: "Marketing" },
    { id: "analytics", label: "Analytics" },
    { id: "api", label: "API" },
    { id: "other", label: "Other" },
  ];

  return categories
    .map((cat) => ({
      ...cat,
      count: CONNECTOR_CATALOG.filter((c) => c.category === cat.id).length,
    }))
    .filter((cat) => cat.count > 0); // Only show categories with connectors
}

export function getStatusColor(status: DataSource["status"]): string {
  switch (status) {
    case "ready":
      return "hsl(142, 70%, 45%)"; // Green
    case "syncing":
      return "hsl(210, 70%, 55%)"; // Blue
    case "connecting":
      return "hsl(38, 90%, 50%)"; // Amber
    case "error":
      return "hsl(0, 70%, 55%)"; // Red
    default:
      return "hsl(0, 0%, 50%)"; // Gray
  }
}

export function getStatusLabel(status: DataSource["status"]): string {
  switch (status) {
    case "ready":
      return "Connected";
    case "syncing":
      return "Syncing...";
    case "connecting":
      return "Connecting...";
    case "error":
      return "Error";
    default:
      return "Pending";
  }
}
