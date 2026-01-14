// Data store for uploaded files
// In production, would use cloud storage (S3, GCS, etc.)

export interface UploadedData {
  dataId: string;
  filename: string;
  type: "pdf" | "csv" | "docx" | "json" | "xlsx" | "txt";
  schema: {
    fields: Array<{ name: string; type: string; nullable: boolean }>;
  };
  rowCount: number;
  preview: unknown[];
  size: number;
  uploadedAt: string;
  rawContent?: string;
}

export interface StoredData extends UploadedData {
  content: unknown;
}

// In-memory storage for development
const dataStore = new Map<string, StoredData>();

export function getStoredData(dataId: string): StoredData | undefined {
  return dataStore.get(dataId);
}

export function setStoredData(dataId: string, data: StoredData): void {
  dataStore.set(dataId, data);
}

export function deleteStoredData(dataId: string): boolean {
  return dataStore.delete(dataId);
}

export function getAllStoredData(): UploadedData[] {
  return Array.from(dataStore.values()).map(({ content, ...rest }) => rest);
}
