// In-memory mock database for demo mode
// This module is shared across all API routes during the dev server session

export interface MockWorkflow {
  id: string;
  name: string;
  question: string;
  graph: { nodes: unknown[]; edges: unknown[] };
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  pattern?: string;
  analysisDepth?: string;
}

// Use global to persist across hot reloads in dev
const globalForMockDb = globalThis as typeof globalThis & {
  mockWorkflowStore: Map<string, MockWorkflow> | undefined;
};

// Initialize with seed data if not already initialized
if (!globalForMockDb.mockWorkflowStore) {
  globalForMockDb.mockWorkflowStore = new Map([
    ["demo-workflow-1", {
      id: "demo-workflow-1",
      name: "Market Expansion Analysis",
      question: "Should we expand into the European market?",
      graph: { nodes: [], edges: [] },
      status: "draft",
      createdBy: "demo-user",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      pattern: "change_impact",
      analysisDepth: "standard",
    }],
  ]);
}

export const mockWorkflowStore = globalForMockDb.mockWorkflowStore;

// Helper functions for CRUD operations
export function getAllWorkflows(): MockWorkflow[] {
  return Array.from(mockWorkflowStore.values())
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getWorkflow(id: string): MockWorkflow | undefined {
  return mockWorkflowStore.get(id);
}

export function createWorkflow(data: Omit<MockWorkflow, "id" | "createdAt" | "updatedAt" | "createdBy">): MockWorkflow {
  const id = `workflow-${Date.now()}`;
  const now = new Date().toISOString();
  const workflow: MockWorkflow = {
    ...data,
    id,
    createdBy: "demo-user",
    createdAt: now,
    updatedAt: now,
  };
  mockWorkflowStore.set(id, workflow);
  console.log(`[MockDB] Created workflow: ${id} - ${data.name}`);
  return workflow;
}

export function updateWorkflow(id: string, data: Partial<MockWorkflow>): MockWorkflow | null {
  const existing = mockWorkflowStore.get(id);
  if (!existing) return null;

  const updated: MockWorkflow = {
    ...existing,
    ...data,
    id, // Ensure ID can't be changed
    updatedAt: new Date().toISOString(),
  };
  mockWorkflowStore.set(id, updated);
  console.log(`[MockDB] Updated workflow: ${id}`);
  return updated;
}

export function deleteWorkflow(id: string): boolean {
  if (!mockWorkflowStore.has(id)) return false;
  mockWorkflowStore.delete(id);
  console.log(`[MockDB] Deleted workflow: ${id}`);
  return true;
}
